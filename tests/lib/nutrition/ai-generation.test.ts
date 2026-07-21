import { describe, expect, it } from "vitest"
import {
  buildDeterministicNutritionMeals,
  evaluateGeneratedNutritionDay,
  nutritionAiGenerationInputSchema,
} from "@/lib/nutrition/ai-generation"
import type { NutritionPlanFood } from "@/lib/nutrition/protocol-builder"

function food(
  id: string,
  name: string,
  category: NutritionPlanFood["category_l1"],
  macros: { kcal: number; protein: number; carbs: number; fat: number },
): NutritionPlanFood {
  return {
    id,
    name_fr: name,
    category_l1: category,
    category_l2: null,
    icon_key: null,
    item_key: id,
    kcal_per_100g: macros.kcal,
    protein_per_100g: macros.protein,
    carbs_per_100g: macros.carbs,
    fat_per_100g: macros.fat,
    fiber_per_100g: 0,
    source: "internal",
    is_verified: true,
  }
}

const candidates = [
  food("00000000-0000-4000-8000-000000000001", "Poulet", "proteins", { kcal: 165, protein: 31, carbs: 0, fat: 3.6 }),
  food("00000000-0000-4000-8000-000000000002", "Dinde", "proteins", { kcal: 150, protein: 29, carbs: 0, fat: 3 }),
  food("00000000-0000-4000-8000-000000000003", "Riz", "carbs", { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 }),
  food("00000000-0000-4000-8000-000000000004", "Pommes de terre", "carbs", { kcal: 87, protein: 2, carbs: 20, fat: 0.1 }),
  food("00000000-0000-4000-8000-000000000005", "Huile d’olive", "fats", { kcal: 884, protein: 0, carbs: 0, fat: 100 }),
  food("00000000-0000-4000-8000-000000000006", "Amandes", "fats", { kcal: 579, protein: 21, carbs: 22, fat: 50 }),
  food("00000000-0000-4000-8000-000000000007", "Brocoli", "vegetables", { kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 }),
  food("00000000-0000-4000-8000-000000000008", "Haricots verts", "vegetables", { kcal: 31, protein: 1.8, carbs: 7, fat: 0.2 }),
]

const input = nutritionAiGenerationInputSchema.parse({
  day_name: "Jour entraînement",
  day_role: "training",
  calories: 2200,
  protein_g: 160,
  carbs_g: 240,
  fat_g: 65,
  hydration_ml: 2500,
  meal_count: 4,
})

describe("nutrition AI generation", () => {
  it("rejects unsafe or unusable targets", () => {
    expect(
      nutritionAiGenerationInputSchema.safeParse({
        ...input,
        calories: 50,
        meal_count: 20,
      }).success,
    ).toBe(false)
  })

  it("supports a targeted single-meal generation", () => {
    const mealInput = nutritionAiGenerationInputSchema.parse({
      ...input,
      target_meal_title: "Déjeuner",
      calories: 550,
      protein_g: 40,
      carbs_g: 60,
      fat_g: 18,
      meal_count: 1,
    })
    const meals = buildDeterministicNutritionMeals(candidates, mealInput)

    expect(meals).toHaveLength(1)
    expect(meals[0]?.title).toBe("Déjeuner")
  })

  it("builds the requested number of meals with catalogue-only alternatives", () => {
    const meals = buildDeterministicNutritionMeals(candidates, input)
    expect(meals).toHaveLength(4)
    expect(meals.every((meal) => meal.items.length >= 3)).toBe(true)
    const allowed = new Set(candidates.map((candidate) => candidate.id))
    for (const meal of meals) {
      for (const item of meal.items) {
        expect(allowed.has(item.food.id)).toBe(true)
        expect(item.quantity_g).toBeGreaterThan(0)
        for (const alternative of item.alternatives) {
          expect(allowed.has(alternative.food.id)).toBe(true)
        }
      }
    }
  })

  it("keeps the deterministic fallback on everyday foods when unusual catalogue items are available", () => {
    const meals = buildDeterministicNutritionMeals([
      ...candidates,
      food("00000000-0000-4000-8000-000000000009", "Morue salée séchée", "proteins", { kcal: 280, protein: 58, carbs: 0, fat: 4 }),
      food("00000000-0000-4000-8000-000000000010", "Jambon sec serrano", "proteins", { kcal: 250, protein: 31, carbs: 0, fat: 15 }),
      food("00000000-0000-4000-8000-000000000011", "Huile de pépins de raisin", "fats", { kcal: 884, protein: 0, carbs: 0, fat: 100 }),
    ], input)
    const generatedNames = meals.flatMap((meal) => meal.items.map((item) => item.food.name_fr))

    expect(generatedNames).not.toContain("Morue salée séchée")
    expect(generatedNames).not.toContain("Jambon sec serrano")
    expect(generatedNames).not.toContain("Huile de pépins de raisin")
  })

  it("returns an explicit confidence assessment", () => {
    const quality = evaluateGeneratedNutritionDay(
      buildDeterministicNutritionMeals(candidates, input),
      input,
    )
    expect(["low", "medium", "high"]).toContain(quality.confidence)
    expect(quality.totals.calories).toBeGreaterThan(0)
  })
})
