import type { SupabaseClient } from '@supabase/supabase-js'
import { shouldProactiveInitNow } from '@/lib/client/checkin/checkinEngine'
import {
  addDaysToDateKey,
  computePhysiologicalDateInTimezone,
  getLocalTimeParts,
  getLocalWeekday,
  utcRangeForPhysiologicalDate,
} from '@/lib/client/checkin/timeWindows'
import { evaluateClientPatterns } from '@/lib/client/ai-coach/patternDetector'
import { buildRoutineMessage } from '@/lib/client/ai-coach/routineMessages'

type AiRoutineSettings = {
  ai_llm_enabled?: boolean | null
  ai_tone?: string | null
  ai_morning_routine_enabled?: boolean | null
  ai_evening_routine_enabled?: boolean | null
}

type CheckinConfigRow = {
  client_id: string
  is_active?: boolean | null
  days_of_week?: number[] | null
  moments?: Array<{ moment?: string; fields?: string[] }> | null
}

export function configuredDayFromJsWeekday(jsWeekday: number): number {
  return jsWeekday === 0 ? 6 : jsWeekday - 1
}

export function isCheckinMomentConfiguredToday(
  config: CheckinConfigRow | undefined,
  flow: 'morning' | 'evening',
  jsWeekday: number,
): boolean {
  if (!config?.is_active) return false
  if (!(config.days_of_week ?? []).includes(configuredDayFromJsWeekday(jsWeekday))) return false
  return (config.moments ?? []).some((moment) => moment.moment === flow)
}

export function isAiRoutineAllowed(
  flow: 'morning' | 'evening',
  globalAiEnabled: boolean,
  settings?: AiRoutineSettings | null,
): boolean {
  if (!globalAiEnabled || !settings?.ai_llm_enabled) return false
  return flow === 'morning'
    ? settings.ai_morning_routine_enabled !== false
    : settings.ai_evening_routine_enabled !== false
}

export function shouldInsertAutomatedInit(
  routineAllowed: boolean,
  shouldPromptCheckin: boolean,
): boolean {
  return routineAllowed || shouldPromptCheckin
}

export function getAutomatedInitSkipReason(
  routineAllowed: boolean,
  isCheckinConfiguredToday: boolean,
  shouldPromptCheckin: boolean,
): string {
  if (routineAllowed || shouldPromptCheckin) return 'sendable'
  if (!isCheckinConfiguredToday) return 'checkin_not_configured'
  return 'checkin_not_due'
}

/** True if client local time is within ±14 min of target (for 15-min cron). */
export function isLocalTimeNear(
  now: Date,
  timezone: string,
  hour: number,
  minute: number,
): boolean {
  const p = getLocalTimeParts(now, timezone)
  if (p.hour !== hour) return false
  return Math.abs(p.minute - minute) <= 14
}

/** True if client local time is within [startHour:startMinute, endHour:endMinute). */
export function isLocalTimeInRange(
  now: Date,
  timezone: string,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
): boolean {
  const p = getLocalTimeParts(now, timezone)
  const current = p.hour * 60 + p.minute
  const start = startHour * 60 + startMinute
  const end = endHour * 60 + endMinute
  return current >= start && current < end
}

