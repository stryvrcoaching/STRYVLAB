/**
 * Client notification routing — where each signal lives in the UI.
 *
 * - chat       → Messagerie coach (header button only)
 * - nutrition  → Nutrition tab badge (+ nutrition page)
 * - home       → Accueil « Notifications » section (system actions)
 */

export type ClientNotificationType =
  | 'coach_note'
  | 'coach_message'
  | 'bilan_pending'
  | 'program_assigned'
  | 'program_updated'
  | 'system_reminder'
  | 'tdee_updated'
  | 'coach_feedback'

export type NotificationLike = {
  type: ClientNotificationType | string
  payload: Record<string, unknown> | null
}

export type NotificationBucket = 'chat' | 'nutrition' | 'workout' | 'home'

const TRANSIENT_REMINDER_EVENTS = new Set([
  'checkin_reminder',
  'hydration_reminder',
  'session_reminder',
  'meal_reminder',
  'protein_reminder',
])

const NUTRITION_EVENTS = new Set([
  'tdee_updated',
  'hydration_low',
  'hydration_reminder',
  'meal_reminder',
  'protein_reminder',
  'nutrition_alert',
])

const WORKOUT_EVENTS = new Set([
  'personal_record',
  'mesocycle_start',
  'weekly_goal_reached',
  'weekly_goal_at_risk',
])

const HOME_SYSTEM_EVENTS = new Set([
  'payment_reminder',
  'appointment_reminder',
  'appointment_scheduled',
  'appointment_confirmed',
  'appointment_upcoming',
  'appointment_awaiting_confirmation',
])

export function isCoachChatNotification(n: NotificationLike): boolean {
  return (
    n.type === 'coach_message' ||
    n.payload?.message_kind === 'coach_message'
  )
}

/** Items kept in the product inbox (excludes pure chat which uses chat_messages). */
export function isClientInboxNotification(n: NotificationLike): boolean {
  if (isCoachChatNotification(n)) return false

  return !(
    n.type === 'system_reminder' &&
    typeof n.payload?.event === 'string' &&
    TRANSIENT_REMINDER_EVENTS.has(n.payload.event)
  )
}

export function isNutritionNotification(n: NotificationLike): boolean {
  if (n.type === 'tdee_updated') return true
  const event = typeof n.payload?.event === 'string' ? n.payload.event : null
  if (event && NUTRITION_EVENTS.has(event)) return true
  if (
    event &&
    (event.includes('hydration') ||
      event.includes('meal') ||
      event.includes('protein') ||
      event.includes('nutrition') ||
      event.includes('tdee'))
  ) {
    return true
  }
  return false
}

export function isWorkoutNotification(n: NotificationLike): boolean {
  const event = typeof n.payload?.event === 'string' ? n.payload.event : null
  return Boolean(event && WORKOUT_EVENTS.has(event))
}

/**
 * System actions that must stay on Accueil until the user completes them.
 * Clicking should open the action — not permanently hide an incomplete task.
 */
export function isPersistentHomeAction(n: NotificationLike): boolean {
  if (n.type === 'bilan_pending') return true
  const event = typeof n.payload?.event === 'string' ? n.payload.event : null
  if (event === 'payment_reminder') return true
  if (event && event.includes('appointment')) return true
  if (typeof n.payload?.payment_id === 'string') return true
  return false
}

/**
 * Returns only the notification rows that can safely leave the inbox after a
 * bulk "mark as read". Persistent actions deliberately stay visible.
 */
export function getMarkableNotificationIds(
  notifications: Array<NotificationLike & { id: string }>,
): string[] {
  return notifications
    .filter((notification) => !isPersistentHomeAction(notification))
    .map((notification) => notification.id)
}

/**
 * Accueil « Notifications » — actionable system signals.
 * Excludes coach chat (messagerie) and nutrition ops (nutrition tab).
 */
export function isHomeSystemNotification(n: NotificationLike): boolean {
  if (isCoachChatNotification(n)) return false
  if (isNutritionNotification(n)) return false
  if (isWorkoutNotification(n)) return false

  if (n.type === 'bilan_pending') return true
  if (n.type === 'program_assigned' || n.type === 'program_updated') return true
  if (n.type === 'coach_feedback' || n.type === 'coach_note') return true

  if (n.type === 'system_reminder') {
    const event = typeof n.payload?.event === 'string' ? n.payload.event : null
    // Check-ins are represented by the live pending slot on Accueil. Their
    // delivery notifications are historical reminders, not inbox work items;
    // keeping them here would make past days accumulate in the badge.
    if (event === 'checkin_reminder') return false
    if (!event) return true
    if (HOME_SYSTEM_EVENTS.has(event)) return true
    if (event === 'payment_reminder' || event.includes('payment')) return true
    if (
      event.includes('appointment') ||
      event.includes('rendez') ||
      event.includes('rdv')
    ) {
      return true
    }
    if (
      event.endsWith('_reminder') &&
      event !== 'payment_reminder' &&
      event !== 'checkin_reminder'
    ) {
      return false
    }
    return isClientInboxNotification(n)
  }

  return false
}

export function bucketForNotification(
  n: NotificationLike,
): NotificationBucket | null {
  if (isCoachChatNotification(n)) return 'chat'
  if (isNutritionNotification(n)) return 'nutrition'
  if (isWorkoutNotification(n)) return 'workout'
  if (isHomeSystemNotification(n)) return 'home'
  return null
}
