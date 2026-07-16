import { describe, expect, it } from "vitest"
import { getNextPhotoMealClarification } from "@/lib/nutrition/photo-log-clarifications"
import type { PhotoMealAnalysisSummary } from "@/lib/nutrition/photo-log-types"

function makeAnalysis(overrides: Partial<PhotoMealAnalysisSummary> = {}): PhotoMealAnalysisSummary {
  return {
    meal_type: "lunch",
    scale_weight_g: 320,
    scale_weight_confidence: 0.92,
    manual_weight_g: null,
    components: [],
    ambiguity_tags: [],
    leftovers_recommended: false,
    ...overrides,
  }
}

describe("getNextPhotoMealClarification", () => {
  it("does not apply plate clarifications to a receipt session", () => {
    expect(getNextPhotoMealClarification({
      meal_type: "lunch",
      analysis_mode: "receipt",
      source_context: "restaurant_receipt_v1",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      components: [{
        name_fr: "Menu restaurant",
        category_hint: "extras",
        grams_estimate: 100,
        kcal_per_100g: 650,
        protein_per_100g: 28,
        carbs_per_100g: 72,
        fat_per_100g: 26,
        fiber_per_100g: 5,
        ambiguity_tags: ["hidden_fats"],
      }],
      ambiguity_tags: ["hidden_fats"],
      leftovers_recommended: false,
    }, {})).toBeNull()
  })

  it("asks for extra egg whites on a single egg-like plate without weight anchor", () => {
    const question = getNextPhotoMealClarification(
      makeAnalysis({
        meal_type: "breakfast",
        scale_weight_g: null,
        scale_weight_confidence: null,
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
      }),
      {},
    )

    expect(question?.key).toBe("egg_white_extra_g")
    expect(question?.options.some((option) => option.value === "240")).toBe(true)
  })

  it("asks for starch state first when a starch ambiguity exists", () => {
    const question = getNextPhotoMealClarification(
      makeAnalysis({
        components: [
          {
            name_fr: "Riz basmati",
            category_hint: "carbs",
            grams_estimate: 180,
            kcal_per_100g: 130,
            protein_per_100g: 2.5,
            carbs_per_100g: 28,
            fat_per_100g: 0.3,
            fiber_per_100g: 0.4,
            ambiguity_tags: ["cooked_vs_raw"],
          },
        ],
      }),
      {},
    )

    expect(question?.key).toBe("starch_state")
  })

  it("asks fat amount after fat type when hidden fats are present", () => {
    const question = getNextPhotoMealClarification(
      makeAnalysis({
        ambiguity_tags: ["hidden_fats"],
      }),
      { fat_type: "oil" },
    )

    expect(question?.key).toBe("fat_amount")
  })

  it("asks a closed sauce question before generic fat questions for creamy salads", () => {
    const question = getNextPhotoMealClarification(
      makeAnalysis({
        ambiguity_tags: ["hidden_fats"],
        components: [
          {
            name_fr: "Salade de légumes avec sauce crémeuse",
            category_hint: "extras",
            grams_estimate: 410,
            kcal_per_100g: 120,
            protein_per_100g: 2,
            carbs_per_100g: 15,
            fat_per_100g: 5,
            fiber_per_100g: 2,
            ambiguity_tags: ["hidden_fats"],
            rationale: "Salade rose avec sauce visible.",
          },
        ],
      }),
      {},
    )

    expect(question?.key).toBe("creamy_sauce_type")
    expect(question?.options.map((option) => option.value)).toEqual([
      "mayo",
      "light",
      "little",
      "unknown",
    ])
  })

  it("does not ask a generic fat question after creamy sauce was answered", () => {
    const question = getNextPhotoMealClarification(
      makeAnalysis({
        ambiguity_tags: ["hidden_fats"],
        components: [
          {
            name_fr: "Salade de légumes avec sauce crémeuse",
            category_hint: "extras",
            grams_estimate: 410,
            kcal_per_100g: 120,
            protein_per_100g: 2,
            carbs_per_100g: 15,
            fat_per_100g: 5,
            fiber_per_100g: 2,
            ambiguity_tags: ["hidden_fats"],
          },
        ],
      }),
      { creamy_sauce_type: "mayo" },
    )

    expect(question).toBeNull()
  })

  it("asks about non-edible parts after starch and fat questions are resolved", () => {
    const question = getNextPhotoMealClarification(
      makeAnalysis({
        components: [
          {
            name_fr: "Cuisses de poulet",
            category_hint: "proteins",
            grams_estimate: 220,
            kcal_per_100g: 215,
            protein_per_100g: 18,
            carbs_per_100g: 0,
            fat_per_100g: 15,
            fiber_per_100g: 0,
            ambiguity_tags: ["non_edible_parts"],
          },
        ],
      }),
      {},
    )

    expect(question?.key).toBe("includes_non_edible_parts")
  })

  it("returns null when nothing more is needed", () => {
    const question = getNextPhotoMealClarification(
      makeAnalysis({
        components: [
          {
            name_fr: "Poulet grille",
            category_hint: "proteins",
            grams_estimate: 150,
            kcal_per_100g: 165,
            protein_per_100g: 31,
            carbs_per_100g: 0,
            fat_per_100g: 3.6,
            fiber_per_100g: 0,
            ambiguity_tags: [],
          },
        ],
      }),
      {},
    )

    expect(question).toBeNull()
  })
})
