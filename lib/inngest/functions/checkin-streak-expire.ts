import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { shouldResetStreak } from '@/lib/checkins/streak'
import type { StreakState } from '@/lib/checkins/streak'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const checkinStreakExpireFunction = inngest.createFunction(
  { id: 'checkin-streak-expire', retries: 2, triggers: [{ cron: '0 2 * * *' }] },
  async ({ step }) => {
    await step.run('expire-missed-streaks', async () => {
      const { data: configs } = await service()
        .from('daily_checkin_configs')
        .select('client_id, days_of_week')
        .eq('is_active', true)

      if (!configs || configs.length === 0) return { reset: 0 }

      const clientIds = configs.map((c) => c.client_id)
      const { data: streaks } = await service()
        .from('client_streaks')
        .select('client_id, current_streak, longest_streak, last_checkin_date')
        .in('client_id', clientIds)
        .gt('current_streak', 0)

      if (!streaks || streaks.length === 0) return { reset: 0 }

      const todayDate = new Date().toISOString().split('T')[0]
      const toReset: string[] = []

      for (const streak of streaks) {
        const config = configs.find((c) => c.client_id === streak.client_id)
        if (!config) continue

        const state: StreakState = {
          current_streak: streak.current_streak,
          longest_streak: streak.longest_streak,
          last_checkin_date: streak.last_checkin_date,
        }

        if (shouldResetStreak(state, todayDate, config.days_of_week as number[])) {
          toReset.push(streak.client_id)
        }
      }

      if (toReset.length > 0) {
        await service()
          .from('client_streaks')
          .update({ current_streak: 0 })
          .in('client_id', toReset)
      }

      return { reset: toReset.length }
    })
  }
)
