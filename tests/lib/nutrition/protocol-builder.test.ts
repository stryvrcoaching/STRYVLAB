import { describe, expect, it } from "vitest"
import type { NutritionPlanFood, NutritionPlanItem } from "@/lib/nutrition/protocol-builder"
import {
  computeEquivalentQuantity,
  computePlanMealsTotals,
  roundPlanTotals,
} from "@/lib/nutrition/protocol-builder"

function food(partial: Partial<NutritionPlanFood>): NutritionPlanFood {
  return {
    id: partial.id ?? "food-1",
    name_fr: partial.name_fr ?? "Aliment",
    category_l1: partial.category_l1 ?? "carbs",
    category_l2: partial.category_l2 ?? null,
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

describe("nutrition protocol builder", () => {
  it("computes an equivalent alternative quantity from calories per 100g", () => {
    const pasta: NutritionPlanItem = {
      id: "item-1",
      food: food({ name_fr: "Pates blanches crues", kcal_per_100g: 350 }),
      quantity_g: 100,
      alternatives: [],
    }
    const rice = food({ name_fr: "Riz basmati cru", kcal_per_100g: 365 })

    expect(computeEquivalentQuantity(pasta, rice)).toBe(96)
  })

  it("sums planned meal macros using item quantities", () => {
    const totals = roundPlanTotals(
      computePlanMealsTotals([
        {
          id: "lunch",
          title: "Déjeuner",
          items: [
            {
              id: "item-1",
              food: food({
                name_fr: "Poulet grille",
                category_l1: "proteins",
                kcal_per_100g: 165,
                protein_per_100g: 31,
                fat_per_100g: 3.6,
              }),
              quantity_g: 150,
              alternatives: [],
            },
          ],
        },
      ]),
    )

    expect(totals.calories).toBe(235)
    expect(totals.protein).toBe(46.5)
    expect(totals.fat).toBe(5.4)
  })
})
