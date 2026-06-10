import { describe, expect, it } from 'vitest'
import {
  analyzeExercisePerformance,
  type OverloadEvent,
  type SessionPerf,
} from '@/lib/performance/analyzer'

describe('analyzeExercisePerformance', () => {
  it('does not flag stagnation when an exercise is clearly progressing across recent sessions', () => {
    const sessions: SessionPerf[] = [
      {
        session_log_id: 's1',
        logged_at: '2026-05-18T09:00:00.000Z',
        sets: [
          {
            exercise_id: 'ex-triceps',
            exercise_name: 'Extension triceps poulie haute',
            set_number: 1,
            actual_reps: 12,
            completed: true,
            rir_actual: 3,
          },
          {
            exercise_id: 'ex-triceps',
            exercise_name: 'Extension triceps poulie haute',
            set_number: 2,
            actual_reps: 12,
            completed: true,
            rir_actual: 2,
          },
        ],
      },
      {
        session_log_id: 's2',
        logged_at: '2026-05-25T09:00:00.000Z',
        sets: [
          {
            exercise_id: 'ex-triceps',
            exercise_name: 'Extension triceps poulie haute',
            set_number: 1,
            actual_reps: 13,
            completed: true,
            rir_actual: 2,
          },
          {
            exercise_id: 'ex-triceps',
            exercise_name: 'Extension triceps poulie haute',
            set_number: 2,
            actual_reps: 13,
            completed: true,
            rir_actual: 2,
          },
        ],
      },
      {
        session_log_id: 's3',
        logged_at: '2026-06-01T09:00:00.000Z',
        sets: [
          {
            exercise_id: 'ex-triceps',
            exercise_name: 'Extension triceps poulie haute',
            set_number: 1,
            actual_reps: 14,
            completed: true,
            rir_actual: 2,
          },
          {
            exercise_id: 'ex-triceps',
            exercise_name: 'Extension triceps poulie haute',
            set_number: 2,
            actual_reps: 14,
            completed: true,
            rir_actual: 1,
          },
        ],
      },
    ]

    const overloadEvents: OverloadEvent[] = [
      {
        exercise_id: 'ex-triceps',
        exercise_name: 'Extension triceps poulie haute',
        created_at: '2026-05-25T09:30:00.000Z',
        trigger_type: 'overload',
      },
    ]

    const analysis = analyzeExercisePerformance(sessions, overloadEvents, 8)
    const exercise = analysis.exercises.find((entry) => entry.exercise_id === 'ex-triceps')

    expect(exercise).toBeDefined()
    expect(exercise?.sessions_count).toBe(3)
    expect(exercise?.completion_rate).toBe(1)
    expect(exercise?.overloads_last_4_weeks).toBe(1)
    expect(exercise?.stagnation).toBe(false)
    expect(exercise?.overreaching).toBe(false)
  })

  it('flags stagnation only when there are at least 3 recent sessions and no overload event', () => {
    const sessions: SessionPerf[] = [
      {
        session_log_id: 's1',
        logged_at: '2026-05-18T09:00:00.000Z',
        sets: [
          {
            exercise_id: 'ex-biceps',
            exercise_name: 'Curl poulie basse',
            set_number: 1,
            actual_reps: 12,
            completed: true,
            rir_actual: 3,
          },
        ],
      },
      {
        session_log_id: 's2',
        logged_at: '2026-05-25T09:00:00.000Z',
        sets: [
          {
            exercise_id: 'ex-biceps',
            exercise_name: 'Curl poulie basse',
            set_number: 1,
            actual_reps: 12,
            completed: true,
            rir_actual: 3,
          },
        ],
      },
      {
        session_log_id: 's3',
        logged_at: '2026-06-01T09:00:00.000Z',
        sets: [
          {
            exercise_id: 'ex-biceps',
            exercise_name: 'Curl poulie basse',
            set_number: 1,
            actual_reps: 12,
            completed: true,
            rir_actual: 4,
          },
        ],
      },
    ]

    const analysis = analyzeExercisePerformance(sessions, [], 8)
    const exercise = analysis.exercises.find((entry) => entry.exercise_id === 'ex-biceps')

    expect(exercise).toBeDefined()
    expect(exercise?.overloads_last_4_weeks).toBe(0)
    expect(exercise?.stagnation).toBe(true)
  })
})
