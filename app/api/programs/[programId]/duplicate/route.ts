import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveStoredFrequency } from '@/lib/programs/frequency'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { programId: string } }

const PROGRAM_SELECT = `
  id, client_id, name, description, goal, level, frequency, weeks, muscle_tags,
  equipment_archetype, session_mode, volume_focus, status, is_client_visible, created_at,
  program_sessions (
    id, name, day_of_week, days_of_week, position, notes,
    program_exercises (
      id, name, sets, reps, rest_sec, rir, notes, position, image_url,
      movement_pattern, equipment_required, primary_muscles, secondary_muscles,
      group_id, is_compound, is_unilateral, target_rir, weight_increment_kg, tempo, set_prescriptions, superset_rest_mode,
      plane, mechanic, unilateral, primary_muscle, primary_activation,
      secondary_muscles_detail, secondary_activations, stabilizers,
      joint_stress_spine, joint_stress_knee, joint_stress_shoulder,
      global_instability, coordination_demand, constraint_profile
    )
  )
`

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()

  const { data: source, error: sourceError } = await db
    .from('programs')
    .select(PROGRAM_SELECT)
    .eq('id', params.programId)
    .eq('coach_id', user.id)
    .single()

  if (sourceError || !source) {
    return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })
  }

  const computedFrequency = resolveStoredFrequency((source.program_sessions as any[]) ?? [], source.frequency ?? null)

  const { data: createdProgram, error: createError } = await db
    .from('programs')
    .insert({
      coach_id: user.id,
      client_id: source.client_id,
      name: `${source.name} (copie)`,
      description: source.description,
      goal: source.goal,
      level: source.level,
      frequency: computedFrequency || source.frequency || null,
      weeks: source.weeks,
      muscle_tags: source.muscle_tags ?? [],
      equipment_archetype: source.equipment_archetype ?? null,
      session_mode: source.session_mode ?? 'day',
      volume_focus: source.volume_focus ?? {},
      status: source.status ?? 'active',
      is_client_visible: false,
    })
    .select('id')
    .single()

  if (createError || !createdProgram) {
    return NextResponse.json({ error: createError?.message ?? 'Duplication impossible' }, { status: 500 })
  }

  const sessions = ((source.program_sessions as any[]) ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  for (const session of sessions) {
    const { data: createdSession, error: sessionError } = await db
      .from('program_sessions')
      .insert({
        program_id: createdProgram.id,
        name: session.name,
        days_of_week: session.days_of_week ?? [],
        day_of_week: (session.days_of_week ?? [])[0] ?? session.day_of_week ?? null,
        position: session.position ?? 0,
        notes: session.notes ?? null,
      })
      .select('id')
      .single()

    if (sessionError || !createdSession) {
      await db.from('programs').delete().eq('id', createdProgram.id)
      return NextResponse.json(
        { error: `Erreur lors de la duplication de la séance "${session.name}"` },
        { status: 500 }
      )
    }

    const exercises = ((session.program_exercises as any[]) ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    if (exercises.length === 0) continue

    const { error: exercisesError } = await db
      .from('program_exercises')
      .insert(
        exercises.map((exercise, index) => ({
          session_id: createdSession.id,
          name: exercise.name,
          sets: exercise.sets ?? 3,
          reps: exercise.reps ?? '8-12',
          rest_sec: exercise.rest_sec ?? null,
          rir: exercise.rir ?? null,
          notes: exercise.notes ?? null,
          position: index,
          image_url: exercise.image_url ?? null,
          movement_pattern: exercise.movement_pattern ?? null,
          equipment_required: exercise.equipment_required ?? [],
          primary_muscles: exercise.primary_muscles ?? [],
          secondary_muscles: exercise.secondary_muscles ?? [],
          group_id: exercise.group_id ?? null,
          is_compound: exercise.is_compound ?? null,
          is_unilateral: exercise.is_unilateral ?? false,
          target_rir: exercise.target_rir ?? null,
          weight_increment_kg: exercise.weight_increment_kg ?? 2.5,
          tempo: exercise.tempo ?? null,
          set_prescriptions: exercise.set_prescriptions ?? null,
          superset_rest_mode: exercise.superset_rest_mode ?? 'after_round',
          plane: exercise.plane ?? null,
          mechanic: exercise.mechanic ?? null,
          unilateral: exercise.unilateral ?? false,
          primary_muscle: exercise.primary_muscle ?? null,
          primary_activation: exercise.primary_activation != null ? Number(exercise.primary_activation) : null,
          secondary_muscles_detail: exercise.secondary_muscles_detail ?? [],
          secondary_activations: (exercise.secondary_activations ?? []).map(Number),
          stabilizers: exercise.stabilizers ?? [],
          joint_stress_spine: exercise.joint_stress_spine != null ? Number(exercise.joint_stress_spine) : null,
          joint_stress_knee: exercise.joint_stress_knee != null ? Number(exercise.joint_stress_knee) : null,
          joint_stress_shoulder: exercise.joint_stress_shoulder != null ? Number(exercise.joint_stress_shoulder) : null,
          global_instability: exercise.global_instability != null ? Number(exercise.global_instability) : null,
          coordination_demand: exercise.coordination_demand != null ? Number(exercise.coordination_demand) : null,
          constraint_profile: exercise.constraint_profile ?? null,
        }))
      )

    if (exercisesError) {
      await db.from('programs').delete().eq('id', createdProgram.id)
      return NextResponse.json(
        { error: `Erreur lors de la duplication des exercices de "${session.name}"` },
        { status: 500 }
      )
    }
  }

  const { data: duplicatedProgram, error: duplicatedProgramError } = await db
    .from('programs')
    .select(PROGRAM_SELECT)
    .eq('id', createdProgram.id)
    .eq('coach_id', user.id)
    .single()

  if (duplicatedProgramError || !duplicatedProgram) {
    return NextResponse.json({ error: duplicatedProgramError?.message ?? 'Duplication impossible' }, { status: 500 })
  }

  return NextResponse.json({ program: duplicatedProgram }, { status: 201 })
}
