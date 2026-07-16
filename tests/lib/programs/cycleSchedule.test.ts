import { describe, expect, it } from 'vitest'
import {
  resolveProgramCycleSchedule,
  selectSessionsForProgramWeek,
} from '@/lib/programs/cycleSchedule'

describe('resolveProgramCycleSchedule', () => {
  it('keeps legacy programmes on the legacy session set', () => {
    expect(resolveProgramCycleSchedule({
      dateIso: '2026-07-20',
      startDateIso: '2026-07-06',
      explicitWeekCount: 0,
      durationWeeks: 8,
    })).toEqual({
      elapsedWeekIndex: 2,
      activeWeekPosition: null,
      cycleIteration: 0,
      isBeforeStart: false,
      isComplete: false,
    })
  })

  it('resolves an explicit programme week from the assignment start date', () => {
    expect(resolveProgramCycleSchedule({
      dateIso: '2026-07-20',
      startDateIso: '2026-07-06',
      explicitWeekCount: 4,
      durationWeeks: 8,
    }).activeWeekPosition).toBe(2)
  })

  it('repeats the explicit cycle by default', () => {
    expect(resolveProgramCycleSchedule({
      dateIso: '2026-08-10',
      startDateIso: '2026-07-06',
      explicitWeekCount: 4,
      durationWeeks: 8,
    })).toMatchObject({
      elapsedWeekIndex: 5,
      activeWeekPosition: 1,
      cycleIteration: 1,
      isComplete: false,
    })
  })

  it('stops exposing sessions after a finite programme', () => {
    expect(resolveProgramCycleSchedule({
      dateIso: '2026-08-31',
      startDateIso: '2026-07-06',
      explicitWeekCount: 4,
      durationWeeks: 8,
      completionBehavior: 'stop',
    })).toMatchObject({
      elapsedWeekIndex: 8,
      activeWeekPosition: null,
      isComplete: true,
    })
  })

  it('holds the last explicit week after completion when configured', () => {
    expect(resolveProgramCycleSchedule({
      dateIso: '2026-08-31',
      startDateIso: '2026-07-06',
      explicitWeekCount: 4,
      durationWeeks: 8,
      completionBehavior: 'hold_last',
    })).toMatchObject({
      activeWeekPosition: 3,
      cycleIteration: 1,
      isComplete: true,
    })
  })

  it('does not expose a week before the scheduled start date', () => {
    expect(resolveProgramCycleSchedule({
      dateIso: '2026-07-05',
      startDateIso: '2026-07-06',
      explicitWeekCount: 4,
    })).toEqual({
      elapsedWeekIndex: -1,
      activeWeekPosition: null,
      cycleIteration: 0,
      isBeforeStart: true,
      isComplete: false,
    })
  })

  it('rejects ambiguous date inputs so timezone conversion stays outside the engine', () => {
    expect(() => resolveProgramCycleSchedule({
      dateIso: '2026-07-06T08:00:00Z',
      startDateIso: '2026-07-06',
      explicitWeekCount: 4,
    })).toThrow('Invalid ISO date')
  })

  it('rejects calendar dates that do not exist', () => {
    expect(() => resolveProgramCycleSchedule({
      dateIso: '2026-02-31',
      startDateIso: '2026-02-01',
      explicitWeekCount: 4,
    })).toThrow('Invalid ISO date')
  })
})

describe('selectSessionsForProgramWeek', () => {
  const sessions = [
    { id: 'legacy', program_week_id: null },
    { id: 'week-1-session', program_week_id: 'week-1' },
    { id: 'week-2-session', program_week_id: 'week-2' },
  ]

  it('preserves every session for a legacy programme', () => {
    expect(selectSessionsForProgramWeek(sessions, [], null)).toEqual(sessions)
  })

  it('returns only sessions attached to the active explicit week', () => {
    expect(selectSessionsForProgramWeek(sessions, [
      { id: 'week-1', position: 0 },
      { id: 'week-2', position: 1 },
    ], 1)).toEqual([{ id: 'week-2-session', program_week_id: 'week-2' }])
  })

  it('returns no sessions before start or after a stopped programme', () => {
    expect(selectSessionsForProgramWeek(sessions, [
      { id: 'week-1', position: 0 },
    ], null)).toEqual([])
  })
})
