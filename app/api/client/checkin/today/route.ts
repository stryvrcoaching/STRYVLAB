import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import {
  computePhysiologicalDateInTimezone,
  getLocalTimeParts,
  getLocalWeekday,
  utcRangeForLocalDate,
} from '@/lib/client/checkin/timeWindows'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/client/checkin/today
// Returns config + today's responses + whether each moment is pending
export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  const client = await resolveClientFromUser(user.id, user.email, db, 'id, timezone')
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const timezone = String(client.timezone ?? '').trim() || await resolveClientTimezone(db, client.id)
  const now = new Date()
  const dateParam = _req.nextUrl.searchParams.get('date')
  const localDateKey = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : computePhysiologicalDateInTimezone(now, timezone)
  const { start: todayStart, end: todayEnd } = utcRangeForLocalDate(localDateKey, timezone)

  const [configRes, schedulesRes, responsesRes, healthSummaryRes] = await Promise.all([
    db
      .from('daily_checkin_configs')
      .select('id, is_active, days_of_week, moments')
      .eq('client_id', client.id)
      .eq('is_active', true)
      .maybeSingle(),
    db
      .from('daily_checkin_schedules')
      .select('moment, scheduled_time, timezone')
      .eq('client_id', client.id),
    db
      .from('client_daily_checkins')
      .select('flow_type')
      .eq('client_id', client.id)
      .eq('date', localDateKey),
    db
      .from('client_health_daily_summaries')
      .select('steps, sleep_minutes, resting_heart_rate, weight_kg')
      .eq('client_id', client.id)
      .eq('local_date', localDateKey)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const config = configRes.data
  if (!config) return NextResponse.json({ active: false, moments: [] })

  const jsDay = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? (() => {
        const [year, month, day] = dateParam.split('-').map(Number)
        const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
        return getLocalWeekday(d, timezone)
      })()
    : getLocalWeekday(now, timezone)
  const todayDay = jsDay === 0 ? 6 : jsDay - 1
  const isConfiguredToday = (config.days_of_week as number[]).includes(todayDay)

  const respondedMoments = new Set((responsesRes.data ?? []).map((r) => r.flow_type))
  const schedules = schedulesRes.data ?? []

  const moments = ((config.moments as { moment: string; fields: string[] }[]) ?? []).map(m => {
    const schedule = schedules.find(s => s.moment === m.moment)
    return {
      moment: m.moment,
      fields: m.fields,
      scheduled_time: schedule?.scheduled_time ?? null,
      timezone: schedule?.timezone ?? timezone,
      responded: respondedMoments.has(m.moment),
    }
  })

  // Compute prefilled steps for the day
  // 1. Activity logs
  const { data: activityLogs } = await db
    .from('client_activity_logs')
    .select('steps, duration_min, activity_type')
    .eq('client_id', client.id)
    .gte('started_at', todayStart.toISOString())
    .lte('started_at', todayEnd.toISOString())

  let activitySteps = 0
  for (const log of activityLogs ?? []) {
    if (log.steps != null) {
      activitySteps += log.steps
    } else if (log.activity_type === 'walking') {
      activitySteps += log.duration_min * 100 // standard estimate: 100 steps per minute
    }
  }

  // 2. Prescribed walking workouts
  const { data: sessionLogs } = await db
    .from('client_session_logs')
    .select('id')
    .eq('client_id', client.id)
    .eq('completed', true)
    .gte('completed_at', todayStart.toISOString())
    .lte('completed_at', todayEnd.toISOString())

  let workoutSteps = 0
  if (sessionLogs && sessionLogs.length > 0) {
    const sessionIds = sessionLogs.map(s => s.id)
    const { data: setLogs } = await db
      .from('client_set_logs')
      .select('exercise_name, actual_reps, completed')
      .in('session_log_id', sessionIds)
      .eq('completed', true)

    for (const set of setLogs ?? []) {
      const name = (set.exercise_name ?? '').toLowerCase()
      if (name.includes('marche') || name.includes('walk') || name.includes('tapis')) {
        const reps = set.actual_reps ?? 0
        if (reps > 0) {
          if (reps <= 180) {
            // Reps represents minutes
            workoutSteps += reps * 100
          } else {
            // Reps represents seconds
            workoutSteps += Math.round((reps / 60) * 100)
          }
        }
      }
    }
  }

  const prefills: Record<string, number> = {}
  const totalSteps = activitySteps + workoutSteps
  if (totalSteps > 0) {
    prefills.daily_steps = totalSteps
  }

  const healthSummary = healthSummaryRes.data
  if (healthSummary?.steps != null) prefills.daily_steps = Number(healthSummary.steps)
  if (healthSummary?.sleep_minutes != null) prefills.sleep_hours = Math.round((Number(healthSummary.sleep_minutes) / 60) * 10) / 10
  if (healthSummary?.resting_heart_rate != null) prefills.rhr_morning = Number(healthSummary.resting_heart_rate)
  if (healthSummary?.weight_kg != null) prefills.weight_kg = Number(healthSummary.weight_kg)

  return NextResponse.json({
    active: isConfiguredToday,
    config_id: config.id,
    moments,
    prefills,
  })
}
