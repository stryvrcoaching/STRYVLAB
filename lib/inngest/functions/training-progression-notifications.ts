import { createClient as createServiceClient } from '@supabase/supabase-js'
import { inngest } from '@/lib/inngest/client'
import {
  addDaysToDateKey,
  getLocalTimeParts,
  getLocalWeekday,
  utcRangeForLocalDate,
} from '@/lib/client/checkin/timeWindows'
import {
  findPersonalRecord,
  hasReachedWeeklyGoal,
  isWeeklyGoalAtRisk,
  weekStartFromDateKey,
  type PerformanceSet,
} from '@/lib/client/progression-notifications'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'
import type { ClientPushCopyKey, ClientPushCopyParams } from '@/lib/notifications/client-push-copy'

const REENGAGEMENT_AFTER_DAYS = 3
const REENGAGEMENT_COOLDOWN_DAYS = 14

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

type Client = {
  id: string
  coach_id: string | null
  timezone: string | null
  weekly_frequency: number | null
  created_at?: string | null
}

async function wasSent(
  db: ReturnType<typeof service>,
  clientId: string,
  event: string,
  period: string,
): Promise<boolean> {
  const { data } = await db
    .from('coach_client_notifications')
    .select('id')
    .eq('client_id', clientId)
    .eq('type', 'system_reminder')
    .contains('payload', { event, period })
    .limit(1)
  return Boolean(data?.length)
}

async function sentRecently(
  db: ReturnType<typeof service>,
  clientId: string,
  event: string,
  since: Date,
): Promise<boolean> {
  const { data } = await db
    .from('coach_client_notifications')
    .select('id')
    .eq('client_id', clientId)
    .eq('type', 'system_reminder')
    .contains('payload', { event })
    .gte('created_at', since.toISOString())
    .limit(1)
  return Boolean(data?.length)
}

async function createProgressNotification(
  db: ReturnType<typeof service>,
  client: Pick<Client, 'id' | 'coach_id'>,
  event: string,
  period: string,
  copyKey: ClientPushCopyKey,
  copyParams: ClientPushCopyParams,
  actionUrl: string,
  extraPayload: Record<string, unknown> = {},
): Promise<boolean> {
  if (await wasSent(db, client.id, event, period)) return false

  try {
    await createClientAppNotification(db, {
      clientId: client.id,
      coachId: client.coach_id,
      type: 'system_reminder',
      copyKey,
      copyParams,
      actionUrl,
      payload: { event, period, ...extraPayload },
      pushKind: 'system',
      pushTag: `stryv-${event}-${period}`,
    })
    return true
  } catch {
    return false
  }
}

function normalizePerformanceSets(rows: unknown[]): PerformanceSet[] {
  return rows.map((row) => {
    const set = row as Record<string, unknown>
    return {
      exerciseId: typeof set.exercise_id === 'string' ? set.exercise_id : null,
      exerciseName: typeof set.exercise_name === 'string' ? set.exercise_name : null,
      weightKg: numberOrNull(set.actual_weight_kg),
      reps: numberOrNull(set.actual_reps),
    }
  })
}

