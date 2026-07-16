import { describe, expect, it } from 'vitest'
import {
  findPlannedActualPair,
  resolveOverlayDisplayMode,
} from '@/lib/coach/metricsOverlay/displayMode'

const points = [{ date: '2026-07-01', value: 200 }]

describe('overlay display mode', () => {
  it('recognizes one planned-versus-actual nutrition measure', () => {
    expect(findPlannedActualPair([
      { key: 'carbs_consumed_g', family: 'nutrition', mode: 'consumed', unit: 'g', points },
      { key: 'carbs_planned_g', family: 'nutrition', mode: 'planned', unit: 'g', points },
    ])).toEqual({
      keys: ['carbs_consumed_g', 'carbs_planned_g'],
      unit: 'g',
      measureKey: 'carbs_g',
    })
  })

  it('keeps unrelated or multi-metric selections in indexed comparison mode', () => {
    expect(findPlannedActualPair([
      { key: 'protein_consumed_g', family: 'nutrition', mode: 'consumed', unit: 'g', points },
      { key: 'carbs_planned_g', family: 'nutrition', mode: 'planned', unit: 'g', points },
    ])).toBeNull()

    expect(findPlannedActualPair([
      { key: 'carbs_consumed_g', family: 'nutrition', mode: 'consumed', unit: 'g', points },
      { key: 'carbs_planned_g', family: 'nutrition', mode: 'planned', unit: 'g', points },
      { key: 'protein_planned_g', family: 'nutrition', mode: 'planned', unit: 'g', points },
    ])).toBeNull()
  })

  it('keeps every single metric on its real scale', () => {
    expect(resolveOverlayDisplayMode([
      { key: 'sleep_duration_h', family: 'recovery', mode: 'observed', unit: 'h', points },
    ])).toEqual({
      kind: 'single-absolute',
      key: 'sleep_duration_h',
      unit: 'h',
    })
  })

  it('uses indexed mode only for a true cross-metric comparison', () => {
    expect(resolveOverlayDisplayMode([
      { key: 'weight_kg', family: 'body', mode: 'observed', unit: 'kg', points },
      { key: 'sleep_duration_h', family: 'recovery', mode: 'observed', unit: 'h', points },
    ])).toEqual({ kind: 'indexed' })
  })
})
