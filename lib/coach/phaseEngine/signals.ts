import { progressionFatigueDampener } from './clientProfile'
import type { RawSignalInput, SignalValue, DerivedSignals, DataQuality } from './types'
import { calculateRhrDelta } from './rhr'

const MIN_VIABLE_CONFIDENCE = 0.2
const SIGNAL_DECAY_HALF_LIFE_DAYS = 30

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v))
}

function daysSince(dateStr: string, now = new Date()): number {
  const d = new Date(dateStr)
  return Math.max(0, (now.getTime() - d.getTime()) / 86400000)
}

/** Exponential decay: 1.0 at age=0, 0.5 at age=HALF_LIFE days, with double weight for recent 7 days */
function decayWeight(dateStr: string, now = new Date()): number {
  const age = daysSince(dateStr, now)
  const baseDecay = Math.pow(0.5, age / SIGNAL_DECAY_HALF_LIFE_DAYS)
  return age <= 7 ? baseDecay * 2 : baseDecay
}


function weightedLinearSlope(points: { x: number; y: number; w: number }[]): number {
  if (points.length < 2) return 0
  const totalW = points.reduce((s, p) => s + p.w, 0)
  if (totalW === 0) return 0
  const mx = points.reduce((s, p) => s + p.x * p.w, 0) / totalW
  const my = points.reduce((s, p) => s + p.y * p.w, 0) / totalW
  const num = points.reduce((s, p) => s + p.w * (p.x - mx) * (p.y - my), 0)
  const den = points.reduce((s, p) => s + p.w * (p.x - mx) ** 2, 0)
  return den === 0 ? 0 : num / den
}

function coeffOfVariation(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  if (mean === 0) return 0
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance) / Math.abs(mean)
}

function removeOutliers(series: { date: string; value: number }[]): typeof series {
  if (series.length < 4) return series
  const vals = series.map(s => s.value)
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
  return series.filter(s => Math.abs(s.value - mean) <= 2.5 * std)
}

const SOURCE_RELIABILITY: Record<string, number> = {
  dexa: 1.0,
  bioimpedance: 0.55,
  manual: 0.40,
  wearable: 0.45,
}

export interface BodyCompNorm {
  weightTrend: SignalValue
  waistTrend: SignalValue | null
  leanMassTrend: SignalValue
  bodyFatTrend: SignalValue
}

export function normalizeBodyCompositionSignals(input: RawSignalInput): BodyCompNorm {
  const now = input.anchorDate ? new Date(`${input.anchorDate}T12:00:00Z`) : new Date()

  const computeTrend = (
    rawSeries: { date: string; value: number; source?: string; capturedAt?: string }[],
  ): SignalValue => {
    const series = removeOutliers(rawSeries)
    const n = series.length

    if (n < 2) {
      return { value: 0, observed: n > 0, confidence: n === 0 ? 0 : 0.2, sourceReliability: 0.4 }
    }

    const t0 = new Date(series[0].date).getTime()
    const points = series.map(s => ({
      x: (new Date(s.date).getTime() - t0) / 86400000,
      y: s.value,
      w: decayWeight(s.date, now),
    }))

    const slopeDailyKg = weightedLinearSlope(points)
    const slopeWeekly = slopeDailyKg * 7

    const cov = coeffOfVariation(series.map(s => s.value))
    const freshness = Math.max(0, 1 - daysSince(series[series.length - 1].date, now) / 14)
    const nScore = clamp(n / 5)
    const covPenalty = cov > 0.2 ? 0.2 : 0
    const confidence = clamp(nScore * 0.5 + freshness * 0.3 + 0.2 - covPenalty)

    const sources = rawSeries.map(s => s.source).filter(Boolean) as string[]
    const sourceRel = sources.length > 0
      ? sources.reduce((s, src) => s + (SOURCE_RELIABILITY[src] ?? 0.4), 0) / sources.length
      : 0.4

    return {
      value: slopeWeekly,
      observed: true,
      confidence,
      sourceReliability: sourceRel,
    }
  }

  return {
    weightTrend: computeTrend(input.weightSeries),
    waistTrend: input.waistSeries.length > 0 ? computeTrend(input.waistSeries) : null,
    leanMassTrend: computeTrend(input.leanMassSeries),
    bodyFatTrend: computeTrend(input.bodyFatSeries),
  }
}

