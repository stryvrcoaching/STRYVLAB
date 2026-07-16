import { kcalDeltaToMacroAdjustment } from '@/lib/nutrition/smoothing/rules'
import { resolveWeightedBuckets } from '@/lib/nutrition/smoothing/weights'
import type {
  NutritionSmoothingDirection,
  NutritionSmoothingPlanDay,
  NutritionSmoothingPlanDayCandidate,
} from '@/lib/nutrition/smoothing/types'

function reconcileIntegers(values: number[], targetTotal: number): number[] {
  const rounded = values.map((value) => Math.round(value))
  let diff = targetTotal - rounded.reduce((sum, value) => sum + value, 0)
  let index = 0

  while (diff !== 0 && rounded.length > 0) {
    const cursor = index % rounded.length
    rounded[cursor] += diff > 0 ? 1 : -1
    diff += diff > 0 ? -1 : 1
    index += 1
  }

  return rounded
}

export function buildSmoothingPlanDays(args: {
  planId: string
  direction: NutritionSmoothingDirection
  smoothableDeltaKcal: number
  futureDays: NutritionSmoothingPlanDayCandidate[]
}): Omit<NutritionSmoothingPlanDay, 'id' | 'created_at' | 'updated_at'>[] {
  const { planId, direction, futureDays } = args
  if (futureDays.length === 0 || args.smoothableDeltaKcal === 0) return []

  const weighted = resolveWeightedBuckets(futureDays, direction)
  const totalWeight = weighted.reduce((sum, day) => sum + day.weight, 0) || 1
  const absoluteBudget = Math.abs(args.smoothableDeltaKcal)

  const rawDailyKcal = weighted.map((day) => (absoluteBudget * day.weight) / totalWeight)
  const integerDailyKcal = reconcileIntegers(rawDailyKcal, absoluteBudget)

  return weighted.map((day, index) => {
    const signedKcal = direction === 'surplus' ? -integerDailyKcal[index] : integerDailyKcal[index]
    const macros = kcalDeltaToMacroAdjustment(signedKcal)

    return {
      plan_id: planId,
      date: day.date,
      sequence_index: index,
      resolved_bucket: day.bucket,
      source_day_label: day.label ?? null,
      day_weight: day.weight,
      base_target_kcal: Math.round(day.target_kcal),
      cycle_synced_target_kcal: Math.round(day.target_kcal),
      kcal_delta: macros.kcal,
      protein_delta_g: macros.protein_g,
      carbs_delta_g: macros.carbs_g,
      fat_delta_g: macros.fat_g,
      status: 'pending',
    }
  })
}
