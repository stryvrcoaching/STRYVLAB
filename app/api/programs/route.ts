import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'
import { estimateProgramAverageDurationMin } from '@/lib/training/sessionDuration'

type RawProgram = {
  id: string
  name: string
  description: string | null
  goal: string | null
  level: string | null
  frequency: number | null
  weeks: number
  muscle_tags: string[] | null
  equipment_archetype: string | null
  session_mode: string | null
  status: 'active' | 'archived'
  is_client_visible: boolean
  created_at: string
  program_sessions?: Array<{
    id: string
    name: string
    day_of_week: number | null
    days_of_week: number[] | null
    position: number | null
    notes: string | null
    program_exercises?: Array<{
      id: string
      name: string
      sets: number | null
      reps: string | null
      rest_sec: number | null
      rir: number | null
      notes: string | null
      position: number | null
    }>
  }>
}

type SessionLogRow = {
  id: string
  source_program_id: string | null
  program_session_id: string | null
  session_name: string
  logged_at: string
  completed_at: string | null
  duration_min: number | null
  client_set_logs?: Array<{
    actual_reps: number | null
    actual_weight_kg: number | null
    completed: boolean
  }>
}

type ProgressionEventRow = {
  session_log_id: string
  trigger_type: 'overload' | 'maintain'
}

type ProgramAssignmentRow = {
  program_id: string
  started_at: string
  ended_at: string | null
}

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function safePercentDelta(values: number[]): number | null {
  if (values.length < 2) return null
  if (values.length === 2) {
    const [first, second] = values
    if (first <= 0) return null
    return Math.round(((second - first) / first) * 100)
  }
  const pivot = Math.floor(values.length / 2)
  const first = values.slice(0, pivot)
  const second = values.slice(pivot)
  if (first.length === 0 || second.length === 0) return null
  const firstAvg = first.reduce((sum, value) => sum + value, 0) / first.length
  const secondAvg = second.reduce((sum, value) => sum + value, 0) / second.length
  if (firstAvg <= 0) return null
  return Math.round(((secondAvg - firstAvg) / firstAvg) * 100)
}

function deriveProgramAnalytics(program: RawProgram, sessionLogs: SessionLogRow[], progressionEvents: ProgressionEventRow[]) {
  const sessions = (program.program_sessions ?? []).slice()
  const exercises = sessions.flatMap((session) => session.program_exercises ?? [])
  const plannedSets = exercises.reduce((sum, exercise) => sum + Number(exercise.sets ?? 0), 0)
  const plannedExercises = exercises.length

  const completedLogs = sessionLogs
    .filter((log) => Boolean(log.completed_at))
    .sort((a, b) => new Date(a.completed_at as string).getTime() - new Date(b.completed_at as string).getTime())

  const recentCompleted = completedLogs.slice(-6)
  const recentVolumeTrend = recentCompleted.map((log) =>
    Math.round(
      (log.client_set_logs ?? []).reduce((sum, set) => {
        const reps = Number(set.actual_reps ?? 0)
        const weight = Number(set.actual_weight_kg ?? 0)
        const isDone = set.completed === true || reps > 0 || weight > 0
        return isDone ? sum + reps * weight : sum
      }, 0),
    ),
  )
  const recentRepsTrend = recentCompleted.map((log) =>
    (log.client_set_logs ?? []).reduce((sum, set) => {
      const reps = Number(set.actual_reps ?? 0)
      return reps > 0 ? sum + reps : sum
    }, 0),
  )

  const totalLoggedVolumeKg = completedLogs.reduce(
    (sum, log) =>
      sum +
      (log.client_set_logs ?? []).reduce((sessionSum, set) => {
        const reps = Number(set.actual_reps ?? 0)
        const weight = Number(set.actual_weight_kg ?? 0)
        const isDone = set.completed === true || reps > 0 || weight > 0
        return isDone ? sessionSum + reps * weight : sessionSum
      }, 0),
    0,
  )

  const durationValues = completedLogs
    .map((log) => log.duration_min)
    .filter((value): value is number => typeof value === 'number' && value > 0)

  return {
    planned_sessions: sessions.length,
    planned_exercises: plannedExercises,
    planned_sets: plannedSets,
    completed_sessions: completedLogs.length,
    avg_duration_min:
      durationValues.length > 0
        ? Math.round(durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length)
        : null,
    estimated_avg_duration_min: estimateProgramAverageDurationMin(sessions, program.goal ?? 'hypertrophy'),
    total_logged_volume_kg: Math.round(totalLoggedVolumeKg),
    overload_count: progressionEvents.filter((event) => event.trigger_type === 'overload').length,
    last_completed_at: completedLogs.at(-1)?.completed_at ?? null,
    recent_volume_trend: recentVolumeTrend,
    recent_reps_trend: recentRepsTrend,
    volume_delta_pct: safePercentDelta(recentVolumeTrend),
  }
}

