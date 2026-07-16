import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { analyzeExercisePerformance, type SessionPerf, type OverloadEvent, type SetLogEntry } from '@/lib/performance/analyzer'
import { computeWorkoutAlerts, type WorkoutAnalysisRow } from '@/lib/client/smart/workoutAlerts'
import { resolveCanonicalExerciseKey, resolveCanonicalExerciseName } from '@/lib/training/exerciseHistoryKey'

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

  const exerciseNameByTechnicalId = new Map<string, string>()
  for (const session of sessionLogs ?? []) {
    for (const setLog of ((session.client_set_logs ?? []) as any[])) {
      if (typeof setLog.exercise_id !== 'string' || typeof setLog.exercise_name !== 'string') continue
      if (!setLog.exercise_name.trim()) continue
      exerciseNameByTechnicalId.set(setLog.exercise_id, setLog.exercise_name)
    }
  }

  const sessions: SessionPerf[] = (sessionLogs ?? []).map(s => ({
    session_log_id: s.id,
    logged_at: s.completed_at as string,
    sets: ((s.client_set_logs ?? []) as any[]).map(sl => {
      const exerciseName = typeof sl.exercise_name === 'string' && sl.exercise_name.trim()
        ? sl.exercise_name
        : exerciseNameByTechnicalId.get(sl.exercise_id) ?? 'Exercice'
      return {
        exercise_id: resolveCanonicalExerciseKey(exerciseName),
        exercise_name: resolveCanonicalExerciseName(exerciseName),
        set_number: sl.set_number ?? 1,
        actual_reps: sl.actual_reps ?? null,
        rir_actual: sl.rir_actual ?? null,
        completed: sl.completed === true,
      } satisfies SetLogEntry
    }),
  }))

  const { data: progressionEvents } = await svc()
    .from('progression_events')
    .select('exercise_id, exercise_name, exercise_key, created_at, trigger_type')
    .eq('client_id', cc.id)
    .gte('created_at', eightWeeksAgo.toISOString())

  const overloads: OverloadEvent[] = (progressionEvents ?? []).map(e => ({
    exercise_id: e.exercise_key ?? resolveCanonicalExerciseKey(e.exercise_name ?? exerciseNameByTechnicalId.get(e.exercise_id) ?? e.exercise_id),
    exercise_name: resolveCanonicalExerciseName(e.exercise_name ?? exerciseNameByTechnicalId.get(e.exercise_id) ?? e.exercise_id),
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
