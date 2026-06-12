import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import { utcRangeForPhysiologicalDate } from '@/lib/client/checkin/timeWindows'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { computeNutritionAlerts } from '@/lib/client/smart/nutritionAlerts'
import type { NutritionMacros } from '@/components/client/smart/SmartNutritionWidget'
import type { NutritionMeal } from '@/lib/nutrition/food-items'
import type { SmartNutritionPrep } from '@/components/client/smart/SmartNutritionPrepList'
import type { GenericAlert } from '@/components/client/smart/SmartAlertsFeed'
import { type ClientLang } from '@/lib/i18n/clientTranslations'
import { computeMacroEnergy } from '@/lib/nutrition/energy'
import { resolveProtocolDayByDate, resolveRestProtocolDay } from '@/lib/nutrition/protocol-schedule'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'
import { detectCurrentPhase, getCycleSyncAdjustment } from '@/lib/nutrition/engine/cycleSync'
import type { CyclePhase, CycleSyncAdjustment } from '@/lib/nutrition/engine/cycleSync'
import { getCycleStateFromLogs } from '@/lib/cycle/cycleEngine'
import type { CycleState, CycleLog } from '@/lib/cycle/cycleEngine'
import NutritionClientPage from './NutritionClientPage'
import { fetchClientDayOverride } from '@/lib/client/day-kind'

type SearchParams = { date?: string }

