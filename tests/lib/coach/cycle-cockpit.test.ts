import { describe, expect, it } from 'vitest'
import { buildCycleCockpitInsight } from '@/lib/coach/cycle-cockpit'
import type { CycleState } from '@/lib/cycle/cycleEngine'

const state: CycleState = {
  hasActiveCycle: true,
  currentPhase: 'luteal',
  currentCycleDay: 22,
  avgCycleLengthDays: 29,
  regularity: 'irregular',
  isPeriodStartExpected: false,
  menstrualPhaseLengthDays: 5,
  nextPhaseIn: 7,
  lastPeriodDate: '2026-06-23',
  lastPeriodEndDate: '2026-06-28',
  logsCount: 4,
  confidence: 'calibrated',
}

describe('buildCycleCockpitInsight', () => {
  it('keeps cycle guidance conditional on an active phase', () => {
    expect(buildCycleCockpitInsight(null)).toBeNull()
    expect(buildCycleCockpitInsight({ ...state, currentPhase: null })).toBeNull()
  })

  it('marks variable cycles as estimated and keeps their observed day', () => {
    const insight = buildCycleCockpitInsight(state)

    expect(insight?.phase).toBe('luteal')
    expect(insight?.cycleDay).toBe(22)
    expect(insight?.regularity).toBe('irregular')
    expect(insight?.isEstimated).toBe(true)
    expect(insight?.signals).toHaveLength(3)
  })
})
