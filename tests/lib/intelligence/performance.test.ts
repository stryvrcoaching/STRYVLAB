import { describe, it, expect } from 'vitest'
import { detectPerformanceTrend, type SessionObservation } from '@/lib/programs/intelligence/performance'

const makeSession = (
  sets: { reps: number; weight: number; completed: boolean; rir?: number | null }[]
): SessionObservation => ({
  completedAt: new Date().toISOString(),
  sets: sets.map(s => ({
    actual_reps: s.reps,
    actual_weight_kg: s.weight,
    completed: s.completed,
    rir_actual: s.rir ?? null,
  })),
})

describe('detectPerformanceTrend', () => {
  it('returns null when fewer than 2 sessions', () => {
    const result = detectPerformanceTrend([makeSession([{ reps: 8, weight: 80, completed: true, rir: 3 }])])
    expect(result.trend).toBeNull()
  })

  it('detects progression: volume strictly increasing + avg RIR <= 4', () => {
    const sessions = [
      makeSession([{ reps: 8, weight: 60, completed: true, rir: 4 }]),
      makeSession([{ reps: 8, weight: 70, completed: true, rir: 3 }]),
      makeSession([{ reps: 8, weight: 80, completed: true, rir: 2 }]),
    ]
    const result = detectPerformanceTrend(sessions)
    expect(result.trend).toBe('progression')
    expect(result.suggestion).not.toBeNull()
  })

  it('detects stagnation: flat volume + avg RIR >= 3', () => {
    const sessions = [
      makeSession([{ reps: 8, weight: 80, completed: true, rir: 4 }]),
      makeSession([{ reps: 8, weight: 80, completed: true, rir: 3 }]),
      makeSession([{ reps: 8, weight: 80, completed: true, rir: 3 }]),
    ]
    const result = detectPerformanceTrend(sessions)
    expect(result.trend).toBe('stagnation')
  })

  it('detects stagnation: oscillating volume (delta < 3%) + avg RIR >= 3', () => {
    // 640 → 644 → 640: all deltas < 3%
    const sessions = [
      makeSession([{ reps: 8, weight: 80, completed: true, rir: 3 }]),    // 640
      makeSession([{ reps: 8, weight: 80.5, completed: true, rir: 3 }]),  // 644
      makeSession([{ reps: 8, weight: 80, completed: true, rir: 3 }]),    // 640
    ]
    const result = detectPerformanceTrend(sessions)
    expect(result.trend).toBe('stagnation')
  })

  it('detects overtraining: avg RIR <= 1 for last 2 + completion < 80%', () => {
    const sessions = [
      makeSession([
        { reps: 8, weight: 80, completed: true, rir: 1 },
        { reps: 8, weight: 80, completed: false, rir: 0 },
        { reps: 8, weight: 80, completed: false, rir: 0 },
      ]),
      makeSession([
        { reps: 8, weight: 80, completed: true, rir: 0 },
        { reps: 8, weight: 80, completed: false, rir: 0 },
        { reps: 8, weight: 80, completed: false, rir: 0 },
      ]),
    ]
    const result = detectPerformanceTrend(sessions)
    expect(result.trend).toBe('overtraining')
  })

  it('overtraining requires both low RIR AND low completion — high RIR no trigger', () => {
    const sessions = [
      makeSession([{ reps: 8, weight: 80, completed: false, rir: 4 }, { reps: 8, weight: 80, completed: false, rir: 3 }]),
      makeSession([{ reps: 8, weight: 80, completed: false, rir: 3 }, { reps: 8, weight: 80, completed: false, rir: 4 }]),
    ]
    const result = detectPerformanceTrend(sessions)
    expect(result.trend).not.toBe('overtraining')
  })

  it('returns null with 0 sessions', () => {
    const result = detectPerformanceTrend([])
    expect(result.trend).toBeNull()
  })

  it('detects progression with 2 sessions: volume up + RIR <= 4', () => {
    const sessions = [
      makeSession([{ reps: 8, weight: 80, completed: true, rir: 2 }]),
      makeSession([{ reps: 8, weight: 85, completed: true, rir: 2 }]),
    ]
    const result = detectPerformanceTrend(sessions)
    expect(result.trend).toBe('progression')
  })
})
