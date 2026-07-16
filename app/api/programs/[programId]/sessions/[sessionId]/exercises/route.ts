import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { programId: string; sessionId: string } }

// POST /api/programs/[programId]/sessions/[sessionId]/exercises
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: program } = await service()
    .from('programs')
    .select('id')
    .eq('id', params.programId)
    .eq('coach_id', user.id)
    .single()
  if (!program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })

  const body = await req.json()
  const { name, sets, reps, rest_sec, tempo, rir, notes, position, set_prescriptions, superset_rest_mode } = body
  if (!name) return NextResponse.json({ error: 'name requis' }, { status: 400 })

  const { primary_muscles, secondary_muscles, execution_type, target_hr_zone } = body
  const { data, error } = await service()
    .from('program_exercises')
    .insert({ session_id: params.sessionId, name, sets: sets ?? 3, reps: reps ?? '8-12', rest_sec, tempo, rir, notes, position: position ?? 0, primary_muscles: primary_muscles ?? [], secondary_muscles: secondary_muscles ?? [], set_prescriptions: set_prescriptions ?? null, superset_rest_mode: superset_rest_mode ?? 'after_round', execution_type: execution_type ?? 'reps_rir', target_hr_zone: target_hr_zone ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ exercise: data }, { status: 201 })
}

// PUT /api/programs/[programId]/sessions/[sessionId]/exercises — bulk replace
export async function PUT(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: program } = await service()
    .from('programs')
    .select('id')
    .eq('id', params.programId)
    .eq('coach_id', user.id)
    .single()
  if (!program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })

  const { exercises } = await req.json()
  if (!Array.isArray(exercises)) return NextResponse.json({ error: 'exercises[] requis' }, { status: 400 })

  const db = service()
  await db.from('program_exercises').delete().eq('session_id', params.sessionId)

  if (exercises.length > 0) {
    const rows = exercises.map((e: any, i: number) => ({
      session_id: params.sessionId,
      name: e.name,
      sets: e.sets ?? 3,
      reps: e.reps ?? '8-12',
      rest_sec: e.rest_sec ?? null,
      tempo: e.tempo ?? null,
      rir: e.rir ?? null,
      notes: e.notes ?? null,
      position: i,
      image_url: e.image_url ?? null,
      primary_muscles: e.primary_muscles ?? [],
      secondary_muscles: e.secondary_muscles ?? [],
      is_unilateral: e.is_unilateral ?? false,
      // Double progression
      rep_min: e.rep_min ?? null,
      rep_max: e.rep_max ?? null,
      target_rir: e.target_rir ?? e.rir ?? null,
      weight_increment_kg: e.weight_increment_kg ?? 2.5,
      set_prescriptions: e.set_prescriptions ?? null,
      superset_rest_mode: e.superset_rest_mode ?? 'after_round',
      execution_type: e.execution_type ?? 'reps_rir',
      target_hr_zone: e.target_hr_zone ?? null,
    }))
    const { error } = await db.from('program_exercises').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
