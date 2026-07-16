import { describe, expect, it } from "vitest"
import { interpretPhotoMealWeight } from "@/lib/nutrition/photo-log-weight"
import type { PhotoMealAnalysisSummary } from "@/lib/nutrition/photo-log-types"

const baseAnalysis: PhotoMealAnalysisSummary = {
  meal_type: "lunch",
  scale_weight_g: 300,
  scale_weight_confidence: 0.94,
  manual_weight_g: null,
  components: [
    {
      name_fr: "Riz",
      category_hint: "carbs",
      grams_estimate: 200,
      kcal_per_100g: 130,
      protein_per_100g: 2.5,
      carbs_per_100g: 28,
      fat_per_100g: 0.3,
      fiber_per_100g: 0.4,
      ambiguity_tags: ["cooked_vs_raw"],
    },
    {
      name_fr: "Poulet",
      category_hint: "proteins",
      grams_estimate: 100,
      kcal_per_100g: 165,
      protein_per_100g: 31,
      carbs_per_100g: 0,
      fat_per_100g: 3.6,
      fiber_per_100g: 0,
      ambiguity_tags: [],
    },
  ],
  ambiguity_tags: [],
  leftovers_recommended: false,
}

describe("interpretPhotoMealWeight", () => {
  it("scales estimated components to measured weight", () => {
    const result = interpretPhotoMealWeight({
      analysis: baseAnalysis,
      clarificationAnswers: {},
    })

    expect(result.hasMeasuredWeight).toBe(true)
    expect(result.components[0].quantity_g).toBe(200)
    expect(result.components[1].quantity_g).toBe(100)
  })

  it("reduces starch weight when clarified as raw", () => {
    const result = interpretPhotoMealWeight({
      analysis: baseAnalysis,
      clarificationAnswers: { starch_state: "raw" },
    })

    expect(result.components[0].quantity_g).toBe(70)
  })

  it("applies edible yield when bone-in weight includes non-edible parts", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        ...baseAnalysis,
        components: [
          {
            name_fr: "Cuisses de poulet",
            category_hint: "proteins",
            grams_estimate: 300,
            kcal_per_100g: 215,
            protein_per_100g: 18,
            carbs_per_100g: 0,
            fat_per_100g: 15,
            fiber_per_100g: 0,
            ambiguity_tags: ["non_edible_parts"],
          },
        ],
      },
      clarificationAnswers: { includes_non_edible_parts: "yes" },
    })

    expect(result.components[0].quantity_g).toBe(195)
  })

  it("adds a fat component when fat type and amount are provided", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        ...baseAnalysis,
        ambiguity_tags: ["hidden_fats"],
      },
      clarificationAnswers: {
        fat_type: "oil",
        fat_amount: "1_tbsp",
      },
    })

    expect(result.components.at(-1)?.name_fr).toBe("Huile d'olive")
    expect(result.components.at(-1)?.quantity_g).toBe(15)
  })

  it("raises creamy salad density when sauce is clarified as mayonnaise", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        ...baseAnalysis,
        scale_weight_g: null,
        scale_weight_confidence: null,
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
      },
      clarificationAnswers: { creamy_sauce_type: "mayo" },
    })

    expect(result.components).toHaveLength(1)
    expect(result.components[0]?.kcal_per_100g).toBe(170)
    expect(result.components[0]?.fat_per_100g).toBe(13)
    expect(result.components[0]?.nutrition_source).toBe("clarification")
  })

  it("uses a prudent creamy salad default when the user skips sauce type", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        ...baseAnalysis,
        scale_weight_g: null,
        scale_weight_confidence: null,
        ambiguity_tags: ["hidden_fats"],
        components: [
          {
            name_fr: "Salade russe avec sauce",
            category_hint: "extras",
            grams_estimate: 410,
            kcal_per_100g: 90,
            protein_per_100g: 2,
            carbs_per_100g: 14,
            fat_per_100g: 2,
            fiber_per_100g: 2,
            ambiguity_tags: ["hidden_fats"],
          },
        ],
      },
      clarificationAnswers: { creamy_sauce_type: "unknown" },
    })

    expect(result.components).toHaveLength(1)
    expect(result.components[0]?.kcal_per_100g).toBe(145)
    expect(result.components[0]?.fat_per_100g).toBe(10)
    expect(result.components[0]?.nutrition_source).toBe("default")
  })

  it("uses fallback grams when foods are detected but grams_estimate is zero", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        ...baseAnalysis,
        scale_weight_g: null,
        manual_weight_g: null,
        components: [
          {
            name_fr: "Oeufs durs",
            category_hint: "proteins",
            grams_estimate: 0,
            kcal_per_100g: 155,
            protein_per_100g: 13,
            carbs_per_100g: 1.1,
            fat_per_100g: 11,
            fiber_per_100g: 0,
            ambiguity_tags: [],
          },
          {
            name_fr: "Banane plantain cuite",
            category_hint: "carbs",
            grams_estimate: 0,
            kcal_per_100g: 122,
            protein_per_100g: 1.3,
            carbs_per_100g: 31.9,
            fat_per_100g: 0.4,
            fiber_per_100g: 2.3,
            ambiguity_tags: [],
          },
          {
            name_fr: "Poulet grille",
            category_hint: "proteins",
            grams_estimate: 0,
            kcal_per_100g: 165,
            protein_per_100g: 31,
            carbs_per_100g: 0,
            fat_per_100g: 3.6,
            fiber_per_100g: 0,
            ambiguity_tags: [],
          },
        ],
      },
      clarificationAnswers: {},
    })

    expect(result.components.map((component) => component.quantity_g)).toEqual([110, 140, 150])
  })

  it("corrects impossible macros for a simple weighed fresh fruit", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        ...baseAnalysis,
        scale_weight_g: null,
        manual_weight_g: null,
        components: [
          {
            name_fr: "Fraises surgelées",
            category_hint: "fruits",
            grams_estimate: 72,
            kcal_per_100g: 333,
            protein_per_100g: 29,
            carbs_per_100g: 39,
            fat_per_100g: 12.5,
            fiber_per_100g: 0,
            ambiguity_tags: [],
            nutrition_source: "visual_estimate",
          },
        ],
      },
      clarificationAnswers: {},
    })

    expect(result.components[0]?.quantity_g).toBe(72)
    expect(result.components[0]?.kcal_per_100g).toBe(33)
    expect(result.components[0]?.protein_per_100g).toBe(0.7)
    expect(result.components[0]?.carbs_per_100g).toBe(7.7)
    expect(result.components[0]?.fat_per_100g).toBe(0.3)
  })

  it("does not overwrite trusted fruit label nutrition", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        ...baseAnalysis,
        scale_weight_g: null,
        manual_weight_g: null,
        components: [
          {
            name_fr: "Barre aux fruits",
            category_hint: "fruits",
            grams_estimate: 40,
            kcal_per_100g: 280,
            protein_per_100g: 6,
            carbs_per_100g: 42,
            fat_per_100g: 8,
            fiber_per_100g: 4,
            ambiguity_tags: [],
            nutrition_source: "label_read",
          },
        ],
      },
      clarificationAnswers: {},
    })

    expect(result.components[0]?.kcal_per_100g).toBe(280)
    expect(result.components[0]?.nutrition_source).toBe("label_read")
  })

  it("uses visible unit count and rescales components to the measured plate weight", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        ...baseAnalysis,
        scale_weight_g: 392,
        scale_weight_confidence: 0.72,
        components: [
          {
            name_fr: "Oeufs durs",
            category_hint: "proteins",
            grams_estimate: 0,
            unit_count: 4,
            kcal_per_100g: 155,
            protein_per_100g: 13,
            carbs_per_100g: 1.1,
            fat_per_100g: 11,
            fiber_per_100g: 0,
            ambiguity_tags: [],
          },
          {
            name_fr: "Banane plantain cuite",
            category_hint: "carbs",
            grams_estimate: 0,
            kcal_per_100g: 122,
            protein_per_100g: 1.3,
            carbs_per_100g: 31.9,
            fat_per_100g: 0.4,
            fiber_per_100g: 2.3,
            ambiguity_tags: [],
          },
          {
            name_fr: "Poulet roti",
            category_hint: "proteins",
            grams_estimate: 0,
            kcal_per_100g: 239,
            protein_per_100g: 27,
            carbs_per_100g: 0,
            fat_per_100g: 14,
            fiber_per_100g: 0,
            ambiguity_tags: ["non_edible_parts"],
          },
        ],
      },
      clarificationAnswers: {},
    })

    const total = result.components.reduce((sum, component) => sum + component.quantity_g, 0)
    expect(result.hasMeasuredWeight).toBe(true)
    expect(total).toBeGreaterThanOrEqual(391)
    expect(total).toBeLessThanOrEqual(393)
    expect(result.components[0].quantity_g).toBeGreaterThan(result.components[1].quantity_g)
  })

  it("does not add a phantom fat before the clarification is answered", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        ...baseAnalysis,
        scale_weight_g: null,
        ambiguity_tags: ["hidden_fats"],
      },
      clarificationAnswers: {},
    })

    expect(result.components.some((component) => component.name_fr === "Matière grasse probable")).toBe(false)
  })

  it("uses a conservative fat fallback only after an explicit unknown answer", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        ...baseAnalysis,
        scale_weight_g: null,
        ambiguity_tags: ["hidden_fats"],
      },
      clarificationAnswers: { fat_type: "unknown" },
    })

    expect(result.components.at(-1)?.name_fr).toBe("Matière grasse probable")
    expect(result.components.at(-1)?.quantity_g).toBe(5)
  })

  it("preserves separate scale readings when a meal total is also present", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        ...baseAnalysis,
        scale_weight_g: 184,
        scale_weight_confidence: 0.95,
        components: [
          { ...baseAnalysis.components[0], name_fr: "Granola", grams_estimate: 48, ambiguity_tags: ["partial_weight"] },
          { ...baseAnalysis.components[1], name_fr: "Kéfir", grams_estimate: 20, ambiguity_tags: ["partial_weight"] },
          { ...baseAnalysis.components[1], name_fr: "Banane", grams_estimate: 51, ambiguity_tags: [] },
        ],
      },
      clarificationAnswers: {},
    })

    expect(result.components.map((component) => component.quantity_g)).toEqual([48, 20, 51])
  })

  it("does not globally rescale consumed estimates when after-meal leftovers were analyzed", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        ...baseAnalysis,
        scale_weight_g: 500,
        scale_weight_confidence: 0.82,
        photo_timeline: [
          { index: 1, role: "before_meal", evidence: "assiette pleine" },
          { index: 3, role: "after_meal_leftovers", evidence: "restes visibles" },
        ],
        leftovers_estimate: {
          detected: true,
          grams_estimate: 120,
          confidence: 0.72,
          rationale: "portion restante visible",
        },
        components: [
          {
            name_fr: "Poulet roti",
            category_hint: "proteins",
            grams_estimate: 140,
            kcal_per_100g: 239,
            protein_per_100g: 27,
            carbs_per_100g: 0,
            fat_per_100g: 14,
            fiber_per_100g: 0,
            ambiguity_tags: ["non_edible_parts"],
          },
          {
            name_fr: "Riz cuit",
            category_hint: "carbs",
            grams_estimate: 120,
            kcal_per_100g: 130,
            protein_per_100g: 2.5,
            carbs_per_100g: 28,
            fat_per_100g: 0.3,
            fiber_per_100g: 0.4,
            ambiguity_tags: [],
          },
        ],
      },
      clarificationAnswers: {},
    })

    expect(result.hasMeasuredWeight).toBe(true)
    expect(result.components.map((component) => component.quantity_g)).toEqual([140, 120])
  })

  it("prioritizes explicit user-note quantities for egg whites and yolk over visual fallback", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        meal_type: "breakfast",
        analysis_mode: "plate",
        source_context: "plate_home_v1",
        scale_weight_g: null,
        scale_weight_confidence: null,
        manual_weight_g: null,
        manual_detail: "Il y a 240 g de blanc d'oeuf et 15 g de jaune d'oeuf dans la poêle.",
        components: [
          {
            name_fr: "Oeuf au plat",
            category_hint: "proteins",
            grams_estimate: 0,
            unit_count: 1,
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
      },
      clarificationAnswers: {},
    })

    expect(result.components).toHaveLength(2)
    expect(result.components[0].name_fr).toBe("Blanc d'oeuf")
    expect(result.components[0].quantity_g).toBe(240)
    expect(result.components[0].quantity_source).toBe("user_note")
    expect(result.components[1].name_fr).toBe("Jaune d'oeuf")
    expect(result.components[1].quantity_g).toBe(15)
    expect(result.components[1].quantity_source).toBe("user_note")
  })

  it("keeps separately weighed egg whites and yolks as distinct egg parts", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        meal_type: "lunch",
        analysis_mode: "plate",
        source_context: "plate_home_v1",
        scale_weight_g: null,
        scale_weight_confidence: null,
        manual_weight_g: null,
        components: [
          {
            name_fr: "Blanc d'oeuf",
            category_hint: "proteins",
            grams_estimate: 104,
            kcal_per_100g: 155,
            protein_per_100g: 13,
            carbs_per_100g: 1.1,
            fat_per_100g: 11,
            fiber_per_100g: 0,
            ambiguity_tags: ["partial_weight"],
            rationale: "Blancs d'oeuf pesés séparément à 104 g.",
          },
          {
            name_fr: "Jaune d'oeuf",
            category_hint: "proteins",
            grams_estimate: 22,
            kcal_per_100g: 155,
            protein_per_100g: 13,
            carbs_per_100g: 1.1,
            fat_per_100g: 11,
            fiber_per_100g: 0,
            ambiguity_tags: ["partial_weight"],
            rationale: "Jaunes d'oeuf pesés séparément à 22 g.",
          },
        ],
        ambiguity_tags: [],
        leftovers_recommended: false,
      },
      clarificationAnswers: {},
    })

    expect(result.components.map((component) => component.name_fr)).toEqual(["Blanc d'oeuf", "Jaune d'oeuf"])
    expect(result.components.map((component) => component.quantity_g)).toEqual([104, 22])
    expect(result.components[0]).toMatchObject({
      kcal_per_100g: 52,
      protein_per_100g: 10.9,
      carbs_per_100g: 0.7,
      fat_per_100g: 0.2,
    })
    expect(result.components[1]).toMatchObject({
      kcal_per_100g: 322,
      protein_per_100g: 15.9,
      carbs_per_100g: 3.6,
      fat_per_100g: 26.5,
    })
  })

  it("subtracts removed yolk grams from whole eggs across common natural-language phrasings", () => {
    const manualDetails = [
      "277 g oeufs entier moins un jaune d'oeuf 15g",
      "277 g oeufs entiers moins 1 jaune d'oeuf 15 g",
      "277 g oeufs entiers sans un jaune d'oeuf",
      "277 g oeufs entiers sans un jaune d'oeuf 15 g",
      "277 g oeufs entiers retrait de 15 g de jaune d'oeuf",
    ]

    for (const manual_detail of manualDetails) {
      const result = interpretPhotoMealWeight({
        analysis: {
          meal_type: "breakfast",
          analysis_mode: "plate",
          source_context: "plate_home_v1",
          scale_weight_g: null,
          scale_weight_confidence: null,
          manual_weight_g: null,
          manual_detail,
          components: [
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
        },
        clarificationAnswers: {},
      })

      expect(result.components).toHaveLength(1)
      expect(result.components[0].name_fr).toBe("Oeufs entiers")
      expect(result.components[0].quantity_g).toBe(262)
      expect(result.components[0].quantity_source).toBe("user_note")
    }
  })

  it("splits one visible yolk and clarified extra whites into separate components", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
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
      },
      clarificationAnswers: { egg_white_extra_g: "240" },
    })

    expect(result.components).toHaveLength(2)
    expect(result.components[0].name_fr).toBe("Blanc d'oeuf")
    expect(result.components[0].quantity_g).toBe(240)
    expect(result.components[0].quantity_source).toBe("clarification")
    expect(result.components[0].nutrition_source).toBe("clarification")
    expect(result.components[0].component_confidence).toBeGreaterThan(0.85)
    expect(result.components[1].name_fr).toBe("Jaune d'oeuf")
    expect(result.components[1].quantity_g).toBe(15)
    expect(result.components[1].quantity_source).toBe("clarification")
    expect(result.components[1].nutrition_source).toBe("clarification")
    expect(result.components[1].component_confidence).toBeGreaterThan(0.85)
  })

  it("prioritizes explicit user-note quantities for simple rice and chicken plates", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        meal_type: "lunch",
        analysis_mode: "plate",
        source_context: "plate_home_v1",
        scale_weight_g: null,
        scale_weight_confidence: null,
        manual_weight_g: null,
        manual_detail: "Dans l'assiette il y a 200 g de riz cuit et 120 g de poulet.",
        components: [
          {
            name_fr: "Riz",
            category_hint: "carbs",
            grams_estimate: 0,
            kcal_per_100g: 130,
            protein_per_100g: 2.5,
            carbs_per_100g: 28,
            fat_per_100g: 0.3,
            fiber_per_100g: 0.4,
            ambiguity_tags: [],
          },
          {
            name_fr: "Poulet",
            category_hint: "proteins",
            grams_estimate: 0,
            kcal_per_100g: 165,
            protein_per_100g: 31,
            carbs_per_100g: 0,
            fat_per_100g: 3.6,
            fiber_per_100g: 0,
            ambiguity_tags: [],
          },
        ],
        ambiguity_tags: [],
        leftovers_recommended: false,
      },
      clarificationAnswers: {},
    })

    expect(result.components).toHaveLength(2)
    expect(result.components[0].name_fr).toBe("Riz cuit")
    expect(result.components[0].quantity_g).toBe(200)
    expect(result.components[0].quantity_source).toBe("user_note")
    expect(result.components[1].name_fr).toBe("Poulet")
    expect(result.components[1].quantity_g).toBe(120)
    expect(result.components[1].quantity_source).toBe("user_note")
  })

  it("prioritizes explicit user-note quantities for a cereal bowl with milk", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        meal_type: "breakfast",
        analysis_mode: "plate",
        source_context: "plate_home_v1",
        scale_weight_g: null,
        scale_weight_confidence: null,
        manual_weight_g: null,
        manual_detail: "Bol avec 42 g de céréales honey rings et 250 ml de lait demi-écrémé.",
        components: [
          {
            name_fr: "Céréales",
            category_hint: "carbs",
            grams_estimate: 0,
            kcal_per_100g: 379,
            protein_per_100g: 10,
            carbs_per_100g: 74,
            fat_per_100g: 3.1,
            fiber_per_100g: 7.5,
            ambiguity_tags: [],
          },
          {
            name_fr: "Lait",
            category_hint: "drinks",
            grams_estimate: 0,
            kcal_per_100g: 46,
            protein_per_100g: 3.4,
            carbs_per_100g: 4.8,
            fat_per_100g: 1.52,
            fiber_per_100g: 0,
            ambiguity_tags: [],
          },
        ],
        ambiguity_tags: [],
        leftovers_recommended: false,
      },
      clarificationAnswers: {},
    })

    expect(result.components).toHaveLength(2)
    expect(result.components[0].name_fr).toBe("Céréales Honey Rings")
    expect(result.components[0].quantity_g).toBe(42)
    expect(result.components[0].quantity_source).toBe("user_note")
    expect(result.components[1].name_fr).toBe("Lait demi-écrémé")
    expect(result.components[1].quantity_g).toBe(250)
    expect(result.components[1].quantity_source).toBe("user_note")
  })

  it("preserves structured user-note quantities instead of rescaling them to total plate weight", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
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
      },
      clarificationAnswers: {},
    })

    expect(
      Object.fromEntries(result.components.map((component) => [component.name_fr, component.quantity_g])),
    ).toEqual({
      "Riz cuit": 152,
      "Lentilles cuites": 40,
      "Pommes de terre cuites": 30,
      "Porc cuit": 30,
      "Oeufs entiers": 277,
    })
    expect(result.components.every((component) => component.quantity_source === "user_note")).toBe(true)
  })

  it("parses multiple inline quantities from a single free-text note and keeps them authoritative", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        meal_type: "lunch",
        analysis_mode: "plate",
        source_context: "plate_home_v1",
        scale_weight_g: 600,
        scale_weight_confidence: 0.96,
        manual_weight_g: null,
        manual_detail: "152 g riz basmati 100 g lentilles, pommes de terre et porc 277 g oeufs entier moins 1 jaune d'oeuf 15g",
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
      },
      clarificationAnswers: {},
    })

    expect(
      Object.fromEntries(result.components.map((component) => [component.name_fr, component.quantity_g])),
    ).toEqual({
      "Riz cuit": 152,
      "Lentilles cuites": 40,
      "Pommes de terre cuites": 30,
      "Porc cuit": 30,
      "Oeufs entiers": 262,
    })
    expect(result.components.every((component) => component.quantity_source === "user_note")).toBe(true)
  })

  it("splits the manual mixed dish into explicit lentils, potatoes and pork components", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        meal_type: "lunch",
        analysis_mode: "plate",
        source_context: "plate_home_v1",
        scale_weight_g: 600,
        scale_weight_confidence: 0.96,
        manual_weight_g: null,
        manual_detail: "152 g riz basmati 100 g lentilles, pommes de terre et porc 277 g oeufs entier moins 1 jaune d'oeuf 15g",
        components: [
          {
            name_fr: "Riz basmati",
            category_hint: "carbs",
            grams_estimate: 152,
            kcal_per_100g: 999,
            protein_per_100g: 99,
            carbs_per_100g: 99,
            fat_per_100g: 99,
            fiber_per_100g: 99,
            ambiguity_tags: [],
          },
          {
            name_fr: "Lentilles, pommes de terre et porc",
            category_hint: "proteins",
            grams_estimate: 100,
            kcal_per_100g: 999,
            protein_per_100g: 99,
            carbs_per_100g: 99,
            fat_per_100g: 99,
            fiber_per_100g: 99,
            ambiguity_tags: [],
          },
          {
            name_fr: "Oeufs entiers",
            category_hint: "proteins",
            grams_estimate: 277,
            kcal_per_100g: 999,
            protein_per_100g: 99,
            carbs_per_100g: 99,
            fat_per_100g: 99,
            fiber_per_100g: 99,
            ambiguity_tags: [],
          },
        ],
        ambiguity_tags: [],
        leftovers_recommended: false,
      },
      clarificationAnswers: {},
    })

    const byName = Object.fromEntries(result.components.map((component) => [component.name_fr, component]))
    expect(byName["Riz cuit"]?.kcal_per_100g).toBe(130)
    expect(byName["Riz cuit"]?.protein_per_100g).toBe(2.5)
    expect(byName["Lentilles cuites"]?.quantity_g).toBe(40)
    expect(byName["Lentilles cuites"]?.kcal_per_100g).toBe(116)
    expect(byName["Pommes de terre cuites"]?.quantity_g).toBe(30)
    expect(byName["Pommes de terre cuites"]?.kcal_per_100g).toBe(85)
    expect(byName["Porc cuit"]?.quantity_g).toBe(30)
    expect(byName["Porc cuit"]?.kcal_per_100g).toBe(180)
    expect(byName["Oeufs entiers"]?.kcal_per_100g).toBe(155)
    expect(byName["Oeufs entiers"]?.quantity_g).toBe(262)
  })

  it("scales the final meal when the user says only half was consumed", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        meal_type: "lunch",
        analysis_mode: "plate",
        source_context: "plate_home_v1",
        scale_weight_g: null,
        scale_weight_confidence: null,
        manual_weight_g: null,
        manual_detail: "200 g de riz cuit et 120 g de poulet. J'ai mangé seulement la moitié.",
        components: [
          {
            name_fr: "Riz",
            category_hint: "carbs",
            grams_estimate: 0,
            kcal_per_100g: 130,
            protein_per_100g: 2.5,
            carbs_per_100g: 28,
            fat_per_100g: 0.3,
            fiber_per_100g: 0.4,
            ambiguity_tags: [],
          },
          {
            name_fr: "Poulet",
            category_hint: "proteins",
            grams_estimate: 0,
            kcal_per_100g: 165,
            protein_per_100g: 31,
            carbs_per_100g: 0,
            fat_per_100g: 3.6,
            fiber_per_100g: 0,
            ambiguity_tags: [],
          },
        ],
        ambiguity_tags: [],
        leftovers_recommended: false,
      },
      clarificationAnswers: {},
    })

    expect(Object.fromEntries(result.components.map((component) => [component.name_fr, component.quantity_g]))).toEqual({
      "Riz cuit": 100,
      "Poulet": 60,
    })
  })

  it("applies edible yield when the user note says the poultry weight includes bones", () => {
    const result = interpretPhotoMealWeight({
      analysis: {
        meal_type: "lunch",
        analysis_mode: "plate",
        source_context: "plate_home_v1",
        scale_weight_g: null,
        scale_weight_confidence: null,
        manual_weight_g: null,
        manual_detail: "220 g de cuisses de poulet avec os",
        components: [
          {
            name_fr: "Cuisses de poulet",
            category_hint: "proteins",
            grams_estimate: 0,
            kcal_per_100g: 215,
            protein_per_100g: 18,
            carbs_per_100g: 0,
            fat_per_100g: 15,
            fiber_per_100g: 0,
            ambiguity_tags: ["non_edible_parts"],
          },
        ],
        ambiguity_tags: [],
        leftovers_recommended: false,
      },
      clarificationAnswers: {},
    })

    expect(result.components).toHaveLength(1)
    expect(result.components[0]?.name_fr).toBe("Cuisses de poulet")
    expect(result.components[0]?.quantity_g).toBe(143)
    expect(result.components[0]?.quantity_source).toBe("user_note")
  })
})
