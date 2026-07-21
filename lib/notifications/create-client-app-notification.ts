import type { SupabaseClient } from '@supabase/supabase-js'
import {
  sendClientPush,
  clientPushPreferenceForKind,
  type ClientPushKind,
  type ClientPushPreferenceKey,
} from '@/lib/notifications/send-client-push'
import {
  getClientPushCopy,
  type ClientPushCopyKey,
  type ClientPushCopyParams,
} from '@/lib/notifications/client-push-copy'
import { resolveClientLanguage } from '@/lib/client/resolve-language'
import { getClientAppBadgeCount } from '@/lib/client/appBadgeCount'

type ClientAppNotificationType =
  | 'program_assigned'
  | 'program_updated'
  | 'system_reminder'
  | 'tdee_updated'
  | 'coach_feedback'
  | 'coach_note'
  | 'coach_message'
  | 'bilan_pending'

type CreateClientAppNotificationParams = {
  clientId: string
  coachId: string | null
  type: ClientAppNotificationType

  /**
   * Nouveau système centralisé.
   * Préférer copyKey pour toutes les notifications client.
   */
  copyKey?: ClientPushCopyKey
  copyParams?: ClientPushCopyParams

  /**
   * Compatibilité temporaire avec les anciens appels.
   * À supprimer après migration complète des notifications.
   */
  title?: string
  body?: string | null

  actionUrl?: string | null
  payload?: Record<string, unknown> | null
  pushKind?: ClientPushKind
  pushTag?: string | null
  /** Used only for device-level push tests and other explicit system actions. */
  bypassPreference?: boolean
}

function isExternalUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://')
}

/**
 * Append notificationId only on in-app (relative) paths.
 * Never mutate external URLs (Stripe Checkout breaks with extra params / PWA navigation).
 */
function withNotificationTracking(url: string, notificationId: string): string {
  if (isExternalUrl(url)) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}notificationId=${encodeURIComponent(notificationId)}`
}

export async function createClientAppNotification(
  db: SupabaseClient,
  params: CreateClientAppNotificationParams,
) {
  const pushKind = params.pushKind ?? 'system'
  const preference = clientPushPreferenceForKind[pushKind]

  // A notification setting controls both its in-app card and its push. The
  // underlying content (programme, chat, bilan…) stays accessible normally.
  if (!params.bypassPreference && preference) {
    const { data: preferences } = await db
      .from('client_preferences')
      .select(preference)
      .eq('client_id', params.clientId)
      .maybeSingle()
    if ((preferences as Partial<Record<ClientPushPreferenceKey, boolean>> | null)?.[preference] === false) {
      return { created: false, pushed: false }
    }
  }

  const lang = await resolveClientLanguage(db, params.clientId)

  const localizedCopy = params.copyKey
    ? getClientPushCopy(
        params.copyKey,
        lang,
        params.copyParams,
      )
    : null

  const title = localizedCopy?.title ?? params.title?.trim()
  const body = localizedCopy?.body ?? params.body?.trim() ?? ''

  if (!title) {
    throw new Error(
      '[client-notification] copyKey or title is required',
    )
  }

  // Prefer in-app destinations. External Stripe URLs must not be the primary
  // action_url for the PWA (standalone webviews break Checkout).
  const requestedAction = params.actionUrl?.trim() || null
  const safeActionUrl =
    requestedAction && isExternalUrl(requestedAction)
      ? '/client/paiement'
      : requestedAction

  const payload = {
    ...(params.payload ?? {}),
    ...(safeActionUrl ? { action_url: safeActionUrl } : {}),
    ...(requestedAction && isExternalUrl(requestedAction)
      ? { external_payment_url: requestedAction }
      : {}),
  }

  const { data: inserted, error } = await db
    .from('coach_client_notifications')
    .insert({
      client_id: params.clientId,
      coach_id: params.coachId,
      type: params.type,
      title,
      body: body || null,
      payload,
    })
    .select('id')
    .single()

  if (error) throw error

  const isCoachMessage =
    (params.type === 'coach_note' || params.type === 'coach_message')
    && params.payload?.message_kind === 'coach_message'

  const basePushUrl = isCoachMessage
    ? `/client?openCoachMessage=${encodeURIComponent(inserted.id)}`
    : safeActionUrl ?? '/client'

  const actionUrl = isCoachMessage
    ? basePushUrl
    : withNotificationTracking(basePushUrl, inserted.id)

  const notificationPayload = { ...payload, action_url: actionUrl, notification_id: inserted.id }

  await db
    .from('coach_client_notifications')
    .update({
      payload: notificationPayload,
    })
    .eq('id', inserted.id)

  let badgeCount: number | undefined
  try {
    badgeCount = await getClientAppBadgeCount(db, params.clientId)
  } catch {
    // The push remains useful when the badge calculation is temporarily unavailable.
  }

  const pushed = await sendClientPush(
    db,
    params.clientId,
    pushKind,
    {
      title,
      body,
      url: actionUrl,
      tag:
        params.pushTag
        ?? `stryv-${params.type}-${Date.now()}`,
      badgeCount,
    },
    { bypassPreference: params.bypassPreference },
  )

  // Keep a delivery trace with the in-app notification. A scheduled reminder
  // must not look delivered just because its card was created successfully.
  // This also gives the client settings screen a useful, actionable signal
  // when a subscription, VAPID configuration or browser endpoint fails.
  await db
    .from('coach_client_notifications')
    .update({
      payload: {
        ...notificationPayload,
        push_delivery: {
          status: pushed ? 'sent' : 'failed',
          attempted_at: new Date().toISOString(),
          kind: pushKind,
        },
      },
    })
    .eq('id', inserted.id)

  return { notificationId: inserted.id, created: true, pushed }
}
