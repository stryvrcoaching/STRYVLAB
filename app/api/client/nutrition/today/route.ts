import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computeMacroEnergy } from '@/lib/nutrition/energy'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { resolveProtocolDayByDate, resolveRestProtocolDay } from '@/lib/nutrition/protocol-schedule'
import { utcRangeForPhysiologicalDate } from '@/lib/client/checkin/timeWindows'
import { fetchClientDayOverride } from '@/lib/client/day-kind'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cc } = await svc().from('coach_clients').select('id, timezone').eq('user_id', user.id).single()
  if (!cc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const dateParam = url.searchParams.get('date')
  const date = dateParam ?? computePhysiologicalDate(new Date(), cc.timezone)
  const { start: physiologicalStart, end: physiologicalEnd } = utcRangeForPhysiologicalDate(date, cc.timezone ?? 'Europe/Paris')

  const { data: proto } = await svc()
    .from('nutrition_protocols')
    .select('schedule_start_date, nutrition_protocol_days(position, calories, protein_g, carbs_g, fat_g, hydration_ml), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
    .eq('client_id', cc.id)
    .eq('status', 'shared')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const days = (proto?.nutrition_protocol_days as any) ?? []
  const slots = (proto?.nutrition_protocol_schedule_slots as any) ?? []
  const dayOverride = await fetchClientDayOverride(svc(), cc.id, date)
  const baseProtocolDay = resolveProtocolDayByDate(
    date,
    (proto as any)?.schedule_start_date ?? null,
    days,
    slots,
  )
  const td = dayOverride?.kind === 'off'
    ? resolveRestProtocolDay(days) ?? baseProtocolDay
    : baseProtocolDay
  const target = {
    kcal: Number(td?.calories ?? 0),
    protein_g: Number(td?.protein_g ?? 0),
    carbs_g: Number(td?.carbs_g ?? 0),
    fat_g: Number(td?.fat_g ?? 0),
    water_ml: Number(td?.hydration_ml ?? 2500),
  }

  const { data: meals } = await svc()
    .from('nutrition_meals')
    .select('id, meal_type, title, logged_at, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g')
    .eq('client_id', cc.id)
    .eq('physiological_date', date)
    .order('logged_at', { ascending: true })

  const consumed = (meals ?? []).reduce(
    (acc, m) => ({
      kcal: acc.kcal + computeMacroEnergy({
        protein_g: Number(m.total_protein_g ?? 0),
        carbs_g: Number(m.total_carbs_g ?? 0),
        fat_g: Number(m.total_fat_g ?? 0),
        fiber_g: Number(m.total_fiber_g ?? 0),
      }),
      protein_g: acc.protein_g + Number(m.total_protein_g ?? 0),
      carbs_g: acc.carbs_g + Number(m.total_carbs_g ?? 0),
      fat_g: acc.fat_g + Number(m.total_fat_g ?? 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )

  const { data: water } = await svc()
    .from('client_water_logs')
    .select('amount_ml, logged_at')
    .eq('client_id', cc.id)
    .gte('logged_at', physiologicalStart.toISOString())
    .lte('logged_at', physiologicalEnd.toISOString())

  const water_ml = (water ?? []).reduce((s, w) => s + Number(w.amount_ml ?? 0), 0)

  return NextResponse.json({
    date,
    dayOverride,
    target,
    consumed: { ...consumed, water_ml },
    meals: meals ?? [],
    water_logs: water ?? [],
  })
}
