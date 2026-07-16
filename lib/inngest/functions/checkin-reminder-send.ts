import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'
import { computePhysiologicalDateInTimezone } from '@/lib/client/checkin/timeWindows'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CHECKIN_COPY = {
  morning: {
    copyKey: 'checkin.morning',
  },
  evening: {
    copyKey: 'checkin.evening',
  },
} as const

export const checkinReminderSendFunction = inngest.createFunction(
  { id: 'checkin-reminder-send', retries: 1, triggers: [{ cron: '* * * * *' }] },
  async ({ step }) => {
    await step.run('send-push-reminders', async () => {
      const { data: schedules } = await service()
        .from('daily_checkin_schedules')
        .select('client_id, moment, scheduled_time, timezone')

      if (!schedules || schedules.length === 0) return { sent: 0 }

      const clientIds = schedules.map((s) => s.client_id)
      const { data: configs } = await service()
        .from('daily_checkin_configs')
        .select('client_id, days_of_week')
        .in('client_id', clientIds)
        .eq('is_active', true)

      const activeIds = Array.from(
        new Set((configs ?? []).map((c) => c.client_id as string))
      )
      if (activeIds.length === 0) return { sent: 0 }

      const configByClient = new Map(
        (configs ?? []).map((c) => [c.client_id as string, (c.days_of_week as number[]) ?? []])
      )

      const now = new Date()
      const toHHMM = (date: Date, timezone: string) =>
        new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: timezone,
        }).format(date)
      const toDay = (date: Date, timezone: string) => {
        const js = new Intl.DateTimeFormat('en-US', {
          weekday: 'short',
          timeZone: timezone,
        }).format(date)
        const map: Record<string, number> = {
          Mon: 0,
          Tue: 1,
          Wed: 2,
          Thu: 3,
          Fri: 4,
          Sat: 5,
          Sun: 6,
        }
        return map[js] ?? 0
      }

      let sent = 0
      for (const schedule of schedules) {
        const clientId = schedule.client_id as string
        const timezone = (schedule.timezone as string) || 'Europe/Paris'
        const clientDays = configByClient.get(clientId) ?? []
        const clientDay = toDay(now, timezone)
        if (!clientDays.includes(clientDay)) continue

        const current = toHHMM(now, timezone)
        const minusOne = toHHMM(new Date(now.getTime() - 60000), timezone)
        const plusOne = toHHMM(new Date(now.getTime() + 60000), timezone)
        const scheduled = String(schedule.scheduled_time).slice(0, 5)
        if (![current, minusOne, plusOne].includes(scheduled)) continue

        const moment =
          schedule.moment as keyof typeof CHECKIN_COPY
        const config = CHECKIN_COPY[moment]
        if (!config) continue

        const date = computePhysiologicalDateInTimezone(now, timezone)

        const db = service()
        const tag = `stryv-checkin-${clientId}-${moment}-${date}`
        const { data: existing } = await db
          .from('coach_client_notifications')
          .select('id')
          .eq('client_id', clientId)
          .eq('type', 'system_reminder')
          .contains('payload', { event: 'checkin_reminder', date, moment })
          .limit(1)

        if (existing?.length) continue

        try {
          await createClientAppNotification(db, {
            clientId,
            coachId: null,
            type: 'system_reminder',
            copyKey: config.copyKey,
            actionUrl: `/client?openCheckin=${moment}&date=${encodeURIComponent(date)}`,
            payload: { event: 'checkin_reminder', date, moment, push_tag: tag },
            pushKind: 'checkin',
            pushTag: tag,
          })
          sent++
        } catch {
          // A failed push must not stop reminders for other clients.
        }
      }

      return { sent }
    })
  }
)
