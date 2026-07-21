import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'
import type {
  ClientPushCopyKey,
  ClientPushCopyParams,
} from '@/lib/notifications/client-push-copy'
import {
  computePhysiologicalDateInTimezone,
  getLocalTimeParts,
  getLocalWeekday,
  utcRangeForPhysiologicalDate,
} from '@/lib/client/checkin/timeWindows'
import { filterSessionsForJsWeekday } from '@/lib/client/plannedSessions'
import { resolveProtocolDayByDate } from '@/lib/nutrition/protocol-schedule'
import {
  buildHydrationReminderTimes,
  isReminderDue,
  normalizeReminderTime,
  normalizeTrainingReminderTimes,
  reminderEventSuffix,
  REMINDER_DEFAULTS,
} from '@/lib/client/reminders'
import type { ClientPushKind } from '@/lib/notifications/send-client-push'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function alreadySent(db: ReturnType<typeof service>, clientId: string, event: string, date: string) {
  const { data } = await db
    .from('coach_client_notifications')
    .select('id')
    .eq('client_id', clientId)
    .eq('type', 'system_reminder')
    .contains('payload', { event, date })
    .limit(1)
  return Boolean(data?.length)
}

async function createAndPush(
  db: ReturnType<typeof service>,
  client: { id: string; coach_id?: string | null },
  event: string,
  date: string,
  copyKey: ClientPushCopyKey,
  copyParams: ClientPushCopyParams | undefined,
  kind: ClientPushKind,
  url: string,
) {
  if (await alreadySent(db, client.id, event, date)) return false

  try {
    const result = await createClientAppNotification(db, {
      clientId: client.id,
      coachId: client.coach_id ?? null,
      type: 'system_reminder',
      copyKey,
      copyParams,
      actionUrl: url,
      payload: { event, date },
      pushKind: kind,
      pushTag: `stryv-${event}-${date}`,
    })
    return result.created && result.pushed
  } catch {
    return false
  }
}

