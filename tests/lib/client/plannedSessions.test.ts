import { describe, expect, it } from 'vitest'

import {
  filterSessionsForJsWeekday,
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
})
