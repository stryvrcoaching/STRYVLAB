import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { analyzeExercisePerformance, type SessionPerf, type OverloadEvent, type SetLogEntry } from '@/lib/performance/analyzer'
import { computeWorkoutAlerts, type WorkoutAnalysisRow } from '@/lib/client/smart/workoutAlerts'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cc } = await svc().from('coach_clients').select('id').eq('user_id', user.id).single()
  if (!cc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const eightWeeksAgo = new Date()
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

  const { data: sessionLogs } = await svc()
    .from('client_session_logs')
    .select('id, completed_at, client_set_logs(id, exercise_id, exercise_name, actual_reps, rir_actual, completed, set_number)')
    .eq('client_id', cc.id)
    .not('completed_at', 'is', null)
    .gte('completed_at', eightWeeksAgo.toISOString())

  const sessions: SessionPerf[] = (sessionLogs ?? []).map(s => ({
    session_log_id: s.id,
    logged_at: s.completed_at as string,
    sets: ((s.client_set_logs ?? []) as any[]).map(sl => ({
      exercise_id: sl.exercise_id ?? sl.exercise_name,
      exercise_name: sl.exercise_name ?? 'Exercice',
      set_number: sl.set_number ?? 1,
      actual_reps: sl.actual_reps ?? null,
      rir_actual: sl.rir_actual ?? null,
      completed: sl.completed === true,
    } satisfies SetLogEntry)),
  }))

  const { data: progressionEvents } = await svc()
    .from('progression_events')
    .select('exercise_id, created_at, trigger_type')
    .eq('client_id', cc.id)
    .gte('created_at', eightWeeksAgo.toISOString())

  // progression_events has no exercise_name column — use exercise_id as both fields
  const overloads: OverloadEvent[] = (progressionEvents ?? []).map(e => ({
    exercise_id: e.exercise_id,
    exercise_name: e.exercise_id,
    created_at: e.created_at,
    trigger_type: e.trigger_type,
  }))

  const analysis = analyzeExercisePerformance(sessions, overloads, 8)
  const rows: WorkoutAnalysisRow[] = analysis.exercises.map(e => ({
    exercise_name: e.exercise_name,
    completion_rate: e.completion_rate,
    avg_rir: e.avg_rir,
    rir_trend: e.rir_trend,
    overloads_last_4_weeks: e.overloads_last_4_weeks,
    stagnation: e.stagnation,
    overreaching: e.overreaching,
  }))

  return NextResponse.json({ alerts: computeWorkoutAlerts(rows) })
}
