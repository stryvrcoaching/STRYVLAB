import type { NutritionMacros } from '@/components/client/smart/SmartNutritionWidget'

export type RemainingNutritionTargets = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

type RemainingNutritionTargetsInput = {
  dailyTargets: Pick<NutritionMacros, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>
  consumedToday: Pick<NutritionMacros, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>
}

/**
 * Returns raw deltas (target - consumed), including negative values when a macro is exceeded.
 */
export function getRemainingNutritionTargets({
  dailyTargets,
  consumedToday,
}: RemainingNutritionTargetsInput): RemainingNutritionTargets {
  return {
    calories: round1(dailyTargets.kcal - consumedToday.kcal),
    protein: round1(dailyTargets.protein_g - consumedToday.protein_g),
    carbs: round1(dailyTargets.carbs_g - consumedToday.carbs_g),
    fat: round1(dailyTargets.fat_g - consumedToday.fat_g),
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
