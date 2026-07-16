import { describe, expect, it } from 'vitest'
import { buildWorkoutSetOrder, findFirstIncompleteWorkoutSetKey } from '@/lib/training/workoutSequence'

type Exercise = { id: string; group_id: string | null }
type Set = { exercise_id: string; set_number: number; side: 'bilateral'; completed: boolean }

function makeExercises(count: number): Exercise[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `exercise-${index + 1}`,
    group_id: 'group-1',
  }))
}

function makeSets(exercises: Exercise[]): Set[] {
  return exercises.flatMap((exercise) => [
    {
      exercise_id: exercise.id,
      set_number: 1,
      side: 'bilateral' as const,
      completed: true,
    },
    {
      exercise_id: exercise.id,
      set_number: 2,
      side: 'bilateral' as const,
      completed: false,
    },
  ])
}

describe('workout sequence', () => {
  it.each([2, 3, 4, 5, 6])('returns the first exercise of the next round for a %s-exercise group', (groupSize) => {
    const exercises = makeExercises(groupSize)
    const sets = makeSets(exercises)

    expect(findFirstIncompleteWorkoutSetKey(exercises, sets)).toBe('exercise-1_set2_bilateral')
  })

  it('keeps the next exercise inside the current group before moving to a later solo exercise', () => {
    const group = makeExercises(3)
    const exercises = [...group, { id: 'rowing', group_id: null }]
    const sets = [
      ...makeSets(group).map((set) => ({ ...set, completed: true })),
      { exercise_id: 'rowing', set_number: 1, side: 'bilateral' as const, completed: false },
    ]

    const order = buildWorkoutSetOrder(exercises, sets)
    expect(order.slice(0, 6)).toEqual([
      'exercise-1_set1_bilateral',
      'exercise-2_set1_bilateral',
      'exercise-3_set1_bilateral',
      'exercise-1_set2_bilateral',
      'exercise-2_set2_bilateral',
      'exercise-3_set2_bilateral',
    ])

    expect(findFirstIncompleteWorkoutSetKey(exercises, sets)).toBe('rowing_set1_bilateral')
  })

  it('falls back to normal exercise order after dissolving a group', () => {
    const exercises = [...makeExercises(3), { id: 'rowing', group_id: null }]
    const sets = exercises.flatMap((exercise) => [
      { exercise_id: exercise.id, set_number: 1, side: 'bilateral' as const, completed: false },
      { exercise_id: exercise.id, set_number: 2, side: 'bilateral' as const, completed: false },
    ])

    expect(findFirstIncompleteWorkoutSetKey(exercises, sets, new Set(['group-1']))).toBe('exercise-1_set1_bilateral')
  })
})
