import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthedUser, resolveClientForUser, createServiceDb } from '@/lib/training/flexTraining/server'

type Params = { params: { sessionId: string } }

const createSchema = z.object({
  exercise_log_id: z.string().uuid(),
  set_number: z.number().int().positive(),
  side: z.enum(['left', 'right', 'bilateral']).optional(),
  set_type: z.enum(['warmup', 'working', 'cooldown', 'dropset']).optional(),
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

export async function POST(req: NextRequest, { params }: Params) {
  const { user, error } = await requireAuthedUser()
  if (!user) return NextResponse.json({ error }, { status: 401 })

  const client = await resolveClientForUser(user.id, user.email)
  if (!client) return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 })

  const db = createServiceDb()
  const { data: exercise } = await db
    .from('flex_workout_exercises')
    .select('id, session_id, flex_workout_sessions!inner(client_id)')
    .eq('id', parsed.data.exercise_log_id)
    .eq('session_id', params.sessionId)
    .single()

  if (!exercise || (exercise as any).flex_workout_sessions?.client_id !== client.id) {
    return NextResponse.json({ error: 'Exercice introuvable' }, { status: 404 })
  }

  const { data: existing } = await db
    .from('flex_workout_sets')
    .select('set_number')
    .eq('exercise_log_id', parsed.data.exercise_log_id)
    .order('set_number', { ascending: false })
    .limit(1)

  const nextSet = parsed.data.set_number ?? (((existing ?? [])[0]?.set_number ?? 0))

  const fullPayload = {
    exercise_log_id: parsed.data.exercise_log_id,
    set_number: nextSet,
    side: parsed.data.side ?? 'bilateral',
    set_type: parsed.data.set_type ?? 'working',
    weight: parsed.data.weight ?? null,
    reps: parsed.data.reps ?? null,
    rir: parsed.data.rir ?? null,
    rpe: parsed.data.rpe ?? null,
    rest_seconds: parsed.data.rest_seconds ?? null,
    tempo: parsed.data.tempo ?? null,
    completed: parsed.data.completed ?? true,
    pain_flag: parsed.data.pain_flag ?? false,
    notes: parsed.data.notes ?? null,
  }

  let { data, error: insertError } = await db
    .from('flex_workout_sets')
    .insert(fullPayload)
    .select('*')
    .single()

  if (insertError && isMissingColumnError(insertError.message)) {
    const fallback = await db
      .from('flex_workout_sets')
      .insert({
        exercise_log_id: parsed.data.exercise_log_id,
        set_number: nextSet,
        weight: parsed.data.weight ?? null,
        reps: parsed.data.reps ?? null,
        rir: parsed.data.rir ?? null,
        rpe: parsed.data.rpe ?? null,
        rest_seconds: parsed.data.rest_seconds ?? null,
        tempo: parsed.data.tempo ?? null,
        completed: parsed.data.completed ?? true,
        pain_flag: parsed.data.pain_flag ?? false,
        notes: parsed.data.notes ?? null,
      })
      .select('*')
      .single()

    data = fallback.data
    insertError = fallback.error
  }

  if (insertError || !data) {
    return NextResponse.json({ error: insertError?.message ?? 'Impossible d’ajouter la série' }, { status: 500 })
  }

  return NextResponse.json({ set: data }, { status: 201 })
}
