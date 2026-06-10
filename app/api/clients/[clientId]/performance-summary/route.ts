// GET /api/clients/[clientId]/performance-summary
// Retourne l'analyse de performance + recommandations pour un client (coach authentifié)

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { analyzeExercisePerformance } from '@/lib/performance/analyzer'
import { generateRecommendations } from '@/lib/performance/recommendations'
import type { SessionPerf, SetLogEntry, OverloadEvent } from '@/lib/performance/analyzer'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const querySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(8),
})

type Params = { params: { clientId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  // Auth
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = service()

  // Ownership check : le coach doit posséder ce client
  const { data: coachAccess } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!coachAccess) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Parse query params
  const url = new URL(req.url)
  const parsed = querySchema.safeParse({ weeks: url.searchParams.get('weeks') ?? 8 })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }
  const { weeks } = parsed.data

  const periodStart = new Date()
  periodStart.setDate(periodStart.getDate() - weeks * 7)
  const periodStartIso = periodStart.toISOString()

  // Fetch client_session_logs + client_set_logs dans la période
  const { data: sessionLogs, error: sessionLogsError } = await db
    .from('client_session_logs')
    .select(`
      id,
      completed_at,
      client_set_logs (
        exercise_id,
        exercise_name,
        set_number,
        actual_reps,
        completed,
        rir_actual
      )
    `)
    .eq('client_id', params.clientId)
    .not('completed_at', 'is', null)
    .gte('completed_at', periodStartIso)
    .order('completed_at', { ascending: true })

  if (sessionLogsError) {
    console.error('[performance-summary] session_logs error', sessionLogsError)
    return NextResponse.json({ error: 'Erreur lecture séances' }, { status: 500 })
  }

  // Fetch progression_events dans la période
  const { data: progressionEvents, error: progressionError } = await db
    .from('progression_events')
    .select('exercise_id, exercise_name:exercise_id, created_at, trigger_type, new_weight_kg')
    .eq('client_id', params.clientId)
    .gte('created_at', periodStartIso)
    .order('created_at', { ascending: true })

  if (progressionError) {
    console.error('[performance-summary] progression_events error', progressionError)
    return NextResponse.json({ error: 'Erreur lecture progression' }, { status: 500 })
  }

  // Fetch programme actif (le plus récent non archivé)
  const { data: activeProgram } = await db
    .from('programs')
    .select(`
      id,
      program_exercises (
        id,
        name,
        sets,
        current_weight_kg
      )
    `)
    .eq('client_id', params.clientId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Construire les SessionPerf
  const sessions: SessionPerf[] = (sessionLogs ?? []).map(log => {
    const rawSets = (log.client_set_logs ?? []) as Array<{
      exercise_id: string
      exercise_name: string
      set_number: number
      actual_reps: number | null
      completed: boolean
      rir_actual: number | null
    }>
    const sets: SetLogEntry[] = rawSets.map(s => ({
      exercise_id: s.exercise_id,
      exercise_name: s.exercise_name,
      set_number: s.set_number,
      actual_reps: s.actual_reps,
      completed: s.completed,
      rir_actual: s.rir_actual,
    }))
    return {
      session_log_id: log.id,
      logged_at: log.completed_at as string,
      sets,
    }
  })

  // Construire les OverloadEvent
  // progression_events n'a pas de colonne exercise_name, on utilise l'exercise_id comme fallback
  const overloadEvents: OverloadEvent[] = (progressionEvents ?? [])
    .filter(ev => ev.trigger_type === 'overload' || ev.trigger_type === 'maintain')
    .map(ev => ({
      exercise_id: ev.exercise_id,
      exercise_name: ev.exercise_id, // sera enrichi en UI via le nom dans les sets
      created_at: ev.created_at,
      trigger_type: ev.trigger_type as 'overload' | 'maintain',
    }))

  // Analyser
  const analysis = analyzeExercisePerformance(sessions, overloadEvents, weeks)

  // Générer les recommandations
  type RawProgramExercise = {
    id: string
    name: string
    sets: number
    current_weight_kg: number | null
  }

  const programExercises: RawProgramExercise[] = activeProgram
    ? (activeProgram.program_exercises ?? []).map((pe: RawProgramExercise) => ({
        id: pe.id,
        name: pe.name,
        sets: pe.sets,
        current_weight_kg: pe.current_weight_kg,
      }))
    : []

  const recommendations = generateRecommendations(analysis, { exercises: programExercises })

  return NextResponse.json({ analysis, recommendations })
}
