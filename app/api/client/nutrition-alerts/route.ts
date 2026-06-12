import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computeNutritionAlerts } from '@/lib/client/smart/nutritionAlerts'
import { computeMacroEnergy } from '@/lib/nutrition/energy'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { resolveProtocolDayByDate } from '@/lib/nutrition/protocol-schedule'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import { utcRangeForPhysiologicalDate } from '@/lib/client/checkin/timeWindows'

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

  const { data: cc } = await svc().from('coach_clients').select('id').eq('user_id', user.id).single()
  if (!cc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const timezone = await resolveClientTimezone(svc(), cc.id)
  const date = computePhysiologicalDate(new Date(), timezone)
  const { start: physiologicalStart, end: physiologicalEnd } = utcRangeForPhysiologicalDate(date, timezone)

  const { data: proto } = await svc()
    .from('nutrition_protocols')
    .select('schedule_start_date, nutrition_protocol_days(position, calories, protein_g, carbs_g, fat_g, hydration_ml, carb_cycle_type), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
    .eq('client_id', cc.id)
    .eq('status', 'shared')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const td = resolveProtocolDayByDate(
    date,
    (proto as any)?.schedule_start_date ?? null,
    (proto?.nutrition_protocol_days as any) ?? [],
    (proto?.nutrition_protocol_schedule_slots as any) ?? [],
  )
  const target = {
    kcal: Number(td?.calories ?? 0),
    protein_g: Number(td?.protein_g ?? 0),
    carbs_g: Number(td?.carbs_g ?? 0),
    fat_g: Number(td?.fat_g ?? 0),
    water_ml: Number(td?.hydration_ml ?? 2500),
  }

  const { data: meals } = await svc()
    .from('nutrition_meals')
    .select('meal_type, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g')
    .eq('client_id', cc.id)
    .eq('physiological_date', date)

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
    .select('amount_ml, caffeine_mg')
    .eq('client_id', cc.id)
    .gte('logged_at', physiologicalStart.toISOString())
    .lte('logged_at', physiologicalEnd.toISOString())

  const water_ml = (water ?? []).reduce((s, w) => s + Number(w.amount_ml ?? 0), 0)
  const caffeine_mg = (water ?? []).reduce((s, w) => s + Number(w.caffeine_mg ?? 0), 0)
  const hasLunchLog = (meals ?? []).some(m => m.meal_type === 'lunch')
  const currentHour = new Date().getHours()

  const alerts = computeNutritionAlerts({
    consumed: { ...consumed, water_ml, caffeine_mg },
    target,
    currentHour,
    hasLunchLog,
  })

  // Engine triggers — best-effort, never block daily alerts
  let engineTriggers: import('@/lib/nutrition/engine/types').TriggerRecommendation[] = []
  try {
    const { computeTriggers } = await import('@/lib/nutrition/engine/triggers')
    const { data: recentCheckins } = await svc()
      .from('client_daily_checkins')
      .select('flow_type, sleep_hours, energy_level, stress_level, hunger_level, muscle_soreness')
      .eq('client_id', cc.id)
      .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
    const morning = (recentCheckins ?? []).filter(r => r.flow_type === 'morning')
    const evening = (recentCheckins ?? []).filter(r => r.flow_type === 'evening')
    const avgOf = (arr: (number | null)[]): number | null => {
      const vals = arr.filter((v): v is number => v !== null)
      return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null
    }
    engineTriggers = computeTriggers({
      avgSleepH: avgOf(morning.map(r => r.sleep_hours !== null ? Number(r.sleep_hours) : null)),
      avgEnergyLevel: avgOf(morning.map(r => r.energy_level)),
      avgStressLevel: avgOf(morning.map(r => r.stress_level)),
      avgHungerLevel: avgOf(evening.map(r => r.hunger_level)),
      avgMuscleSoreness: avgOf(evening.map(r => r.muscle_soreness)),
      isLowCarbDay: (td as { carb_cycle_type?: string } | null)?.carb_cycle_type === 'low',
      rpeLastSession: null,
      performanceTrend: null,
    })
  } catch { /* never block daily alerts */ }

  return NextResponse.json({ alerts, triggers: engineTriggers })
}