function numberOrNull(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function countCompletedSessionsThisWeek(
  db: ReturnType<typeof service>,
  clientId: string,
  dateKey: string,
  weekday: number,
  timezone: string,
): Promise<number> {
  const weekStart = weekStartFromDateKey(dateKey, weekday)
  const { start } = utcRangeForLocalDate(weekStart, timezone)
  const { data } = await db
    .from('client_session_logs')
    .select('id')
    .eq('client_id', clientId)
    .not('completed_at', 'is', null)
    .gte('completed_at', start.toISOString())
  return data?.length ?? 0
}

export const trainingProgressionNotificationsFunction = inngest.createFunction(
  {
    id: 'training-progression-notifications',
    retries: 2,
    triggers: [{ event: 'training/session.completed' }],
  },
  async ({ event, step }) => step.run('evaluate-training-progression-notifications', async () => {
    const { client_id: clientId, session_log_id: sessionLogId } = event.data as {
      client_id: string
      session_log_id: string
    }
    const db = service()
    const { data: client } = await db
      .from('coach_clients')
      .select('id, coach_id, timezone, weekly_frequency')
      .eq('id', clientId)
      .maybeSingle()
    if (!client) return { sent: 0, reason: 'client_not_found' }

    const typedClient = client as Client
    const timezone = typedClient.timezone?.trim() || 'Europe/Paris'
    const now = new Date()
    const local = getLocalTimeParts(now, timezone)
    const weekday = getLocalWeekday(now, timezone)
    const period = weekStartFromDateKey(local.dateKey, weekday)
    let sent = 0

    const { data: currentLog } = await db
      .from('client_session_logs')
      .select('id, session_name, client_set_logs(exercise_id, exercise_name, actual_weight_kg, actual_reps, completed)')
      .eq('id', sessionLogId)
      .eq('client_id', typedClient.id)
      .not('completed_at', 'is', null)
      .maybeSingle()

    if (currentLog) {
      const { data: historicLogs } = await db
        .from('client_session_logs')
        .select('id, client_set_logs(exercise_id, exercise_name, actual_weight_kg, actual_reps, completed)')
        .eq('client_id', typedClient.id)
        .not('completed_at', 'is', null)
        .neq('id', sessionLogId)

      const currentSets = normalizePerformanceSets(
        ((currentLog as any).client_set_logs ?? []).filter((set: any) => set.completed),
      )
      const historicSets = (historicLogs ?? []).flatMap((log: any) =>
        normalizePerformanceSets((log.client_set_logs ?? []).filter((set: any) => set.completed)),
      )
      const record = findPersonalRecord(currentSets, historicSets)
      if (record && await createProgressNotification(
        db,
        typedClient,
        'personal_record',
        sessionLogId,
        'progress.personal_record',
        { exerciseName: record.exerciseName, weightKg: record.weightKg, reps: record.reps },
        '/client/programme',
        {
          session_log_id: sessionLogId,
          exercise_id: record.exerciseId,
          exercise_name: record.exerciseName,
          weight_kg: record.weightKg,
          reps: record.reps,
        },
      )) sent++
    }

    const completedSessions = await countCompletedSessionsThisWeek(
      db,
      typedClient.id,
      local.dateKey,
      weekday,
      timezone,
    )
    if (hasReachedWeeklyGoal(completedSessions, typedClient.weekly_frequency) && await createProgressNotification(
      db,
      typedClient,
      'weekly_goal_reached',
      period,
      'progress.weekly_goal.reached',
      {},
      '/client/programme',
      { completed_sessions: completedSessions, target_sessions: typedClient.weekly_frequency },
    )) sent++

    return { sent }
  }),
)

export const trainingEngagementRemindersFunction = inngest.createFunction(
  {
    id: 'training-engagement-reminders',
    retries: 1,
    triggers: [{ cron: '*/5 * * * *' }],
  },
  async ({ step }) => step.run('send-training-engagement-reminders', async () => {
    const db = service()
    const { data: clients } = await db
      .from('coach_clients')
      .select('id, coach_id, timezone, weekly_frequency, created_at')
      .eq('status', 'active')

    const now = new Date()
    let sent = 0
    for (const rawClient of clients ?? []) {
      const client = rawClient as Client
      const timezone = client.timezone?.trim() || 'Europe/Paris'
      const local = getLocalTimeParts(now, timezone)
      if (local.hour !== 18 || local.minute >= 5) continue

      const weekday = getLocalWeekday(now, timezone)
      const period = weekStartFromDateKey(local.dateKey, weekday)
      if (weekday === 5) {
        const completedSessions = await countCompletedSessionsThisWeek(
          db,
          client.id,
          local.dateKey,
          weekday,
          timezone,
        )
        if (isWeeklyGoalAtRisk(completedSessions, client.weekly_frequency) && await createProgressNotification(
          db,
          client,
          'weekly_goal_at_risk',
          period,
          'progress.weekly_goal.at_risk',
          { remainingSessions: Math.max(0, Number(client.weekly_frequency) - completedSessions) },
          '/client/programme',
          { completed_sessions: completedSessions, target_sessions: client.weekly_frequency },
        )) sent++
      }

      const createdAt = client.created_at ? new Date(client.created_at) : null
      const activationThreshold = new Date(now.getTime() - REENGAGEMENT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
      if (!createdAt || createdAt > activationThreshold) continue

      const trackingSince = addDaysToDateKey(local.dateKey, -REENGAGEMENT_AFTER_DAYS)
      const trackingRange = utcRangeForLocalDate(trackingSince, timezone)
      const [{ data: sessions }, { data: meals }, { data: checkins }] = await Promise.all([
        db
          .from('client_session_logs')
          .select('id')
          .eq('client_id', client.id)
          .not('completed_at', 'is', null)
          .gte('completed_at', trackingRange.start.toISOString())
          .limit(1),
        db
          .from('nutrition_meals')
          .select('id')
          .eq('client_id', client.id)
          .gte('physiological_date', trackingSince)
          .limit(1),
        db
          .from('client_daily_checkins')
          .select('id')
          .eq('client_id', client.id)
          .gte('date', trackingSince)
          .limit(1),
      ])
      if (sessions?.length || meals?.length || checkins?.length) continue

      if (await sentRecently(
        db,
        client.id,
        'gentle_reengagement',
        new Date(now.getTime() - REENGAGEMENT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000),
      )) continue

      if (await createProgressNotification(
        db,
        client,
        'gentle_reengagement',
        local.dateKey,
        'progress.gentle_reengagement',
        { inactiveDays: REENGAGEMENT_AFTER_DAYS },
        '/client',
      )) sent++
    }

    return { sent }
  }),
)
