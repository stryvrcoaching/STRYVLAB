import type { SupabaseClient } from '@supabase/supabase-js'

export type ClientNotificationItem = {
  id: string
  type: 'coach_note' | 'bilan_pending' | 'program_assigned' | 'system_reminder' | 'tdee_updated' | 'coach_feedback'
  title: string
  body: string | null
  payload: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

export async function listClientNotificationItems(
  db: SupabaseClient,
  userId: string,
  clientId: string | null,
  unreadOnly = false,
): Promise<ClientNotificationItem[]> {
  const legacyQ = db
    .from('client_notifications')
    .select('id, type, message, read, created_at')
    .eq('target_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (unreadOnly) legacyQ.eq('read', false)

  const { data: legacy } = await legacyQ

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
      .order('created_at', { ascending: false })
      .limit(20)

    if (unreadOnly) q = q.is('read_at', null)

    const { data: coach } = await q
    coachMapped = (coach ?? []).map((n) => ({
      id: n.id,
      type: n.type as ClientNotificationItem['type'],
      title: n.title,
      body: n.body,
      payload: (n.payload ?? null) as Record<string, unknown> | null,
      read_at: n.read_at,
      created_at: n.created_at,
    }))
  }

  return [...legacyMapped, ...coachMapped]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20)
}

export async function getClientInboxUnreadCount(
  db: SupabaseClient,
  _userId: string,
  clientId: string | null,
): Promise<{ total: number; chat: number; alerts: number }> {
  const { count: chatCount } = await db
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'assistant')
    .eq('client_id', clientId ?? '00000000-0000-0000-0000-000000000000')
    .is('archived_at', null)
    .is('seen_at', null)

  const chat = chatCount ?? 0
  return {
    total: chat,
    chat,
    alerts: 0,
  }
}
