// ─── Types ────────────────────────────────────────────────────────────────────

export type TrainingGoal =
  | 'fat_loss' | 'hypertrophy' | 'strength' | 'recomp'
  | 'maintenance' | 'endurance' | 'athletic'

export interface DimensionWeights {
  adherence: number
  recovery: number
  bodyProgress: number
  performance: number
}

export interface DimensionResult {
  score: number       // 0–100
  weight: number      // effective weight after redistribution
  dataPoints: number
}

export interface BodyProgressResult extends DimensionResult {
  confidence: 'high' | 'low' | 'none'
}

export interface TransformationAlert {
  dimension: 'adherence' | 'recovery' | 'bodyProgress' | 'performance'
  message: string
  severity: 'low' | 'medium' | 'high'
}

export interface TransformationScoreResult {
  score: number
  label: string
  window: 7 | 30
  dimensions: {
    adherence: DimensionResult
    recovery: DimensionResult
    bodyProgress: BodyProgressResult
    performance: DimensionResult
  }
  alerts: TransformationAlert[]
  weightsSource: 'default' | 'coach_override'
  insufficientData: boolean
}

export interface CheckinSummaryInput {
  field_averages: {
    energy?: number | null
    sleep_duration?: number | null
    sleep_quality?: number | null
    stress?: number | null
    muscle_soreness?: number | null
  }
  response_rate: number | null  // 0–100
  configured_days_count: number
}

export interface PerformanceSummaryInput {
  analysis: {
    exercises: {
      completion_rate: number
      avg_rir: number | null
      overloads_last_4_weeks: number
      stagnation: boolean
      overreaching: boolean
    }[]
    global_overreaching: boolean
  }
  sessionsCount: number
  weeklyFrequency: number
}

export interface BodyDataInput {
  weightSeries: { date: string; value: number }[]
  bodyFatSeries: { date: string; value: number }[]
  leanMassSeries: { date: string; value: number }[]
  trainingGoal: TrainingGoal
}

