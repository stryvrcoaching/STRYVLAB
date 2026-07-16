import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  MESOCYCLE_ENGINE_VERSION,
  applyMesocycleExercisePatch,
  buildMesocyclePreview,
  type MesocycleConfig,
  type MesocycleSourceWeek,
} from '@/lib/programs/mesocycle'
import {
  buildDuplicatedExerciseInsert,
  buildDuplicatedSessionInsert,
  type ProgramWeekRecord,
} from '@/lib/programs/programWeeks'

const configSchema = z.object({
  version: z.literal(MESOCYCLE_ENGINE_VERSION),
  sourceWeekIds: z.array(z.string().uuid()).min(1).max(12),
  outputWeekCount: z.number().int().min(2).max(12),
  volume: z.object({
    mode: z.enum(['stable', 'linear']),
    startPercent: z.number().int().min(50).max(150),
    endPercent: z.number().int().min(50).max(150),
  }),
  rir: z.object({
    mode: z.enum(['stable', 'linear']),
    start: z.number().min(0).max(5),
    end: z.number().min(0).max(5),
  }),
  deload: z.object({
    enabled: z.boolean(),
    volumePercent: z.number().int().min(40).max(100),
    rir: z.number().min(0).max(5),
  }),
  safety: z.object({
    minSetsPerExercise: z.number().int().min(1).max(5),
    maxSetsPerExercise: z.number().int().min(1).max(12),
  }),
  completionBehavior: z.enum(['repeat', 'hold_last', 'stop']),
})

const requestSchema = z.object({
  action: z.enum(['preview', 'apply']),
  config: configSchema,
})

type Params = { params: { programId: string } }

type StoredWeek = ProgramWeekRecord & {
  program_sessions?: Array<Record<string, unknown> & {
    id: string
    position?: number | null
    program_exercises?: Array<Record<string, unknown> & {
      position?: number | null
      sets?: number | null
      execution_type?: string | null
    }>
  }>
}

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function loadWeeksWithContent(db: SupabaseClient, programId: string) {
  return db
    .from('program_weeks')
    .select('id, program_id, position, label, week_type, source_week_id, program_sessions(*, program_exercises(*))')
    .eq('program_id', programId)
    .order('position', { ascending: true })
}

function sourceSummary(week: StoredWeek): MesocycleSourceWeek {
  const sessions = week.program_sessions ?? []
  const exercises = sessions.flatMap((session) => session.program_exercises ?? [])
  return {
    id: week.id,
    label: week.label,
    sessionCount: sessions.length,
    exerciseCount: exercises.length,
    totalSets: exercises.reduce((total, exercise) => (
      (exercise.execution_type ?? 'reps_rir') === 'reps_rir'
        ? total + Number(exercise.sets ?? 0)
        : total
    ), 0),
  }
}

function sortStoredWeek(week: StoredWeek): StoredWeek {
  return {
    ...week,
    program_sessions: (week.program_sessions ?? [])
      .slice()
      .sort((first, second) => Number(first.position ?? 0) - Number(second.position ?? 0))
      .map((session) => ({
        ...session,
        program_exercises: (session.program_exercises ?? [])
          .slice()
          .sort((first, second) => Number(first.position ?? 0) - Number(second.position ?? 0)),
      })),
  }
}

async function cleanupGeneratedWeeks(db: SupabaseClient, weekIds: string[]) {
  if (weekIds.length === 0) return
  await db.from('program_weeks').delete().in('id', weekIds)
}

