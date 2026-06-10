import type {
  DerivedSignals,
  DataQuality,
  EnergeticDirection,
  AdaptiveState,
  OpportunityState,
  ConstraintFlag,
  RecommendationHorizon,
  CoachPhasePreferences,
  PhaseOptimizationResult,
  PhaseAlert,
  SignalValue,
} from './types'
import { buildReasons, buildMicroCopy, buildAlerts, type PhaseEngineLocale } from './copy'
import { evaluatePhaseMatrix } from './matrix'

export const ENGINE_VERSION = 'v1'

export const ENGINE_THRESHOLDS_V1 = {
  MIN_VIABLE_CONFIDENCE: 0.2,
  AGGRESSIVE_DIRECTION_MIN_QUALITY: 'good' as DataQuality,
  RECOVERY_CRASH_STRESS_THRESHOLD: 0.85,
  CATABOLIC_FORCE_MAINTENANCE: 0.70,
  HYSTERESIS_BUFFER: 0.05,
  CONFLICT_SEVERITY_CONFIDENCE_CAP: 0.60,
} as const

export const ENGINE_THRESHOLDS = ENGINE_THRESHOLDS_V1

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v))
}

function scoreEnergeticDirection(
  s: DerivedSignals,
  latestBodyFat: number | null,
  gender: 'male' | 'female' | null,
  prefs?: CoachPhasePreferences,
): { score: number; confidence: number } {
  const ap = s.anabolicPotential
  const cr = s.catabolicRisk
  const pt = s.performanceTrend
  const rc = s.recoveryCapacity

  const apW = ap.confidence >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE ? 0.30 : 0
  const ptW = pt.confidence >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE ? 0.25 : 0
  const crW = cr.confidence >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE ? 0.20 : 0
  const lmW = s.probableMuscleGain.confidence >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE ? 0.15 : 0
  const rcW = rc.confidence >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE ? 0.10 : 0

  const totalW = apW + ptW + crW + lmW + rcW
  if (totalW === 0) return { score: 0, confidence: 0 }

  let score =
    ap.value * apW +
    pt.value * ptW +
    (1 - cr.value) * crW +
    s.probableMuscleGain.value * lmW +
    rc.value * rcW

  score = score / totalW
  score = score * 2 - 1

  if (latestBodyFat !== null && s.dataReliability > 0.4) {
    const leanCutoff = gender === 'female' ? 12 : 10
    const fatUpper = gender === 'female' ? 28 : 20
    if (latestBodyFat < leanCutoff) score = clamp(score + 0.3, -1, 1)
    if (latestBodyFat > fatUpper) score = clamp(score - 0.3, -1, 1)
  }

  if (prefs) {
    if (prefs.prioritizePerformance && pt.value > 0.3) score = clamp(score + 0.1, -1, 1)
    if (score < -0.2) score = clamp(score + (prefs.aggressiveCutTolerance - 0.5) * 0.2, -1, 1)
    if (score > 0.2) score = clamp(score + (prefs.preferredBulkAggressiveness - 0.5) * 0.2, -1, 1)
  }

  // Force deficit/maintenance if recent weight is stagnating or dropping drastically
  if (s.weightTrend.observed && s.weightTrend.confidence >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE) {
    const wtVal = s.weightTrend.value
    if (wtVal <= 0.05) {
      if (score > 0.1) {
        score = 0.1 // Cap at maintenance
      }
      if (wtVal < -0.3) {
        score = Math.min(score, -0.35) // Immediately steer to controlled/aggressive deficit
      }
    }
  }

  const confidence = clamp(totalW * s.dataReliability)
  return { score, confidence }
}

function directionFromScore(score: number, quality: DataQuality): EnergeticDirection {
  const H = ENGINE_THRESHOLDS.HYSTERESIS_BUFFER
  const canAggressive = quality === 'good' || quality === 'high'

  if (score < -(0.60 - H) && canAggressive) return 'aggressive_deficit'
  if (score < -(0.20 - H)) return 'controlled_deficit'
  if (score < +(0.20 + H)) return 'maintenance'
  if (score < +(0.60 + H)) return 'controlled_surplus'
  return canAggressive ? 'aggressive_surplus' : 'controlled_surplus'
}

function scoreAdaptiveState(s: DerivedSignals): { score: number; confidence: number } {
  const fi = s.fatigueIndex
  const rc = s.recoveryCapacity
  const pss = s.physiologicalStressScore

  if (pss > ENGINE_THRESHOLDS.RECOVERY_CRASH_STRESS_THRESHOLD) {
    return { score: -1, confidence: 0.9 }
  }

  const fiW = fi.confidence >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE ? 0.40 : 0
  const pssW = 0.35
  const rcW = rc.confidence >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE ? 0.25 : 0

  const totalW = fiW + pssW + rcW
  if (totalW === 0) return { score: 0, confidence: 0 }

  const score = clamp(
    (-fi.value * fiW - pss * pssW + (rc.value - 0.5) * rcW) / totalW,
    -1, 1
  )

  const confidence = clamp(totalW * s.dataReliability)
  return { score, confidence }
}

