import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { evaluateStreak, getPointsForAction } from '@/lib/checkins'
import type { StreakState } from '@/lib/checkins/streak'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const checkinStreakEvaluateFunction = inngest.createFunction(
  { id: 'checkin-streak-evaluate', retries: 3, triggers: [{ event: 'checkin/streak.evaluate' }] },
  async ({ event, step }) => {
    const { client_id, response_id, is_late, days_of_week } = event.data as {
      client_id: string
      response_id: string
      is_late: boolean
      days_of_week: number[]
    }

    await step.run('award-points', async () => {
      const actionType = is_late ? 'checkin_late' : 'checkin'
      const points = getPointsForAction(actionType)

      await service().from('client_points').insert({
        client_id,
        action_type: actionType,
        points,
        reference_id: response_id,
        earned_at: new Date().toISOString(),
      })

      return { points, actionType }
    })

    await step.run('evaluate-streak', async () => {
      const { data: existing } = await service()
        .from('client_streaks')
        .select('*')
        .eq('client_id', client_id)
        .maybeSingle()

      const currentState: StreakState = existing
        ? {
            current_streak: existing.current_streak,
            longest_streak: existing.longest_streak,
            last_checkin_date: existing.last_checkin_date,
          }
        : { current_streak: 0, longest_streak: 0, last_checkin_date: null }

      const todayDate = new Date().toISOString().split('T')[0]
      const newState = evaluateStreak(currentState, todayDate, is_late, days_of_week)

      if (existing) {
        await service()
          .from('client_streaks')
          .update({
            current_streak: newState.current_streak,
            longest_streak: newState.longest_streak,
            last_checkin_date: newState.last_checkin_date,
          })
          .eq('client_id', client_id)
      } else {
        await service().from('client_streaks').insert({
          client_id,
          current_streak: newState.current_streak,
          longest_streak: newState.longest_streak,
          last_checkin_date: newState.last_checkin_date,
          level: 'bronze',
          total_points: 0,
        })
      }

      return newState
    })

    await inngest.send({
      name: 'points/level.update',
      data: { client_id },
    })
  }
)
