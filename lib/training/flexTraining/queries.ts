import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  FlexWorkoutExerciseRow,
  FlexWorkoutSessionBundle,
  FlexWorkoutSessionRow,
  FlexWorkoutSetRow,
} from './types'
import { resolveFlexExerciseDisplayName, summarizeFlexWorkoutSession } from './summary'
import { resolveCatalogExerciseName } from './catalog'
import type { ExerciseNameResolver } from '@/lib/i18n/exerciseDisplayName'

const FLEX_SESSION_SELECT = `
  id, client_id, coach_id, type, relation_to_planned_workout,
  source_program_id, source_workout_id, replaced_workout_id,
  started_at, ended_at, duration_seconds,
  perceived_difficulty, global_rir, notes, status, created_at, updated_at,
  flex_workout_exercises (
    id, session_id, exercise_id, custom_exercise_name, muscle_groups, movement_pattern, equipment, primary_muscles, secondary_muscles, is_compound, unilateral, image_url, order_index, notes, created_at, updated_at,
    flex_workout_sets (
      id, exercise_log_id, set_number, side, set_type, weight, reps, rir, rpe, rest_seconds, tempo, completed, pain_flag, notes, created_at, updated_at
    )
  )
`

const FLEX_SESSION_SELECT_FALLBACK = `
  id, client_id, coach_id, type, relation_to_planned_workout,
  source_program_id, source_workout_id, replaced_workout_id,
  started_at, ended_at, duration_seconds,
  perceived_difficulty, global_rir, notes, status, created_at, updated_at,
  flex_workout_exercises (
    id, session_id, exercise_id, custom_exercise_name, muscle_groups, order_index, notes, created_at, updated_at,
    flex_workout_sets (
      id, exercise_log_id, set_number, weight, reps, rir, rpe, rest_seconds, tempo, completed, pain_flag, notes, created_at, updated_at
    )
  )
`

function normalizeSetRow(set: Partial<FlexWorkoutSetRow>): FlexWorkoutSetRow {
  return {
    id: String(set.id),
    exercise_log_id: String(set.exercise_log_id),
    set_number: Number(set.set_number ?? 1),
    side: (set.side as FlexWorkoutSetRow['side'] | undefined) ?? 'bilateral',
    set_type: (set.set_type as FlexWorkoutSetRow['set_type'] | undefined) ?? 'working',
    weight: set.weight ?? null,
    reps: set.reps ?? null,
    rir: set.rir ?? null,
    rpe: set.rpe ?? null,
    rest_seconds: set.rest_seconds ?? null,
    tempo: set.tempo ?? null,
    completed: Boolean(set.completed),
    pain_flag: Boolean(set.pain_flag),
    notes: set.notes ?? null,
    created_at: String(set.created_at),
    updated_at: String(set.updated_at),
  }
}

function normalizeExerciseRow(
  exercise: Partial<FlexWorkoutExerciseRow> & { flex_workout_sets?: Partial<FlexWorkoutSetRow>[] },
): FlexWorkoutExerciseRow & { sets: FlexWorkoutSetRow[] } {
  return {
    id: String(exercise.id),
    session_id: String(exercise.session_id),
    exercise_id: exercise.exercise_id ?? null,
    custom_exercise_name: exercise.custom_exercise_name ?? null,
    muscle_groups: exercise.muscle_groups ?? [],
    movement_pattern: exercise.movement_pattern ?? null,
    equipment: exercise.equipment ?? [],
    primary_muscles: exercise.primary_muscles ?? [],
    secondary_muscles: exercise.secondary_muscles ?? [],
    is_compound: exercise.is_compound ?? null,
    unilateral: exercise.unilateral ?? false,
    image_url: exercise.image_url ?? null,
    order_index: Number(exercise.order_index ?? 0),
    notes: exercise.notes ?? null,
    created_at: String(exercise.created_at),
    updated_at: String(exercise.updated_at),
    sets: ((exercise.flex_workout_sets ?? []) as Partial<FlexWorkoutSetRow>[])
      .map(normalizeSetRow)
      .sort((a, b) => {
        if (a.set_number !== b.set_number) return a.set_number - b.set_number
        return a.side.localeCompare(b.side)
      }),
  }
}

/** Adds a display-only label; persisted custom exercise names are never machine-translated. */
export function localizeFlexExercises(
  exercises: Array<FlexWorkoutExerciseRow & { sets: FlexWorkoutSetRow[] }>,
  resolveName: ExerciseNameResolver,
) {
  return exercises.map((exercise) => {
    const catalogName = resolveCatalogExerciseName(exercise.exercise_id)
    return {
      ...exercise,
      display_name: exercise.custom_exercise_name?.trim()
        || (catalogName ? resolveName(catalogName, exercise.exercise_id) : 'Exercice'),
    }
  })
}

export async function fetchFlexWorkoutSession(
  db: SupabaseClient,
  sessionId: string,
): Promise<{ session: FlexWorkoutSessionRow | null; exercises: Array<FlexWorkoutExerciseRow & { sets: FlexWorkoutSetRow[] }> }> {
  let { data, error } = await db
    .from('flex_workout_sessions')
    .select(FLEX_SESSION_SELECT)
    .eq('id', sessionId)
    .maybeSingle()

  if (error || !data) {
    const fallback = await db
      .from('flex_workout_sessions')
      .select(FLEX_SESSION_SELECT_FALLBACK)
      .eq('id', sessionId)
      .maybeSingle()
    data = fallback.data
    error = fallback.error
  }

  if (error || !data) return { session: null, exercises: [] }

  const session = data as FlexWorkoutSessionRow
  const exercises = ((data.flex_workout_exercises ?? []) as Array<Partial<FlexWorkoutExerciseRow> & { flex_workout_sets?: Partial<FlexWorkoutSetRow>[] }>)
    .slice()
    .map(normalizeExerciseRow)
    .sort((a, b) => a.order_index - b.order_index)

  return { session, exercises }
}

export async function fetchRecentFlexWorkouts(
  db: SupabaseClient,
  clientId: string,
  limit = 10,
): Promise<FlexWorkoutSessionBundle[]> {
  let { data, error } = await db
    .from('flex_workout_sessions')
    .select(FLEX_SESSION_SELECT)
    .eq('client_id', clientId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    const fallback = await db
      .from('flex_workout_sessions')
      .select(FLEX_SESSION_SELECT_FALLBACK)
      .eq('client_id', clientId)
      .order('started_at', { ascending: false })
      .limit(limit)
    data = fallback.data
    error = fallback.error
  }

  if (error) return []

  return ((data ?? []) as Array<FlexWorkoutSessionRow & { flex_workout_exercises?: Array<Partial<FlexWorkoutExerciseRow> & { flex_workout_sets?: Partial<FlexWorkoutSetRow>[] }> }>)
    .map((row) => {
      const session = row as FlexWorkoutSessionRow
      const exercises = ((row.flex_workout_exercises ?? []) as Array<Partial<FlexWorkoutExerciseRow> & { flex_workout_sets?: Partial<FlexWorkoutSetRow>[] }>)
        .slice()
        .map(normalizeExerciseRow)
        .sort((a, b) => a.order_index - b.order_index)

      return {
        session,
        exercises: exercises.map(ex => ({
          ...ex,
          display_name: resolveFlexExerciseDisplayName(ex, resolveCatalogExerciseName),
        })),
        summary: summarizeFlexWorkoutSession(session, exercises),
      }
    })
}
