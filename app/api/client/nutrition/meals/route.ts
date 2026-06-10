
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import { computePhysiologicalDate, inferMealType } from "@/lib/nutrition/physiological-date"
import { calcEntryMacros } from "@/lib/nutrition/food-items"
import { computeMacroEnergy } from "@/lib/nutrition/energy"
import { resolveClientTimezone } from "@/lib/client/checkin/resolveClientTimezone"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveClientId(userId: string): Promise<string | null> {
  const { data } = await service()
    .from("coach_clients")
    .select("id")
    .eq("user_id", userId)
    .single()
  return data?.id ?? null
}

const entrySchema = z.object({
  food_item_id: z.string().uuid(),
  quantity_g: z.number().positive().max(5000),
  input_mode: z.enum(["composer", "portion", "photo_ai", "voice"]).default("composer"),
})

const createMealSchema = z.object({
  meal_id: z.string().uuid().optional(), // if present, append to existing meal
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  meal_source: z.enum(["manual", "voice", "text", "composer", "auto_adjusted", "flash_estimate"]).optional(),
  logged_at: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  entries: z.array(entrySchema).min(1).max(30),
})

// POST /api/client/nutrition/meals
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const body = createMealSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const { meal_id: existingMealId, meal_type, meal_source, logged_at, notes, entries } = body.data
  const db = service()
  const timezone = await resolveClientTimezone(db, clientId)
  const loggedAt = logged_at ? new Date(logged_at) : new Date()
  const physiologicalDate = computePhysiologicalDate(loggedAt, timezone)
  const resolvedMealType = meal_type ?? inferMealType(loggedAt, timezone)

  // Fetch food_items pour calculer les macros
  const uniqueIds: Record<string, true> = {}
  entries.forEach((e) => { uniqueIds[e.food_item_id] = true })
  const foodItemIds = Object.keys(uniqueIds)
  const { data: foodItems, error: fiError } = await db
    .from("food_items")
    .select("id, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g")
    .in("id", foodItemIds)

  if (fiError || !foodItems?.length) {
    return NextResponse.json({ error: "Food items not found" }, { status: 404 })
  }

  const foodMap = Object.fromEntries(foodItems.map((fi) => [fi.id, fi]))

  for (const e of entries) {
    if (!foodMap[e.food_item_id]) {
      return NextResponse.json({ error: `food_item_id not found: ${e.food_item_id}` }, { status: 404 })
    }
  }

  // Calculer les macros de chaque entrée
  const entryMacros = entries.map((e) => {
    const item = foodMap[e.food_item_id]
    const macros = calcEntryMacros(
      { ...item, name_fr: "", category_l1: "proteins", category_l2: null, item_key: "", source: "internal", is_verified: true },
      e.quantity_g
    )
    return { ...e, ...macros }
  })

  const newTotalsBase = entryMacros.reduce(
    (acc, e) => ({
      total_protein_g: Math.round((acc.total_protein_g + e.protein_g) * 10) / 10,
      total_carbs_g: Math.round((acc.total_carbs_g + e.carbs_g) * 10) / 10,
      total_fat_g: Math.round((acc.total_fat_g + e.fat_g) * 10) / 10,
      total_fiber_g: Math.round((acc.total_fiber_g + e.fiber_g) * 10) / 10,
    }),
    { total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0, total_fiber_g: 0 }
  )
  const newTotals = {
    ...newTotalsBase,
    total_calories: computeMacroEnergy({
      protein_g: newTotalsBase.total_protein_g,
      carbs_g: newTotalsBase.total_carbs_g,
      fat_g: newTotalsBase.total_fat_g,
      fiber_g: newTotalsBase.total_fiber_g,
    }),
  }

  let mealId: string

  if (existingMealId) {
    // ── Append mode : vérifier ownership + recalculer les totaux ──
    const { data: existing } = await db
      .from("nutrition_meals")
      .select("id, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g")
      .eq("id", existingMealId)
      .eq("client_id", clientId)
      .single()

    if (!existing) return NextResponse.json({ error: "Meal not found" }, { status: 404 })

    mealId = existingMealId

    // Mettre à jour les totaux en ajoutant les nouvelles entrées
    const updatedTotals = {
      total_protein_g: Math.round((Number(existing.total_protein_g) + newTotals.total_protein_g) * 10) / 10,
      total_carbs_g: Math.round((Number(existing.total_carbs_g) + newTotals.total_carbs_g) * 10) / 10,
      total_fat_g: Math.round((Number(existing.total_fat_g) + newTotals.total_fat_g) * 10) / 10,
      total_fiber_g: Math.round((Number(existing.total_fiber_g) + newTotals.total_fiber_g) * 10) / 10,
    }
    const updatedTotalsWithCalories = {
      ...updatedTotals,
      total_calories: computeMacroEnergy({
        protein_g: updatedTotals.total_protein_g,
        carbs_g: updatedTotals.total_carbs_g,
        fat_g: updatedTotals.total_fat_g,
        fiber_g: updatedTotals.total_fiber_g,
      }),
    }

    await db.from("nutrition_meals").update(updatedTotalsWithCalories).eq("id", mealId)
  } else {
    // ── Create mode ──
    const { data: meal, error: mealError } = await db
      .from("nutrition_meals")
      .insert({
        client_id: clientId,
        physiological_date: physiologicalDate,
        meal_type: resolvedMealType,
        meal_source: meal_source ?? "composer",
        logged_at: loggedAt.toISOString(),
        notes: notes ?? null,
        ...newTotals,
      })
      .select("id")
      .single()

    if (mealError || !meal) {
      return NextResponse.json({ error: mealError?.message ?? "Insert failed" }, { status: 500 })
    }
    mealId = meal.id

    // Smart agenda event (create uniquement, pas sur append)
    await db.from("smart_agenda_events").insert({
      client_id: clientId,
      event_type: "meal",
      event_date: physiologicalDate,
      event_time: loggedAt.toTimeString().slice(0, 8),
      source_id: mealId,
      title: `Repas — ${resolvedMealType === "breakfast" ? "Petit-déjeuner" : resolvedMealType === "lunch" ? "Déjeuner" : resolvedMealType === "dinner" ? "Dîner" : "Collation"}`,
      summary: `${Math.round(newTotals.total_calories)} kcal · P ${newTotals.total_protein_g}g · G ${newTotals.total_carbs_g}g · L ${newTotals.total_fat_g}g`,
      data: newTotals,
    })

    // Points (+3 par repas créé, pas sur append)
    await db.from("client_points").insert({
      client_id: clientId,
      action_type: "meal",
      points: 3,
      reference_id: mealId,
      earned_at: loggedAt.toISOString(),
    })
  }

  // Créer les entrées (dans les deux modes)
  const entriesPayload = entryMacros.map((e) => ({
    meal_id: mealId,
    client_id: clientId,
    food_item_id: e.food_item_id,
    physiological_date: physiologicalDate,
    quantity_g: e.quantity_g,
    calories_kcal: e.calories_kcal,
    protein_g: e.protein_g,
    carbs_g: e.carbs_g,
    fat_g: e.fat_g,
    fiber_g: e.fiber_g,
    input_mode: e.input_mode,
    confidence_score: e.input_mode === "composer" ? 0.85 : e.input_mode === "voice" ? 0.70 : e.input_mode === "portion" ? 0.65 : 0.55,
  }))

  const { error: entriesError } = await db.from("nutrition_entries").insert(entriesPayload)

  if (entriesError) {
    if (!existingMealId) await db.from("nutrition_meals").delete().eq("id", mealId)
    return NextResponse.json({ error: entriesError.message }, { status: 500 })
  }

  return NextResponse.json({ id: mealId, ...newTotals }, { status: existingMealId ? 200 : 201 })
}

// GET /api/client/nutrition/meals?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const timezone = await resolveClientTimezone(service(), clientId)
  const date = searchParams.get("date") ?? computePhysiologicalDate(new Date(), timezone)

  const { data, error } = await service()
    .from("nutrition_meals")
    .select(`
      id, title, meal_type, logged_at, physiological_date,
      meal_source,
      total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g,
      photo_urls, notes,
      nutrition_entries (
        id, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, fiber_g,
        input_mode, confidence_score,
        food_items (id, name_fr, category_l1, category_l2, item_key, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, source, is_verified)
      )
    `)
    .eq("client_id", clientId)
    .eq("physiological_date", date)
    .order("logged_at")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const normalized = (data ?? []).map((meal: any) => ({
    ...meal,
    entries: meal.nutrition_entries ?? [],
    nutrition_entries: undefined,
  }))

  return NextResponse.json({ data: normalized, date })
}
