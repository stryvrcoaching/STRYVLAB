import type { SupabaseClient } from '@supabase/supabase-js'
import {
  activeWindowAt,
  computePhysiologicalDateInTimezone,
  addDaysToDateKey,
} from '@/lib/client/checkin/timeWindows'

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

const NUDGE: Record<'morning' | 'evening', { chat: string; push: { title: string; body: string; url: string } }> = {
  morning: {
    chat: 'Quand tu veux pour ton check-in du matin — le bouton Check-in est en haut à gauche.',
    push: { title: 'Check-in du matin', body: 'Quand tu veux, c’est rapide.', url: '/client' },
  },
  evening: {
    chat: 'Quand tu veux pour ton check-in du soir — le bouton Check-in est en haut à gauche.',
    push: { title: 'Check-in du soir', body: 'Quand tu veux, c’est rapide.', url: '/client' },
  },
}

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

  const [{ data: schedules }, { data: checkins }, { data: clients }] = await Promise.all([
    db.from('daily_checkin_schedules').select('client_id, timezone').in('client_id', clientIds),
    db.from('client_daily_checkins').select('client_id, date, flow_type').in('client_id', clientIds),
    db.from('coach_clients').select('id, push_token').in('id', clientIds),
  ])

  const tzByClient = new Map((schedules ?? []).map((s) => [s.client_id as string, (s.timezone as string) || 'Europe/Paris']))
  const pushByClient = new Map(
    (clients ?? []).filter((c) => c.push_token).map((c) => [c.id as string, c.push_token as string]),
  )
  const doneSet = new Set(
    (checkins ?? []).map((c) => `${c.client_id}:${c.date}:${c.flow_type}`),
  )

  // Push setup (optional — no-op if VAPID/token absent)
  const vapidPublic = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT
  let webpush: typeof import('web-push') | null = null
  if (vapidPublic && vapidPrivate && vapidSubject) {
    webpush = await import('web-push').then((m) => (m as any).default ?? m)
    webpush!.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
  }

  let chat = 0
  let push = 0

  for (const msg of candidates) {
    const flow = FLOW_OF[msg.message_type]
    const tz = tzByClient.get(msg.client_id) ?? 'Europe/Paris'

    // Only nudge while still inside the flow's local window (avoids odd-hour pings).
    if (activeWindowAt(now, tz) !== flow) continue

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

    // 1) light chat message (new, never overwrites the init)
    const { error: insErr } = await db.from('chat_messages').insert({
      client_id: msg.client_id,
      role: 'assistant',
      content: NUDGE[flow].chat,
      message_type: 'text',
      metadata: { kind: 'defer_reminder', flow },
    })
    if (!insErr) chat++

    // 2) push (best-effort)
    const token = pushByClient.get(msg.client_id)
    if (webpush && token) {
      try {
        await webpush.sendNotification(JSON.parse(token), JSON.stringify(NUDGE[flow].push))
        push++
      } catch {
        await db.from('coach_clients').update({ push_token: null }).eq('id', msg.client_id)
      }
    }

    // 3) mark reminded (idempotent)
    await db.from('chat_messages').update({ metadata: { ...(msg.metadata ?? {}), defer_reminded: true } }).eq('id', msg.id)
  }

  return { chat, push }
}
