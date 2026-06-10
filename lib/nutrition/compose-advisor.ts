import type { FoodItem } from './food-items'
import { buildFoodMetabolicProfile, getDominantMacroProfile, type AdvisorMacroKey } from './food-profile'

type NutritionMacros = {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  water_ml: number
}

export type SuggestedMacroFilled = 'protein' | 'carbs' | 'fat' | 'calories'

export interface SuggestedFoodQuantity {
  grams: number
  macroFilled: SuggestedMacroFilled
  estimatedMacros: {
    calories: number
    protein: number
    carbs: number
    fat: number
  }
  warning?: string
}

export interface ComposeAdvisorSuggestion {
  grams: number
  macro: AdvisorMacroKey
  reason: string
  preview: NutritionMacros
  warning?: string
}

export type FoodCompatibility = {
  status: 'good_fit' | 'acceptable' | 'poor_fit'
  reasons: string[]
  suggestedAlternatives?: FoodItem[]
}

function roundToStep(value: number, step = 5): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.max(step, Math.round(value / step) * step)
}

function clampGrams(value: number, min = 25, max = 500): number {
  return Math.min(max, Math.max(min, value))
}

function toEstimated(item: FoodItem, grams: number) {
  const factor = grams / 100
  const protein = Math.round(item.protein_per_100g * factor * 10) / 10
  const carbs = Math.round(item.carbs_per_100g * factor * 10) / 10
  const fat = Math.round(item.fat_per_100g * factor * 10) / 10
  const calories = Math.round(item.kcal_per_100g * factor)
  return { calories, protein, carbs, fat }
}

export function isCompletionMode(
  remaining: Pick<{ protein_g: number; carbs_g: number; fat_g: number }, 'protein_g' | 'carbs_g' | 'fat_g'>,
): boolean {
  // Fat threshold is higher (40g) because fat is 9 kcal/g — 33g fat = 297 kcal still = end of day
  const allSmall = remaining.protein_g < 30 && remaining.carbs_g < 30 && remaining.fat_g < 40
  const totalKcal = remaining.protein_g * 4 + remaining.carbs_g * 4 + remaining.fat_g * 9
  return allSmall && totalKcal < 200
}

function getMealFraction(
  remaining: Pick<{ protein_g: number; carbs_g: number; fat_g: number }, 'protein_g' | 'carbs_g' | 'fat_g'>,
): number {
  return isCompletionMode(remaining) ? 0.80 : 0.40
}

export function suggestFoodQuantity({
  food,
  remainingTargets,
  priorityMacro,
  applyMealFraction = false,
}: {
  food: FoodItem
  remainingTargets: Pick<NutritionMacros, 'protein_g' | 'carbs_g' | 'fat_g'>
  priorityMacro?: AdvisorMacroKey
  applyMealFraction?: boolean
}): SuggestedFoodQuantity | null {
  const foodProfile = buildFoodMetabolicProfile(food)
  const resolvedPriority = priorityMacro ?? getDominantMacroProfile(food)
  if (!resolvedPriority) return null

  const densityByMacro = {
    protein: food.protein_per_100g,
    carbs: food.carbs_per_100g,
    fat: food.fat_per_100g,
  } as const

  const fraction = applyMealFraction ? getMealFraction(remainingTargets) : 1.0
  const completion = applyMealFraction && isCompletionMode(remainingTargets)

  const remainingByMacro = {
    protein: remainingTargets.protein_g * fraction,
    carbs: remainingTargets.carbs_g * fraction,
    fat: remainingTargets.fat_g * fraction,
  } as const

  // Completion mode: min-grams across non-zero macros to avoid any overflow
  if (completion) {
    const options: Array<{ rawG: number; macro: AdvisorMacroKey }> = []
    if (densityByMacro.protein > 0 && remainingByMacro.protein > 0)
      options.push({ rawG: (remainingByMacro.protein / densityByMacro.protein) * 100, macro: 'protein' })
    if (densityByMacro.carbs > 0 && remainingByMacro.carbs > 0)
      options.push({ rawG: (remainingByMacro.carbs / densityByMacro.carbs) * 100, macro: 'carbs' })
    if (densityByMacro.fat > 0 && remainingByMacro.fat > 0)
      options.push({ rawG: (remainingByMacro.fat / densityByMacro.fat) * 100, macro: 'fat' })
    if (options.length === 0) return null
    const best = options.reduce((a, b) => (a.rawG <= b.rawG ? a : b))
    const tooSmall = best.rawG < foodProfile.minPortionG
    const grams = roundToStep(clampGrams(best.rawG, foodProfile.minPortionG, foodProfile.maxPortionG))
    const estimated = toEstimated(food, grams)
    const bounded = best.rawG > foodProfile.maxPortionG
    return {
      grams,
      macroFilled: best.macro,
      estimatedMacros: estimated,
      warning: tooSmall
        ? "Ton repas couvre bien les besoins — ajout optionnel."
        : bounded
          ? "Portion plafonnee pour rester realiste sur cet aliment."
          : undefined,
    }
  }

  // Normal mode: fill dominant macro with fraction cap
  let macroToFill: AdvisorMacroKey | null = resolvedPriority
  if (remainingByMacro[macroToFill] <= 0 || densityByMacro[macroToFill] <= 0) {
    const fallback = (['protein', 'carbs', 'fat'] as const)
      .filter(m => remainingByMacro[m] > 0 && densityByMacro[m] > 0)
      .sort((a, b) => remainingByMacro[b] * densityByMacro[b] - remainingByMacro[a] * densityByMacro[a])[0]
    macroToFill = fallback ?? null
  }

  if (!macroToFill) return null

  const rawGrams = (remainingByMacro[macroToFill] / densityByMacro[macroToFill]) * 100
  const grams = roundToStep(clampGrams(rawGrams, foodProfile.minPortionG, foodProfile.maxPortionG))
  const estimated = toEstimated(food, grams)

  let warning: string | undefined
  if (rawGrams > foodProfile.maxPortionG) {
    warning = "Portion plafonnee pour rester realiste sur cet aliment."
  } else if (remainingTargets.fat_g <= 0 && estimated.fat >= 8) {
    warning = "Cet aliment ajoute des lipides alors qu'ils sont deja couverts."
  } else if (remainingTargets.carbs_g <= 0 && estimated.carbs >= 12) {
    warning = 'Cet aliment ajoute des glucides alors que cet objectif est deja couvert.'
  }

  return { grams, macroFilled: macroToFill, estimatedMacros: estimated, warning }
}

