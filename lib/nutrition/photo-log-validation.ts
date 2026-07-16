import type { PhotoMealAnalysisMode, PhotoMealAnalysisSummary, PhotoMealFinalComponent, PhotoMealFinalResult } from "@/lib/nutrition/photo-log-types"
import { isMacroEnergyIncoherent } from "@/lib/nutrition/photo-log-nutrition-consistency"
import { ct, type ClientLang } from "@/lib/i18n/clientTranslations"

export interface PhotoMealValidationSummary {
  issues: string[]
  totals: {
    total_calories: number
    total_protein_g: number
    total_carbs_g: number
    total_fat_g: number
    total_fiber_g: number
  }
}

export function computePhotoMealTotals(components: PhotoMealFinalComponent[]) {
  return components.reduce(
    (totals, component) => {
      const factor = Number(component.quantity_g ?? 0) / 100
      totals.total_calories += Number(component.kcal_per_100g ?? 0) * factor
      totals.total_protein_g += Number(component.protein_per_100g ?? 0) * factor
      totals.total_carbs_g += Number(component.carbs_per_100g ?? 0) * factor
      totals.total_fat_g += Number(component.fat_per_100g ?? 0) * factor
      totals.total_fiber_g += Number(component.fiber_per_100g ?? 0) * factor
      return totals
    },
    {
      total_calories: 0,
      total_protein_g: 0,
      total_carbs_g: 0,
      total_fat_g: 0,
      total_fiber_g: 0,
    },
  )
}

function hasOnlyZeroMacros(totals: ReturnType<typeof computePhotoMealTotals>) {
  return (
    totals.total_calories <= 0 &&
    totals.total_protein_g <= 0 &&
    totals.total_carbs_g <= 0 &&
    totals.total_fat_g <= 0
  )
}

function hasHardMacroFailureIssue(issues: string[]) {
  return issues.some((issue) =>
    issue.includes("0 kcal") ||
    issue.includes("incohérentes"),
  )
}

