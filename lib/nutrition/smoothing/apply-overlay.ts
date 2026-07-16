import type {
  NutritionSmoothingOverlaySummary,
  NutritionSmoothingPlanDay,
  NutritionTargetLike,
} from '@/lib/nutrition/smoothing/types'

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function summarizeSmoothingOverlay(days: Pick<
  NutritionSmoothingPlanDay,
  'plan_id' | 'kcal_delta' | 'protein_delta_g' | 'carbs_delta_g' | 'fat_delta_g'
>[]): NutritionSmoothingOverlaySummary {
  const uniquePlanIds = [...new Set(days.map((day) => day.plan_id))]
  return {
    totalKcalDelta: days.reduce((sum, day) => sum + Math.round(day.kcal_delta), 0),
    totalProteinDeltaG: round1(days.reduce((sum, day) => sum + Number(day.protein_delta_g ?? 0), 0)),
    totalCarbsDeltaG: round1(days.reduce((sum, day) => sum + Number(day.carbs_delta_g ?? 0), 0)),
    totalFatDeltaG: round1(days.reduce((sum, day) => sum + Number(day.fat_delta_g ?? 0), 0)),
    dayCount: days.length,
    planIds: uniquePlanIds,
  }
}

export function applySmoothingOverlay(
  target: NutritionTargetLike,
  days: Pick<NutritionSmoothingPlanDay, 'plan_id' | 'kcal_delta' | 'protein_delta_g' | 'carbs_delta_g' | 'fat_delta_g'>[],
): { target: NutritionTargetLike; overlay: NutritionSmoothingOverlaySummary } {
  const overlay = summarizeSmoothingOverlay(days)
  return {
    target: {
      ...target,
      kcal: Math.max(0, target.kcal + overlay.totalKcalDelta),
      protein_g: Math.max(0, round1(target.protein_g + overlay.totalProteinDeltaG)),
      carbs_g: Math.max(0, round1(target.carbs_g + overlay.totalCarbsDeltaG)),
      fat_g: Math.max(0, round1(target.fat_g + overlay.totalFatDeltaG)),
    },
    overlay,
  }
}
