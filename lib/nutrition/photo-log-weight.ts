import type {
  PhotoMealAnalysisSummary,
  PhotoMealFinalComponent,
  PhotoMealNutritionSource,
} from "@/lib/nutrition/photo-log-types"
import {
  applyManualConsumptionAdjustments,
  applyManualQuantityOverrides,
  countManualQuantityHints,
  mergeManualPlateComponents,
  parseManualPlateComponents,
} from "@/lib/nutrition/photo-log-manual"

export interface WeightInterpretationInput {
  analysis: PhotoMealAnalysisSummary
  clarificationAnswers: Record<string, string>
}

export interface WeightInterpretationResult {
  components: PhotoMealFinalComponent[]
  ambiguityTags: string[]
  hasMeasuredWeight: boolean
}

const COOKED_RAW_STARCH_HINTS = ["riz", "pate", "pâtes", "quinoa", "semoule", "couscous"]
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
const EGG_HINTS = ["oeuf", "oeufs", "egg", "eggs"]
const PLANTAIN_HINTS = ["banane plantain", "plantain"]
const CHICKEN_HINTS = ["poulet", "chicken"]
const OIL_HINTS = ["huile", "olive oil", "huile d'olive"]
const SPREAD_HINTS = ["beurre", "margarine", "matiere grasse", "matière grasse", "spread", "tartiner"]
const VITELMA_LIGHT_HINTS = ["vitelma", "omega 3", "oméga 3", "light", "smeren", "tartiner"]
const CREAMY_SALAD_HINTS = [
  "salade",
  "sauce",
  "cremeuse",
  "crémeuse",
  "mayonnaise",
  "mayo",
  "russe",
  "betterave",
  "piemontaise",
  "piémontaise",
  "macedoine",
  "macédoine",
  "coleslaw",
]
const FRESH_FRUIT_HINTS = [
  "fraise",
  "fraises",
  "strawberry",
  "strawberries",
  "framboise",
  "framboises",
  "raspberry",
  "raspberries",
  "myrtille",
  "myrtilles",
  "blueberry",
  "blueberries",
  "mure",
  "mûre",
  "mures",
  "mûres",
  "blackberry",
  "blackberries",
  "banane",
  "banana",
  "pomme",
  "apple",
  "poire",
  "pear",
  "orange",
  "mandarine",
  "clementine",
  "clémentine",
  "kiwi",
  "raisin",
  "grape",
  "ananas",
  "pineapple",
  "mangue",
  "mango",
  "peche",
  "pêche",
  "peach",
]
const NON_FRESH_FRUIT_HINTS = [
  "barre",
  "biscuit",
  "gateau",
  "gâteau",
  "confiture",
  "jus",
  "juice",
  "sauce",
  "compote",
  "sec",
  "seche",
  "sèche",
  "dried",
]

const VITELMA_LIGHT_SPREAD = {
  name_fr: "Vitelma light",
  kcal_per_100g: 360,
  protein_per_100g: 0.1,
  carbs_per_100g: 0.5,
  fat_per_100g: 40,
  fiber_per_100g: 0,
}

function containsHint(name: string, hints: string[]) {
  const normalized = name.toLowerCase()
  return hints.some((hint) => normalized.includes(hint))
}

function normalizeSearchText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .toLowerCase()
}

function includesAnyNormalized(value: string | null | undefined, hints: string[]) {
  const normalized = normalizeSearchText(value)
  return hints.some((hint) => normalized.includes(normalizeSearchText(hint)))
}

