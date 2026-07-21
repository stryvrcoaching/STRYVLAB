import type { SupabaseClient } from '@supabase/supabase-js'

import {
  bucketForNotification,
  isClientInboxNotification,
  isCoachChatNotification,
  isHomeSystemNotification,
  isNutritionNotification,
  isWorkoutNotification,
  isPersistentHomeAction,
} from '@/lib/client/notificationBuckets'
import { buildChatTodayStrip } from '@/lib/client/chat/today-strip'
import { countLiveNutritionAlerts } from '@/lib/client/smart/countLiveNutritionAlerts'

export type ClientNotificationItem = {
  id: string
  type:
    | 'coach_note'
    | 'coach_message'
    | 'bilan_pending'
    | 'program_assigned'
    | 'program_updated'
    | 'system_reminder'
    | 'tdee_updated'
    | 'coach_feedback'
  title: string
  body: string | null
  payload: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

export {
  isClientInboxNotification,
  isCoachChatNotification,
  isHomeSystemNotification,
  isNutritionNotification,
  isWorkoutNotification,
  isPersistentHomeAction,
  bucketForNotification,
} from '@/lib/client/notificationBuckets'

/** @deprecated use isHomeSystemNotification */
export function isHomeAlertNotification(
  notification: Pick<ClientNotificationItem, 'type' | 'payload'>,
): boolean {
  return isHomeSystemNotification(notification)
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
        .not(
          'type',
          'in',
          '("session_reminder", "assessment_completed", "payment_received")',
        )
        .order('created_at', { ascending: false })
        .limit(100)
    : null

  if (legacyQuery && unreadOnly) legacyQuery.eq('read', false)
  if (legacyQuery && options.createdAfter)
    legacyQuery.gte('created_at', options.createdAfter)

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
      .in('type', [
        'coach_note',
        'coach_message',
        'bilan_pending',
        'program_assigned',
        'program_updated',
        'system_reminder',
        'tdee_updated',
        'coach_feedback',
      ])
      .order('created_at', { ascending: false })
      .limit(100)

    if (unreadOnly) q = q.is('read_at', null)
    if (options.createdAfter) q = q.gte('created_at', options.createdAfter)

    const { data: coach } = await q
    coachMapped = (coach ?? [])
      .map((n) => ({
        id: n.id,
        type: n.type as ClientNotificationItem['type'],
        title: n.title,
        body: n.body,
        payload: (n.payload ?? null) as Record<string, unknown> | null,
        read_at: n.read_at,
        created_at: n.created_at,
      }))
      .filter(
        (n) =>
          isClientInboxNotification(n) ||
          isCoachChatNotification(n) ||
          isNutritionNotification(n) ||
          isWorkoutNotification(n),
      )
  }

  return [...legacyMapped, ...coachMapped]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 40)
}

export type ClientBadgeBreakdown = {
  total: number
  chat: number
  home: number
  nutrition: number
  workout: number
  alerts: number
}

export async function getClientInboxUnreadCount(
  db: SupabaseClient,
  _userId: string,
  clientId: string | null,
): Promise<ClientBadgeBreakdown> {
  if (!clientId) {
    return { total: 0, chat: 0, home: 0, nutrition: 0, workout: 0, alerts: 0 }
  }

  // Align with Accueil feed window (~7 days) so the badge matches visible items
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: chatCount },
    { data: coachNotifications },
    strip,
    pendingBilans,
    nextAppointment,
  ] = await Promise.all([
    db
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'assistant')
      .eq('from_coach_human', true)
      .eq('client_id', clientId)
      .is('archived_at', null)
      .is('seen_at', null),
    db
      .from('coach_client_notifications')
      .select('type, payload, read_at, created_at')
      .eq('client_id', clientId)
      .is('dismissed_at', null)
      .gte('created_at', since),
    buildChatTodayStrip(db, clientId).catch(() => null),
    db
      .from('assessment_responses')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'pending'),
    db
      .from('coaching_appointments')
      .select('id')
      .eq('client_id', clientId)
      .gte('starts_at', new Date().toISOString())
      .lte('starts_at', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString())
      .not('status', 'in', '("cancelled")')
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const chat = chatCount ?? 0

  // Live day-ops alerts (protein lag, hydration, …) — same source as Nutrition page
  const liveNutritionAlerts = await countLiveNutritionAlerts(db, clientId)

  let homeFromNotifs = 0
  let nutritionFromNotifs = 0
  let workoutFromNotifs = 0

  for (const row of coachNotifications ?? []) {
    const n = {
      type: row.type as ClientNotificationItem['type'],
      payload: (row.payload ?? null) as Record<string, unknown> | null,
    }
    const bucket = bucketForNotification(n)
    // Home badge: only rows the Accueil section would surface
    // (persistent system actions, or unread non-nutrition / non-chat).
    if (bucket === 'home') {
      if (isPersistentHomeAction(n) || !row.read_at) {
        homeFromNotifs += 1
      }
    }
    // Nutrition inbox notifs that are not already represented as live day alerts
    // (e.g. tdee_updated). Skip operational hydration/protein reminder spam.
    if (bucket === 'nutrition' && !row.read_at) {
      const event =
        typeof n.payload?.event === 'string' ? n.payload.event : null
      const isLiveDayOps =
        event === 'hydration_low' ||
        event === 'hydration_reminder' ||
        event === 'protein_reminder' ||
        event === 'meal_reminder' ||
        event === 'nutrition_alert' ||
        (event?.includes('hydration') ?? false) ||
        (event?.includes('protein') ?? false)
      if (!isLiveDayOps) {
        nutritionFromNotifs += 1
      }
    }
    if (bucket === 'workout' && !row.read_at) workoutFromNotifs += 1
  }

  const checkinPending = strip?.checkin?.pendingCount ?? 0
  const bilansPending = pendingBilans.count ?? 0
  const hasPendingSession = Boolean(strip?.sessions.some((session) => !session.completed))
  const hasUpcomingAppointment = Boolean(nextAppointment?.id)
  const hasBilanNotif = (coachNotifications ?? []).some(
    (r) => r.type === 'bilan_pending',
  )
  // Don't double-count check-in / bilans already present as notif rows
  const home =
    homeFromNotifs +
    // Check-in reminders are delivery records. Count the real, current
    // outstanding slot instead, so reminders from past days cannot persist.
    (checkinPending > 0 ? 1 : 0) +
    (bilansPending > 0 && !hasBilanNotif ? 1 : 0) +
    // The Accueil panel also surfaces the current session and the next
    // upcoming appointment even when neither has an unread notification row.
    (hasPendingSession ? 1 : 0) +
    (hasUpcomingAppointment ? 1 : 0)

  // Nutrition tab badge = live page alerts + non-duplicate inbox nutrition signals
  const nutrition = liveNutritionAlerts + nutritionFromNotifs

  const workout = workoutFromNotifs
  const total = chat + home + nutrition + workout

  return {
    total,
    chat,
    home,
    nutrition,
    workout,
    alerts: home,
  }
}
