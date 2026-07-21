import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceDb, requireAuthedUser, resolveClientForUser } from '@/lib/training/flexTraining/server'
import { fetchFlexWorkoutSession, localizeFlexExercises } from '@/lib/training/flexTraining/queries'
import { summarizeFlexWorkoutSession } from '@/lib/training/flexTraining/summary'
import { loadExerciseNameResolver } from '@/lib/i18n/exerciseDisplayName'
import type { ClientLang } from '@/lib/i18n/clientTranslations'
import type { FlexWorkoutType } from '@/lib/training/flexTraining/types'

type Params = { params: { sessionId: string } }

const patchSchema = z.object({
  relation_to_planned_workout: z.enum(['replace', 'bonus', 'unknown']).nullable().optional(),
  notes: z.string().nullable().optional(),
  perceived_difficulty: z.number().int().min(1).max(10).nullable().optional(),
  global_rir: z.number().int().min(0).max(10).nullable().optional(),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
})

function resolveType(
  relation: 'replace' | 'bonus' | 'unknown' | null | undefined,
  previousType: FlexWorkoutType,
): FlexWorkoutType {
  if (relation === 'replace') return 'replacement'
  if (relation === 'bonus') return 'bonus'
  if (previousType === 'modified_planned') return 'modified_planned'
  return relation ? 'free' : previousType
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuthedUser()
  if (!user) return NextResponse.json({ error }, { status: 401 })

  const client = await resolveClientForUser(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })

  const db = createServiceDb()
  const { session, exercises } = await fetchFlexWorkoutSession(db, params.sessionId)
  if (!session || session.client_id !== client.id) {
    return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
  }

  const { data: preferences } = await db
    .from('client_preferences')
    .select('language')
    .eq('client_id', client.id)
    .maybeSingle()
  const lang: ClientLang = preferences?.language === 'es' || preferences?.language === 'en' ? preferences.language : 'fr'
  const localizedExercises = localizeFlexExercises(exercises, await loadExerciseNameResolver(db, lang))

  return NextResponse.json({
    session,
    exercises: localizedExercises,
    summary: summarizeFlexWorkoutSession(session, exercises),
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuthedUser()
  if (!user) return NextResponse.json({ error }, { status: 401 })

  const client = await resolveClientForUser(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const db = createServiceDb()
  const { session } = await fetchFlexWorkoutSession(db, params.sessionId)
  if (!session || session.client_id !== client.id) {
    return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
  }

  const nextRelation = parsed.data.relation_to_planned_workout ?? session.relation_to_planned_workout
  const nextType = resolveType(nextRelation, session.type)

  const patch: Record<string, unknown> = { type: nextType }
  if (parsed.data.relation_to_planned_workout !== undefined) patch.relation_to_planned_workout = parsed.data.relation_to_planned_workout
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes
  if (parsed.data.perceived_difficulty !== undefined) patch.perceived_difficulty = parsed.data.perceived_difficulty
  if (parsed.data.global_rir !== undefined) patch.global_rir = parsed.data.global_rir
  if (parsed.data.status !== undefined) patch.status = parsed.data.status

  const { data: updated, error: updateError } = await db
    .from('flex_workout_sessions')
    .update(patch)
    .eq('id', params.sessionId)
    .eq('client_id', client.id)
    .select('*')
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? 'Impossible de mettre à jour la séance' }, { status: 500 })
  }

  const bundle = await fetchFlexWorkoutSession(db, params.sessionId)
  return NextResponse.json({
    session: updated,
    exercises: bundle.exercises,
    summary: summarizeFlexWorkoutSession(updated, bundle.exercises),
  })
}
