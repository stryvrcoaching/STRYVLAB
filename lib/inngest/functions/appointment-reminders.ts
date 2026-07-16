/**
 * lib/inngest/functions/appointment-reminders.ts
 *
 * Cron toutes les 5 minutes : envoie les rappels de rendez-vous en attente.
 * Protection contre les doublons via coaching_appointment_notification_deliveries.
 */

import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'
import { markDeliverySent } from '@/lib/appointments/notifications'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export const appointmentRemindersFunction = inngest.createFunction(
  { id: 'appointment-reminders', retries: 1, triggers: [{ cron: '*/5 * * * *' }] },
  async ({ step }) =>
    step.run('send-appointment-reminders', async () => {
      const db = service()
      const now = new Date()

      // Récupère les livraisons en attente dont l'heure est passée
      const { data: pending, error } = await db
        .from('coaching_appointment_notification_deliveries')
        .select(`
          id,
          appointment_id,
          channel,
          kind,
          scheduled_for,
          coaching_appointments (
            id,
            title,
            starts_at,
            ends_at,
            coach_id,
            client_id,
            meeting_url,
            meeting_kind,
            status
          )
        `)
        .eq('status', 'pending')
        .in('kind', ['reminder_24h', 'reminder_1h'])
        .lte('scheduled_for', now.toISOString())
        .limit(100)

      if (error) {
        console.error('[appointment-reminders] fetch error', error)
        return { sent: 0, error: error.message }
      }

      let sent = 0

      for (const delivery of pending ?? []) {
        const appt = (delivery as any).coaching_appointments
        if (!appt) continue

        // Ne pas envoyer si le rendez-vous est annulé, complété ou passé
        if (['cancelled', 'completed', 'no_show'].includes(appt.status)) {
          await db
            .from('coaching_appointment_notification_deliveries')
            .update({ status: 'cancelled' })
            .eq('id', delivery.id)
          continue
        }

        // Ne pas envoyer si le rendez-vous est déjà passé (ex. créé après l'heure)
        if (new Date(appt.starts_at) < now) {
          await db
            .from('coaching_appointment_notification_deliveries')
            .update({ status: 'cancelled' })
            .eq('id', delivery.id)
          continue
        }

        try {
          // Récupère l'utilisateur client
          const { data: clientRow } = await db
            .from('coach_clients')
            .select('id, user_id, coach_id')
            .eq('id', appt.client_id)
            .single()

          if (!clientRow?.user_id) continue

          if (delivery.channel === 'in_app' || delivery.channel === 'push') {
            const isRemind24 = delivery.kind === 'reminder_24h'
            const timeLabel = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' }).format(
              new Date(appt.starts_at),
            )

            await createClientAppNotification(db, {
              clientId: clientRow.id,
              coachId: clientRow.coach_id ?? null,
              type: 'appointment',
              title: isRemind24 ? '⏰ Rappel — demain' : '⏰ Rappel — dans 1 heure',
              body: isRemind24
                ? `${appt.title} à ${timeLabel}`
                : `${appt.title} commence bientôt.`,
              actionUrl: `/client/rendez-vous/${appt.id}`,
              pushKind: 'system',
              pushTag: `stryv-appt-${appt.id}-${delivery.kind}`,
            })
          }

          // Marque comme envoyé
          await markDeliverySent(
            db,
            delivery.appointment_id,
            delivery.channel as 'in_app' | 'push' | 'email',
            delivery.kind as any,
            new Date(delivery.scheduled_for),
          )

          sent++
        } catch (err) {
          console.error('[appointment-reminders] send error', {
            deliveryId: delivery.id,
            error: err instanceof Error ? err.message : String(err),
          })

          await db
            .from('coaching_appointment_notification_deliveries')
            .update({
              status: 'failed',
              error: err instanceof Error ? err.message : String(err),
            })
            .eq('id', delivery.id)
        }
      }

      return { sent, total: pending?.length ?? 0 }
    }),
)
