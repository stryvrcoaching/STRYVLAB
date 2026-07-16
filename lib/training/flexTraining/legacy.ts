import type { SupabaseClient } from '@supabase/supabase-js'
import type { FlexWorkoutSessionBundle } from './types'

function resolveLegacySessionName(type: string): string {
  switch (type) {
    case 'bonus':
      return 'Séance bonus'
    case 'replacement':
      return 'Séance de remplacement'
    case 'modified_planned':
      return 'Séance libre'
    default:
      return 'Séance libre'
  }
}

export async function mirrorFlexWorkoutToLegacyLogs(
  db: SupabaseClient,
  clientId: string,
  coachId: string | null,
  bundle: FlexWorkoutSessionBundle,
): Promise<{ legacySessionId: string | null; error: string | null }> {
  const { session, exercises } = bundle
  const sessionName = resolveLegacySessionName(session.type)

  const { data: legacySession, error: sessionError } = await db
    .from('client_session_logs')
    .insert({
      client_id: clientId,
      program_session_id: null,
      session_name: sessionName,
      logged_at: (session.ended_at ?? session.started_at).split('T')[0],
      completed_at: session.ended_at ?? new Date().toISOString(),
      duration_min: session.duration_seconds != null ? Math.round(session.duration_seconds / 60) : null,
      notes: session.notes,
      session_kind: 'flex',
      flex_session_id: session.id,
      relation_to_planned_workout: session.relation_to_planned_workout,
      source_program_id: session.source_program_id,
      source_workout_id: session.source_workout_id,
      replaced_workout_id: session.replaced_workout_id,
      coach_id: coachId,
      perceived_difficulty: session.perceived_difficulty,
      global_rir: session.global_rir,
    })
    .select('id')
    .single()

  if (sessionError || !legacySession) {
    return { legacySessionId: null, error: sessionError?.message ?? 'Impossible de créer le log historique' }
  }

  const legacyRows = exercises.flatMap((exercise) =>
    exercise.sets.map((set) => ({
      session_log_id: legacySession.id,
      exercise_id: null,
      exercise_name: exercise.custom_exercise_name ?? (exercise as { display_name?: string }).display_name ?? exercise.exercise_id ?? 'Exercice',
      flex_exercise_log_id: exercise.id,
      set_number: set.set_number,
      planned_reps: null,
      actual_reps: set.reps,
      actual_weight_kg: set.weight,
      completed: set.completed,
      rpe: set.rpe,
      rir_actual: set.rir,
      notes: set.notes,
      rest_sec_actual: set.rest_seconds,
      primary_muscles: exercise.primary_muscles ?? exercise.muscle_groups ?? [],
      secondary_muscles: exercise.secondary_muscles ?? [],
      tempo_used: set.tempo,
      side: set.side,
      set_type: set.set_type,
      pain_flag: set.pain_flag,
    })),
  )

  if (legacyRows.length > 0) {
    const { error: setsError } = await db.from('client_set_logs').insert(legacyRows)
    if (setsError) {
      return { legacySessionId: legacySession.id, error: setsError.message }
    }
  }

  return { legacySessionId: legacySession.id, error: null }
}
