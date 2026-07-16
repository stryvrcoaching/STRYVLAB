import type { SupabaseClient } from '@supabase/supabase-js'
import { overlapsAssignmentWindow, isTimestampInsideAssignment } from '@/lib/assignments/windows'
import { isEffectiveSet, isMeaningfulSession } from '@/lib/training/sessionLogUtils'
import type {
  OverlayBuilderContext,
  OverlaySeriesMap,
} from '@/lib/coach/metricsOverlay/types'

type PerformanceBucket = {
  completedSets: number
  effectiveSets: number
  volume: number
  loadSum: number
  loadCount: number
  rirSum: number
  rirCount: number
  rpeSum: number
  rpeCount: number
}

type WorkoutAssignmentRow = {
  program_id: string
  started_at: string
  ended_at: string | null
}

function isMissingOptionalRelationError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = String(error?.message ?? '').toLowerCase()
  return (
    error?.code === '42P01' ||
    message.includes('schema cache') ||
    message.includes('could not find the table') ||
    message.includes('does not exist')
  )
}

function initBucket(): PerformanceBucket {
  return {
    completedSets: 0,
    effectiveSets: 0,
    volume: 0,
    loadSum: 0,
    loadCount: 0,
    rirSum: 0,
    rirCount: 0,
    rpeSum: 0,
    rpeCount: 0,
  }
}

export async function buildPerformanceOverlaySeries(
  db: SupabaseClient,
  ctx: OverlayBuilderContext,
): Promise<OverlaySeriesMap> {
  const rangeStartIso = `${ctx.startDateKey}T00:00:00.000Z`
  const rangeEndIso = `${ctx.endDateKey}T23:59:59.999Z`

  const [
    { data: assignmentRows, error: assignmentsError },
    { data, error },
  ] = await Promise.all([
    db
      .from('client_workout_program_assignments')
      .select('program_id, started_at, ended_at')
      .eq('client_id', ctx.clientId)
      .lte('started_at', rangeEndIso)
      .or(`ended_at.is.null,ended_at.gte.${rangeStartIso}`)
      .order('started_at', { ascending: true }),
    db
      .from('client_session_logs')
      .select('id, logged_at, completed_at, client_set_logs(id, actual_reps, actual_weight_kg, completed, rir_actual, rpe)')
      .eq('client_id', ctx.clientId)
      .gte('logged_at', rangeStartIso)
      .lte('logged_at', rangeEndIso)
      .order('logged_at', { ascending: true }),
  ])

  if (error) {
    throw new Error(`Performance overlay query failed: ${error.message}`)
  }

  if (assignmentsError && !isMissingOptionalRelationError(assignmentsError)) {
    throw new Error(`Performance overlay query failed: ${assignmentsError?.message ?? error?.message}`)
  }

  const assignmentsAvailable = !assignmentsError
  const assignments = ((assignmentRows ?? []) as WorkoutAssignmentRow[])
    .filter((assignment) => overlapsAssignmentWindow(assignment, rangeStartIso, rangeEndIso))

  const daily = new Map<string, PerformanceBucket>()

  for (const log of (data ?? []) as Array<{
    logged_at: string
    completed_at: string | null
    client_set_logs?: Array<{
      actual_reps: number | null
      actual_weight_kg: number | null
      completed?: boolean
      rir_actual: number | null
      rpe: number | null
    }> | null
  }>) {
    if (!isMeaningfulSession(log as any)) continue

    const anchor = log.completed_at ?? log.logged_at
    if (
      assignmentsAvailable &&
      assignments.length > 0 &&
      !assignments.some((assignment) => isTimestampInsideAssignment(anchor, assignment))
    ) continue

    const date = String(anchor).split('T')[0]
    if (date < ctx.startDateKey || date > ctx.endDateKey) continue

    const bucket = daily.get(date) ?? initBucket()

    for (const set of (log.client_set_logs ?? [])) {
      if (!isEffectiveSet(set as any)) continue

      const reps = Number(set.actual_reps ?? 0)
      const weight = Number(set.actual_weight_kg ?? 0)
      const volume = reps * weight

      bucket.effectiveSets += 1
      if (set.completed) bucket.completedSets += 1
      bucket.volume += volume

      if (weight > 0) {
        bucket.loadSum += weight
        bucket.loadCount += 1
      }

      if (set.rir_actual != null) {
        bucket.rirSum += Number(set.rir_actual)
        bucket.rirCount += 1
      }

      const inferredRpe =
        set.rpe != null
          ? Number(set.rpe)
          : set.rir_actual != null
            ? Math.max(0, 10 - Number(set.rir_actual))
            : null

      if (inferredRpe != null) {
        bucket.rpeSum += inferredRpe
        bucket.rpeCount += 1
      }
    }

    daily.set(date, bucket)
  }

  const series: OverlaySeriesMap = {
    performance_avg_rir: [],
    performance_avg_rpe: [],
    performance_volume: [],
    performance_avg_load: [],
    performance_completion_rate: [],
  }

  for (const date of ctx.dateKeys) {
    const bucket = daily.get(date)
    if (!bucket || bucket.effectiveSets <= 0) continue

    if (bucket.rirCount > 0) {
      series.performance_avg_rir.push({
        date,
        value: Number((bucket.rirSum / bucket.rirCount).toFixed(2)),
      })
    }

    if (bucket.rpeCount > 0) {
      series.performance_avg_rpe.push({
        date,
        value: Number((bucket.rpeSum / bucket.rpeCount).toFixed(2)),
      })
    }

    series.performance_volume.push({
      date,
      value: Number(bucket.volume.toFixed(2)),
    })

    if (bucket.loadCount > 0) {
      series.performance_avg_load.push({
        date,
        value: Number((bucket.loadSum / bucket.loadCount).toFixed(2)),
      })
    }

    series.performance_completion_rate.push({
      date,
      value: Number(((bucket.completedSets / bucket.effectiveSets) * 100).toFixed(2)),
    })
  }

  return series
}