function normalizedName(component: PhotoMealFinalComponent) {
  return String(component.name_fr ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function hasGenericFoodIdentity(component: PhotoMealFinalComponent) {
  if (component.catalog_metadata?.canonical_name_fr?.trim()) return false
  const name = normalizedName(component).replace(/\s+/g, " ").trim()
  return [
    "aliment",
    "aliment inconnu",
    "ingredient",
    "ingredient inconnu",
    "viande",
    "viande crue",
    "proteine",
    "proteine animale",
    "feculent",
    "accompagnement",
    "plat",
    "repas",
  ].includes(name)
}

function normalizedTokens(value: string | null | undefined) {
  return normalizedName({ name_fr: String(value ?? "") } as PhotoMealFinalComponent)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
}

function tokenOverlap(left: string | null | undefined, right: string | null | undefined) {
  const leftTokens = new Set(normalizedTokens(left))
  const rightTokens = normalizedTokens(right)
  return rightTokens.some((token) => leftTokens.has(token))
}

function gramValues(value: string | null | undefined) {
  return [...String(value ?? "").matchAll(/(\d+(?:[.,]\d+)?)\s*g\b/gi)]
    .map((match) => Number(String(match[1]).replace(",", ".")))
    .filter((amount) => Number.isFinite(amount) && amount > 0)
}

export function validatePhotoMealAnalysisEvidence(
  analysis: PhotoMealAnalysisSummary,
  lang: ClientLang = "fr",
) {
  const issues: string[] = []
  const readings = (analysis.scale_readings ?? []).filter(
    (reading) => Number(reading.grams) > 0 && Number(reading.confidence) >= 0.55,
  )
  const componentReadings = readings.filter((reading) => reading.scope === "component")
  const mealTotal = readings
    .filter((reading) => reading.scope === "meal_total")
    .sort((left, right) => right.confidence - left.confidence)[0]
  const componentReadingSum = componentReadings.reduce((sum, reading) => sum + reading.grams, 0)
  const knownAmounts = [
    ...readings.map((reading) => reading.grams),
    ...analysis.components.map((component) => Number(component.grams_estimate)),
    Number(analysis.leftovers_estimate?.grams_estimate ?? 0),
  ].filter((amount) => amount > 0)

  if (mealTotal && componentReadings.length >= 2 && componentReadingSum > mealTotal.grams * 1.05 + 5) {
    issues.push(ct(lang, "nutrition.photo.validation.scaleConflict"))
  }

  const hasUnexplainedRationaleWeight = analysis.components.some((component) =>
    gramValues(component.rationale).some((amount) =>
      !knownAmounts.some((knownAmount) => Math.abs(knownAmount - amount) <= 2),
    ),
  )
  if (hasUnexplainedRationaleWeight) issues.push(ct(lang, "nutrition.photo.validation.scaleConflict"))

  const hasTimelineContradiction =
    analysis.photo_timeline?.some((photo) => photo.role === "after_meal_leftovers") &&
    analysis.leftovers_estimate?.detected === false
  if (hasTimelineContradiction) issues.push(ct(lang, "nutrition.photo.validation.timelineConflict"))

  const hasSuspiciousDifference = analysis.components.some((component) => {
    const rationale = normalizedName({ name_fr: component.rationale ?? "" } as PhotoMealFinalComponent)
    return (
      component.category_hint === "proteins" &&
      Number(component.grams_estimate) <= 20 &&
      Number(component.component_confidence ?? 0) < 0.7 &&
      rationale.includes("difference de poids")
    )
  })
  if (hasSuspiciousDifference) issues.push(ct(lang, "nutrition.photo.validation.derivedQuantity"))

  const leftovers = analysis.leftovers_estimate
  if (
    leftovers?.detected &&
    Number(leftovers.grams_estimate) > 0 &&
    Number(leftovers.confidence) >= 0.75 &&
    leftovers.rationale
  ) {
    const unapplied = analysis.components.some((component) => {
      if (!tokenOverlap(leftovers.rationale, component.name_fr)) return false
      const reading = componentReadings.find((candidate) => tokenOverlap(candidate.food_name, component.name_fr))
      return reading ? Math.abs(Number(component.grams_estimate) - Number(reading.grams)) <= 2 : false
    })
    if (unapplied) issues.push(ct(lang, "nutrition.photo.validation.leftoversUnapplied"))
  }

  return Array.from(new Set(issues))
}

function isNaturallyLowEnergyAllowed(component: PhotoMealFinalComponent) {
  const name = normalizedName(component)
  return (
    component.category_hint === "fruits" ||
    component.category_hint === "vegetables" ||
    component.category_hint === "extras" ||
    // Fruits spécifiques
    name.includes("fraise") ||
    name.includes("framboise") ||
    name.includes("myrtille") ||
    name.includes("fruit") ||
    name.includes("tomate") ||
    name.includes("sauce") ||
    name.includes("legume") ||
    name.includes("salade") ||
    name.includes("courgette") ||
    name.includes("concombre") ||
    name.includes("poivron") ||
    name.includes("oignon") ||
    // M3 : Produits laitiers / protéinés naturellement faibles (yaourts nature ~60 kcal, fromage blanc maigre ~45 kcal)
    name.includes("yaourt") ||
    name.includes("yogurt") ||
    name.includes("skyr") ||
    name.includes("fromage blanc") ||
    name.includes("faisselle") ||
    name.includes("kefir") ||
    name.includes("lait") ||
    // M3 : Légumineuses cuites (~80-110 kcal/100g, jamais rejetées comme carbs)
    name.includes("lentille") ||
    name.includes("pois chiche") ||
    name.includes("haricot") ||
    name.includes("flageolet") ||
    name.includes("edamame") ||
    // M3 : Compotes et purées de fruits (~55 kcal/100g)
    name.includes("compote") ||
    name.includes("puree") ||
    name.includes("puree de fruit") ||
    // M3 : Produits light / allégés légitimement bas en calories
    name.includes("light") ||
    name.includes("allegee") ||
    name.includes("maigre")
  )
}

function isLikelyImpossibleEnergyDensity(component: PhotoMealFinalComponent, analysisMode?: PhotoMealAnalysisMode | null) {
  const kcalPer100g = Number(component.kcal_per_100g ?? 0)
  if (kcalPer100g <= 0) return true

  const isProductMode = analysisMode === "packaging" || analysisMode === "barcode" || analysisMode === "receipt" || analysisMode === "hybrid"

  // M3 : seuil abaissé de 60→45 pour éviter les faux positifs sur les produits light légitimes
  // Les yaourts nature (~60 kcal), compotes (~55 kcal), skyr (~65 kcal) ne doivent pas être rejetés
  if (
    isProductMode &&
    component.category_hint !== "drinks" &&
    !isNaturallyLowEnergyAllowed(component) &&
    kcalPer100g < 45
  ) {
    return true
  }

  // M3 : les légumineuses sont des carbs mais peuvent être à 80-110 kcal/100g cuitées
  if (component.category_hint === "carbs" && kcalPer100g < 45 && !isNaturallyLowEnergyAllowed(component)) {
    return true
  }

  // M3 : assouplir la règle fats < 300 : les sauces légères (yaourt, fromage blanc) sont legit < 300
  // On ne rejette que si vraiment invraisemblable (<100 kcal/100g) pour un composant lipidique pur
  if (isProductMode && component.category_hint === "fats" && kcalPer100g < 100) {
    const name = normalizedName(component)
    // Les sauces à base de laitage peuvent être à 60-150 kcal/100g — ne pas rejeter
    const isCreamyDairy =
      name.includes("yaourt") || name.includes("fromage") ||
      name.includes("creme") || name.includes("sauce") ||
      name.includes("light") || name.includes("allegee")
    if (!isCreamyDairy) return true
  }

  return false
}

function hasMacroEnergyMismatch(component: PhotoMealFinalComponent, analysisMode?: PhotoMealAnalysisMode | null) {
  const isProductMode = analysisMode === "packaging" || analysisMode === "barcode" || analysisMode === "receipt" || analysisMode === "hybrid"
  const isTrustedNutritionSource =
    component.nutrition_source === "label_read" ||
    component.nutrition_source === "catalog_fallback" ||
    component.nutrition_source === "user_note" ||
    component.quantity_source === "label" ||
    component.quantity_source === "user_note"

  if (!isProductMode && !isTrustedNutritionSource) {
    return false
  }

  return isMacroEnergyIncoherent(component, {
    lowRatio: 0.78,
    highRatio: 1.22,
    absoluteToleranceKcal: 30,
  })
}

export function validatePhotoMealResult(
  result: Pick<PhotoMealFinalResult, "analysis_mode" | "components">,
  lang: ClientLang = "fr",
): PhotoMealValidationSummary {
  const issues: string[] = []
  const totals = computePhotoMealTotals(result.components)

  if (result.components.length === 0) {
    issues.push(ct(lang, "nutrition.photo.validation.noFood"))
  }

  if (result.components.some((component) => Number(component.quantity_g ?? 0) <= 0)) {
    issues.push(ct(lang, "nutrition.photo.validation.invalidQuantity"))
  }

  if (result.components.length > 0 && hasOnlyZeroMacros(totals)) {
    issues.push(ct(lang, "nutrition.photo.validation.zeroKcal"))
  }

  if (result.components.some((component) => isLikelyImpossibleEnergyDensity(component, result.analysis_mode ?? null))) {
    issues.push(ct(lang, "nutrition.photo.validation.detectedMismatch"))
  }

  if (result.components.some((component) => hasMacroEnergyMismatch(component, result.analysis_mode ?? null))) {
    issues.push(ct(lang, "nutrition.photo.validation.macroMismatch"))
  }

  if (result.components.some(hasGenericFoodIdentity)) {
    issues.push(ct(lang, "nutrition.photo.validation.genericIdentity"))
  }

  return {
    issues: Array.from(new Set(issues)),
    totals,
  }
}

export { hasHardMacroFailureIssue }
