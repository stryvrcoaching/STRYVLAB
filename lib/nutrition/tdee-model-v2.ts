import { filterWeightOutliers, type WeightSample } from '@/lib/nutrition/adaptiveTdee'
import type { TdeeEstimationStatus } from '@/lib/nutrition/tdee-quality'

export interface TdeeDailyIntake {
  date: string
  kcal: number
  complete: boolean
}

export interface TdeeModelV2Input {
  weightSamples: WeightSample[]
  dailyIntakes: TdeeDailyIntake[]
  fallbackIntakeKcal: number
  windowDays: number
  contextChanged: boolean
}

export interface TdeeModelV2Result {
  estimate: number
  lower: number
  upper: number
  slopeKgPerDay: number
  weightDeltaKg: number
  avgIntakeKcal: number
  completeDays: number
  weightSamplesUsed: number
  outlierCount: number
  status: TdeeEstimationStatus
  confidenceScore: number
  reasons: string[]
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1))
}

function dateOffset(date: string, origin: string) {
  return (new Date(date).getTime() - new Date(origin).getTime()) / 86_400_000
}

export function theilSenSlope(samples: WeightSample[]) {
  const sorted = [...samples].sort((left, right) => left.date.localeCompare(right.date))
  const slopes: number[] = []

  for (let left = 0; left < sorted.length - 1; left += 1) {
    for (let right = left + 1; right < sorted.length; right += 1) {
      const days = dateOffset(sorted[right].date, sorted[left].date)
      if (days > 0) slopes.push((sorted[right].weight_kg - sorted[left].weight_kg) / days)
    }
  }

  return slopes.length > 0 ? median(slopes) : 0
}

function roundTo10(value: number) {
  return Math.round(value / 10) * 10
}

export function estimateClientTdeeV2(input: TdeeModelV2Input): TdeeModelV2Result {
  const filtered = filterWeightOutliers(input.weightSamples)
  const samples = filtered.samples.sort((left, right) => left.date.localeCompare(right.date))
  const completeIntakes = input.dailyIntakes.filter((entry) => entry.complete)
  const completeDays = completeIntakes.length
  const avgIntakeKcal = completeDays > 0
    ? Math.round(completeIntakes.reduce((sum, entry) => sum + entry.kcal, 0) / completeDays)
    : input.fallbackIntakeKcal
  const slopeKgPerDay = samples.length >= 2 ? theilSenSlope(samples) : 0
  const estimate = roundTo10(avgIntakeKcal - slopeKgPerDay * 7700)
  const origin = samples[0]?.date
  const intercept = origin
    ? median(samples.map((sample) => sample.weight_kg - slopeKgPerDay * dateOffset(sample.date, origin)))
    : 0
  const residualStd = origin
    ? standardDeviation(samples.map((sample) => sample.weight_kg - (intercept + slopeKgPerDay * dateOffset(sample.date, origin))))
    : 0
  const intakeStd = standardDeviation(completeIntakes.map((entry) => entry.kcal))
  const observedSpan = samples.length >= 2
    ? Math.max(1, dateOffset(samples[samples.length - 1].date, samples[0].date))
    : input.windowDays
  const slopeUncertaintyKcal = (residualStd / Math.max(1, Math.sqrt(samples.length) * observedSpan / 3)) * 7700
  const intakeUncertaintyKcal = completeDays > 0 ? intakeStd / Math.sqrt(completeDays) : 250
  const contextPenaltyKcal = input.contextChanged ? 125 : 0
  const intervalHalfWidth = roundTo10(Math.max(
    80,
    Math.min(450, 1.96 * Math.sqrt(slopeUncertaintyKcal ** 2 + intakeUncertaintyKcal ** 2 + contextPenaltyKcal ** 2)),
  ))
  const reasons: string[] = []
  let confidenceScore = 100

  if (input.windowDays < 14) {
    confidenceScore -= 25
    reasons.push(`Fenêtre de ${input.windowDays} jours — 14 jours requis`)
  }
  if (samples.length < 8) {
    confidenceScore -= Math.min(35, (8 - samples.length) * 6)
    reasons.push(`${samples.length} pesées exploitables — viser au moins 8`)
  } else {
    reasons.push(`${samples.length} pesées exploitables sur ${Math.round(observedSpan)} jours`)
  }
  if (completeDays < 10) {
    confidenceScore -= Math.min(40, (10 - completeDays) * 6)
    reasons.push(`${completeDays} journées nutritionnelles complètes — viser au moins 10`)
  } else {
    reasons.push(`${completeDays} journées nutritionnelles complètes`)
  }
  if (completeDays === 0) {
    confidenceScore -= 20
    reasons.push('Apport de référence issu du protocole : mode proxy')
  }
  if (filtered.outlierCount > 0) {
    confidenceScore -= Math.min(10, filtered.outlierCount * 5)
    reasons.push(`${filtered.outlierCount} pesée(s) aberrante(s) exclue(s)`)
  }
  if (input.contextChanged) {
    confidenceScore -= 15
    reasons.push('Changement de contexte récent : estimation maintenue en observation')
  }

  confidenceScore = Math.max(0, Math.min(100, confidenceScore))
  const status: TdeeEstimationStatus =
    input.windowDays >= 14 && samples.length >= 8 && completeDays >= 10 && !input.contextChanged
      ? 'actionable'
      : input.windowDays >= 14 && samples.length >= 4 && completeDays >= 5
        ? 'observing'
        : 'collecting'

  return {
    estimate,
    lower: estimate - intervalHalfWidth,
    upper: estimate + intervalHalfWidth,
    slopeKgPerDay,
    weightDeltaKg: Number((slopeKgPerDay * input.windowDays).toFixed(2)),
    avgIntakeKcal,
    completeDays,
    weightSamplesUsed: samples.length,
    outlierCount: filtered.outlierCount,
    status,
    confidenceScore,
    reasons,
  }
}
