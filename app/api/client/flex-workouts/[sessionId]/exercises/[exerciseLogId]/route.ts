import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthedUser, resolveClientForUser, createServiceDb } from '@/lib/training/flexTraining/server'
import { resolveCatalogExerciseName } from '@/lib/training/flexTraining/catalog'
import { loadExerciseNameResolver } from '@/lib/i18n/exerciseDisplayName'
import type { ClientLang } from '@/lib/i18n/clientTranslations'

type Params = { params: { sessionId: string; exerciseLogId: string } }

const patchSchema = z.object({
  exercise_id: z.string().nullable().optional(),
  custom_exercise_name: z.string().nullable().optional(),
  muscle_groups: z.array(z.string()).nullable().optional(),
  movement_pattern: z.string().nullable().optional(),
  equipment: z.array(z.string()).nullable().optional(),
  primary_muscles: z.array(z.string()).nullable().optional(),
  secondary_muscles: z.array(z.string()).nullable().optional(),
  is_compound: z.boolean().nullable().optional(),
  unilateral: z.boolean().nullable().optional(),
  image_url: z.string().nullable().optional(),
  order_index: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
})

function isMissingColumnError(message: string | undefined) {
  return typeof message === 'string' && (
    message.includes('Could not find the') ||
    message.includes('column') ||
    message.includes('schema cache')
  )
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuthedUser()
  if (!user) return NextResponse.json({ error }, { status: 401 })

  const client = await resolveClientForUser(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const db = createServiceDb()
  const { data: sessionRow } = await db
    .from('flex_workout_sessions')
    .select('client_id, coach_id')
    .eq('id', params.sessionId)
    .maybeSingle()

  if (!sessionRow || sessionRow.client_id !== client.id) {
    return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
  }

  const { data: exercise } = await db
    .from('flex_workout_exercises')
    .select('id, session_id')
    .eq('id', params.exerciseLogId)
    .eq('session_id', params.sessionId)
    .maybeSingle()

  if (!exercise) {
    return NextResponse.json({ error: 'Exercice introuvable' }, { status: 404 })
  }

  const selectingCatalogueExercise = parsed.data.exercise_id !== undefined && parsed.data.exercise_id !== null
  const fullPatch = {
    ...(parsed.data.exercise_id !== undefined ? { exercise_id: parsed.data.exercise_id } : {}),
    ...(selectingCatalogueExercise
      ? { custom_exercise_name: null }
      : parsed.data.custom_exercise_name !== undefined ? { custom_exercise_name: parsed.data.custom_exercise_name } : {}),
    ...(parsed.data.muscle_groups !== undefined ? { muscle_groups: parsed.data.muscle_groups } : {}),
    ...(parsed.data.movement_pattern !== undefined ? { movement_pattern: parsed.data.movement_pattern } : {}),
    ...(parsed.data.equipment !== undefined ? { equipment: parsed.data.equipment } : {}),
    ...(parsed.data.primary_muscles !== undefined ? { primary_muscles: parsed.data.primary_muscles } : {}),
    ...(parsed.data.secondary_muscles !== undefined ? { secondary_muscles: parsed.data.secondary_muscles } : {}),
    ...(parsed.data.is_compound !== undefined ? { is_compound: parsed.data.is_compound } : {}),
    ...(parsed.data.unilateral !== undefined ? { unilateral: parsed.data.unilateral } : {}),
    ...(parsed.data.image_url !== undefined ? { image_url: parsed.data.image_url } : {}),
    ...(parsed.data.order_index !== undefined ? { order_index: parsed.data.order_index } : {}),
    ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
  }

  let { data, error: updateError } = await db
    .from('flex_workout_exercises')
    .update(fullPatch)
    .eq('id', params.exerciseLogId)
    .eq('session_id', params.sessionId)
    .select('*')
    .single()

  if (updateError && isMissingColumnError(updateError.message)) {
    const fallbackPatch = {
      ...(parsed.data.exercise_id !== undefined ? { exercise_id: parsed.data.exercise_id } : {}),
      ...(selectingCatalogueExercise
        ? { custom_exercise_name: null }
        : parsed.data.custom_exercise_name !== undefined ? { custom_exercise_name: parsed.data.custom_exercise_name } : {}),
      ...(parsed.data.muscle_groups !== undefined ? { muscle_groups: parsed.data.muscle_groups } : {}),
      ...(parsed.data.order_index !== undefined ? { order_index: parsed.data.order_index } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    }

    const fallback = await db
      .from('flex_workout_exercises')
      .update(fallbackPatch)
      .eq('id', params.exerciseLogId)
      .eq('session_id', params.sessionId)
      .select('*')
      .single()

    data = fallback.data
    updateError = fallback.error
  }

  if (updateError || !data) {
    return NextResponse.json({ error: updateError?.message ?? 'Impossible de mettre à jour l’exercice' }, { status: 500 })
  }

  if (parsed.data.notes?.trim() && sessionRow.coach_id) {
    const exerciseName = data.custom_exercise_name ?? 'un exercice'
    const payload = {
      flex_session_id: params.sessionId,
      exercise_log_id: params.exerciseLogId,
      action_url: `/coach/clients/${client.id}/data/performances/flex-workouts/${params.sessionId}`,
    }
    const { data: existing } = await db.from('coach_notifications')
      .select('id').eq('coach_id', sessionRow.coach_id).eq('status', 'pending')
      .contains('payload', { flex_session_id: params.sessionId, exercise_log_id: params.exerciseLogId }).maybeSingle()
    const body = `Le client a laissé un commentaire sur « ${exerciseName} » dans une séance libre.`

    if (existing) {
      await db.from('coach_notifications').update({ body, payload }).eq('id', existing.id)
    } else {
      await db.from('coach_notifications').insert({
        coach_id: sessionRow.coach_id,
        client_id: client.id,
        category: 'training',
        subcategory: 'exercise_comment',
        priority: 3,
        status: 'pending',
        email_sent: false,
        title: 'Nouveau commentaire client',
        body,
        payload,
      })
    }
  }

  const { data: preferences } = await db
    .from('client_preferences')
    .select('language')
    .eq('client_id', client.id)
    .maybeSingle()
  const lang: ClientLang = preferences?.language === 'es' || preferences?.language === 'en' ? preferences.language : 'fr'
  const catalogName = resolveCatalogExerciseName(data.exercise_id)
  const display_name = data.custom_exercise_name
    ?? (catalogName ? (await loadExerciseNameResolver(db, lang))(catalogName, data.exercise_id) : 'Exercice')

  return NextResponse.json({ exercise: { ...data, display_name } })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuthedUser()
  if (!user) return NextResponse.json({ error }, { status: 401 })

  const client = await resolveClientForUser(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })

  const db = createServiceDb()
  const { data: sessionRow } = await db
    .from('flex_workout_sessions')
    .select('client_id')
    .eq('id', params.sessionId)
    .maybeSingle()

  if (!sessionRow || sessionRow.client_id !== client.id) {
    return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
  }

  const { data: exercise } = await db
    .from('flex_workout_exercises')
    .select('id, session_id')
    .eq('id', params.exerciseLogId)
    .eq('session_id', params.sessionId)
    .maybeSingle()

  if (!exercise) {
    return NextResponse.json({ error: 'Exercice introuvable' }, { status: 404 })
  }

  const { error: deleteError } = await db
    .from('flex_workout_exercises')
    .delete()
    .eq('id', params.exerciseLogId)
    .eq('session_id', params.sessionId)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
