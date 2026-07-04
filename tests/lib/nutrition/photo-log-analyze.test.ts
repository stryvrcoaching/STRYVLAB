import { describe, expect, it } from "vitest"
import { shouldPromoteWeakPlateToPackaging } from "@/lib/nutrition/photo-log-analyze"
import type { PhotoMealAnalysisSummary } from "@/lib/nutrition/photo-log-types"

describe("shouldPromoteWeakPlateToPackaging", () => {
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
