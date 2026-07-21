import { describe, expect, it } from "vitest"
import { foodPreferenceAssessmentSchema } from "@/lib/nutrition/food-preferences"
import {
  evaluateFoodCompatibility,
  sortFoodsByCompatibility,
  type FoodProfileSnapshot,
} from "@/lib/nutrition/food-compatibility"

function food(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name_fr: "Poulet",
    category_l1: "proteins",
    category_l2: "viandes",
    item_key: "poulet",
    source: "internal",
    is_verified: true,
    ingredients_known: true,
    dietary_tags: [],
    allergen_tags: [],
    ...overrides,
  } as any
}

function profile(rules: FoodProfileSnapshot["rules"]): FoodProfileSnapshot {
  return { allergy_status: "declared", version: 1, rules }
}

describe("foodPreferenceAssessmentSchema", () => {
  it("requires at least one allergy when status is declared", () => {
    const result = foodPreferenceAssessmentSchema.safeParse({
      allergy_status: "declared",
      allergies: [],
      intolerances: [],
      frameworks: [],
      preferences: [],
    })
    expect(result.success).toBe(false)
  })

  it("accepts an explicit no-allergy profile", () => {
    const result = foodPreferenceAssessmentSchema.safeParse({
      allergy_status: "none",
      allergies: [],
      intolerances: [],
      frameworks: ["omnivore"],
      preferences: [],
    })
    expect(result.success).toBe(true)
  })

  it("rejects two preference states for the same food", () => {
    const target = {
      target_type: "food_item",
      food_item_id: "11111111-1111-4111-8111-111111111111",
      label: "Poulet",
    }
    const result = foodPreferenceAssessmentSchema.safeParse({
      allergy_status: "none",
      allergies: [],
      intolerances: [],
      frameworks: [],
      preferences: [
        { ...target, status: "liked" },
        { ...target, status: "must_keep" },
      ],
    })
    expect(result.success).toBe(false)
  })
})

describe("evaluateFoodCompatibility", () => {
  it("blocks a food matching an allergy before applying preferences", () => {
    const milk = food({
      name_fr: "Skyr nature",
      category_l2: "laitiers",
      item_key: "skyr",
    })
    const result = evaluateFoodCompatibility(
      milk,
      profile([
        {
          id: "allergy",
          kind: "allergy",
          target_type: "taxonomy",
          taxonomy_key: "dairy",
          label: "Produits laitiers",
          active: true,
        },
        {
          id: "favorite",
          kind: "must_keep",
          target_type: "food_item",
          food_item_id: milk.id,
          label: "Skyr",
          active: true,
        },
      ]),
    )
    expect(result.status).toBe("blocked")
    expect(result.matched_rule_ids).toContain("allergy")
  })

  it("blocks a catalogue food matching a free-text allergy", () => {
    const profile = {
      allergy_status: "declared" as const,
      version: 1,
      rules: [
        {
          kind: "allergy" as const,
          target_type: "free_text" as const,
          label: "Kiwi",
          classification_status: "unclassified" as const,
        },
      ],
    }
    expect(
      evaluateFoodCompatibility(
        food({ name_fr: "Kiwi frais", ingredients_known: true }),
        profile,
      ).status,
    ).toBe("blocked")
  })

  it("blocks meat for a vegan framework", () => {
    const result = evaluateFoodCompatibility(
      food(),
      profile([
        {
          kind: "framework",
          target_type: "taxonomy",
          taxonomy_key: "vegan",
          label: "Vegan",
          active: true,
        },
      ]),
    )
    expect(result.status).toBe("blocked")
  })

  it("hides a disliked food but prioritizes a must-keep food", () => {
    const disliked = evaluateFoodCompatibility(
      food(),
      profile([
        {
          kind: "disliked",
          target_type: "food_item",
          food_item_id: "11111111-1111-4111-8111-111111111111",
          label: "Poulet",
          active: true,
        },
      ]),
    )
    const mustKeep = evaluateFoodCompatibility(
      food(),
      profile([
        {
          kind: "must_keep",
          target_type: "food_item",
          food_item_id: "11111111-1111-4111-8111-111111111111",
          label: "Poulet",
          active: true,
        },
      ]),
    )
    expect(disliked.status).toBe("hidden")
    expect(mustKeep.status).toBe("priority")
  })

  it("marks the catalog for review when the profile is missing", () => {
    expect(evaluateFoodCompatibility(food(), null).status).toBe("needs_review")
  })

  it("marks a custom food for review when allergies are declared", () => {
    const result = evaluateFoodCompatibility(
      food({ source: "user", ingredients_known: false }),
      profile([
        {
          kind: "allergy",
          target_type: "taxonomy",
          taxonomy_key: "nuts",
          label: "Fruits à coque",
          active: true,
        },
      ]),
    )
    expect(result.status).toBe("needs_review")
  })

  it("sorts must-keep and liked foods before neutral foods", () => {
    const sorted = sortFoodsByCompatibility([
      { id: "neutral", compatibility: { status: "neutral", reasons: [], matched_rule_ids: [] } },
      { id: "liked", compatibility: { status: "liked", reasons: [], matched_rule_ids: [] } },
      { id: "priority", compatibility: { status: "priority", reasons: [], matched_rule_ids: [] } },
    ])
    expect(sorted.map((item) => item.id)).toEqual(["priority", "liked", "neutral"])
  })
})