export interface BehaviorNorm {
  adherenceScore: number
  sessionCompletionRate: number
}

export function normalizeBehaviorSignals(input: RawSignalInput): BehaviorNorm {
  const checkinAdherence = clamp(input.checkinResponseRate / 100)
  const sessionRate = input.performance.weeklyFrequency > 0
    ? clamp(input.performance.sessionsCount / (input.performance.weeklyFrequency * (input.windowDays / 7)))
    : 0
  const adherenceScore = checkinAdherence * 0.5 + sessionRate * 0.5
  return { adherenceScore, sessionCompletionRate: sessionRate }
}

export interface PerfNorm {
  performanceTrend: SignalValue
  overloadDensity: number
  stagnationRatio: number
}

export function normalizePerformanceSignals(input: RawSignalInput): PerfNorm {
  const exs = input.performance.exercises
  if (exs.length === 0) {
    return {
      performanceTrend: { value: 0, observed: false, confidence: 0 },
      overloadDensity: 0,
      stagnationRatio: 0,
    }
  }

  const avgCompletion = exs.reduce((s, e) => s + e.completion_rate, 0) / exs.length
  const avgRir = exs.filter(e => e.avg_rir !== null).map(e => e.avg_rir as number)
  const meanRir = avgRir.length > 0 ? avgRir.reduce((a, b) => a + b, 0) / avgRir.length : 3
  const totalOverloads = exs.reduce((s, e) => s + e.overloads_last_4_weeks, 0)
  const overloadDensity = clamp(totalOverloads / (exs.length * 4))
  const stagnationRatio = exs.filter(e => e.stagnation && !e.load_progressing).length / exs.length
  const overreachingFlag = input.performance.global_overreaching ? 0.22 : 0

  const intensityNorm = clamp(1 - meanRir / 6)
  const loadProgressShare = exs.filter(e => e.load_progressing).length / exs.length
  const progressionBoost = clamp(
    overloadDensity * 0.45 +
      loadProgressShare * 0.35 +
      (input.progression.compoundOneRmImproving ? 0.2 : 0) +
      (input.progression.recentPrDetected ? 0.12 : 0),
  )

  let rirContribution = intensityNorm * 0.14
  if (progressionBoost >= 0.35 && stagnationRatio < 0.45) {
    rirContribution = Math.max(rirContribution, intensityNorm * 0.26)
  } else if (intensityNorm > 0.65 && stagnationRatio >= 0.4 && loadProgressShare < 0.3) {
    rirContribution = intensityNorm * 0.06
  }

  const rawTrend =
    avgCompletion * 0.32 +
    overloadDensity * 0.26 +
    progressionBoost * 0.14 +
    rirContribution -
    stagnationRatio * 0.22 -
    overreachingFlag

  const trendNormalized = clamp(rawTrend * 2 - 1, -1, 1)

  const n = input.performance.sessionsCount
  const exp = input.clientProfile.experienceLevel
  const expBoost = exp === 'advanced' ? 0.08 : exp === 'intermediate' ? 0.04 : 0
  const confidence = clamp(clamp(n / 8) * 0.7 + 0.3 + expBoost)

  return {
    performanceTrend: { value: trendNormalized, observed: true, confidence: clamp(confidence) },
    overloadDensity,
    stagnationRatio,
  }
}

export interface RecoveryNorm {
  recoveryScore: number
  recoveryTrend: SignalValue
  sleepScore: number
  dataPoints: number
}

