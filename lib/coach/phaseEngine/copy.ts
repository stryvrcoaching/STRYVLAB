import type { ConstraintFlag, EnergeticDirection, AdaptiveState } from './types'
import {
  getPhaseEngineCopy,
  type PhaseEngineLocale,
} from './localeCopy'

export type { PhaseEngineLocale } from './localeCopy'
export { getPhaseEngineCopy, parsePhaseEngineLocale } from './localeCopy'

const fr = getPhaseEngineCopy('fr')

export const REASON_MAP = fr.reasonMap
export const URGENCY_LABELS = fr.urgencyLabels
export const OVERRIDE_TRACE_LABEL = fr.overrideTraceLabel
export const HORIZON_LABELS = fr.horizonLabels
export const DIRECTION_LABELS = fr.directionLabels
export const ADAPTIVE_STATE_LABELS = fr.adaptiveStateLabels
export const DATA_QUALITY_LABELS = fr.dataQualityLabels

export function buildReasons(
  flags: ConstraintFlag[],
  directionScore: number,
  adaptiveScore: number,
  locale: PhaseEngineLocale = 'fr',
): string[] {
  const c = getPhaseEngineCopy(locale)
  const reasons: string[] = flags.slice(0, 2).map(f => c.reasonMap[f])

  if (reasons.length === 0) {
    if (adaptiveScore < -0.4) reasons.push(c.fallbackReasons.fatigueHigh)
    else if (adaptiveScore > 0.3) reasons.push(c.fallbackReasons.recoveryOptimal)
    if (directionScore < -0.3) reasons.push(c.fallbackReasons.deficitDirection)
    else if (directionScore > 0.3) reasons.push(c.fallbackReasons.surplusDirection)
  }

  if (reasons.length === 0) reasons.push(c.fallbackReasons.stable)

  return reasons.slice(0, 3)
}

export function buildMicroCopy(
  currentDirection: EnergeticDirection,
  recommendedDirection: EnergeticDirection,
  adaptiveState: AdaptiveState,
  locale: PhaseEngineLocale = 'fr',
): string {
  const c = getPhaseEngineCopy(locale)

  if (adaptiveState === 'recovery_crash') return c.microCopy.recoveryCrash
  if (adaptiveState === 'systemic_fatigue') return c.microCopy.systemicFatigue
  if (currentDirection !== recommendedDirection) {
    const target = c.directionLabels[recommendedDirection].toLowerCase()
    return c.microCopy.directionShift(target)
  }
  if (adaptiveState === 'supercompensated') return c.microCopy.supercompensated
  if (adaptiveState === 'recovered') return c.microCopy.recovered
  return c.microCopy.default
}

export function buildAlerts(
  flags: ConstraintFlag[],
  locale: PhaseEngineLocale = 'fr',
) {
  const c = getPhaseEngineCopy(locale)
  return flags.map(f => ({ flag: f, ...c.alertMessages[f] }))
}
