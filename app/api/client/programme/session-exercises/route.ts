import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  name: z.string().trim().min(1),
  sets: z.number().int().min(1).max(20).optional(),
  reps: z.string().trim().min(1).max(50).optional(),
  rest_sec: z.number().int().min(0).max(1800).nullable().optional(),
  tempo: z.string().trim().max(20).nullable().optional(),
  rir: z.number().int().min(0).max(5).nullable().optional(),
  target_rir: z.number().int().min(0).max(5).nullable().optional(),
  rep_min: z.number().int().min(1).max(100).nullable().optional(),
  rep_max: z.number().int().min(1).max(100).nullable().optional(),
  weight_increment_kg: z.number().min(0).max(100).nullable().optional(),
  image_url: z.string().trim().min(1).nullable().optional(),
  is_unilateral: z.boolean().optional(),
  movement_pattern: z.string().trim().max(50).nullable().optional(),
  primary_muscles: z.array(z.string()).optional(),
  secondary_muscles: z.array(z.string()).optional(),
  superset_rest_mode: z.enum(['after_exercise', 'after_round']).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
})

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const db = service()
  const { sessionId } = parsed.data

  const { data: client } = await db
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!client?.id) {
    return NextResponse.json({ error: 'Client profile not found' }, { status: 404 })
  }

  const { data: session } = await db
    .from('program_sessions')
    .select(`
      id,
      program_id,
      programs!inner (
        id,
        client_id,
        status
      )
    `)
    .eq('id', sessionId)
    .eq('programs.client_id', client.id)
    .maybeSingle()

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const { data: existingExercises } = await db
    .from('program_exercises')
    .select('position')
    .eq('session_id', sessionId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = ((existingExercises?.[0] as { position?: number } | undefined)?.position ?? -1) + 1

  const payload = {
    session_id: sessionId,
    name: parsed.data.name,
    sets: parsed.data.sets ?? 3,
    reps: parsed.data.reps ?? '8-12',
    rest_sec: parsed.data.rest_sec ?? 90,
    tempo: parsed.data.tempo ?? null,
    rir: parsed.data.rir ?? 2,
    target_rir: parsed.data.target_rir ?? parsed.data.rir ?? 2,
    rep_min: parsed.data.rep_min ?? null,
    rep_max: parsed.data.rep_max ?? null,
    weight_increment_kg: parsed.data.weight_increment_kg ?? 2.5,
    notes: parsed.data.notes ?? null,
    position: nextPosition,
    image_url: parsed.data.image_url?.trim() || null,
    is_unilateral: parsed.data.is_unilateral ?? false,
    movement_pattern: parsed.data.movement_pattern ?? null,
    primary_muscles: parsed.data.primary_muscles ?? [],
    secondary_muscles: parsed.data.secondary_muscles ?? [],
    superset_rest_mode: parsed.data.superset_rest_mode ?? 'after_round',
    created_by_client: true,
    created_by_client_id: client.id,
  }

  const { data: exercise, error } = await db
    .from('program_exercises')
    .insert(payload)
    .select(`
      id, name, sets, reps, rest_sec, rir, notes, position,
      target_rir, current_weight_kg, rep_min, rep_max, weight_increment_kg,
      image_url, is_unilateral, primary_muscles, secondary_muscles, group_id,
      tempo, movement_pattern, set_prescriptions, superset_rest_mode, created_by_client
    `)
    .single()

  if (error || !exercise) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create exercise' }, { status: 500 })
  }

  return NextResponse.json({ exercise }, { status: 201 })
}
