import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const SELECT = `
  id, name, description, goal, level, frequency, weeks, muscle_tags,
  equipment_archetype, session_mode, status, is_client_visible, created_at,
  program_sessions (
    id, name, day_of_week, days_of_week, position, notes,
    program_exercises (
      id, name, sets, reps, rest_sec, rir, notes, position, image_url,
      movement_pattern, equipment_required, primary_muscles, secondary_muscles,
      group_id, is_compound, target_rir, weight_increment_kg, tempo, set_prescriptions,
      plane, mechanic, unilateral, primary_muscle, primary_activation,
      secondary_muscles_detail, secondary_activations, stabilizers,
      joint_stress_spine, joint_stress_knee, joint_stress_shoulder,
      global_instability, coordination_demand, constraint_profile
    )
  )
`

type Params = { params: { programId: string } }

// PATCH /api/programs/[programId]
// Supports two modes:
//   1. Simple field patch (is_client_visible, status, name…) — when body has no `sessions`
//   2. Full atomic rebuild (sessions + exercises) — when body includes `sessions`
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const db = service()

  // Full rebuild when sessions are included (studio-lab builder save)
  if (body.sessions) {
    const { data: existingSessions } = await db
      .from('program_sessions')
      .select('id')
      .eq('program_id', params.programId)

    const existingSessionIds = (existingSessions ?? []).map((s: any) => s.id)

    let existingExerciseIds: string[] = []
    if (existingSessionIds.length) {
      const { data: existingExs } = await db
        .from('program_exercises')
        .select('id')
        .in('session_id', existingSessionIds)
      existingExerciseIds = (existingExs ?? []).map((e: any) => e.id)
    }

    // Delete all existing sessions (cascades to exercises)
    if (existingSessionIds.length) {
      await db.from('program_sessions').delete().eq('program_id', params.programId)
    }

    for (let si = 0; si < body.sessions.length; si++) {
      const s = body.sessions[si]
      const { data: session } = await db
        .from('program_sessions')
        .insert({
          program_id: params.programId,
          name: s.name,
          days_of_week: s.days_of_week ?? [],
          day_of_week: (s.days_of_week ?? [])[0] ?? s.day_of_week ?? null,
          position: si,
          notes: s.notes ?? null,
        })
        .select('id')
        .single()

      if (!session) {
        console.error(`[program PATCH] failed to insert session ${si}:`, s.name)
        continue
      }
      if (s.exercises?.length) {
        for (let ei = 0; ei < s.exercises.length; ei++) {
          const e = s.exercises[ei]
          await db.from('program_exercises').insert({
            session_id: session.id,
            name: e.name,
            sets: e.sets ?? 3,
            reps: e.reps ?? '8-12',
            rest_sec: e.rest_sec ?? null,
            rir: e.rir ?? null,
            notes: e.notes ?? null,
            position: ei,
            image_url: e.image_url ?? null,
            movement_pattern: e.movement_pattern ?? null,
            equipment_required: e.equipment_required ?? [],
            primary_muscles: e.primary_muscles ?? [],
            secondary_muscles: e.secondary_muscles ?? [],
            group_id: e.group_id ?? null,
            is_compound: e.is_compound ?? null,
            is_unilateral: e.is_unilateral ?? false,
            target_rir: e.target_rir ?? null,
            weight_increment_kg: e.weight_increment_kg ?? 2.5,
            tempo: e.tempo ?? null,
            set_prescriptions: e.set_prescriptions ?? null,
            // Biomech fields
            plane: e.plane ?? null,
            mechanic: e.mechanic ?? null,
            unilateral: e.unilateral ?? false,
            primary_muscle: e.primary_muscle ?? null,
            primary_activation: e.primary_activation != null ? Number(e.primary_activation) : null,
            secondary_muscles_detail: e.secondary_muscles_detail ?? [],
            secondary_activations: (e.secondary_activations ?? []).map(Number),
            stabilizers: e.stabilizers ?? [],
            joint_stress_spine: e.joint_stress_spine != null ? Number(e.joint_stress_spine) : null,
            joint_stress_knee: e.joint_stress_knee != null ? Number(e.joint_stress_knee) : null,
            joint_stress_shoulder: e.joint_stress_shoulder != null ? Number(e.joint_stress_shoulder) : null,
            global_instability: e.global_instability != null ? Number(e.global_instability) : null,
            coordination_demand: e.coordination_demand != null ? Number(e.coordination_demand) : null,
            constraint_profile: e.constraint_profile ?? null,
          })
        }
      }
    }
  }

  // Build meta patch — includes both simple toggles and full metadata
  const {
    name, description, goal, level, frequency, weeks, muscle_tags,
    equipment_archetype, session_mode, status, is_client_visible,
  } = body

  const patch: Record<string, unknown> = {}
  if (name !== undefined) patch.name = name
  if (description !== undefined) patch.description = description
  if (goal !== undefined) patch.goal = goal
  if (level !== undefined) patch.level = level
  if (frequency !== undefined) patch.frequency = frequency
  if (weeks !== undefined) patch.weeks = weeks
  if (muscle_tags !== undefined) patch.muscle_tags = muscle_tags
  if (equipment_archetype !== undefined) patch.equipment_archetype = equipment_archetype || null
  if (session_mode !== undefined) patch.session_mode = session_mode
  if (status !== undefined) patch.status = status
  if (is_client_visible !== undefined) patch.is_client_visible = is_client_visible

  if (Object.keys(patch).length === 0 && !body.sessions) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  if (Object.keys(patch).length > 0) {
    const { data, error } = await db
      .from('programs')
      .update(patch)
      .eq('id', params.programId)
      .eq('coach_id', user.id)
      .select(SELECT)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })
    return NextResponse.json({ program: data })
  }

  // sessions-only save — return refreshed data
  const { data, error } = await db
    .from('programs')
    .select(SELECT)
    .eq('id', params.programId)
    .eq('coach_id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ program: data })
}

// DELETE /api/programs/[programId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()

  // Remove metric annotation created when this program was assigned
  await db
    .from('metric_annotations')
    .delete()
    .eq('source_id', params.programId)

  const { error } = await db
    .from('programs')
    .delete()
    .eq('id', params.programId)
    .eq('coach_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
