import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computePhysiologicalDateInTimezone,
  utcRangeForPhysiologicalDate,
} from '@/lib/client/checkin/timeWindows'
import { computeMacroEnergy } from '@/lib/nutrition/energy'
import { resolveProtocolDayByDate } from '@/lib/nutrition/protocol-schedule'
import { isDateKeyInsideAssignment } from '@/lib/assignments/windows'
import type {
  OverlayBuilderContext,
  OverlaySeriesMap,
} from '@/lib/coach/metricsOverlay/types'

type NutritionDailyTotals = {
  protein_g: number
  carbs_g: number
  fat_g: number
  calories_kcal: number
  hydration_ml: number
}

type ProtocolDayRecord = {
  position: number
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  hydration_ml?: number | null
  name?: string | null
  carb_cycle_type?: string | null
}

type ScheduleSlotRecord = {
  week_index: number
  dow: number
  protocol_day_position: number
}

type NutritionAssignmentRow = {
  protocol_id: string
  started_at: string
  ended_at: string | null
}

type NutritionProtocolRecord = {
  id: string
  schedule_start_date: string | null
  nutrition_protocol_days?: ProtocolDayRecord[] | null
  nutrition_protocol_schedule_slots?: ScheduleSlotRecord[] | null
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

function initNutritionTotals(): NutritionDailyTotals {
  return {
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    calories_kcal: 0,
    hydration_ml: 0,
  }
}

export async function buildNutritionOverlaySeries(
  db: SupabaseClient,
  ctx: OverlayBuilderContext,
): Promise<OverlaySeriesMap> {
  const earliestRange = utcRangeForPhysiologicalDate(ctx.startDateKey, ctx.timezone)
  const latestRange = utcRangeForPhysiologicalDate(ctx.endDateKey, ctx.timezone)
  const todayDateKey = computePhysiologicalDateInTimezone(new Date(), ctx.timezone)

  const [
    { data: assignmentRows, error: assignmentError },
    { data: meals, error: mealsError },
    { data: waterLogs, error: waterError },
  ] = await Promise.all([
    db
      .from('client_nutrition_protocol_assignments')
      .select('protocol_id, started_at, ended_at')
      .eq('client_id', ctx.clientId)
      .lte('started_at', latestRange.end.toISOString())
      .or(`ended_at.is.null,ended_at.gte.${earliestRange.start.toISOString()}`)
      .order('started_at', { ascending: true }),
    db
      .from('nutrition_meals')
      .select('physiological_date, meal_type, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, total_calories')
      .eq('client_id', ctx.clientId)
      .neq('meal_type', 'drinks')
      .gte('physiological_date', ctx.startDateKey)
      .lte('physiological_date', ctx.endDateKey),
    db
      .from('client_water_logs')
      .select('amount_ml, logged_at')
      .eq('client_id', ctx.clientId)
      .gte('logged_at', earliestRange.start.toISOString())
      .lte('logged_at', latestRange.end.toISOString()),
  ])

  if (mealsError || waterError) {
    throw new Error(
      mealsError?.message ??
      waterError?.message ??
      'Nutrition overlay query failed',
    )
  }

  if (assignmentError && !isMissingOptionalRelationError(assignmentError)) {
    throw new Error(assignmentError.message ?? 'Nutrition overlay query failed')
  }

  const assignmentsAvailable = !assignmentError
  const assignments = (assignmentRows ?? []) as NutritionAssignmentRow[]
  const protocolIds = Array.from(new Set(assignments.map((assignment) => assignment.protocol_id)))
  const { data: protocols, error: protocolsError } = protocolIds.length > 0
    ? await db
        .from('nutrition_protocols')
        .select('id, schedule_start_date, nutrition_protocol_days(position, name, calories, protein_g, carbs_g, fat_g, hydration_ml, carb_cycle_type), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
        .in('id', protocolIds)
    : { data: [], error: null }

  if (protocolsError) {
    throw new Error(protocolsError.message)
  }

  const protocolsById = new Map<string, NutritionProtocolRecord>()
  for (const protocol of (protocols ?? []) as NutritionProtocolRecord[]) {
    protocolsById.set(protocol.id, protocol)
  }

  const mealsByDate = new Map<string, NutritionDailyTotals>()
  const mealDates = new Set<string>()

  for (const meal of (meals ?? []) as Array<{
    physiological_date: string
    total_protein_g: number | null
    total_carbs_g: number | null
    total_fat_g: number | null
    total_fiber_g: number | null
    total_calories: number | null
  }>) {
    const key = meal.physiological_date
    const current = mealsByDate.get(key) ?? initNutritionTotals()

    current.protein_g += Number(meal.total_protein_g ?? 0)
    current.carbs_g += Number(meal.total_carbs_g ?? 0)
    current.fat_g += Number(meal.total_fat_g ?? 0)
    current.calories_kcal += Number(
      meal.total_calories ?? computeMacroEnergy({
        protein_g: Number(meal.total_protein_g ?? 0),
        carbs_g: Number(meal.total_carbs_g ?? 0),
        fat_g: Number(meal.total_fat_g ?? 0),
        fiber_g: Number(meal.total_fiber_g ?? 0),
      }),
    )
    mealsByDate.set(key, current)
    mealDates.add(key)
  }

  const waterByDate = new Map<string, number>()
  for (const entry of (waterLogs ?? []) as Array<{ amount_ml: number | null; logged_at: string }>) {
    if (entry.amount_ml == null) continue
    const dateKey = computePhysiologicalDateInTimezone(new Date(entry.logged_at), ctx.timezone)
    waterByDate.set(dateKey, (waterByDate.get(dateKey) ?? 0) + Number(entry.amount_ml))
  }

  const series: OverlaySeriesMap = {
    protein_consumed_g: [],
    carbs_consumed_g: [],
    fat_consumed_g: [],
    calories_consumed_kcal: [],
    hydration_consumed_ml: [],
    protein_planned_g: [],
    carbs_planned_g: [],
    fat_planned_g: [],
    calories_planned_kcal: [],
    hydration_planned_ml: [],
  }

  const assignmentByDate = new Map<string, NutritionAssignmentRow>()
  for (const date of ctx.dateKeys) {
    const match = [...assignments].reverse().find((assignment) =>
      isDateKeyInsideAssignment(date, assignment, ctx.timezone, todayDateKey),
    )
    if (match) assignmentByDate.set(date, match)
  }

  for (const date of ctx.dateKeys) {
    // An absent log is unknown, not a zero intake. Keeping the point absent
    // prevents gaps in tracking from being read as a fasting day or from
    // distorting cross-domain correlations.
    const consumed = mealsByDate.get(date)
    if (consumed && mealDates.has(date)) {
      series.protein_consumed_g.push({ date, value: Number(consumed.protein_g.toFixed(2)) })
      series.carbs_consumed_g.push({ date, value: Number(consumed.carbs_g.toFixed(2)) })
      series.fat_consumed_g.push({ date, value: Number(consumed.fat_g.toFixed(2)) })
      series.calories_consumed_kcal.push({ date, value: Number(consumed.calories_kcal.toFixed(2)) })
    }

    if (waterByDate.has(date)) {
      series.hydration_consumed_ml.push({
        date,
        value: Number((waterByDate.get(date) ?? 0).toFixed(2)),
      })
    }

    const assignment = assignmentsAvailable ? assignmentByDate.get(date) : undefined
    const protocol = assignment ? protocolsById.get(assignment.protocol_id) : null
    const protocolDays = (protocol?.nutrition_protocol_days ?? []) as ProtocolDayRecord[]
    const scheduleSlots = (protocol?.nutrition_protocol_schedule_slots ?? []) as ScheduleSlotRecord[]
    const scheduleStartDate = protocol?.schedule_start_date
    const planned = resolveProtocolDayByDate(date, scheduleStartDate, protocolDays, scheduleSlots)
    if (!planned) continue

    if (planned.protein_g != null) series.protein_planned_g.push({ date, value: Number(planned.protein_g) })
    if (planned.carbs_g != null) series.carbs_planned_g.push({ date, value: Number(planned.carbs_g) })
    if (planned.fat_g != null) series.fat_planned_g.push({ date, value: Number(planned.fat_g) })
    if (planned.calories != null) series.calories_planned_kcal.push({ date, value: Number(planned.calories) })
    if (planned.hydration_ml != null) series.hydration_planned_ml.push({ date, value: Number(planned.hydration_ml) })
  }

  return series
}
