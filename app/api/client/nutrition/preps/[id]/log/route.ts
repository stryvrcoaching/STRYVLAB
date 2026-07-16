export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { createSupabaseService, resolveClientIdFromUserId } from "@/lib/nutrition/preps-service"
import { computeMacroEnergy } from "@/lib/nutrition/energy"
import { resolveClientLanguage } from "@/lib/client/resolve-language"
import { resolveClientTimezone } from "@/lib/client/checkin/resolveClientTimezone"
import { computePhysiologicalDate } from "@/lib/nutrition/physiological-date"
import { ct, type ClientLang } from "@/lib/i18n/clientTranslations"

function getMealTypeLabel(mealType: string | null) {
  switch (mealType) {
    case "breakfast":
      return "petit-déjeuner"
    case "lunch":
      return "déjeuner"
    case "dinner":
      return "dîner"
    case "snack":
      return "encas"
    default:
      return "repas"
  }
}

function formatFrenchNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits }).format(value)
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientIdFromUserId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const db = createSupabaseService()
  const lang = await resolveClientLanguage(db, clientId) as ClientLang
  const timezone = await resolveClientTimezone(db, clientId)
  const { data: prep, error: prepError } = await db
    .from("client_nutrition_preps")
    .select("id, physiological_date, title, meal_type, entries, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, consumed_meal_id, status")
    .eq("id", params.id)
    .eq("client_id", clientId)
    .in("status", ["planned", "logged"])
    .single()

  if (prepError || !prep) {
    return NextResponse.json({ error: prepError?.message ?? "Prep not found" }, { status: 404 })
  }

  const today = computePhysiologicalDate(new Date(), timezone)
  if (prep.physiological_date !== today) {
    return NextResponse.json({ error: "Prep can only be logged on its planned date" }, { status: 409 })
  }

  // Idempotency: already logged on a previous attempt
  if (prep.status === "logged" || prep.consumed_meal_id) {
    return NextResponse.json({ id: prep.consumed_meal_id }, { status: 200 })
  }

  const entries = Array.isArray(prep.entries) ? prep.entries : []
  if (entries.length === 0) return NextResponse.json({ error: "Prep has no entries" }, { status: 400 })

  const loggedAt = new Date()
  const totals = {
    total_protein_g: Number(prep.total_protein_g ?? 0),
    total_carbs_g: Number(prep.total_carbs_g ?? 0),
    total_fat_g: Number(prep.total_fat_g ?? 0),
    total_fiber_g: Number(prep.total_fiber_g ?? 0),
  }
  const totalCalories = computeMacroEnergy({
    protein_g: totals.total_protein_g,
    carbs_g: totals.total_carbs_g,
    fat_g: totals.total_fat_g,
    fiber_g: totals.total_fiber_g,
  })

  const { data: meal, error: mealError } = await db
    .from("nutrition_meals")
    .insert({
      client_id: clientId,
      physiological_date: prep.physiological_date,
      title: prep.title ?? null,
      meal_type: prep.meal_type ?? "snack",
      meal_source: "composer",
      logged_at: loggedAt.toISOString(),
      notes: ct(lang, "nutrition.track.validatedFromPrep"),
      total_calories: totalCalories,
      ...totals,
    })
    .select("id")
    .single()

  if (mealError || !meal) {
    return NextResponse.json({ error: mealError?.message ?? "Meal insert failed" }, { status: 500 })
  }

  const entriesPayload = entries.map((entry: any) => ({
    meal_id: meal.id,
    client_id: clientId,
    food_item_id: entry.food_item_id,
    physiological_date: prep.physiological_date,
    quantity_g: entry.quantity_g,
    calories_kcal: entry.calories_kcal,
    protein_g: entry.protein_g,
    carbs_g: entry.carbs_g,
    fat_g: entry.fat_g,
    fiber_g: entry.fiber_g ?? 0,
    input_mode: "composer",
    confidence_score: 0.9,
  }))

  const { error: entriesError } = await db.from("nutrition_entries").insert(entriesPayload)
  if (entriesError) {
    await db.from("nutrition_meals").delete().eq("id", meal.id).eq("client_id", clientId)
    return NextResponse.json({ error: entriesError.message }, { status: 500 })
  }

  // Update prep status first — if this fails, return error so client can retry safely
  // Idempotency guard on next retry: consumed_meal_id will already be set
  const { error: updateError } = await db
    .from("client_nutrition_preps")
    .update({ status: "logged", consumed_meal_id: meal.id })
    .eq("id", prep.id)
    .eq("client_id", clientId)

  if (updateError) {
    // Meal was created — attempt cleanup then report error
    await db.from("nutrition_entries").delete().eq("meal_id", meal.id)
    await db.from("nutrition_meals").delete().eq("id", meal.id).eq("client_id", clientId)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Non-critical side effects — log errors but don't fail the request
  const agendaResult = await db.from("smart_agenda_events").insert({
    client_id: clientId,
    event_type: "meal",
    event_date: prep.physiological_date,
    event_time: loggedAt.toTimeString().slice(0, 8),
    source_id: meal.id,
    title: `Repas préparé validé`,
    summary: `${Math.round(totalCalories)} kcal · P ${totals.total_protein_g}g · G ${totals.total_carbs_g}g · L ${totals.total_fat_g}g`,
    data: { total_calories: totalCalories, ...totals },
  })
  if (agendaResult.error) {
    console.error('[preps/log] smart_agenda_events insert failed:', agendaResult.error.message)
  }

  // Notify coach: client validated a planned prep
  const { data: clientRecord } = await db
    .from('coach_clients')
    .select('coach_id, first_name, last_name')
    .eq('id', clientId)
    .single()

  if (clientRecord?.coach_id) {
    const clientName = [clientRecord.first_name, clientRecord.last_name].filter(Boolean).join(' ').trim() || 'Le client'
    const prepLabel = String(prep.title ?? '').trim()
    const mealTypeLabel = getMealTypeLabel(prep.meal_type)
    const mealLabel = prepLabel ? `le repas "${prepLabel}"` : `son ${mealTypeLabel}`
    const macroSummary = [
      `${Math.round(totalCalories)} kcal`,
      `P ${formatFrenchNumber(totals.total_protein_g, 1)} g`,
      `G ${formatFrenchNumber(totals.total_carbs_g, 1)} g`,
      `L ${formatFrenchNumber(totals.total_fat_g, 1)} g`,
    ].join(' · ')

    // Rate limit: max 1 nutrition_trend / prep_validated notification per client per day
    const todayUtc = new Date().toISOString().slice(0, 10)
    const { data: existingNotif } = await db
      .from('coach_notifications')
      .select('id')
      .eq('coach_id', clientRecord.coach_id)
      .eq('client_id', clientId)
      .eq('category', 'nutrition_trend')
      .eq('subcategory', 'prep_validated')
      .gte('created_at', `${todayUtc}T00:00:00.000Z`)
      .limit(1)
      .maybeSingle()

    if (!existingNotif) {
      const notifResult = await db.from('coach_notifications').insert({
        coach_id: clientRecord.coach_id,
        client_id: clientId,
        category: 'nutrition_trend',
        subcategory: 'prep_validated',
        priority: 3,
        status: 'pending',
        email_sent: false,
        title: 'Repas validé',
        body: `${clientName} a validé ${mealLabel} prévu dans son planning nutritionnel · ${macroSummary}.`,
        payload: {
          prep_id: params.id,
          prep_title: prepLabel || null,
          meal_type: prep.meal_type ?? null,
          total_calories: Math.round(totalCalories),
          total_protein_g: totals.total_protein_g,
          total_carbs_g: totals.total_carbs_g,
          total_fat_g: totals.total_fat_g,
          action_url: `/coach/clients/${clientId}/data/nutrition`,
        },
      })
      if (notifResult.error) {
        console.error('[preps/log] coach_notifications insert failed:', notifResult.error.message)
      }
    }
  }

  revalidatePath("/client/nutrition")
  return NextResponse.json({ id: meal.id }, { status: 201 })
}
