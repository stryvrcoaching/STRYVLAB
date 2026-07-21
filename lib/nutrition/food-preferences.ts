import { z } from "zod"

export const FOOD_FRAMEWORKS = [
  { key: "omnivore", label: "Omnivore" },
  { key: "vegetarian", label: "Végétarien" },
  { key: "vegan", label: "Végétalien / Vegan" },
  { key: "halal", label: "Halal" },
  { key: "kosher", label: "Casher" },
  { key: "pork_free", label: "Sans porc" },
  { key: "gluten_free", label: "Sans gluten" },
] as const

export const FOOD_SAFETY_TAXONOMY = [
  { key: "dairy", label: "Lait et produits laitiers" },
  { key: "eggs", label: "Œufs" },
  { key: "gluten", label: "Gluten" },
  { key: "nuts", label: "Fruits à coque et arachides" },
  { key: "fish", label: "Poissons" },
  { key: "seafood", label: "Crustacés et mollusques" },
  { key: "soy", label: "Soja" },
  { key: "pork", label: "Porc" },
] as const

export type FoodFrameworkKey = (typeof FOOD_FRAMEWORKS)[number]["key"]
export type FoodSafetyTaxonomyKey = (typeof FOOD_SAFETY_TAXONOMY)[number]["key"]
export type FoodPreferenceStatus = "liked" | "disliked" | "must_keep"
export type FoodRuleKind =
  | "allergy"
  | "intolerance"
  | "framework"
  | FoodPreferenceStatus
export type FoodRuleTargetType = "food_item" | "taxonomy" | "free_text"

export const foodRuleTargetSchema = z
  .object({
    target_type: z.enum(["food_item", "taxonomy", "free_text"]),
    food_item_id: z.string().uuid().nullable().optional(),
    taxonomy_key: z.string().trim().max(80).nullable().optional(),
    label: z.string().trim().min(1).max(160),
  })
  .superRefine((target, context) => {
    if (target.target_type === "food_item" && !target.food_item_id) {
      context.addIssue({ code: "custom", message: "Aliment invalide." })
    }
    if (target.target_type === "taxonomy" && !target.taxonomy_key) {
      context.addIssue({ code: "custom", message: "Famille invalide." })
    }
  })

export const foodSafetyRuleInputSchema = foodRuleTargetSchema.and(
  z.object({
    severity: z.enum(["avoid", "strict", "trace_caution"]).default("strict"),
  }),
)

export const foodPreferenceRuleInputSchema = foodRuleTargetSchema.and(
  z.object({
    status: z.enum(["liked", "disliked", "must_keep"]),
  }),
)

export const foodPreferenceAssessmentSchema = z
  .object({
    allergy_status: z.enum(["none", "declared"]),
    allergies: z.array(foodSafetyRuleInputSchema).max(40).default([]),
    intolerances: z.array(foodSafetyRuleInputSchema).max(40).default([]),
    frameworks: z
      .array(z.enum(["omnivore", "vegetarian", "vegan", "halal", "kosher", "pork_free", "gluten_free"]))
      .max(7)
      .default([]),
    preferences: z.array(foodPreferenceRuleInputSchema).max(240).default([]),
  })
  .superRefine((value, context) => {
    const targetKey = (target: {
      target_type: string
      food_item_id?: string | null
      taxonomy_key?: string | null
      label: string
    }) =>
      `${target.target_type}:${target.food_item_id ?? target.taxonomy_key ?? target.label.toLowerCase()}`
    if (value.allergy_status === "declared" && value.allergies.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["allergies"],
        message: "Ajoutez au moins une allergie.",
      })
    }
    if (value.allergy_status === "none" && value.allergies.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["allergies"],
        message: "Le statut allergique est incohérent.",
      })
    }
    if (value.frameworks.includes("omnivore") && value.frameworks.length > 1) {
      context.addIssue({
        code: "custom",
        path: ["frameworks"],
        message: "Omnivore ne peut pas être combiné avec un cadre restrictif.",
      })
    }
    if (value.frameworks.includes("vegan") && value.frameworks.includes("vegetarian")) {
      context.addIssue({
        code: "custom",
        path: ["frameworks"],
        message: "Vegan inclut déjà le cadre végétarien.",
      })
    }
    const preferenceKeys = new Set<string>()
    for (const [index, preference] of value.preferences.entries()) {
      const key = targetKey(preference)
      if (preferenceKeys.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["preferences", index],
          message: "Un aliment ne peut avoir qu’un seul état de préférence.",
        })
      }
      preferenceKeys.add(key)
    }
  })

export type FoodRuleTarget = z.infer<typeof foodRuleTargetSchema>
export type FoodSafetyRuleInput = z.infer<typeof foodSafetyRuleInputSchema>
export type FoodPreferenceRuleInput = z.infer<typeof foodPreferenceRuleInputSchema>
export type FoodPreferenceAssessmentValue = z.infer<typeof foodPreferenceAssessmentSchema>

export function isFoodPreferenceAssessmentComplete(value: unknown) {
  return foodPreferenceAssessmentSchema.safeParse(value).success
}
