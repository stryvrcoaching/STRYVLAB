/**
 * Performance Analyzer — Phase 3 Feedback Loops
 *
 * Logique pure — aucune dépendance Supabase/DB.
 * Testable isolément.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SetLogEntry {
  exercise_id: string
  exercise_name: string
  set_number: number
  actual_reps: number | null
  completed: boolean
  rir_actual: number | null
}

export interface SessionPerf {
  session_log_id: string
  logged_at: string // ISO date
  sets: SetLogEntry[]
}

export interface OverloadEvent {
  exercise_id: string
  exercise_name: string
  created_at: string
  trigger_type: 'overload' | 'maintain'
}

export interface ExercisePerformanceSummary {
  exercise_id: string
  exercise_name: string
  sessions_count: number
  completion_rate: number        // 0–1 : sets completed / sets in logs
  avg_rir: number | null         // moyenne des rir_actual non-null
  rir_trend: 'improving' | 'declining' | 'stable' | 'insufficient_data'
  overloads_last_4_weeks: number
  stagnation: boolean            // true si 0 overload sur 3+ semaines avec données
  overreaching: boolean          // true si completion_rate < 0.8 sur 2+ sessions consécutives
}

export interface PerformanceAnalysis {
  exercises: ExercisePerformanceSummary[]
  global_overreaching: boolean   // true si 2+ exercices en overreaching
  analysis_period_weeks: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function weeksAgo(weeks: number, from: Date = new Date()): Date {
  const d = new Date(from)
  d.setDate(d.getDate() - weeks * 7)
  return d
}

function getSessionsForExercise(sessions: SessionPerf[], exerciseId: string): SessionPerf[] {
  return sessions
    .map(session => ({
      ...session,
      sets: session.sets.filter(s => s.exercise_id === exerciseId),
    }))
    .filter(session => session.sets.length > 0)
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
}

function computeCompletionRate(sets: SetLogEntry[]): number {
  if (sets.length === 0) return 0
  const completed = sets.filter(s => s.completed).length
  return completed / sets.length
}

function computeRirTrend(sessionPerfs: SessionPerf[], exerciseId: string): ExercisePerformanceSummary['rir_trend'] {
  const sessionsWithRir = sessionPerfs
    .map(session => {
      const exerciseSets = session.sets.filter(
        s => s.exercise_id === exerciseId && s.rir_actual !== null
      )
      if (exerciseSets.length === 0) return null
      const avg = exerciseSets.reduce((sum, s) => sum + (s.rir_actual ?? 0), 0) / exerciseSets.length
      return { logged_at: session.logged_at, avgRir: avg }
    })
    .filter((x): x is { logged_at: string; avgRir: number } => x !== null)
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())

  if (sessionsWithRir.length < 4) return 'insufficient_data'

  const recent = sessionsWithRir.slice(-2)
  const previous = sessionsWithRir.slice(-4, -2)

  const recentAvg = recent.reduce((sum, s) => sum + s.avgRir, 0) / recent.length
  const previousAvg = previous.reduce((sum, s) => sum + s.avgRir, 0) / previous.length

  const delta = recentAvg - previousAvg
  if (delta > 0.5) return 'improving'   // RIR montant = exercice devient plus facile
  if (delta < -0.5) return 'declining'  // RIR descendant = exercice devient plus dur
  return 'stable'
}

function computeOverreaching(sessionPerfs: SessionPerf[], exerciseId: string): boolean {
  // Vérifie si les 2 dernières sessions consécutives ont un completion_rate < 0.8
  const sorted = sessionPerfs
    .map(session => ({
      logged_at: session.logged_at,
      sets: session.sets.filter(s => s.exercise_id === exerciseId),
    }))
    .filter(s => s.sets.length > 0)
    .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()) // most recent first

  if (sorted.length < 2) return false

  const last2 = sorted.slice(0, 2)
  return last2.every(session => computeCompletionRate(session.sets) < 0.8)
}

function computeStagnation(
  sessionPerfs: SessionPerf[],
  exerciseId: string,
  overloadEvents: OverloadEvent[],
  now: Date = new Date()
): boolean {
  const threeWeeksAgo = weeksAgo(3, now)

  // Sessions dans les 3 dernières semaines pour cet exercice
  const recentSessions = sessionPerfs.filter(
    session =>
      new Date(session.logged_at) >= threeWeeksAgo &&
      session.sets.some(s => s.exercise_id === exerciseId)
  )

  if (recentSessions.length < 3) return false

  // Overloads dans les 3 dernières semaines
  const recentOverloads = overloadEvents.filter(
    ev =>
      ev.exercise_id === exerciseId &&
      ev.trigger_type === 'overload' &&
      new Date(ev.created_at) >= threeWeeksAgo
  )

  return recentOverloads.length === 0
}

// ─── Fonction principale ──────────────────────────────────────────────────────

/**
 * Analyse les données de performance d'un client sur une période donnée.
 *
 * @param sessions       - Historique des séances (avec leurs sets)
 * @param overloadEvents - Événements de progression (overload/maintain)
 * @param weeksBack      - Période d'analyse en semaines (défaut: 8)
 */