function isLogInsideAssignment(
  log: SessionLogRow,
  assignments: ProgramAssignmentRow[],
  earliestStartedAt: string | null,
  programCreatedAt: string,
) {
  const anchor = log.completed_at ?? log.logged_at
  const timestamp = new Date(anchor).getTime()
  const programTime = new Date(programCreatedAt).getTime()

  // Enforce that logs must not pre-date the program's creation
  // We use a 24-hour grace period to account for timezone differences and quick starts
  if (timestamp < programTime - 24 * 60 * 60 * 1000) {
    return false
  }

  if (assignments.length === 0) return true

  if (earliestStartedAt) {
    const earliestTime = new Date(earliestStartedAt).getTime()
    if (timestamp < earliestTime) return true
  }

  return assignments.some((assignment) => {
    const startedAt = new Date(assignment.started_at).getTime()
    const endedAt = assignment.ended_at ? new Date(assignment.ended_at).getTime() : Number.POSITIVE_INFINITY
    return timestamp >= startedAt && timestamp <= endedAt
  })
}

function resolveLogProgramId(
  log: SessionLogRow,
  programsById: Map<string, RawProgram>,
  sessionIdToProgramId: Map<string, string>,
  sessionNameToProgramIds: Map<string, Set<string>>,
  assignmentsByProgram: Map<string, ProgramAssignmentRow[]>,
  earliestStartedAtByProgram: Map<string, string>,
) {
  if (log.source_program_id && programsById.has(log.source_program_id)) {
    return log.source_program_id
  }

  const programIdFromSession = log.program_session_id
    ? sessionIdToProgramId.get(log.program_session_id)
    : null
  if (programIdFromSession) return programIdFromSession

  const normalizedSessionName = normalizeLabel(log.session_name)
  const candidateIds = normalizedSessionName
    ? Array.from(sessionNameToProgramIds.get(normalizedSessionName) ?? [])
    : []
  const eligiblePrograms = candidateIds
    .map((programId) => programsById.get(programId))
    .filter((program): program is RawProgram => Boolean(program))
    .filter((program) =>
      isLogInsideAssignment(
        log,
        assignmentsByProgram.get(program.id) ?? [],
        earliestStartedAtByProgram.get(program.id) ?? null,
        program.created_at,
      ),
    )

  if (eligiblePrograms.length === 1) return eligiblePrograms[0].id

  const visiblePrograms = eligiblePrograms.filter((program) => program.is_client_visible)
  return visiblePrograms.length === 1 ? visiblePrograms[0].id : null
}

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function isMissingOptionalTableError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = String(error?.message ?? '').toLowerCase()
  return (
    error?.code === '42P01' ||
    message.includes('could not find the table') ||
    message.includes('does not exist')
  )
}

