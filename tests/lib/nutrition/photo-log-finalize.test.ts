import { describe, expect, it } from "vitest"
import { buildPhotoMealFinalResult, resolvePhotoMealSessionStatus } from "@/lib/nutrition/photo-log-finalize"
import type { PhotoMealAnalysisSummary } from "@/lib/nutrition/photo-log-types"

describe("buildPhotoMealFinalResult", () => {
  it("keeps receipt items as serving-based entries without plate clarifications", () => {
    const result = buildPhotoMealFinalResult({
      analysis: {
        meal_type: "lunch",
        analysis_mode: "receipt",
        source_context: "restaurant_receipt_v1",
        scale_weight_g: null,
        scale_weight_confidence: null,
        manual_weight_g: null,
        components: [{
          name_fr: "Big Mac",
          category_hint: "extras",
          grams_estimate: 100,
          quantity_unit: "serving",
          kcal_per_100g: 503,
          protein_per_100g: 26,
          carbs_per_100g: 42,
          fat_per_100g: 25,
          fiber_per_100g: 3,
          ambiguity_tags: [],
          nutrition_source: "catalog_fallback",
        }],
        ambiguity_tags: [],
        leftovers_recommended: false,
      },
      answers: {},
    })

    expect(result.ready_to_log).toBe(true)
    expect(result.pending_question).toBeNull()
    expect(result.components[0]?.quantity_unit).toBe("serving")
    expect(result.components[0]?.quantity_g).toBe(100)
  })

  it("marks an empty plate analysis as not ready to log", () => {
    const analysis: PhotoMealAnalysisSummary = {
      meal_type: "dinner",
      analysis_mode: "plate",
      source_context: "plate_home_v1",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      components: [],
      ambiguity_tags: [],
      leftovers_recommended: false,
      vision_notes: "Omelette visible dans la poêle.",
    }

    const result = buildPhotoMealFinalResult({
      analysis,
      answers: {},
    })

    expect(result.ready_to_log).toBe(false)
    expect(result.validation_issues?.length).toBeGreaterThan(0)
  })

  it("routes hard macro incoherence to failed status", () => {
    const analysis: PhotoMealAnalysisSummary = {
      meal_type: "snack",
      analysis_mode: "packaging",
      source_context: "product_packaging_v1",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      product_reference: {
        canonical_name_fr: "Red Bull",
      },
      components: [
        {
          name_fr: "Red Bull",
          category_hint: "drinks",
          grams_estimate: 250,
          kcal_per_100g: 0,
          protein_per_100g: 0,
          carbs_per_100g: 0,
          fat_per_100g: 0,
          fiber_per_100g: 0,
          ambiguity_tags: [],
        },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
    }

    const result = buildPhotoMealFinalResult({
      analysis,
      answers: {},
    })

    expect(resolvePhotoMealSessionStatus(result)).toBe("failed")
  })

  it("routes non-anchored plate estimates to clarifying status", () => {
    const analysis: PhotoMealAnalysisSummary = {
      meal_type: "breakfast",
      analysis_mode: "plate",
      source_context: "plate_home_v1",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      components: [
        {
          name_fr: "Oeuf au plat",
          category_hint: "proteins",
          grams_estimate: 0,
          kcal_per_100g: 170,
          protein_per_100g: 13,
          carbs_per_100g: 1,
          fat_per_100g: 12,
          fiber_per_100g: 0,
          ambiguity_tags: [],
        },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
    }

    const result = buildPhotoMealFinalResult({
      analysis,
      answers: {},
    })

    expect(resolvePhotoMealSessionStatus(result)).toBe("clarifying")
    expect(result.status_copy).toContain("précision textuelle ou vocale")
  })

  it("uses the extra-whites clarification to reach a ready egg result", () => {
    const analysis: PhotoMealAnalysisSummary = {
      meal_type: "breakfast",
      analysis_mode: "plate",
      source_context: "plate_home_v1",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      manual_detail: null,
      components: [
        {
          name_fr: "Oeuf au plat",
          category_hint: "proteins",
          grams_estimate: 0,
          unit_count: 1,
          kcal_per_100g: 170,
          protein_per_100g: 13,
          carbs_per_100g: 1,
          fat_per_100g: 12,
          fiber_per_100g: 0,
          ambiguity_tags: [],
        },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
    }

    const result = buildPhotoMealFinalResult({
      analysis,
      answers: { egg_white_extra_g: "240" },
    })

    expect(result.ready_to_log).toBe(true)
    expect(result.pending_question).toBeNull()
    expect(result.components.map((component) => component.name_fr)).toEqual(["Blanc d'oeuf", "Jaune d'oeuf"])
  })

  it("treats structured user note quantities as anchored even when a full plate weight is present", () => {
    const analysis: PhotoMealAnalysisSummary = {
      meal_type: "breakfast",
      analysis_mode: "plate",
      source_context: "plate_home_v1",
      scale_weight_g: 600,
      scale_weight_confidence: 0.96,
      manual_weight_g: null,
      manual_detail: "152 g riz basmati\n100 g lentilles, pommes de terre et porc\n277 g oeufs entiers",
      components: [
        {
          name_fr: "Riz basmati",
          category_hint: "carbs",
          grams_estimate: 152,
          kcal_per_100g: 130,
          protein_per_100g: 2.5,
          carbs_per_100g: 28,
          fat_per_100g: 0.3,
          fiber_per_100g: 0.4,
          ambiguity_tags: [],
        },
        {
          name_fr: "Lentilles, pommes de terre et porc",
          category_hint: "proteins",
          grams_estimate: 100,
          kcal_per_100g: 150,
          protein_per_100g: 12,
          carbs_per_100g: 15,
          fat_per_100g: 5,
          fiber_per_100g: 3,
          ambiguity_tags: [],
        },
        {
          name_fr: "Oeufs entiers",
          category_hint: "proteins",
          grams_estimate: 277,
          kcal_per_100g: 155,
          protein_per_100g: 13,
          carbs_per_100g: 1.1,
          fat_per_100g: 11,
          fiber_per_100g: 0,
          ambiguity_tags: [],
        },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
    }

    const result = buildPhotoMealFinalResult({
      analysis,
      answers: {},
    })

    expect(result.ready_to_log).toBe(true)
    expect(result.validation_issues ?? []).not.toContain(
      "Quantité insuffisamment ancrée pour un log nutritionnel strict. Ajoute un poids ou une précision.",
    )
    expect(
      Object.fromEntries(result.components.map((component) => [component.name_fr, component.quantity_g])),
    ).toEqual({
      "Riz cuit": 152,
      "Lentilles cuites": 40,
      "Pommes de terre cuites": 30,
      "Porc cuit": 30,
      "Oeufs entiers": 277,
    })
  })

  it("uses visible light spread packaging as an ingredient clue in plate mode", () => {
    const analysis: PhotoMealAnalysisSummary = {
      meal_type: "dinner",
      analysis_mode: "plate",
      source_context: "plate_home_v1",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      manual_detail: "4 oeufs entiers avec sauce tomate",
      components: [
        {
          name_fr: "Oeufs entiers",
          category_hint: "proteins",
          grams_estimate: 220,
          kcal_per_100g: 155,
          protein_per_100g: 13,
          carbs_per_100g: 1.1,
          fat_per_100g: 11,
          fiber_per_100g: 0,
          ambiguity_tags: [],
        },
        {
          name_fr: "Sauce tomate",
          category_hint: "extras",
          grams_estimate: 120,
          kcal_per_100g: 35,
          protein_per_100g: 1.4,
          carbs_per_100g: 6,
          fat_per_100g: 0.4,
          fiber_per_100g: 1.8,
          ambiguity_tags: [],
        },
        {
          name_fr: "Beurre",
          category_hint: "fats",
          grams_estimate: 5,
          kcal_per_100g: 717,
          protein_per_100g: 0.9,
          carbs_per_100g: 0.1,
          fat_per_100g: 81,
          fiber_per_100g: 0,
          ambiguity_tags: ["partial_weight"],
          rationale: "Matière grasse visible, pesée séparément à 5 g.",
        },
      ],
      photo_timeline: [
        {
          index: 1,
          role: "before_meal",
          evidence: "Poêle avec oeufs et sauce tomate.",
        },
        {
          index: 2,
          role: "detail",
          evidence: "Pot Vitelma essentials light Omega 3 à tartiner visible derrière la balance.",
        },
        {
          index: 3,
          role: "separate_weighing",
          evidence: "Matière grasse pesée à 5 g.",
        },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
      vision_notes: "Le packaging Vitelma light sert d'indice pour la matière grasse utilisée.",
    }

    const result = buildPhotoMealFinalResult({
      analysis,
      answers: {},
    })

    const spread = result.components.find((component) => component.name_fr === "Vitelma light")
    expect(spread).toMatchObject({
      quantity_g: 5,
      kcal_per_100g: 360,
      fat_per_100g: 40,
      nutrition_source: "catalog_fallback",
    })
    expect(result.ready_to_log).toBe(true)
    expect(result.validation_issues).toEqual([])
  })
})
