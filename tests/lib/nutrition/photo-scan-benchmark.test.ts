import { describe, expect, it } from "vitest"
import type { PhotoMealFinalResult } from "@/lib/nutrition/photo-log-types"
import { benchmarkCaseSchema, type BenchmarkCase } from "@/benchmarks/nutrition-scan/schema"
import { scoreBenchmarkCase } from "@/benchmarks/nutrition-scan/scoring"

function benchmarkCase(): BenchmarkCase {
  return benchmarkCaseSchema.parse({
    schema_version: 1,
    id: "test-poulet-riz",
    title: "Poulet et riz pesés",
    status: "ready",
    split: "development",
    scenario: "separate_weighing",
    provenance: {
      source_type: "owned",
      source_url: null,
      license: "owned-private",
      attribution: null,
      consent_confirmed: true,
      notes: null,
    },
    input: {
      photos: [{ path: "assets/photo.jpg", kind: "scale_zoom", role_hint: "separate_weighing" }],
      text: null,
      manual_weight_g: null,
      clarification_answers: {},
    },
    truth: {
      tier: "A",
      analysis_mode: "plate",
      annotation_method: "Balance et recette mesurée",
      reviewed_by: ["test"],
      notes: null,
      components: [
        { name_fr: "Poulet grillé", aliases: ["Blanc de poulet"], quantity_g: 150, nutrients: { kcal: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4, fiber_g: 0 } },
        { name_fr: "Riz", aliases: ["Riz blanc"], quantity_g: 200, nutrients: { kcal: 260, protein_g: 5.4, carbs_g: 56, fat_g: 0.6, fiber_g: 0.8 } },
      ],
      totals: { kcal: 508, protein_g: 51.9, carbs_g: 56, fat_g: 6, fiber_g: 0.8 },
    },
  })
}

function result(overrides: Partial<PhotoMealFinalResult> = {}): PhotoMealFinalResult {
  return {
    meal_type: "lunch",
    analysis_mode: "plate",
    source_context: "plate_home_v1",
    status_copy: "Prêt",
    ready_to_log: true,
    leftovers_recommended: false,
    pending_question: null,
    components: [
      { name_fr: "Blanc de poulet", category_hint: "proteins", quantity_g: 150, kcal_per_100g: 165.33, protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6, fiber_per_100g: 0 },
      { name_fr: "Riz blanc cuit", category_hint: "carbs", quantity_g: 200, kcal_per_100g: 130, protein_per_100g: 2.7, carbs_per_100g: 28, fat_per_100g: 0.3, fiber_per_100g: 0.4 },
    ],
    ...overrides,
  }
}

describe("nutrition scan benchmark", () => {
  it("requires truth for a ready case", () => {
    const invalid = { ...benchmarkCase(), truth: null }
    expect(benchmarkCaseSchema.safeParse(invalid).success).toBe(false)
  })

  it("scores an exact fused result near 100", () => {
    const metrics = scoreBenchmarkCase(benchmarkCase(), result())
    expect(metrics.score).toBeGreaterThan(99)
    expect(metrics.item_f1).toBe(1)
    expect(metrics.quantity_accuracy).toBe(1)
    expect(metrics.duplicate_count).toBe(0)
  })

  it("penalizes duplicates, missing foods and macro drift", () => {
    const degraded = result({
      components: [
        { name_fr: "Poulet", category_hint: "proteins", quantity_g: 300, kcal_per_100g: 300, protein_per_100g: 10, carbs_per_100g: 20, fat_per_100g: 20, fiber_per_100g: 0 },
        { name_fr: "Poulet grillé", category_hint: "proteins", quantity_g: 150, kcal_per_100g: 300, protein_per_100g: 10, carbs_per_100g: 20, fat_per_100g: 20, fiber_per_100g: 0 },
      ],
    })
    const metrics = scoreBenchmarkCase(benchmarkCase(), degraded)
    expect(metrics.duplicate_count).toBe(1)
    expect(metrics.item_recall).toBe(0.5)
    expect(metrics.score).toBeLessThan(70)
  })
})