export function normalizeRecoverySignals(input: RawSignalInput): RecoveryNorm {
  const c = input.checkin
  let score = 0
  let weights = 0
  let dataPoints = 0

  const add = (raw: number | null | undefined, w: number, invert = false, max = 5) => {
    if (raw == null) return
    const denom = Math.max(1, max - 1)
    const norm = invert ? clamp(1 - (raw - 1) / denom) : clamp((raw - 1) / denom)
    score += norm * w
    weights += w
    dataPoints++
  }

  add(c.energy, 1.5, false, 5)
  add(c.stress, 1.2, true, 5)
  add(c.muscle_soreness, 0.8, true, 4)
  add(c.sleep_quality, 1.0, false, 4)
  if (c.sleep_duration != null) {
    const sleepNorm = clamp(c.sleep_duration / 9)
    score += sleepNorm * 1.0
    weights += 1.0
    dataPoints++
  }

  const recoveryScore = weights > 0 ? clamp(score / weights) : 0

  const sleepQNorm = c.sleep_quality != null ? clamp((c.sleep_quality - 1) / 3) : null
  const sleepDNorm = c.sleep_duration != null ? clamp(c.sleep_duration / 9) : null
  const sleepScore =
    sleepQNorm != null && sleepDNorm != null ? sleepQNorm * 0.6 + sleepDNorm * 0.4
    : sleepQNorm ?? sleepDNorm ?? 0

  const confidence = clamp(dataPoints / 5)

  return {
    recoveryScore,
    recoveryTrend: { value: recoveryScore * 2 - 1, observed: dataPoints > 0, confidence },
    sleepScore,
    dataPoints,
  }
}

export interface NutritionNorm {
  nutritionAdherence: SignalValue
  calorieCompliance: SignalValue
  proteinCompliance: SignalValue
  hydrationCompliance: SignalValue
  energyAvailabilityConsistency: SignalValue
}

function complianceFromTargetActual(
  target: number | null | undefined,
  actual: number | null | undefined,
  tolerance = 0.1,
): number | null {
  if (target == null || actual == null || target <= 0) return null
  const relativeError = Math.abs(actual - target) / target
  if (relativeError <= tolerance) return 1
  return clamp(1 - (relativeError - tolerance) / (1 - tolerance))
}

export function normalizeNutritionSignals(input: RawSignalInput): NutritionNorm {
  const nutrition = input.nutrition
  if (!nutrition) {
    const empty = { value: 0, observed: false, confidence: 0 }
    return {
      nutritionAdherence: empty,
      calorieCompliance: empty,
      proteinCompliance: empty,
      hydrationCompliance: empty,
      energyAvailabilityConsistency: empty,
    }
  }

  const logCoverage =
    nutrition.adherence.expectedDays > 0
      ? clamp(nutrition.adherence.loggedDays / nutrition.adherence.expectedDays)
      : 0

  const calorieComp = complianceFromTargetActual(
    nutrition.target.calories,
    nutrition.actual.avgCalories,
    0.08,
  )
  const proteinComp = complianceFromTargetActual(
    nutrition.target.protein_g,
    nutrition.actual.avgProteinG,
    0.1,
  )
  const hydrationComp = complianceFromTargetActual(
    nutrition.target.hydration_ml,
    nutrition.actual.avgHydrationMl,
    0.15,
  )

  const componentValues = [calorieComp, proteinComp, hydrationComp].filter(
    (v): v is number => v != null,
  )
  const baseCompliance =
    componentValues.length > 0
      ? componentValues.reduce((sum, value) => sum + value, 0) /
        componentValues.length
      : null

  const confidenceSource =
    nutrition.source === 'meal_logs' ? 0.9
    : nutrition.source === 'mixed' ? 0.75
    : nutrition.source === 'protocol_only' ? 0.35
    : 0

  const confidence = clamp(
    logCoverage * 0.55 +
      (componentValues.length / 3) * 0.25 +
      confidenceSource * 0.2,
  )

  const adherenceValue = baseCompliance != null
    ? clamp(baseCompliance * 0.75 + logCoverage * 0.25)
    : logCoverage

  const calorieSignal: SignalValue = {
    value: calorieComp ?? 0,
    observed: calorieComp != null,
    confidence: calorieComp != null ? confidence : logCoverage * 0.4,
  }
  const proteinSignal: SignalValue = {
    value: proteinComp ?? 0,
    observed: proteinComp != null,
    confidence: proteinComp != null ? confidence : logCoverage * 0.35,
  }
  const hydrationSignal: SignalValue = {
    value: hydrationComp ?? 0,
    observed: hydrationComp != null,
    confidence: hydrationComp != null ? confidence * 0.8 : 0,
  }

  return {
    nutritionAdherence: {
      value: adherenceValue,
      observed: componentValues.length > 0 || logCoverage > 0,
      confidence,
      sourceReliability: confidenceSource,
    },
    calorieCompliance: calorieSignal,
    proteinCompliance: proteinSignal,
    hydrationCompliance: hydrationSignal,
    energyAvailabilityConsistency: {
      value: calorieComp ?? adherenceValue,
      observed: calorieComp != null || logCoverage > 0,
      confidence: calorieComp != null ? confidence : logCoverage * 0.4,
      sourceReliability: confidenceSource,
    },
  }
}

