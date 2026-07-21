import type { SupabaseClient } from '@supabase/supabase-js'
import { isClientAppEnabledForCoach } from '@/lib/billing/assertClientAppEnabled'

export type ClientPushKind =
  | 'session'
  | 'bilan'
  | 'program'
  | 'hydration'
  | 'meal'
  | 'protein'
  | 'checkin'
  | 'coach_message'
  | 'system'
  | 'essential'

type ClientPushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
  badgeCount?: number
}

export type ClientPushPreferenceKey =
  | 'notif_session_reminder'
  | 'notif_bilan_received'
  | 'notif_program_updated'
  | 'notif_checkin_reminder'
  | 'notif_hydration_reminder'
  | 'notif_meal_reminder'
  | 'notif_protein_reminder'
  | 'notif_coach_messages'
  | 'notif_progress_updates'

type ClientPushPreferences = Partial<
  Record<ClientPushPreferenceKey, boolean | null>
>

export const clientPushPreferenceForKind: Record<
  ClientPushKind,
  ClientPushPreferenceKey | null
> = {
  session: 'notif_session_reminder',
  bilan: 'notif_bilan_received',
  program: 'notif_program_updated',
  checkin: 'notif_checkin_reminder',
  coach_message: 'notif_coach_messages',
  hydration: 'notif_hydration_reminder',
  meal: 'notif_meal_reminder',
  protein: 'notif_protein_reminder',
  system: 'notif_progress_updates',
  // Appointment and payment notices are transactional. They remain active
  // independently from the optional progression/rewards notification setting.
  essential: null,
}

export async function sendClientPush(
  db: SupabaseClient,
  clientId: string,
  kind: ClientPushKind,
  payload: ClientPushPayload,
  options: { bypassPreference?: boolean } = {},
): Promise<boolean> {
  const [{ data: client }, { data: preferences }] = await Promise.all([
    db.from('coach_clients').select('push_token, coach_id').eq('id', clientId).maybeSingle(),
    db.from('client_preferences').select('notif_session_reminder, notif_bilan_received, notif_program_updated, notif_checkin_reminder, notif_hydration_reminder, notif_meal_reminder, notif_protein_reminder, notif_coach_messages, notif_progress_updates').eq('client_id', clientId).maybeSingle(),
  ])

  if (!client?.push_token) {
    console.warn('[client-push] missing subscription', { clientId, kind })
    return false
  }

  // A client whose coach no longer has the STRYVR entitlement must not receive
  // an invitation, reminder or message notification from the disabled app.
  if (!client.coach_id || !(await isClientAppEnabledForCoach(db, client.coach_id))) {
    console.info('[client-push] skipped because client app access is disabled', { clientId, kind })
    return false
  }
  const preference = clientPushPreferenceForKind[kind]
  const typedPreferences =
    preferences as ClientPushPreferences | null

  if (
    !options.bypassPreference
    && preference
    && typedPreferences?.[preference] === false
  ) {
    console.info('[client-push] disabled by client preference', { clientId, kind, preference })
    return false
  }

  const vapidPublic = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT
  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    console.error('[client-push] VAPID configuration missing', {
      clientId,
      kind,
      hasPublic: Boolean(vapidPublic),
      hasPrivate: Boolean(vapidPrivate),
      hasSubject: Boolean(vapidSubject),
    })
    return false
  }

  try {
    const webpush = await import('web-push').then((module) => module.default ?? module)
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
    await webpush.sendNotification(
      JSON.parse(client.push_token as string),
      JSON.stringify(payload),
    )
    return true
  } catch (error) {
    const statusCode = (error as { statusCode?: number })?.statusCode
    console.error('[client-push] send failed', {
      clientId,
      kind,
      statusCode,
      message: error instanceof Error ? error.message : String(error),
    })
    if (statusCode === 404 || statusCode === 410 || error instanceof SyntaxError) {
      await db.from('coach_clients').update({ push_token: null }).eq('id', clientId)
    }
    return false
  }
}
