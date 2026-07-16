import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  buildDuplicatedExerciseInsert,
  buildDuplicatedSessionInsert,
  nextProgramWeekPosition,
  type ProgramWeekRecord,
} from '@/lib/programs/programWeeks'

const requestSchema = z.object({
  action: z.enum(['initialize', 'add_empty', 'duplicate']),
  source_week_id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(80).optional(),
})

const completionSchema = z.object({
  completion_behavior: z.enum(['repeat', 'hold_last', 'stop']),
})

const deleteSchema = z.object({
  week_id: z.string().uuid(),
})

type Params = { params: { programId: string } }

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function isMissingCycleSchemaError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = String(error?.message ?? '').toLowerCase()
  return (
    error?.code === '42P01' ||
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    error?.code === 'PGRST205' ||
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('schema cache')
  )
}

async function loadWeeks(db: SupabaseClient, programId: string) {
  return db
    .from('program_weeks')
    .select('id, program_id, position, label, week_type, source_week_id')
    .eq('program_id', programId)
    .order('position', { ascending: true })
}

async function initializeLegacyWeek(db: SupabaseClient, programId: string) {
  const existing = await loadWeeks(db, programId)
  if (existing.error) throw new Error(existing.error.message)
  if ((existing.data ?? []).length > 0) {
    const firstWeek = existing.data![0] as ProgramWeekRecord
    const attachResult = await db
      .from('program_sessions')
      .update({ program_week_id: firstWeek.id })
      .eq('program_id', programId)
      .is('program_week_id', null)
    if (attachResult.error) throw new Error(attachResult.error.message)
    return firstWeek
  }

  const { data: week, error: weekError } = await db
    .from('program_weeks')
    .insert({
      program_id: programId,
      position: 0,
      label: 'Semaine 1',
      week_type: 'base',
    })
    .select('id, program_id, position, label, week_type, source_week_id')
    .single()

  if (weekError || !week) throw new Error(weekError?.message ?? 'Impossible de créer la semaine initiale')

  const attachResult = await db
    .from('program_sessions')
    .update({ program_week_id: week.id })
    .eq('program_id', programId)
    .is('program_week_id', null)

  if (attachResult.error) {
    await db.from('program_weeks').delete().eq('id', week.id)
    throw new Error(attachResult.error.message)
  }

  return week as ProgramWeekRecord
}

