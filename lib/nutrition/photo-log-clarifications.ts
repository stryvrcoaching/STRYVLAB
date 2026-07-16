import type {
  PhotoMealAnalysisSummary,
  PhotoMealClarificationQuestion,
} from "@/lib/nutrition/photo-log-types"
import { ct, type ClientLang } from "@/lib/i18n/clientTranslations"

const DRY_READY_STARCH_HINTS = [
  "avoine",
  "flocon",
  "flocons",
  "oat",
  "oats",
  "muesli",
  "granola",
  "céréale",
  "cereale",
  "céréales",
  "cereales",
  "pain",
  "toast",
  "biscotte",
]
const BONE_IN_HINTS = ["aile", "ailes", "cuisse", "cuisses", "poisson entier", "crevette", "crevettes", "crabe", "homard"]
const EGG_HINTS = ["oeuf", "oeufs", "egg", "eggs", "omelette"]
const CREAMY_SAUCE_HINTS = [
  "salade",
  "sauce",
  "crémeuse",
  "cremeuse",
  "mayonnaise",
  "mayo",
  "russe",
  "betterave",
  "piémontaise",
  "piemontaise",
  "macédoine",
  "macedoine",
  "coleslaw",
]

function containsHint(name: string, hints: string[]) {
  const normalized = name.toLowerCase()
  return hints.some((hint) => normalized.includes(hint))
}

function hasSingleEggLikePlate(analysis: PhotoMealAnalysisSummary) {
  if (analysis.scale_weight_g || analysis.manual_weight_g) return false
  if (analysis.manual_detail?.trim()) return false
  if (analysis.components.length !== 1) return false

  const [component] = analysis.components
  if (!component) return false
  return containsHint(component.name_fr, EGG_HINTS)
}

function hasCreamySauceAmbiguity(analysis: PhotoMealAnalysisSummary) {
  const hasHiddenFats =
    analysis.ambiguity_tags.includes("hidden_fats") ||
    analysis.components.some((component) => component.ambiguity_tags.includes("hidden_fats"))

  if (!hasHiddenFats) return false

  return analysis.components.some((component) =>
    containsHint(
      [
        component.name_fr,
        component.rationale,
        component.catalog_metadata?.canonical_name_fr,
      ].filter(Boolean).join(" "),
      CREAMY_SAUCE_HINTS,
    ),
  )
}

function componentEvidenceText(component: PhotoMealAnalysisSummary["components"][number]) {
  return [
    component.name_fr,
    component.rationale,
    component.catalog_metadata?.brand,
    component.catalog_metadata?.canonical_name_fr,
  ].filter(Boolean).join(" ")
}

function isClearlyDryReadyStarch(component: PhotoMealAnalysisSummary["components"][number]) {
  return containsHint(componentEvidenceText(component), DRY_READY_STARCH_HINTS)
}

