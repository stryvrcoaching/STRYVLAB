import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  OverlayBuilderContext,
  OverlaySeriesMap,
} from '@/lib/coach/metricsOverlay/types'

type CheckinAggregate = {
  sum: number
  count: number
}

type DailyBucket = {
  sleep_duration_h: CheckinAggregate
  energy_level: CheckinAggregate
  stress_level: CheckinAggregate
  muscle_soreness: CheckinAggregate
}

function initAggregate(): CheckinAggregate {
  return { sum: 0, count: 0 }
}

function initBucket(): DailyBucket {
  return {
    sleep_duration_h: initAggregate(),
    energy_level: initAggregate(),
    stress_level: initAggregate(),
    muscle_soreness: initAggregate(),
  }
}

function addValue(target: CheckinAggregate, value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return
  target.sum += Number(value)
  target.count += 1
}

export async function buildRecoveryOverlaySeries(
  db: SupabaseClient,
  ctx: OverlayBuilderContext,
): Promise<OverlaySeriesMap> {
  const { data, error } = await db
    .from('client_daily_checkins')
    .select('date, sleep_hours, energy_level, stress_level, muscle_soreness')
    .eq('client_id', ctx.clientId)
    .gte('date', ctx.startDateKey)
    .lte('date', ctx.endDateKey)
    .order('date', { ascending: true })

  if (error) {
    throw new Error(`Recovery overlay query failed: ${error.message}`)
  }

  const daily = new Map<string, DailyBucket>()

  for (const row of (data ?? []) as Array<{
    date: string
    sleep_hours: number | null
    energy_level: number | null
    stress_level: number | null
    muscle_soreness: number | null
  }>) {
    const key = row.date
    const bucket = daily.get(key) ?? initBucket()
    addValue(bucket.sleep_duration_h, row.sleep_hours)
    addValue(bucket.energy_level, row.energy_level)
    addValue(bucket.stress_level, row.stress_level)
    addValue(bucket.muscle_soreness, row.muscle_soreness)
    daily.set(key, bucket)
  }

  const series: OverlaySeriesMap = {
    sleep_duration_h: [],
    energy_level: [],
    stress_level: [],
    muscle_soreness: [],
  }

  for (const date of ctx.dateKeys) {
    const bucket = daily.get(date)
    if (!bucket) continue

    for (const key of Object.keys(series) as Array<keyof DailyBucket>) {
      const aggregate = bucket[key]
      if (aggregate.count <= 0) continue
      series[key].push({
        date,
        value: Number((aggregate.sum / aggregate.count).toFixed(2)),
      })
    }
  }

  return series
}
