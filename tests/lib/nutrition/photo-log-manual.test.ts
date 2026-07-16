import { describe, expect, it } from "vitest"
import { mergeManualPlateComponents, parseManualPlateComponents } from "@/lib/nutrition/photo-log-manual"

describe("photo-log manual parsing", () => {
  it("extracts explicit beef and homemade potatoes quantities from a structured note", () => {
    const components = parseManualPlateComponents(`
      - 202g Emincé de bœuf sauté (cuit, avec oignons/sauce)
      - 133g Frites épaisses / Pommes de terre sautées maison
    `)

    expect(components).toHaveLength(2)
    expect(components[0]?.name_fr).toBe("Emince de boeuf saute")
    expect(components[0]?.quantity_g).toBe(202)
    expect(components[1]?.name_fr).toBe("Pommes de terre sautees maison")
    expect(components[1]?.quantity_g).toBe(133)
  })

  it("replaces generic AI guesses with explicit manual components when both refer to the same meal parts", () => {
    const manualComponents = parseManualPlateComponents(`
      - 202g Emincé de bœuf sauté
      - 133g Frites épaisses
    `)

    const merged = mergeManualPlateComponents({
      manualComponents,
      existingComponents: [
        {
          name_fr: "viande hachée (85% porc, 15% bœuf) cuite",
          category_hint: "proteins",
          quantity_g: 202,
          quantity_source: "visual_estimate",
          nutrition_source: "catalog_fallback",
          component_confidence: 0.5,
          kcal_per_100g: 220,
          protein_per_100g: 22,
          carbs_per_100g: 0,
          fat_per_100g: 15,
          fiber_per_100g: 0,
          source_note: null,
          catalog_metadata: null,
        },
        {
          name_fr: "Frites (portion moyenne)",
          category_hint: "carbs",
          quantity_g: 133,
          quantity_source: "visual_estimate",
          nutrition_source: "catalog_fallback",
          component_confidence: 0.5,
          kcal_per_100g: 312,
          protein_per_100g: 3.8,
          carbs_per_100g: 41.4,
          fat_per_100g: 15,
          fiber_per_100g: 3,
          source_note: null,
          catalog_metadata: null,
        },
      ],
    })

    expect(merged.map((component) => component.name_fr)).toEqual([
      "Emince de boeuf saute",
      "Pommes de terre sautees maison",
    ])
  })

  it("keeps every explicit component from a detailed mixed-meal note", () => {
    const components = parseManualPlateComponents(`
      - 120g riz blanc cuit
      - 130g pomme de terre cuite à l'eau
      - 70g patate douce cuite
      - 75g haut de cuisse de poulet (cuit, sans peau)
      - 75g porc cuit (morceau de mijoté / rouelle)
    `)

    expect(components.map((component) => [component.name_fr, component.quantity_g])).toEqual([
      ["Riz cuit", 120],
      ["Patate douce cuite", 70],
      ["Pommes de terre cuites", 130],
      ["Haut de cuisse de poulet cuit, sans peau", 75],
      ["Porc mijoté cuit", 75],
    ])
  })
})