function adaptiveStateFromScore(score: number): AdaptiveState {
  const H = ENGINE_THRESHOLDS.HYSTERESIS_BUFFER
  if (score < -(0.75 - H)) return 'recovery_crash'
  if (score < -(0.45 - H)) return 'systemic_fatigue'
  if (score < -(0.15 - H)) return 'high_fatigue'
  if (score < +(0.15 + H)) return 'stable'
  if (score < +(0.45 + H)) return 'recovered'
  return 'supercompensated'
}

function detectOpportunities(
  s: DerivedSignals,
  direction: EnergeticDirection,
  adaptiveState: AdaptiveState,
): OpportunityState[] {
  const opportunities: OpportunityState[] = []

  if (
    (direction === 'controlled_surplus' || direction === 'aggressive_surplus') &&
    ['stable', 'recovered', 'supercompensated'].includes(adaptiveState) &&
    s.catabolicRisk.value < 0.2
  ) {
    opportunities.push('anabolic_window')
  }

  if (
    adaptiveState === 'supercompensated' &&
    s.performanceTrend.value > 0.6 &&
    s.fatigueIndex.value < 0.2
  ) {
    opportunities.push('peak_readiness')
  }

  if (
    (direction === 'controlled_deficit' || direction === 'aggressive_deficit') &&
    s.fatigueIndex.value > 0.65
  ) {
    opportunities.push('diet_break_candidate')
  }

  return opportunities
}

function detectConstraints(s: DerivedSignals): ConstraintFlag[] {
  const flags: ConstraintFlag[] = []

  if (s.catabolicRisk.value > 0.5 && s.catabolicRisk.confidence > ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE)
    flags.push('catabolic_risk')
  if (s.fatigueIndex.value > 0.6 && s.recoveryCapacity.value < 0.4)
    flags.push('recovery_bottleneck')
  if (s.probableMuscleGain.value < 0.2 && s.catabolicRisk.value > 0.4)
    flags.push('possible_muscle_loss')
  if (s.anabolicPotential.value < 0.25 && s.recoveryCapacity.value < 0.3)
    flags.push('poor_adherence')
  if (s.nutritionAdherence.observed && s.nutritionAdherence.value < 0.45)
    flags.push('poor_adherence')
  if (s.physiologicalStressScore > 0.65)
    flags.push('high_stress_load')
  if (s.fatigueIndex.value > 0.7 && s.weightTrend.value < -1)
    flags.push('low_energy_availability')
  if (s.cnsOverload) flags.push('cns_overload')

  return flags
}

function signalContribution(signal: SignalValue, weight: number, invert = false): number {
  const v = invert ? -signal.value : signal.value
  return v * weight
}

function phaseFitBandFromScore(
  score: number,
): PhaseOptimizationResult['phaseFit']['band'] {
  if (score >= 80) return 'optimal'
  if (score >= 60) return 'workable'
  if (score >= 40) return 'fragile'
  return 'incoherent'
}

function computePhaseFitScore(signals: DerivedSignals): number {
  const weighted =
    (1 - signals.physiologicalStressScore) * 0.24 +
    signals.trainingTolerance.value * 0.18 +
    (signals.nutritionAdherence.observed ? signals.nutritionAdherence.value : 0.5) * 0.22 +
    signals.bodyResponseMatch.value * 0.2 +
    signals.phaseCompatibility.value * 0.16

  let score = clamp(weighted) * 100

  if (signals.cnsOverload) score -= 18
  if (signals.catabolicRisk.value > 0.55) score -= 12
  if (signals.fatGainRisk.value > 0.55) score -= 10
  if (signals.nutritionAdherence.observed && signals.nutritionAdherence.value < 0.45) score -= 8

  return Math.max(0, Math.round(score))
}

function buildDecisionTrace(
  s: DerivedSignals,
): PhaseOptimizationResult['decisionTrace'] {
  const positiveFactors: string[] = []
  const negativeFactors: string[] = []
  const ignoredSignals: string[] = []
  const conflictingSignals: string[] = []

  const signalMap: Array<{ key: string; signal: SignalValue; contribution: number }> = [
    { key: 'anabolicPotential', signal: s.anabolicPotential, contribution: signalContribution(s.anabolicPotential, 0.30) },
    { key: 'performanceTrend', signal: s.performanceTrend, contribution: signalContribution(s.performanceTrend, 0.25) },
    { key: 'catabolicRisk', signal: s.catabolicRisk, contribution: signalContribution(s.catabolicRisk, 0.20, true) },
    { key: 'fatigueIndex', signal: s.fatigueIndex, contribution: signalContribution(s.fatigueIndex, 0.40, true) },
    { key: 'recoveryCapacity', signal: s.recoveryCapacity, contribution: signalContribution(s.recoveryCapacity, 0.25) },
  ]

  for (const { key, signal, contribution } of signalMap) {
    if (signal.confidence < ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE) {
      ignoredSignals.push(key)
      continue
    }
    if (contribution > 0.15) positiveFactors.push(key)
    else if (contribution < -0.15) negativeFactors.push(key)
  }

  if (
    s.anabolicPotential.confidence > 0.4 && s.anabolicPotential.value > 0.5 &&
    s.catabolicRisk.confidence > 0.4 && s.catabolicRisk.value > 0.5
  ) {
    conflictingSignals.push('anabolicPotential vs catabolicRisk')
  }

  const conflictSeverity = clamp(conflictingSignals.length / 3)

  return { positiveFactors, negativeFactors, ignoredSignals, conflictingSignals, conflictSeverity }
}

