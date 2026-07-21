import { describe, expect, it } from 'vitest'

import {
  buildHydrationReminderTimes,
  isReminderDue,
  normalizeTrainingReminderTimes,
} from '@/lib/client/reminders'

describe('client reminder scheduling', () => {
  it('keeps at most two sorted training reminders', () => {
    expect(normalizeTrainingReminderTimes(['18:00', '08:00', '08:00', '20:00']))
      .toEqual(['08:00', '18:00'])
  })

  it('spreads hydration reminders from the selected first reminder to 21:00', () => {
    expect(buildHydrationReminderTimes('09:00', 3)).toEqual(['09:00', '15:00', '21:00'])
    expect(buildHydrationReminderTimes('08:00', 1)).toEqual(['08:00'])
    expect(buildHydrationReminderTimes('09:00', 10)).toHaveLength(10)
  })

  it('accepts the five-minute execution window after a scheduled time', () => {
    expect(isReminderDue({ minutesSinceMidnight: 8 * 60 + 4 } as any, '08:00')).toBe(true)
    expect(isReminderDue({ minutesSinceMidnight: 8 * 60 + 5 } as any, '08:00')).toBe(false)
  })
})
