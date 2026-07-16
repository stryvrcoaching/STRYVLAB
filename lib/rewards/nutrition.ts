import { nutritionPointsForAdherence } from './progression'

export type NutritionMacros = {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

function metricScore(actual: number, target: number) {
  if (!Number.isFinite(target) || target <= 0) return null
  const distance = Math.abs(actual - target) / target
  if (distance <= 0.05) return 1
  return Math.max(0, 1 - ((distance - 0.05) / 0.45))
}

/**
 * Scores one nutrition day against the targets actually shared by the coach.
 * A day outside the tolerance corridors simply earns fewer points; it never
 * creates a negative balance.
 */
export function scoreNutritionDay(target: NutritionMacros, consumed: NutritionMacros) {
  const metrics = [
    { score: metricScore(consumed.calories, target.calories), weight: 0.4 },
    { score: metricScore(consumed.protein_g, target.protein_g), weight: 0.3 },
    { score: metricScore(consumed.carbs_g, target.carbs_g), weight: 0.15 },
    { score: metricScore(consumed.fat_g, target.fat_g), weight: 0.15 },
  ].filter((metric): metric is { score: number; weight: number } => metric.score !== null)

  if (!metrics.length) return null
  const weight = metrics.reduce((sum, metric) => sum + metric.weight, 0)
  const adherence = metrics.reduce((sum, metric) => sum + metric.score * metric.weight, 0) / weight
  return { adherence, points: nutritionPointsForAdherence(adherence) }
}