function inferTrainingDay(protocolDay: Record<string, unknown> | null): boolean {
  if (!protocolDay) return false
  const name = String(protocolDay.name ?? '').toLowerCase()
  const cycle = String(protocolDay.carb_cycle_type ?? '').toLowerCase()
  return (
    name.includes('entraînement') ||
    name.includes('entrainement') ||
    name.includes('training') ||
    cycle.includes('high')
  )
}

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export default async function ClientNutritionPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const client = await resolveClientFromUser(user.id, user.email, svc(), 'id, gender')
  if (!client) return null
  const isFemale = (client as { gender?: string | null }).gender === 'female'
  const timezone = await resolveClientTimezone(svc(), client.id)

  const date = searchParams.date ?? computePhysiologicalDate(new Date(), timezone)
  const { start: physiologicalStart, end: physiologicalEnd } = utcRangeForPhysiologicalDate(date, timezone)
  const clientId = client.id

  // ── Parallel fetches (all direct Supabase, no loopback HTTP) ──────────────
  const [protoResult, mealsResult, prepsResult, waterResult, weightResult, checkinWeightResult, trendResult, streakResult, prefsResult, cycleResult, cycleLogsResult, dayOverrideResult] = await Promise.allSettled([
    svc()
      .from('nutrition_protocols')
      .select('cycle_sync_enabled, tdee_adaptive, tdee_data_source, schedule_start_date, nutrition_protocol_days(position, name, calories, protein_g, carbs_g, fat_g, hydration_ml, carb_cycle_type, cycle_sync_phase, recommendations), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
      .eq('client_id', clientId)
      .eq('status', 'shared')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Meals with full entries for the journal list
    svc()
      .from('nutrition_meals')
      .select(`
        id, meal_type, title, logged_at, physiological_date,
        total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g,
        photo_urls, notes,
        nutrition_entries (
          id, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, fiber_g,
          input_mode, confidence_score,
          food_items (id, name_fr, category_l1, item_key, kcal_per_100g)
        )
      `)
      .eq('client_id', clientId)
      .eq('physiological_date', date)
      .neq('meal_type', 'drinks')
      .order('logged_at', { ascending: true }),

    svc()
      .from('client_nutrition_preps')
      .select('id, physiological_date, title, meal_type, meal_slot, variant_group_id, scenario_key, scenario_label, is_active, status, entries, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, planned_for, created_at, updated_at')
      .eq('client_id', clientId)
      .eq('physiological_date', date)
      .eq('status', 'planned')
      .order('created_at', { ascending: false }),

    svc()
      .from('client_water_logs')
      .select('amount_ml, caffeine_mg, logged_at')
      .eq('client_id', clientId)
      .gte('logged_at', physiologicalStart.toISOString())
      .lte('logged_at', physiologicalEnd.toISOString()),

    // Latest body weight from assessments
    svc()
      .from('assessment_responses')
      .select('numeric_value')
      .eq('client_id', clientId)
      .eq('field_key', 'weight_kg')
      .not('numeric_value', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Latest body weight from client check-ins (preferred when available)
    svc()
      .from('client_daily_checkins')
      .select('weight_kg')
      .eq('client_id', clientId)
      .not('weight_kg', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Weekly trend: last 7 days — full macros for grid
    (async () => {
      const today = new Date()
      const days: string[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(today.getDate() - i)
        days.push(d.toISOString().slice(0, 10))
      }
      return svc()
        .from('nutrition_meals')
        .select('physiological_date, total_calories, total_protein_g, total_carbs_g, total_fat_g')
        .eq('client_id', clientId)
        .neq('meal_type', 'drinks')
        .in('physiological_date', days)
    })(),

    // 90-day logged dates for streak + calendar
    (async () => {
      const d90ago = new Date()
      d90ago.setDate(d90ago.getDate() - 89)
      const from90 = d90ago.toISOString().slice(0, 10)
      return svc()
        .from('nutrition_meals')
        .select('physiological_date')
        .eq('client_id', clientId)
        .neq('meal_type', 'drinks')
        .gte('physiological_date', from90)
        .order('physiological_date', { ascending: true })
    })(),

    // Client language preference
    svc()
      .from('client_preferences')
      .select('language')
      .eq('client_id', clientId)
      .maybeSingle(),

    // Last period date for cycle sync (female only)
    // assessment_responses has no client_id — join via assessment_submissions
    isFemale
      ? (async () => {
          const { data: subs } = await svc()
            .from('assessment_submissions')
            .select('id')
            .eq('client_id', clientId)
            .order('submitted_at', { ascending: false })
            .limit(3)
          const subIds = (subs ?? []).map((s: { id: string }) => s.id)
          if (subIds.length === 0) return { data: null, error: null }
          return svc()
            .from('assessment_responses')
            .select('value_text, numeric_value')
            .eq('field_key', 'menstrual_cycle')
            .in('submission_id', subIds)
            .not('value_text', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        })()
      : Promise.resolve({ data: null, error: null }),

    // Cycle logs for gold-standard engine (female only)
    isFemale
      ? svc()
          .from('menstrual_cycle_logs')
          .select('period_start_date, period_end_date, computed_cycle_length_days')
          .eq('client_id', clientId)
          .order('period_start_date', { ascending: false })
          .limit(7)
      : Promise.resolve({ data: null, error: null }),

    fetchClientDayOverride(svc(), clientId, date),
  ])

  // ── Body weight ───────────────────────────────────────────────────────────
  const bodyWeightRow = weightResult.status === 'fulfilled' ? weightResult.value.data : null
  const checkinWeightRow = checkinWeightResult.status === 'fulfilled' ? checkinWeightResult.value.data : null
  const bodyWeightKg = checkinWeightRow?.weight_kg != null
    ? Number(checkinWeightRow.weight_kg)
    : (bodyWeightRow?.numeric_value ? Number(bodyWeightRow.numeric_value) : null)

  // ── Protocol day ──────────────────────────────────────────────────────────
  const protoData = protoResult.status === 'fulfilled' ? protoResult.value.data : null
  const baseProtocolDay = resolveProtocolDayByDate(
    date,
    (protoData as any)?.schedule_start_date ?? null,
    (protoData?.nutrition_protocol_days as any) ?? [],
    (protoData?.nutrition_protocol_schedule_slots as any) ?? [],
  )
  const dayOverride = dayOverrideResult.status === 'fulfilled' ? dayOverrideResult.value : null
  const protocolDay = dayOverride?.kind === 'off'
    ? resolveRestProtocolDay(((protoData?.nutrition_protocol_days as any[]) ?? [])) ?? baseProtocolDay
    : baseProtocolDay
  const tdeeAdaptive = (protoData as any)?.tdee_adaptive ?? null
  const tdeeDataSource = (protoData as any)?.tdee_data_source ?? null
  const cycleSyncEnabled: boolean = (protoData as any)?.cycle_sync_enabled ?? false
  const protocolDays: Array<{ name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; carb_cycle_type?: string | null; recommendations?: string | null }> =
    ((protoData?.nutrition_protocol_days as any[]) ?? []).map((d: any) => ({
      name:            String(d.name ?? ''),
      kcal:            Number(d.calories ?? 0),
      protein_g:       Number(d.protein_g ?? 0),
      carbs_g:         Number(d.carbs_g ?? 0),
      fat_g:           Number(d.fat_g ?? 0),
      carb_cycle_type: d.carb_cycle_type ?? null,
      recommendations: d.recommendations ?? null,
    }))

  // Map schedule slots to day names for the protocol tab
  const rawSlots: any[] = (protoData?.nutrition_protocol_schedule_slots as any[]) ?? []
  const rawDays: any[]  = (protoData?.nutrition_protocol_days as any[]) ?? []
  const scheduleSlots: Array<{ dow: number; dayName: string; carbCycleType: string | null }> =
    rawSlots.map((slot: any) => {
      const day = rawDays.find((d: any) => d.position === slot.protocol_day_position)
      return {
        dow:           Number(slot.dow),
        dayName:       String(day?.name ?? ''),
        carbCycleType: day?.carb_cycle_type ?? null,
      }
    })

  const td = protocolDay
  let target: NutritionMacros = {
    kcal:      Number(td?.calories     ?? 0),
    protein_g: Number(td?.protein_g    ?? 0),
    carbs_g:   Number(td?.carbs_g      ?? 0),
    fat_g:     Number(td?.fat_g        ?? 0),
    water_ml:  Number(td?.hydration_ml ?? 2500),
  }

  // ── Consumed today ────────────────────────────────────────────────────────
  const rawMeals = mealsResult.status === 'fulfilled' ? (mealsResult.value.data ?? []) : []
  const meals: NutritionMeal[] = rawMeals.map((m: any) => ({
    ...m,
    total_calories: computeMacroEnergy({
      protein_g: Number(m.total_protein_g ?? 0),
      carbs_g: Number(m.total_carbs_g ?? 0),
      fat_g: Number(m.total_fat_g ?? 0),
      fiber_g: Number(m.total_fiber_g ?? 0),
    }),
    entries: m.nutrition_entries ?? [],
    nutrition_entries: undefined,
  }))
  const water = waterResult.status === 'fulfilled' ? (waterResult.value.data ?? []) : []
  const preps: SmartNutritionPrep[] = prepsResult.status === 'fulfilled'
    ? ((prepsResult.value.data ?? []) as any[]).map((prep) => ({
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
    : []

  const consumedBase = meals.reduce(
    (acc, m) => ({
      kcal:      acc.kcal      + Number(m.total_calories  ?? 0),
      protein_g: acc.protein_g + Number(m.total_protein_g ?? 0),
      carbs_g:   acc.carbs_g   + Number(m.total_carbs_g   ?? 0),
      fat_g:     acc.fat_g     + Number(m.total_fat_g     ?? 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )
  const water_ml = water.reduce((s, w) => s + Number(w.amount_ml ?? 0), 0)
  const caffeine_mg = water.reduce((s, w) => s + Number(w.caffeine_mg ?? 0), 0)
  const consumed: NutritionMacros = { ...consumedBase, water_ml, caffeine_mg }

  // ── IA alerts (pure fn, no HTTP) ──────────────────────────────────────────
  const hasLunchLog = meals.some(m => m.meal_type === 'lunch')
  const rawAlerts = computeNutritionAlerts({
    consumed: { ...consumedBase, water_ml, caffeine_mg },
    target,
    currentHour: new Date().getHours(),
    hasLunchLog,
  })
  const alerts: GenericAlert[] = rawAlerts.map(a => ({
    code: a.code,
    severity: a.severity,
    title: a.title,
    body: a.body,
  }))

  // ── Weekly trend ──────────────────────────────────────────────────────────
  const today = new Date()
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  const trendMeals = trendResult.status === 'fulfilled' ? (trendResult.value.data ?? []) : []
  type DayTotals = { kcal: number; protein_g: number; carbs_g: number; fat_g: number }
  const trendTotals: Record<string, DayTotals> = {}
  for (const d of days) trendTotals[d] = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  for (const m of trendMeals) {
    const key = (m as any).physiological_date as string
    if (!trendTotals[key]) continue
    trendTotals[key].kcal      += computeMacroEnergy({
      protein_g: Number((m as any).total_protein_g ?? 0),
      carbs_g: Number((m as any).total_carbs_g ?? 0),
      fat_g: Number((m as any).total_fat_g ?? 0),
    })
    trendTotals[key].protein_g += Number((m as any).total_protein_g ?? 0)
    trendTotals[key].carbs_g   += Number((m as any).total_carbs_g   ?? 0)
    trendTotals[key].fat_g     += Number((m as any).total_fat_g     ?? 0)
  }
  const trend = days.map(d => ({
    date:      d,
    consumed:  trendTotals[d].kcal,
    protein_g: trendTotals[d].protein_g,
    carbs_g:   trendTotals[d].carbs_g,
    fat_g:     trendTotals[d].fat_g,
    target:    target.kcal,
    targetProtein: target.protein_g,
    targetCarbs:   target.carbs_g,
    targetFat:     target.fat_g,
  }))

  // ── Streak / logged dates ─────────────────────────────────────────────────
  const streakMeals = streakResult.status === 'fulfilled' ? (streakResult.value.data ?? []) : []
  const loggedDatesSet = new Set<string>(
    streakMeals.map((m: any) => m.physiological_date as string)
  )

  // ── Language ──────────────────────────────────────────────────────────────
  const rawLang = prefsResult.status === 'fulfilled' ? (prefsResult.value as any)?.data?.language : null
  const lang: ClientLang = ['fr', 'en', 'es'].includes(rawLang) ? (rawLang as ClientLang) : 'fr'

  // ── Cycle Sync (female only) ──────────────────────────────────────────────
  let cycleSyncPhase: CyclePhase | null = null
  let cycleSyncAdjustment: CycleSyncAdjustment | null = null
  let cycleDay: number | null = null

  if (isFemale) {
    const cycleRow = cycleResult.status === 'fulfilled' ? (cycleResult.value as any)?.data : null
    if (cycleRow) {
      // value_text may be ISO date (last period) or numeric day string
      const raw = cycleRow.value_text ?? null
      const numericDay = cycleRow.numeric_value ? Number(cycleRow.numeric_value) : null

      if (numericDay && numericDay >= 1) {
        cycleDay = numericDay
      } else if (raw && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
        // Compute cycle day from last period date
        const lastPeriod = new Date(raw)
        const todayDate = new Date(date)
        const diffMs = todayDate.getTime() - lastPeriod.getTime()
        const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
        cycleDay = diffDays >= 0 ? (diffDays % 28) + 1 : null
      }
    }
    if (cycleDay !== null) {
      cycleSyncPhase = detectCurrentPhase(cycleDay)
      cycleSyncAdjustment = getCycleSyncAdjustment(cycleSyncPhase)
    }
  }

  // ── CycleState v2 (gold-standard engine) ─────────────────────────────────
  let cycleState: CycleState | null = null
  if (isFemale) {
    const rawCycleLogs = cycleLogsResult.status === 'fulfilled' ? ((cycleLogsResult.value as any)?.data ?? []) : []
    const cycleLogs: CycleLog[] = rawCycleLogs
    const bilanRow = cycleResult.status === 'fulfilled' ? (cycleResult.value as any)?.data : null
    const bilanValue: string | null = bilanRow?.value_text ?? null
    cycleState = getCycleStateFromLogs(cycleLogs, bilanValue)
  }

  // Runtime cycle sync adjustment — applied only when coach enabled it and client has active phase
  if (cycleSyncEnabled && cycleState?.currentPhase) {
    const adj = getCycleSyncAdjustment(cycleState.currentPhase)
    target = {
      kcal:      Math.max(0, target.kcal      + adj.caloriesDelta),
      protein_g: Math.max(0, target.protein_g + adj.proteinDelta),
      carbs_g:   Math.max(0, target.carbs_g   + adj.carbsDelta),
      fat_g:     Math.max(0, target.fat_g     + adj.fatDelta),
      water_ml:  Math.max(0, target.water_ml  + adj.hydrationDeltaMl),
    }
  }

  // Day type badge for TopBar
  const isTrainingDay = dayOverride?.kind === 'off'
    ? false
    : inferTrainingDay((protocolDay as Record<string, unknown>) ?? null)
  const dayTypeLabel = String((protocolDay as Record<string, unknown> | null)?.name ?? 'Repos')
  const dayTypeBadge = (
    <span
      className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] px-2 py-1 rounded-lg"
      style={{
        background: isTrainingDay ? NUTRITION_UI_COLORS.trainingDayBg : NUTRITION_UI_COLORS.restDayBg,
        color: isTrainingDay ? NUTRITION_UI_COLORS.trainingDay : NUTRITION_UI_COLORS.restDay,
        border: `0.5px solid ${isTrainingDay ? NUTRITION_UI_COLORS.trainingDayBorder : NUTRITION_UI_COLORS.restDayBorder}`,
      }}
    >
      {dayTypeLabel}
    </span>
  )

  return (
    <NutritionClientPage
      date={date}
      target={target}
      consumed={consumed}
      meals={meals}
      preps={preps}
      alerts={alerts}
      trend={trend}
      loggedDates={loggedDatesSet}
      tdeeAdaptive={tdeeAdaptive}
      tdeeDataSource={tdeeDataSource}
      bodyWeightKg={bodyWeightKg}
      gender={(client as { gender?: string | null }).gender ?? null}
      protocolDay={protocolDay}
      lang={lang}
      dayTypeBadge={dayTypeBadge}
      cycleSyncPhase={cycleSyncPhase}
      cycleSyncAdjustment={cycleSyncAdjustment}
      cycleDay={cycleDay}
      cycleState={cycleState}
      protocolDays={protocolDays}
      scheduleSlots={scheduleSlots}
      cycleSyncEnabled={cycleSyncEnabled}
    />
  )
}
