export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { createSupabaseService } from "@/lib/nutrition/preps-service"
import type { PhotoMealAnalysisSummary } from "@/lib/nutrition/photo-log-types"
import {
  buildRefinedPhotoEntries,
  computeLeftoversConsumedFactor,
  computeRefinedMealTotals,
  resolvePhotoMealBaselineWeight,
} from "@/lib/nutrition/photo-log-leftovers"
import { resolveOwnedPhotoMealSessionWithRetry } from "@/lib/nutrition/photo-log-session-access"

const schema = z.object({
  session_id: z.string().uuid(),
  leftovers_weight_g: z.number().min(0).max(5000),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "nutrition_photo_log_session_unavailable" }, { status: 401 })

  const body = schema.safeParse(await req.json().catch(() => ({})))
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = createSupabaseService()
  const { session, client } = await resolveOwnedPhotoMealSessionWithRetry({
    db,
    sessionId: body.data.session_id,
    user,
    sessionSelect: "id, meal_id, analysis_summary, status, leftovers_weight_g",
    clientSelect: "id",
  })
  if (!client) return NextResponse.json({ error: "nutrition_photo_log_session_unavailable" }, { status: 404 })
  const clientId = String(client.id)
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 })

  if (!(session as any).meal_id) {
    return NextResponse.json({ error: "Meal not logged yet" }, { status: 409 })
  }

  const analysis = ((session as any).analysis_summary ?? null) as PhotoMealAnalysisSummary | null
  if (!analysis) {
    return NextResponse.json({ error: "Analysis missing" }, { status: 409 })
  }

  const baselineWeightG = resolvePhotoMealBaselineWeight({ analysis })
  if (!baselineWeightG || baselineWeightG <= 0) {
    return NextResponse.json({ error: "Baseline weight unavailable" }, { status: 409 })
  }

  if (body.data.leftovers_weight_g >= baselineWeightG) {
    return NextResponse.json({ error: "Leftovers weight must stay below initial meal weight" }, { status: 400 })
  }

  const { data: meal, error: mealReadError } = await db
    .from("nutrition_meals")
    .select("id, notes")
    .eq("id", (session as any).meal_id)
    .eq("client_id", clientId)
    .single()
  if (mealReadError || !meal) {
    return NextResponse.json({ error: mealReadError?.message ?? "Meal not found" }, { status: 404 })
  }

  const { data: entries, error: entriesError } = await db
    .from("nutrition_entries")
    .select(`
      id,
      quantity_g,
      food_item_id,
      food_items (
        id,
        name_fr,
        category_l1,
        category_l2,
        icon_key,
        item_key,
        kcal_per_100g,
        protein_per_100g,
        carbs_per_100g,
        fat_per_100g,
        fiber_per_100g,
        source,
        is_verified
      )
    `)
    .eq("meal_id", (session as any).meal_id)
    .eq("client_id", clientId)
    .eq("input_mode", "photo_guided")
    .order("id", { ascending: true })

  if (entriesError || !entries?.length) {
    return NextResponse.json({ error: entriesError?.message ?? "Photo-guided entries not found" }, { status: 404 })
  }

  const consumedFactor = computeLeftoversConsumedFactor({
    baselineWeightG,
    leftoversWeightG: body.data.leftovers_weight_g,
  })
  const previousConsumedFactor = computeLeftoversConsumedFactor({
    baselineWeightG,
    leftoversWeightG: Number((session as any).leftovers_weight_g ?? 0),
  })
  const relativeFactor = previousConsumedFactor > 0 ? consumedFactor / previousConsumedFactor : consumedFactor

  const refinedEntries = buildRefinedPhotoEntries({
    entries: entries as any,
    consumedFactor: relativeFactor,
  })

  for (const entry of refinedEntries) {
    const { error } = await db
      .from("nutrition_entries")
      .update({
        quantity_g: entry.quantity_g,
        calories_kcal: entry.calories_kcal,
        protein_g: entry.protein_g,
        carbs_g: entry.carbs_g,
        fat_g: entry.fat_g,
        fiber_g: entry.fiber_g,
      })
      .eq("id", entry.id)
      .eq("client_id", clientId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const mealTotals = computeRefinedMealTotals(refinedEntries)
  const previousNotes = String((meal as any).notes ?? "").trim()
  const refinementNote = `Affinage restes applique (${Math.round(body.data.leftovers_weight_g)} g)`
  const { error: mealError } = await db
    .from("nutrition_meals")
    .update({
      ...mealTotals,
      notes: previousNotes ? `${previousNotes} · ${refinementNote}` : refinementNote,
    })
    .eq("id", (session as any).meal_id)
    .eq("client_id", clientId)
  if (mealError) return NextResponse.json({ error: mealError.message }, { status: 500 })

  const { error: sessionUpdateError } = await db
    .from("client_photo_meal_logs")
    .update({
      status: "refined",
      leftovers_weight_g: body.data.leftovers_weight_g,
      leftovers_applied_at: new Date().toISOString(),
    })
    .eq("id", body.data.session_id)
    .eq("client_id", clientId)
  if (sessionUpdateError) return NextResponse.json({ error: sessionUpdateError.message }, { status: 500 })

  revalidatePath("/client/nutrition")
  return NextResponse.json({
    data: {
      meal_id: (session as any).meal_id,
      leftovers_weight_g: body.data.leftovers_weight_g,
      baseline_weight_g: baselineWeightG,
      consumed_factor: consumedFactor,
      meal_totals: mealTotals,
    },
  })
}
