import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateFoodCompatibility } from "@/lib/nutrition/food-compatibility"
import { loadClientFoodProfile } from "@/lib/nutrition/food-profile-service"

type MealPlanDay = {
  meal_plan?: Array<{
    items?: Array<{
      food?: { id?: string; name_fr?: string }
      alternatives?: Array<{ food?: { id?: string; name_fr?: string } }>
    }>
  }>
}

export type ProtocolFoodIssue = {
  food_id: string | null
  food_name: string
  status: "blocked" | "needs_review" | "profile_unknown"
  reasons: string[]
}

function referencedFoods(days: MealPlanDay[]) {
  const foods = new Map<string, { id: string; name_fr: string }>()
  for (const day of days) {
    for (const meal of day.meal_plan ?? []) {
      for (const item of meal.items ?? []) {
        const candidates = [item.food, ...(item.alternatives ?? []).map((alternative) => alternative.food)]
        for (const food of candidates) {
          if (!food?.id) continue
          foods.set(food.id, { id: food.id, name_fr: food.name_fr ?? "Aliment" })
        }
      }
    }
  }
  return Array.from(foods.values())
}

export async function validateProtocolFoodCompatibility(params: {
  db: SupabaseClient
  clientId: string
  days: MealPlanDay[]
}) {
  const profile = await loadClientFoodProfile(params.db, params.clientId)
  const referenced = referencedFoods(params.days)
  const issues: ProtocolFoodIssue[] = []

  if (!profile || profile.allergy_status === "unknown") {
    issues.push({
      food_id: null,
      food_name: "Profil alimentaire",
      status: "profile_unknown",
      reasons: ["Le statut allergique doit être confirmé avant le partage."],
    })
  }
  if (referenced.length === 0) {
    return { profile, issues }
  }

  const { data: foods, error } = await params.db
    .from("food_items")
    .select(
      `
      id, name_fr, category_l1, category_l2, item_key,
      source, is_verified, dietary_tags, allergen_tags, ingredients_known
    `,
    )
    .in("id", referenced.map((food) => food.id))
  if (error) throw error

  const foodById = new Map((foods ?? []).map((food) => [food.id, food]))
  for (const reference of referenced) {
    const food = foodById.get(reference.id)
    if (!food) {
      issues.push({
        food_id: reference.id,
        food_name: reference.name_fr,
        status: "needs_review",
        reasons: ["Cet aliment n’existe plus dans le catalogue."],
      })
      continue
    }
    const compatibility = evaluateFoodCompatibility(food as any, profile)
    if (compatibility.status === "blocked" || compatibility.status === "needs_review") {
      issues.push({
        food_id: food.id,
        food_name: food.name_fr,
        status: compatibility.status,
        reasons: compatibility.reasons,
      })
    }
  }

  return { profile, issues }
}

export async function loadProtocolDaysForFoodValidation(
  db: SupabaseClient,
  protocolId: string,
) {
  const { data, error } = await db
    .from("nutrition_protocol_days")
    .select("meal_plan")
    .eq("protocol_id", protocolId)
  if (error) throw error
  return (data ?? []) as MealPlanDay[]
}
