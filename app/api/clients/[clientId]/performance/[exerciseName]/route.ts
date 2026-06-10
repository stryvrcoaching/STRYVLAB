import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { detectPerformanceTrend } from '@/lib/programs/intelligence/performance'
import type { SessionObservation } from '@/lib/programs/intelligence/performance'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { clientId: string; exerciseName: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = service()

  const { data: client } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  }

  const exerciseName = decodeURIComponent(params.exerciseName)

  // Get last 10 completed session logs, then filter by exercise presence
  const { data: sessionLogs } = await db
    .from('client_session_logs')
    .select('id, completed_at')
    .eq('client_id', params.clientId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(10)

  if (!sessionLogs || sessionLogs.length === 0) {
    return NextResponse.json({ trend: null, suggestion: null, sessionCount: 0 })
  }

  const sessionIds = sessionLogs.map(s => s.id)

  const { data: setLogs } = await db
    .from('client_set_logs')
    .select('session_log_id, actual_reps, actual_weight_kg, completed, rir_actual')
    .eq('exercise_name', exerciseName)
    .in('session_log_id', sessionIds)

  if (!setLogs || setLogs.length === 0) {
    return NextResponse.json({ trend: null, suggestion: null, sessionCount: 0 })
  }

  // Group sets by session
  const setsBySession: Record<string, typeof setLogs> = {}
  for (const set of setLogs) {
    if (!setsBySession[set.session_log_id]) {
      setsBySession[set.session_log_id] = []
    }
    setsBySession[set.session_log_id].push(set)
  }

  // Build SessionObservation list — last 3 sessions that have data for this exercise
  const observations: SessionObservation[] = sessionLogs
    .filter(s => setsBySession[s.id])
    .slice(0, 3)
    .map(s => ({
      completedAt: s.completed_at as string,
      sets: setsBySession[s.id].map(set => ({
        actual_reps: set.actual_reps,
        actual_weight_kg: set.actual_weight_kg,
        completed: set.completed,
        rir_actual: set.rir_actual,
      })),
    }))

  const result = detectPerformanceTrend(observations)

  return NextResponse.json(result)
}
