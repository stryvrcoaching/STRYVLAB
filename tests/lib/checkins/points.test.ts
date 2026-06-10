import { describe, it, expect } from 'vitest'
import { getPointsForAction, getLevelFromPoints, POINTS_BY_ACTION } from '@/lib/checkins/points'

describe('getPointsForAction', () => {
  it('checkin = 10', () => expect(getPointsForAction('checkin')).toBe(10))
  it('checkin_late = 5', () => expect(getPointsForAction('checkin_late')).toBe(5))
  it('session = 25', () => expect(getPointsForAction('session')).toBe(25))
  it('bilan = 20', () => expect(getPointsForAction('bilan')).toBe(20))
  it('meal = 3', () => expect(getPointsForAction('meal')).toBe(3))

  it('all action types covered in POINTS_BY_ACTION', () => {
    const types = ['checkin', 'checkin_late', 'session', 'bilan', 'meal']
    for (const t of types) {
      expect(POINTS_BY_ACTION).toHaveProperty(t)
    }
  })
})

describe('getLevelFromPoints', () => {
  it('0 pts = bronze', () => expect(getLevelFromPoints(0)).toBe('bronze'))
  it('99 pts = bronze', () => expect(getLevelFromPoints(99)).toBe('bronze'))
  it('100 pts = silver', () => expect(getLevelFromPoints(100)).toBe('silver'))
  it('299 pts = silver', () => expect(getLevelFromPoints(299)).toBe('silver'))
  it('300 pts = gold', () => expect(getLevelFromPoints(300)).toBe('gold'))
  it('699 pts = gold', () => expect(getLevelFromPoints(699)).toBe('gold'))
  it('700 pts = platinum', () => expect(getLevelFromPoints(700)).toBe('platinum'))
  it('9999 pts = platinum', () => expect(getLevelFromPoints(9999)).toBe('platinum'))
  it('negative pts = bronze', () => expect(getLevelFromPoints(-1)).toBe('bronze'))
})
