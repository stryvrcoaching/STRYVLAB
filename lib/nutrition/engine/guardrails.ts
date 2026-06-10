// lib/nutrition/engine/guardrails.ts
// Algorithmic blockers — guard against auto-adjustment when data signals a behavioral or
// recovery problem (not a metabolic one)

interface FatigueInput {
  avgSleepH: number | null
  avgEnergyLevel: number | null  // 1-5 from checkins
  avgStressLevel: number | null  // 1-5 from checkins
  consecutiveFatigueDays: number
}

interface GuardrailResult {
  blocked: boolean
  reason: 'adherence_block' | 'fatigue_block' | null
}

export function checkAdherenceGuardrail(
  adherencePct: number | null,
): GuardrailResult {
  if (adherencePct === null) return { blocked: false, reason: null }
  if (adherencePct < 0.85) return { blocked: true, reason: 'adherence_block' }
  return { blocked: false, reason: null }
}

export function checkFatigueGuardrail(input: FatigueInput): GuardrailResult {
  const poorSleep = input.avgSleepH !== null && input.avgSleepH < 6
  const lowEnergy = input.avgEnergyLevel !== null && input.avgEnergyLevel <= 2
  const highStress = input.avgStressLevel !== null && input.avgStressLevel >= 4
  const hasFatigueSignal = poorSleep || lowEnergy || highStress
  if (hasFatigueSignal && input.consecutiveFatigueDays >= 3) {
    return { blocked: true, reason: 'fatigue_block' }
  }
  return { blocked: false, reason: null }
}

interface RunGuardrailsInput extends FatigueInput {
  adherencePct: number | null
}

// Returns .triggered (the reason) or null — adherence takes priority over fatigue
export function runGuardrails(input: RunGuardrailsInput): {
  triggered: 'adherence_block' | 'fatigue_block' | null
} {
  const adherence = checkAdherenceGuardrail(input.adherencePct)
  if (adherence.blocked) return { triggered: adherence.reason }
  const fatigue = checkFatigueGuardrail(input)
  return { triggered: fatigue.reason }
}