function getFreshFruitMacroProfile(component: PhotoMealFinalComponent) {
  const evidence = [
    component.name_fr,
    component.source_note,
    component.catalog_metadata?.canonical_name_fr,
  ].filter(Boolean).join(" ")

  if (includesAnyNormalized(evidence, NON_FRESH_FRUIT_HINTS)) return null
  if (component.category_hint !== "fruits" && !includesAnyNormalized(evidence, FRESH_FRUIT_HINTS)) return null

  if (includesAnyNormalized(evidence, ["fraise", "strawberry"])) {
    return { kcal_per_100g: 33, protein_per_100g: 0.7, carbs_per_100g: 7.7, fat_per_100g: 0.3, fiber_per_100g: 2 }
  }

  if (includesAnyNormalized(evidence, ["framboise", "myrtille", "mure", "mûre", "berry", "berries"])) {
    return { kcal_per_100g: 45, protein_per_100g: 1, carbs_per_100g: 10, fat_per_100g: 0.4, fiber_per_100g: 3 }
  }

  if (includesAnyNormalized(evidence, ["banane", "banana"])) {
    return { kcal_per_100g: 89, protein_per_100g: 1.1, carbs_per_100g: 23, fat_per_100g: 0.3, fiber_per_100g: 2.6 }
  }

  if (includesAnyNormalized(evidence, ["pomme", "apple", "poire", "pear"])) {
    return { kcal_per_100g: 55, protein_per_100g: 0.4, carbs_per_100g: 13, fat_per_100g: 0.2, fiber_per_100g: 2.4 }
  }

  if (includesAnyNormalized(evidence, ["orange", "mandarine", "clementine", "clémentine", "kiwi"])) {
    return { kcal_per_100g: 50, protein_per_100g: 0.9, carbs_per_100g: 11, fat_per_100g: 0.3, fiber_per_100g: 2.2 }
  }

  return { kcal_per_100g: 55, protein_per_100g: 0.8, carbs_per_100g: 13, fat_per_100g: 0.3, fiber_per_100g: 2 }
}

function hasImpossibleFreshFruitMacros(component: PhotoMealFinalComponent) {
  return (
    component.kcal_per_100g > 120 ||
    component.protein_per_100g > 5 ||
    component.fat_per_100g > 3 ||
    component.carbs_per_100g > 30
  )
}

function normalizeFreshFruitMacros(components: PhotoMealFinalComponent[]) {
  return components.map((component) => {
    const trustedSource =
      component.nutrition_source === "label_read" ||
      component.nutrition_source === "user_note" ||
      component.nutrition_source === "clarification" ||
      component.nutrition_source === "manual_addition"
    const fruitProfile = getFreshFruitMacroProfile(component)

    if (!fruitProfile || trustedSource || !hasImpossibleFreshFruitMacros(component)) return component

    return {
      ...component,
      ...fruitProfile,
      category_hint: "fruits",
      nutrition_source: component.nutrition_source === "catalog_fallback" ? "catalog_fallback" : "default",
      component_confidence: Math.max(Number(component.component_confidence ?? 0), 0.76),
      source_note:
        component.source_note ??
        "Densité nutritionnelle corrigée vers un fruit frais simple après incohérence détectée.",
    }
  })
}

function getEggPartMacroProfile(component: PhotoMealFinalComponent) {
  const evidence = [
    component.name_fr,
    component.source_note,
    component.catalog_metadata?.canonical_name_fr,
  ].filter(Boolean).join(" ")
  const normalized = normalizeSearchText(evidence)

  if (
    normalized.includes("blanc d'oeuf") ||
    normalized.includes("blanc d oeuf") ||
    normalized.includes("blanc oeuf") ||
    normalized.includes("egg white")
  ) {
    return {
      name_fr: "Blanc d'oeuf",
      kcal_per_100g: 52,
      protein_per_100g: 10.9,
      carbs_per_100g: 0.7,
      fat_per_100g: 0.2,
      fiber_per_100g: 0,
    }
  }

  if (
    normalized.includes("jaune d'oeuf") ||
    normalized.includes("jaune d oeuf") ||
    normalized.includes("jaune oeuf") ||
    normalized.includes("egg yolk") ||
    normalized.includes("yolk")
  ) {
    return {
      name_fr: "Jaune d'oeuf",
      kcal_per_100g: 322,
      protein_per_100g: 15.9,
      carbs_per_100g: 3.6,
      fat_per_100g: 26.5,
      fiber_per_100g: 0,
    }
  }

  return null
}

