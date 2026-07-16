import { describe, expect, it } from 'vitest'
import { recommendFollowingWorkoutSet, type WorkoutSetSnapshot } from '@/lib/training/workoutIntelligence'

const baseSet = {
  exercise_id: 'exercise-1',
  exercise_name: 'Bench press',
  side: 'bilateral' as const,
  planned_reps: '8-12',
  actual_reps: '',
  actual_weight_kg: '',
  completed: false,
  rir_actual: '',
}

function makeSet(patch: Partial<WorkoutSetSnapshot>): WorkoutSetSnapshot {
  return {
    ...baseSet,
    set_number: 1,
    set_type: 'working',
    ...patch,
  }
}

describe('workout intelligence', () => {
  it('does not use a warmup set to recommend the next working set', () => {
    const result = recommendFollowingWorkoutSet({
      completedSet: makeSet({
        set_number: 1,
        set_type: 'warmup',
        actual_reps: '20',
        actual_weight_kg: '20',
        completed: true,
        rir_actual: '5',
      }),
      sets: [
        makeSet({ set_number: 1, set_type: 'warmup', actual_reps: '20', actual_weight_kg: '20', completed: true, rir_actual: '5' }),
        makeSet({ set_number: 2, set_type: 'working' }),
      ],
      exercises: [{ id: 'exercise-1', name: 'Bench press', rep_min: 8, rep_max: 12, target_rir: 2 }],
      historyIndex: {},
      goal: 'hypertrophy',
      level: 'intermediate',
      manuallyEdited: new Set(),
      resolveTargetRir: (exercise) => exercise.target_rir ?? null,
    })

    expect(result).toBeNull()
  })

  it('recommends the next working set from a completed working set', () => {
    const result = recommendFollowingWorkoutSet({
      completedSet: makeSet({
        set_number: 1,
        actual_reps: '9',
        actual_weight_kg: '80',
        completed: true,
        rir_actual: '2',
      }),
      sets: [
        makeSet({ set_number: 1, actual_reps: '9', actual_weight_kg: '80', completed: true, rir_actual: '2' }),
        makeSet({ set_number: 2 }),
      ],
      exercises: [{ id: 'exercise-1', name: 'Bench press', rep_min: 8, rep_max: 12, target_rir: 2 }],
      historyIndex: {},
      goal: 'hypertrophy',
      level: 'intermediate',
      manuallyEdited: new Set(),
      resolveTargetRir: (exercise) => exercise.target_rir ?? null,
    })

    expect(result?.nextKey).toBe('exercise-1_set2_bilateral')
    expect(result?.recommendation.weight_kg).toBe(80)
    expect(result?.recommendation.reps).toBe(10)
  })

  it('does not overwrite a manually edited next set', () => {
    const result = recommendFollowingWorkoutSet({
      completedSet: makeSet({
        set_number: 1,
        actual_reps: '9',
        actual_weight_kg: '80',
        completed: true,
        rir_actual: '2',
      }),
      sets: [
        makeSet({ set_number: 1, actual_reps: '9', actual_weight_kg: '80', completed: true, rir_actual: '2' }),
        makeSet({ set_number: 2 }),
      ],
      exercises: [{ id: 'exercise-1', name: 'Bench press', rep_min: 8, rep_max: 12, target_rir: 2 }],
      historyIndex: {},
      goal: 'hypertrophy',
      level: 'intermediate',
      manuallyEdited: new Set(['exercise-1_set2_bilateral']),
      resolveTargetRir: (exercise) => exercise.target_rir ?? null,
    })

    expect(result).toBeNull()
  })

  it('infers a hypertrophy range when the coach does not prescribe reps', () => {
    const result = recommendFollowingWorkoutSet({
      completedSet: makeSet({
        set_number: 2,
        planned_reps: 'reps',
        actual_reps: '13',
        actual_weight_kg: '54',
        completed: true,
        rir_actual: '1',
      }),
      sets: [
        makeSet({ set_number: 1, planned_reps: 'reps', actual_reps: '16', actual_weight_kg: '54', completed: true, rir_actual: '3' }),
        makeSet({ set_number: 2, planned_reps: 'reps', actual_reps: '13', actual_weight_kg: '54', completed: true, rir_actual: '1' }),
        makeSet({ set_number: 3, planned_reps: 'reps' }),
      ],
      exercises: [{ id: 'exercise-1', name: 'Bench press', target_rir: 1, weight_increment_kg: 1.2 }],
      historyIndex: {},
      goal: 'hypertrophy',
      level: 'intermediate',
      manuallyEdited: new Set(),
      resolveTargetRir: (exercise) => exercise.target_rir ?? null,
    })

    expect(result?.recommendation.weight_kg).toBe(54)
    expect(result?.recommendation.reps).toBe(14)
  })
})
