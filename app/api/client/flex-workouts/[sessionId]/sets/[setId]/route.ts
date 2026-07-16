import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthedUser, resolveClientForUser, createServiceDb } from '@/lib/training/flexTraining/server'

type Params = { params: { sessionId: string; setId: string } }

const patchSchema = z.object({
  set_number: z.number().int().positive().nullable().optional(),
  side: z.enum(['left', 'right', 'bilateral']).nullable().optional(),
  set_type: z.enum(['warmup', 'working', 'cooldown', 'dropset']).nullable().optional(),
  weight: z.number().nonnegative().nullable().optional(),
  reps: z.number().int().nonnegative().nullable().optional(),
  rir: z.number().int().min(0).max(10).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  rest_seconds: z.number().int().nonnegative().nullable().optional(),
  tempo: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  pain_flag: z.boolean().optional(),
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
    .select('client_id')
    .eq('id', params.sessionId)
    .maybeSingle()

  if (!sessionRow || sessionRow.client_id !== client.id) {
    return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
  }

  const { data: row } = await db
    .from('flex_workout_sets')
    .select('id, exercise_log_id')
    .eq('id', params.setId)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ error: 'Série introuvable' }, { status: 404 })
  }

  const { data: exercise } = await db
    .from('flex_workout_exercises')
    .select('id, session_id')
    .eq('id', row.exercise_log_id)
    .eq('session_id', params.sessionId)
    .maybeSingle()

  if (!exercise) {
    return NextResponse.json({ error: 'Série introuvable' }, { status: 404 })
  }

  const fullPatch = {
    ...(parsed.data.set_number !== undefined ? { set_number: parsed.data.set_number } : {}),
    ...(parsed.data.side !== undefined ? { side: parsed.data.side } : {}),
    ...(parsed.data.set_type !== undefined ? { set_type: parsed.data.set_type } : {}),
    ...(parsed.data.weight !== undefined ? { weight: parsed.data.weight } : {}),
    ...(parsed.data.reps !== undefined ? { reps: parsed.data.reps } : {}),
    ...(parsed.data.rir !== undefined ? { rir: parsed.data.rir } : {}),
    ...(parsed.data.rpe !== undefined ? { rpe: parsed.data.rpe } : {}),
    ...(parsed.data.rest_seconds !== undefined ? { rest_seconds: parsed.data.rest_seconds } : {}),
    ...(parsed.data.tempo !== undefined ? { tempo: parsed.data.tempo } : {}),
    ...(parsed.data.completed !== undefined ? { completed: parsed.data.completed } : {}),
    ...(parsed.data.pain_flag !== undefined ? { pain_flag: parsed.data.pain_flag } : {}),
    ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
  }

  let { data, error: updateError } = await db
    .from('flex_workout_sets')
    .update(fullPatch)
    .eq('id', params.setId)
    .select('*')
    .single()

  if (updateError && isMissingColumnError(updateError.message)) {
    const fallbackPatch = {
      ...(parsed.data.set_number !== undefined ? { set_number: parsed.data.set_number } : {}),
      ...(parsed.data.weight !== undefined ? { weight: parsed.data.weight } : {}),
      ...(parsed.data.reps !== undefined ? { reps: parsed.data.reps } : {}),
      ...(parsed.data.rir !== undefined ? { rir: parsed.data.rir } : {}),
      ...(parsed.data.rpe !== undefined ? { rpe: parsed.data.rpe } : {}),
      ...(parsed.data.rest_seconds !== undefined ? { rest_seconds: parsed.data.rest_seconds } : {}),
      ...(parsed.data.tempo !== undefined ? { tempo: parsed.data.tempo } : {}),
      ...(parsed.data.completed !== undefined ? { completed: parsed.data.completed } : {}),
      ...(parsed.data.pain_flag !== undefined ? { pain_flag: parsed.data.pain_flag } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    }

    const fallback = await db
      .from('flex_workout_sets')
      .update(fallbackPatch)
      .eq('id', params.setId)
      .select('*')
      .single()

    data = fallback.data
    updateError = fallback.error
  }

  if (updateError || !data) {
    return NextResponse.json({ error: updateError?.message ?? 'Impossible de mettre à jour la série' }, { status: 500 })
  }

  return NextResponse.json({ set: data })
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

  const { data: row } = await db
    .from('flex_workout_sets')
    .select('id, exercise_log_id')
    .eq('id', params.setId)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ error: 'Série introuvable' }, { status: 404 })
  }

  const { data: exercise } = await db
    .from('flex_workout_exercises')
    .select('id, session_id')
    .eq('id', row.exercise_log_id)
    .eq('session_id', params.sessionId)
    .maybeSingle()

  if (!exercise) {
    return NextResponse.json({ error: 'Série introuvable' }, { status: 404 })
  }

  const { error: deleteError } = await db
    .from('flex_workout_sets')
    .delete()
    .eq('id', params.setId)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