function normalizeEggPartMacros(components: PhotoMealFinalComponent[]) {
  return components.map((component) => {
    const profile = getEggPartMacroProfile(component)
    if (!profile) return component

    const trustedSource =
      component.nutrition_source === "label_read" ||
      component.nutrition_source === "user_note" ||
      component.nutrition_source === "clarification" ||
      component.nutrition_source === "manual_addition"

    return {
      ...component,
      ...profile,
      category_hint: "proteins",
      nutrition_source: trustedSource ? component.nutrition_source : "catalog_fallback",
      component_confidence: Math.max(Number(component.component_confidence ?? 0), 0.88),
      source_note:
        component.source_note ??
        "Composition corrigée depuis la partie d'œuf détectée.",
      catalog_metadata: {
        ...(component.catalog_metadata ?? {}),
        reusable: true,
        canonical_name_fr: profile.name_fr,
      },
    }
  })
}

function analysisEvidenceText(analysis: PhotoMealAnalysisSummary) {
  return [
    analysis.manual_detail,
    analysis.vision_notes,
    analysis.product_reference?.brand,
    analysis.product_reference?.name_fr,
    analysis.product_reference?.canonical_name_fr,
    analysis.product_reference?.product_type,
    analysis.product_reference?.evidence,
    ...(analysis.photo_timeline ?? []).map((photo) => photo.evidence),
    ...analysis.components.flatMap((component) => [
      component.name_fr,
      component.rationale,
      component.catalog_metadata?.brand,
      component.catalog_metadata?.canonical_name_fr,
    ]),
  ].filter(Boolean).join(" ")
}

function hasVitelmaLightIngredientEvidence(analysis: PhotoMealAnalysisSummary) {
  const evidence = analysisEvidenceText(analysis)
  const normalized = normalizeSearchText(evidence)
  return (
    normalized.includes("vitelma") ||
    (includesAnyNormalized(evidence, ["light", "omega 3", "oméga 3"]) &&
      includesAnyNormalized(evidence, ["margarine", "beurre", "tartiner", "smeren"]))
  )
}

function isSpreadFatComponent(component: PhotoMealFinalComponent) {
  const name = normalizeSearchText(component.name_fr)
  const note = normalizeSearchText(component.source_note)
  return (
    component.category_hint === "fats" &&
    (
      includesAnyNormalized(name, SPREAD_HINTS) ||
      includesAnyNormalized(note, SPREAD_HINTS) ||
      includesAnyNormalized(name, ["vitelma"]) ||
      Number(component.fat_per_100g ?? 0) >= 35
    )
  )
}

function applyVisibleIngredientPackagingClues({
  analysis,
  components,
}: {
  analysis: PhotoMealAnalysisSummary
  components: PhotoMealFinalComponent[]
}) {
  if (!hasVitelmaLightIngredientEvidence(analysis)) return components

  return components.map((component) => {
    if (!isSpreadFatComponent(component)) return component

    return {
      ...component,
      name_fr: VITELMA_LIGHT_SPREAD.name_fr,
      category_hint: "fats",
      kcal_per_100g: VITELMA_LIGHT_SPREAD.kcal_per_100g,
      protein_per_100g: VITELMA_LIGHT_SPREAD.protein_per_100g,
      carbs_per_100g: VITELMA_LIGHT_SPREAD.carbs_per_100g,
      fat_per_100g: VITELMA_LIGHT_SPREAD.fat_per_100g,
      fiber_per_100g: VITELMA_LIGHT_SPREAD.fiber_per_100g,
      nutrition_source: component.nutrition_source === "label_read" ? "label_read" : "catalog_fallback",
      component_confidence: Math.max(Number(component.component_confidence ?? 0), 0.82),
      source_note:
        component.source_note ??
        "Matière grasse associée au packaging Vitelma light visible.",
      catalog_metadata: {
        ...(component.catalog_metadata ?? {}),
        reusable: true,
        brand: "Vitelma",
        canonical_name_fr: VITELMA_LIGHT_SPREAD.name_fr,
      },
    }
  })
}

function estimateFallbackGrams(component: WeightInterpretationInput["analysis"]["components"][number]) {
  const name = component.name_fr.toLowerCase()
  const unitCount = Number(component.unit_count ?? 0)

  if (containsHint(name, EGG_HINTS)) return unitCount > 0 ? Math.round(unitCount * 55) : 110
  if (containsHint(name, PLANTAIN_HINTS)) return 140
  if (containsHint(name, CHICKEN_HINTS)) return 150
  if (containsHint(name, OIL_HINTS)) return 10

  switch (component.category_hint) {
    case "proteins":
      return 140
    case "carbs":
      return 130
    case "vegetables":
      return 90
    case "fruits":
      return 120
    case "fats":
      return 12
    case "drinks":
      return 250
    case "extras":
    default:
      return 40
  }
}

