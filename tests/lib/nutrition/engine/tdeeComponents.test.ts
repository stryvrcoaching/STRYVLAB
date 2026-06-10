import { describe, it, expect } from 'vitest'
import {
  computeBMR,
  computeNEAT,
  computeEAT,
  computeTEF,
  computeTDEE,
} from '@/lib/nutrition/engine/tdeeComponents'

describe('computeBMR', () => {
  it('male 80kg 180cm 30y → Mifflin-St Jeor', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(computeBMR(80, 180, 30, 'male')).toBe(1780)
  })

  it('female 60kg 165cm 25y', () => {
    // 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25 → 1345
    expect(computeBMR(60, 165, 25, 'female')).toBe(1345)
  })

  it('uses measured BMR when provided', () => {
    expect(computeBMR(80, 180, 30, 'male', 1900)).toBe(1900)
  })
})

describe('computeNEAT', () => {
  it('sedentary — 2000 steps, no occupation bonus → >0 and <500', () => {
    const neat = computeNEAT(80, 2000, 1.0)
    expect(neat).toBeGreaterThan(0)
    expect(neat).toBeLessThan(500)
  })

  it('active — 12000 steps → higher NEAT than 3000 steps', () => {
    const low = computeNEAT(75, 3000, 1.0)
    const high = computeNEAT(75, 12000, 1.0)
    expect(high).toBeGreaterThan(low)
  })

  it('occupation multiplier 1.18 → higher NEAT', () => {
    const office = computeNEAT(70, 8000, 1.0)
    const physical = computeNEAT(70, 8000, 1.18)
    expect(physical).toBeGreaterThan(office)
  })
})

describe('computeEAT', () => {
  it('4 sessions × 60min musculation → 100-300 kcal/day range', () => {
    const eat = computeEAT(4, 60)
    expect(eat).toBeGreaterThanOrEqual(100)
    expect(eat).toBeLessThanOrEqual(300)
  })

  it('6 sessions × 90min → higher than 3×60', () => {
    const low = computeEAT(3, 60)
    const high = computeEAT(6, 90)
    expect(high).toBeGreaterThan(low)
  })

  it('0 sessions → 0 EAT', () => {
    expect(computeEAT(0, 60)).toBe(0)
  })

  it('caps per-session kcal to avoid PAL overestimation', () => {
    // 10 sessions × 120min would be huge without cap
    const eat = computeEAT(10, 120)
    expect(eat).toBeLessThanOrEqual(500)
  })
})

describe('computeTEF', () => {
  it('returns 9% of BMR', () => {
    expect(computeTEF(1800)).toBe(162) // 1800 × 0.09 = 162
  })
})

describe('computeTDEE', () => {
  it('TDEE = BMR + NEAT + EAT + TEF', () => {
    const result = computeTDEE(80, 180, 30, 'male', {
      stepsPerDay: 8000,
      sessionsPerWeek: 4,
      sessionDurationMin: 60,
      occupationMultiplier: 1.0,
    })
    expect(result.total).toBe(result.bmr + result.neat + result.eat + result.tef)
    expect(result.total).toBeGreaterThan(1800)
  })
})
