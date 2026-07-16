import { describe, expect, it } from "vitest"
import type { NutritionPlanFood, NutritionPlanMeal } from "@/lib/nutrition/protocol-builder"
import { computePlanMealsTotals } from "@/lib/nutrition/protocol-builder"
import { adjustPlanMealsForSmoothing } from "@/lib/nutrition/smoothing/meal-plan-adjustment"
import { adjustPlanMealsForCycle } from "@/lib/nutrition/cycle-meal-plan-adjustment"
import { mergeCoachPlanPreps } from "@/lib/nutrition/client-planning"

function food(partial: Partial<NutritionPlanFood>): NutritionPlanFood {
  return {
    id: partial.id ?? "food-1",
    name_fr: partial.name_fr ?? "Aliment",
    category_l1: partial.category_l1 ?? "carbs",
    category_l2: partial.category_l2 ?? null,
    icon_key: partial.icon_key ?? null,
    item_key: partial.item_key ?? "aliment",
    kcal_per_100g: partial.kcal_per_100g ?? 100,
    protein_per_100g: partial.protein_per_100g ?? 0,
    carbs_per_100g: partial.carbs_per_100g ?? 0,
    fat_per_100g: partial.fat_per_100g ?? 0,
    fiber_per_100g: partial.fiber_per_100g ?? 0,
    source: partial.source ?? "internal",
    is_verified: partial.is_verified ?? true,
  }
}

function sampleMeals(): NutritionPlanMeal[] {
  return [
    {
      id: "lunch",
      title: "Déjeuner",
      items: [
        {
          id: "chicken",
          food: food({
            id: "chicken",
            name_fr: "Poulet",
            category_l1: "proteins",
            kcal_per_100g: 165,
            protein_per_100g: 31,
            fat_per_100g: 3.6,
          }),
          quantity_g: 150,
          alternatives: [],
        },
        {
          id: "rice",
          food: food({
            id: "rice",
            name_fr: "Riz",
            category_l1: "carbs",
            kcal_per_100g: 360,
            protein_per_100g: 7,
            carbs_per_100g: 78,
            fat_per_100g: 0.6,
          }),
          quantity_g: 120,
          alternatives: [],
        },
        {
          id: "oil",
          food: food({
            id: "oil",
            name_fr: "Huile d'olive",
            category_l1: "fats",
            kcal_per_100g: 900,
            fat_per_100g: 100,
          }),
          quantity_g: 10,
          alternatives: [],
        },
      ],
    },
  ]
}

describe("nutrition smoothing meal plan adjustment", () => {
  it("adjusts mainly flexible foods while preserving protein anchors", () => {
    const meals = sampleMeals()

    const result = adjustPlanMealsForSmoothing({
      meals,
      baseTargetKcal: 2000,
      adjustedTargetKcal: 1800,
    })

    expect(result.strategy).toBe("selective")
    expect(result.meals[0].items[0].quantity_g).toBe(150)
    expect(result.meals[0].items[1].quantity_g).toBeLessThan(120)
    expect(result.meals[0].items[2].quantity_g).toBeLessThan(10)

    const originalTotals = computePlanMealsTotals(meals)
    const adjustedTotals = computePlanMealsTotals(result.meals)
    expect(adjustedTotals.calories).toBeLessThan(originalTotals.calories)
  })

  it("adapts flexible plan portions for the current cycle phase", () => {
    const meals = sampleMeals()
    const result = adjustPlanMealsForCycle({
      meals,
      adjustment: { proteinDelta: 10, carbsDelta: 20, fatDelta: 5 },
    })

    expect(result.adjusted).toBe(true)
    expect(result.meals[0].items[0].quantity_g).toBeGreaterThan(150)
    expect(result.meals[0].items[1].quantity_g).toBeGreaterThan(120)
    expect(result.meals[0].items[2].quantity_g).toBeGreaterThan(10)
  })

  it("respects coach locks and exposes an unapplied macro delta", () => {
    const meals = sampleMeals()
    meals[0].items[0].cycle_adjustment = { locked: true }

    const result = adjustPlanMealsForCycle({
      meals,
      adjustment: { proteinDelta: 10, carbsDelta: 0, fatDelta: 0 },
    })

    expect(result.meals[0].items[0].quantity_g).toBe(150)
    expect(result.changedItemIds).not.toContain("chicken")
    expect(result.residualDelta.protein).toBeGreaterThan(9)
    expect(result.warnings.join(" ")).toContain("protein")
  })

  it("honors portion bounds and reports a partial adjustment", () => {
    const meals = sampleMeals()
    meals[0].items[1].cycle_adjustment = { max_quantity_g: 125 }

    const result = adjustPlanMealsForCycle({
      meals,
      adjustment: { proteinDelta: 0, carbsDelta: 20, fatDelta: 0 },
    })

    expect(result.meals[0].items[1].quantity_g).toBe(125)
    expect(result.residualDelta.carbs).toBeGreaterThan(10)
    expect(result.warnings.join(" ")).toContain("carbs")
  })

  it("prioritizes the foods selected by the coach", () => {
    const meals = sampleMeals()
    meals[0].items.push({
      id: "oats",
      food: food({
        id: "oats",
        name_fr: "Flocons d’avoine",
        category_l1: "carbs",
        kcal_per_100g: 370,
        protein_per_100g: 13,
        carbs_per_100g: 60,
        fat_per_100g: 7,
      }),
      quantity_g: 100,
      alternatives: [],
      cycle_adjustment: { priority: 3 },
    })

    const result = adjustPlanMealsForCycle({
      meals,
      adjustment: { proteinDelta: 0, carbsDelta: 20, fatDelta: 0 },
    })

    const rice = result.meals[0].items.find((item) => item.id === "rice")!
    const oats = result.meals[0].items.find((item) => item.id === "oats")!
    expect(oats.quantity_g - 100).toBeGreaterThan(rice.quantity_g - 120)
  })

  it("injects adjusted virtual coach preps when a smoothing day is active", () => {
    const preps = mergeCoachPlanPreps({
      date: "2026-07-06",
      protocol: { id: "protocol-1" },
      protocolDay: {
        position: 0,
        calories: 2000,
        meal_plan: sampleMeals(),
      },
      persistedPreps: [],
      smoothingDay: {
        base_target_kcal: 2000,
        kcal_delta: -200,
      },
    })

    expect(preps).toHaveLength(1)
    expect(preps[0].scenario_label).toBe("Planning ajusté")
    const chicken = preps[0].entries.find((entry) => entry.food_item_id === "chicken")
    const rice = preps[0].entries.find((entry) => entry.food_item_id === "rice")
    expect(chicken?.quantity_g).toBe(150)
    expect(rice?.quantity_g).toBeLessThan(120)
  })

  it("labels virtual preps when Cycle Sync adjusted the detailed plan", () => {
    const preps = mergeCoachPlanPreps({
      date: "2026-07-06",
      protocol: { id: "protocol-1" },
      protocolDay: {
        position: 0,
        calories: 2000,
        meal_plan: sampleMeals(),
      },
      persistedPreps: [],
      cycleAdjustment: { proteinDelta: 10, carbsDelta: 20, fatDelta: 5 },
    })

    expect(preps[0].scenario_label).toBe("Planning adapté au cycle")
  })
})
