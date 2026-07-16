import { describe, expect, it } from "vitest"
import { applyScaleReadingEvidence } from "@/lib/nutrition/photo-log-evidence"
import type { PhotoMealAnalysisSummary } from "@/lib/nutrition/photo-log-types"

function baseAnalysis(): PhotoMealAnalysisSummary {
  return {
    meal_type: "breakfast",
    analysis_mode: "plate",
    source_context: "plate_home_v1",
    scale_weight_g: 326,
    scale_weight_confidence: 0.72,
    manual_weight_g: null,
    confidence_breakdown: {
      capture: 0.9,
      ocr: 0.8,
      quantity: 0.6,
      nutrition: 0.8,
    },
    components: [
      {
        name_fr: "Flocons d'avoine",
        category_hint: "carbs",
        grams_estimate: 60,
        kcal_per_100g: 370,
        protein_per_100g: 13,
        carbs_per_100g: 60,
        fat_per_100g: 7,
        fiber_per_100g: 10,
        ambiguity_tags: [],
      },
      {
        name_fr: "Myrtilles",
        category_hint: "fruits",
        grams_estimate: 80,
        kcal_per_100g: 57,
        protein_per_100g: 0.7,
        carbs_per_100g: 14.5,
        fat_per_100g: 0.3,
        fiber_per_100g: 2.4,
        ambiguity_tags: [],
      },
    ],
    ambiguity_tags: [],
    leftovers_recommended: false,
  }
}

describe("applyScaleReadingEvidence", () => {
  it("keeps separate ingredient weigh-ins independent from the global meal weight", () => {
    const result = applyScaleReadingEvidence({
      ...baseAnalysis(),
      scale_readings: [
        { photo_index: 1, grams: 74, scope: "component", food_name: "Flocons avoine", confidence: 0.96 },
        { photo_index: 2, grams: 112, scope: "component", food_name: "Myrtilles", confidence: 0.93 },
      ],
    })

    expect(result.scale_weight_g).toBeNull()
    expect(result.scale_weight_confidence).toBeNull()
    expect(result.components.map((component) => component.grams_estimate)).toEqual([74, 112])
    expect(result.components.every((component) => component.ambiguity_tags.includes("partial_weight"))).toBe(true)
    expect(result.confidence_breakdown?.quantity).toBe(0.88)
  })

  it("uses only an explicit meal-total reading as the global scale anchor", () => {
    const result = applyScaleReadingEvidence({
      ...baseAnalysis(),
      scale_readings: [
        { photo_index: 1, grams: 410, scope: "meal_total", food_name: null, confidence: 0.94 },
        { photo_index: 2, grams: 74, scope: "component", food_name: "Flocons d'avoine", confidence: 0.96 },
      ],
    })

    expect(result.scale_weight_g).toBe(410)
    expect(result.scale_weight_confidence).toBe(0.94)
    expect(result.components[0]?.grams_estimate).toBe(74)
  })

  it("subtracts measured bone leftovers from the matching weighed component", () => {
    const result = applyScaleReadingEvidence({
      ...baseAnalysis(),
      scale_weight_g: null,
      scale_weight_confidence: null,
      components: [
        {
          ...baseAnalysis().components[0],
          name_fr: "Poulet rôti",
          grams_estimate: 85,
          ambiguity_tags: ["non_edible_parts"],
          rationale: "Morceau de poulet pesé avant le repas.",
        },
      ],
      scale_readings: [
        { photo_index: 1, grams: 85, scope: "component", food_name: "Poulet rôti", confidence: 0.95 },
      ],
      leftovers_estimate: {
        detected: true,
        grams_estimate: 21,
        confidence: 0.9,
        rationale: "Os de poulet restants",
      },
    })

    expect(result.components[0]?.grams_estimate).toBe(64)
    expect(result.components[0]?.rationale).toContain("21 g")
    expect(result.components[0]?.ambiguity_tags).not.toContain("non_edible_parts")
  })

  it("preserves a component estimate when its rationale contradicts an OCR reading", () => {
    const result = applyScaleReadingEvidence({
      ...baseAnalysis(),
      components: [
        {
          ...baseAnalysis().components[0],
          name_fr: "Plantain frit",
          grams_estimate: 37,
          rationale: "Trois morceaux pesant 37 g au total.",
        },
      ],
      scale_readings: [
        { photo_index: 1, grams: 97, scope: "component", food_name: "Plantain frit", confidence: 0.95 },
      ],
    })

    expect(result.components[0]?.grams_estimate).toBe(37)
  })
})
