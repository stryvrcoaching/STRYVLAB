import { describe, expect, it } from "vitest"
import { evaluateMealFit, type MealFitComponent } from "@/lib/nutrition/meal-fit-advisor"

const target = {
  kcal: 2200,
  protein_g: 160,
  carbs_g: 240,
  fat_g: 70,
}

const baseConsumed = {
  kcal: 1500,
  protein_g: 110,
  carbs_g: 150,
  fat_g: 45,
}

const chicken: MealFitComponent = {
  name: "Poulet grille",
  category_hint: "proteins",
  quantity_g: 150,
  kcal_per_100g: 165,
  protein_per_100g: 31,
  carbs_per_100g: 0,
  fat_per_100g: 3.6,
}

const plantain: MealFitComponent = {
  name: "Banane plantain cuite",
  category_hint: "carbs",
  quantity_g: 260,
  kcal_per_100g: 122,
  protein_per_100g: 1.3,
  carbs_per_100g: 31.9,
  fat_per_100g: 0.4,
}

const oil: MealFitComponent = {
  name: "Huile d'olive",
  category_hint: "fats",
  quantity_g: 20,
  kcal_per_100g: 884,
  protein_per_100g: 0,
  carbs_per_100g: 0,
  fat_per_100g: 100,
}

describe("evaluateMealFit", () => {
  it("reduces an existing carb component when calories are high and fat is already over", () => {
    const result = evaluateMealFit({
      target,
      consumedToday: {
        kcal: 2050,
        protein_g: 150,
        carbs_g: 205,
        fat_g: 82,
      },
      mealComponents: [chicken, plantain, oil],
    })

    expect(result.status).toBe("adjust")
    expect(result.primaryAction?.type).toBe("reduce")
    expect(result.primaryAction?.componentName).toBe("Banane plantain cuite")
    expect(result.primaryAction?.toG).toBeLessThan(plantain.quantity_g)
  })

  it("increases an existing protein when protein is behind and calories allow it", () => {
    const result = evaluateMealFit({
      target,
      consumedToday: baseConsumed,
      mealComponents: [{ ...chicken, quantity_g: 80 }, { ...plantain, quantity_g: 90 }],
    })

    expect(result.status).toBe("watch")
    expect(result.primaryAction?.type).toBe("increase")
    expect(result.primaryAction?.componentName).toBe("Poulet grille")
  })

  it("uses a secondary add suggestion when protein is low and no existing protein is adjustable", () => {
    const result = evaluateMealFit({
      target,
      consumedToday: baseConsumed,
      mealComponents: [{ ...plantain, quantity_g: 100 }],
    })

    expect(result.status).toBe("watch")
    expect(result.primaryAction).toBeUndefined()
    expect(result.secondarySuggestion?.type).toBe("add")
  })

  it("does not suggest increasing an existing component beyond a measured plate weight", () => {
    const result = evaluateMealFit({
      target,
      consumedToday: {
        ...baseConsumed,
        protein_g: 80,
      },
      measuredWeightG: 392,
      mealComponents: [
        { ...chicken, name: "Poulet rôti", quantity_g: 150, kcal_per_100g: 239, protein_per_100g: 27, fat_per_100g: 14 },
        { ...plantain, quantity_g: 140 },
        {
          name: "Oeufs durs",
          category_hint: "proteins",
          quantity_g: 110,
          kcal_per_100g: 155,
          protein_per_100g: 13,
          carbs_per_100g: 1.1,
          fat_per_100g: 11,
        },
      ],
    })

    expect(result.status).toBe("watch")
    expect(result.primaryAction).toBeUndefined()
    expect(result.secondarySuggestion?.type).toBe("add")
  })

  it("returns a good status when projected totals fit the day", () => {
    const result = evaluateMealFit({
      target,
      consumedToday: {
        kcal: 1500,
        protein_g: 120,
        carbs_g: 170,
        fat_g: 50,
      },
      mealComponents: [{ ...chicken, quantity_g: 120 }],
    })

    expect(result.status).toBe("good")
    expect(result.primaryAction).toBeUndefined()
  })

  it("does not describe a high-protein meal as light in protein when only the daily target remains incomplete", () => {
    const result = evaluateMealFit({
      target,
      consumedToday: {
        kcal: 1100,
        protein_g: 50,
        carbs_g: 90,
        fat_g: 30,
      },
      mealComponents: [
        { ...chicken, quantity_g: 150 },
        {
          name: "Oeufs entiers",
          category_hint: "proteins",
          quantity_g: 277,
          kcal_per_100g: 155,
          protein_per_100g: 13,
          carbs_per_100g: 1.1,
          fat_per_100g: 11,
        },
      ],
    })

    expect(result.status).toBe("watch")
    expect(result.title).toBe("Objectif protéines encore incomplet")
    expect(result.message.toLowerCase()).not.toContain("leger en proteines")
  })
})
