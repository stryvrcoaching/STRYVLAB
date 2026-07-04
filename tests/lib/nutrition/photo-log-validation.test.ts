import { describe, expect, it } from "vitest"
import { validatePhotoMealResult } from "@/lib/nutrition/photo-log-validation"

describe("validatePhotoMealResult", () => {
  it("blocks empty plate results", () => {
    const result = validatePhotoMealResult({
      analysis_mode: "plate",
      components: [],
    })

    expect(result.issues.length).toBeGreaterThan(0)
  })

  it("blocks visible components with zero nutrition totals", () => {
    const result = validatePhotoMealResult({
      analysis_mode: "plate",
      components: [
        {
          name_fr: "Oeufs",
          category_hint: "proteins",
          quantity_g: 120,
          quantity_source: "visual_estimate",
          kcal_per_100g: 0,
          protein_per_100g: 0,
          carbs_per_100g: 0,
          fat_per_100g: 0,
          fiber_per_100g: 0,
        },
      ],
    })

    expect(result.issues.some((issue) => issue.includes("0 kcal"))).toBe(true)
  })

  it("blocks impossible packaged carb energy density", () => {
    const result = validatePhotoMealResult({
      analysis_mode: "packaging",
      components: [
        {
          name_fr: "Céréales Honey Rings",
          category_hint: "carbs",
          quantity_g: 70,
          quantity_source: "scale",
          kcal_per_100g: 50,
          protein_per_100g: 7,
          carbs_per_100g: 74,
          fat_per_100g: 3,
          fiber_per_100g: 7,
        },
      ],
    })

    expect(result.issues.some((issue) => issue.includes("incohérentes"))).toBe(true)
  })

  it("blocks packaged results when calories do not match macros", () => {
    const result = validatePhotoMealResult({
      analysis_mode: "packaging",
      components: [
        {
          name_fr: "Barre protéinée pistache",
          category_hint: "proteins",
          quantity_g: 55,
          quantity_source: "label",
          kcal_per_100g: 178.2,
          protein_per_100g: 27.3,
          carbs_per_100g: 18.2,
          fat_per_100g: 10.9,
          fiber_per_100g: 0,
        },
      ],
    })

    expect(result.issues.some((issue) => issue.includes("calories et macros"))).toBe(true)
  })

  it("allows plausible visual plate estimates without a manual weight anchor", () => {
    const result = validatePhotoMealResult({
      analysis_mode: "plate",
      components: [
        {
          name_fr: "Riz basmati cuit",
          category_hint: "carbs",
          quantity_g: 180,
          quantity_source: "visual_estimate",
          kcal_per_100g: 130,
          protein_per_100g: 2.7,
          carbs_per_100g: 28,
          fat_per_100g: 0.3,
          fiber_per_100g: 0.4,
        },
        {
          name_fr: "Poulet rôti",
          category_hint: "proteins",
          quantity_g: 180,
          quantity_source: "visual_estimate",
          kcal_per_100g: 190,
          protein_per_100g: 27,
          carbs_per_100g: 1,
          fat_per_100g: 8,
          fiber_per_100g: 0,
        },
        {
          name_fr: "Avocat",
          category_hint: "fats",
          quantity_g: 80,
          quantity_source: "visual_estimate",
          kcal_per_100g: 160,
          protein_per_100g: 2,
          carbs_per_100g: 9,
          fat_per_100g: 15,
          fiber_per_100g: 0,
        },
      ],
    })

    expect(result.issues).toEqual([])
  })

  it("allows eggs with tomato sauce and measured oil without flagging low-energy sauce as incoherent", () => {
    const result = validatePhotoMealResult({
      analysis_mode: "plate",
      components: [
        {
          name_fr: "Oeufs entiers",
          category_hint: "proteins",
          quantity_g: 200,
          quantity_source: "user_note",
          kcal_per_100g: 155,
          protein_per_100g: 13,
          carbs_per_100g: 1.1,
          fat_per_100g: 11,
          fiber_per_100g: 0,
        },
        {
          name_fr: "Sauce tomate",
          category_hint: "carbs",
          quantity_g: 100,
          quantity_source: "visual_estimate",
          kcal_per_100g: 40,
          protein_per_100g: 1.5,
          carbs_per_100g: 7,
          fat_per_100g: 0.4,
          fiber_per_100g: 1.8,
        },
        {
          name_fr: "Huile d'olive",
          category_hint: "fats",
          quantity_g: 8,
          quantity_source: "user_note",
          kcal_per_100g: 884,
          protein_per_100g: 0,
          carbs_per_100g: 0,
          fat_per_100g: 100,
          fiber_per_100g: 0,
        },
      ],
    })

    expect(result.issues).toEqual([])
  })

  it("allows weighed frozen strawberries as naturally low-energy fruit", () => {
    const result = validatePhotoMealResult({
      analysis_mode: "plate",
      components: [
        {
          name_fr: "Fraises surgelées",
          category_hint: "fruits",
          quantity_g: 72,
          quantity_source: "scale",
          kcal_per_100g: 33,
          protein_per_100g: 0.7,
          carbs_per_100g: 7.7,
          fat_per_100g: 0.3,
          fiber_per_100g: 2,
          nutrition_source: "visual_estimate",
        },
      ],
    })

    expect(result.issues).toEqual([])
  })
})