export interface ComputeScoreInput {
  trainingGoal: TrainingGoal
  window: 7 | 30
  checkin: CheckinSummaryInput
  performance: PerformanceSummaryInput
  bodyData: BodyDataInput
  weightsOverride: DimensionWeights | null
  gender: 'male' | 'female' | string | null
  latestBodyFat: number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS: Record<TrainingGoal, DimensionWeights> = {
  fat_loss:    { adherence: 0.30, recovery: 0.25, bodyProgress: 0.30, performance: 0.15 },
  hypertrophy: { adherence: 0.25, recovery: 0.30, bodyProgress: 0.20, performance: 0.25 },
  strength:    { adherence: 0.25, recovery: 0.25, bodyProgress: 0.15, performance: 0.35 },
  recomp:      { adherence: 0.30, recovery: 0.25, bodyProgress: 0.25, performance: 0.20 },
  maintenance: { adherence: 0.35, recovery: 0.30, bodyProgress: 0.20, performance: 0.15 },
  endurance:   { adherence: 0.25, recovery: 0.35, bodyProgress: 0.10, performance: 0.30 },
  athletic:    { adherence: 0.25, recovery: 0.30, bodyProgress: 0.15, performance: 0.30 },
}

// ─── Label ────────────────────────────────────────────────────────────────────

export function getScoreLabel(score: number): string {
  if (score < 25) return 'En difficulté'
  if (score < 50) return 'En progression'
  if (score < 75) return 'Sur la bonne voie'
  if (score < 90) return 'Haute performance'
  return 'Potentiel maximal'
}

// ─── Weight redistribution ────────────────────────────────────────────────────

function redistributeWeights(
  weights: DimensionWeights,
  insufficient: (keyof DimensionWeights)[]
): DimensionWeights {
  if (insufficient.length === 0) return weights
  const excl = new Set(insufficient)
  const removedWeight = insufficient.reduce((s, k) => s + weights[k], 0)
  const remaining = 1 - removedWeight
  if (remaining <= 0) {
    return { adherence: 0.25, recovery: 0.25, bodyProgress: 0.25, performance: 0.25 }
  }
  const result = { ...weights }
  for (const k of insufficient) result[k] = 0
  for (const k of Object.keys(weights) as (keyof DimensionWeights)[]) {
    if (!excl.has(k)) result[k] = weights[k] / remaining
  }
  return result
}

// ─── Recovery normalization ───────────────────────────────────────────────────

function normalizeRecovery(avgs: CheckinSummaryInput['field_averages']): { score: number; dataPoints: number } {
  const scores: number[] = []

  if (avgs.energy != null) scores.push((avgs.energy - 1) / 4)
  if (avgs.sleep_quality != null) scores.push((avgs.sleep_quality - 1) / 4)
  if (avgs.sleep_duration != null) {
    const h = avgs.sleep_duration
    let s: number
    if (h < 5) s = 0.1
    else if (h < 6) s = 0.2 + (h - 5) * 0.15
    else if (h < 7) s = 0.35 + (h - 6) * 0.3
    else if (h <= 9) s = 1.0
    else s = Math.max(0.6, 1.0 - (h - 9) * 0.2)
    scores.push(s)
  }
  if (avgs.stress != null) scores.push((5 - avgs.stress) / 4)
  if (avgs.muscle_soreness != null) scores.push((5 - avgs.muscle_soreness) / 4)

  if (scores.length === 0) return { score: 0, dataPoints: 0 }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return { score: Math.round(avg * 100), dataPoints: scores.length }
}

// ─── Adherence normalization ──────────────────────────────────────────────────

function normalizeAdherence(
  checkin: CheckinSummaryInput,
  sessionsCount: number,
  weeklyFrequency: number,
  windowDays: number
): { score: number; dataPoints: number } {
  const scores: number[] = []

  if (checkin.response_rate != null) {
    scores.push(checkin.response_rate / 100)
  }

  const targetSessions = weeklyFrequency * (windowDays / 7)
  if (targetSessions > 0) {
    scores.push(Math.min(sessionsCount / targetSessions, 1))
  }

  if (scores.length === 0) return { score: 0, dataPoints: 0 }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return { score: Math.round(avg * 100), dataPoints: scores.length }
}

// ─── Body progress normalization ──────────────────────────────────────────────

function linRegSlope(series: { date: string; value: number }[]): number {
  if (series.length < 2) return 0
  const n = series.length
  const ys = series.map(p => p.value)
  const xs = series.map((_, i) => i)
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumX2 = xs.reduce((s, x) => s + x * x, 0)
  const denom = n * sumX2 - sumX * sumX
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
}

type TrendDirection = 'down' | 'up' | 'stable'

const GOAL_WEIGHT_DIRECTION: Record<TrainingGoal, TrendDirection> = {
  fat_loss:    'down',
  hypertrophy: 'up',
  strength:    'up',
  recomp:      'stable',
  maintenance: 'stable',
  endurance:   'stable',
  athletic:    'stable',
}

function slopeToScore(slope: number, direction: TrendDirection): number {
  if (direction === 'down') {
    if (slope <= -0.5) return 1
    if (slope <= -0.2) return 0.8
    if (slope < 0)     return 0.6
    if (slope < 0.2)   return 0.4
    return Math.max(0, 0.4 - (slope - 0.2) * 0.5)
  }
  if (direction === 'up') {
    if (slope >= 0.5)  return 1
    if (slope >= 0.2)  return 0.8
    if (slope > 0)     return 0.6
    if (slope > -0.2)  return 0.4
    return Math.max(0, 0.4 + (slope + 0.2) * 0.5)
  }
  // stable
  return Math.max(0, 1 - Math.abs(slope) * 2)
}

type RawBodyResult = { score: number; dataPoints: number; confidence: 'high' | 'low' | 'none' }

function normalizeBodyProgress(data: BodyDataInput): RawBodyResult {
  const { weightSeries, bodyFatSeries, leanMassSeries, trainingGoal } = data

  if (weightSeries.length < 2) {
    return { score: 50, dataPoints: 0, confidence: 'none' }
  }

  const scores: number[] = []
  let confidence: 'high' | 'low' | 'none' = 'low'

  const weightSlope = linRegSlope(weightSeries)
  scores.push(slopeToScore(weightSlope, GOAL_WEIGHT_DIRECTION[trainingGoal]))

  if (bodyFatSeries.length >= 2) {
    confidence = 'high'
    scores.push(slopeToScore(linRegSlope(bodyFatSeries), 'down'))
  }
  if (leanMassSeries.length >= 2) {
    confidence = 'high'
    scores.push(slopeToScore(linRegSlope(leanMassSeries), 'up'))
  }

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return { score: Math.round(avg * 100), dataPoints: weightSeries.length, confidence }
}

// ─── Performance normalization ────────────────────────────────────────────────

function normalizePerformance(
  input: PerformanceSummaryInput
): { score: number; dataPoints: number } {
  const { analysis, sessionsCount } = input
  const exercises = analysis.exercises

  if (exercises.length === 0 || sessionsCount === 0) {
    return { score: 0, dataPoints: 0 }
  }

  const scores: number[] = []

  const avgCompletion = exercises.reduce((s, e) => s + e.completion_rate, 0) / exercises.length
  scores.push(avgCompletion)

  const rirValues = exercises.map(e => e.avg_rir).filter((v): v is number => v != null)
  if (rirValues.length > 0) {
    const avgRir = rirValues.reduce((s, v) => s + v, 0) / rirValues.length
    scores.push(Math.max(0, Math.min(1, 1 - avgRir / 5)))
  }

  const stagnantRatio = exercises.filter(e => e.stagnation).length / exercises.length
  scores.push(1 - stagnantRatio)

  if (analysis.global_overreaching) scores.push(0.3)

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return { score: Math.round(avg * 100), dataPoints: exercises.length }
}

// ─── Alert generation ─────────────────────────────────────────────────────────

function generateAlerts(
  dims: TransformationScoreResult['dimensions'],
  checkin: CheckinSummaryInput
): TransformationAlert[] {
  const alerts: TransformationAlert[] = []

  if (dims.adherence.score < 50 && dims.adherence.dataPoints > 0) {
    const rate = checkin.response_rate
    if (rate != null && rate < 50) {
      alerts.push({
        dimension: 'adherence',
        message: `Check-in rate : ${rate}% — données insuffisantes`,
        severity: rate < 30 ? 'high' : 'medium',
      })
    } else {
      alerts.push({ dimension: 'adherence', message: 'Régularité des séances en baisse', severity: 'medium' })
    }
  }

  if (dims.recovery.score < 50 && dims.recovery.dataPoints > 0) {
    const avgs = checkin.field_averages
    if (avgs.sleep_duration != null && avgs.sleep_duration < 6.5) {
      alerts.push({
        dimension: 'recovery',
        message: `Sommeil moy. ${avgs.sleep_duration.toFixed(1)}h/nuit — sous le seuil de récupération`,
        severity: 'high',
      })
    } else if (avgs.stress != null && avgs.stress > 3.5) {
      alerts.push({
        dimension: 'recovery',
        message: `Stress élevé — moyenne ${avgs.stress.toFixed(1)}/5`,
        severity: 'medium',
      })
    } else {
      alerts.push({ dimension: 'recovery', message: 'Qualité de récupération insuffisante', severity: 'medium' })
    }
  }

  if (dims.bodyProgress.dataPoints === 0) {
    alerts.push({
      dimension: 'bodyProgress',
      message: 'Aucune donnée corporelle sur la période — planifier un bilan',
      severity: 'low',
    })
  } else if (dims.bodyProgress.score < 40) {
    alerts.push({
      dimension: 'bodyProgress',
      message: "Progression corporelle contraire à l'objectif",
      severity: 'high',
    })
  }

  if (dims.performance.score < 50 && dims.performance.dataPoints > 0) {
    alerts.push({
      dimension: 'performance',
      message: 'Progression en force stagnante sur la période',
      severity: dims.performance.score < 30 ? 'high' : 'medium',
    })
  }

  const order = { high: 0, medium: 1, low: 2 } as const
  return alerts.sort((a, b) => order[a.severity] - order[b.severity])
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeTransformationScore(input: ComputeScoreInput): TransformationScoreResult {
  const baseWeights = input.weightsOverride ?? DEFAULT_WEIGHTS[input.trainingGoal]
  const weightsSource: 'default' | 'coach_override' = input.weightsOverride ? 'coach_override' : 'default'

  const adherenceRaw = normalizeAdherence(
    input.checkin, input.performance.sessionsCount,
    input.performance.weeklyFrequency, input.window
  )
  const recoveryRaw  = normalizeRecovery(input.checkin.field_averages)
  const bodyRaw      = normalizeBodyProgress(input.bodyData)
  const performRaw   = normalizePerformance(input.performance)

  const insufficient: (keyof DimensionWeights)[] = []
  if (adherenceRaw.dataPoints < 1) insufficient.push('adherence')
  if (recoveryRaw.dataPoints < 3)  insufficient.push('recovery')
  if (bodyRaw.dataPoints < 2)      insufficient.push('bodyProgress')
  if (performRaw.dataPoints < 1)   insufficient.push('performance')

  const w = redistributeWeights(baseWeights, insufficient)

  const composite =
    adherenceRaw.score * w.adherence +
    recoveryRaw.score  * w.recovery  +
    bodyRaw.score      * w.bodyProgress +
    performRaw.score   * w.performance

  const dimensions = {
    adherence:    { score: adherenceRaw.score, weight: w.adherence,    dataPoints: adherenceRaw.dataPoints },
    recovery:     { score: recoveryRaw.score,  weight: w.recovery,     dataPoints: recoveryRaw.dataPoints  },
    bodyProgress: { score: bodyRaw.score,      weight: w.bodyProgress, dataPoints: bodyRaw.dataPoints, confidence: bodyRaw.confidence },
    performance:  { score: performRaw.score,   weight: w.performance,  dataPoints: performRaw.dataPoints   },
  }

  return {
    score: Math.round(composite),
    label: getScoreLabel(Math.round(composite)),
    window: input.window,
    dimensions,
    alerts: generateAlerts(dimensions, input.checkin),
    weightsSource,
    insufficientData: insufficient.length > 0,
  }
}
