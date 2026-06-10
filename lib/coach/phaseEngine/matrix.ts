import type {
  DerivedSignals,
  PhaseMatrixConditionCode,
  PhaseMatrixRule,
  PhaseMatrixStatus,
  PhaseOptimizationResult,
} from './types'

function buildMatrixResult(
  rule: PhaseMatrixRule,
  status: PhaseMatrixStatus,
  priority: PhaseOptimizationResult['phaseMatrix']['priority'],
  matchedConditions: PhaseMatrixConditionCode[],
): PhaseOptimizationResult['phaseMatrix'] {
  return {
    rule,
    status,
    priority,
    matchedConditions,
  }
}

export function evaluatePhaseMatrix(
  signals: DerivedSignals,
  phaseFitScore: number,
): PhaseOptimizationResult['phaseMatrix'] {
  const nutritionWeak =
    signals.nutritionAdherence.observed && signals.nutritionAdherence.value < 0.45
  const recoveryWeak =
    signals.recoveryCapacity.value < 0.38 || signals.fatigueIndex.value > 0.68
  const performanceWeak =
    signals.performanceTrend.observed && signals.performanceTrend.value < -0.2

  if (
    signals.cnsOverload ||
    (signals.physiologicalStressScore > 0.72 && signals.recoveryCapacity.value < 0.35)
  ) {
    const matchedConditions: PhaseMatrixConditionCode[] = []
    if (signals.rhrDelta?.isCnsOverloaded) matchedConditions.push('rhr_over_baseline')
    if (signals.physiologicalStressScore > 0.72) matchedConditions.push('high_physiological_stress')
    if (signals.recoveryCapacity.value < 0.35) matchedConditions.push('low_recovery_capacity')
    if (signals.fatigueIndex.value > 0.65) matchedConditions.push('high_fatigue')

    return buildMatrixResult(
      'recovery_overload',
      'not_adapted',
      'critical',
      matchedConditions,
    )
  }

  if (
    recoveryWeak &&
    performanceWeak &&
    signals.physiologicalStressScore > 0.6
  ) {
    return buildMatrixResult(
      'acute_under_recovery',
      'not_adapted',
      'high',
      [
        'high_physiological_stress',
        'low_recovery_capacity',
        'high_fatigue',
        'performance_drop',
      ],
    )
  }

  if (
    (
      nutritionWeak ||
      (signals.calorieCompliance.observed && signals.calorieCompliance.value < 0.6) ||
      (signals.proteinCompliance.observed && signals.proteinCompliance.value < 0.6)
    ) &&
    phaseFitScore < 75
  ) {
    return buildMatrixResult(
      'adherence_mismatch',
      'not_adapted',
      'high',
      [
        'low_nutrition_adherence',
        'phase_fit_fragile',
      ],
    )
  }

  if (
    signals.bodyResponseMatch.value < 0.4 &&
    signals.bodyResponseMatch.confidence >= 0.25
  ) {
    return buildMatrixResult(
      'body_response_mismatch',
      'not_adapted',
      'high',
      [
        'body_response_off_target',
        ...(performanceWeak ? ['performance_drop' as const] : []),
      ],
    )
  }

  if (
    signals.fatGainRisk.value > 0.62 &&
    signals.fatGainRisk.confidence >= 0.25
  ) {
    return buildMatrixResult(
      'fat_gain_mismatch',
      'not_adapted',
      'high',
      [
        'high_fat_gain_risk',
        'body_response_off_target',
      ],
    )
  }

  if (
    phaseFitScore < 60 ||
    signals.physiologicalStressScore > 0.55 ||
    signals.recoveryCapacity.value < 0.48
  ) {
    const matchedConditions: PhaseMatrixConditionCode[] = ['phase_fit_fragile']
    if (signals.physiologicalStressScore > 0.55) matchedConditions.push('high_physiological_stress')
    if (signals.recoveryCapacity.value < 0.48) matchedConditions.push('low_recovery_capacity')
    if (signals.fatigueIndex.value > 0.55) matchedConditions.push('high_fatigue')

    return buildMatrixResult(
      'fragile_workable',
      'partially_adapted',
      'medium',
      matchedConditions,
    )
  }

  if (
    phaseFitScore >= 80 &&
    signals.recoveryCapacity.value >= 0.58 &&
    signals.physiologicalStressScore <= 0.42 &&
    (!signals.nutritionAdherence.observed || signals.nutritionAdherence.value >= 0.65) &&
    (!signals.performanceTrend.observed || signals.performanceTrend.value >= 0)
  ) {
    const matchedConditions: PhaseMatrixConditionCode[] = [
      'phase_fit_optimal',
      'recovery_ready',
    ]
    if (!signals.performanceTrend.observed || signals.performanceTrend.value >= 0) {
      matchedConditions.push('performance_stable')
    }

    return buildMatrixResult(
      'optimal_alignment',
      'adapted',
      'low',
      matchedConditions,
    )
  }

  return buildMatrixResult(
    'stable_alignment',
    'adapted',
    'low',
    [
      'recovery_ready',
      ...(signals.performanceTrend.observed && signals.performanceTrend.value >= -0.05
        ? ['performance_stable' as const]
        : []),
    ],
  )
}