export function analyzeExercisePerformance(
  sessions: SessionPerf[],
  overloadEvents: OverloadEvent[],
  weeksBack: number = 8
): PerformanceAnalysis {
  if (sessions.length === 0) {
    return { exercises: [], global_overreaching: false, analysis_period_weeks: weeksBack }
  }

  const now = new Date()
  const periodStart = weeksAgo(weeksBack, now)
  const fourWeeksAgo = weeksAgo(4, now)

  // Filtrer les sessions dans la période d'analyse
  const periodSessions = sessions.filter(
    s => new Date(s.logged_at) >= periodStart
  )

  // Collecter tous les exercices uniques dans la période
  const exerciseMap = new Map<string, { id: string; name: string }>()
  for (const session of periodSessions) {
    for (const set of session.sets) {
      if (!exerciseMap.has(set.exercise_id)) {
        exerciseMap.set(set.exercise_id, {
          id: set.exercise_id,
          name: set.exercise_name,
        })
      }
    }
  }

  const summaries: ExercisePerformanceSummary[] = []

  for (const [exerciseId, meta] of Array.from(exerciseMap)) {
    const exerciseSessions = getSessionsForExercise(periodSessions, exerciseId)
    const allSets = exerciseSessions.flatMap(s =>
      s.sets.filter(set => set.exercise_id === exerciseId)
    )

    // Completion rate global sur la période
    const completion_rate = computeCompletionRate(allSets)

    // Moyenne RIR sur tous les sets non-null
    const rirValues = allSets
      .filter(s => s.completed && s.rir_actual !== null)
      .map(s => s.rir_actual as number)
    const avg_rir = rirValues.length > 0
      ? rirValues.reduce((sum, v) => sum + v, 0) / rirValues.length
      : null

    // Tendance RIR
    const rir_trend = computeRirTrend(exerciseSessions, exerciseId)

    // Overloads sur les 4 dernières semaines
    const overloads_last_4_weeks = overloadEvents.filter(
      ev =>
        ev.exercise_id === exerciseId &&
        ev.trigger_type === 'overload' &&
        new Date(ev.created_at) >= fourWeeksAgo
    ).length

    // Stagnation
    const stagnation = computeStagnation(exerciseSessions, exerciseId, overloadEvents, now)

    // Overreaching (2 dernières sessions consécutives < 80%)
    const overreaching = computeOverreaching(exerciseSessions, exerciseId)

    summaries.push({
      exercise_id: exerciseId,
      exercise_name: meta.name,
      sessions_count: exerciseSessions.length,
      completion_rate,
      avg_rir,
      rir_trend,
      overloads_last_4_weeks,
      stagnation,
      overreaching,
    })
  }

  const global_overreaching = summaries.filter(s => s.overreaching).length >= 2

  return {
    exercises: summaries,
    global_overreaching,
    analysis_period_weeks: weeksBack,
  }
}
