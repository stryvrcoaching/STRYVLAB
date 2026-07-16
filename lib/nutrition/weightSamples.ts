import type { SupabaseClient } from '@supabase/supabase-js'
import type { WeightSample } from './adaptiveTdee'
import type { TdeeDailyIntake } from './tdee-model-v2'

export const MIN_WINDOW_DAYS = 14  // below this, regression is unreliable

function currentIsoDateUtc() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Find the date when the current protocol was activated for the client.
 * Uses assignment history as the source of truth.
 * Falls back to metric_annotations only for legacy data.
 */
export async function resolveProtocolStartDate(
  db: SupabaseClient,
  clientId: string,
  protocolName: string,
  protocolId?: string,
): Promise<string | null> {
  if (protocolId) {
    const { data: exactAssignment } = await db
      .from('client_nutrition_protocol_assignments')
      .select('started_at')
      .eq('client_id', clientId)
      .eq('protocol_id', protocolId)
      .order('started_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if ((exactAssignment as any)?.started_at) {
      return String((exactAssignment as any).started_at).slice(0, 10)
    }
  }

  if (!protocolName) return null

  const { data } = await db
    .from('metric_annotations')
    .select('event_date')
    .eq('client_id', clientId)
    .eq('event_type', 'nutrition')
    .ilike('label', `Protocole nutritionnel%${protocolName}%`)
    .order('event_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  return (data as any)?.event_date ?? null
}

/**
 * Collect weight samples from all available sources, deduplicated by date.
 *
 * Window anchoring (priority order):
 *   1. Since protocol assignment start — avoids mixing pre/post diet data
 *   2. Adaptive fallback: tries targetWindowDays → 21d → 30d if not enough samples
 *
 * If the anchored window is < MIN_WINDOW_DAYS, returns empty samples with
 * a tooShort flag so the caller can surface a meaningful error instead of
 * computing a nonsense TDEE.
 *
 * Weight source priority (highest → lowest):
 *   1. client_daily_checkins.weight_kg  (daily, real-time)
 *   2. assessment_responses field_key='weight_kg'  (bilans)
 *   3. coach_client_nutrition_manual_data.weight_kg  (coach override)
 */
export async function collectWeightSamples(
  db: SupabaseClient,
  clientId: string,
  targetWindowDays = 14,
  minSamples = 4,
  protocolName?: string,
  protocolId?: string,
): Promise<{ samples: WeightSample[]; windowDays: number; anchoredToProtocol: boolean; tooShort: boolean }> {

  // Try to anchor to protocol start date first
  let anchorDate: string | null = null
  if (protocolName) {
    anchorDate = await resolveProtocolStartDate(db, clientId, protocolName, protocolId)
  }

  const today = currentIsoDateUtc()

  if (anchorDate) {
    const daysSinceAnchor = Math.floor(
      (new Date(today).getTime() - new Date(anchorDate).getTime()) / 86400000
    )

    if (daysSinceAnchor >= MIN_WINDOW_DAYS) {
      // Collect samples since anchor date only when the anchored window is mature enough.
      const samples = await fetchWeightSamples(db, clientId, anchorDate, today)
      if (samples.length >= 2) {
        return { samples, windowDays: daysSinceAnchor, anchoredToProtocol: true, tooShort: false }
      }
    }
    // If the protocol is too recent or the anchored window is sparse,
    // fall through to the rolling client-centric window instead of blocking the TDEE.
  }

  // Adaptive window fallback (no anchor or insufficient anchored samples)
  const windows = [targetWindowDays, 21, 30].filter((w, i, arr) => w > arr[i - 1] || i === 0)

  for (const windowDays of windows) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - windowDays)
    const cutoffDate = cutoff.toISOString().slice(0, 10)

    const samples = await fetchWeightSamples(db, clientId, cutoffDate, today)

    if (samples.length >= minSamples || windowDays === windows[windows.length - 1]) {
      return { samples, windowDays, anchoredToProtocol: false, tooShort: false }
    }
  }

  return { samples: [], windowDays: targetWindowDays, anchoredToProtocol: false, tooShort: false }
}

