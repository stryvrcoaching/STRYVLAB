import { describe, expect, it } from "vitest"
import { applyPersonalFoodHintMatches, shouldPromoteWeakPlateToPackaging } from "@/lib/nutrition/photo-log-analyze"
import type { PhotoMealAnalysisSummary } from "@/lib/nutrition/photo-log-types"

const PERSONAL_HINTS = [
  {
    id: "whey",
    name_fr: "Whey protéine",
    category_l1: "proteins" as const,
    kcal_per_100g: 400,
    protein_per_100g: 80,
    carbs_per_100g: 8,
    fat_per_100g: 5,
    fiber_per_100g: 0,
  },
  {
    id: "milk",
    name_fr: "Lait demi-écrémé",
    category_l1: "drinks" as const,
    kcal_per_100g: 50,
    protein_per_100g: 3.3,
    carbs_per_100g: 4.8,
    fat_per_100g: 1.6,
    fiber_per_100g: 0,
  },
]

describe("shouldPromoteWeakPlateToPackaging", () => {
  it("does not map unrelated plate foods to a protein powder hint", () => {
    const analysis = {
      meal_type: "breakfast" as const,
      analysis_mode: "plate" as const,
      source_context: "plate_home_v1",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      manual_detail: null,
      product_reference: null,
      components: [
        {
          name_fr: "Oeufs frits",
          category_hint: "proteins" as const,
          grams_estimate: 120,
          kcal_per_100g: 180,
          protein_per_100g: 13,
          carbs_per_100g: 1,
          fat_per_100g: 14,
          fiber_per_100g: 0,
          ambiguity_tags: [],
          rationale: "Deux oeufs visibles.",
        },
        {
          name_fr: "Steak de boeuf",
          category_hint: "proteins" as const,
          grams_estimate: 150,
          kcal_per_100g: 220,
          protein_per_100g: 27,
          carbs_per_100g: 0,
          fat_per_100g: 12,
          fiber_per_100g: 0,
          ambiguity_tags: [],
          rationale: "Steak visible.",
        },
        {
          name_fr: "Myrtilles",
          category_hint: "fruits" as const,
          grams_estimate: 50,
          kcal_per_100g: 57,
          protein_per_100g: 0.7,
          carbs_per_100g: 14,
          fat_per_100g: 0.3,
          fiber_per_100g: 2.4,
          ambiguity_tags: [],
          rationale: "Myrtilles visibles.",
        },
        {
          name_fr: "Lait",
          category_hint: "drinks" as const,
          grams_estimate: 200,
          kcal_per_100g: 50,
          protein_per_100g: 3.3,
          carbs_per_100g: 4.8,
          fat_per_100g: 1.6,
          fiber_per_100g: 0,
          ambiguity_tags: [],
          rationale: "Verre de lait visible.",
        },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
      vision_notes: "Deux oeufs, un steak, des myrtilles et un verre de lait.",
    } satisfies PhotoMealAnalysisSummary

    const result = applyPersonalFoodHintMatches(analysis, PERSONAL_HINTS)

    expect(result.components.map((component) => component.name_fr)).toEqual([
      "Oeufs frits",
      "Steak de boeuf",
      "Myrtilles",
      "Lait",
    ])
  })

  it("promotes an empty plate analysis when the evidence only points to packaging", () => {
    const analysis: PhotoMealAnalysisSummary = {
      meal_type: "snack",
      analysis_mode: "plate",
      source_context: "plate_home_v1",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      manual_detail: null,
      product_reference: null,
      components: [],
      photo_timeline: [
        {
          index: 1,
          role: "before_meal",
          evidence: "Photo montre une barre protéinée avant consommation.",
        },
        {
          index: 2,
          role: "detail",
          evidence: "Photo montre l'étiquette nutritionnelle de la barre.",
        },
        {
          index: 3,
          role: "detail",
          evidence: "Photo montre le code-barres et le poids unitaire.",
        },
      ],
      leftovers_estimate: null,
      confidence_breakdown: null,
      ambiguity_tags: [],
      leftovers_recommended: false,
      vision_notes: null,
    }

    expect(shouldPromoteWeakPlateToPackaging(analysis)).toBe(true)
  })

  it("does not promote a real plate analysis that already has food components", () => {
    const analysis: PhotoMealAnalysisSummary = {
      meal_type: "lunch",
      analysis_mode: "plate",
      source_context: "plate_home_v1",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      manual_detail: null,
      product_reference: null,
      components: [
        {
          name_fr: "Riz cuit",
          category_hint: "carbs",
          grams_estimate: 180,
          unit_count: null,
          kcal_per_100g: 130,
          protein_per_100g: 2.5,
          carbs_per_100g: 28,
          fat_per_100g: 0.3,
          fiber_per_100g: 0.4,
          ambiguity_tags: [],
          rationale: "Assiette visible.",
          edible_yield_ratio: null,
          nutrition_source: "visual_estimate",
          component_confidence: 0.7,
          catalog_metadata: null,
        },
      ],
      photo_timeline: [
        {
          index: 1,
          role: "before_meal",
          evidence: "Photo montre une assiette de riz.",
        },
      ],
      leftovers_estimate: null,
      confidence_breakdown: null,
      ambiguity_tags: [],
      leftovers_recommended: false,
      vision_notes: null,
    }

    expect(shouldPromoteWeakPlateToPackaging(analysis)).toBe(false)
  })
})
