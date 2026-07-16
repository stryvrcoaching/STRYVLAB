import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computeMacroEnergy } from '@/lib/nutrition/energy'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { resolveProtocolDayByDate, resolveRestProtocolDay } from '@/lib/nutrition/protocol-schedule'
import { mergeCoachPlanPreps } from '@/lib/nutrition/client-planning'
import { utcRangeForPhysiologicalDate } from '@/lib/client/checkin/timeWindows'
import { fetchClientDayOverride } from '@/lib/client/day-kind'
import { assertClientAppEnabledForCoach, ClientAppAccessError } from '@/lib/billing/assertClientAppEnabled'
import { fetchActiveSmoothingPlanDaysForDates } from '@/lib/nutrition/smoothing/fetch'
import { applySmoothingOverlay } from '@/lib/nutrition/smoothing/apply-overlay'

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

  const db = svc()
  const { data: cc } = await db.from('coach_clients').select('id, timezone, coach_id').eq('user_id', user.id).single()
  if (!cc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const coachId = (cc as any).coach_id as string | null
    if (coachId) {
      await assertClientAppEnabledForCoach(db, coachId)
    }
  } catch (error) {
    if (error instanceof ClientAppAccessError) {
      return NextResponse.json({ error: 'L’espace client n’est pas activé pour ce suivi.' }, { status: 403 })
    }
    throw error
  }

  const url = new URL(req.url)
  const dateParam = url.searchParams.get('date')
  const date = dateParam ?? computePhysiologicalDate(new Date(), cc.timezone)
  const { start: physiologicalStart, end: physiologicalEnd } = utcRangeForPhysiologicalDate(date, cc.timezone ?? 'Europe/Paris')

  const { data: proto } = await db
    .from('nutrition_protocols')
    .select('id, schedule_start_date, nutrition_protocol_days(position, name, calories, protein_g, carbs_g, fat_g, hydration_ml, carb_cycle_type, meal_plan), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
    .eq('client_id', cc.id)
    .eq('status', 'shared')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const days = (proto?.nutrition_protocol_days as any) ?? []
  const slots = (proto?.nutrition_protocol_schedule_slots as any) ?? []
  const dayOverride = await fetchClientDayOverride(db, cc.id, date)
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
  const smoothingDays = await fetchActiveSmoothingPlanDaysForDates(db, cc.id, [date])
  const finalTarget = smoothingDays.length > 0 ? applySmoothingOverlay(target, smoothingDays).target : target

  const { data: meals } = await db
    .from('nutrition_meals')
    .select(`
      id, meal_type, meal_source, title, logged_at, physiological_date,
      total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g,
      photo_urls, notes,
      nutrition_entries (
        id, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, fiber_g,
        input_mode, confidence_score,
        food_items (id, name_fr, category_l1, category_l2, icon_key, item_key, kcal_per_100g)
      )
    `)
    .eq('client_id', cc.id)
    .eq('physiological_date', date)
    .neq('meal_type', 'drinks')
    .order('logged_at', { ascending: true })

  const { data: preps } = await db
    .from('client_nutrition_preps')
    .select('id, physiological_date, title, meal_type, meal_slot, variant_group_id, scenario_key, scenario_label, is_active, status, entries, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, consumed_meal_id, planned_for, created_at, updated_at, source_type, source_protocol_id, source_day_position, source_meal_id, source_snapshot')
    .eq('client_id', cc.id)
    .eq('physiological_date', date)
    .in('status', ['planned', 'logged'])
    .order('created_at', { ascending: false })

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

  const { data: water } = await db
    .from('client_water_logs')
    .select('amount_ml, caffeine_mg, logged_at')
    .eq('client_id', cc.id)
    .gte('logged_at', physiologicalStart.toISOString())
    .lte('logged_at', physiologicalEnd.toISOString())

  const water_ml = (water ?? []).reduce((s, w) => s + Number(w.amount_ml ?? 0), 0)
  const caffeine_mg = (water ?? []).reduce((s, w) => s + Number(w.caffeine_mg ?? 0), 0)

  return NextResponse.json({
    date,
    dayOverride,
    target: finalTarget,
    consumed: { ...consumed, water_ml, caffeine_mg },
    meals: (meals ?? []).map((meal: any) => ({
      ...meal,
      entries: meal.nutrition_entries ?? [],
      nutrition_entries: undefined,
    })),
    preps: mergeCoachPlanPreps({
      date,
      protocol: proto as any,
      protocolDay: td as any,
      persistedPreps: ((preps ?? []) as any[]).map((prep) => ({
        ...prep,
        meal_slot: prep.meal_slot ?? prep.meal_type ?? 'snack',
        variant_group_id: prep.variant_group_id ?? prep.meal_slot ?? prep.meal_type ?? 'snack',
        scenario_key: prep.scenario_key ?? 'default',
        scenario_label: prep.scenario_label ?? 'Planning',
        is_active: prep.is_active === true,
        entries: Array.isArray(prep.entries) ? prep.entries : [],
        total_calories: Number(prep.total_calories ?? 0),
        total_protein_g: Number(prep.total_protein_g ?? 0),
        total_carbs_g: Number(prep.total_carbs_g ?? 0),
        total_fat_g: Number(prep.total_fat_g ?? 0),
        total_fiber_g: Number(prep.total_fiber_g ?? 0),
      })),
      smoothingDay: smoothingDays[0] ?? null,
    }),
    water_logs: water ?? [],
  })
}
