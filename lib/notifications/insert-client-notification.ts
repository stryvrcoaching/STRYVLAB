import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveClientLanguage } from '@/lib/client/resolve-language'
import {
  getClientPushCopy,
  type ClientPushCopyKey,
} from '@/lib/notifications/client-push-copy'
import {
  sendClientPush,
  clientPushPreferenceForKind,
  type ClientPushKind,
  type ClientPushPreferenceKey,
} from '@/lib/notifications/send-client-push'

interface NotificationPayload {
  coachId: string
  clientId: string
  type:
    | 'assessment_sent'
    | 'assessment_completed'
    | 'program_assigned'
    | 'program_updated'
    | 'bilan_received'
    | 'session_reminder'
    | 'payment_received'
  message: string
  submissionId?: string
}

const COPY_KEY_BY_TYPE: Record<
  NotificationPayload['type'],
  ClientPushCopyKey
> = {
  assessment_sent: 'assessment.available',
  assessment_completed: 'assessment.completed',
  bilan_received: 'assessment.available',
  program_assigned: 'workout.available',
  program_updated: 'workout.updated',
  session_reminder: 'session.reminder',
  payment_received: 'payment.received',
}

function resolvePushKind(
  type: NotificationPayload['type'],
): ClientPushKind {
  if (
    type === 'assessment_sent'
    || type === 'assessment_completed'
    || type === 'bilan_received'
  ) {
    return 'bilan'
  }

  if (
    type === 'program_assigned'
    || type === 'program_updated'
  ) {
    return 'program'
  }

  if (type === 'session_reminder') {
    return 'session'
  }

  return type === 'payment_received' ? 'essential' : 'system'
}

function resolveActionUrl(
  type: NotificationPayload['type'],
): string {
  if (
    type === 'assessment_sent'
    || type === 'assessment_completed'
    || type === 'bilan_received'
  ) {
    return '/client/bilans'
  }

  if (
    type === 'program_assigned'
    || type === 'program_updated'
    || type === 'session_reminder'
  ) {
    return '/client/programme'
  }

  return '/client'
}

/**
 * Legacy notification bridge.
 *
 * Stores the historical client_notifications record, then sends a localized
 * push through the central notification transport.
 */
export async function insertClientNotification(
  db: SupabaseClient,
  payload: NotificationPayload,
) {
  const pushKind = resolvePushKind(payload.type)
  const preference = clientPushPreferenceForKind[pushKind]
  if (preference) {
    const { data: preferences } = await db
      .from('client_preferences')
      .select(preference)
      .eq('client_id', payload.clientId)
      .maybeSingle()
    if ((preferences as Partial<Record<ClientPushPreferenceKey, boolean>> | null)?.[preference] === false) {
      return { created: false, pushed: false }
    }
  }

  const { data: clientRow } = await db
    .from('coach_clients')
    .select('user_id')
    .eq('id', payload.clientId)
    .single()

  await db.from('client_notifications').insert({
    coach_id: payload.coachId,
    client_id: payload.clientId,
    submission_id: payload.submissionId ?? null,
    type: payload.type,
    message: payload.message,
    target_user_id: clientRow?.user_id ?? null,
  })

  const lang = await resolveClientLanguage(
    db,
    payload.clientId,
  )

  const copy = getClientPushCopy(
    COPY_KEY_BY_TYPE[payload.type],
    lang,
  )

  const pushed = await sendClientPush(
    db,
    payload.clientId,
    pushKind,
    {
      title: copy.title,
      body: copy.body,
      url: resolveActionUrl(payload.type),
      tag: `stryv-${payload.type}`,
    },
  )

  return { created: true, pushed }
}
