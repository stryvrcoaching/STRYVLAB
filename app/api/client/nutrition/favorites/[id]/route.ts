import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import { computePhysiologicalDate, inferMealType } from "@/lib/nutrition/physiological-date"
import { calcEntryMacros } from "@/lib/nutrition/food-items"
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

// DELETE /api/client/nutrition/favorites/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const db = service()
  const timezone = await resolveClientTimezone(db, clientId)

  // Vérifier l'ownership
  const { data: favorite, error: fetchError } = await db
    .from("client_meal_favorites")
    .select("id")
    .eq("id", params.id)
    .eq("client_id", clientId)
    .single()

  if (fetchError || !favorite) {
    return NextResponse.json({ error: "Favorite not found" }, { status: 404 })
  }

  // Supprimer le favori
  const { error: deleteError } = await db
    .from("client_meal_favorites")
    .delete()
    .eq("id", params.id)
    .eq("client_id", clientId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 200 })
}

// POST /api/client/nutrition/favorites/[id]/use
// Utilise le favori : crée un nouveau meal à partir du favori
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const db = service()

  // Récupérer le favori
  const { data: favorite, error: fetchError } = await db
    .from("client_meal_favorites")
    .select("id, name, entries, total_calories, total_protein_g, total_carbs_g, total_fat_g, use_count, last_used_at")
    .eq("id", params.id)
    .eq("client_id", clientId)
    .single()

  if (fetchError || !favorite) {
    return NextResponse.json({ error: "Favorite not found" }, { status: 404 })
  }

  const loggedAt = new Date()
  const physiologicalDate = computePhysiologicalDate(loggedAt, timezone)
  const resolvedMealType = inferMealType(loggedAt, timezone)

  // Créer le nouveau meal avec les données du favori
  const { data: meal, error: mealError } = await db
    .from("nutrition_meals")
    .insert({
      client_id: clientId,
      physiological_date: physiologicalDate,
      meal_type: resolvedMealType,
      logged_at: loggedAt.toISOString(),
      total_calories: favorite.total_calories || 0,
      total_protein_g: favorite.total_protein_g || 0,
      total_carbs_g: favorite.total_carbs_g || 0,
      total_fat_g: favorite.total_fat_g || 0,
      total_fiber_g: 0,
      notes: `Favori: ${favorite.name}`,
    })
    .select("id")
    .single()

  if (mealError || !meal) {
    return NextResponse.json({ error: mealError?.message ?? "Meal creation failed" }, { status: 500 })
  }

  const mealId = meal.id

  // Créer les nutrition_entries à partir des entries du favori
  const entriesPayload = (favorite.entries as any[]).map((e) => ({
    meal_id: mealId,
    client_id: clientId,
    food_item_id: e.food_item_id,
    physiological_date: physiologicalDate,
    quantity_g: e.quantity_g,
    calories_kcal: e.calories_kcal,
    protein_g: e.protein_g,
    carbs_g: e.carbs_g,
    fat_g: e.fat_g,
    fiber_g: e.fiber_g || 0,
    input_mode: "composer",
    confidence_score: 0.85,
  }))

  const { error: entriesError } = await db
    .from("nutrition_entries")
    .insert(entriesPayload)

  if (entriesError) {
    // Rollback meal creation
    await db.from("nutrition_meals").delete().eq("id", mealId)
    return NextResponse.json({ error: entriesError.message }, { status: 500 })
  }

  // Créer un smart agenda event
  await db.from("smart_agenda_events").insert({
    client_id: clientId,
    event_type: "meal",
    event_date: physiologicalDate,
    event_time: loggedAt.toTimeString().slice(0, 8),
    source_id: mealId,
    title: `Repas — ${resolvedMealType === "breakfast" ? "Petit-déjeuner" : resolvedMealType === "lunch" ? "Déjeuner" : resolvedMealType === "dinner" ? "Dîner" : "Collation"}`,
    summary: `${Math.round(favorite.total_calories ?? 0)} kcal · P ${favorite.total_protein_g}g · G ${favorite.total_carbs_g}g · L ${favorite.total_fat_g}g`,
    data: {
      total_calories: favorite.total_calories,
      total_protein_g: favorite.total_protein_g,
      total_carbs_g: favorite.total_carbs_g,
      total_fat_g: favorite.total_fat_g,
    },
  })

  // Ajouter points (+3 par repas créé)
  await db.from("client_points").insert({
    client_id: clientId,
    action_type: "meal",
    points: 3,
    reference_id: mealId,
    earned_at: loggedAt.toISOString(),
  })

  // Incrémenter use_count et mettre à jour last_used_at
  await db
    .from("client_meal_favorites")
    .update({
      use_count: (favorite.use_count ?? 0) + 1,
      last_used_at: loggedAt.toISOString(),
      updated_at: loggedAt.toISOString(),
    })
    .eq("id", params.id)
    .eq("client_id", clientId)

  return NextResponse.json({ meal_id: mealId }, { status: 201 })
}