function mapFatAmountToGrams(value: string) {
  switch (value) {
    case "traces":
      return 3
    case "1_tsp":
      return 5
    case "1_tbsp":
      return 15
    case "2_tbsp_plus":
      return 30
    default:
      return 0
  }
}

function buildFatComponent(fatType: string, amountKey: string): PhotoMealFinalComponent | null {
  const quantity = mapFatAmountToGrams(amountKey)
  if (quantity <= 0) return null

  if (fatType === "oil") {
    return {
      name_fr: "Huile d'olive",
      category_hint: "fats",
      quantity_g: quantity,
      nutrition_source: "clarification",
      component_confidence: 0.88,
      kcal_per_100g: 884,
      protein_per_100g: 0,
      carbs_per_100g: 0,
      fat_per_100g: 100,
      fiber_per_100g: 0,
      source_note: "Ajout estimation matière grasse",
    }
  }

  if (fatType === "butter") {
    return {
      name_fr: "Beurre",
      category_hint: "fats",
      quantity_g: quantity,
      nutrition_source: "clarification",
      component_confidence: 0.88,
      kcal_per_100g: 717,
      protein_per_100g: 0.9,
      carbs_per_100g: 0.1,
      fat_per_100g: 81,
      fiber_per_100g: 0,
      source_note: "Ajout estimation matière grasse",
    }
  }

  if (fatType === "sauce") {
    return {
      name_fr: "Sauce creme",
      category_hint: "extras",
      quantity_g: quantity,
      nutrition_source: "clarification",
      component_confidence: 0.8,
      kcal_per_100g: 220,
      protein_per_100g: 2,
      carbs_per_100g: 6,
      fat_per_100g: 20,
      fiber_per_100g: 0,
      source_note: "Ajout estimation sauce",
    }
  }

  return null
}

function hasCreamySaladEvidence(component: PhotoMealFinalComponent) {
  const evidence = [
    component.name_fr,
    component.source_note,
    component.catalog_metadata?.canonical_name_fr,
  ].filter(Boolean).join(" ")

  return includesAnyNormalized(evidence, CREAMY_SALAD_HINTS)
}

function candidateEvidenceText(component: WeightInterpretationInput["analysis"]["components"][number]) {
  return [
    component.name_fr,
    component.rationale,
    component.catalog_metadata?.brand,
    component.catalog_metadata?.canonical_name_fr,
  ].filter(Boolean).join(" ")
}

function isClearlyDryReadyStarch(component: WeightInterpretationInput["analysis"]["components"][number]) {
  return containsHint(candidateEvidenceText(component), DRY_READY_STARCH_HINTS)
}

function shouldApplyRawStarchConversion(component: WeightInterpretationInput["analysis"]["components"][number]) {
  return (
    component.ambiguity_tags.includes("cooked_vs_raw") &&
    containsHint(component.name_fr, COOKED_RAW_STARCH_HINTS) &&
    !isClearlyDryReadyStarch(component)
  )
}

function applyCreamySauceClarification({
  components,
  sauceType,
}: {
  components: PhotoMealFinalComponent[]
  sauceType: string | undefined
}) {
  if (!sauceType) return components

  const densityByType: Record<string, Pick<PhotoMealFinalComponent, "kcal_per_100g" | "protein_per_100g" | "carbs_per_100g" | "fat_per_100g" | "fiber_per_100g">> = {
    mayo: {
      kcal_per_100g: 170,
      protein_per_100g: 2,
      carbs_per_100g: 11,
      fat_per_100g: 13,
      fiber_per_100g: 2,
    },
    light: {
      kcal_per_100g: 95,
      protein_per_100g: 2.5,
      carbs_per_100g: 13,
      fat_per_100g: 3.5,
      fiber_per_100g: 2,
    },
    little: {
      kcal_per_100g: 80,
      protein_per_100g: 2.5,
      carbs_per_100g: 14,
      fat_per_100g: 2,
      fiber_per_100g: 2,
    },
    unknown: {
      kcal_per_100g: 145,
      protein_per_100g: 2,
      carbs_per_100g: 12,
      fat_per_100g: 10,
      fiber_per_100g: 2,
    },
  }

  const targetDensity = densityByType[sauceType]
  if (!targetDensity) return components

  return components.map((component) => {
    if (!hasCreamySaladEvidence(component)) return component

    return {
      ...component,
      ...targetDensity,
      nutrition_source: sauceType === "unknown" ? "default" : "clarification",
      component_confidence: sauceType === "unknown"
        ? Math.max(Number(component.component_confidence ?? 0), 0.58)
        : Math.max(Number(component.component_confidence ?? 0), 0.82),
      source_note: sauceType === "unknown"
        ? "Sauce crémeuse estimée prudemment faute de précision."
        : "Sauce crémeuse ajustée via clarification.",
    }
  })
}

