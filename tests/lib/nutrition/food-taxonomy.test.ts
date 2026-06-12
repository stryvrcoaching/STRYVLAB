import { describe, expect, it } from "vitest"
import type { FoodItem } from "@/lib/nutrition/food-items"
import { matchesVisibleLeaf } from "@/lib/nutrition/food-taxonomy"

function mkFood(partial: Partial<FoodItem>): FoodItem {
  return {
    id: partial.id ?? "f1",
    name_fr: partial.name_fr ?? "Food",
    category_l1: partial.category_l1 ?? "proteins",
    category_l2: partial.category_l2 ?? null,
    item_key: partial.item_key ?? "food",
    kcal_per_100g: partial.kcal_per_100g ?? 100,
    protein_per_100g: partial.protein_per_100g ?? 0,
    carbs_per_100g: partial.carbs_per_100g ?? 0,
    fat_per_100g: partial.fat_per_100g ?? 0,
    fiber_per_100g: partial.fiber_per_100g ?? 0,
    source: partial.source ?? "ciqual",
    is_verified: partial.is_verified ?? true,
  }
}

describe("nutrition leaf taxonomy", () => {
  it("routes obvious beef items away from other proteins", () => {
    const beef = mkFood({
      name_fr: "Bavette de boeuf",
      category_l1: "proteins",
      category_l2: "autres",
    })

    expect(matchesVisibleLeaf(beef, "beef")).toBe(true)
    expect(matchesVisibleLeaf(beef, "other-proteins")).toBe(false)
  })

  it("routes obvious chicken and egg items to their dedicated leaves", () => {
    const chicken = mkFood({
      name_fr: "Blanc de dinde",
      category_l1: "proteins",
      category_l2: "autres",
    })
    const egg = mkFood({
      name_fr: "Blanc d'œuf",
      category_l1: "proteins",
      category_l2: "autres",
    })

    expect(matchesVisibleLeaf(chicken, "turkey")).toBe(true)
    expect(matchesVisibleLeaf(chicken, "other-proteins")).toBe(false)
    expect(matchesVisibleLeaf(egg, "eggs")).toBe(true)
    expect(matchesVisibleLeaf(egg, "other-proteins")).toBe(false)
  })

  it("routes rice-like starches away from other carbs", () => {
    const rice = mkFood({
      name_fr: "Galette de riz soufflé",
      category_l1: "carbs",
      category_l2: "autres",
    })

    expect(matchesVisibleLeaf(rice, "rice")).toBe(true)
    expect(matchesVisibleLeaf(rice, "cereals")).toBe(false)
  })

  it("keeps composite meals out of dedicated ingredient leaves", () => {
    const salad = mkFood({
      name_fr: "Salade de pâtes, végétarienne",
      category_l1: "extras",
      category_l2: "fast-food",
    })
    const bouillon = mkFood({
      name_fr: "Bouillon de volaille",
      category_l1: "extras",
      category_l2: "fast-food",
    })
    const pizza = mkFood({
      name_fr: "Pizza au chorizo ou salami",
      category_l1: "extras",
      category_l2: "fast-food",
    })

    expect(matchesVisibleLeaf(salad, "pasta")).toBe(false)
    expect(matchesVisibleLeaf(bouillon, "chicken")).toBe(false)
    expect(matchesVisibleLeaf(pizza, "bread")).toBe(false)
    expect(matchesVisibleLeaf(pizza, "other-proteins")).toBe(false)
  })

  it("keeps biscuit-like items out of fresh fruits", () => {
    const biscuit = mkFood({
      name_fr: "Biscuit sec fourré aux fruits",
      category_l1: "fruits",
      category_l2: "frais",
    })

    expect(matchesVisibleLeaf(biscuit, "fresh-fruits")).toBe(false)
  })

  it("keeps vinegary condiments out of sweet sauces", () => {
    const capers = mkFood({
      name_fr: "Câpres, au vinaigre",
      category_l1: "extras",
      category_l2: "sauces",
    })

    expect(matchesVisibleLeaf(capers, "sweet-sauces")).toBe(false)

    const ketchup = mkFood({
      name_fr: "Ketchup",
      category_l1: "extras",
      category_l2: "sauces",
    })

    expect(matchesVisibleLeaf(ketchup, "sweet-sauces")).toBe(true)
  })

  it("keeps butter out of oils", () => {
    const butter = mkFood({
      name_fr: "Beurre allégé 39% MG",
      category_l1: "fats",
      category_l2: "huiles",
    })

    expect(matchesVisibleLeaf(butter, "oils")).toBe(false)
    expect(matchesVisibleLeaf(butter, "butter-spreads")).toBe(true)
  })
})
