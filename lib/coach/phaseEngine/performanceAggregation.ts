/** Agrégation performance séances → signaux moteur (overreaching, progression charge). */

import {
  analyzeExercisePerformance,
  type OverloadEvent,
  type SessionPerf,
  type SetLogEntry,
} from '@/lib/performance/analyzer'
import { isLikelyCompoundExercise } from './clientProfile'
import { computeOneRMTrends, type RawSetLogEntry } from '@/lib/training/oneRepMax'
import { resolveCanonicalExerciseKey, resolveCanonicalExerciseName } from '@/lib/training/exerciseHistoryKey'

export interface SessionSetRow {
  exercise_id: string
  exercise_name: string
  set_number: number
  completed: boolean
  rir_actual: number | null
  actual_weight_kg: number | null
  actual_reps: number | null
  set_type: string | null
}

export interface SessionAggregate {
  completed_at: string
  sets: SessionSetRow[]
}

export interface ExercisePerformanceRow {
  exercise_id: string
  exercise_name: string
  completion_rate: number
  avg_rir: number | null
  prescribed_rir: number | null
  overloads_last_4_weeks: number
  stagnation: boolean
  overreaching: boolean
  load_progressing: boolean
  intentional_intensity: boolean
}

function sessionCompletionRate(sets: SessionSetRow[]): number {
  if (sets.length === 0) return 0
  return sets.filter(s => s.completed).length / sets.length
}

function sessionIntentionalIntensity(
  sets: SessionSetRow[],
  prescribedRir: number | null,
): boolean {
  if (prescribedRir === 0) return true
  const dropsets = sets.filter(s => s.set_type === 'dropset').length
  if (dropsets > 0 && dropsets / sets.length >= 0.15) return true
  const hardSets = sets.filter(s => s.rir_actual != null && s.rir_actual <= 1).length
  if (hardSets > 0 && hardSets / sets.length >= 0.4) return true
  return false
}

function maxWeightInSession(sets: SessionSetRow[]): number {
  return sets.reduce((max, s) => {
    const w = s.actual_weight_kg != null ? Number(s.actual_weight_kg) : 0
    return w > max ? w : max
  }, 0)
}

