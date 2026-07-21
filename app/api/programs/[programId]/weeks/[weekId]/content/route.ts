import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const exerciseSchema = z.object({
  dbId: z.string().uuid().optional(),
  name: z.string(),
  sets: z.number().int().min(0).max(100),
  reps: z.string(),
  rest_sec: z.number().int().min(0).nullable(),
  rir: z.number().min(0).max(10).nullable(),
  weight_increment_kg: z.number().nullable(),
  current_weight_kg: z.number().nullable().optional(),
  target_rir: z.number().min(0).max(10).nullable(),
  target_hr_zone: z.string().nullable(),
  notes: z.string(),
  image_url: z.string().nullable(),
  movement_pattern: z.string().nullable(),
  equipment_required: z.array(z.string()),
  primary_muscles: z.array(z.string()),
  secondary_muscles: z.array(z.string()),
  is_compound: z.boolean().optional(),
  is_unilateral: z.boolean(),
  tempo: z.string().nullable(),
  set_prescriptions: z.array(z.unknown()),
  superset_rest_mode: z.enum(['after_round', 'after_exercise']).nullable(),
  group_id: z.string().nullable().optional(),
  execution_type: z.enum(['reps_rir', 'time_rpe', 'distance_rpe']),
  plane: z.string().nullable(),
  mechanic: z.string().nullable(),
  unilateral: z.boolean(),
  primary_muscle: z.string().nullable(),
  primary_activation: z.number().nullable(),
  secondary_muscles_detail: z.array(z.string()),
  secondary_activations: z.array(z.number()),
  stabilizers: z.array(z.string()),
  joint_stress_spine: z.number().nullable(),
  joint_stress_knee: z.number().nullable(),
  joint_stress_shoulder: z.number().nullable(),
  global_instability: z.number().nullable(),
  coordination_demand: z.number().nullable(),
  constraint_profile: z.string().nullable(),
})

const sessionSchema = z.object({
  dbId: z.string().uuid().optional(),
  name: z.string(),
  day_of_week: z.number().int().min(1).max(7).nullable(),
  days_of_week: z.array(z.number().int().min(1).max(7)),
  notes: z.string(),
  exercises: z.array(exerciseSchema).max(100),
})

const contentSchema = z.object({
  sessions: z.array(sessionSchema).max(30),
})

type Params = { params: { programId: string; weekId: string } }
type ExerciseInput = z.infer<typeof exerciseSchema>

const CONTENT_SELECT = `
  id, program_week_id, name, day_of_week, days_of_week, position, notes,
  program_exercises (
    id, name, sets, reps, rest_sec, rir, notes, position, image_url,
    movement_pattern, equipment_required, primary_muscles, secondary_muscles,
    group_id, is_compound, is_unilateral, target_rir, target_hr_zone, execution_type,
    weight_increment_kg, current_weight_kg, tempo, set_prescriptions, superset_rest_mode,
    plane, mechanic, unilateral, primary_muscle, primary_activation,
    secondary_muscles_detail, secondary_activations, stabilizers,
    joint_stress_spine, joint_stress_knee, joint_stress_shoulder,
    global_instability, coordination_demand, constraint_profile
  )
`

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function authorizeWeek(programId: string, weekId: string) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Non authentifié', status: 401 } as const

  const db = service()
  const { data: week } = await db
    .from('program_weeks')
    .select('id, program_id')
    .eq('id', weekId)
    .eq('program_id', programId)
    .maybeSingle()

  if (!week) return { error: 'Semaine introuvable', status: 404 } as const

  const { data: program } = await db
    .from('programs')
    .select('id')
    .eq('id', programId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!program) return { error: 'Programme introuvable', status: 404 } as const
  return { db } as const
}

async function loadWeekContent(db: SupabaseClient, programId: string, weekId: string) {
  return db
    .from('program_sessions')
    .select(CONTENT_SELECT)
    .eq('program_id', programId)
    .eq('program_week_id', weekId)
    .order('position', { ascending: true })
    .order('position', { ascending: true, referencedTable: 'program_exercises' })
}

function exercisePatch(exercise: ExerciseInput, sessionId: string, position: number) {
  return {
    session_id: sessionId,
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    rest_sec: exercise.rest_sec,
    rir: exercise.rir,
    notes: exercise.notes || null,
    position,
    image_url: exercise.image_url,
    movement_pattern: exercise.movement_pattern,
    equipment_required: exercise.equipment_required,
    primary_muscles: exercise.primary_muscles,
    secondary_muscles: exercise.secondary_muscles,
    group_id: exercise.group_id ?? null,
    is_compound: exercise.is_compound ?? null,
    is_unilateral: exercise.is_unilateral,
    target_rir: exercise.target_rir,
    target_hr_zone: exercise.target_hr_zone,
    weight_increment_kg: exercise.weight_increment_kg,
    current_weight_kg: exercise.current_weight_kg ?? null,
    tempo: exercise.tempo,
    set_prescriptions: exercise.set_prescriptions,
    superset_rest_mode: exercise.superset_rest_mode ?? 'after_round',
    execution_type: exercise.execution_type,
    plane: exercise.plane,
    mechanic: exercise.mechanic,
    unilateral: exercise.unilateral,
    primary_muscle: exercise.primary_muscle,
    primary_activation: exercise.primary_activation,
    secondary_muscles_detail: exercise.secondary_muscles_detail,
    secondary_activations: exercise.secondary_activations,
    stabilizers: exercise.stabilizers,
    joint_stress_spine: exercise.joint_stress_spine,
    joint_stress_knee: exercise.joint_stress_knee,
    joint_stress_shoulder: exercise.joint_stress_shoulder,
    global_instability: exercise.global_instability,
    coordination_demand: exercise.coordination_demand,
    constraint_profile: exercise.constraint_profile,
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  const authorization = await authorizeWeek(params.programId, params.weekId)
  if ('error' in authorization) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status })
  }

  const result = await loadWeekContent(authorization.db, params.programId, params.weekId)
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ sessions: result.data ?? [] })
}

