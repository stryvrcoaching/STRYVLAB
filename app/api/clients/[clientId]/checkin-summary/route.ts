import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function ownsClient(coachId: string, clientId: string) {
  const { data } = await service()
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', coachId)
    .single()
  return !!data
}

// GET /api/clients/[clientId]/checkin-summary?days=30
// Returns per-field averages, streak state, response rate
export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await ownsClient(user.id, params.clientId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const days = Math.min(parseInt(url.searchParams.get('days') ?? '30', 10), 90)
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const [responsesRes, streakRes, configRes] = await Promise.all([
    service()
      .from('client_daily_checkins')
      .select('date, flow_type, sleep_hours, sleep_quality, energy_level, stress_level, muscle_soreness, hunger_level')
      .eq('client_id', params.clientId)
      .gte('date', since.slice(0, 10))
      .order('date', { ascending: true }),
    service()
      .from('client_streaks')
      .select('*')
      .eq('client_id', params.clientId)
      .maybeSingle(),
    service()
      .from('daily_checkin_configs')
      .select('days_of_week, moments, is_active')
      .eq('client_id', params.clientId)
      .eq('coach_id', user.id)
      .maybeSingle(),
  ])

  if (responsesRes.error) return NextResponse.json({ error: responsesRes.error.message }, { status: 500 })

  const rows = (responsesRes.data ?? []) as any[]
  const responses = rows.map((r) => {
    const isMorning = r.flow_type === 'morning'
    const responsesObj: Record<string, number> = {}
    if (r.energy_level != null) responsesObj.energy = Number(r.energy_level)
    if (isMorning) {
      if (r.sleep_hours != null) responsesObj.sleep_duration = Number(r.sleep_hours)
      if (r.sleep_quality != null) responsesObj.sleep_quality = Number(r.sleep_quality)
    } else {
      if (r.stress_level != null) responsesObj.stress = Number(r.stress_level)
      if (r.hunger_level != null) responsesObj.hunger = Number(r.hunger_level)
      if (r.muscle_soreness != null) responsesObj.muscle_soreness = Number(r.muscle_soreness)
    }
    return {
      moment: isMorning ? 'morning' : 'evening',
      responses: responsesObj,
      responded_at: `${r.date}T12:00:00.000Z`,
      is_late: false,
    }
  })

  // Compute per-field averages across all responses
  const fieldSums: Record<string, { sum: number; count: number }> = {}
  for (const row of responses) {
    const data = row.responses as Record<string, number>
    for (const [field, value] of Object.entries(data)) {
      if (typeof value !== 'number') continue
      if (!fieldSums[field]) fieldSums[field] = { sum: 0, count: 0 }
      fieldSums[field].sum += value
      fieldSums[field].count += 1
    }
  }
  const fieldAverages: Record<string, number> = {}
  for (const [field, { sum, count }] of Object.entries(fieldSums)) {
    fieldAverages[field] = Math.round((sum / count) * 10) / 10
  }

  // Response rate: responses / configured days in range
  const config = configRes.data
  const daysOfWeek: number[] = config?.days_of_week ?? []
  let configuredDaysCount = 0
  if (daysOfWeek.length > 0) {
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 86400000)
      const jsDay = d.getDay()
      const day = jsDay === 0 ? 6 : jsDay - 1
      if (daysOfWeek.includes(day)) configuredDaysCount++
    }
  }

  // Group responses by date for heatmap
  const byDate: Record<string, { morning: boolean; evening: boolean; late: boolean }> = {}
  for (const r of responses) {
    const date = r.responded_at.split('T')[0]
    if (!byDate[date]) byDate[date] = { morning: false, evening: false, late: false }
    if (r.moment === 'morning') byDate[date].morning = true
    if (r.moment === 'evening') byDate[date].evening = true
    if (r.is_late) byDate[date].late = true
  }

  const uniqueDaysResponded = Object.keys(byDate).length
  const responseRate = configuredDaysCount > 0
    ? Math.round((uniqueDaysResponded / configuredDaysCount) * 100)
    : null

  return NextResponse.json({
    field_averages: fieldAverages,
    response_rate: responseRate,
    configured_days_count: configuredDaysCount,
    streak: streakRes.data ?? null,
    config: config ?? null,
    heatmap: byDate,
    responses_by_date: responses.reduce<Record<string, typeof responses>>((acc, r) => {
      const date = r.responded_at.split('T')[0]
      if (!acc[date]) acc[date] = []
      acc[date].push(r)
      return acc
    }, {}),
  })
}