async function duplicateWeek(
  db: SupabaseClient,
  programId: string,
  sourceWeek: ProgramWeekRecord,
  position: number,
  label?: string,
) {
  const { data: createdWeek, error: weekError } = await db
    .from('program_weeks')
    .insert({
      program_id: programId,
      position,
      label: label ?? `Semaine ${position + 1}`,
      week_type: sourceWeek.week_type,
      source_week_id: sourceWeek.id,
    })
    .select('id, program_id, position, label, week_type, source_week_id')
    .single()

  if (weekError || !createdWeek) {
    throw new Error(weekError?.message ?? 'Impossible de créer la semaine dupliquée')
  }

  try {
    const { data: sourceSessions, error: sessionsError } = await db
      .from('program_sessions')
      .select('*, program_exercises(*)')
      .eq('program_id', programId)
      .eq('program_week_id', sourceWeek.id)
      .order('position', { ascending: true })

    if (sessionsError) throw new Error(sessionsError.message)

    for (const sourceSession of sourceSessions ?? []) {
      const sessionInsert = buildDuplicatedSessionInsert(
        sourceSession as Record<string, unknown>,
        programId,
        createdWeek.id,
      )
      const { data: createdSession, error: sessionError } = await db
        .from('program_sessions')
        .insert(sessionInsert)
        .select('id')
        .single()

      if (sessionError || !createdSession) {
        throw new Error(sessionError?.message ?? 'Impossible de dupliquer une séance')
      }

      const exercises = Array.isArray((sourceSession as any).program_exercises)
        ? (sourceSession as any).program_exercises
        : []
      if (exercises.length === 0) continue

      const exerciseInserts = exercises.map((exercise: Record<string, unknown>) =>
        buildDuplicatedExerciseInsert(exercise, createdSession.id),
      )
      const exerciseResult = await db.from('program_exercises').insert(exerciseInserts)
      if (exerciseResult.error) throw new Error(exerciseResult.error.message)
    }

    return createdWeek as ProgramWeekRecord
  } catch (error) {
    await db.from('program_weeks').delete().eq('id', createdWeek.id)
    throw error
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()
  const { data: program, error: programError } = await db
    .from('programs')
    .select('id')
    .eq('id', params.programId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (programError) return NextResponse.json({ error: programError.message }, { status: 500 })
  if (!program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })

  const completionResult = await db
    .from('programs')
    .select('completion_behavior')
    .eq('id', params.programId)
    .maybeSingle()
  const completionBehavior = completionResult.error
    ? 'repeat'
    : completionResult.data?.completion_behavior ?? 'repeat'

  const weeksResult = await loadWeeks(db, params.programId)
  if (weeksResult.error && isMissingCycleSchemaError(weeksResult.error)) {
    return NextResponse.json({
      weeks: [],
      completion_behavior: completionBehavior,
      is_legacy: true,
      cycle_available: false,
    })
  }
  if (weeksResult.error) return NextResponse.json({ error: weeksResult.error.message }, { status: 500 })

  return NextResponse.json({
    weeks: weeksResult.data ?? [],
    completion_behavior: completionBehavior,
    is_legacy: (weeksResult.data ?? []).length === 0,
    cycle_available: true,
  })
}

export async function POST(request: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Configuration de semaine invalide' }, { status: 400 })
  }

  const db = service()
  const { data: program } = await db
    .from('programs')
    .select('id')
    .eq('id', params.programId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })

  try {
    const availability = await loadWeeks(db, params.programId)
    if (availability.error && isMissingCycleSchemaError(availability.error)) {
      return NextResponse.json({
        error: 'Le mode cycle doit d’abord être activé sur la base de données',
        cycle_available: false,
      }, { status: 503 })
    }
    if (availability.error) throw new Error(availability.error.message)

    const initialWeek = await initializeLegacyWeek(db, params.programId)
    if (parsed.data.action === 'initialize') {
      const weeksResult = await loadWeeks(db, params.programId)
      return NextResponse.json({ weeks: weeksResult.data ?? [initialWeek] })
    }

    const weeksResult = await loadWeeks(db, params.programId)
    if (weeksResult.error) throw new Error(weeksResult.error.message)
    const weeks = (weeksResult.data ?? []) as ProgramWeekRecord[]
    const position = nextProgramWeekPosition(weeks)
    if (position >= 52) {
      return NextResponse.json({ error: 'Le programme ne peut pas dépasser 52 semaines explicites' }, { status: 400 })
    }

    let createdWeek: ProgramWeekRecord
    if (parsed.data.action === 'add_empty') {
      const { data, error } = await db
        .from('program_weeks')
        .insert({
          program_id: params.programId,
          position,
          label: parsed.data.label ?? `Semaine ${position + 1}`,
          week_type: 'base',
        })
        .select('id, program_id, position, label, week_type, source_week_id')
        .single()
      if (error || !data) throw new Error(error?.message ?? 'Impossible de créer la semaine')
      createdWeek = data as ProgramWeekRecord
    } else {
      const sourceWeek = parsed.data.source_week_id
        ? weeks.find((week) => week.id === parsed.data.source_week_id)
        : weeks.at(-1)
      if (!sourceWeek) {
        return NextResponse.json({ error: 'Semaine source introuvable' }, { status: 404 })
      }
      createdWeek = await duplicateWeek(
        db,
        params.programId,
        sourceWeek,
        position,
        parsed.data.label,
      )
    }

    const refreshed = await loadWeeks(db, params.programId)
    return NextResponse.json({ week: createdWeek, weeks: refreshed.data ?? [] }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de modifier les semaines'
    const status = message.includes('duplicate key') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const parsed = completionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Comportement de fin invalide' }, { status: 400 })
  }

  const db = service()
  const { data, error } = await db
    .from('programs')
    .update({ completion_behavior: parsed.data.completion_behavior })
    .eq('id', params.programId)
    .eq('coach_id', user.id)
    .select('id, completion_behavior')
    .maybeSingle()

  if (error && isMissingCycleSchemaError(error)) {
    return NextResponse.json({
      error: 'Le mode cycle doit d’abord être activé sur la base de données',
      cycle_available: false,
    }, { status: 503 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })
  return NextResponse.json({ completion_behavior: data.completion_behavior })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Semaine à supprimer invalide' }, { status: 400 })
  }

  const db = service()
  const { data: program, error: programError } = await db
    .from('programs')
    .select('id')
    .eq('id', params.programId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (programError) return NextResponse.json({ error: programError.message }, { status: 500 })
  if (!program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })

  const weeksResult = await loadWeeks(db, params.programId)
  if (weeksResult.error && isMissingCycleSchemaError(weeksResult.error)) {
    return NextResponse.json({
      error: 'Le mode cycle doit d’abord être activé sur la base de données',
      cycle_available: false,
    }, { status: 503 })
  }
  if (weeksResult.error) return NextResponse.json({ error: weeksResult.error.message }, { status: 500 })

  const weeks = (weeksResult.data ?? []) as ProgramWeekRecord[]
  const targetIndex = weeks.findIndex((week) => week.id === parsed.data.week_id)
  if (targetIndex < 0) {
    return NextResponse.json({ error: 'Semaine introuvable' }, { status: 404 })
  }
  if (weeks.length <= 1) {
    return NextResponse.json({ error: 'La dernière semaine du cycle ne peut pas être supprimée' }, { status: 400 })
  }

  const fallbackWeek = weeks[targetIndex - 1] ?? weeks[targetIndex + 1]
  const deletion = await db.rpc('delete_program_week_and_reorder', {
    p_program_id: params.programId,
    p_week_id: parsed.data.week_id,
  })
  if (deletion.error) {
    const status = deletion.error.message?.includes('dernière semaine') ? 400 : 500
    return NextResponse.json({ error: deletion.error.message }, { status })
  }

  const refreshed = await loadWeeks(db, params.programId)
  if (refreshed.error) return NextResponse.json({ error: refreshed.error.message }, { status: 500 })

  return NextResponse.json({
    weeks: refreshed.data ?? [],
    active_week_id: fallbackWeek?.id ?? refreshed.data?.[0]?.id ?? null,
  })
}
