import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceDb, requireAuthedUser, resolveClientForUser } from '@/lib/training/flexTraining/server'
import type { FlexWorkoutType } from '@/lib/training/flexTraining/types'
import { fetchFlexWorkoutSession } from '@/lib/training/flexTraining/queries'
import { summarizeFlexWorkoutSession } from '@/lib/training/flexTraining/summary'

const startSchema = z.object({
  relation_to_planned_workout: z.enum(['replace', 'bonus', 'unknown']).nullable().optional(),
  source_program_id: z.string().uuid().nullable().optional(),
  source_workout_id: z.string().uuid().nullable().optional(),
  replaced_workout_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
})

const ACTIVE_SESSION_REUSE_WINDOW_HOURS = 8

function resolveType(
  relation: 'replace' | 'bonus' | 'unknown' | null | undefined,
  sourceWorkoutId: string | null | undefined,
): FlexWorkoutType {
  if (relation === 'replace') return 'replacement'
  if (relation === 'bonus') return 'bonus'
  if (sourceWorkoutId) return 'modified_planned'
  return 'free'
}

function normalizeNullable(value: string | null | undefined) {
  return value ?? null
}

function canReuseActiveSession(
  activeSession: {
    type: FlexWorkoutType
    relation_to_planned_workout: 'replace' | 'bonus' | 'unknown' | null
    source_program_id: string | null
    source_workout_id: string | null
    replaced_workout_id: string | null
  },
  requestedSession: {
    type: FlexWorkoutType
    relation_to_planned_workout: 'replace' | 'bonus' | 'unknown' | null
    source_program_id: string | null
    source_workout_id: string | null
    replaced_workout_id: string | null
  },
) {
  return activeSession.type === requestedSession.type
    && normalizeNullable(activeSession.relation_to_planned_workout) === normalizeNullable(requestedSession.relation_to_planned_workout)
    && normalizeNullable(activeSession.source_program_id) === normalizeNullable(requestedSession.source_program_id)
    && normalizeNullable(activeSession.source_workout_id) === normalizeNullable(requestedSession.source_workout_id)
    && normalizeNullable(activeSession.replaced_workout_id) === normalizeNullable(requestedSession.replaced_workout_id)
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuthedUser()
  if (!user) return NextResponse.json({ error }, { status: 401 })

  const client = await resolveClientForUser(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })

  const parsed = startSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const db = createServiceDb()
  const reuseThreshold = new Date(Date.now() - (ACTIVE_SESSION_REUSE_WINDOW_HOURS * 60 * 60 * 1000)).toISOString()

  let sourceProgramId = parsed.data.source_program_id ?? null
  if (!sourceProgramId && parsed.data.source_workout_id) {
    const { data: sourceWorkout } = await db
      .from('program_sessions')
      .select('program_id')
      .eq('id', parsed.data.source_workout_id)
      .maybeSingle()
    sourceProgramId = sourceWorkout?.program_id ?? null
  }

  const type = resolveType(parsed.data.relation_to_planned_workout ?? null, parsed.data.source_workout_id ?? null)
  const requestedSession = {
    type,
    relation_to_planned_workout: parsed.data.relation_to_planned_workout ?? null,
    source_program_id: sourceProgramId,
    source_workout_id: parsed.data.source_workout_id ?? null,
    replaced_workout_id: parsed.data.replaced_workout_id ?? null,
  }

  const activeSession = await db
    .from('flex_workout_sessions')
    .select('id, type, relation_to_planned_workout, source_program_id, source_workout_id, replaced_workout_id')
    .eq('client_id', client.id)
    .in('status', ['draft', 'active'])
    .gte('started_at', reuseThreshold)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeSession.data && canReuseActiveSession(activeSession.data, requestedSession)) {
    const bundle = await fetchFlexWorkoutSession(db, activeSession.data.id)
    return NextResponse.json({
      session: bundle.session,
      exercises: bundle.exercises,
      summary: summarizeFlexWorkoutSession(bundle.session ?? {
        started_at: new Date().toISOString(),
        ended_at: null,
        duration_seconds: null,
      }, bundle.exercises),
      reused: true,
    })
  }

  const { data: session, error: insertError } = await db
    .from('flex_workout_sessions')
    .insert({
      client_id: client.id,
      coach_id: client.coach_id,
      type,
      relation_to_planned_workout: parsed.data.relation_to_planned_workout ?? null,
      source_program_id: sourceProgramId,
      source_workout_id: parsed.data.source_workout_id ?? null,
      replaced_workout_id: parsed.data.replaced_workout_id ?? null,
      started_at: new Date().toISOString(),
      status: 'active',
      notes: parsed.data.notes ?? null,
    })
    .select('*')
    .single()

  if (insertError || !session) {
    return NextResponse.json({ error: insertError?.message ?? 'Impossible de démarrer la séance libre' }, { status: 500 })
  }

  return NextResponse.json({
    session,
    exercises: [],
    summary: summarizeFlexWorkoutSession(session, []),
  }, { status: 201 })
}
