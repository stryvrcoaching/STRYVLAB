import { validateMuscleArray, CanonicalMuscle } from './muscle-normalization'

export interface ResolvedExercise {
  id: string
  name: string
  primary_muscles: CanonicalMuscle[]
  secondary_muscles: CanonicalMuscle[]
  movement_pattern: string | null
  is_compound: boolean | null
}

/**
 * Resolve exercise from DB with strict muscle validation.
 * NEVER falls back to regex detection.
 * THROWS if muscles are empty or invalid.
 */
export function resolveExerciseMuscleCoverage(
  exercise: {
    id: string
    name: string
    primary_muscles: string[]
    secondary_muscles: string[]
    movement_pattern?: string | null
    is_compound?: boolean | null
  }
): ResolvedExercise {
  // Validate primary_muscles is not empty
  if (!exercise.primary_muscles || exercise.primary_muscles.length === 0) {
    throw new Error(
      `Exercise "${exercise.name}" has no primary_muscles. ` +
      `Must be configured in DB or via coach UI.`
    )
  }

  // Normalize both arrays — unknown slugs are filtered out, not thrown
  const primary = validateMuscleArray(exercise.primary_muscles)
  const secondary = exercise.secondary_muscles
    ? validateMuscleArray(exercise.secondary_muscles)
    : []

  // After normalization, primary could be empty if all slugs were unknown
  if (primary.length === 0) {
    throw new Error(
      `Exercise "${exercise.name}" has no recognized primary_muscles after normalization. ` +
      `Raw: ${JSON.stringify(exercise.primary_muscles)}`
    )
  }

  return {
    id: exercise.id,
    name: exercise.name,
    primary_muscles: primary,
    secondary_muscles: secondary,
    movement_pattern: exercise.movement_pattern ?? null,
    is_compound: exercise.is_compound ?? null,
  }
}

/**
 * Batch resolve exercises. Collects errors, returns only valid exercises + error summary.
 */
export function resolveExercisesMusclesCoverage(
  exercises: Array<{
    id: string
    name: string
    primary_muscles: string[]
    secondary_muscles: string[]
    movement_pattern?: string | null
    is_compound?: boolean | null
  }>
): {
  valid: ResolvedExercise[]
  errors: Array<{ exerciseId: string; exerciseName: string; error: string }>
} {
  const valid: ResolvedExercise[] = []
  const errors: Array<{ exerciseId: string; exerciseName: string; error: string }> = []

  for (const ex of exercises) {
    try {
      valid.push(resolveExerciseMuscleCoverage(ex))
    } catch (e) {
      errors.push({
        exerciseId: ex.id,
        exerciseName: ex.name,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { valid, errors }
}
