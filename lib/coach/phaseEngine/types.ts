// lib/coach/phaseEngine/types.ts

export type OptimalPhaseType = 
  | 'AGGRESSIVE_CUT'
  | 'MODERATE_CUT'
  | 'MAINTENANCE'
  | 'LEAN_BULK'
  | 'DELOAD'
  | 'PEAK_WEEK';

export type EnergeticDirection =
  | 'aggressive_deficit' | 'controlled_deficit'
  | 'maintenance'
  | 'controlled_surplus' | 'aggressive_surplus'

export type AdaptiveState =
  | 'recovery_crash'
  | 'systemic_fatigue'
  | 'high_fatigue'
  | 'stable'
  | 'recovered'
  | 'supercompensated'

export type OpportunityState =
  | 'anabolic_window'
  | 'peak_readiness'
  | 'diet_break_candidate'

export type ConstraintFlag =
  | 'low_energy_availability'
  | 'poor_adherence'
  | 'high_stress_load'
  | 'recovery_bottleneck'
  | 'possible_muscle_loss'
  | 'cns_overload'
  | 'catabolic_risk'

export type RecommendationHorizon =
  | 'acute'
  | 'short_term'
  | 'mesocycle'

export type PhaseMatrixRule =
  | 'recovery_overload'
  | 'acute_under_recovery'
  | 'adherence_mismatch'
  | 'body_response_mismatch'
  | 'fat_gain_mismatch'
  | 'fragile_workable'
  | 'optimal_alignment'
  | 'stable_alignment'

export type PhaseMatrixStatus = 'adapted' | 'partially_adapted' | 'not_adapted'

export type PhaseMatrixConditionCode =
  | 'rhr_over_baseline'
  | 'high_physiological_stress'
  | 'low_recovery_capacity'
  | 'high_fatigue'
  | 'low_nutrition_adherence'
  | 'performance_drop'
  | 'body_response_off_target'
  | 'high_fat_gain_risk'
  | 'phase_fit_optimal'
  | 'phase_fit_fragile'
  | 'recovery_ready'
  | 'performance_stable'

export type DataQuality = 'minimal' | 'limited' | 'good' | 'high'

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'
export type CurrentPhase = 'bulk' | 'cut' | 'recomp' | 'maintenance'
export type CyclicProtocolMode = 'deficit' | 'maintenance' | 'surplus'

export interface PhaseClientProfile {
  experienceLevel: ExperienceLevel
  currentPhase: CurrentPhase
  cyclicProtocolMode: CyclicProtocolMode | null
}

export interface ProgressionContext {
  overloadEventCount: number
  compoundOneRmImproving: boolean
  recentPrDetected: boolean
}

export interface SignalValue {
  value: number
  observed: boolean
  confidence: number
  sourceReliability?: number
}

export interface NutritionAdherenceInput {
  target: {
    calories?: number | null
    protein_g?: number | null
    carbs_g?: number | null
    fat_g?: number | null
    hydration_ml?: number | null
  }
  actual: {
    avgCalories?: number | null
    avgProteinG?: number | null
    avgCarbsG?: number | null
    avgFatG?: number | null
    avgHydrationMl?: number | null
  }
  adherence: {
    loggedDays: number
    expectedDays: number
    calorieDeltaAvg?: number | null
    proteinDeltaAvg?: number | null
    hydrationDeltaAvg?: number | null
  }
  source: 'meal_logs' | 'protocol_only' | 'mixed' | 'none'
}

export interface RawSignalInput {
  weightSeries:   { date: string; value: number; source?: 'manual' | 'wearable'; capturedAt?: string }[]
  bodyFatSeries:  { date: string; value: number; source?: 'dexa' | 'bioimpedance' | 'manual'; capturedAt?: string }[]
  leanMassSeries: { date: string; value: number; capturedAt?: string }[]
  waistSeries:    { date: string; value: number; capturedAt?: string }[]
  checkin: {
    energy?: number | null
    sleep_quality?: number | null
    sleep_duration?: number | null
    stress?: number | null
    muscle_soreness?: number | null
    hunger?: number | null
    steps?: number | null
  }
  checkinResponseRate: number
  anchorDate?: string
  rhrSeries: { date: string; value: number }[]
  performance: {
    exercises: {
      exercise_id: string
      exercise_name: string
      completion_rate: number
      avg_rir: number | null
      prescribed_rir: number | null
      overloads_last_4_weeks: number
      stagnation: boolean
      overreaching: boolean
      load_progressing: boolean
      intentional_intensity: boolean
    }[]
    global_overreaching: boolean
    sessionsCount: number
    weeklyFrequency: number
  }
  clientProfile: PhaseClientProfile
  progression: ProgressionContext
  nutrition?: NutritionAdherenceInput | null
  latestBodyFat: number | null
  gender: 'male' | 'female' | null
  windowDays: number
}

