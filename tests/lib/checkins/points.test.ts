import { describe, expect, it } from 'vitest'
import { getPointsForAction } from '@/lib/checkins/points'

describe('check-in points', () => {
  it('rewards timely and late check-ins consistently', () => {
    expect(getPointsForAction('checkin')).toBe(10)
    expect(getPointsForAction('checkin_late')).toBe(5)
  })
})
