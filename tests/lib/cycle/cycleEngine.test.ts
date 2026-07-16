import { describe, it, expect } from 'vitest'
import {
  hasActiveCycleFromBilan,
  computeAvgCycleLength,
  getCycleRegularity,
  getObservedCycleLengths,
  computeAvgMenstrualLength,
  computeCurrentCycleDay,
  detectPhase,
  computeNextPhaseIn,
  getCycleStateFromLogs,
} from '@/lib/cycle/cycleEngine'
import type { CycleLog } from '@/lib/cycle/cycleEngine'

// ── hasActiveCycleFromBilan ──────────────────────────────────────────

describe('hasActiveCycleFromBilan', () => {
  it('returns false for Ménopause / Aménorrhée', () => {
    expect(hasActiveCycleFromBilan('Ménopause / Aménorrhée')).toBe(false)
  })
  it('returns false for Non applicable', () => {
    expect(hasActiveCycleFromBilan('Non applicable')).toBe(false)
  })
  it('returns true for null (unknown = assume active)', () => {
    expect(hasActiveCycleFromBilan(null)).toBe(true)
  })
  it('returns true for active phase value', () => {
    expect(hasActiveCycleFromBilan('Phase folliculaire (J1–J13)')).toBe(true)
  })
})

// ── computeAvgCycleLength ────────────────────────────────────────────

const makeLog = (length: number | null): CycleLog => ({
  period_start_date: '2026-01-01',
  period_end_date: null,
  computed_cycle_length_days: length,
})

describe('computeAvgCycleLength', () => {
  it('returns 28 for empty logs', () => {
    expect(computeAvgCycleLength([])).toBe(28)
  })
  it('returns 28 when all lengths are null', () => {
    expect(computeAvgCycleLength([makeLog(null)])).toBe(28)
  })
  it('averages multiple valid lengths', () => {
    expect(computeAvgCycleLength([makeLog(27), makeLog(29), makeLog(28)])).toBe(28)
  })
  it('keeps plausible intervals outside the standard range', () => {
    expect(computeAvgCycleLength([makeLog(15), makeLog(28)])).toBe(22)
  })
  it('rounds correctly', () => {
    expect(computeAvgCycleLength([makeLog(27), makeLog(28)])).toBe(28)
  })
})

describe('observed cycle adaptation', () => {
  it('uses the median of observed start-to-start intervals', () => {
    const logs: CycleLog[] = [
      { period_start_date: '2026-03-31', period_end_date: null, computed_cycle_length_days: null },
      { period_start_date: '2026-02-28', period_end_date: null, computed_cycle_length_days: null },
      { period_start_date: '2026-02-01', period_end_date: null, computed_cycle_length_days: null },
      { period_start_date: '2026-01-01', period_end_date: null, computed_cycle_length_days: null },
    ]

    expect(getObservedCycleLengths(logs)).toEqual([31, 27, 31])
    expect(computeAvgCycleLength(logs)).toBe(31)
  })

  it('keeps variable but plausible cycles in the adaptive estimate', () => {
    const logs: CycleLog[] = [
      { period_start_date: '2026-04-25', period_end_date: null, computed_cycle_length_days: null },
      { period_start_date: '2026-03-14', period_end_date: null, computed_cycle_length_days: null },
      { period_start_date: '2026-02-01', period_end_date: null, computed_cycle_length_days: null },
      { period_start_date: '2026-01-01', period_end_date: null, computed_cycle_length_days: null },
    ]

    expect(getCycleRegularity(logs)).toBe('irregular')
    expect(computeAvgCycleLength(logs)).toBe(41)
  })
})

// ── computeAvgMenstrualLength ────────────────────────────────────────

describe('computeAvgMenstrualLength', () => {
  it('returns 5 for empty logs', () => {
    expect(computeAvgMenstrualLength([])).toBe(5)
  })
  it('returns 5 when no end dates', () => {
    expect(computeAvgMenstrualLength([makeLog(28)])).toBe(5)
  })
  it('calculates from start/end date diff', () => {
    const log: CycleLog = {
      period_start_date: '2026-05-01',
      period_end_date: '2026-05-05',
      computed_cycle_length_days: 28,
    }
    expect(computeAvgMenstrualLength([log])).toBe(4)
  })
})

// ── computeCurrentCycleDay ───────────────────────────────────────────

describe('computeCurrentCycleDay', () => {
  it('returns 1 on the day of period start', () => {
    const today = new Date('2026-06-01')
    expect(computeCurrentCycleDay('2026-06-01', 28, today)).toBe(1)
  })
  it('returns 14 on day 14', () => {
    const today = new Date('2026-06-14')
    expect(computeCurrentCycleDay('2026-06-01', 28, today)).toBe(14)
  })
  it('wraps correctly after full cycle', () => {
    // start May 1, today = May 29 = day 29 of 28-day cycle = day 1 of next cycle
    const today = new Date('2026-05-29')
    expect(computeCurrentCycleDay('2026-05-01', 28, today)).toBe(1)
  })
})

