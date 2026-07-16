import type {
  NutritionSmoothingBucket,
  NutritionSmoothingDirection,
  NutritionSmoothingPlanDayCandidate,
} from '@/lib/nutrition/smoothing/types'

export function resolveSmoothingBucket(targetKcal: number, avgKcal: number, spreadKcal: number): NutritionSmoothingBucket {
  if (spreadKcal <= 0) return 'neutral_day'

  const tolerance = Math.max(50, spreadKcal * 0.15)
  if (targetKcal >= avgKcal + tolerance) return 'protected_day'
  if (targetKcal <= avgKcal - tolerance) return 'absorbent_day'
  return 'neutral_day'
}

export function getBucketWeight(bucket: NutritionSmoothingBucket, direction: NutritionSmoothingDirection): number {
  if (direction === 'surplus') {
    if (bucket === 'protected_day') return 0.75
    if (bucket === 'absorbent_day') return 1.25
    return 1
  }

  if (bucket === 'protected_day') return 1.25
  if (bucket === 'absorbent_day') return 0.75
  return 1
}

export function resolveWeightedBuckets(
  days: NutritionSmoothingPlanDayCandidate[],
  direction: NutritionSmoothingDirection,
): Array<NutritionSmoothingPlanDayCandidate & { bucket: NutritionSmoothingBucket; weight: number }> {
  if (days.length === 0) return []

  const targets = days.map((day) => day.target_kcal)
  const min = Math.min(...targets)
  const max = Math.max(...targets)
  const avg = targets.reduce((sum, value) => sum + value, 0) / targets.length
  const spread = max - min

  return days.map((day) => {
    const bucket = resolveSmoothingBucket(day.target_kcal, avg, spread)
    return {
      ...day,
      bucket,
      weight: getBucketWeight(bucket, direction),
    }
  })
}