export interface DerivedSignals {
  weightTrend: SignalValue
  bodyFatTrend: SignalValue
  waistTrend: SignalValue | null
  performanceTrend: SignalValue
  recoveryTrend: SignalValue
  probableMuscleGain: SignalValue
  probableFatGain: SignalValue
  catabolicRisk: SignalValue
  anabolicPotential: SignalValue
  fatigueIndex: SignalValue
  recoveryCapacity: SignalValue
  trainingTolerance: SignalValue
  nutritionAdherence: SignalValue
  calorieCompliance: SignalValue
  proteinCompliance: SignalValue
  hydrationCompliance: SignalValue
  bodyResponseMatch: SignalValue
  phaseCompatibility: SignalValue
  stepLoadStability: SignalValue
  energyAvailabilityConsistency: SignalValue
  fatGainRisk: SignalValue
  rhrDelta?: {
    currentRhr: number | null;
    baselineRhr: number | null;
    deviationPercentage: number | null;
    isCnsOverloaded: boolean;
  };
  cnsOverload?: boolean;
  physiologicalStressScore: number
  dataCoverage: number
  dataReliability: number
  dataQuality: DataQuality
}

export interface CoachPhasePreferences {
  prioritizePerformance: boolean
  aggressiveCutTolerance: number
  preferredBulkAggressiveness: number
}

export interface PhaseAlert {
  flag: ConstraintFlag
  message: string
  severity: 'low' | 'medium' | 'high'
}

export interface PhaseOptimizationResult {
  phaseFit: {
    score: number
    band: 'optimal' | 'workable' | 'fragile' | 'incoherent'
    confidence: number
  }
  phaseMatrix: {
    rule: PhaseMatrixRule
    status: PhaseMatrixStatus
    priority: 'critical' | 'high' | 'medium' | 'low'
    matchedConditions: PhaseMatrixConditionCode[]
  }
  currentState: {
    direction: EnergeticDirection
    adaptiveState: AdaptiveState
    opportunityStates: OpportunityState[]
    directionScore: number
    adaptiveScore: number
    directionConfidence: number
    adaptiveConfidence: number
  }
  recommendedAdjustment: {
    direction: EnergeticDirection
    adaptiveState: AdaptiveState
    directionScore: number
    adaptiveScore: number
    urgency: 'low' | 'medium' | 'high'
    horizon: RecommendationHorizon
    recommendationConfidence: number
  }
  confidence: number
  constraintFlags: ConstraintFlag[]
  reasons: string[]
  microCopy: string
  alerts: PhaseAlert[]
  decisionTrace: {
    positiveFactors: string[]
    negativeFactors: string[]
    ignoredSignals: string[]
    conflictingSignals: string[]
    conflictSeverity: number
  }
  dataQuality: DataQuality
  insufficientData: boolean
  manualOverride?: {
    active: boolean
    direction?: EnergeticDirection
    adaptiveState?: AdaptiveState
    reason?: string
  }
  engineMetadata: {
    engineVersion: string
    evaluatedAt: string
  }
}

export interface PhaseCoachDecision {
  headline: string
  recommendation: string
  confidencePct: number
  phaseFitScorePct: number
  phaseFitBand: 'optimal' | 'workable' | 'fragile' | 'incoherent'
  matrix: {
    rule: PhaseMatrixRule
    status: PhaseMatrixStatus
    priority: 'critical' | 'high' | 'medium' | 'low'
    title: string
    summary: string
    rationale: string
    matchedConditions: string[]
  }
  horizon: RecommendationHorizon
  primaryDrivers: string[]
  watchouts: string[]
  confidenceModel: {
    scorePct: number
    level: 'low' | 'moderate' | 'high'
    factors: {
      coveragePct: number
      freshnessPct: number
      sourceReliabilityPct: number
      coherencePct: number
      adherencePct: number
      rhrBaselinePct: number
    }
    strengths: string[]
    limitations: string[]
  }
  sevenDayTrajectory: {
    strategy: 'deload' | 'progressive_reload' | 'maintain'
    title: string
    summary: string
    days: {
      day: number
      focus: string
      intensityPct: number
      nutrition: string
      exitCriteria: string[]
    }[]
  }
  temporal: {
    summary: string
    changes: string[]
    previousPoint: {
      recordedOn: string
      directionScore: number
      adaptiveScore: number
    } | null
    deltas: {
      directionScore: number | null
      adaptiveScore: number | null
    }
    rhr: {
      sevenDayAvg: number | null
      thirtyDayAvg: number | null
      deltaBpm: number | null
    }
  }
  baselines: {
    rhr: {
      current: number | null
      baseline: number | null
      deviationPct: number | null
      sampleCount: number
      status: 'overload' | 'stable' | 'insufficient'
    }
    recovery: {
      capacityPct: number
      fatiguePct: number
      confidencePct: number
    }
    body: {
      weightTrendKgPerWeek: number | null
      bodyFatTrendPctPerWeek: number | null
    }
    performance: {
      trendPct: number | null
      confidencePct: number
    }
    nutrition: {
      adherencePct: number | null
      calorieDeltaPct: number | null
      proteinDeltaPct: number | null
      loggedDays: number
      source: NutritionAdherenceInput['source'] | 'none'
    }
  }
}