export async function runClientEngagementReminders(
  db: ReturnType<typeof service>,
  now = new Date(),
) {
    const { data: clients } = await db
      .from('coach_clients')
      .select('id, coach_id, timezone')
      .eq('status', 'active')

    const clientIds = (clients ?? []).map((client) => client.id)
    const { data: preferenceRows } = clientIds.length > 0
      ? await db
        .from('client_preferences')
        .select('client_id, notif_session_reminder, notif_hydration_reminder, notif_meal_reminder, notif_protein_reminder, training_reminder_times, hydration_reminder_first_time, hydration_reminder_count, meal_reminder_breakfast_time, meal_reminder_lunch_time, protein_reminder_time')
        .in('client_id', clientIds)
      : { data: [] }
    const preferencesByClient = new Map(
      (preferenceRows ?? []).map((preference) => [preference.client_id, preference]),
    )

    let sent = 0

    for (const client of clients ?? []) {
      const timezone = String(client.timezone ?? '').trim() || 'Europe/Paris'
      const local = getLocalTimeParts(now, timezone)
      const date = computePhysiologicalDateInTimezone(now, timezone)
      const weekday = getLocalWeekday(now, timezone)
      const preferences = preferencesByClient.get(client.id) as Record<string, unknown> | undefined
      const isEnabled = (key: string) => preferences?.[key] !== false
      const trainingTimes = isEnabled('notif_session_reminder')
        ? normalizeTrainingReminderTimes(preferences?.training_reminder_times)
        : []
      const dueTrainingIndex = trainingTimes.findIndex((time) => isReminderDue(local, time))

      if (dueTrainingIndex >= 0) {
        const { start: dayStart, end: dayEnd } = utcRangeForPhysiologicalDate(date, timezone)
        const [{ data: sessions }, { data: completed }, { data: skipped }] = await Promise.all([
          db
          .from('program_sessions')
          .select('id, name, day_of_week, days_of_week, programs!inner(status, client_id)')
          .eq('programs.client_id', client.id)
          .eq('programs.status', 'active'),
          db
            .from('client_session_logs')
            .select('program_session_id')
            .eq('client_id', client.id)
            .not('completed_at', 'is', null)
            .gte('completed_at', dayStart.toISOString())
            .lte('completed_at', dayEnd.toISOString()),
          db
            .from('client_workout_skips')
            .select('program_session_id')
            .eq('client_id', client.id)
            .eq('scheduled_date', date),
        ])
        const planned = filterSessionsForJsWeekday((sessions ?? []) as any[], weekday)
        const completedIds = new Set((completed ?? []).map((session) => session.program_session_id))
        const skippedIds = new Set((skipped ?? []).map((session) => session.program_session_id))
        const incomplete = planned.filter(
          (session) => !completedIds.has(session.id) && !skippedIds.has(session.id),
        )
        const reminderTime = trainingTimes[dueTrainingIndex]
        const copyKey = dueTrainingIndex === 0 ? 'session.reminder' : 'session.overdue'

        if (incomplete[0] && await createAndPush(
          db,
          client,
          `session_reminder_${reminderEventSuffix(reminderTime)}`,
          date,
          copyKey,
          { sessionName: incomplete[0].name ?? null },
          'session',
          '/client/programme',
        )) sent++
      }

      const hydrationTimes = isEnabled('notif_hydration_reminder')
        ? buildHydrationReminderTimes(
            preferences?.hydration_reminder_first_time,
            preferences?.hydration_reminder_count,
          )
        : []
      const dueHydrationTime = hydrationTimes.find((time) => isReminderDue(local, time))
      if (dueHydrationTime && await createAndPush(
          db,
          client,
          `hydration_reminder_${reminderEventSuffix(dueHydrationTime)}`,
          date,
          'hydration.reminder',
          undefined,
          'hydration', `/client?openWater=1&date=${encodeURIComponent(date)}`,
        )) sent++

      const breakfastTime = normalizeReminderTime(
        preferences?.meal_reminder_breakfast_time,
        REMINDER_DEFAULTS.breakfastTime,
      )
      const lunchTime = normalizeReminderTime(
        preferences?.meal_reminder_lunch_time,
        REMINDER_DEFAULTS.lunchTime,
      )
      const proteinTime = normalizeReminderTime(
        preferences?.protein_reminder_time,
        REMINDER_DEFAULTS.proteinTime,
      )
      const breakfastDue = isEnabled('notif_meal_reminder') && isReminderDue(local, breakfastTime)
      const lunchDue = isEnabled('notif_meal_reminder') && isReminderDue(local, lunchTime)
      const proteinDue = isEnabled('notif_protein_reminder') && isReminderDue(local, proteinTime)

      if (breakfastDue || lunchDue || proteinDue) {
        const { data: meals } = await db
          .from('nutrition_meals')
          .select('meal_type, total_protein_g')
          .eq('client_id', client.id)
          .eq('physiological_date', date)

        if (breakfastDue && !(meals ?? []).some((meal) => meal.meal_type === 'breakfast') && await createAndPush(
          db,
          client,
          `breakfast_missing_${reminderEventSuffix(breakfastTime)}`,
          date,
          'meal.breakfast.missing',
          undefined,
          'meal',
          '/client/nutrition/log',
        )) sent++

        if (lunchDue && !(meals ?? []).some((meal) => meal.meal_type === 'lunch') && await createAndPush(
          db,
          client,
          `lunch_missing_${reminderEventSuffix(lunchTime)}`,
          date,
          'meal.lunch.missing',
          undefined,
          'meal',
          '/client/nutrition/log',
        )) sent++

        if (proteinDue) {
          const { data: protocol } = await db
            .from('nutrition_protocols')
            .select('schedule_start_date, nutrition_protocol_days(position, protein_g), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
            .eq('client_id', client.id)
            .eq('status', 'shared')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          const protocolDay = resolveProtocolDayByDate(
            date,
            (protocol as any)?.schedule_start_date ?? null,
            (protocol as any)?.nutrition_protocol_days ?? [],
            (protocol as any)?.nutrition_protocol_schedule_slots ?? [],
          ) as { protein_g?: number } | null
          const targetProtein = Number(protocolDay?.protein_g ?? 0)
          const consumedProtein = (meals ?? []).reduce(
            (total, meal) => total + Number(meal.total_protein_g ?? 0),
            0,
          )
          const proteinRemaining = Math.max(0, targetProtein - consumedProtein)

          if (targetProtein > 0 && consumedProtein < targetProtein * 0.7 && await createAndPush(
            db,
            client,
            `protein_low_${reminderEventSuffix(proteinTime)}`,
            date,
            'nutrition.protein.low',
            { proteinRemaining },
            'protein',
            '/client/nutrition',
          )) sent++
        }
      }
    }

    return { sent }
}
