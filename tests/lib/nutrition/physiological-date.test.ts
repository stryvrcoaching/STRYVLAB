import { describe, expect, it } from 'vitest'
import { constructLoggedAt } from '@/lib/nutrition/physiological-date'

describe('constructLoggedAt', () => {
  it('correctly sets logged_at for a standard day time (10:00 AM) in Europe/Paris', () => {
    // 10:00 AM on July 16, 2026 local time in Paris (UTC+2) is 08:00 UTC.
    // The target physiological date is 2026-07-16.
    const refParisTime = new Date('2026-07-16T08:00:00Z')
    const timezone = 'Europe/Paris'
    
    const result = constructLoggedAt('2026-07-16', timezone, refParisTime)
    expect(result).toBe('2026-07-16T08:00:00.000Z')
  })

  it('correctly adjusts calendar date when logging before 5 AM (e.g. 2:00 AM) in Europe/Paris', () => {
    // 2:00 AM local time in Paris (UTC+2) is 00:00 UTC.
    // If the target physiological date is July 16, and the logging time is 2:00 AM,
    // the calendar date of the log must be July 17.
    // So 2:00 AM on July 17 in Paris = 2026-07-17T00:00:00Z
    const refParisTime = new Date('2026-07-17T00:00:00Z') // 2:00 AM local
    const timezone = 'Europe/Paris'
    const result = constructLoggedAt('2026-07-16', timezone, refParisTime)
    expect(result).toBe('2026-07-17T00:00:00.000Z')
  })

  it('correctly sets logged_at in America/New_York (UTC-4 in July)', () => {
    // 8:00 PM (20:00) on July 16, 2026 in New York is 2026-07-17 00:00 UTC.
    // Target physiological date: 2026-07-16.
    // 20:00 >= 5:00, so calendar date is 2026-07-16.
    // 20:00 in NY on July 16 = 2026-07-17T00:00:00Z.
    const refNYTime = new Date('2026-07-17T00:00:00Z')
    const timezone = 'America/New_York'
    const result = constructLoggedAt('2026-07-16', timezone, refNYTime)
    expect(result).toBe('2026-07-17T00:00:00.000Z') // 20:00 local NY is 00:00 UTC next day
  })

  it('correctly adjusts calendar date when logging before 5 AM (e.g. 3:00 AM) in America/New_York', () => {
    // 3:00 AM on July 17, 2026 in New York (UTC-4) is 07:00 UTC.
    // Target physiological date: 2026-07-16.
    // 3:00 < 5:00, so calendar date of the log is 2026-07-17.
    // 3:00 AM in NY on July 17 = 2026-07-17T07:00:00Z.
    const refNYTime = new Date('2026-07-17T07:00:00Z')
    const timezone = 'America/New_York'
    const result = constructLoggedAt('2026-07-16', timezone, refNYTime)
    expect(result).toBe('2026-07-17T07:00:00.000Z')
  })
})
