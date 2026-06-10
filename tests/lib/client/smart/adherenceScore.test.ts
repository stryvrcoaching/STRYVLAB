import { describe, it, expect } from 'vitest'
import { computeAdherenceScore } from '@/lib/client/smart/adherenceScore'

const BASE = {
  sessionDates: [],
  plannedDaysOfWeek: [1, 3, 5],
  mealDates: [],
  waterByDate: {},
  waterTargetMl: 2500,
  checkinDates: [],
  referenceDate: '2026-05-20',
}

describe('computeAdherenceScore', () => {
  it('returns 0 when no data', () => {
    const r = computeAdherenceScore(BASE)
    expect(r.score).toBe(0)
    expect(r.dimensions.sport).toBe(0)
    expect(r.dimensions.nutrition).toBe(0)
    expect(r.dimensions.hydration).toBe(0)
    expect(r.dimensions.checkins).toBe(0)
  })

  it('full sport score when all planned sessions done', () => {
    // Window 2026-05-14 to 2026-05-20: Mon=18, Wed=20, Fri=15
    const sessionDates = ['2026-05-15', '2026-05-18', '2026-05-20']
    const r = computeAdherenceScore({ ...BASE, sessionDates, plannedDaysOfWeek: [1, 3, 5] })
    expect(r.dimensions.sport).toBe(25)
  })

  it('full nutrition score when meals logged every day', () => {
    const mealDates = ['2026-05-14','2026-05-15','2026-05-16','2026-05-17','2026-05-18','2026-05-19','2026-05-20']
    const r = computeAdherenceScore({ ...BASE, mealDates })
    expect(r.dimensions.nutrition).toBe(25)
  })

  it('full hydration score when water >= 80% target every day', () => {
    const waterByDate: Record<string, number> = {
      '2026-05-14': 2200, '2026-05-15': 2200, '2026-05-16': 2200,
      '2026-05-17': 2200, '2026-05-18': 2200, '2026-05-19': 2200, '2026-05-20': 2200,
    }
    const r = computeAdherenceScore({ ...BASE, waterByDate, waterTargetMl: 2500 })
    expect(r.dimensions.hydration).toBe(25)
  })

  it('full checkins score when checkin every day', () => {
    const checkinDates = ['2026-05-14','2026-05-15','2026-05-16','2026-05-17','2026-05-18','2026-05-19','2026-05-20']
    const r = computeAdherenceScore({ ...BASE, checkinDates })
    expect(r.dimensions.checkins).toBe(25)
  })

  it('score sums dimensions correctly', () => {
    const mealDates = ['2026-05-14','2026-05-15','2026-05-16','2026-05-17','2026-05-18','2026-05-19','2026-05-20']
    const checkinDates = ['2026-05-14','2026-05-15','2026-05-16','2026-05-17','2026-05-18','2026-05-19','2026-05-20']
    const r = computeAdherenceScore({ ...BASE, mealDates, checkinDates })
    expect(r.score).toBe(r.dimensions.sport + r.dimensions.nutrition + r.dimensions.hydration + r.dimensions.checkins)
  })

  it('scoreDelta non-negative when today has more data', () => {
    const mealDates = ['2026-05-17','2026-05-18','2026-05-19','2026-05-20']
    const r = computeAdherenceScore({ ...BASE, mealDates })
    expect(r.scoreDelta).toBeGreaterThanOrEqual(0)
  })

  it('partial sport score proportional to sessions done', () => {
    // Only Mon done out of Mon/Wed/Fri → 1/3
    const r = computeAdherenceScore({ ...BASE, sessionDates: ['2026-05-18'], plannedDaysOfWeek: [1, 3, 5] })
    expect(r.dimensions.sport).toBeGreaterThan(0)
    expect(r.dimensions.sport).toBeLessThan(25)
  })
})
