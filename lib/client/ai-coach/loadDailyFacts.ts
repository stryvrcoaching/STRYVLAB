import type { SupabaseClient } from '@supabase/supabase-js'
import { computeDailyFacts, computeDayKind, type DailyFacts, type CheckinSignals } from '@/lib/client/ai-coach/dailyFacts'
import { resolveTone, type Tone } from '@/lib/client/ai-coach/resolveTone'
import type { Freedom, AdviceTrend } from '@/lib/client/ai-coach/adviceRules'
import { resolveProtocolDayByDate, resolveRestProtocolDay } from '@/lib/nutrition/protocol-schedule'
import { fetchClientDayOverride } from '@/lib/client/day-kind'
import { utcRangeForPhysiologicalDate, addDaysToDateKey, getLocalWeekday } from '@/lib/client/checkin/timeWindows'
import { filterSessionsForJsWeekday } from '@/lib/client/plannedSessions'

const OVER_KCAL = 200
const PROTEIN_SHORT_RATIO = 0.8

export type DailyCoachContext = {
  facts: DailyFacts
  trend: AdviceTrend
  tone: Tone
  freedom: Freedom
  enabledMorningFields: string[]
  coachId: string | null
}

/**
 * Single loader: assembles the deterministic DailyFacts + trend + tone + freedom for a client/day.
 * Pure cores (computeDailyFacts/computeDayKind) do the logic; this only fetches.
 */
