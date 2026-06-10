import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import { computePhysiologicalDate } from "@/lib/nutrition/physiological-date"
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
  const { data } = await service().from("coach_clients").select("id").eq("user_id", userId).single()
  return data?.id ?? null
}

const schema = z.object({
  food_item_id: z.string().uuid(),
  quantity_g: z.number().positive().max(5000),
})

/**
 * POST /api/client/nutrition/hydration
 * Loguer une boisson (eau, café...) sans créer une carte repas visible dans le journal.
 * Crée ou réutilise un seul repas "Boissons" par jour physiologique.
 * Ce repas n'apparaît PAS dans la liste des repas du journal (meal_type = "drinks").
 * Les macros sont quand même comptabilisées dans le total du jour.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const body = schema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const { food_item_id, quantity_g } = body.data
  const db = service()
  const timezone = await resolveClientTimezone(db, clientId)
  const loggedAt = new Date()
  const today = computePhysiologicalDate(loggedAt, timezone)

  // Fetch food item
  const { data: item } = await db.from("food_items").select("id, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g").eq("id", food_item_id).single()
  if (!item) return NextResponse.json({ error: "Food item not found" }, { status: 404 })

  const macros = calcEntryMacros(
    { ...item, name_fr: "", category_l1: "drinks", category_l2: "eau", item_key: "", source: "internal", is_verified: true },
    quantity_g
  )

  // Trouver ou créer un repas "drinks" pour aujourd'hui
  let mealId: string
  const { data: existing } = await db
    .from("nutrition_meals")
    .select("id, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g")
    .eq("client_id", clientId)
    .eq("physiological_date", today)
    .eq("meal_type", "drinks" as any)
    .maybeSingle()

  if (existing) {
    mealId = existing.id
    // Mettre à jour les totaux
    const nextTotals = {
      total_protein_g: Math.round((Number(existing.total_protein_g) + macros.protein_g) * 10) / 10,
      total_carbs_g: Math.round((Number(existing.total_carbs_g) + macros.carbs_g) * 10) / 10,
      total_fat_g: Math.round((Number(existing.total_fat_g) + macros.fat_g) * 10) / 10,
      total_fiber_g: Math.round((Number(existing.total_fiber_g) + macros.fiber_g) * 10) / 10,
    }
    await db.from("nutrition_meals").update({
      ...nextTotals,
      total_calories: computeMacroEnergy({
        protein_g: nextTotals.total_protein_g,
        carbs_g: nextTotals.total_carbs_g,
        fat_g: nextTotals.total_fat_g,
        fiber_g: nextTotals.total_fiber_g,
      }),
    }).eq("id", mealId)
  } else {
    const { data: newMeal, error: mealError } = await db
      .from("nutrition_meals")
      .insert({
        client_id: clientId,
        physiological_date: today,
        meal_type: "drinks" as any,
        logged_at: loggedAt.toISOString(),
        total_calories:  macros.calories_kcal,
        total_protein_g: macros.protein_g,
        total_carbs_g:   macros.carbs_g,
        total_fat_g:     macros.fat_g,
        total_fiber_g:   macros.fiber_g,
      })
      .select("id")
      .single()
    if (mealError || !newMeal) return NextResponse.json({ error: mealError?.message }, { status: 500 })
    mealId = newMeal.id
  }

  // Insérer l'entrée
  await db.from("nutrition_entries").insert({
    meal_id: mealId,
    client_id: clientId,
    food_item_id,
    physiological_date: today,
    quantity_g,
    calories_kcal: macros.calories_kcal,
    protein_g: macros.protein_g,
    carbs_g: macros.carbs_g,
    fat_g: macros.fat_g,
    fiber_g: macros.fiber_g,
    input_mode: "composer",
    confidence_score: 0.85,
  })

  // Sync client_water_logs — source lue par home page et nutrition page
  await db.from("client_water_logs").insert({
    client_id: clientId,
    amount_ml: quantity_g,
    logged_at: loggedAt.toISOString(),
  })

  return NextResponse.json({ ok: true, meal_id: mealId, quantity_ml: quantity_g })
}