function computeSignalReliability(signal: SignalValue, freshnessScore: number): number {
  if (signal.confidence < MIN_VIABLE_CONFIDENCE) return 0
  return clamp(signal.confidence * 0.6 + freshnessScore * 0.2 + (signal.sourceReliability ?? 0.4) * 0.2)
}

export function buildDerivedSignals(input: RawSignalInput): DerivedSignals & { insufficientData: boolean } {
  const bodyComp = normalizeBodyCompositionSignals(input)
  const perf = normalizePerformanceSignals(input)
  const recovery = normalizeRecoverySignals(input)
  const behavior = normalizeBehaviorSignals(input)
  const nutrition = normalizeNutritionSignals(input)

  const latestWeight = input.weightSeries[input.weightSeries.length - 1]
  const now = input.anchorDate ? new Date(`${input.anchorDate}T12:00:00Z`) : new Date()
  const weightFreshness = latestWeight ? clamp(1 - daysSince(latestWeight.date, now) / 14) : 0

  const reliabilityMap: Record<string, number> = {
    weightTrend: computeSignalReliability(bodyComp.weightTrend, weightFreshness),
    leanMassTrend: computeSignalReliability(bodyComp.leanMassTrend, weightFreshness),
    bodyFatTrend: computeSignalReliability(bodyComp.bodyFatTrend, weightFreshness),
    performanceTrend: perf.performanceTrend.confidence,
    recoveryTrend: recovery.recoveryTrend.confidence,
    nutritionAdherence: nutrition.nutritionAdherence.confidence,
    calorieCompliance: nutrition.calorieCompliance.confidence,
    proteinCompliance: nutrition.proteinCompliance.confidence,
  }

  const signalValues = Object.values(reliabilityMap)
  const presentSignals = signalValues.filter(v => v > MIN_VIABLE_CONFIDENCE).length
  const dataCoverage = clamp(presentSignals / signalValues.length)
  const dataReliability = signalValues.length > 0
    ? signalValues.reduce((s, v) => s + v, 0) / signalValues.length
    : 0

  const dataQuality: DataQuality =
    dataCoverage < 0.30 ? 'minimal'
    : dataCoverage < 0.50 ? 'limited'
    : dataCoverage < 0.75 ? 'good'
    : 'high'

  const subjectiveFatigue = (1 - recovery.recoveryScore) * 0.6
  const overreachComponent = input.performance.global_overreaching ? 0.4 : 0
  const dampen = progressionFatigueDampener({
    experienceLevel: input.clientProfile.experienceLevel,
    overloadEventCount: input.progression.overloadEventCount,
    compoundOneRmImproving: input.progression.compoundOneRmImproving,
    recentPrDetected: input.progression.recentPrDetected,
  })
  const fatigueRaw = clamp(
    subjectiveFatigue * (1 - dampen) + overreachComponent * (1 - dampen * 0.55),
  )
  const recoveryCapacityRaw = clamp(
    recovery.recoveryScore * 0.5 +
    behavior.adherenceScore * 0.3 +
    recovery.sleepScore * 0.2
  )

  const trainingToleranceRaw = clamp(
    behavior.sessionCompletionRate * 0.35 +
    clamp((perf.performanceTrend.value + 1) / 2) * 0.35 +
    (1 - perf.stagnationRatio) * 0.15 +
    (input.performance.global_overreaching ? 0.25 : 0.45) * 0.15,
  )

  const weightLossTooFast = bodyComp.weightTrend.value < -1
    ? clamp(Math.abs(bodyComp.weightTrend.value + 1) / 2)
    : 0

  const leanMassDropping = bodyComp.leanMassTrend.value < -0.2 ? 0.8 : 0

  const catabolicRiskRaw = clamp(
    weightLossTooFast * 0.3 +
    leanMassDropping * 0.4 +
    fatigueRaw * 0.3
  )

  const perfTrendNorm = clamp((perf.performanceTrend.value + 1) / 2)
  const anabolicPotentialRaw = clamp(
    recoveryCapacityRaw * 0.4 +
    perfTrendNorm * 0.3 +
    (nutrition.nutritionAdherence.observed ? nutrition.nutritionAdherence.value : behavior.adherenceScore) * 0.3
  )

  const bodyResponseMatchRaw = clamp(
    (bodyComp.weightTrend.observed ? (bodyComp.weightTrend.value < 0 ? 0.7 : 0.45) : 0.45) * 0.25 +
    (bodyComp.bodyFatTrend.observed ? (bodyComp.bodyFatTrend.value <= 0 ? 0.75 : 0.25) : 0.45) * 0.30 +
    (bodyComp.waistTrend?.observed ? (bodyComp.waistTrend.value <= 0 ? 0.75 : 0.25) : 0.45) * 0.20 +
    (bodyComp.leanMassTrend.observed ? (bodyComp.leanMassTrend.value >= -0.1 ? 0.7 : 0.25) : 0.45) * 0.25,
  )

  const stepTarget =
    input.clientProfile.currentPhase === 'cut' ? 8000
    : input.clientProfile.currentPhase === 'bulk' ? 6000
    : 7000
  const stepValue = input.checkin.steps
  const stepLoadStabilityRaw =
    stepValue != null ? clamp(stepValue / stepTarget, 0, 1) : 0

  const phaseCompatibilityRaw = clamp(
    recoveryCapacityRaw * 0.25 +
    trainingToleranceRaw * 0.2 +
    (nutrition.nutritionAdherence.observed ? nutrition.nutritionAdherence.value : behavior.adherenceScore) * 0.25 +
    bodyResponseMatchRaw * 0.2 +
    (input.clientProfile.currentPhase === 'cut'
      ? (bodyComp.bodyFatTrend.observed && bodyComp.bodyFatTrend.value <= 0 ? 0.8 : 0.45)
      : input.clientProfile.currentPhase === 'bulk'
        ? (perfTrendNorm > 0.5 ? 0.75 : 0.45)
        : 0.55) * 0.1,
  )

  const fatGainRiskRaw = clamp(
    (bodyComp.bodyFatTrend.observed && bodyComp.bodyFatTrend.value > 0 ? bodyComp.bodyFatTrend.value * 4 : 0) * 0.5 +
    (bodyComp.waistTrend?.observed && bodyComp.waistTrend.value > 0 ? bodyComp.waistTrend.value * 0.25 : 0) * 0.3 +
    ((nutrition.calorieCompliance.observed && nutrition.calorieCompliance.value < 0.55) ? 0.2 : 0),
  )

  const physiologicalStressScore = clamp(
    fatigueRaw * 0.35 +
    catabolicRiskRaw * 0.35 +
    (1 - recoveryCapacityRaw) * 0.30
  )

  const recoveryConf = recovery.recoveryTrend.confidence
  const perfConf = perf.performanceTrend.confidence
  const bodyConf = Math.max(bodyComp.weightTrend.confidence, bodyComp.leanMassTrend.confidence)

  const insufficientData = dataCoverage < 0.30

  const rhrCheckins = input.rhrSeries.map(r => ({ date: r.date, rhr_morning: r.value }))
  const rhrDelta = calculateRhrDelta(rhrCheckins, input.anchorDate)
  // Determine CNS overload with fallback when RHR data is missing
  let cnsOverload = false;
  if (rhrDelta && typeof rhrDelta.isCnsOverloaded === 'boolean') {
    cnsOverload = rhrDelta.isCnsOverloaded;
  }
  // Subjective fallback: high observed fatigue forces overload (veto DELOAD).
  if (!cnsOverload && recovery.dataPoints > 0 && fatigueRaw > 0.5) {
    cnsOverload = true;
  }


  return {
    weightTrend: bodyComp.weightTrend,
    bodyFatTrend: bodyComp.bodyFatTrend,
    waistTrend: bodyComp.waistTrend,
    performanceTrend: perf.performanceTrend,
    recoveryTrend: recovery.recoveryTrend,

    probableMuscleGain: {
      value: clamp(anabolicPotentialRaw * 0.6 + (bodyComp.leanMassTrend.value > 0 ? 0.4 : 0)),
      observed: false,
      confidence: Math.min(perfConf, bodyConf),
    },
    probableFatGain: {
      value: fatGainRiskRaw,
      observed: false,
      confidence: bodyComp.bodyFatTrend.confidence,
    },
    catabolicRisk: {
      value: catabolicRiskRaw,
      observed: false,
      confidence: Math.min(bodyConf, recoveryConf),
    },
    anabolicPotential: {
      value: anabolicPotentialRaw,
      observed: false,
      confidence: Math.min(recoveryConf, perfConf),
    },
    fatigueIndex: {
      value: fatigueRaw,
      observed: recovery.dataPoints > 0,
      confidence: recoveryConf,
    },
    recoveryCapacity: {
      value: recoveryCapacityRaw,
      observed: recovery.dataPoints > 0 || recovery.recoveryTrend.observed,
      confidence: recoveryConf,
    },
    trainingTolerance: {
      value: trainingToleranceRaw,
      observed: input.performance.sessionsCount > 0,
      confidence: perfConf,
    },
    nutritionAdherence: nutrition.nutritionAdherence,
    calorieCompliance: nutrition.calorieCompliance,
    proteinCompliance: nutrition.proteinCompliance,
    hydrationCompliance: nutrition.hydrationCompliance,
    bodyResponseMatch: {
      value: bodyResponseMatchRaw,
      observed: bodyComp.weightTrend.observed || bodyComp.bodyFatTrend.observed || Boolean(bodyComp.waistTrend?.observed),
      confidence: bodyConf,
    },
    phaseCompatibility: {
      value: phaseCompatibilityRaw,
      observed: true,
      confidence: clamp((recoveryConf + perfConf + bodyConf + nutrition.nutritionAdherence.confidence) / 4),
    },
    stepLoadStability: {
      value: stepLoadStabilityRaw,
      observed: stepValue != null,
      confidence: stepValue != null ? 0.45 : 0,
    },
    energyAvailabilityConsistency: nutrition.energyAvailabilityConsistency,
    fatGainRisk: {
      value: fatGainRiskRaw,
      observed: bodyComp.bodyFatTrend.observed || Boolean(bodyComp.waistTrend?.observed),
      confidence: bodyComp.bodyFatTrend.confidence,
    },
    rhrDelta,
    cnsOverload,

    physiologicalStressScore,
    dataCoverage,
    dataReliability,
    dataQuality,
    insufficientData,
  }
}