export function getNextPhotoMealClarification(
  analysis: PhotoMealAnalysisSummary,
  answers: Record<string, string>,
  lang: ClientLang = "fr",
): PhotoMealClarificationQuestion | null {
  if (
    analysis.analysis_mode === "packaging" ||
    analysis.analysis_mode === "barcode" ||
    analysis.analysis_mode === "receipt" ||
    analysis.analysis_mode === "hybrid"
  ) {
    return null
  }

  if (hasSingleEggLikePlate(analysis) && !answers.egg_white_extra_g) {
    return {
      key: "egg_white_extra_g",
      prompt: ct(lang, "nutrition.photo.question.eggWhite.prompt"),
      options: [
        { value: "0", label: ct(lang, "nutrition.photo.question.eggWhite.none") },
        { value: "100", label: ct(lang, "nutrition.photo.question.eggWhite.about", { grams: 100 }) },
        { value: "150", label: ct(lang, "nutrition.photo.question.eggWhite.about", { grams: 150 }) },
        { value: "200", label: ct(lang, "nutrition.photo.question.eggWhite.about", { grams: 200 }) },
        { value: "240", label: ct(lang, "nutrition.photo.question.eggWhite.about", { grams: 240 }) },
        { value: "300", label: ct(lang, "nutrition.photo.question.eggWhite.about", { grams: 300 }) },
      ],
    }
  }

  const hasStarchAmbiguity = analysis.components.some(
    (component) =>
      component.ambiguity_tags.includes("cooked_vs_raw") &&
      !isClearlyDryReadyStarch(component),
  )
  if (hasStarchAmbiguity && !analysis.manual_detail?.trim() && !answers.starch_state) {
    return {
      key: "starch_state",
      prompt: ct(lang, "nutrition.photo.question.starch.prompt"),
      options: [
        { value: "cooked", label: ct(lang, "nutrition.photo.question.starch.cooked") },
        { value: "raw", label: ct(lang, "nutrition.photo.question.starch.raw") },
      ],
    }
  }

  const hasFatAmbiguity =
    analysis.ambiguity_tags.includes("hidden_fats") ||
    analysis.components.some((component) => component.ambiguity_tags.includes("hidden_fats"))
  if (hasCreamySauceAmbiguity(analysis) && !answers.creamy_sauce_type) {
    return {
      key: "creamy_sauce_type",
      prompt: ct(lang, "nutrition.photo.question.creamySauce.prompt"),
      options: [
        { value: "mayo", label: ct(lang, "nutrition.photo.question.creamySauce.mayo") },
        { value: "light", label: ct(lang, "nutrition.photo.question.creamySauce.light") },
        { value: "little", label: ct(lang, "nutrition.photo.question.creamySauce.little") },
        { value: "unknown", label: ct(lang, "nutrition.photo.question.fat.unknown") },
      ],
    }
  }

  if (hasFatAmbiguity && !answers.creamy_sauce_type && !answers.fat_type) {
    return {
      key: "fat_type",
      prompt: ct(lang, "nutrition.photo.question.fat.prompt"),
      options: [
        { value: "none", label: ct(lang, "nutrition.photo.question.fat.none") },
        { value: "oil", label: ct(lang, "nutrition.photo.question.fat.oil") },
        { value: "butter", label: ct(lang, "nutrition.photo.question.fat.butter") },
        { value: "sauce", label: ct(lang, "nutrition.photo.question.fat.sauce") },
        { value: "unknown", label: ct(lang, "nutrition.photo.question.fat.unknown") },
      ],
    }
  }

  if (
    answers.fat_type &&
    !["none", "unknown"].includes(answers.fat_type) &&
    !answers.fat_amount
  ) {
    return {
      key: "fat_amount",
      prompt: ct(lang, "nutrition.photo.question.amount.prompt"),
      options: [
        { value: "traces", label: ct(lang, "nutrition.photo.question.amount.drizzle") },
        { value: "1_tsp", label: ct(lang, "nutrition.photo.question.amount.tsp") },
        { value: "1_tbsp", label: ct(lang, "nutrition.photo.question.amount.tbsp") },
        { value: "2_tbsp_plus", label: ct(lang, "nutrition.photo.question.amount.plus") },
        { value: "unknown", label: ct(lang, "nutrition.photo.question.fat.unknown") },
      ],
    }
  }

  const hasBoneInAmbiguity = analysis.components.some(
    (component) =>
      component.ambiguity_tags.includes("non_edible_parts") ||
      containsHint(component.name_fr, BONE_IN_HINTS),
  )
  if (hasBoneInAmbiguity && !answers.includes_non_edible_parts) {
    return {
      key: "includes_non_edible_parts",
      prompt: ct(lang, "nutrition.photo.question.bones.prompt"),
      options: [
        { value: "yes", label: ct(lang, "nutrition.photo.question.yes") },
        { value: "no", label: ct(lang, "nutrition.photo.question.no") },
      ],
    }
  }

  return null
}