export function buildExercisePerformanceRows(input: {
  sessions: SessionAggregate[]
  progressionEvents: { exercise_id: string; created_at: string; trigger_type: string }[]
  prescribedRirByExercise: Map<string, number | null>
  windowDays: number
}): ExercisePerformanceRow[] {
  const byExercise = new Map<
    string,
    {
      name: string
      completionBySession: { rate: number; intentional: boolean }[]
      rirValues: number[]
      maxWeightBySession: { date: string; max: number }[]
    }
  >()

  const sortedSessions = [...input.sessions].sort(
    (a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime(),
  )

  const performanceSessions: SessionPerf[] = sortedSessions.map((session) => ({
    session_log_id: `${session.completed_at}:${session.sets.length}`,
    logged_at: session.completed_at,
    sets: session.sets.map(
      (set): SetLogEntry => ({
        exercise_id: set.exercise_id || resolveCanonicalExerciseKey(set.exercise_name),
        exercise_name: resolveCanonicalExerciseName(set.exercise_name),
        set_number: set.set_number,
        actual_reps: set.actual_reps,
        completed: set.completed,
        rir_actual: set.rir_actual,
      }),
    ),
  }))

  const overloadEvents: OverloadEvent[] = input.progressionEvents.map((event) => ({
    exercise_id: event.exercise_id,
    exercise_name: event.exercise_id,
    created_at: event.created_at,
    trigger_type: event.trigger_type === 'overload' ? 'overload' : 'maintain',
  }))

  const analysis = analyzeExercisePerformance(
    performanceSessions,
    overloadEvents,
    Math.max(4, Math.ceil(input.windowDays / 7)),
  )
  const summaryByExerciseId = new Map(
    analysis.exercises.map((summary) => [summary.exercise_id, summary] as const),
  )

  for (const session of sortedSessions) {
    const exIds = Array.from(
      new Set(session.sets.map((s) => s.exercise_id || resolveCanonicalExerciseKey(s.exercise_name)).filter(Boolean)),
    )
    for (const exId of exIds) {
      const exSets = session.sets.filter((s) => (s.exercise_id || resolveCanonicalExerciseKey(s.exercise_name)) === exId)
      const name = resolveCanonicalExerciseName(exSets[0]?.exercise_name ?? exId)
      if (!byExercise.has(exId)) {
        byExercise.set(exId, {
          name,
          completionBySession: [],
          rirValues: [],
          maxWeightBySession: [],
        })
      }
      const entry = byExercise.get(exId)!
      const prescribed = input.prescribedRirByExercise.get(exId) ?? null
      entry.completionBySession.push({
        rate: sessionCompletionRate(exSets),
        intentional: sessionIntentionalIntensity(exSets, prescribed),
      })
      entry.rirValues.push(
        ...exSets.map(s => s.rir_actual).filter((v): v is number => typeof v === 'number'),
      )
      const maxW = maxWeightInSession(exSets)
      if (maxW > 0) {
        entry.maxWeightBySession.push({ date: session.completed_at, max: maxW })
      }
    }
  }

  return Array.from(byExercise.entries()).map(([exId, data]) => {
    const summary = summaryByExerciseId.get(exId)
    const avgCompletion =
      summary?.completion_rate ??
      (data.completionBySession.reduce((s, v) => s + v.rate, 0) /
        Math.max(1, data.completionBySession.length))
    const avgRir =
      summary?.avg_rir ??
      (data.rirValues.length > 0
        ? data.rirValues.reduce((s, v) => s + v, 0) / data.rirValues.length
        : null)
    const prescribed_rir = input.prescribedRirByExercise.get(exId) ?? null
    const overloads = summary?.overloads_last_4_weeks ?? 0

    const lowCompletionSessions = data.completionBySession.filter(c => c.rate < 0.8)
    const unintentionalLowCompletion = lowCompletionSessions.filter(c => !c.intentional)
    const overreaching =
      summary?.overreaching ??
      (unintentionalLowCompletion.length >= 2 ||
        (lowCompletionSessions.length >= 2 &&
          !data.completionBySession.some(c => c.intentional) &&
          avgCompletion < 0.75))

    const intentional_intensity = data.completionBySession.some(c => c.intentional)

    const recentMax = data.maxWeightBySession.slice(-3)
    let load_progressing = false
    if (recentMax.length >= 2) {
      load_progressing = recentMax[recentMax.length - 1].max > recentMax[0].max * 1.01
    }

    const stagnation = summary?.stagnation ?? false

    return {
      exercise_id: exId,
      exercise_name: data.name,
      completion_rate: avgCompletion,
      avg_rir: avgRir,
      prescribed_rir,
      overloads_last_4_weeks: overloads,
      stagnation,
      overreaching,
      load_progressing,
      intentional_intensity,
    }
  })
}

export function computeGlobalOverreaching(exercises: ExercisePerformanceRow[]): boolean {
  return exercises.filter(e => e.overreaching).length >= 2
}

export function computeProgressionContext(input: {
  progressionEvents: { exercise_id: string; trigger_type: string }[]
  setLogsForOneRm: RawSetLogEntry[]
}): {
  overloadEventCount: number
  compoundOneRmImproving: boolean
  recentPrDetected: boolean
} {
  const overloadEventCount = input.progressionEvents.filter(
    e => e.trigger_type === 'overload',
  ).length

  const trends = computeOneRMTrends(input.setLogsForOneRm, 8)
  const compoundTrends = trends.filter(t => isLikelyCompoundExercise(t.exercise))
  const compoundOneRmImproving =
    compoundTrends.length > 0 && compoundTrends.some(t => t.percentChange >= 2)
  const recentPrDetected =
    trends.some(t => t.percentChange >= 3) || overloadEventCount >= 2

  return { overloadEventCount, compoundOneRmImproving, recentPrDetected }
}
