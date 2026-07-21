import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthedUser, resolveClientForUser, createServiceDb } from '@/lib/training/flexTraining/server'
import { fetchFlexWorkoutSession } from '@/lib/training/flexTraining/queries'
import { resolveCatalogExerciseMeta, resolveCatalogExerciseMuscles, resolveCatalogExerciseName } from '@/lib/training/flexTraining/catalog'
import { loadExerciseNameResolver } from '@/lib/i18n/exerciseDisplayName'
import type { ClientLang } from '@/lib/i18n/clientTranslations'

type Params = { params: { sessionId: string } }

const createSchema = z.object({
  exercise_id: z.string().min(1).nullable().optional(),
  custom_exercise_name: z.string().min(1).nullable().optional(),
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

export async function POST(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuthedUser()
  if (!user) return NextResponse.json({ error }, { status: 401 })

  const client = await resolveClientForUser(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const db = createServiceDb()
  const { session } = await fetchFlexWorkoutSession(db, params.sessionId)
  if (!session || session.client_id !== client.id) {
    return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
  }

  const { data: existingExercises } = await db
    .from('flex_workout_exercises')
    .select('order_index')
    .eq('session_id', params.sessionId)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextOrder = parsed.data.order_index ?? (((existingExercises ?? [])[0]?.order_index ?? -1) + 1)
  const exerciseId = parsed.data.exercise_id ?? null
  // A catalogue exercise is identified by exercise_id. Persisting its French
  // catalogue label as a custom name would bypass language resolution later.
  const customExerciseName = exerciseId ? null : parsed.data.custom_exercise_name?.trim() || null
  const catalogMeta = resolveCatalogExerciseMeta(exerciseId)

  const fullPayload = {
    session_id: params.sessionId,
    exercise_id: exerciseId,
    custom_exercise_name: customExerciseName,
    muscle_groups: parsed.data.muscle_groups ?? catalogMeta?.muscle_groups ?? resolveCatalogExerciseMuscles(exerciseId),
    movement_pattern: parsed.data.movement_pattern ?? catalogMeta?.movement_pattern ?? null,
    equipment: parsed.data.equipment ?? catalogMeta?.equipment ?? [],
    primary_muscles: parsed.data.primary_muscles ?? catalogMeta?.primary_muscles ?? [],
    secondary_muscles: parsed.data.secondary_muscles ?? catalogMeta?.secondary_muscles ?? [],
    is_compound: parsed.data.is_compound ?? catalogMeta?.is_compound ?? null,
    unilateral: parsed.data.unilateral ?? catalogMeta?.unilateral ?? false,
    image_url: parsed.data.image_url ?? catalogMeta?.image_url ?? null,
    order_index: nextOrder,
    notes: parsed.data.notes ?? null,
  }

  let { data: created, error: insertError } = await db
    .from('flex_workout_exercises')
    .insert(fullPayload)
    .select('*')
    .single()

  if (insertError && isMissingColumnError(insertError.message)) {
    const fallback = await db
      .from('flex_workout_exercises')
      .insert({
        session_id: params.sessionId,
        exercise_id: exerciseId,
        custom_exercise_name: customExerciseName,
        muscle_groups: fullPayload.muscle_groups,
        order_index: nextOrder,
        notes: parsed.data.notes ?? null,
      })
      .select('*')
      .single()

    created = fallback.data
    insertError = fallback.error
  }

  if (insertError || !created) {
    return NextResponse.json({ error: insertError?.message ?? 'Impossible d’ajouter l’exercice' }, { status: 500 })
  }

  const { data: preferences } = await db
    .from('client_preferences')
    .select('language')
    .eq('client_id', client.id)
    .maybeSingle()
  const lang: ClientLang = preferences?.language === 'es' || preferences?.language === 'en' ? preferences.language : 'fr'
  const catalogName = resolveCatalogExerciseName(exerciseId)
  const display_name = customExerciseName
    ?? (catalogName ? (await loadExerciseNameResolver(db, lang))(catalogName, exerciseId) : 'Exercice')

  return NextResponse.json({ exercise: { ...created, display_name } }, { status: 201 })
}