async function stageMesocycle(
  db: SupabaseClient,
  programId: string,
  existingWeeks: StoredWeek[],
  sourceWeeks: StoredWeek[],
  config: MesocycleConfig,
) {
  const preview = buildMesocyclePreview(config, sourceWeeks.map(sourceSummary))
  const maximumPosition = Math.max(...existingWeeks.map((week) => week.position), -1)
  if (maximumPosition + preview.outputWeekCount >= 52) {
    throw new Error('Le cycle actuel est trop long pour préparer ce mésocycle en sécurité')
  }

  const sourceById = new Map(sourceWeeks.map((week) => [week.id, sortStoredWeek(week)]))
  const createdWeekIds: string[] = []

  try {
    for (const weekPlan of preview.weeks) {
      const source = sourceById.get(weekPlan.sourceWeekId)
      if (!source) throw new Error('Une semaine source est introuvable')

      const { data: createdWeek, error: weekError } = await db
        .from('program_weeks')
        .insert({
          program_id: programId,
          position: maximumPosition + weekPlan.position + 1,
          label: weekPlan.label,
          week_type: weekPlan.weekType,
          source_week_id: source.id,
        })
        .select('id')
        .single()
      if (weekError || !createdWeek) {
        throw new Error(weekError?.message ?? 'Impossible de créer une semaine générée')
      }
      createdWeekIds.push(createdWeek.id)

      for (const sourceSession of source.program_sessions ?? []) {
        const sessionInsert = buildDuplicatedSessionInsert(
          sourceSession,
          programId,
          createdWeek.id,
        )
        const { data: createdSession, error: sessionError } = await db
          .from('program_sessions')
          .insert(sessionInsert)
          .select('id')
          .single()
        if (sessionError || !createdSession) {
          throw new Error(sessionError?.message ?? 'Impossible de générer une séance')
        }

        const exerciseInserts = (sourceSession.program_exercises ?? []).map((exercise) =>
          applyMesocycleExercisePatch(
            buildDuplicatedExerciseInsert(exercise, createdSession.id),
            weekPlan,
            config.safety,
          ),
        )
        if (exerciseInserts.length > 0) {
          const exerciseResult = await db.from('program_exercises').insert(exerciseInserts)
          if (exerciseResult.error) throw new Error(exerciseResult.error.message)
        }
      }
    }

    return { preview, createdWeekIds }
  } catch (error) {
    await cleanupGeneratedWeeks(db, createdWeekIds)
    throw error
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Configuration de mésocycle invalide' }, { status: 400 })
  }

  const config = parsed.data.config as MesocycleConfig
  if (new Set(config.sourceWeekIds).size !== config.sourceWeekIds.length) {
    return NextResponse.json({ error: 'Une semaine source est sélectionnée plusieurs fois' }, { status: 400 })
  }
  if (config.safety.minSetsPerExercise > config.safety.maxSetsPerExercise) {
    return NextResponse.json({ error: 'Les limites de séries sont incohérentes' }, { status: 400 })
  }

  const db = service()
  const { data: program } = await db
    .from('programs')
    .select('id')
    .eq('id', params.programId)
    .eq('coach_id', user.id)
    .maybeSingle()
  if (!program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })

  const weeksResult = await loadWeeksWithContent(db, params.programId)
  if (weeksResult.error) {
    return NextResponse.json({ error: weeksResult.error.message }, { status: 500 })
  }
  const existingWeeks = (weeksResult.data ?? []) as StoredWeek[]
  if (existingWeeks.length === 0) {
    return NextResponse.json({ error: 'Activez d’abord le mode Cycle' }, { status: 409 })
  }

  const weekById = new Map(existingWeeks.map((week) => [week.id, week]))
  const sourceWeeks = config.sourceWeekIds
    .map((weekId) => weekById.get(weekId))
    .filter((week): week is StoredWeek => Boolean(week))
  if (sourceWeeks.length !== config.sourceWeekIds.length) {
    return NextResponse.json({ error: 'Une semaine source ne fait pas partie de ce programme' }, { status: 409 })
  }

  let preview
  try {
    preview = buildMesocyclePreview(config, sourceWeeks.map(sourceSummary))
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Impossible de préparer le mésocycle',
    }, { status: 400 })
  }

  if (parsed.data.action === 'preview') {
    return NextResponse.json({ preview })
  }

  let stagedWeekIds: string[] = []
  try {
    const staged = await stageMesocycle(
      db,
      params.programId,
      existingWeeks,
      sourceWeeks,
      config,
    )
    stagedWeekIds = staged.createdWeekIds
    const { error: finalizeError } = await db.rpc('finalize_program_mesocycle_swap', {
      p_program_id: params.programId,
      p_existing_week_ids: existingWeeks.map((week) => week.id),
      p_generated_week_ids: stagedWeekIds,
      p_duration_weeks: config.outputWeekCount,
      p_completion_behavior: config.completionBehavior,
    })
    if (finalizeError) throw new Error(finalizeError.message)

    return NextResponse.json({
      preview: staged.preview,
      weeks: staged.preview.weeks.map((week, index) => ({
        id: stagedWeekIds[index],
        program_id: params.programId,
        position: week.position,
        label: week.label,
        week_type: week.weekType,
        source_week_id: null,
      })),
      completion_behavior: config.completionBehavior,
    })
  } catch (error) {
    await cleanupGeneratedWeeks(db, stagedWeekIds)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Impossible d’appliquer le mésocycle',
    }, { status: 500 })
  }
}
