import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computeTriggers } from '@/lib/nutrition/engine/triggers'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import { resolveProtocolDayByDate } from '@/lib/nutrition/protocol-schedule'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()
  const { data: cc } = await db
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!cc) return NextResponse.json({ triggers: [] })

  const timezone = await resolveClientTimezone(db, cc.id)
  const today = computePhysiologicalDate(new Date(), timezone)
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const startDate = sevenDaysAgo.toISOString().slice(0, 10)

  const [{ data: checkins }, { data: proto }, { data: sessionLogs }] = await Promise.all([
    db
      .from('client_daily_checkins')
      .select('flow_type, sleep_hours, energy_level, stress_level, hunger_level, muscle_soreness')
      .eq('client_id', cc.id)
      .gte('date', startDate),
    db
      .from('nutrition_protocols')
      .select(
        'schedule_start_date, nutrition_protocol_days(position, carb_cycle_type), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)',
      )
      .eq('client_id', cc.id)
      .eq('status', 'shared')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('client_session_logs')
      .select('rpe')
      .eq('client_id', cc.id)
      .gte('completed_at', `${startDate}T00:00:00Z`)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(5),
  ])

  const morningRows = (checkins ?? []).filter(r => r.flow_type === 'morning')
  const eveningRows = (checkins ?? []).filter(r => r.flow_type === 'evening')

  const avg = (arr: (number | null)[]): number | null => {
    const vals = arr.filter((v): v is number => v !== null)
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null
  }

  const avgSleepH = avg(
    morningRows.map(r => (r.sleep_hours !== null ? Number(r.sleep_hours) : null)),
  )
  const avgEnergyLevel = avg(morningRows.map(r => r.energy_level))
  const avgStressLevel = avg(morningRows.map(r => r.stress_level))
  const avgHungerLevel = avg(eveningRows.map(r => r.hunger_level))
  const avgMuscleSoreness = avg(eveningRows.map(r => r.muscle_soreness))

  // Determine if today is a low-carb day from the active protocol
  const todayProtocolDay = proto
    ? resolveProtocolDayByDate(
        today,
        (proto as { schedule_start_date?: string | null }).schedule_start_date ?? null,
        ((proto as { nutrition_protocol_days?: { position: number; carb_cycle_type?: string | null }[] }).nutrition_protocol_days ?? []),
        ((proto as { nutrition_protocol_schedule_slots?: { week_index: number; dow: number; protocol_day_position: number }[] }).nutrition_protocol_schedule_slots ?? []),
      )
    : null
  const isLowCarbDay = todayProtocolDay?.carb_cycle_type === 'low'

  const rpeLastSession = sessionLogs?.[0]?.rpe ? Number(sessionLogs[0].rpe) : null

  const recentRpe = avg(
    (sessionLogs ?? []).slice(0, 2).map(s => (s.rpe ? Number(s.rpe) : null)),
  )
  const olderRpe = avg(
    (sessionLogs ?? []).slice(2).map(s => (s.rpe ? Number(s.rpe) : null)),
  )
  const performanceTrend: 'improving' | 'stable' | 'declining' | null =
    recentRpe !== null && olderRpe !== null
      ? recentRpe > olderRpe + 1
        ? 'declining'
        : recentRpe < olderRpe - 1
          ? 'improving'
          : 'stable'
      : null

  const triggers = computeTriggers({
    avgSleepH,
    avgEnergyLevel,
    avgStressLevel,
    avgHungerLevel,
    avgMuscleSoreness,
    isLowCarbDay,
    rpeLastSession,
    performanceTrend,
  })

  return NextResponse.json({ triggers })
}
