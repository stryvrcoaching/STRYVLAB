/**
 * lib/appointments/notifications.ts
 *
 * Logique de notification pour les rendez-vous coach–client.
 * - scheduleAppointmentNotifications : programme livraisons in-app, push, email
 * - cancelPendingDeliveries : annule les rappels obsolètes
 *
 * La déduplication est assurée par la contrainte unique de
 * coaching_appointment_notification_deliveries(appointment_id, channel, kind, scheduled_for).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'
import type { CoachingAppointment } from '@/lib/appointments/types'
import type { NotificationKind } from '@/lib/appointments/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retourne le timestamp pour un rappel N minutes avant le début. */
function reminderAt(startsAt: string, minutesBefore: number): Date {
  return new Date(new Date(startsAt).getTime() - minutesBefore * 60_000)
}

/** Enregistre une livraison dans la table de suivi si elle n'existe pas déjà. */
async function trackDelivery(
  db: SupabaseClient,
  appointmentId: string,
  channel: 'in_app' | 'push' | 'email',
  kind: NotificationKind,
  scheduledFor: Date,
): Promise<boolean> {
  const { error } = await db
    .from('coaching_appointment_notification_deliveries')
    .insert({
      appointment_id: appointmentId,
      channel,
      kind,
      scheduled_for: scheduledFor.toISOString(),
      status: 'pending',
    })
    .select('id')
    .single()

  // Conflit unique = déjà enregistrée
  if (error?.code === '23505') return false
  if (error) throw error
  return true
}

/** Marque une livraison comme envoyée. */
export async function markDeliverySent(
  db: SupabaseClient,
  appointmentId: string,
  channel: 'in_app' | 'push' | 'email',
  kind: NotificationKind,
  scheduledFor: Date,
  providerMessageId?: string,
): Promise<void> {
  await db
    .from('coaching_appointment_notification_deliveries')
    .update({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: providerMessageId ?? null })
    .eq('appointment_id', appointmentId)
    .eq('channel', channel)
    .eq('kind', kind)
    .eq('scheduled_for', scheduledFor.toISOString())
}

// ─── Annulation ───────────────────────────────────────────────────────────────

/** Annule les livraisons en attente pour un rendez-vous (optionnellement filtrées par kind). */
export async function cancelPendingDeliveries(
  db: SupabaseClient,
  appointmentId: string,
  kinds?: NotificationKind[],
): Promise<void> {
  let query = db
    .from('coaching_appointment_notification_deliveries')
    .update({ status: 'cancelled' })
    .eq('appointment_id', appointmentId)
    .eq('status', 'pending')

  if (kinds?.length) {
    query = query.in('kind', kinds)
  }

  await query
}

// ─── Notification in-app client ───────────────────────────────────────────────

async function notifyClientInApp(
  db: SupabaseClient,
  appt: CoachingAppointment,
  clientUserId: string,
  kind: NotificationKind,
): Promise<void> {
  const clientRow = await db
    .from('coach_clients')
    .select('id, coach_id')
    .eq('user_id', clientUserId)
    .single()
    .then((r) => r.data)

  if (!clientRow) return

  const kindLabels: Record<NotificationKind, { title: string; body: string }> = {
    created: {
      title: '📅 Nouveau rendez-vous',
      body: `${appt.title} — ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(appt.starts_at))}`,
    },
    updated: {
      title: '🔄 Rendez-vous modifié',
      body: `${appt.title} — nouveau créneau : ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(appt.starts_at))}`,
    },
    cancelled: {
      title: '❌ Rendez-vous annulé',
      body: `${appt.title} a été annulé par votre coach.`,
    },
    reminder_24h: {
      title: '⏰ Rappel — demain',
      body: `${appt.title} à ${new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' }).format(new Date(appt.starts_at))}`,
    },
    reminder_1h: {
      title: '⏰ Rappel — dans 1 heure',
      body: `${appt.title} commence bientôt.`,
    },
    reschedule_requested: {
      title: 'Report demandé',
      body: `Votre client a demandé un report pour "${appt.title}".`,
    },
  }

  const copy = kindLabels[kind]
  await createClientAppNotification(db, {
    clientId: clientRow.id,
    coachId: clientRow.coach_id ?? null,
    type: 'appointment',
    title: copy.title,
    body: copy.body,
    actionUrl: `/client/rendez-vous/${appt.id}`,
    pushKind: 'essential',
    pushTag: `stryv-appt-${appt.id}-${kind}`,
  })
}

// ─── Point d'entrée principal ─────────────────────────────────────────────────

/**
 * Programme les livraisons de notifications pour un rendez-vous.
 * Appelé immédiatement après création/modification.
 *
 * @param kind  'created' | 'updated' | 'cancelled'
 */
export async function scheduleAppointmentNotifications(
  db: SupabaseClient,
  appt: CoachingAppointment,
  clientUserId: string | null | undefined,
  kind: Extract<NotificationKind, 'created' | 'updated' | 'cancelled'>,
): Promise<void> {
  if (!clientUserId) return

  const now = new Date()
  const scheduledFor = now // Les livraisons immédiates sont programmées pour maintenant

  // ── Notification immédiate in-app ──────────────────────────────────────────
  const isNew = await trackDelivery(db, appt.id, 'in_app', kind, scheduledFor)
  if (isNew) {
    await notifyClientInApp(db, appt, clientUserId, kind).catch((err) =>
      console.error('[appointments/notifications] in-app error', err),
    )
    await markDeliverySent(db, appt.id, 'in_app', kind, scheduledFor)
  }

  // ── Rappels (uniquement pour les créations et modifications) ───────────────
  if (kind === 'cancelled') return

  const starts = new Date(appt.starts_at)

  // Rappel 24h
  const remind24 = reminderAt(appt.starts_at, 24 * 60)
  if (remind24 > now) {
    await trackDelivery(db, appt.id, 'in_app', 'reminder_24h', remind24).catch(() => null)
    await trackDelivery(db, appt.id, 'push', 'reminder_24h', remind24).catch(() => null)
    await trackDelivery(db, appt.id, 'email', 'reminder_24h', remind24).catch(() => null)
  }

  // Rappel 1h
  const remind1h = reminderAt(appt.starts_at, 60)
  if (remind1h > now && starts > now) {
    await trackDelivery(db, appt.id, 'in_app', 'reminder_1h', remind1h).catch(() => null)
    await trackDelivery(db, appt.id, 'push', 'reminder_1h', remind1h).catch(() => null)
  }
}
