
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { upsertClientSetLogs } from '@/lib/training/upsertClientSetLogs'
import {
  filterSessionsByStatus,
  isMeaningfulSession,
  type SessionStatusFilter,
} from '@/lib/training/sessionLogUtils'

const setLogSchema = z.object({
  exercise_id: z.string().uuid().nullable().optional(),
  exercise_name: z.string().min(1),
  set_number: z.number().int().positive(),
  side: z.enum(['left', 'right', 'bilateral']).optional().default('bilateral'),
  planned_reps: z.union([z.string(), z.number()]).nullable().optional(),
  actual_reps: z.number().int().nonnegative().nullable().optional(),
  actual_weight_kg: z.number().nonnegative().nullable().optional(),
  completed: z.boolean().optional().default(false),
  rpe: z.number().min(0).max(10).nullable().optional(),
  rir_actual: z.number().int().min(0).max(10).nullable().optional(),
  notes: z.string().nullable().optional(),
  rest_sec_actual: z.number().int().nonnegative().nullable().optional(),
  primary_muscles: z.array(z.string()).optional().default([]),
  secondary_muscles: z.array(z.string()).optional().default([]),
})

const postBodySchema = z.object({
  session_name: z.string().min(1),
  program_session_id: z.string().uuid().nullable().optional(),
  exercise_notes: z.record(z.string(), z.string()).optional(),
  set_logs: z.array(setLogSchema).optional(),
})

const deleteBodySchema = z.object({
  client_id: z.string().uuid(),
  session_log_ids: z.array(z.string().uuid()).min(1).max(200),
})

const SESSION_STATUS_FILTERS = new Set<SessionStatusFilter>(['all', 'completed', 'incomplete'])

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST /api/session-logs — démarrer une séance
export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Résoudre client_id depuis user_id
  const { data: client } = await service()
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!client) return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })

  const raw = await req.json()
  const parsed = postBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }
  const { program_session_id, session_name, set_logs, exercise_notes } = parsed.data

  const db = service()

  // Vérifier que program_session_id existe encore (évite la FK constraint violation)
  let resolvedSessionId: string | null = program_session_id ?? null
  let workoutAssignmentId: string | null = null
  let programWeekId: string | null = null
  let programWeekPosition: number | null = null
  let prescriptionSnapshot: Record<string, unknown> | null = null
  if (resolvedSessionId) {
    const { data: sessionContext } = await db
      .from('program_sessions')
      .select('*, program_exercises(*)')
      .eq('id', resolvedSessionId)
      .maybeSingle()
    if (!sessionContext) {
      resolvedSessionId = null
    } else if ((sessionContext as any).program_id) {
      const { data: ownedProgram } = await db
        .from('programs')
        .select('id')
        .eq('id', (sessionContext as any).program_id)
        .eq('client_id', client.id)
        .maybeSingle()

      if (!ownedProgram) {
        return NextResponse.json({ error: 'Cette séance ne correspond pas au programme du client' }, { status: 403 })
      }

      const { data: assignment } = await db
        .from('client_workout_program_assignments')
        .select('id')
        .eq('client_id', client.id)
        .eq('program_id', ownedProgram.id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      workoutAssignmentId = assignment?.id ?? null
      programWeekId = (sessionContext as any).program_week_id ?? null
      if (programWeekId) {
        const { data: week } = await db
          .from('program_weeks')
          .select('position')
          .eq('id', programWeekId)
          .eq('program_id', ownedProgram.id)
          .maybeSingle()
        programWeekPosition = week?.position ?? null
      }

      const exercises = Array.isArray((sessionContext as any).program_exercises)
        ? [...(sessionContext as any).program_exercises].sort(
          (first: any, second: any) => Number(first.position ?? 0) - Number(second.position ?? 0),
        )
        : []
      prescriptionSnapshot = {
        schema_version: 1,
        captured_at: new Date().toISOString(),
        program_id: ownedProgram.id,
        session: {
          ...(sessionContext as Record<string, unknown>),
          program_exercises: exercises,
        },
      }
    }
  }

  // Idempotent — retourner le draft existant si un log incomplet existe déjà pour cette séance
  // Évite les double-logs (React Strict Mode double mount, multiple devices, network retry)
  if (resolvedSessionId) {
    const { data: existingLog } = await db
      .from('client_session_logs')
      .select('id')
      .eq('client_id', client.id)
      .eq('program_session_id', resolvedSessionId)
      .is('completed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingLog) {
      if (Array.isArray(set_logs) && set_logs.length > 0) {
        const rows = set_logs.map((s: z.infer<typeof setLogSchema>) => ({
          session_log_id: existingLog.id,
          exercise_id: s.exercise_id ?? null,
          exercise_name: s.exercise_name,
          set_number: s.set_number,
          planned_reps: s.planned_reps ?? null,
          actual_reps: s.actual_reps ?? null,
          actual_weight_kg: s.actual_weight_kg ?? null,
          completed: s.completed ?? false,
          rpe: s.rpe ?? null,
          rir_actual: s.rir_actual ?? null,
          side: s.side ?? 'bilateral',
          notes: s.notes ?? null,
          rest_sec_actual: s.rest_sec_actual ?? null,
          primary_muscles: s.primary_muscles ?? [],
          secondary_muscles: s.secondary_muscles ?? [],
        }))
        const { error: setsError } = await upsertClientSetLogs(db, existingLog.id, rows)
        if (setsError) {
          console.error('[session-logs POST] existing draft set upsert error', {
            logId: existingLog.id,
            code: setsError.code,
            message: setsError.message,
          })
        }
      }
      return NextResponse.json({ session_log: existingLog }, { status: 200 })
    }
  }

  // Créer le session log — avec double fallback sur program_session_id
  let sessionLog: { id: string } | null = null
  let slError: { message: string } | null = null

  const firstTry = await db
    .from('client_session_logs')
    .insert({
      client_id: client.id,
      program_session_id: resolvedSessionId,
      workout_assignment_id: workoutAssignmentId,
      program_week_id: programWeekId,
      program_week_position: programWeekPosition,
      prescription_snapshot: prescriptionSnapshot,
      session_name,
      exercise_notes: exercise_notes ?? {},
    })
    .select()
    .single()

  if (firstTry.error && resolvedSessionId !== null) {
    // La FK a échoué malgré la vérification (race condition ou session supprimée entre-temps)
    // On retente sans program_session_id
    const secondTry = await db
      .from('client_session_logs')
      .insert({
        client_id: client.id,
        program_session_id: null,
        workout_assignment_id: workoutAssignmentId,
        program_week_id: programWeekId,
        program_week_position: programWeekPosition,
        prescription_snapshot: prescriptionSnapshot,
        session_name,
        exercise_notes: exercise_notes ?? {},
      })
      .select()
      .single()
    sessionLog = secondTry.data
    slError = secondTry.error
  } else {
    sessionLog = firstTry.data
    slError = firstTry.error
  }

  if (slError || !sessionLog) return NextResponse.json({ error: slError?.message }, { status: 500 })

  // Insérer les set logs si fournis
  if (Array.isArray(set_logs) && set_logs.length > 0) {
    const rows = set_logs.map((s: z.infer<typeof setLogSchema>) => ({
      session_log_id: sessionLog.id,
      exercise_id: s.exercise_id ?? null,
      exercise_name: s.exercise_name,
      set_number: s.set_number,
      planned_reps: s.planned_reps ?? null,
      actual_reps: s.actual_reps ?? null,
      actual_weight_kg: s.actual_weight_kg ?? null,
      completed: s.completed ?? false,
      rpe: s.rpe ?? null,
      rir_actual: s.rir_actual ?? null,
      side: s.side ?? 'bilateral',
      notes: s.notes ?? null,
      rest_sec_actual: s.rest_sec_actual ?? null,
      primary_muscles: s.primary_muscles ?? [],
      secondary_muscles: s.secondary_muscles ?? [],
    }))
    const { error: setsError } = await upsertClientSetLogs(db, sessionLog.id, rows)
    if (setsError) {
      console.error('[session-logs POST] set insert error', { code: setsError.code, message: setsError.message })
    }
  }

  return NextResponse.json({ session_log: sessionLog }, { status: 201 })
}

