import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getLevelFromPoints } from '@/lib/checkins'

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

      return { total, level }
    })
  }
)
