import type { FoodItem } from "@/lib/nutrition/food-items"
import { matchesVisibleLeaf } from "@/lib/nutrition/food-taxonomy"
import type {
  FoodFrameworkKey,
  FoodRuleKind,
  FoodRuleTargetType,
} from "@/lib/nutrition/food-preferences"

export type FoodProfileRule = {
  id?: string
  kind: FoodRuleKind
  target_type: FoodRuleTargetType
  food_item_id?: string | null
  taxonomy_key?: string | null
  label: string
  severity?: "avoid" | "strict" | "trace_caution" | null
  classification_status?: "classified" | "unclassified" | "needs_review"
  active?: boolean
}

export type FoodProfileSnapshot = {
  allergy_status: "unknown" | "none" | "declared"
  version: number
  rules: FoodProfileRule[]
}

export type FoodCompatibilityStatus =
  | "blocked"
  | "needs_review"
  | "hidden"
  | "priority"
  | "liked"
  | "neutral"

export type FoodCompatibility = {
  status: FoodCompatibilityStatus
  reasons: string[]
  matched_rule_ids: string[]
}

type CompatibleFood = Pick<
  FoodItem,
  "id" | "name_fr" | "category_l1" | "category_l2" | "item_key"
> & {
  dietary_tags?: string[] | null
  allergen_tags?: string[] | null
  ingredients_known?: boolean | null
  source?: string | null
  is_verified?: boolean | null
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
}

function nameHas(food: CompatibleFood, terms: string[]) {
  const name = normalize(food.name_fr)
  return terms.some((term) => name.includes(normalize(term)))
}

export function deriveFoodTraits(food: CompatibleFood): Set<string> {
  const traits = new Set<string>([
    ...(food.dietary_tags ?? []),
    ...(food.allergen_tags ?? []),
  ])
  const item = food as FoodItem

  if (matchesVisibleLeaf(item, "chicken") || matchesVisibleLeaf(item, "turkey")) {
    traits.add("meat")
  }
  if (matchesVisibleLeaf(item, "beef") || matchesVisibleLeaf(item, "pork") || matchesVisibleLeaf(item, "charcuterie")) {
    traits.add("meat")
  }
  if (matchesVisibleLeaf(item, "pork") || nameHas(food, ["porc", "jambon", "bacon", "lard", "chorizo", "saucisson"])) {
    traits.add("pork")
  }
  if (matchesVisibleLeaf(item, "fish")) traits.add("fish")
  if (matchesVisibleLeaf(item, "seafood")) traits.add("seafood")
  if (matchesVisibleLeaf(item, "eggs")) traits.add("eggs")
  if (matchesVisibleLeaf(item, "dairy-protein") || food.category_l2 === "laitiers") traits.add("dairy")
  if (matchesVisibleLeaf(item, "nuts-seeds") || matchesVisibleLeaf(item, "nut-butters")) traits.add("nuts")
  if (nameHas(food, ["soja", "tofu", "tempeh", "edamame"])) traits.add("soy")
  if (
    nameHas(food, ["blé", "ble", "seigle", "orge", "épeautre", "epeautre", "pain", "pâtes", "pates", "semoule"])
  ) {
    traits.add("gluten")
  }
  if (food.category_l1 === "drinks" && nameHas(food, ["alcool", "biere", "bière", "vin ", "whisky", "vodka", "rhum"])) {
    traits.add("alcohol")
  }
  return traits
}

function frameworkBlockedTraits(framework: FoodFrameworkKey) {
  switch (framework) {
    case "vegetarian":
      return ["meat", "fish", "seafood"]
    case "vegan":
      return ["meat", "fish", "seafood", "eggs", "dairy"]
    case "halal":
    case "pork_free":
      return ["pork", ...(framework === "halal" ? ["alcohol"] : [])]
    case "kosher":
      return ["pork", "seafood"]
    case "gluten_free":
      return ["gluten"]
    default:
      return []
  }
}

