import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthedUser, resolveClientForUser, createServiceDb } from '@/lib/training/flexTraining/server'
import { fetchFlexWorkoutSession } from '@/lib/training/flexTraining/queries'
import { summarizeFlexWorkoutSession } from '@/lib/training/flexTraining/summary'
import { mirrorFlexWorkoutToLegacyLogs } from '@/lib/training/flexTraining/legacy'
import { resolveCatalogExerciseName } from '@/lib/training/flexTraining/catalog'

type Params = { params: { sessionId: string } }

const finishSchema = z.object({
  perceived_difficulty: z.number().int().min(1).max(10).nullable().optional(),
  global_rir: z.number().int().min(0).max(10).nullable().optional(),
  notes: z.string().nullable().optional(),
  relation_to_planned_workout: z.enum(['replace', 'bonus', 'unknown']).nullable().optional(),
})

function resolveType(relation: 'replace' | 'bonus' | 'unknown' | null | undefined, previousType: string) {
  if (relation === 'replace') return 'replacement'
  if (relation === 'bonus') return 'bonus'
  return previousType === 'modified_planned' ? 'modified_planned' : 'free'
}

export async function POST(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuthedUser()
  if (!user) return NextResponse.json({ error }, { status: 401 })

  const client = await resolveClientForUser(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })

  const parsed = finishSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const db = createServiceDb()
  const { session, exercises } = await fetchFlexWorkoutSession(db, params.sessionId)
  if (!session || session.client_id !== client.id) {
    return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
  }

  if (session.status === 'completed') {
    return NextResponse.json({
      session,
      exercises,
      summary: summarizeFlexWorkoutSession(session, exercises),
      alreadyCompleted: true,
    })
  }

  const endedAt = new Date().toISOString()
  const durationSeconds = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(session.started_at).getTime()) / 1000))
  const type = resolveType(parsed.data.relation_to_planned_workout ?? session.relation_to_planned_workout, session.type)

  const { data: updated, error: updateError } = await db
    .from('flex_workout_sessions')
    .update({
      status: 'completed',
      type,
      ended_at: endedAt,
      duration_seconds: durationSeconds,
      notes: parsed.data.notes ?? session.notes,
      perceived_difficulty: parsed.data.perceived_difficulty ?? session.perceived_difficulty,
      global_rir: parsed.data.global_rir ?? session.global_rir,
      relation_to_planned_workout: parsed.data.relation_to_planned_workout ?? session.relation_to_planned_workout,
    })
    .eq('id', params.sessionId)
    .eq('client_id', client.id)
    .select('*')
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? 'Impossible de terminer la séance' }, { status: 500 })
  }

  const displayExercises = exercises.map(exercise => ({
    ...exercise,
    display_name: exercise.custom_exercise_name ?? resolveCatalogExerciseName(exercise.exercise_id) ?? 'Exercice',
  }))

  const bundle = {
    session: updated,
    exercises: displayExercises,
    summary: summarizeFlexWorkoutSession(updated, exercises),
  }

  const { legacySessionId, error: mirrorError } = await mirrorFlexWorkoutToLegacyLogs(db, client.id, client.coach_id, bundle)
  if (mirrorError) {
    console.error('[flex-workouts finish] legacy mirror error', { sessionId: params.sessionId, mirrorError })
  }

  return NextResponse.json({
    ...bundle,
    legacySessionId,
    mirrorError,
  })
}
