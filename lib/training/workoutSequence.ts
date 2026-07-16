import { workoutSetKey } from './workoutIntelligence'

export interface WorkoutSequenceExercise {
  id: string
  group_id?: string | null
}

export interface WorkoutSequenceSet {
  exercise_id: string
  set_number: number
  side: string
  completed: boolean
}

function buildBlocks<Exercise extends WorkoutSequenceExercise>(
  exercises: Exercise[],
  dissolvedGroupIds: ReadonlySet<string>,
) {
  const blocks: { isSuperset: boolean; exercises: Exercise[] }[] = []
  const seenGroupIds = new Set<string>()

  for (const exercise of exercises) {
    if (exercise.group_id && !dissolvedGroupIds.has(exercise.group_id)) {
      if (seenGroupIds.has(exercise.group_id)) continue
      seenGroupIds.add(exercise.group_id)
      blocks.push({
        isSuperset: true,
        exercises: exercises.filter((entry) => entry.group_id === exercise.group_id),
      })
      continue
    }

    blocks.push({ isSuperset: false, exercises: [exercise] })
  }

  return blocks
}

export function buildWorkoutSetOrder<Exercise extends WorkoutSequenceExercise, Set extends WorkoutSequenceSet>(
  exercises: Exercise[],
  sets: Set[],
  dissolvedGroupIds: ReadonlySet<string> = new Set(),
): string[] {
  const orderedKeys: string[] = []

  for (const block of buildBlocks(exercises, dissolvedGroupIds)) {
    if (!block.isSuperset) {
      for (const set of sets.filter((entry) => entry.exercise_id === block.exercises[0].id)) {
        orderedKeys.push(workoutSetKey(set.exercise_id, set.set_number, set.side))
      }
      continue
    }

    const setsByExercise = block.exercises.map((exercise) => ({
      exercise,
      sets: sets.filter((entry) => entry.exercise_id === exercise.id),
    }))
    const maxSetNumber = Math.max(...setsByExercise.flatMap((entry) => entry.sets.map((set) => set.set_number)), 0)

    for (let setNumber = 1; setNumber <= maxSetNumber; setNumber += 1) {
      for (const entry of setsByExercise) {
        for (const set of entry.sets.filter((candidate) => candidate.set_number === setNumber)) {
          orderedKeys.push(workoutSetKey(set.exercise_id, set.set_number, set.side))
        }
      }
    }
  }

  return orderedKeys
}

export function findFirstIncompleteWorkoutSetKey<Exercise extends WorkoutSequenceExercise, Set extends WorkoutSequenceSet>(
  exercises: Exercise[],
  sets: Set[],
  dissolvedGroupIds: ReadonlySet<string> = new Set(),
): string | null {
  const orderedKeys = buildWorkoutSetOrder(exercises, sets, dissolvedGroupIds)
  const setsByKey = new Map(sets.map((set) => [workoutSetKey(set.exercise_id, set.set_number, set.side), set]))
  return orderedKeys.find((key) => !setsByKey.get(key)?.completed) ?? null
}
