import { describe, expect, it } from 'vitest'
import { getSessionsPerWeek, getTrainingDaysPerWeek, normalizeScheduledDays, resolveStoredFrequency } from './frequency'

describe('frequency helpers', () => {
  it('counts only scheduled days and respects multi-day sessions', () => {
    const sessions = [
      { day_of_week: 1 },
      { day_of_week: 2 },
      { day_of_week: 3 },
      { day_of_week: 4 },
      { day_of_week: null },
      { days_of_week: [1, 2] },
      { days_of_week: [] },
      { day_of_week: 2 },
    ]

    expect(getSessionsPerWeek(sessions)).toBe(7)
    expect(getTrainingDaysPerWeek(sessions)).toBe(4)
  })

  it('uses days_of_week when present and supports 0-6 and 1-7', () => {
    expect(normalizeScheduledDays({ day_of_week: 0 })).toEqual([0])
    expect(normalizeScheduledDays({ day_of_week: 7 })).toEqual([7])
    expect(normalizeScheduledDays({ days_of_week: [1, 3, 3] })).toEqual([1, 3])
    expect(normalizeScheduledDays({ days_of_week: [] })).toEqual([])
  })

  it('preserves a computed zero frequency when sessions are provided, but falls back otherwise', () => {
    expect(resolveStoredFrequency([{ day_of_week: null }], 3)).toBe(0)
    expect(resolveStoredFrequency([], 3)).toBe(3)
    expect(resolveStoredFrequency(undefined, 3)).toBe(3)
  })
})
