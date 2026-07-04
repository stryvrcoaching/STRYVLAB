import { describe, expect, it } from "vitest"
import { applyPackagingPostProcessing } from "@/lib/nutrition/photo-log-packaging"
import type { PhotoMealAnalysisSummary } from "@/lib/nutrition/photo-log-types"

describe("applyPackagingPostProcessing", () => {
  it("prioritizes separate weighing over a guessed packaged quantity", () => {
    const analysis: PhotoMealAnalysisSummary = {
      meal_type: "lunch",
      analysis_mode: "packaging",
      source_context: "product_packaging_v1",
      scale_weight_g: 42,
      scale_weight_confidence: 0.93,
      manual_weight_g: null,
      manual_detail: null,
      product_reference: {
        canonical_name_fr: "Céréales Honey Rings",
        name_fr: "Honey Rings",
      },
      photo_timeline: [
        { index: 1, role: "detail", evidence: "étiquette" },
        { index: 2, role: "separate_weighing", evidence: "bol sur balance" },
      ],
      components: [
        {
          name_fr: "Honey Rings",
          category_hint: "carbs",
          grams_estimate: 70,
          unit_count: null,
          kcal_per_100g: 379,
          protein_per_100g: 10,
          carbs_per_100g: 74,
          fat_per_100g: 3.1,
          fiber_per_100g: 7.5,
          ambiguity_tags: ["partial_weight"],
          rationale: "Poids estimé depuis le bol.",
        },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
    }

    const result = applyPackagingPostProcessing(analysis, 2)
    expect(result.components[0].grams_estimate).toBe(42)
  })

  it("removes implicit milk additions when the user did not ask for them", () => {
    const analysis: PhotoMealAnalysisSummary = {
      meal_type: "lunch",
      analysis_mode: "packaging",
      source_context: "product_packaging_v1",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      manual_detail: "42 grammes de céréales honey rings.",
      product_reference: {
        canonical_name_fr: "Céréales Honey Rings",
      },
      photo_timeline: [{ index: 1, role: "detail", evidence: "étiquette" }],
      components: [
        {
          name_fr: "Céréales Honey Rings",
          category_hint: "carbs",
          grams_estimate: 42,
          unit_count: null,
          kcal_per_100g: 379,
          protein_per_100g: 10,
          carbs_per_100g: 74,
          fat_per_100g: 3.1,
          fiber_per_100g: 7.5,
          ambiguity_tags: [],
          rationale: "Produit reconnu.",
        },
        {
          name_fr: "Lait demi-écrémé",
          category_hint: "drinks",
          grams_estimate: 125,
          unit_count: null,
          kcal_per_100g: 46,
          protein_per_100g: 3.4,
          carbs_per_100g: 4.8,
          fat_per_100g: 1.52,
          fiber_per_100g: 0,
          ambiguity_tags: [],
          rationale: "Ajout standard de lait.",
        },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
    }

    const result = applyPackagingPostProcessing(analysis, 2)
    expect(result.components).toHaveLength(1)
    expect(result.components[0].name_fr).toBe("Céréales Honey Rings")
  })

  it("fills known packaged drink macros when the product is recognized but the model returned zeros", () => {
    const analysis: PhotoMealAnalysisSummary = {
      meal_type: "snack",
      analysis_mode: "packaging",
      source_context: "product_packaging_v1",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      manual_detail: "Canette de Red Bull de 250 ml.",
      product_reference: {
        brand: "Red Bull",
        canonical_name_fr: "Red Bull",
        name_fr: "Red Bull",
      },
      photo_timeline: [{ index: 1, role: "detail", evidence: "canette" }],
      components: [
        {
          name_fr: "Boisson énergisante",
          category_hint: "drinks",
          grams_estimate: 250,
          unit_count: null,
          kcal_per_100g: 0,
          protein_per_100g: 0,
          carbs_per_100g: 0,
          fat_per_100g: 0,
          fiber_per_100g: 0,
          ambiguity_tags: [],
          rationale: "Canette reconnue mais tableau non lu.",
        },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
    }

    const result = applyPackagingPostProcessing(analysis, 1)
    expect(result.components).toHaveLength(1)
    expect(result.components[0].name_fr).toBe("Red Bull")
    expect(result.components[0].grams_estimate).toBe(250)
    expect(result.components[0].kcal_per_100g).toBeGreaterThan(0)
    expect(result.components[0].carbs_per_100g).toBeGreaterThan(0)
    expect(result.components[0].nutrition_source).toBe("catalog_fallback")
    expect(result.components[0].component_confidence).toBeGreaterThan(0.8)
  })

  it("rescues a recognized canned drink even when the model used the wrong category", () => {
    const analysis: PhotoMealAnalysisSummary = {
      meal_type: "snack",
      analysis_mode: "packaging",
      source_context: "product_packaging_v1",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      manual_detail: "Canette de Red Bull 250 ml.",
      product_reference: {
        brand: "Red Bull",
        canonical_name_fr: "Red Bull",
        name_fr: "Red Bull",
        product_type: "boisson",
      },
      photo_timeline: [{ index: 1, role: "detail", evidence: "canette" }],
      components: [
        {
          name_fr: "Produit emballé",
          category_hint: "extras",
          grams_estimate: 0,
          unit_count: null,
          kcal_per_100g: 0,
          protein_per_100g: 0,
          carbs_per_100g: 0,
          fat_per_100g: 0,
          fiber_per_100g: 0,
          ambiguity_tags: [],
          rationale: "Canette reconnue sans lecture nutritionnelle fiable.",
        },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
    }

    const result = applyPackagingPostProcessing(analysis, 1)
    expect(result.components).toHaveLength(1)
    expect(result.components[0].name_fr).toBe("Red Bull")
    expect(result.components[0].category_hint).toBe("drinks")
    expect(result.components[0].grams_estimate).toBe(250)
    expect(result.components[0].kcal_per_100g).toBe(45)
    expect(result.components[0].carbs_per_100g).toBe(11)
    expect(result.components[0].nutrition_source).toBe("catalog_fallback")
  })

  it("prioritizes explicit user-note quantity for a generic recognized packaged product", () => {
    const analysis: PhotoMealAnalysisSummary = {
      meal_type: "lunch",
      analysis_mode: "packaging",
      source_context: "product_packaging_v1",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      manual_detail: "J'ai mangé 140 g de thon nature.",
      product_reference: {
        canonical_name_fr: "Thon nature",
        name_fr: "Thon nature",
      },
      photo_timeline: [{ index: 1, role: "detail", evidence: "boîte" }],
      components: [
        {
          name_fr: "Thon",
          category_hint: "proteins",
          grams_estimate: 100,
          unit_count: null,
          kcal_per_100g: 116,
          protein_per_100g: 26,
          carbs_per_100g: 0,
          fat_per_100g: 1,
          fiber_per_100g: 0,
          ambiguity_tags: [],
          rationale: "Produit reconnu.",
        },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
    }

    const result = applyPackagingPostProcessing(analysis, 1)
    expect(result.components[0].name_fr).toBe("Thon nature")
    expect(result.components[0].grams_estimate).toBe(140)
    expect(result.components[0].nutrition_source).toBe("label_read")
    expect(result.components[0].component_confidence).toBeGreaterThan(0.9)
  })

  it("fills known whey macros from the packaging catalog when the model returned zero nutrition", () => {
    const analysis: PhotoMealAnalysisSummary = {
      meal_type: "snack",
      analysis_mode: "packaging",
      source_context: "product_packaging_v1",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      manual_detail: "40 g de QNT Life Light Digest Whey Protein.",
      product_reference: {
        brand: "QNT Life",
        canonical_name_fr: "QNT Life Light Digest Whey Protein",
        name_fr: "Light Digest Whey Protein",
        product_type: "whey",
      },
      photo_timeline: [{ index: 1, role: "detail", evidence: "sachet whey" }],
      components: [
        {
          name_fr: "Whey protein",
          category_hint: "proteins",
          grams_estimate: 40,
          unit_count: null,
          kcal_per_100g: 0,
          protein_per_100g: 0,
          carbs_per_100g: 0,
          fat_per_100g: 0,
          fiber_per_100g: 0,
          ambiguity_tags: [],
          rationale: "Produit reconnu sans tableau exploitable.",
        },
      ],
      ambiguity_tags: [],
      leftovers_recommended: false,
    }

    const result = applyPackagingPostProcessing(analysis, 1)
    expect(result.components[0].name_fr).toBe("QNT Life Light Digest Whey Protein")
    expect(result.components[0].grams_estimate).toBe(40)
    expect(result.components[0].kcal_per_100g).toBeGreaterThan(300)
    expect(result.components[0].protein_per_100g).toBeGreaterThan(60)
    expect(result.components[0].nutrition_source).toBe("catalog_fallback")
    expect(result.components[0].component_confidence).toBeGreaterThan(0.8)
  })

  it("synthesizes a primary packaged component when the product is recognized but no component survived", () => {
    const analysis: PhotoMealAnalysisSummary = {
      meal_type: "snack",
      analysis_mode: "packaging",
      source_context: "product_packaging_v1",
      scale_weight_g: null,
      scale_weight_confidence: null,
      manual_weight_g: null,
      manual_detail: null,
      product_reference: {
        brand: "Pulse",
        canonical_name_fr: "Pulse Pistachio Protein Bar",
        name_fr: "Pistachio Protein Bar",
        product_type: "snack",
        serving_size_g: 55,
        serving_label: "55 g",
      },
      photo_timeline: [{ index: 1, role: "detail", evidence: "face avant + dos" }],
      components: [],
      ambiguity_tags: [],
      leftovers_recommended: false,
    }

    const result = applyPackagingPostProcessing(analysis, 3)
    expect(result.components).toHaveLength(1)
    expect(result.components[0].name_fr).toBe("Pulse Pistachio Protein Bar")
    expect(result.components[0].grams_estimate).toBe(55)
    expect(result.components[0].category_hint).toBe("proteins")
  })
})