export async function PUT(request: NextRequest, { params }: Params) {
  const authorization = await authorizeWeek(params.programId, params.weekId)
  if ('error' in authorization) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status })
  }

  const parsed = contentSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Contenu de semaine invalide' }, { status: 400 })
  }

  const { db } = authorization
  const existingResult = await loadWeekContent(db, params.programId, params.weekId)
  if (existingResult.error) return NextResponse.json({ error: existingResult.error.message }, { status: 500 })

  const existingSessions = existingResult.data ?? []
  const existingSessionIds = new Set(existingSessions.map((session) => session.id))
  const existingExerciseIds = new Set(
    existingSessions.flatMap((session) =>
      (session.program_exercises ?? []).map((exercise) => exercise.id),
    ),
  )
  const requestedSessionIds = parsed.data.sessions
    .map((session) => session.dbId)
    .filter((id): id is string => Boolean(id))
  const requestedExerciseIds = parsed.data.sessions
    .flatMap((session) => session.exercises.map((exercise) => exercise.dbId))
    .filter((id): id is string => Boolean(id))

  if (
    new Set(requestedSessionIds).size !== requestedSessionIds.length ||
    requestedSessionIds.some((id) => !existingSessionIds.has(id))
  ) {
    return NextResponse.json({ error: 'Une séance ne correspond pas à cette semaine' }, { status: 409 })
  }
  if (
    new Set(requestedExerciseIds).size !== requestedExerciseIds.length ||
    requestedExerciseIds.some((id) => !existingExerciseIds.has(id))
  ) {
    return NextResponse.json({ error: 'Un exercice ne correspond pas à cette semaine' }, { status: 409 })
  }

  const retainedSessionIds = new Set<string>()
  const retainedExerciseIds = new Set<string>()

  try {
    for (let sessionPosition = 0; sessionPosition < parsed.data.sessions.length; sessionPosition += 1) {
      const sessionInput = parsed.data.sessions[sessionPosition]
      const sessionValues = {
        program_id: params.programId,
        program_week_id: params.weekId,
        name: sessionInput.name,
        days_of_week: sessionInput.days_of_week,
        day_of_week: sessionInput.days_of_week[0] ?? sessionInput.day_of_week,
        position: sessionPosition,
        notes: sessionInput.notes || null,
      }

      let sessionId: string
      if (sessionInput.dbId) {
        const { data, error } = await db
          .from('program_sessions')
          .update(sessionValues)
          .eq('id', sessionInput.dbId)
          .eq('program_id', params.programId)
          .eq('program_week_id', params.weekId)
          .select('id')
          .single()
        if (error || !data) throw new Error(error?.message ?? 'Impossible de mettre à jour une séance')
        sessionId = data.id
      } else {
        const { data, error } = await db
          .from('program_sessions')
          .insert(sessionValues)
          .select('id')
          .single()
        if (error || !data) throw new Error(error?.message ?? 'Impossible de créer une séance')
        sessionId = data.id
      }
      retainedSessionIds.add(sessionId)

      for (let exercisePosition = 0; exercisePosition < sessionInput.exercises.length; exercisePosition += 1) {
        const exerciseInput = sessionInput.exercises[exercisePosition]
        const values = exercisePatch(exerciseInput, sessionId, exercisePosition)
        let exerciseId: string

        if (exerciseInput.dbId) {
          const { data, error } = await db
            .from('program_exercises')
            .update(values)
            .eq('id', exerciseInput.dbId)
            .select('id')
            .single()
          if (error || !data) throw new Error(error?.message ?? 'Impossible de mettre à jour un exercice')
          exerciseId = data.id
        } else {
          const { data, error } = await db
            .from('program_exercises')
            .insert(values)
            .select('id')
            .single()
          if (error || !data) throw new Error(error?.message ?? 'Impossible de créer un exercice')
          exerciseId = data.id
        }
        retainedExerciseIds.add(exerciseId)
      }
    }

    const removedExerciseIds = Array.from(existingExerciseIds).filter(
      (id) => !retainedExerciseIds.has(id),
    )
    if (removedExerciseIds.length > 0) {
      const result = await db.from('program_exercises').delete().in('id', removedExerciseIds)
      if (result.error) throw new Error(result.error.message)
    }

    const removedSessionIds = Array.from(existingSessionIds).filter(
      (id) => !retainedSessionIds.has(id),
    )
    if (removedSessionIds.length > 0) {
      const result = await db
        .from('program_sessions')
        .delete()
        .eq('program_id', params.programId)
        .eq('program_week_id', params.weekId)
        .in('id', removedSessionIds)
      if (result.error) throw new Error(result.error.message)
    }

    const refreshed = await loadWeekContent(db, params.programId, params.weekId)
    if (refreshed.error) throw new Error(refreshed.error.message)
    return NextResponse.json({ sessions: refreshed.data ?? [] })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Impossible d’enregistrer cette semaine',
    }, { status: 500 })
  }
}
