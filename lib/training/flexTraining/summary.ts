import type {
  FlexWorkoutExerciseRow,
  FlexWorkoutSessionRow,
  FlexWorkoutSetRow,
  FlexWorkoutSummary,
} from './types'

function normalizeNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isHardSet(set: FlexWorkoutSetRow): boolean {
  if (!set.completed) return false
  if (set.rir != null && set.rir <= 3) return true
  if (set.rpe != null && set.rpe >= 7) return true
  return false
}

export function resolveFlexExerciseDisplayName(
  exercise: Pick<FlexWorkoutExerciseRow, 'exercise_id' | 'custom_exercise_name'>,
  catalogLookup?: (exerciseId: string) => string | null,
): string {
  if (exercise.custom_exercise_name?.trim()) return exercise.custom_exercise_name.trim()
  if (exercise.exercise_id && catalogLookup) {
    const label = catalogLookup(exercise.exercise_id)
    if (label) return label
  }
  return 'Exercice'
}

export function summarizeFlexWorkoutSession(
  session: Pick<FlexWorkoutSessionRow, 'started_at' | 'ended_at' | 'duration_seconds'>,
  exercises: Array<FlexWorkoutExerciseRow & { sets: FlexWorkoutSetRow[] }>,
): FlexWorkoutSummary {
  const completedSets = exercises.flatMap(ex => ex.sets).filter(set => set.completed)
  const tonnage = completedSets.reduce((sum, set) => {
    const weight = normalizeNumber(set.weight)
    const reps = normalizeNumber(set.reps)
    if (weight === null || reps === null) return sum
    return sum + weight * reps
  }, 0)

  const muscleGroupVolume: Record<string, number> = {}
  for (const exercise of exercises) {
    const groups = (exercise.muscle_groups ?? []).filter(Boolean)
    if (groups.length === 0) continue
    const completedCount = exercise.sets.filter(set => set.completed).length
    if (completedCount === 0) continue
    for (const group of groups) {
      muscleGroupVolume[group] = (muscleGroupVolume[group] ?? 0) + completedCount
    }
  }

  return {
    total_sets: completedSets.length,
    hard_sets: completedSets.filter(isHardSet).length,
    tonnage: Math.round(tonnage),
    duration_seconds:
      session.duration_seconds ??
      (session.started_at && session.ended_at
        ? Math.max(0, Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000))
        : null),
    muscle_group_volume: muscleGroupVolume,
    intensity_score: null,
    fatigue_score: null,
    recovery_impact: null,
    adherence_impact: null,
  }
}
