import { calcEntryMacros, type FoodItem, type MealType } from "@/lib/nutrition/food-items"
import type { FoodCompatibility } from "@/lib/nutrition/food-compatibility"

export type NutritionPlanMealId = MealType | string

export type NutritionPlanFood = Pick<
  FoodItem,
  | "id"
  | "name_fr"
  | "category_l1"
  | "category_l2"
  | "icon_key"
  | "item_key"
  | "kcal_per_100g"
  | "protein_per_100g"
  | "carbs_per_100g"
  | "fat_per_100g"
  | "fiber_per_100g"
  | "source"
  | "is_verified"
> & {
  compatibility?: FoodCompatibility
}

export type NutritionPlanAlternative = {
  id: string
  food: NutritionPlanFood
  quantity_g: number
}

export type NutritionPlanCycleAdjustment = {
  locked?: boolean
  priority?: 1 | 2 | 3
  min_quantity_g?: number
  max_quantity_g?: number
}

export type NutritionPlanItem = {
  id: string
  food: NutritionPlanFood
  quantity_g: number
  alternatives: NutritionPlanAlternative[]
  cycle_adjustment?: NutritionPlanCycleAdjustment
}

export type NutritionPlanMeal = {
  id: NutritionPlanMealId
  title: string
  items: NutritionPlanItem[]
}

export type NutritionProtocolBuilderDraft = Record<string, NutritionPlanMeal[]>

export type NutritionPlanTotals = {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export const NUTRITION_PLAN_MEALS: Array<{ id: NutritionPlanMealId; title: string }> = [
  { id: "breakfast", title: "Petit-déjeuner" },
  { id: "lunch", title: "Déjeuner" },
  { id: "dinner", title: "Dîner" },
  { id: "snack", title: "Collation" },
]

export function createEmptyPlanMeals(): NutritionPlanMeal[] {
  return NUTRITION_PLAN_MEALS.map((meal) => ({ ...meal, items: [] }))
}

export function normalizePlanMeals(meals: NutritionPlanMeal[] | undefined): NutritionPlanMeal[] {
  const seenIds = new Set<NutritionPlanMealId>()
  const standardIds = new Set(NUTRITION_PLAN_MEALS.map((meal) => meal.id))

  const orderedMeals = (meals ?? [])
    .filter((meal) => {
      if (seenIds.has(meal.id)) return false
      seenIds.add(meal.id)
      return true
    })
    .map((meal) => ({
      ...meal,
      title: meal.title || (standardIds.has(meal.id as MealType)
        ? NUTRITION_PLAN_MEALS.find((standard) => standard.id === meal.id)?.title ?? "Repas"
        : "Repas"),
      items: Array.isArray(meal.items) ? meal.items : [],
    }))

  const missingStandardMeals = NUTRITION_PLAN_MEALS
    .filter((meal) => !seenIds.has(meal.id))
    .map((meal) => ({ ...meal, items: [] }))

  return [...orderedMeals, ...missingStandardMeals]
}

export function computePlanItemTotals(item: NutritionPlanItem): NutritionPlanTotals {
  const macros = calcEntryMacros(item.food, item.quantity_g)
  return {
    calories: macros.calories_kcal,
    protein: macros.protein_g,
    carbs: macros.carbs_g,
    fat: macros.fat_g,
    fiber: macros.fiber_g,
  }
}

export function computePlanMealsTotals(meals: NutritionPlanMeal[]): NutritionPlanTotals {
  return meals.reduce<NutritionPlanTotals>(
    (acc, meal) => {
      for (const item of meal.items) {
        const totals = computePlanItemTotals(item)
        acc.calories += totals.calories
        acc.protein += totals.protein
        acc.carbs += totals.carbs
        acc.fat += totals.fat
        acc.fiber += totals.fiber
      }
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  )
}

export function roundPlanTotals(totals: NutritionPlanTotals): NutritionPlanTotals {
  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein * 10) / 10,
    carbs: Math.round(totals.carbs * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
    fiber: Math.round(totals.fiber * 10) / 10,
  }
}

export function computeEquivalentQuantity(base: NutritionPlanItem, alternativeFood: NutritionPlanFood) {
  const baseEnergy = Math.max(base.food.kcal_per_100g, 1)
  const alternativeEnergy = Math.max(alternativeFood.kcal_per_100g, 1)
  return Math.max(1, Math.round((base.quantity_g * baseEnergy) / alternativeEnergy))
}

export function getBuilderDraftStorageKey(clientId: string, protocolId: string | null | undefined) {
  return `stryv:nutrition-protocol-builder:${clientId}:${protocolId ?? "new"}`
}
