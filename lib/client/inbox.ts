import type { SupabaseClient } from '@supabase/supabase-js'

export type ClientNotificationItem = {
  id: string
  type: 'coach_note' | 'coach_message' | 'bilan_pending' | 'program_assigned' | 'program_updated' | 'system_reminder' | 'tdee_updated' | 'coach_feedback'
  title: string
  body: string | null
  payload: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

type StoredNotification = Pick<ClientNotificationItem, 'type' | 'payload'>

const TRANSIENT_REMINDER_EVENTS = new Set([
  'checkin_reminder',
  'hydration_reminder',
  'session_reminder',
])

/**
 * Persistent inbox items only. A check-in is represented by the daily strip;
 * a human coach message is represented by the conversation and its own badge.
 */
export function isClientInboxNotification(notification: StoredNotification): boolean {
  if (
    (notification.type === 'coach_note' || notification.type === 'coach_message')
    && notification.payload?.message_kind === 'coach_message'
  ) {
    return false
  }

  return !(
    notification.type === 'system_reminder'
    && typeof notification.payload?.event === 'string'
    && TRANSIENT_REMINDER_EVENTS.has(notification.payload.event)
  )
}

export async function listClientNotificationItems(
  db: SupabaseClient,
  userId: string,
  clientId: string | null,
  unreadOnly = false,
  options: { includeLegacy?: boolean; createdAfter?: string } = {},
): Promise<ClientNotificationItem[]> {
  const includeLegacy = options.includeLegacy ?? false
  const legacyQuery = includeLegacy
    ? db
      .from('client_notifications')
      .select('id, type, message, read, created_at')
      .eq('target_user_id', userId)
      .not('type', 'in', '("session_reminder", "assessment_completed", "payment_received")')
      .order('created_at', { ascending: false })
      .limit(100)
    : null

  if (legacyQuery && unreadOnly) legacyQuery.eq('read', false)
  if (legacyQuery && options.createdAfter) legacyQuery.gte('created_at', options.createdAfter)

  const { data: legacy } = legacyQuery ? await legacyQuery : { data: [] }

  const legacyMapped: ClientNotificationItem[] = (legacy ?? []).map((n) => ({
    id: `legacy_${n.id}`,
    type: (n.type ?? 'system_reminder') as ClientNotificationItem['type'],
    title: n.message ?? '',
    body: null,
    payload: null,
    read_at: n.read ? n.created_at : null,
    created_at: n.created_at,
  }))

  let coachMapped: ClientNotificationItem[] = []
  if (clientId) {
    let q = db
      .from('coach_client_notifications')
      .select('id, type, title, body, payload, read_at, created_at')
      .eq('client_id', clientId)
      .is('dismissed_at', null)
      .in('type', ['coach_note', 'coach_message', 'bilan_pending', 'program_assigned', 'program_updated', 'system_reminder', 'tdee_updated', 'coach_feedback'])
      .order('created_at', { ascending: false })
      .limit(100)

    if (unreadOnly) q = q.is('read_at', null)
    if (options.createdAfter) q = q.gte('created_at', options.createdAfter)

    const { data: coach } = await q
    coachMapped = (coach ?? []).map((n) => ({
      id: n.id,
      type: n.type as ClientNotificationItem['type'],
      title: n.title,
      body: n.body,
      payload: (n.payload ?? null) as Record<string, unknown> | null,
      read_at: n.read_at,
      created_at: n.created_at,
    })).filter(isClientInboxNotification)
  }

  return [...legacyMapped, ...coachMapped]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20)
}

export async function getClientInboxUnreadCount(
  db: SupabaseClient,
  userId: string,
  clientId: string | null,
): Promise<{ total: number; chat: number; alerts: number }> {
  const [{ count: chatCount }, { data: coachNotifications }] = await Promise.all([
    db
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'assistant')
      .eq('from_coach_human', true)
      .eq('client_id', clientId ?? '00000000-0000-0000-0000-000000000000')
      .is('archived_at', null)
      .is('seen_at', null),
    db
      .from('coach_client_notifications')
      .select('type, payload')
      .eq('client_id', clientId ?? '00000000-0000-0000-0000-000000000000')
      .is('dismissed_at', null)
      .is('read_at', null),
  ])

  const chat = chatCount ?? 0
  const alerts = (coachNotifications ?? []).filter((notification) =>
    isClientInboxNotification({
      type: notification.type as ClientNotificationItem['type'],
      payload: (notification.payload ?? null) as Record<string, unknown> | null,
    }),
  ).length
  return {
    total: chat + alerts,
    chat,
    alerts,
  }
}
