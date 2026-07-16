import type { SupabaseClient } from '@supabase/supabase-js'
import {
  activeWindowAt,
  computePhysiologicalDateInTimezone,
  addDaysToDateKey,
} from '@/lib/client/checkin/timeWindows'
import { resolveClientLanguage } from '@/lib/client/resolve-language'
import { getClientPushCopy } from '@/lib/notifications/client-push-copy'
import { sendClientPush } from '@/lib/notifications/send-client-push'
import { createCheckinAvailability, getPendingSlots } from '@/lib/client/checkin/pendingCheckins'
import { getClientAppBadgeCount } from '@/lib/client/appBadgeCount'

type InitMsg = {
  id: string
  client_id: string
  message_type: 'morning_init' | 'evening_init'
  created_at: string
  metadata: Record<string, unknown> | null
}

const FLOW_OF: Record<string, 'morning' | 'evening'> = {
  morning_init: 'morning',
  evening_init: 'evening',
}

const DEFERRED_COPY = {
  morning: 'checkin.morning.deferred',
  evening: 'checkin.evening.deferred',
} as const

/**
 * One light reminder ~1h after a client deferred a check-in ("Plus tard"):
 * a new chat message (never overwriting the init) + a push (if the client enabled it).
 * Idempotent via metadata.defer_reminded. Only fires inside the flow's local window.
 */
export async function runDeferReminders(
  db: SupabaseClient,
): Promise<{ chat: number; push: number }> {
  const now = new Date()

  // Recent init messages that were deferred and not yet reminded.
  const since = new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString()
  const { data: rawMsgs } = await db
    .from('chat_messages')
    .select('id, client_id, message_type, created_at, metadata')
    .in('message_type', ['morning_init', 'evening_init'])
    .gte('created_at', since)

  const candidates = ((rawMsgs ?? []) as InitMsg[]).filter((m) => {
    const meta = m.metadata ?? {}
    const until = meta.deferred_until
    if (typeof until !== 'string' || !until) return false
    if (new Date(until).getTime() > now.getTime()) return false // not expired yet
    if (meta.defer_reminded === true) return false // already reminded
    return true
  })
  if (candidates.length === 0) return { chat: 0, push: 0 }

  const clientIds = Array.from(new Set(candidates.map((m) => m.client_id)))

  const [{ data: schedules }, { data: checkins }, { data: configs }] = await Promise.all([
    db.from('daily_checkin_schedules').select('client_id, moment, scheduled_time, timezone').in('client_id', clientIds),
    db.from('client_daily_checkins').select('client_id, date, flow_type').in('client_id', clientIds),
    db.from('daily_checkin_configs').select('client_id, is_active, days_of_week').in('client_id', clientIds),
  ])

  const tzByClient = new Map((schedules ?? []).map((s) => [s.client_id as string, (s.timezone as string) || 'Europe/Paris']))
  const schedulesByClient = new Map<string, Array<{ moment: string; scheduled_time: string }>>()
  for (const schedule of schedules ?? []) {
    const clientSchedules = schedulesByClient.get(schedule.client_id as string) ?? []
    clientSchedules.push({ moment: String(schedule.moment), scheduled_time: String(schedule.scheduled_time) })
    schedulesByClient.set(schedule.client_id as string, clientSchedules)
  }
  const configByClient = new Map((configs ?? []).map((config) => [config.client_id as string, config]))
  const doneSet = new Set(
    (checkins ?? []).map((c) => `${c.client_id}:${c.date}:${c.flow_type}`),
  )

  let chat = 0
  let push = 0

  for (const msg of candidates) {
    const flow = FLOW_OF[msg.message_type]
    const tz = tzByClient.get(msg.client_id) ?? 'Europe/Paris'

    // Skip if the check-in for that physiological day is already done.
    const today = computePhysiologicalDateInTimezone(now, tz)
    const yesterday = addDaysToDateKey(today, -1)
    const msgDay = computePhysiologicalDateInTimezone(new Date(msg.created_at), tz)
    if (![today, yesterday].includes(msgDay)) continue
    if (doneSet.has(`${msg.client_id}:${msgDay}:${flow}`)) {
      // already done — just mark reminded so we stop scanning it
      await db.from('chat_messages').update({ metadata: { ...(msg.metadata ?? {}), defer_reminded: true } }).eq('id', msg.id)
      continue
    }

    const clientSessions = (checkins ?? [])
      .filter((checkin) => checkin.client_id === msg.client_id)
      .map((checkin) => ({ flow_type: checkin.flow_type as string, date: checkin.date as string, completed_at: 'done' }))
    const availability = createCheckinAvailability(
      configByClient.get(msg.client_id) as { is_active?: boolean | null; days_of_week?: number[] | null } | undefined,
      schedulesByClient.get(msg.client_id),
    )
    const isStillPending = getPendingSlots(now, tz, clientSessions, availability)
      .some((slot) => slot.date === msgDay && slot.flow_type === flow)
    if (!isStillPending) continue

    const lang = await resolveClientLanguage(db, msg.client_id)
    const copy = getClientPushCopy(
      DEFERRED_COPY[flow],
      lang,
    )

    // 1) light chat message (new, never overwrites the init)
    const { error: insErr } = await db.from('chat_messages').insert({
      client_id: msg.client_id,
      role: 'assistant',
      content: copy.chat ?? copy.body,
      message_type: 'text',
      metadata: { kind: 'defer_reminder', flow },
    })
    if (!insErr) chat++

    // 2) push (best-effort)
    const wasSent = await sendClientPush(
      db,
      msg.client_id,
      'checkin',
      {
        title: copy.title,
        body: copy.body,
        url: `/client?openCheckin=${flow}&date=${encodeURIComponent(msgDay)}`,
        tag: `stryv-checkin-deferred-${flow}-${msg.id}`,
        badgeCount: await getClientAppBadgeCount(db, msg.client_id).catch(() => undefined),
      },
    )

    if (wasSent) push++

    // 3) mark reminded (idempotent)
    await db.from('chat_messages').update({ metadata: { ...(msg.metadata ?? {}), defer_reminded: true } }).eq('id', msg.id)
  }

  return { chat, push }
}
