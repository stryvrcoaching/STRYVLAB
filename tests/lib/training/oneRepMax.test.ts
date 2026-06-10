import { describe, it, expect } from 'vitest'
import {
  estimateOneRM,
  bestOneRM,
  computeOneRMTrends,
  type OneRMSet,
} from '@/lib/training/oneRepMax'

describe('estimateOneRM', () => {
  it('should estimate 1RM from 5 reps at 100kg', () => {
    // Known benchmark: 100kg × 5 reps
    // Epley: 100 × (1 + 5/30) = 116.67kg
    // Brzycki: 100 / (1.0278 - 0.139) ≈ 112.84kg
    // Average: ~114.75kg
    const rm = estimateOneRM(100, 5, 0)
    expect(rm).toBeGreaterThan(110)
    expect(rm).toBeLessThan(120)
  })

  it('should estimate 1RM with RIR adjustment', () => {
    // 100kg × 5 reps with 2 RIR in reserve
    // true_weight = 100 / (1 - 2 × 0.025) = 100 / 0.95 ≈ 105.26kg
    // Then apply formula: 105.26 × (1 + 5/30) ≈ 123.6kg
    const rmNoRIR = estimateOneRM(100, 5, 0)
    const rmWithRIR = estimateOneRM(100, 5, 2)
    expect(rmWithRIR).toBeGreaterThan(rmNoRIR) // higher true max with RIR adjustment
  })

  it('should handle high rep ranges with Epley only', () => {
    // For reps > 12, use Epley only (Brzycki becomes unstable)
    const rm = estimateOneRM(50, 20, 0)
    expect(rm).toBeGreaterThan(0)
    expect(rm).toBeLessThan(150) // sanity check
  })

  it('should return 0 for invalid inputs', () => {
    expect(estimateOneRM(0, 5, 0)).toBe(0)
    expect(estimateOneRM(100, 0, 0)).toBe(0)
    expect(estimateOneRM(-10, 5, 0)).toBe(0)
  })

  it('should clamp RIR adjustment to prevent extreme values', () => {
    // RIR clamped to max 8 to prevent division by very small numbers
    const rm1 = estimateOneRM(100, 5, 8)
    const rm2 = estimateOneRM(100, 5, 20) // treated as 8
    expect(rm1).toBe(rm2)
  })
})

describe('bestOneRM', () => {
  it('should return the highest 1RM from multiple sets', () => {
    const sets: OneRMSet[] = [
      { weight: 100, reps: 5, rir: 0 },
      { weight: 95, reps: 8, rir: 1 },
      { weight: 90, reps: 10, rir: 2 },
    ]
    const best = bestOneRM(sets)
    expect(best).toBeGreaterThan(0)
    // 100kg × 5 should give the highest 1RM
    expect(best).toBeGreaterThan(110)
  })

  it('should return 0 for empty array', () => {
    expect(bestOneRM([])).toBe(0)
  })

  it('should ignore invalid sets', () => {
    const sets: OneRMSet[] = [
      { weight: 0, reps: 5, rir: 0 },
      { weight: 100, reps: 5, rir: 0 },
    ]
    const best = bestOneRM(sets)
    // Should pick the valid 100kg × 5 set
    expect(best).toBeGreaterThan(110)
  })
})

describe('computeOneRMTrends', () => {
  it('should compute 1RM trends comparing recent vs old periods', () => {
    const now = new Date()
    // Recent period: within last 2 weeks
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 3600 * 1000)
    // Old period: between 4-6 weeks ago
    const fiveWeeksAgo = new Date(now.getTime() - 35 * 24 * 3600 * 1000)

    const sets = [
      // Recent period (10 days ago): 110kg × 5
      {
        exercise_name: 'Squat',
        actual_weight_kg: 110,
        actual_reps: 5,
        rir_actual: 0,
        completed_at: tenDaysAgo.toISOString(),
      },
      // Old period (5 weeks ago): 100kg × 5
      {
        exercise_name: 'Squat',
        actual_weight_kg: 100,
        actual_reps: 5,
        rir_actual: 0,
        completed_at: fiveWeeksAgo.toISOString(),
      },
    ]

    const trends = computeOneRMTrends(sets)
    expect(trends.length).toBe(1)
    expect(trends[0].exercise).toBe('Squat')
    expect(trends[0].delta).toBeGreaterThan(0) // positive progress
    expect(trends[0].percentChange).toBeGreaterThan(0)
  })

  it('should return empty array if insufficient data', () => {
    const sets = [
      {
        exercise_name: 'Squat',
        actual_weight_kg: 100,
        actual_reps: 5,
        rir_actual: 0,
        completed_at: new Date().toISOString(),
      },
    ]
    const trends = computeOneRMTrends(sets)
    expect(trends.length).toBe(0) // needs both recent and old data
  })

  it('should sort trends by percent change descending', () => {
    const now = new Date()
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 3600 * 1000)
    const fiveWeeksAgo = new Date(now.getTime() - 35 * 24 * 3600 * 1000)

    const sets = [
      // Squat: +10%
      {
        exercise_name: 'Squat',
        actual_weight_kg: 110,
        actual_reps: 5,
        rir_actual: 0,
        completed_at: tenDaysAgo.toISOString(),
      },
      {
        exercise_name: 'Squat',
        actual_weight_kg: 100,
        actual_reps: 5,
        rir_actual: 0,
        completed_at: fiveWeeksAgo.toISOString(),
      },
      // Deadlift: +5%
      {
        exercise_name: 'Deadlift',
        actual_weight_kg: 105,
        actual_reps: 3,
        rir_actual: 0,
        completed_at: tenDaysAgo.toISOString(),
      },
      {
        exercise_name: 'Deadlift',
        actual_weight_kg: 100,
        actual_reps: 3,
        rir_actual: 0,
        completed_at: fiveWeeksAgo.toISOString(),
      },
    ]

    const trends = computeOneRMTrends(sets)
    expect(trends.length).toBe(2)
    expect(trends[0].percentChange).toBeGreaterThan(trends[1].percentChange)
    expect(trends[0].exercise).toBe('Squat') // highest percent change
  })
})