export async function loadDailyCoachContext(
  db: SupabaseClient,
  clientId: string,
  date: string,
  timezone: string,
  submittedCheckin?: CheckinSignals,
  steps?: number | null,
): Promise<DailyCoachContext> {
  const { start, end } = utcRangeForPhysiologicalDate(date, timezone)
  const dayDate = new Date(`${date}T12:00:00.000Z`)
  const weekday = getLocalWeekday(dayDate, timezone)
  const threeDaysAgo = addDaysToDateKey(date, -3)
  const yesterday = addDaysToDateKey(date, -1)

  const [
    { data: composerMeals },
    { data: legacyMeals },
    { data: waterRows },
    { data: protocol },
    { data: plannedSessions },
    { data: completedSessions },
    { data: skips },
    { data: trendMeals },
    { data: perClientAi },
    { data: cfgRow },
  ] = await Promise.all([
    db.from('nutrition_meals').select('total_calories, total_protein_g').eq('client_id', clientId).eq('physiological_date', date),
    db.from('meal_logs').select('estimated_macros').eq('client_id', clientId).gte('logged_at', start.toISOString()).lt('logged_at', new Date(end.getTime() + 1).toISOString()).eq('ai_status', 'done'),
    db.from('client_water_logs').select('amount_ml').eq('client_id', clientId).gte('logged_at', start.toISOString()).lte('logged_at', end.toISOString()),
    db.from('nutrition_protocols').select('schedule_start_date, nutrition_protocol_days(position, calories, protein_g, hydration_ml, name, carb_cycle_type), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)').eq('client_id', clientId).eq('status', 'shared').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('program_sessions').select('id, name, day_of_week, days_of_week, programs!inner(status, client_id)').eq('programs.client_id', clientId).eq('programs.status', 'active'),
    db.from('client_session_logs').select('id').eq('client_id', clientId).not('completed_at', 'is', null).gte('completed_at', start.toISOString()).lte('completed_at', end.toISOString()).limit(1),
    db.from('client_workout_skips').select('program_session_id').eq('client_id', clientId).eq('scheduled_date', date),
    db.from('nutrition_meals').select('physiological_date, total_calories, total_protein_g').eq('client_id', clientId).gte('physiological_date', threeDaysAgo).lte('physiological_date', yesterday),
    db.from('coach_ai_settings_per_client').select('ai_tone, coach_id, coaching_freedom').eq('client_id', clientId).maybeSingle(),
    db.from('daily_checkin_configs').select('moments').eq('client_id', clientId).maybeSingle(),
  ])

  // Global tone needs coach_id (from per-client settings row)
  const coachId = (perClientAi as { coach_id?: string } | null)?.coach_id ?? null
  const { data: coachProfile } = coachId
    ? await db.from('coach_profiles').select('ai_tone').eq('coach_id', coachId).maybeSingle()
    : { data: null }

  // ── Nutrition ───────────────────────────────────────────────────────────────
  const kcalLogged =
    (composerMeals ?? []).reduce((s: number, m: any) => s + Number(m.total_calories ?? 0), 0) +
    (legacyMeals ?? []).reduce((s: number, m: any) => s + Number((m.estimated_macros as any)?.calories_kcal ?? 0), 0)
  const proteinLogged =
    (composerMeals ?? []).reduce((s: number, m: any) => s + Number(m.total_protein_g ?? 0), 0) +
    (legacyMeals ?? []).reduce((s: number, m: any) => s + Number((m.estimated_macros as any)?.protein_g ?? 0), 0)
  const hydrationMl = (waterRows ?? []).reduce((s: number, w: any) => s + Number(w.amount_ml ?? 0), 0)

  // ── Day kind / session ────────────────────────────────────────────────────────
  const dayOverride = await fetchClientDayOverride(db, clientId, date)
  const protocolDays = (protocol as any)?.nutrition_protocol_days ?? []
  const rawProtocolDay = resolveProtocolDayByDate(
    date,
    (protocol as any)?.schedule_start_date ?? null,
    protocolDays,
    (protocol as any)?.nutrition_protocol_schedule_slots ?? [],
  ) as any
  const isOff = dayOverride?.kind === 'off'
  const protocolDay = isOff ? (resolveRestProtocolDay(protocolDays) ?? rawProtocolDay) : rawProtocolDay

  const kcalTarget = Number(protocolDay?.calories ?? 0)
  const proteinTarget = Number(protocolDay?.protein_g ?? 0)
  const hydrationTargetMl = Number(protocolDay?.hydration_ml ?? 2500)

  const plannedList = filterSessionsForJsWeekday(
    (plannedSessions ?? []) as Array<{ id: string; name?: string | null; day_of_week?: number | null; days_of_week?: number[] | null }>,
    weekday,
  )
  const plannedSessionName = plannedList[0]?.name ?? null
  const completed = ((completedSessions ?? []) as any[]).length > 0
  const skipped = ((skips ?? []) as any[]).length > 0
  const { dayKind, sessionStatus } = computeDayKind({
    plannedSessionName,
    completed,
    skipped,
    overrideOff: isOff,
  })

  // ── Trend (3 days) ────────────────────────────────────────────────────────────
  const byDay = new Map<string, { kcal: number; protein: number }>()
  for (const m of (trendMeals ?? []) as any[]) {
    const d = m.physiological_date as string
    const cur = byDay.get(d) ?? { kcal: 0, protein: 0 }
    cur.kcal += Number(m.total_calories ?? 0)
    cur.protein += Number(m.total_protein_g ?? 0)
    byDay.set(d, cur)
  }
  let kcalOverDays = 0
  let proteinShortDays = 0
  for (const { kcal, protein } of Array.from(byDay.values())) {
    if (kcalTarget > 0 && kcal - kcalTarget > OVER_KCAL) kcalOverDays++
    if (proteinTarget > 0 && protein < proteinTarget * PROTEIN_SHORT_RATIO) proteinShortDays++
  }

  // ── Tone / fields ──────────────────────────────────────────────────────────────
  const tone = resolveTone(
    (perClientAi as { ai_tone?: string | null } | null)?.ai_tone ?? null,
    (coachProfile as { ai_tone?: string | null } | null)?.ai_tone ?? null,
  )
  const cfgMoments = ((cfgRow as { moments?: Array<{ moment?: string; fields?: string[] }> } | null)?.moments) ?? []
  const enabledMorningFields = cfgMoments.find((m) => m.moment === 'morning')?.fields ?? []

  const rawFreedom = (perClientAi as { coaching_freedom?: string | null } | null)?.coaching_freedom ?? 'safe'
  const freedom: Freedom = rawFreedom === 'none' || rawFreedom === 'extended' ? rawFreedom : 'safe'

  const facts = computeDailyFacts({
    dayKind,
    sessionStatus,
    plannedSessionName,
    kcalLogged,
    kcalTarget,
    proteinLogged,
    proteinTarget,
    hydrationMl,
    hydrationTargetMl,
    steps: steps ?? null,
    checkin: submittedCheckin ?? {},
  })

  return {
    facts,
    trend: { kcalOverDays, proteinShortDays },
    tone,
    freedom,
    enabledMorningFields,
    coachId,
  }
}