// GET /api/programs?client_id=xxx
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const clientId = req.nextUrl.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id requis' }, { status: 400 })

  const db = service()

  const { data, error } = await db
    .from('programs')
    .select(`
      id, name, description, goal, level, frequency, weeks, muscle_tags,
      equipment_archetype, session_mode, volume_focus, status, is_client_visible, created_at,
      program_sessions (
        id, name, day_of_week, days_of_week, position, notes,
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
      )
    `)
    .eq('client_id', clientId)
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const programs = (data ?? []) as RawProgram[]
  if (programs.length === 0) return NextResponse.json({ programs: [] })
  const programIds = programs.map((program) => program.id)
  const programsById = new Map(programs.map((program) => [program.id, program]))

  const programCreatedAtMap = new Map<string, string>()
  for (const program of programs) {
    programCreatedAtMap.set(program.id, program.created_at)
  }

  const { data: assignments } = programIds.length > 0
    ? await db
        .from('client_workout_program_assignments')
        .select('program_id, started_at, ended_at')
        .eq('client_id', clientId)
        .in('program_id', programIds)
        .order('started_at', { ascending: false })
    : { data: [] as any[] }

  const assignmentsByProgram = new Map<string, ProgramAssignmentRow[]>()
  const earliestStartedAtByProgram = new Map<string, string>()
  for (const assignment of (assignments ?? []) as any[]) {
    const programId = String(assignment.program_id)
    const startedAt = String(assignment.started_at)

    const list = assignmentsByProgram.get(programId) ?? []
    list.push({
      program_id: programId,
      started_at: startedAt,
      ended_at: assignment.ended_at ?? null,
    })
    assignmentsByProgram.set(programId, list)

    const existingEarliest = earliestStartedAtByProgram.get(programId)
    if (!existingEarliest || startedAt < existingEarliest) {
      earliestStartedAtByProgram.set(programId, startedAt)
    }
  }

  const sessionIdToProgramId = new Map<string, string>()
  const sessionNameToProgramIds = new Map<string, Set<string>>()
  const allProgramSessionIds: string[] = []
  for (const program of programs) {
    for (const session of program.program_sessions ?? []) {
      sessionIdToProgramId.set(session.id, program.id)
      allProgramSessionIds.push(session.id)
      const normalizedName = normalizeLabel(session.name)
      if (normalizedName) {
        const current = sessionNameToProgramIds.get(normalizedName) ?? new Set<string>()
        current.add(program.id)
        sessionNameToProgramIds.set(normalizedName, current)
      }
    }
  }

  const sessionLogsQuery = await db
    .from('client_session_logs')
    .select(`
      id, source_program_id, program_session_id, session_name, logged_at, completed_at, duration_min,
      client_set_logs(actual_reps, actual_weight_kg, completed)
    `)
    .eq('client_id', clientId)
    .order('logged_at', { ascending: true })

  if (sessionLogsQuery.error) return NextResponse.json({ error: sessionLogsQuery.error.message }, { status: 500 })

  const sessionLogs = (sessionLogsQuery.data ?? []) as SessionLogRow[]
  const logIds = sessionLogs.map((log) => log.id)

  const progressionEventsData = logIds.length > 0
    ? await db
        .from('progression_events')
        .select('session_log_id, trigger_type')
        .eq('client_id', clientId)
        .in('session_log_id', logIds)
    : { data: [], error: null }

  if (progressionEventsData.error && !isMissingOptionalTableError(progressionEventsData.error)) {
    return NextResponse.json({ error: progressionEventsData.error.message }, { status: 500 })
  }

  const sessionLogsByProgram = new Map<string, SessionLogRow[]>()
  const progressionByProgram = new Map<string, ProgressionEventRow[]>()
  const logIdToProgramId = new Map<string, string>()

  for (const log of sessionLogs) {
    const programId = resolveLogProgramId(
      log,
      programsById,
      sessionIdToProgramId,
      sessionNameToProgramIds,
      assignmentsByProgram,
      earliestStartedAtByProgram,
    )
    if (!programId) continue

    const programAssignments = assignmentsByProgram.get(programId) ?? []
    const earliestStartedAt = earliestStartedAtByProgram.get(programId) ?? null
    const programCreatedAt = programCreatedAtMap.get(programId) ?? new Date().toISOString()
    if (!isLogInsideAssignment(log, programAssignments, earliestStartedAt, programCreatedAt)) continue

    const current = sessionLogsByProgram.get(programId) ?? []
    current.push(log)
    sessionLogsByProgram.set(programId, current)

    logIdToProgramId.set(log.id, programId)
  }

  for (const event of ((progressionEventsData.data ?? []) as ProgressionEventRow[])) {
    const programId = logIdToProgramId.get(event.session_log_id)
    if (!programId) continue
    const current = progressionByProgram.get(programId) ?? []
    current.push(event)
    progressionByProgram.set(programId, current)
  }

  const enrichedPrograms = programs.map((program) => ({
    ...program,
    analytics: deriveProgramAnalytics(
      program,
      sessionLogsByProgram.get(program.id) ?? [],
      progressionByProgram.get(program.id) ?? [],
    ),
  }))

  return NextResponse.json({ programs: enrichedPrograms })
}

// POST /api/programs — créer un programme
export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { client_id, name, description, weeks } = body

  if (!client_id || !name) return NextResponse.json({ error: 'client_id et name requis' }, { status: 400 })

  const { data, error } = await service()
    .from('programs')
    .insert({ coach_id: user.id, client_id, name, description, weeks: weeks ?? 4 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notif client — programme assigné
  await createClientAppNotification(service(), {
    coachId: user.id,
    clientId: client_id,
    type: 'program_assigned',
    copyKey: 'workout.available',
    actionUrl: '/client/programme',
    pushKind: 'program',
  })

  return NextResponse.json({ program: data }, { status: 201 })
}
