import type { OverlayMetricFamily, OverlayMetricMode, OverlaySeriesPoint } from './types'

export interface OverlayDisplayMetric {
  key: string
  family: OverlayMetricFamily
  mode: OverlayMetricMode
  unit: string
  points: OverlaySeriesPoint[]
}

export interface PlannedActualPair {
  keys: [string, string]
  unit: string
  measureKey: string
}

export type OverlayDisplayMode =
  | { kind: 'indexed' }
  | { kind: 'single-absolute'; key: string; unit: string }
  | { kind: 'planned-actual'; pair: PlannedActualPair }

function measureKey(key: string) {
  return key
    .replace('_consumed_', '_')
    .replace('_planned_', '_')
}

/**
 * A planned-versus-actual comparison is meaningful in real units only when
 * the coach selected exactly the two sides of one measure (for example carbs
 * consumed + carbs planned). Indexing them from separate first observations
 * would create a misleading percentage scale.
 */
export function findPlannedActualPair(
  metrics: OverlayDisplayMetric[],
): PlannedActualPair | null {
  const withData = metrics.filter((metric) => metric.points.length > 0)
  if (withData.length !== 2) return null

  const [left, right] = withData
  if (
    left.family !== 'nutrition' ||
    right.family !== 'nutrition' ||
    left.unit !== right.unit ||
    measureKey(left.key) !== measureKey(right.key)
  ) {
    return null
  }

  const hasConsumed = left.mode === 'consumed' || right.mode === 'consumed'
  const hasPlanned = left.mode === 'planned' || right.mode === 'planned'
  if (!hasConsumed || !hasPlanned) return null

  const consumed = left.mode === 'consumed' ? left : right
  const planned = left.mode === 'planned' ? left : right

  return {
    keys: [consumed.key, planned.key],
    unit: consumed.unit,
    measureKey: measureKey(consumed.key),
  }
}

/**
 * Chooses a readable scale without silently mixing two different meanings.
 * One metric is always shown in its real unit; two exact planned/actual sides
 * are also real. Any broader cross-metric selection remains indexed so that
 * incompatible units do not flatten one another.
 */
export function resolveOverlayDisplayMode(
  metrics: OverlayDisplayMetric[],
): OverlayDisplayMode {
  const withData = metrics.filter((metric) => metric.points.length > 0)
  if (withData.length === 1) {
    return {
      kind: 'single-absolute',
      key: withData[0].key,
      unit: withData[0].unit,
    }
  }

  const pair = findPlannedActualPair(withData)
  return pair ? { kind: 'planned-actual', pair } : { kind: 'indexed' }
}
