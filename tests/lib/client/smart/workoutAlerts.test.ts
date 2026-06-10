import { describe, it, expect } from 'vitest'
import { computeWorkoutAlerts, type WorkoutAnalysisRow } from '@/lib/client/smart/workoutAlerts'

describe('computeWorkoutAlerts', () => {
  const mk = (overrides: Partial<WorkoutAnalysisRow> = {}): WorkoutAnalysisRow => ({
    exercise_name: 'Bench Press',
    completion_rate: 0.9,
    avg_rir: 2,
    rir_trend: 'stable',
    overloads_last_4_weeks: 1,
    stagnation: false,
    overreaching: false,
    ...overrides,
  })

  it('returns empty if no rows', () => {
    expect(computeWorkoutAlerts([])).toEqual([])
  })

  it('triggers overreaching critical when avg_rir <= 1 and completion < 0.8', () => {
    const rows = [mk({ avg_rir: 1, completion_rate: 0.7, overreaching: true })]
    const r = computeWorkoutAlerts(rows)
    expect(r.find(a => a.code === 'overreaching')?.severity).toBe('critical')
    expect(r.find(a => a.code === 'overreaching')?.title).toContain('SURMENAGE')
  })

  it('triggers stagnation warning when stagnation flag set', () => {
    const rows = [mk({ stagnation: true })]
    const r = computeWorkoutAlerts(rows)
    expect(r.find(a => a.code === 'stagnation')?.severity).toBe('warning')
  })

  it('triggers progression info when completion>0.95 + rir_trend=improving', () => {
    const rows = [mk({ completion_rate: 0.97, rir_trend: 'improving' })]
    const r = computeWorkoutAlerts(rows)
    expect(r.find(a => a.code === 'progression')?.severity).toBe('info')
  })

  it('returns one alert per exercise + prioritizes critical', () => {
    const rows = [
      mk({ exercise_name: 'Squat', overreaching: true, avg_rir: 0, completion_rate: 0.6 }),
      mk({ exercise_name: 'Squat', stagnation: true }),
    ]
    const r = computeWorkoutAlerts(rows)
    const squatAlerts = r.filter(a => a.exercise_name === 'Squat')
    expect(squatAlerts.length).toBe(1)
    expect(squatAlerts[0].code).toBe('overreaching')
  })
})