export function evaluateFoodCompatibility({
  food,
  remainingTargets,
  alternativesPool,
}: {
  food: FoodItem
  remainingTargets: Pick<NutritionMacros, 'protein_g' | 'carbs_g' | 'fat_g'>
  alternativesPool?: FoodItem[]
}): FoodCompatibility {
  const reasons: string[] = []
  let score = 0
  const profile = buildFoodMetabolicProfile(food)

  const highFat = food.fat_per_100g >= 12 || profile.dominantMacro === 'fat'
  const highCarb = food.carbs_per_100g >= 18 || profile.dominantMacro === 'carbs'
  const highProtein = food.protein_per_100g >= 18 || profile.dominantMacro === 'protein'

  if (remainingTargets.fat_g <= 0 && highFat) {
    score -= 2
    reasons.push("Risque d'ajouter trop de lipides pour le reste de la journee.")
  }
  if (remainingTargets.carbs_g <= 0 && highCarb) {
    score -= 2
    reasons.push("Risque d'ajouter trop de glucides dans le contexte actuel.")
  }
  const fatAlreadyCovered = remainingTargets.fat_g <= 0
  const carbsAlreadyCovered = remainingTargets.carbs_g <= 0

  if (remainingTargets.protein_g > 0 && highProtein && !fatAlreadyCovered && !carbsAlreadyCovered) {
    score += 1
    reasons.push('Bon potentiel pour completer les proteines.')
  }
  if (remainingTargets.protein_g <= 0 && highProtein) {
    score -= 1
  }

  let status: FoodCompatibility['status'] = 'acceptable'
  if (score >= 1) status = 'good_fit'
  if (score <= -1) status = 'poor_fit'

  let suggestedAlternatives: FoodItem[] | undefined
  if (status === 'poor_fit' && alternativesPool?.length) {
    suggestedAlternatives = alternativesPool
      .filter(a => a.id !== food.id)
      .filter(a => {
        if (remainingTargets.fat_g <= 0 && a.fat_per_100g > food.fat_per_100g) return false
        if (remainingTargets.carbs_g <= 0 && a.carbs_per_100g > food.carbs_per_100g) return false
        return a.protein_per_100g >= 10
      })
      .sort((a, b) => b.protein_per_100g - a.protein_per_100g)
      .slice(0, 4)
  }

  if (!reasons.length) {
    reasons.push("Cet aliment peut s'integrer, on ajuste juste la portion.")
  }

  return { status, reasons, suggestedAlternatives }
}

export function suggestQuantityForItem(
  item: FoodItem,
  remaining: Pick<NutritionMacros, 'protein_g' | 'carbs_g' | 'fat_g'>,
): ComposeAdvisorSuggestion | null {
  const next = suggestFoodQuantity({ food: item, remainingTargets: remaining, applyMealFraction: true })
  if (!next) return null

  const label = next.macroFilled === 'protein'
    ? 'proteines'
    : next.macroFilled === 'carbs'
      ? 'glucides'
      : 'lipides'

  return {
    grams: next.grams,
    macro: next.macroFilled === 'calories' ? 'protein' : next.macroFilled,
    reason: `Cet aliment repond surtout au manque de ${label} du jour.`,
    warning: next.warning,
    preview: {
      kcal: next.estimatedMacros.calories,
      protein_g: next.estimatedMacros.protein,
      carbs_g: next.estimatedMacros.carbs,
      fat_g: next.estimatedMacros.fat,
      water_ml: 0,
    },
  }
}
