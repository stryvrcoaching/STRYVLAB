import { addDaysToDateKey, computePhysiologicalDateInTimezone } from '@/lib/client/checkin/timeWindows'
import { OVERLAY_GROUPS } from '@/lib/coach/metricsOverlay/groups'
import { buildOverlayMetadata } from '@/lib/coach/metricsOverlay/seriesRegistry'
import { buildBodyOverlaySeries } from '@/lib/coach/metricsOverlay/builders/body'
import { buildRecoveryOverlaySeries } from '@/lib/coach/metricsOverlay/builders/recovery'
import { buildNutritionOverlaySeries } from '@/lib/coach/metricsOverlay/builders/nutrition'
import { buildPerformanceOverlaySeries } from '@/lib/coach/metricsOverlay/builders/performance'
import type {
  OverlayBuilderContext,
  OverlayResponse,
  OverlaySeriesMap,
} from '@/lib/coach/metricsOverlay/types'
import type { SupabaseClient } from '@supabase/supabase-js'

function mergeSeriesMaps(...maps: OverlaySeriesMap[]): OverlaySeriesMap {
  const result: OverlaySeriesMap = {}

  for (const map of maps) {
    for (const [key, points] of Object.entries(map)) {
      result[key] = points
    }
  }

  return result
}

export function buildOverlayDateKeys(timezone: string, windowDays: number) {
  const endDateKey = computePhysiologicalDateInTimezone(new Date(), timezone)
  const startDateKey = addDaysToDateKey(endDateKey, -(windowDays - 1))
  const dateKeys = Array.from({ length: windowDays }, (_, index) =>
    addDaysToDateKey(startDateKey, index),
  )

  return { startDateKey, endDateKey, dateKeys }
}

export async function buildMetricsOverlayResponse(
  db: SupabaseClient,
  ctx: OverlayBuilderContext,
  windowDays: number,
): Promise<OverlayResponse> {
  const [bodySeries, recoverySeries, nutritionSeries, performanceSeries] = await Promise.all([
    buildBodyOverlaySeries(db, ctx),
    buildRecoveryOverlaySeries(db, ctx),
    buildNutritionOverlaySeries(db, ctx),
    buildPerformanceOverlaySeries(db, ctx),
  ])

  return {
    series: mergeSeriesMaps(bodySeries, recoverySeries, nutritionSeries, performanceSeries),
    groups: OVERLAY_GROUPS,
    metadata: buildOverlayMetadata(),
    windowDays,
    startDate: ctx.startDateKey,
    endDate: ctx.endDateKey,
  }
}
