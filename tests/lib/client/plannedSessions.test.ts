import { describe, expect, it } from 'vitest'

import {
  filterSessionsForJsWeekday,
  filterSessionsForProgrammeDow,
  programmeDowToJsWeekday,
  sessionMatchesProgrammeDow,
  sessionMatchesJsWeekday,
} from '@/lib/client/plannedSessions'

describe('plannedSessions', () => {
  it('matches legacy day_of_week values on JS weekdays', () => {
    expect(sessionMatchesJsWeekday({ day_of_week: 2 }, 2)).toBe(true)
    expect(sessionMatchesJsWeekday({ day_of_week: 2 }, 1)).toBe(false)
  })

  it('prefers days_of_week when present', () => {
    expect(sessionMatchesJsWeekday({ day_of_week: 1, days_of_week: [2, 4] }, 2)).toBe(true)
    expect(sessionMatchesJsWeekday({ day_of_week: 1, days_of_week: [2, 4] }, 1)).toBe(false)
  })

  it('filters only sessions scheduled for the requested weekday', () => {
    const sessions = [
      { name: 'Push', day_of_week: 1 },
      { name: 'Pull', days_of_week: [2, 4] },
      { name: 'Legs', days_of_week: [2] },
    ]

    expect(filterSessionsForJsWeekday(sessions, 2).map((session) => session.name)).toEqual(['Pull', 'Legs'])
  })

  it('supports legacy 1..7 weekday encoding including Sunday', () => {
    expect(sessionMatchesJsWeekday({ day_of_week: 7 }, 0)).toBe(true)
    expect(sessionMatchesJsWeekday({ days_of_week: [1, 7] }, 0)).toBe(true)
    expect(sessionMatchesJsWeekday({ days_of_week: [1, 7] }, 1)).toBe(true)
  })

  it('maps programme weekday 1..7 to JS weekday', () => {
    expect(programmeDowToJsWeekday(1)).toBe(1)
    expect(programmeDowToJsWeekday(6)).toBe(6)
    expect(programmeDowToJsWeekday(7)).toBe(0)
  })

  it('matches programme weekday against mixed session encodings', () => {
    expect(sessionMatchesProgrammeDow({ day_of_week: 0 }, 7)).toBe(true)
    expect(sessionMatchesProgrammeDow({ day_of_week: 7 }, 7)).toBe(true)
    expect(sessionMatchesProgrammeDow({ day_of_week: 1 }, 1)).toBe(true)
  })

  it('filters sessions for programme weekday using normalized encoding', () => {
    const sessions = [
      { name: 'Sunday Legacy', day_of_week: 0 },
      { name: 'Sunday ISO', day_of_week: 7 },
      { name: 'Monday', day_of_week: 1 },
    ]

    expect(filterSessionsForProgrammeDow(sessions, 7).map((session) => session.name)).toEqual([
      'Sunday Legacy',
      'Sunday ISO',
    ])
  })
})
