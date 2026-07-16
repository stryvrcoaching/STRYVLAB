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

const MACRO_ENERGY = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const

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

function scaleRemainingTarget(value: number, fraction: number): number {
  return value > 0 ? value * fraction : value
}

function getOverflowPenaltyMultiplier(remainingBefore: number): number {
  if (remainingBefore <= 0) return 0.8
  if (remainingBefore <= 10) return 1.25
  if (remainingBefore <= 20) return 1.15
  return 1.05
}

function getMacroValue(
  estimated: ReturnType<typeof toEstimated>,
  macro: AdvisorMacroKey,
): number {
  if (macro === 'protein') return estimated.protein
  if (macro === 'carbs') return estimated.carbs
  return estimated.fat
}

function evaluateCandidateScore({
  remainingTargets,
  estimated,
  priorityMacro,
}: {
  remainingTargets: Pick<NutritionMacros, 'protein_g' | 'carbs_g' | 'fat_g'>
  estimated: ReturnType<typeof toEstimated>
  priorityMacro?: AdvisorMacroKey
}) {
  const macroMap = {
    protein: remainingTargets.protein_g,
    carbs: remainingTargets.carbs_g,
    fat: remainingTargets.fat_g,
  } as const

  let benefit = 0
  let harm = 0
  const covered = { protein: 0, carbs: 0, fat: 0 }
  const addedOverflow = { protein: 0, carbs: 0, fat: 0 }

  for (const macro of ['protein', 'carbs', 'fat'] as const) {
    const remainingBefore = macroMap[macro]
    const intake = getMacroValue(estimated, macro)
    const deficitBefore = Math.max(remainingBefore, 0)
    const deficitAfter = Math.max(remainingBefore - intake, 0)
    const overflowBefore = Math.max(-remainingBefore, 0)
    const overflowAfter = Math.max(-(remainingBefore - intake), 0)
    const coveredAmount = deficitBefore - deficitAfter
    const overflowAdded = overflowAfter - overflowBefore
    const rewardMultiplier = priorityMacro === macro ? 1.1 : 1
    const penaltyMultiplier = getOverflowPenaltyMultiplier(remainingBefore)
    const energy = MACRO_ENERGY[macro]

    covered[macro] = coveredAmount
    addedOverflow[macro] = overflowAdded
    benefit += coveredAmount * energy * rewardMultiplier
    harm += overflowAdded * energy * penaltyMultiplier
  }

  return {
    covered,
    addedOverflow,
    benefit,
    harm,
    score: benefit - harm,
  }
}

function getPrimaryCoveredMacro(covered: Record<AdvisorMacroKey, number>): AdvisorMacroKey | null {
  return (['protein', 'carbs', 'fat'] as const)
    .filter(macro => covered[macro] > 0)
    .sort((a, b) => {
      const energyDelta = covered[b] * MACRO_ENERGY[b] - covered[a] * MACRO_ENERGY[a]
      if (energyDelta !== 0) return energyDelta
      return covered[b] - covered[a]
    })[0] ?? null
}

function getCoveredMacroConflictWarning(
  remainingTargets: Pick<NutritionMacros, 'protein_g' | 'carbs_g' | 'fat_g'>,
  estimated: ReturnType<typeof toEstimated>,
): string | undefined {
  if (remainingTargets.fat_g <= 0 && estimated.fat >= 8) {
    return "Cet aliment ajoute des lipides alors qu'ils sont deja couverts."
  }
  if (remainingTargets.carbs_g <= 0 && estimated.carbs >= 12) {
    return 'Cet aliment ajoute des glucides alors que cet objectif est deja couvert.'
  }
  return undefined
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
  const fraction = applyMealFraction ? getMealFraction(remainingTargets) : 1.0
  const adjustedRemainingTargets = {
    protein_g: scaleRemainingTarget(remainingTargets.protein_g, fraction),
    carbs_g: scaleRemainingTarget(remainingTargets.carbs_g, fraction),
    fat_g: scaleRemainingTarget(remainingTargets.fat_g, fraction),
  } as const
  const resolvedPriority = priorityMacro ?? getDominantMacroProfile(food) ?? undefined
  const end = Math.max(5, roundToStep(foodProfile.maxPortionG))

  let best:
    | {
        grams: number
        estimated: ReturnType<typeof toEstimated>
        evaluation: ReturnType<typeof evaluateCandidateScore>
      }
    | null = null

  for (let grams = 0; grams <= end; grams += 5) {
    const estimated = toEstimated(food, grams)
    const evaluation = evaluateCandidateScore({
      remainingTargets: adjustedRemainingTargets,
      estimated,
      priorityMacro: resolvedPriority,
    })

    if (
      !best ||
      evaluation.score > best.evaluation.score ||
      (
        evaluation.score === best.evaluation.score &&
        evaluation.harm < best.evaluation.harm
      ) ||
      (
        evaluation.score === best.evaluation.score &&
        evaluation.harm === best.evaluation.harm &&
        evaluation.benefit > best.evaluation.benefit
      )
    ) {
      best = { grams, estimated, evaluation }
    }
  }

  if (!best || best.grams <= 0 || best.evaluation.score <= 0 || best.evaluation.benefit <= 0) {
    return null
  }

  const macroFilled = getPrimaryCoveredMacro(best.evaluation.covered)
  if (!macroFilled) return null

  let warning = getCoveredMacroConflictWarning(remainingTargets, best.estimated)
  if (!warning) {
    const overflowMacro = (['protein', 'carbs', 'fat'] as const).find(macro => {
      if (best.evaluation.addedOverflow[macro] <= 0) return false
      if (macro !== macroFilled) return true
      const remainingForMacro = macro === 'protein'
        ? remainingTargets.protein_g
        : macro === 'carbs'
          ? remainingTargets.carbs_g
          : remainingTargets.fat_g
      return remainingForMacro <= 0
    })
    if (overflowMacro) {
      const labels = {
        protein: 'proteines',
        carbs: 'glucides',
        fat: 'lipides',
      } as const
      warning = `Cette portion aide surtout pour le reste, mais ajoute aussi un peu de ${labels[overflowMacro]}.`
    } else if (best.grams < foodProfile.minPortionG) {
      warning = "Ton repas couvre bien les besoins — ajout optionnel."
    }
  }

  return { grams: best.grams, macroFilled, estimatedMacros: best.estimated, warning }
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
  if (!next) {
    const dominant = getDominantMacroProfile(item) ?? 'protein'
    return {
      grams: 0,
      macro: dominant,
      reason: "Cet aliment n'aide pas assez les besoins restants sans aggraver les macros deja couverts.",
      warning: "Mieux vaut choisir un aliment qui cible davantage les macros encore manquants.",
      preview: {
        kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        water_ml: 0,
      },
    }
  }

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
