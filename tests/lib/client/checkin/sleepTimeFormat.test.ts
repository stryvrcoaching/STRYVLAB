import { describe, expect, it } from 'vitest'

import {
  formatSleepHours,
  sleepPartsToHoursNumber,
  splitSleepHours,
} from '@/lib/client/checkin/sleepTimeFormat'

describe('sleepTimeFormat', () => {
  it('formats hour decimals as readable hour strings', () => {
    expect(formatSleepHours(8.5)).toBe('8h30')
    expect(formatSleepHours(7.25)).toBe('7h15')
    expect(formatSleepHours(9.75)).toBe('9h45')
  })

  it('splits numeric hours into hours and minutes', () => {
    expect(splitSleepHours(8.5)).toEqual({ hours: 8, minutes: 30 })
    expect(splitSleepHours(6)).toEqual({ hours: 6, minutes: 0 })
  })

  it('converts split hours and minutes back to numeric hours', () => {
    expect(sleepPartsToHoursNumber(8, 30)).toBe(8.5)
    expect(sleepPartsToHoursNumber(9, 15)).toBe(9.25)
    expect(sleepPartsToHoursNumber(9, 59)).toBeCloseTo(9.9833, 3)
    expect(sleepPartsToHoursNumber(25, 0)).toBeNull()
  })
})
