import { describe, expect, it } from "vitest"
import { evaluateNutritionParse } from "@/lib/nutrition/parse-eval"

describe("evaluateNutritionParse", () => {
  it("gives a strong score for exact brand and quantity matches", () => {
    const expected = {
      meal_type: "breakfast" as const,
      items: [
        { name: "Honey Rings", quantity_g: 50, food_item_id: "11111111-1111-1111-1111-111111111111" },
        { name: "Petit Suisse 4%", quantity_g: 120, food_item_id: "22222222-2222-2222-2222-222222222222" },
      ],
    }
    const predicted = {
      meal_type: "breakfast" as const,
      items: [
        { name: "Honey Rings", quantity_g: 50, food_item_id: "11111111-1111-1111-1111-111111111111" },
        { name: "Petit Suisse 4%", quantity_g: 120, food_item_id: "22222222-2222-2222-2222-222222222222" },
      ],
    }

    const metrics = evaluateNutritionParse(expected, predicted)

    expect(metrics.matched_items).toBe(2)
    expect(metrics.precision).toBe(1)
    expect(metrics.recall).toBe(1)
    expect(metrics.id_match_rate).toBe(1)
    expect(metrics.meal_type_match).toBe(true)
    expect(metrics.score).toBe(100)
  })

  it("penalizes generic and contradictory predictions", () => {
    const expected = {
      meal_type: "breakfast" as const,
      items: [
        { name: "Honey Rings", quantity_g: 50, food_item_id: "11111111-1111-1111-1111-111111111111" },
        { name: "Petit Suisse 4%", quantity_g: 120, food_item_id: "22222222-2222-2222-2222-222222222222" },
      ],
    }
    const predicted = {
      meal_type: "snack" as const,
      items: [
        { name: "Céréales", quantity_g: 50 },
        { name: "Petit Suisse entier (40%)", quantity_g: 120 },
      ],
    }

    const metrics = evaluateNutritionParse(expected, predicted)

    expect(metrics.matched_items).toBe(1)
    expect(metrics.id_match_rate).toBe(0)
    expect(metrics.meal_type_match).toBe(false)
    expect(metrics.score).toBeLessThan(60)
  })

  it("accounts for quantity drift even when labels are close", () => {
    const expected = {
      meal_type: "lunch" as const,
      items: [
        { name: "Poulet grillé", quantity_g: 150, food_item_id: "33333333-3333-3333-3333-333333333333" },
      ],
    }
    const predicted = {
      meal_type: "lunch" as const,
      items: [
        { name: "Poulet grillé", quantity_g: 300, food_item_id: "33333333-3333-3333-3333-333333333333" },
      ],
    }

    const metrics = evaluateNutritionParse(expected, predicted)

    expect(metrics.matched_items).toBe(1)
    expect(metrics.quantity_accuracy).toBeLessThan(0.6)
    expect(metrics.score).toBeLessThan(96)
  })
})