// ── detectPhase ──────────────────────────────────────────────────────

describe('detectPhase (28d cycle, 5d menstrual)', () => {
  it('day 1–5 = menstrual', () => {
    expect(detectPhase(1, 28, 5)).toBe('menstrual')
    expect(detectPhase(5, 28, 5)).toBe('menstrual')
  })
  it('day 6–13 = follicular', () => {
    expect(detectPhase(6, 28, 5)).toBe('follicular')
    expect(detectPhase(13, 28, 5)).toBe('follicular')
  })
  it('day 14–15 = ovulatory', () => {
    expect(detectPhase(14, 28, 5)).toBe('ovulatory')
    expect(detectPhase(15, 28, 5)).toBe('ovulatory')
  })
  it('day 16–28 = luteal', () => {
    expect(detectPhase(16, 28, 5)).toBe('luteal')
    expect(detectPhase(28, 28, 5)).toBe('luteal')
  })
})

describe('detectPhase (30d cycle, 4d menstrual)', () => {
  it('ovulation at day 15 (floor(30/2))', () => {
    expect(detectPhase(15, 30, 4)).toBe('ovulatory')
  })
  it('follicular from day 5 to 14', () => {
    expect(detectPhase(10, 30, 4)).toBe('follicular')
  })
})

// ── getCycleStateFromLogs ────────────────────────────────────────────

describe('getCycleStateFromLogs — no active cycle', () => {
  it('returns hasActiveCycle: false, nulls for phase', () => {
    const state = getCycleStateFromLogs([], 'Ménopause / Aménorrhée', new Date())
    expect(state.hasActiveCycle).toBe(false)
    expect(state.currentPhase).toBeNull()
    expect(state.currentCycleDay).toBeNull()
  })
})

describe('getCycleStateFromLogs — no logs, estimated from bilan', () => {
  it('estimates follicular from bilan text', () => {
    const state = getCycleStateFromLogs([], 'Phase folliculaire (J1–J13)', new Date())
    expect(state.confidence).toBe('estimated')
    expect(state.currentPhase).toBe('follicular')
    expect(state.currentCycleDay).toBe(7)
  })
  it('estimates luteal from bilan text', () => {
    const state = getCycleStateFromLogs([], 'Phase lutéale (J15–J28)', new Date())
    expect(state.currentPhase).toBe('luteal')
    expect(state.currentCycleDay).toBe(21)
  })
  it('returns null phase for unknown bilan value', () => {
    const state = getCycleStateFromLogs([], null, new Date())
    expect(state.currentPhase).toBeNull()
    expect(state.confidence).toBe('estimated')
  })
})

describe('getCycleStateFromLogs — with logs', () => {
  it('confidence = learning for 1–3 logs', () => {
    const logs: CycleLog[] = [
      { period_start_date: '2026-05-01', period_end_date: null, computed_cycle_length_days: 28 },
    ]
    const state = getCycleStateFromLogs(logs, null, new Date('2026-05-08'))
    expect(state.confidence).toBe('learning')
    expect(state.currentCycleDay).toBe(8)
    expect(state.currentPhase).toBe('follicular')
  })
  it('confidence = calibrated for 4+ logs', () => {
    const logs: CycleLog[] = Array.from({ length: 4 }, (_, i) => ({
      period_start_date: `2026-0${i + 1}-01`,
      period_end_date: null,
      computed_cycle_length_days: 28,
    }))
    const state = getCycleStateFromLogs(logs, null, new Date('2026-04-15'))
    expect(state.confidence).toBe('calibrated')
  })
  it('uses personal avgCycleLengthDays', () => {
    const logs: CycleLog[] = [
      { period_start_date: '2026-05-01', period_end_date: null, computed_cycle_length_days: 26 },
      { period_start_date: '2026-04-05', period_end_date: null, computed_cycle_length_days: 26 },
    ]
    const state = getCycleStateFromLogs(logs, null, new Date('2026-05-08'))
    expect(state.avgCycleLengthDays).toBe(26)
  })

  it('asks for a period-start confirmation around the learned date', () => {
    const state = getCycleStateFromLogs([
      { period_start_date: '2026-05-01', period_end_date: null, computed_cycle_length_days: 28 },
    ], null, new Date('2026-05-27'))

    expect(state.isPeriodStartExpected).toBe(true)
  })

  it('exposes whether the latest period has been completed', () => {
    const state = getCycleStateFromLogs([
      { period_start_date: '2026-05-01', period_end_date: '2026-05-05', computed_cycle_length_days: 28 },
    ], null, new Date('2026-05-08'))

    expect(state.lastPeriodDate).toBe('2026-05-01')
    expect(state.lastPeriodEndDate).toBe('2026-05-05')
  })
})
