import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import {
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

  const { data: client } = await service()
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const db = service()
  const timezone = await resolveClientTimezone(db, client.id)
  const now = new Date()
  const localDateKey = getLocalTimeParts(now, timezone).dateKey
  const { start: todayStart, end: todayEnd } = utcRangeForLocalDate(localDateKey, timezone)

  const [configRes, schedulesRes, responsesRes] = await Promise.all([
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
      .from('daily_checkin_responses')
      .select('moment, responded_at, is_late')
      .eq('client_id', client.id)
      .gte('responded_at', todayStart.toISOString())
      .lte('responded_at', todayEnd.toISOString()),
  ])

  const config = configRes.data
  if (!config) return NextResponse.json({ active: false, moments: [] })

  const jsDay = getLocalWeekday(now, timezone)
  const todayDay = jsDay === 0 ? 6 : jsDay - 1
  const isConfiguredToday = (config.days_of_week as number[]).includes(todayDay)

  const respondedMoments = new Set((responsesRes.data ?? []).map(r => r.moment))
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

  return NextResponse.json({
    active: isConfiguredToday,
    config_id: config.id,
    moments,
  })
}
