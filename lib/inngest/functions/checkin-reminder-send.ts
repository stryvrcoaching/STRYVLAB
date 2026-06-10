import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const MOMENT_LABELS: Record<string, { title: string; body: string; url: string }> = {
  morning: {
    title: 'Check-in du matin',
    body: "Comment s'est passée ta nuit ?",
    url: '/client/checkin/morning',
  },
  evening: {
    title: 'Check-in du soir',
    body: 'Comment tu te sens ce soir ?',
    url: '/client/checkin/evening',
  },
}

export const checkinReminderSendFunction = inngest.createFunction(
  { id: 'checkin-reminder-send', retries: 1, triggers: [{ cron: '* * * * *' }] },
  async ({ step }) => {
    await step.run('send-push-reminders', async () => {
      const vapidPublic = process.env.VAPID_PUBLIC_KEY
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY
      const vapidSubject = process.env.VAPID_SUBJECT

      if (!vapidPublic || !vapidPrivate || !vapidSubject) {
        return { sent: 0, reason: 'vapid_not_configured' }
      }

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

      const { data: clients } = await service()
        .from('coach_clients')
        .select('id, push_token')
        .in('id', activeIds)
        .not('push_token', 'is', null)

      if (!clients || clients.length === 0) return { sent: 0 }

      const pushMap = new Map(clients.map((c) => [c.id as string, c.push_token as string]))

      // Dynamic import to avoid bundling web-push in non-cron paths
      const webpush = await import('web-push').then((m) => m.default ?? m)
      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

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

        const token = pushMap.get(schedule.client_id as string)
        if (!token) continue

        const payload = MOMENT_LABELS[schedule.moment as string]
        if (!payload) continue

        try {
          await webpush.sendNotification(
            JSON.parse(token),
            JSON.stringify(payload)
          )
          sent++
        } catch {
          await service()
            .from('coach_clients')
            .update({ push_token: null })
            .eq('id', schedule.client_id)
        }
      }

      return { sent }
    })
  }
)
