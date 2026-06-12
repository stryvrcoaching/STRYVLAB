import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { utcRangeForPhysiologicalDate } from '@/lib/client/checkin/timeWindows'
import { resolveProtocolDayByDate, resolveRestProtocolDay } from '@/lib/nutrition/protocol-schedule'
import { shiftIsoDate } from '@/lib/utils/date'
import type { NutritionMacros } from '@/components/client/smart/SmartNutritionWidget'
import type { SmartNutritionPrep } from '@/components/client/smart/SmartNutritionPrepList'
import ComposeClientPage from './ComposeClientPage'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function clampComposeDate(candidate: string | null | undefined, todayIso: string): string {
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return todayIso
  const maxIso = shiftIsoDate(todayIso, 3)
  if (candidate < todayIso) return todayIso
  if (candidate > maxIso) return maxIso
  return candidate
}

export default async function ClientNutritionComposePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const client = await resolveClientFromUser(user.id, user.email, svc(), 'id, gender')
  if (!client) return null
  const clientRecord = client as { id: string; gender?: string | null }
  const clientId = clientRecord.id
  const timezone = await resolveClientTimezone(svc(), clientId)
  const todayDate = computePhysiologicalDate(new Date(), timezone)
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const rawDate = Array.isArray(resolvedSearchParams?.date) ? resolvedSearchParams.date[0] : resolvedSearchParams?.date
  const date = clampComposeDate(rawDate, todayDate)
  const { start, end } = utcRangeForPhysiologicalDate(date, timezone)

  const [protoResult, mealsResult, prepsResult, waterResult, weightResult, checkinWeightResult] = await Promise.allSettled([
    svc()
      .from('nutrition_protocols')
      .select('schedule_start_date, nutrition_protocol_days(position, calories, protein_g, carbs_g, fat_g, hydration_ml, carb_cycle_type), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
      .eq('client_id', clientId)
      .eq('status', 'shared')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    svc()
      .from('nutrition_meals')
      .select('total_calories, total_protein_g, total_carbs_g, total_fat_g')
      .eq('client_id', clientId)
      .eq('physiological_date', date),

    svc()
      .from('client_nutrition_preps')
      .select('id, physiological_date, title, meal_type, meal_slot, variant_group_id, scenario_key, scenario_label, is_active, status, entries, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, planned_for, created_at, updated_at')
      .eq('client_id', clientId)
      .eq('physiological_date', date)
      .eq('status', 'planned')
      .order('created_at', { ascending: false }),

    svc()
      .from('client_water_logs')
      .select('amount_ml, caffeine_mg')
      .eq('client_id', clientId)
      .gte('logged_at', start)
      .lt('logged_at', end),

    svc()
      .from('assessment_responses')
      .select('numeric_value')
      .eq('client_id', clientId)
      .eq('field_key', 'weight_kg')
      .not('numeric_value', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    svc()
      .from('client_daily_checkins')
      .select('weight_kg')
      .eq('client_id', clientId)
      .not('weight_kg', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const protoData = protoResult.status === 'fulfilled' ? protoResult.value.data : null
  const protocolDay = resolveProtocolDayByDate(
    date,
    (protoData as any)?.schedule_start_date ?? null,
    (protoData?.nutrition_protocol_days as any) ?? [],
    (protoData?.nutrition_protocol_schedule_slots as any) ?? [],
  ) ?? resolveRestProtocolDay(((protoData?.nutrition_protocol_days as any[]) ?? []))

  const target: NutritionMacros = {
    kcal: Number(protocolDay?.calories ?? 2000),
    protein_g: Number(protocolDay?.protein_g ?? 150),
    carbs_g: Number(protocolDay?.carbs_g ?? 200),
    fat_g: Number(protocolDay?.fat_g ?? 60),
    water_ml: Number(protocolDay?.hydration_ml ?? 2500),
  }

  const meals = mealsResult.status === 'fulfilled' ? (mealsResult.value.data ?? []) : []
  const rawPreps = prepsResult.status === 'fulfilled' ? (prepsResult.value.data ?? []) : []
  const waterEntries = waterResult.status === 'fulfilled' ? (waterResult.value.data ?? []) : []
  const bodyWeightRow = weightResult.status === 'fulfilled' ? weightResult.value.data : null
  const checkinWeightRow = checkinWeightResult.status === 'fulfilled' ? checkinWeightResult.value.data : null
  const bodyWeightKg = checkinWeightRow?.weight_kg != null
    ? Number(checkinWeightRow.weight_kg)
    : (bodyWeightRow?.numeric_value ? Number(bodyWeightRow.numeric_value) : null)

  const preps: SmartNutritionPrep[] = (rawPreps as any[]).map((prep) => ({
    ...prep,
    meal_slot: prep.meal_slot ?? prep.meal_type ?? 'snack',
    variant_group_id: prep.variant_group_id ?? prep.meal_slot ?? prep.meal_type ?? 'snack',
    scenario_key: prep.scenario_key ?? 'default',
    scenario_label: prep.scenario_label ?? "Scénario principal",
    is_active: prep.is_active === true,
    entries: Array.isArray(prep.entries) ? prep.entries : [],
    total_calories: Number(prep.total_calories ?? 0),
    total_protein_g: Number(prep.total_protein_g ?? 0),
    total_carbs_g: Number(prep.total_carbs_g ?? 0),
    total_fat_g: Number(prep.total_fat_g ?? 0),
    total_fiber_g: Number(prep.total_fiber_g ?? 0),
  }))

  const consumed: NutritionMacros = {
    kcal: meals.reduce((s, m) => s + Number(m.total_calories ?? 0), 0),
    protein_g: meals.reduce((s, m) => s + Number(m.total_protein_g ?? 0), 0),
    carbs_g: meals.reduce((s, m) => s + Number(m.total_carbs_g ?? 0), 0),
    fat_g: meals.reduce((s, m) => s + Number(m.total_fat_g ?? 0), 0),
    water_ml: waterEntries.reduce((s, w) => s + Number((w as any).amount_ml ?? 0), 0),
    caffeine_mg: waterEntries.reduce((s, w) => s + Number((w as any).caffeine_mg ?? 0), 0),
  }

  return (
    <ComposeClientPage
      consumed={consumed}
      target={target}
      date={date}
      todayDate={todayDate}
      initialPreps={preps}
      gender={clientRecord.gender ?? null}
      bodyWeightKg={bodyWeightKg}
    />
  )
}