async function assertCoachOwnsClient(coachUserId: string, clientId: string) {
  const { data: client } = await service()
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', coachUserId)
    .single()
  return client
}

// GET /api/session-logs?client_id=xxx — historique (pour le coach)
// ?scope=manage → toutes les séances (limite 500), filtre status optionnel
// défaut → séances « significatives » uniquement (compat dashboard KPI)
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const clientId = req.nextUrl.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id requis' }, { status: 400 })

  const client = await assertCoachOwnsClient(user.id, clientId)
  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const scope = req.nextUrl.searchParams.get('scope')
  const statusParam = req.nextUrl.searchParams.get('status') as SessionStatusFilter | null
  const status: SessionStatusFilter =
    statusParam && SESSION_STATUS_FILTERS.has(statusParam) ? statusParam : 'all'
  const forManage = scope === 'manage'

  const { data, error } = await service()
    .from('client_session_logs')
    .select(`
      id, session_name, logged_at, completed_at, duration_min, notes, created_at,
      session_kind, flex_session_id, relation_to_planned_workout,
      client_set_logs (
        id, exercise_name, set_number, planned_reps, actual_reps, actual_weight_kg, completed, rpe, notes
      )
    `)
    .eq('client_id', clientId)
    .order('logged_at', { ascending: false })
    .limit(forManage ? 500 : 50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let logs = data ?? []
  if (!forManage) {
    logs = logs.filter(isMeaningfulSession)
  } else if (status !== 'all') {
    logs = filterSessionsByStatus(logs, status)
  }

  return NextResponse.json({ logs })
}

// DELETE /api/session-logs — suppression en masse (coach)
export async function DELETE(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const raw = await req.json()
  const parsed = deleteBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 })
  }

  const { client_id: clientId, session_log_ids: sessionLogIds } = parsed.data
  const client = await assertCoachOwnsClient(user.id, clientId)
  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const db = service()

  const { data: ownedLogs, error: fetchError } = await db
    .from('client_session_logs')
    .select('id')
    .eq('client_id', clientId)
    .in('id', sessionLogIds)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const ownedIds = (ownedLogs ?? []).map((r) => r.id)
  if (ownedIds.length === 0) {
    return NextResponse.json({ error: 'Aucune séance à supprimer' }, { status: 404 })
  }

  await db.from('client_points').delete().eq('client_id', clientId).in('reference_id', ownedIds)
  await db.from('smart_agenda_events').delete().eq('client_id', clientId).in('source_id', ownedIds)

  const { error: deleteError } = await db
    .from('client_session_logs')
    .delete()
    .eq('client_id', clientId)
    .in('id', ownedIds)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: ownedIds.length, ids: ownedIds })
}