interface ComputeContext {
  latestBodyFat?: number | null
  gender?: 'male' | 'female' | null
  prefs?: CoachPhasePreferences
  locale?: PhaseEngineLocale
}

export function computePhaseOptimization(
  signals: DerivedSignals & { insufficientData?: boolean },
  ctx: ComputeContext = {},
): PhaseOptimizationResult {
  const { latestBodyFat = null, gender = null, prefs, locale = 'fr' } = ctx

  const dirResult = scoreEnergeticDirection(signals, latestBodyFat, gender ?? null, prefs)
  const adaptResult = scoreAdaptiveState(signals)

  const currentDirection = directionFromScore(dirResult.score, signals.dataQuality)
  const currentAdaptState = adaptiveStateFromScore(adaptResult.score)
  const opportunities = detectOpportunities(signals, currentDirection, currentAdaptState)
  const constraints = detectConstraints(signals)
  const trace = buildDecisionTrace(signals)

  const conflictPenalty = trace.conflictSeverity > 0.5
    ? ENGINE_THRESHOLDS.CONFLICT_SEVERITY_CONFIDENCE_CAP
    : 1
  const confidence = clamp(
    (dirResult.confidence * 0.5 + adaptResult.confidence * 0.5) *
    signals.dataReliability *
    conflictPenalty
  )

  let recDirScore = dirResult.score
  const recAdaptScore = adaptResult.score

  if (
    signals.catabolicRisk.value > ENGINE_THRESHOLDS.CATABOLIC_FORCE_MAINTENANCE &&
    signals.catabolicRisk.confidence > ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE
  ) {
    recDirScore = Math.max(recDirScore, -0.15)
  }

  const recDirection = directionFromScore(recDirScore, signals.dataQuality)
  const recAdaptState = adaptiveStateFromScore(recAdaptScore)

  let urgency: 'low' | 'medium' | 'high' = 'low'
  let horizon: RecommendationHorizon = 'mesocycle'

  if (currentAdaptState === 'recovery_crash') {
    urgency = 'high'
    horizon = 'acute'
  } else if (currentAdaptState === 'systemic_fatigue' || opportunities.includes('diet_break_candidate')) {
    urgency = 'medium'
    horizon = 'short_term'
  } else if (currentDirection !== recDirection) {
    urgency = 'medium'
    horizon = 'mesocycle'
  }

  const recommendationConfidence = clamp(confidence * (1 - trace.conflictSeverity * 0.4))
  const phaseFitScore = computePhaseFitScore(signals)
  const phaseFitConfidence = clamp(
    confidence * 0.65 +
      signals.phaseCompatibility.confidence * 0.2 +
      signals.bodyResponseMatch.confidence * 0.15,
  )

  const reasons = buildReasons(constraints, dirResult.score, adaptResult.score, locale)
  const microCopy = buildMicroCopy(currentDirection, recDirection, currentAdaptState, locale)

  return {
    phaseFit: {
      score: phaseFitScore,
      band: phaseFitBandFromScore(phaseFitScore),
      confidence: phaseFitConfidence,
    },
    phaseMatrix: evaluatePhaseMatrix(signals, phaseFitScore),
    currentState: {
      direction: currentDirection,
      adaptiveState: currentAdaptState,
      opportunityStates: opportunities,
      directionScore: dirResult.score,
      adaptiveScore: adaptResult.score,
      directionConfidence: dirResult.confidence,
      adaptiveConfidence: adaptResult.confidence,
    },
    recommendedAdjustment: {
      direction: recDirection,
      adaptiveState: recAdaptState,
      directionScore: recDirScore,
      adaptiveScore: recAdaptScore,
      urgency,
      horizon,
      recommendationConfidence,
    },
    confidence,
    constraintFlags: constraints,
    reasons,
    microCopy,
    alerts: buildAlerts(constraints, locale),
    decisionTrace: trace,
    dataQuality: signals.dataQuality,
    insufficientData: signals.insufficientData ?? signals.dataCoverage < 0.3,
    engineMetadata: {
      engineVersion: ENGINE_VERSION,
      evaluatedAt: new Date().toISOString(),
    },
  }
}
