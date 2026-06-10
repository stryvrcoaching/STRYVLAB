import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { insertClientNotification } from '@/lib/notifications/insert-client-notification'
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

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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
      equipment_archetype, session_mode, status, is_client_visible, created_at,
      program_sessions (
        id, name, day_of_week, days_of_week, position, notes,
        program_exercises (
          id, name, sets, reps, rest_sec, rir, notes, position, image_url,
          movement_pattern, equipment_required, primary_muscles, secondary_muscles,
          group_id, is_compound, target_rir, weight_increment_kg, set_prescriptions,
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
      id, program_session_id, session_name, logged_at, completed_at, duration_min,
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

  if (progressionEventsData.error) {
    return NextResponse.json({ error: progressionEventsData.error.message }, { status: 500 })
  }

  const sessionLogsByProgram = new Map<string, SessionLogRow[]>()
  for (const log of sessionLogs) {
    const sessionId = log.program_session_id
    const programIdFromId = sessionId ? sessionIdToProgramId.get(sessionId) : null
    const normalizedSessionName = normalizeLabel(log.session_name)
    const programIdsFromName = normalizedSessionName ? sessionNameToProgramIds.get(normalizedSessionName) : null
    const programId =
      programIdFromId ??
      (programIdsFromName && programIdsFromName.size === 1
        ? Array.from(programIdsFromName)[0]
        : null)
    if (!programId) continue
    const current = sessionLogsByProgram.get(programId) ?? []
    current.push(log)
    sessionLogsByProgram.set(programId, current)
  }

  const progressionByProgram = new Map<string, ProgressionEventRow[]>()
  const logIdToProgramId = new Map<string, string>()
  for (const log of sessionLogs) {
    const sessionId = log.program_session_id
    const programIdFromId = sessionId ? sessionIdToProgramId.get(sessionId) : null
    const normalizedSessionName = normalizeLabel(log.session_name)
    const programIdsFromName = normalizedSessionName ? sessionNameToProgramIds.get(normalizedSessionName) : null
    const programId =
      programIdFromId ??
      (programIdsFromName && programIdsFromName.size === 1
        ? Array.from(programIdsFromName)[0]
        : null)
    if (!programId) continue
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
  await insertClientNotification(service(), {
    coachId:  user.id,
    clientId: client_id,
    type:     'program_assigned',
    message:  `Ton coach t'a assigné un nouveau programme : "${name}".`,
  })

  return NextResponse.json({ program: data }, { status: 201 })
}
