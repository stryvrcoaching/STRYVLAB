import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getLevelFromPoints } from '@/lib/checkins'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const pointsLevelUpdateFunction = inngest.createFunction(
  { id: 'points-level-update', retries: 3, triggers: [{ event: 'points/level.update' }] },
  async ({ event, step }) => {
    const { client_id } = event.data as { client_id: string }

    await step.run('update-total-and-level', async () => {
      const { data: existingStreak } = await service()
        .from('client_streaks')
        .select('level')
        .eq('client_id', client_id)
        .maybeSingle()
      
      const oldLevel = existingStreak?.level

      const { data: rows } = await service()
        .from('client_points')
        .select('points')
        .eq('client_id', client_id)

      const total = (rows ?? []).reduce((sum, r) => sum + (r.points as number), 0)
      const level = getLevelFromPoints(total)

      await service()
        .from('client_streaks')
        .update({ total_points: total, level })
        .eq('client_id', client_id)

      if (oldLevel && oldLevel !== level) {
        // Find the coach for this client
        const { data: coachData } = await service()
          .from('coach_clients')
          .select('coach_id, user_id')
          .eq('id', client_id)
          .maybeSingle()

        if (coachData?.coach_id) {
          // Insert a level_up notification for the client
          await createClientAppNotification(service(), {
            clientId: client_id,
            coachId: coachData.coach_id,
            type: 'system_reminder',
            copyKey: 'level.up',
            copyParams: { level },
            actionUrl: '/client/profil',
            payload: { event: 'level_up', new_level: level, old_level: oldLevel },
            pushKind: 'system',
            pushTag: `stryv-level-up-${level}`,
          })
        }
      }

      return { total, level, oldLevel }
    })
  }
)
