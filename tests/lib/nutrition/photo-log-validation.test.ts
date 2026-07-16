import { describe, expect, it } from "vitest"
import { validatePhotoMealAnalysisEvidence, validatePhotoMealResult } from "@/lib/nutrition/photo-log-validation"

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

  it("blocks food identities that are too generic to log safely", () => {
    const result = validatePhotoMealResult({
      analysis_mode: "plate",
      components: [
        {
          name_fr: "Viande crue",
          category_hint: "proteins",
          quantity_g: 159,
          quantity_source: "scale",
          kcal_per_100g: 220,
          protein_per_100g: 25,
          carbs_per_100g: 0,
          fat_per_100g: 13,
          fiber_per_100g: 0,
        },
      ],
    })

    expect(result.issues.some((issue) => issue.includes("trop vague"))).toBe(true)
  })

  it("flags a detected meal total below the sum of separate weigh-ins", () => {
    const issues = validatePhotoMealAnalysisEvidence({
      meal_type: "breakfast",
      analysis_mode: "plate",
      scale_weight_g: 184,
      scale_weight_confidence: 0.95,
      manual_weight_g: null,
      components: [],
      scale_readings: [
        { photo_index: 1, grams: 48, scope: "component", food_name: "Granola", confidence: 0.95 },
        { photo_index: 2, grams: 70, scope: "component", food_name: "Lait", confidence: 0.95 },
        { photo_index: 3, grams: 90, scope: "component", food_name: "Fruits", confidence: 0.95 },
        { photo_index: 4, grams: 184, scope: "meal_total", food_name: "Bol final", confidence: 0.95 },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
    })

    expect(issues.some((issue) => issue.includes("incompatibles"))).toBe(true)
  })

  it("flags an implausibly small protein derived from a cumulative difference", () => {
    const issues = validatePhotoMealAnalysisEvidence({
      meal_type: "lunch",
      analysis_mode: "plate",
      scale_weight_g: 139,
      scale_weight_confidence: 0.95,
      manual_weight_g: null,
      components: [
        {
          name_fr: "Poulet cuit",
          category_hint: "proteins",
          grams_estimate: 16,
          kcal_per_100g: 239,
          protein_per_100g: 27,
          carbs_per_100g: 0,
          fat_per_100g: 14,
          fiber_per_100g: 0,
          ambiguity_tags: [],
          rationale: "Différence de poids entre riz seul et total",
          component_confidence: 0.5,
        },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
    })

    expect(issues.some((issue) => issue.includes("calculée par différence"))).toBe(true)
  })

  it("flags a leftovers timeline that contradicts the leftovers assessment", () => {
    const issues = validatePhotoMealAnalysisEvidence({
      meal_type: "lunch",
      analysis_mode: "plate",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      components: [],
      photo_timeline: [
        { index: 1, role: "before_meal" },
        { index: 2, role: "after_meal_leftovers" },
      ],
      leftovers_estimate: {
        detected: false,
        grams_estimate: null,
        confidence: 0.8,
      },
      ambiguity_tags: [],
      leftovers_recommended: false,
    })

    expect(issues.some((issue) => issue.includes("à la fois"))).toBe(true)
  })

  it("flags gram values in rationales that do not match extracted evidence", () => {
    const issues = validatePhotoMealAnalysisEvidence({
      meal_type: "lunch",
      analysis_mode: "plate",
      scale_weight_g: 139,
      scale_weight_confidence: 0.95,
      manual_weight_g: null,
      components: [
        {
          name_fr: "Poulet",
          category_hint: "proteins",
          grams_estimate: 116,
          kcal_per_100g: 200,
          protein_per_100g: 27,
          carbs_per_100g: 0,
          fat_per_100g: 10,
          fiber_per_100g: 0,
          ambiguity_tags: [],
          rationale: "Viande calculée depuis 239 g total et 123 g de riz.",
        },
      ],
      scale_readings: [
        { photo_index: 1, grams: 123, scope: "component", food_name: "Riz", confidence: 0.95 },
        { photo_index: 2, grams: 139, scope: "meal_total", food_name: "Repas", confidence: 0.95 },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
    })

    expect(issues.some((issue) => issue.includes("incompatibles"))).toBe(true)
  })
})