export async function runChatCheckinInitForFlow(
  db: SupabaseClient,
  flow: 'morning' | 'evening',
  targetHour: number,
  targetMinute: number,
): Promise<{ inserted: number; skipped: number; skipReasons: Record<string, number> }> {
  const now = new Date()
  const messageType = flow === 'morning' ? 'morning_init' : 'evening_init'

  const { data: clients, error } = await db
    .from('coach_clients')
    .select('id, first_name, coach_id')
    .eq('status', 'active')

  if (error) throw new Error(`chat-checkin-init: ${error.message}`)

  const clientRows = (clients ?? []) as Array<{
    id: string
    first_name?: string | null
    coach_id?: string | null
  }>
  const clientIds = clientRows.map((client) => client.id)
  const coachIds = Array.from(new Set(clientRows.map((client) => client.coach_id).filter(Boolean))) as string[]

  const { data: schedules } = await db
    .from('daily_checkin_schedules')
    .select('client_id, timezone')

  const [{ data: coachProfiles }, { data: clientSettings }] = await Promise.all([
    coachIds.length > 0
      ? db.from('coach_profiles')
        .select('coach_id, has_ai_llm')
        .in('coach_id', coachIds)
      : Promise.resolve({ data: [] }),
    clientIds.length > 0
      ? db.from('coach_ai_settings_per_client')
        .select('coach_id, client_id, ai_llm_enabled, ai_tone, ai_morning_routine_enabled, ai_evening_routine_enabled')
        .in('client_id', clientIds)
      : Promise.resolve({ data: [] }),
  ])

  const { data: checkinConfigs } = clientIds.length > 0
    ? await db.from('daily_checkin_configs')
      .select('client_id, is_active, days_of_week, moments')
      .in('client_id', clientIds)
    : { data: [] }

  const tzByClient = new Map(
    (schedules ?? []).map(s => [s.client_id as string, (s.timezone as string) || 'Europe/Paris']),
  )
  const globalAiByCoach = new Map(
    (coachProfiles ?? []).map((row) => [row.coach_id as string, Boolean(row.has_ai_llm)]),
  )
  const settingsByClient = new Map(
    (clientSettings ?? []).map((row) => [
      `${row.coach_id as string}:${row.client_id as string}`,
      row as AiRoutineSettings,
    ]),
  )
  const checkinConfigByClient = new Map(
    ((checkinConfigs ?? []) as CheckinConfigRow[]).map((row) => [row.client_id, row]),
  )

  let inserted = 0
  let skipped = 0
  const skipReasons: Record<string, number> = {}

  const noteSkip = (reason: string) => {
    skipped++
    skipReasons[reason] = (skipReasons[reason] ?? 0) + 1
  }

  for (const client of clientRows) {
    const clientSettingsKey = `${client.coach_id ?? ''}:${client.id}`
    const routineAllowed = isAiRoutineAllowed(
      flow,
      globalAiByCoach.get(client.coach_id ?? '') ?? false,
      settingsByClient.get(clientSettingsKey),
    )

    const timezone = tzByClient.get(client.id) ?? 'Europe/Paris'
    const isEligibleTime = flow === 'morning'
      ? isLocalTimeInRange(now, timezone, 6, 0, 7, 0)
      : isLocalTimeNear(now, timezone, targetHour, targetMinute)

    if (!isEligibleTime) {
      noteSkip('outside_time_window')
      continue
    }

    const today = computePhysiologicalDateInTimezone(now, timezone)
    const yesterday = addDaysToDateKey(today, -1)
    const routineDayRange = utcRangeForPhysiologicalDate(today, timezone)
    const localWeekday = getLocalWeekday(now, timezone)

    const [{ data: checkin }, { data: existing }, { data: checkinRows }, { data: todaySessions }] = await Promise.all([
      db.from('client_daily_checkins')
        .select('id')
        .eq('client_id', client.id)
        .eq('date', today)
        .eq('flow_type', flow)
        .maybeSingle(),
      db.from('chat_messages')
        .select('id')
        .eq('client_id', client.id)
        .eq('message_type', messageType)
        .gte('created_at', routineDayRange.start.toISOString())
        .lte('created_at', routineDayRange.end.toISOString())
        .maybeSingle(),
      db.from('client_daily_checkins')
        .select('flow_type, date')
        .eq('client_id', client.id)
        .in('date', [yesterday, today]),
      db.from('program_sessions')
        .select('name, day_of_week, days_of_week, programs!inner(status, client_id)')
        .eq('programs.client_id', client.id)
        .eq('programs.status', 'active')
        .or(`day_of_week.eq.${localWeekday},days_of_week.cs.{${localWeekday}}`),
    ])

    if (existing) {
      noteSkip('existing_init_message')
      continue
    }

    const sessionRows = ((checkinRows ?? []) as Array<{ flow_type: string; date: string }>).map((row) => ({
      flow_type: row.flow_type,
      date: row.date,
      completed_at: 'done',
    }))
    const checkinConfig = checkinConfigByClient.get(client.id)
    const checkinMoment = (checkinConfig?.moments ?? [])
      .find((moment) => moment.moment === flow)
    const isCheckinConfiguredToday = isCheckinMomentConfiguredToday(checkinConfig, flow, localWeekday)
    const shouldPromptCheckin = Boolean(
      !checkin
      && isCheckinConfiguredToday
      && shouldProactiveInitNow(now, timezone, flow, sessionRows),
    )

    if (!shouldInsertAutomatedInit(routineAllowed, shouldPromptCheckin)) {
      noteSkip(getAutomatedInitSkipReason(routineAllowed, isCheckinConfiguredToday, shouldPromptCheckin))
      continue
    }

    const sessionList = (todaySessions ?? []) as Array<{
      name?: string | null
      day_of_week?: number | null
      days_of_week?: number[] | null
    }>
    const primarySessionName = sessionList[0]?.name ?? null
    const routine = buildRoutineMessage({
      flowType: flow,
      firstName: client.first_name,
      tone: settingsByClient.get(clientSettingsKey)?.ai_tone ?? null,
      hasTrainingToday: sessionList.length > 0,
      trainingName: primarySessionName,
      checkin: {
        enabled: shouldPromptCheckin,
        fields: checkinMoment?.fields ?? [],
      },
    })
    const { data: insertedMsg, error: insertError } = await db.from('chat_messages').insert({
      client_id: client.id,
      role: 'assistant',
      content: routine.content,
      message_type: messageType,
      metadata: routine.metadata,
    }).select('id').single()

    if (insertError) {
      noteSkip('insert_error')
      continue
    }

    inserted++

    const pattern = await evaluateClientPatterns(client.id, db)
    if (pattern && insertedMsg) {
      await db.from('chat_messages').insert({
        client_id: client.id,
        role: 'assistant',
        content: pattern.statement,
        message_type: 'pattern_inquiry',
        parent_message_id: insertedMsg.id,
        metadata: {
          component: 'chips',
          key: 'pattern_reply',
          pattern_code: pattern.code,
          question: pattern.question,
          options: pattern.options,
        },
      })
    }
  }

  return { inserted, skipped, skipReasons }
}
