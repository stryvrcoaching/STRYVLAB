import { describe, expect, it } from 'vitest'
import {
  addDaysToDateKey,
  computePhysiologicalDateInTimezone,
  getLocalWeekday,
  utcRangeForLocalDate,
} from '@/lib/client/checkin/timeWindows'

describe('timeWindows timezone helpers', () => {
  it('computes physiological day before 04:00 local', () => {
    const now = new Date('2026-05-30T03:00:00.000Z') // 23:00 previous day in New York (DST)
    expect(computePhysiologicalDateInTimezone(now, 'America/New_York')).toBe('2026-05-29')
  })

  it('adds days without drifting across host timezone', () => {
    expect(addDaysToDateKey('2026-05-31', 1)).toBe('2026-06-01')
    expect(addDaysToDateKey('2026-06-01', -1)).toBe('2026-05-31')
  })

  it('returns the UTC range for a local day in New York', () => {
    const { start, end } = utcRangeForLocalDate('2026-05-30', 'America/New_York')
    expect(start.toISOString()).toBe('2026-05-30T04:00:00.000Z')
    expect(end.toISOString()).toBe('2026-05-31T03:59:59.999Z')
  })

  it('reads weekday in the client timezone', () => {
    const now = new Date('2026-05-31T00:30:00.000Z')
    expect(getLocalWeekday(now, 'America/New_York')).toBe(6)
    expect(getLocalWeekday(now, 'Europe/Paris')).toBe(0)
  })
})
