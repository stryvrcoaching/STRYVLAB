import type {
  CoachPhasePreferences,
  EnergeticDirection,
  AdaptiveState,
  PhaseOptimizationResult,
} from './types'
import { getPhaseEngineCopy, type PhaseEngineLocale } from './localeCopy'
import { deriveCoachPhasePreferences } from './prefs'

export interface StoredPhaseOverride {
  active: boolean
  direction?: EnergeticDirection
  adaptiveState?: AdaptiveState
  reason?: string
  setAt?: string
}

export function parseStoredPhaseOverride(raw: unknown): StoredPhaseOverride | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.active !== 'boolean') return null
  return {
    active: o.active,
    direction: typeof o.direction === 'string' ? (o.direction as EnergeticDirection) : undefined,
    adaptiveState: typeof o.adaptiveState === 'string' ? (o.adaptiveState as AdaptiveState) : undefined,
    reason: typeof o.reason === 'string' ? o.reason : undefined,
    setAt: typeof o.setAt === 'string' ? o.setAt : undefined,
  }
}

export function parseStoredPhasePreferences(raw: unknown): Partial<CoachPhasePreferences> | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const prefs: Partial<CoachPhasePreferences> = {}
  if (typeof o.prioritizePerformance === 'boolean') prefs.prioritizePerformance = o.prioritizePerformance
  if (typeof o.aggressiveCutTolerance === 'number') {
    prefs.aggressiveCutTolerance = Math.max(0, Math.min(1, o.aggressiveCutTolerance))
  }
  if (typeof o.preferredBulkAggressiveness === 'number') {
    prefs.preferredBulkAggressiveness = Math.max(0, Math.min(1, o.preferredBulkAggressiveness))
  }
  return Object.keys(prefs).length > 0 ? prefs : null
}

export function resolveCoachPhasePreferences(
  trainingGoal: string | null | undefined,
  stored: Partial<CoachPhasePreferences> | null,
): CoachPhasePreferences {
  const base = deriveCoachPhasePreferences(trainingGoal)
  if (!stored) return base
  return { ...base, ...stored }
}

export function applyManualOverride(
  result: PhaseOptimizationResult,
  stored: StoredPhaseOverride | null,
  locale: PhaseEngineLocale = 'fr',
): PhaseOptimizationResult {
  if (!stored?.active) {
    return { ...result, manualOverride: { active: false } }
  }

  const rec = { ...result.recommendedAdjustment }
  if (stored.direction) rec.direction = stored.direction
  if (stored.adaptiveState) rec.adaptiveState = stored.adaptiveState

  const trace = { ...result.decisionTrace }
  if (!trace.conflictingSignals.includes('override_coach_actif')) {
    trace.conflictingSignals = [...trace.conflictingSignals, 'override_coach_actif']
  }

  return {
    ...result,
    recommendedAdjustment: rec,
    manualOverride: {
      active: true,
      direction: stored.direction,
      adaptiveState: stored.adaptiveState,
      reason: stored.reason,
    },
    decisionTrace: trace,
    microCopy: stored.reason?.trim()
      ? `${getPhaseEngineCopy(locale).manualOverridePrefix} : ${stored.reason.trim()}`
      : result.microCopy,
  }
}
