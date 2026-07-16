import type { CycleState } from '@/lib/cycle/cycleEngine'
import type { CycleSyncAdjustment } from '@/lib/nutrition/engine/cycleSync'

export type CycleSyncProfileMode = 'conservative' | 'standard' | 'custom'

export type CycleSyncProfile = {
  mode: CycleSyncProfileMode
  intensity_percent: number
}

export const DEFAULT_CYCLE_SYNC_PROFILE: CycleSyncProfile = {
  mode: 'standard',
  intensity_percent: 100,
}

export function normalizeCycleSyncProfile(value: unknown): CycleSyncProfile {
  const input = value && typeof value === 'object' ? value as Partial<CycleSyncProfile> : {}
  const mode: CycleSyncProfileMode = input.mode === 'conservative' || input.mode === 'custom'
    ? input.mode
    : 'standard'
  const requestedIntensity = Number(input.intensity_percent)
  const customIntensity = Math.round(Math.min(125, Math.max(25, Number.isFinite(requestedIntensity) ? requestedIntensity : 100)))

  return {
    mode,
    intensity_percent: mode === 'conservative' ? 50 : mode === 'standard' ? 100 : customIntensity,
  }
}

function getConfidenceFactor(cycleState: Pick<CycleState, 'confidence' | 'regularity'>) {
  const confidenceFactor = cycleState.confidence === 'calibrated'
    ? 1
    : cycleState.confidence === 'learning'
      ? 0.7
      : 0.4

  return cycleState.regularity === 'irregular'
    ? Math.min(confidenceFactor, 0.65)
    : confidenceFactor
}

function roundHydration(value: number) {
  return Math.round(value / 50) * 50
}

export type EffectiveCycleSyncAdjustment = {
  adjustment: CycleSyncAdjustment
  appliedFactor: number
  confidenceFactor: number
  profile: CycleSyncProfile
  isCautious: boolean
}

export function getEffectiveCycleSyncAdjustment(args: {
  adjustment: CycleSyncAdjustment
  cycleState: Pick<CycleState, 'confidence' | 'regularity'>
  profile?: unknown
}): EffectiveCycleSyncAdjustment {
  const profile = normalizeCycleSyncProfile(args.profile)
  const confidenceFactor = getConfidenceFactor(args.cycleState)
  const appliedFactor = Math.min(1.25, (profile.intensity_percent / 100) * confidenceFactor)
  const proteinDelta = Math.round(args.adjustment.proteinDelta * appliedFactor)
  const carbsDelta = Math.round(args.adjustment.carbsDelta * appliedFactor)
  const fatDelta = Math.round(args.adjustment.fatDelta * appliedFactor)

  return {
    adjustment: {
      ...args.adjustment,
      proteinDelta,
      carbsDelta,
      fatDelta,
      caloriesDelta: proteinDelta * 4 + carbsDelta * 4 + fatDelta * 9,
      hydrationDeltaMl: roundHydration(args.adjustment.hydrationDeltaMl * appliedFactor),
    },
    appliedFactor,
    confidenceFactor,
    profile,
    isCautious: appliedFactor < 0.99,
  }
}