function hasFatComponent(components: PhotoMealFinalComponent[]) {
  return components.some((component) =>
    component.category_hint === "fats" ||
    containsHint(component.name_fr, OIL_HINTS) ||
    component.fat_per_100g >= 70,
  )
}

function analysisUsesResolvedPortions(analysis: PhotoMealAnalysisSummary) {
  const timeline = analysis.photo_timeline ?? []
  return (
    analysis.leftovers_estimate?.detected === true ||
    timeline.some((photo) => photo.role === "after_meal_leftovers" || photo.role === "separate_weighing")
  )
}

function hasPartialWeightEvidence(component: WeightInterpretationInput["analysis"]["components"][number]) {
  return component.ambiguity_tags.includes("partial_weight")
}

function deriveComponentConfidence(params: {
  nutritionSource: PhotoMealNutritionSource | null | undefined
  quantitySource: PhotoMealFinalComponent["quantity_source"] | null | undefined
  explicitEstimate: boolean
}) {
  const nutritionBase: Record<PhotoMealNutritionSource, number> = {
    label_read: 0.96,
    user_note: 0.94,
    catalog_fallback: 0.82,
    visual_estimate: 0.62,
    clarification: 0.9,
    manual_addition: 0.96,
    default: 0.45,
  }

  const quantityBonus =
    params.quantitySource === "scale" ? 0.02 :
    params.quantitySource === "label" ? 0.02 :
    params.quantitySource === "clarification" ? 0.01 :
    params.quantitySource === "default" ? -0.08 :
    params.explicitEstimate ? 0 : -0.03

  const base = nutritionBase[params.nutritionSource ?? "default"] ?? 0.45
  return Math.max(0, Math.min(1, base + quantityBonus))
}

function buildEggFinalComponent({
  name_fr,
  quantity_g,
}: {
  name_fr: "Blanc d'oeuf" | "Jaune d'oeuf"
  quantity_g: number
}): PhotoMealFinalComponent {
  if (name_fr === "Blanc d'oeuf") {
    return {
      name_fr,
      category_hint: "proteins",
      quantity_g,
      quantity_source: "clarification",
      nutrition_source: "clarification",
      component_confidence: 0.9,
      kcal_per_100g: 52,
      protein_per_100g: 10.9,
      carbs_per_100g: 0.7,
      fat_per_100g: 0.2,
      fiber_per_100g: 0,
      source_note: "Composition d'œufs affinée via la clarification.",
      catalog_metadata: {
        reusable: true,
        canonical_name_fr: name_fr,
      },
    }
  }

  return {
    name_fr,
    category_hint: "proteins",
    quantity_g,
    quantity_source: "clarification",
    nutrition_source: "clarification",
    component_confidence: 0.9,
    kcal_per_100g: 322,
    protein_per_100g: 15.9,
    carbs_per_100g: 3.6,
    fat_per_100g: 26.5,
    fiber_per_100g: 0,
    source_note: "Composition d'œufs affinée via la clarification.",
    catalog_metadata: {
      reusable: true,
      canonical_name_fr: name_fr,
    },
  }
}

