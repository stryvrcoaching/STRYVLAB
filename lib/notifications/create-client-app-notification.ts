import type { SupabaseClient } from '@supabase/supabase-js'
import {
  sendClientPush,
  type ClientPushKind,
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
}

export async function createClientAppNotification(
  db: SupabaseClient,
  params: CreateClientAppNotificationParams,
) {
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

  const payload = {
    ...(params.payload ?? {}),
    ...(params.actionUrl
      ? { action_url: params.actionUrl }
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
  const pushUrl = isCoachMessage
    ? `/client?openCoachMessage=${encodeURIComponent(inserted.id)}`
    : params.actionUrl ?? '/client'
  const actionUrl = isCoachMessage
    ? pushUrl
    : `${pushUrl}${pushUrl.includes('?') ? '&' : '?'}notificationId=${encodeURIComponent(inserted.id)}`

  await db
    .from('coach_client_notifications')
    .update({
      payload: { ...payload, action_url: actionUrl, notification_id: inserted.id },
    })
    .eq('id', inserted.id)

  let badgeCount: number | undefined
  try {
    badgeCount = await getClientAppBadgeCount(db, params.clientId)
  } catch {
    // The push remains useful when the badge calculation is temporarily unavailable.
  }

  await sendClientPush(
    db,
    params.clientId,
    params.pushKind ?? 'system',
    {
      title,
      body,
      url: actionUrl,
      tag:
        params.pushTag
        ?? `stryv-${params.type}-${Date.now()}`,
      badgeCount,
    },
  )
}