function ruleMatchesFood(rule: FoodProfileRule, food: CompatibleFood, traits: Set<string>) {
  if (rule.target_type === "food_item") return rule.food_item_id === food.id
  if (rule.target_type === "taxonomy") return !!rule.taxonomy_key && traits.has(rule.taxonomy_key)
  if (rule.target_type === "free_text") {
    const label = normalize(rule.label)
    const name = normalize(food.name_fr)
    return label.length >= 2 && (name === label || name.includes(label))
  }
  return false
}

export function evaluateFoodCompatibility(
  food: CompatibleFood,
  profile: FoodProfileSnapshot | null,
): FoodCompatibility {
  if (!profile) {
    return {
      status: "needs_review",
      reasons: ["Préférences et allergies non renseignées"],
      matched_rule_ids: [],
    }
  }

  const activeRules = profile.rules.filter((rule) => rule.active !== false)
  const traits = deriveFoodTraits(food)
  const matchedRuleIds: string[] = []
  const reasons: string[] = []

  for (const rule of activeRules.filter((entry) => entry.kind === "allergy")) {
    if (ruleMatchesFood(rule, food, traits)) {
      if (rule.id) matchedRuleIds.push(rule.id)
      reasons.push(`Allergie : ${rule.label}`)
    }
  }
  if (reasons.length > 0) return { status: "blocked", reasons, matched_rule_ids: matchedRuleIds }

  for (const rule of activeRules.filter((entry) => entry.kind === "framework")) {
    const framework = rule.taxonomy_key as FoodFrameworkKey | null | undefined
    if (!framework) continue
    if (frameworkBlockedTraits(framework).some((trait) => traits.has(trait))) {
      if (rule.id) matchedRuleIds.push(rule.id)
      reasons.push(`Cadre alimentaire : ${rule.label}`)
    }
  }
  if (reasons.length > 0) return { status: "blocked", reasons, matched_rule_ids: matchedRuleIds }

  for (const rule of activeRules.filter((entry) => entry.kind === "intolerance")) {
    if (ruleMatchesFood(rule, food, traits)) {
      if (rule.id) matchedRuleIds.push(rule.id)
      reasons.push(`Intolérance : ${rule.label}`)
    }
  }
  if (reasons.length > 0) return { status: "needs_review", reasons, matched_rule_ids: matchedRuleIds }

  const exactPreference = activeRules.find(
    (rule) =>
      ["must_keep", "disliked", "liked"].includes(rule.kind) &&
      ruleMatchesFood(rule, food, traits),
  )
  if (exactPreference?.id) matchedRuleIds.push(exactPreference.id)
  if (exactPreference?.kind === "disliked") {
    return { status: "hidden", reasons: [`Non apprécié : ${exactPreference.label}`], matched_rule_ids: matchedRuleIds }
  }
  if (exactPreference?.kind === "must_keep") {
    return { status: "priority", reasons: [`À conserver : ${exactPreference.label}`], matched_rule_ids: matchedRuleIds }
  }
  if (exactPreference?.kind === "liked") {
    return { status: "liked", reasons: [`Apprécié : ${exactPreference.label}`], matched_rule_ids: matchedRuleIds }
  }

  if (
    profile.allergy_status === "declared" &&
    food.ingredients_known !== true &&
    (
      food.source === "user" ||
      activeRules.some(
        (rule) =>
          rule.kind === "allergy" &&
          (rule.target_type === "free_text" || rule.classification_status !== "classified"),
      )
    )
  ) {
    return {
      status: "needs_review",
      reasons: ["Une allergie déclarée n’est pas encore classifiée"],
      matched_rule_ids: [],
    }
  }

  return { status: "neutral", reasons: [], matched_rule_ids: [] }
}

export function sortFoodsByCompatibility<T extends { compatibility: FoodCompatibility }>(items: T[]) {
  const rank: Record<FoodCompatibilityStatus, number> = {
    priority: 0,
    liked: 1,
    neutral: 2,
    needs_review: 3,
    hidden: 4,
    blocked: 5,
  }
  return [...items].sort((a, b) => rank[a.compatibility.status] - rank[b.compatibility.status])
}