export function interpretPhotoMealWeight({
  analysis,
  clarificationAnswers,
}: WeightInterpretationInput): WeightInterpretationResult {
  if (
    analysis.analysis_mode === "packaging" ||
    analysis.analysis_mode === "barcode" ||
    analysis.analysis_mode === "receipt" ||
    analysis.analysis_mode === "hybrid"
  ) {
    return {
      components: normalizeEggPartMacros(analysis.components.map((component) => ({
        ...(function () {
          const hasExplicitGrams = Number(component.grams_estimate ?? 0) > 0
          const hasServingSize = Number(analysis.product_reference?.serving_size_g ?? 0) > 0
          const quantitySource =
            hasPartialWeightEvidence(component)
              ? "scale"
              : hasExplicitGrams
                ? "label"
                : hasServingSize
                  ? "label"
                  : "default"
          const nutritionSource = component.nutrition_source ?? "label_read"
          return {
            quantity_source: quantitySource,
            nutrition_source: nutritionSource,
            component_confidence:
              component.component_confidence ??
              deriveComponentConfidence({
                nutritionSource,
                quantitySource,
                explicitEstimate: hasExplicitGrams,
              }),
          }
        })(),
        name_fr: component.name_fr,
        category_hint: component.category_hint,
        quantity_g: Math.round(
          Math.max(
            0,
            Number(component.grams_estimate ?? 0) ||
              Number(analysis.product_reference?.serving_size_g ?? 0) ||
              100, // P2-3 : fallback 100g explicitement marqué comme default
          ),
        ),
        quantity_unit: component.quantity_unit ?? "g",
        kcal_per_100g: component.kcal_per_100g,
        protein_per_100g: component.protein_per_100g,
        carbs_per_100g: component.carbs_per_100g,
        fat_per_100g: component.fat_per_100g,
        fiber_per_100g: component.fiber_per_100g,
        // P2-3 : si quantité tombait en fallback 100g, source_note explicite pour l'UI
        source_note:
          component.rationale ??
          (hasPartialWeightEvidence(component)
            ? "Quantité consolidée depuis la balance."
            : Number(component.grams_estimate ?? 0) > 0
              ? "Quantité consolidée depuis l'étiquette ou la note."
              : Number(analysis.product_reference?.serving_size_g ?? 0) > 0
                ? "Portion standard lue sur l'emballage."
                : "Quantité estimée à 100 g par défaut — merci de vérifier avant de valider."),
        catalog_metadata: component.catalog_metadata ?? null,
      }))),
      ambiguityTags: [],
      hasMeasuredWeight: false,
    }
  }

  const measuredWeight = analysis.scale_weight_g ?? analysis.manual_weight_g ?? null
  const hasMeasuredWeight = typeof measuredWeight === "number" && measuredWeight > 0
  const manualQuantityHintCount = countManualQuantityHints(analysis.manual_detail)
  const hasStructuredManualBreakdown = manualQuantityHintCount >= 2
  const estimatedGrams = analysis.components.map((component) => {
    const explicitEstimate = Math.max(0, Number(component.grams_estimate ?? 0))
    return explicitEstimate > 0 ? explicitEstimate : estimateFallbackGrams(component)
  })
  const anchoredExplicitTotal =
    hasMeasuredWeight && hasStructuredManualBreakdown
      ? analysis.components.reduce((sum, component) => {
          const explicitEstimate = Math.max(0, Number(component.grams_estimate ?? 0))
          return sum + explicitEstimate
        }, 0)
      : 0
  const unanchoredEstimatedTotal =
    hasMeasuredWeight && hasStructuredManualBreakdown
      ? analysis.components.reduce((sum, component) => {
          const explicitEstimate = Math.max(0, Number(component.grams_estimate ?? 0))
          if (explicitEstimate > 0) return sum
          return sum + estimateFallbackGrams(component)
        }, 0)
      : 0
  const remainingMeasuredWeight =
    hasMeasuredWeight ? Math.max(0, Number(measuredWeight) - anchoredExplicitTotal) : 0
  const shouldGlobalScale =
    hasMeasuredWeight &&
    !analysis.components.some(hasPartialWeightEvidence) &&
    !analysisUsesResolvedPortions(analysis) &&
    !(hasStructuredManualBreakdown && anchoredExplicitTotal > 0)
  const totalEstimated = estimatedGrams.reduce((sum, grams) => sum + grams, 0)
  // P2-1 : cap à 8x pour éviter des quantités aberrantes si l'IA hallucine une quantité très faible
  const SCALE_FACTOR_MAX = 8
  const rawGlobalScaleFactor =
    shouldGlobalScale && totalEstimated > 0 ? Number(measuredWeight) / totalEstimated : 1
  const globalScaleFactor = Math.min(rawGlobalScaleFactor, SCALE_FACTOR_MAX)
  if (rawGlobalScaleFactor > SCALE_FACTOR_MAX) {
    console.warn(`[photo-log-weight] globalScaleFactor capped: ${rawGlobalScaleFactor.toFixed(2)} → ${SCALE_FACTOR_MAX}`)
  }
  const rawResidualScaleFactor =
    hasMeasuredWeight && hasStructuredManualBreakdown && unanchoredEstimatedTotal > 0
      ? remainingMeasuredWeight / unanchoredEstimatedTotal
      : 1
  const residualScaleFactor = Math.min(rawResidualScaleFactor, SCALE_FACTOR_MAX)

  const components = analysis.components.map<PhotoMealFinalComponent>((component, index) => {
    const baseEstimate = estimatedGrams[index] ?? 0
    const explicitEstimate = Math.max(0, Number(component.grams_estimate ?? 0))
    const preserveExplicitUserEstimate = hasStructuredManualBreakdown && explicitEstimate > 0
    let quantity = Math.round(
      Math.max(
        0,
        preserveExplicitUserEstimate
          ? explicitEstimate
          : explicitEstimate > 0
            ? baseEstimate * globalScaleFactor
            : hasMeasuredWeight && hasStructuredManualBreakdown
              ? baseEstimate * residualScaleFactor
              : baseEstimate * globalScaleFactor,
      ),
    )
    let quantitySource: PhotoMealFinalComponent["quantity_source"] =
      preserveExplicitUserEstimate
        ? "user_note"
        : explicitEstimate > 0
          ? hasPartialWeightEvidence(component)
            ? "scale"
            : "visual_estimate"
        : "default"

    const starchState = clarificationAnswers.starch_state
    if (shouldApplyRawStarchConversion(component) && starchState === "raw") {
      quantity = Math.round(quantity * 0.35)
      quantitySource = "clarification"
    }

    const includesNonEdible = clarificationAnswers.includes_non_edible_parts
    const defaultYield =
      component.edible_yield_ratio && component.edible_yield_ratio > 0 && component.edible_yield_ratio <= 1
        ? component.edible_yield_ratio
        : containsHint(component.name_fr, BONE_IN_HINTS)
          ? 0.65
          : 1

    if (includesNonEdible === "yes" && containsHint(component.name_fr, BONE_IN_HINTS)) {
      quantity = Math.round(quantity * defaultYield)
      quantitySource = "clarification"
    }

    return {
      ...(function () {
        const finalQuantitySource =
          hasMeasuredWeight && !hasPartialWeightEvidence(component) && !explicitEstimate
            ? "scale"
            : quantitySource
        const nutritionSource =
          component.nutrition_source ??
          (preserveExplicitUserEstimate
            ? "user_note"
            : explicitEstimate > 0
              ? "visual_estimate"
              : "default")
        return {
          quantity_source: finalQuantitySource,
          nutrition_source: nutritionSource,
          component_confidence:
            component.component_confidence ??
            deriveComponentConfidence({
              nutritionSource,
              quantitySource: finalQuantitySource,
              explicitEstimate: explicitEstimate > 0,
            }),
        }
      })(),
      name_fr: component.name_fr,
      category_hint: component.category_hint,
      quantity_g: quantity,
      quantity_unit: component.quantity_unit ?? "g",
      kcal_per_100g: component.kcal_per_100g,
      protein_per_100g: component.protein_per_100g,
      carbs_per_100g: component.carbs_per_100g,
      fat_per_100g: component.fat_per_100g,
      fiber_per_100g: component.fiber_per_100g,
      source_note:
        component.rationale ??
        (preserveExplicitUserEstimate
          ? "Quantité fournie par l'utilisateur."
          : null) ??
        (hasPartialWeightEvidence(component)
          ? "Quantité issue d'une pesée séparée."
          : hasMeasuredWeight
            ? "Quantité ajustée depuis le poids mesuré."
            : explicitEstimate > 0
              ? "Quantité estimée depuis la photo."
              : "Quantité par défaut à confirmer."),
      catalog_metadata: component.catalog_metadata ?? null,
    }
  })

  const componentsWithManualOverrides = applyManualQuantityOverrides({
    existingComponents: components,
    detail: analysis.manual_detail,
  })

  const eggWhiteExtraG = Number(clarificationAnswers.egg_white_extra_g ?? NaN)
  if (
    !hasMeasuredWeight &&
    !analysis.manual_detail?.trim() &&
    Number.isFinite(eggWhiteExtraG) &&
    analysis.components.length === 1 &&
    containsHint(analysis.components[0]?.name_fr ?? "", EGG_HINTS)
  ) {
    const visibleYolkCount = Math.max(1, Number(analysis.components[0]?.unit_count ?? 1))

    if (eggWhiteExtraG > 0) {
      const clarifiedEggComponents: PhotoMealFinalComponent[] = [
        buildEggFinalComponent({
          name_fr: "Blanc d'oeuf",
          quantity_g: Math.round(eggWhiteExtraG),
        }),
        buildEggFinalComponent({
          name_fr: "Jaune d'oeuf",
          quantity_g: visibleYolkCount * 15,
        }),
      ]

      const fatType = clarificationAnswers.fat_type
      const fatAmount = clarificationAnswers.fat_amount
      if (fatType && fatAmount && fatType !== "none" && fatType !== "unknown") {
        const fatComponent = buildFatComponent(fatType, fatAmount)
        if (fatComponent) clarifiedEggComponents.push(fatComponent)
      }

      return {
        components: clarifiedEggComponents,
        ambiguityTags: analysis.ambiguity_tags,
        hasMeasuredWeight,
      }
    }

    if (eggWhiteExtraG === 0 && components[0]) {
      components[0] = {
        ...components[0],
        quantity_g: visibleYolkCount * 55,
        quantity_source: "clarification",
        nutrition_source: "clarification",
        component_confidence: 0.9,
        source_note: "Composition d'œufs affinée via la clarification.",
      }
    }
  }

  const manualNoteComponents = parseManualPlateComponents(analysis.manual_detail)
  const mergedComponents = mergeManualPlateComponents({
    existingComponents: componentsWithManualOverrides,
    manualComponents: manualNoteComponents,
  })
  const adjustedComponents = applyManualConsumptionAdjustments({
    existingComponents: mergedComponents,
    detail: analysis.manual_detail,
  })
  const componentsWithCreamySauce = applyCreamySauceClarification({
    components: adjustedComponents,
    sauceType: clarificationAnswers.creamy_sauce_type,
  })

  const fatType = clarificationAnswers.fat_type
  const fatAmount = clarificationAnswers.fat_amount
  if (fatType && fatAmount && fatType !== "none" && fatType !== "unknown") {
    const fatComponent = buildFatComponent(fatType, fatAmount)
    if (fatComponent) componentsWithCreamySauce.push(fatComponent)
  } else if (
    fatType === "unknown" &&
    analysis.ambiguity_tags.includes("hidden_fats") &&
    !clarificationAnswers.creamy_sauce_type &&
    !hasFatComponent(componentsWithCreamySauce)
  ) {
    componentsWithCreamySauce.push({
      name_fr: "Matière grasse probable",
      category_hint: "fats",
      quantity_g: 5,
      quantity_source: "default",
      nutrition_source: "default",
      component_confidence: 0.37,
      kcal_per_100g: 884,
      protein_per_100g: 0,
      carbs_per_100g: 0,
      fat_per_100g: 100,
      fiber_per_100g: 0,
      source_note: "Estimation prudente, à supprimer si aucune huile n'a été utilisée",
    })
  }

  const componentsWithIngredientPackagingClues = applyVisibleIngredientPackagingClues({
    analysis,
    components: componentsWithCreamySauce,
  })

  return {
    components: normalizeFreshFruitMacros(normalizeEggPartMacros(componentsWithIngredientPackagingClues)),
    ambiguityTags: analysis.ambiguity_tags,
    hasMeasuredWeight,
  }
}
