import type { EnergeticDirection, AdaptiveState, DataQuality, PhaseOptimizationResult } from './types'

export interface PhaseHistoryPoint {
  recordedOn: string
  directionScore: number
  adaptiveScore: number
  direction: EnergeticDirection
  adaptiveState: AdaptiveState
}

export function snapshotFromResult(result: PhaseOptimizationResult): Omit<PhaseHistoryPoint, 'recordedOn'> & {
  dataQuality: DataQuality
} {
  const { currentState: cs } = result
  return {
    directionScore: cs.directionScore,
    adaptiveScore: cs.adaptiveScore,
    direction: cs.direction,
    adaptiveState: cs.adaptiveState,
    dataQuality: result.dataQuality,
  }
}

export function parseHistoryRows(
  rows: {
    recorded_on: string
    direction_score: number
    adaptive_score: number
    direction: string
    adaptive_state: string
  }[] | null,
): PhaseHistoryPoint[] {
  if (!rows?.length) return []
  return rows.map(r => ({
    recordedOn: r.recorded_on,
    directionScore: Number(r.direction_score),
    adaptiveScore: Number(r.adaptive_score),
    direction: r.direction as EnergeticDirection,
    adaptiveState: r.adaptive_state as AdaptiveState,
  }))
}