async function fetchWeightSamples(
  db: SupabaseClient,
  clientId: string,
  cutoffDate: string,
  maxDateExclusive: string,
): Promise<WeightSample[]> {
  const map = new Map<string, number>()

  // Source 3 (lowest priority) — coach manual data
  const { data: manual } = await db
    .from('coach_client_nutrition_manual_data')
    .select('weight_kg, updated_at')
    .eq('client_id', clientId)
    .not('weight_kg', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (manual?.weight_kg != null) {
    const d = String(manual.updated_at ?? '').slice(0, 10)
    if (d >= cutoffDate && d < maxDateExclusive) map.set(d, Number(manual.weight_kg))
  }

  // Source 2 — assessment bilans
  const { data: assessmentRows } = await db
    .from('assessment_responses')
    .select('value_number, assessment_submissions!inner(submitted_at, client_id, bilan_date)')
    .eq('field_key', 'weight_kg')
    .eq('assessment_submissions.client_id', clientId)
    .gte('assessment_submissions.submitted_at', cutoffDate)
    .not('value_number', 'is', null)

  for (const row of assessmentRows ?? []) {
    const sub = (row as any).assessment_submissions
    const d: string = (sub?.bilan_date ?? String(sub?.submitted_at ?? '').slice(0, 10)) as string
    if (d >= cutoffDate && d < maxDateExclusive && row.value_number != null) {
      map.set(d, Number(row.value_number))
    }
  }

  // Source 1 (highest priority) — daily check-ins
  const { data: checkins } = await db
    .from('client_daily_checkins')
    .select('date, weight_kg')
    .eq('client_id', clientId)
    .gte('date', cutoffDate)
    .lt('date', maxDateExclusive)
    .not('weight_kg', 'is', null)
    .order('date', { ascending: true })

  for (const c of checkins ?? []) {
    if (c.weight_kg != null) {
      map.set(String(c.date), Number(c.weight_kg))
    }
  }

  return Array.from(map.entries())
    .map(([date, weight_kg]) => ({ date, weight_kg }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function collectDailyTdeeIntakes(
  db: SupabaseClient,
  clientId: string,
  windowDays: number,
  anchorDate?: string,
): Promise<{
  entries: TdeeDailyIntake[]
  trackedDays: number
  completeDays: number
}> {
  const cutoffDate = anchorDate ?? (() => {
    const d = new Date()
    d.setDate(d.getDate() - windowDays)
    return d.toISOString().slice(0, 10)
  })()
  const today = currentIsoDateUtc()

  const { data: meals } = await db
    .from('nutrition_meals')
    .select('physiological_date, meal_type, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g')
    .eq('client_id', clientId)
    .gte('physiological_date', cutoffDate)
    .lt('physiological_date', today)

  if (!meals || meals.length === 0) {
    return { entries: [], trackedDays: 0, completeDays: 0 }
  }

  const byDate = new Map<string, { kcal: number; mealCount: number }>()
  for (const m of meals) {
    const macroDerivedKcal =
      Number(m.total_protein_g ?? 0) * 4 +
      Number(m.total_carbs_g ?? 0) * 4 +
      Number(m.total_fat_g ?? 0) * 9 +
      Number(m.total_fiber_g ?? 0) * 2
    const kcal = Number(m.total_calories ?? 0) > 0
      ? Number(m.total_calories)
      : macroDerivedKcal
    const current = byDate.get(m.physiological_date) ?? { kcal: 0, mealCount: 0 }
    byDate.set(m.physiological_date, {
      kcal: current.kcal + kcal,
      mealCount: current.mealCount + (m.meal_type === 'drinks' ? 0 : 1),
    })
  }

  const entries = Array.from(byDate.entries())
    .map(([date, day]) => ({ date, kcal: Math.round(day.kcal), complete: day.kcal >= 800 && day.mealCount >= 2 }))
    .sort((left, right) => left.date.localeCompare(right.date))
  const trackedEntries = entries.filter((day) => day.kcal >= 800)
  const trackedDays = trackedEntries.length
  const completeEntries = entries.filter((day) => day.complete)
  const completeDays = completeEntries.length

  return { entries, trackedDays, completeDays }
}

/**
 * Compute average daily kcal intake from complete nutrition days over the window.
 * Falls back to protocol day 1 calories if no complete client-log days exist.
 */
export async function collectAvgIntake(
  db: SupabaseClient,
  clientId: string,
  windowDays: number,
  protocolFallbackKcal: number,
  anchorDate?: string,
): Promise<{
  avgIntakeKcal: number
  caloriesSource: 'logs' | 'protocol'
  trackedDays: number
  completeDays: number
  excludedCurrentDay: boolean
}> {
  const { entries, trackedDays, completeDays } = await collectDailyTdeeIntakes(
    db,
    clientId,
    windowDays,
    anchorDate,
  )

  if (completeDays === 0) {
    return {
      avgIntakeKcal: protocolFallbackKcal,
      caloriesSource: 'protocol',
      trackedDays,
      completeDays,
      excludedCurrentDay: true,
    }
  }

  const completeEntries = entries.filter((entry) => entry.complete)
  const avgIntakeKcal = Math.round(completeEntries.reduce((sum, entry) => sum + entry.kcal, 0) / completeDays)
  return {
    avgIntakeKcal,
    caloriesSource: 'logs',
    trackedDays,
    completeDays,
    excludedCurrentDay: true,
  }
}

/**
 * Collect client signals needed for v2 adaptive TDEE:
 * - gender (for luteal correction gate)
 * - cycle_phase per day in the window (for female clients)
 * - cycle confidence level
 */
export async function collectClientSignals(
  db: SupabaseClient,
  clientId: string,
  cutoffDate: string,
): Promise<{
  gender: string | null
  cyclePhases: string[]
  cycleConfidence: 'estimated' | 'learning' | 'calibrated' | null
}> {
  // Gender from coach_clients
  const { data: cc } = await db
    .from('coach_clients')
    .select('gender')
    .eq('id', clientId)
    .single()

  const gender = (cc as any)?.gender ?? null

  if (gender !== 'female') {
    return { gender, cyclePhases: [], cycleConfidence: null }
  }

  // Cycle phases from daily checkins over the window
  const { data: checkins } = await db
    .from('client_daily_checkins')
    .select('date, cycle_phase')
    .eq('client_id', clientId)
    .gte('date', cutoffDate)
    .not('cycle_phase', 'is', null)
    .order('date', { ascending: true })

  const cyclePhases = (checkins ?? [])
    .map((c: any) => c.cycle_phase as string)
    .filter(Boolean)

  // Cycle confidence from menstrual_cycle_logs count
  const { count } = await db
    .from('menstrual_cycle_logs')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)

  const logsCount = count ?? 0
  const cycleConfidence: 'estimated' | 'learning' | 'calibrated' =
    logsCount >= 4 ? 'calibrated' : logsCount >= 1 ? 'learning' : 'estimated'

  return { gender, cyclePhases, cycleConfidence }
}
