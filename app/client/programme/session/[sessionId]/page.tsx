import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { indexExerciseHistoryEntry } from '@/lib/training/exerciseHistoryKey'
import SessionLogger from './SessionLogger'

export default async function SessionLogPage({
  params,
  searchParams,
}: {
  params: { sessionId: string }
  searchParams?: { fromDow?: string }
}) {
  const fallbackDow = searchParams?.fromDow
  const fallbackHref = fallbackDow ? `/client/programme?dow=${encodeURIComponent(fallbackDow)}` : '/client/programme'

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (!user) redirect('/client/login')

  const clientPromise = resolveClientFromUser(user.id, user.email, service, 'id, gender')
  const [client] = await Promise.all([clientPromise])
  if (!client) {
    console.error('[programme/session] client resolution failed', {
      sessionId: params.sessionId,
      userId: user.id,
      userEmail: user.email ?? null,
      fallbackHref,
    })
    redirect(fallbackHref)
  }
  const clientGender = (client as { gender?: string | null }).gender ?? null

  const { data: session, error: sessionError } = await service
    .from('program_sessions')
    .select(`
      id, name, day_of_week,
      program_id,
      program_exercises (
        id, name, sets, reps, rest_sec, rir, notes, position,
        target_rir, current_weight_kg, rep_min, rep_max, weight_increment_kg,
        image_url, is_unilateral, primary_muscles, secondary_muscles, group_id,
        tempo, movement_pattern, set_prescriptions, superset_rest_mode, execution_type, target_hr_zone
      )
    `)
    .eq('id', params.sessionId)
    .maybeSingle()

  if (!session?.id) {
    console.error('[programme/session] session lookup failed', {
      sessionId: params.sessionId,
      clientId: client.id,
      sessionError: sessionError?.message ?? null,
      fallbackHref,
    })
    redirect(fallbackHref)
  }

  const { data: program, error: programError } = (session as any).program_id
    ? await service
        .from('programs')
        .select('id, client_id, status, progressive_overload_enabled, goal, level, template_id')
        .eq('id', (session as any).program_id)
        .maybeSingle()
    : { data: null as any, error: null as any }

  if (program?.client_id && program.client_id !== client.id) {
    console.error('[programme/session] program ownership mismatch', {
      sessionId: params.sessionId,
      clientId: client.id,
      sessionProgramId: (session as any).program_id ?? null,
      resolvedProgramClientId: program.client_id,
      fallbackHref,
    })
    redirect(fallbackHref)
  }

  if (!program?.id) {
    console.warn('[programme/session] program lookup fallback', {
      sessionId: params.sessionId,
      clientId: client.id,
      sessionProgramId: (session as any).program_id ?? null,
      programError: programError?.message ?? null,
    })
  }

  const progressionEnabled = (program as any)?.progressive_overload_enabled ?? false
  const goal: string = (program as any)?.goal ?? 'hypertrophy'
  const level: string = (program as any)?.level ?? 'intermediate'

  const exercises = ((session.program_exercises ?? []) as any[])
    .sort((a: any, b: any) => a.position - b.position)
    .map((ex: any) => ({
      ...ex,
      progressive_overload_enabled: progressionEnabled,
      // Détection unilatéral : flag DB OU nom contient un mot-clé unilatéral
      // NOTE: préférer cocher is_unilateral dans le builder coach — la regex est un filet de sécurité
      is_unilateral: ex.is_unilateral ||
        /unilat[eé]ral|single|alterné|alternée|1 bras|1 jambe|un bras|une jambe|kick.?back|extension.?hanche|hip.?thrust.?unilat|curl.?unilat|presse.?unilat|fente|split.?squat|bulgarian|abduction|adduction/i.test(ex.name ?? ''),
      clientAlternatives: [],  // Will be populated below
    }))

  const templateId = (program as any)?.template_id as string | null

  // For each exercise, find coach-configured alternatives
  let alternativesMap: Record<string, string[]> = {}
  if (templateId && exercises?.length) {
    // Fetch all sessions in the template
    const { data: templateSessions } = await service
      .from('coach_program_template_sessions')
      .select('id')
      .eq('template_id', templateId)

    if (templateSessions && templateSessions.length > 0) {
      const sessionIds = templateSessions.map((s: any) => s.id)

      // Fetch exercises in those sessions with alternatives
      const { data: templateExercises } = await service
        .from('coach_program_template_exercises')
        .select(`
          name,
          coach_template_exercise_alternatives (name, position)
        `)
        .in('session_id', sessionIds)

      if (templateExercises) {
        for (const te of templateExercises) {
          const alts = ((te as any).coach_template_exercise_alternatives ?? [])
            .sort((a: any, b: any) => a.position - b.position)
            .map((a: any) => a.name as string)
          if (alts.length > 0) alternativesMap[te.name] = alts
        }
      }
    }
  }

  // Fetch historique de la dernière séance pour cet exercice (par nom, derniers set_logs)
  // On récupère les set_logs de la dernière session_log pour chaque exercice de cette séance
  let lastPerformance: Record<string, { weight: number | null; reps: number | null; rir?: number | null; side?: string | null; set_number?: number | null; completed_at?: string | null }[]> = {}

  if (exercises.length > 0) {
    // Query from client_session_logs (has client_id) then join set_logs — same pattern as exercise-history route
    // Embedded filter .eq('client_session_logs.client_id', ...) on client_set_logs doesn't restrict rows in Supabase JS
    const since = new Date()
    since.setDate(since.getDate() - 112) // 16 weeks

    const { data: sessionLogs } = await service
      .from('client_session_logs')
      .select(`
        completed_at,
        client_set_logs(exercise_name, set_number, actual_weight_kg, actual_reps, rir_actual, side, completed)
      `)
      .eq('client_id', client.id)
      .not('completed_at', 'is', null)
      .gte('completed_at', since.toISOString())
      .order('completed_at', { ascending: false })
      .limit(50)

    if (sessionLogs) {
      // Process sessions newest-first and index rows by canonical exercise identity.
      for (const session of sessionLogs) {
        const sets = ((session.client_set_logs ?? []) as any[])
          .filter((s: any) => s.completed === true && typeof s.exercise_name === 'string' && s.exercise_name.trim().length > 0)
        for (const s of sets) {
          const entry = {
            weight: s.actual_weight_kg,
            reps: s.actual_reps,
            rir: s.rir_actual ?? null,
            side: s.side,
            set_number: s.set_number,
            completed_at: session.completed_at ?? null,
          }
          indexExerciseHistoryEntry(lastPerformance, s.exercise_name, entry)
        }
      }
    }
  }

  // Add clientAlternatives to each exercise
  const exercisesWithAlternatives = exercises.map((ex: any) => ({
    ...ex,
    clientAlternatives: alternativesMap[ex.name] ?? [],
  }))

  // Fetch poids client (dernière valeur depuis assessment_submissions)
  let clientWeight: number | undefined
  const { data: weightData } = await service
    .from('assessment_submissions')
    .select('answers')
    .eq('client_id', client.id)
    .not('answers', 'is', null)
    .order('bilan_date', { ascending: false })
    .limit(5)

  if (weightData) {
    for (const sub of weightData) {
      const answers = (sub as any).answers
      if (typeof answers === 'object' && answers !== null) {
        const w = answers.weight_kg ?? answers.poids_kg ?? answers.weight
        if (typeof w === 'number' && w > 0 && w < 300) {
          clientWeight = w
          break
        }
      }
    }
  }

  return (
    <SessionLogger
      clientId={client.id}
      sessionId={params.sessionId}
      session={{ id: session.id, name: session.name, programId: (program as any)?.id ?? (session as any).program_id ?? params.sessionId }}
      exercises={exercisesWithAlternatives}
      lastPerformance={lastPerformance}
      goal={goal}
      level={level}
      clientWeight={clientWeight}
      clientGender={clientGender}
    />
  )
}
