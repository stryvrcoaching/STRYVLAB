import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClientAppNotification } from '@/lib/notifications/create-client-app-notification'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const weeklyQuestsCron = inngest.createFunction(
  { id: 'weekly-quests-cron', retries: 1 },
  { cron: 'TZ=Europe/Paris 0 0 * * 1' }, // Every Monday at 00:00
  async ({ step }) => {
    await step.run('evaluate-weekly-quests', async () => {
      const db = service()
      
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      const dateStr = oneWeekAgo.toISOString()
      const dateKey = dateStr.slice(0, 10)

      // Fetch active clients
      const { data: clients } = await db.from('coach_clients').select('id, coach_id').eq('status', 'active')
      if (!clients) return

      for (const client of clients) {
        // Quest 1: 3 Sessions completed
        const { count: sessionCount } = await db
          .from('client_session_logs')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .eq('completed', true)
          .gte('completed_at', dateStr)

        if (sessionCount && sessionCount >= 3) {
          await db.from('client_points').insert({
            client_id: client.id,
            action_type: 'quest_reward',
            points: 100,
            earned_at: new Date().toISOString(),
          })
          
          await createClientAppNotification(db, {
            clientId: client.id,
            coachId: client.coach_id,
            type: 'system_reminder',
            copyKey: 'quest.sessions.completed',
            actionUrl: '/client/profil',
            payload: { event: 'quest_completed' },
            pushKind: 'system',
            pushTag: `stryv-quest-sessions-${dateKey}`,
          })
        }

        // Quest 2: 5 Check-ins completed
        const { count: checkinCount } = await db
          .from('client_daily_checkins')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .gte('date', dateKey)

        if (checkinCount && checkinCount >= 5) {
          await db.from('client_points').insert({
            client_id: client.id,
            action_type: 'quest_reward',
            points: 50,
            earned_at: new Date().toISOString(),
          })
          
          await createClientAppNotification(db, {
            clientId: client.id,
            coachId: client.coach_id,
            type: 'system_reminder',
            copyKey: 'quest.checkins.completed',
            actionUrl: '/client/profil',
            payload: { event: 'quest_completed' },
            pushKind: 'system',
            pushTag: `stryv-quest-checkins-${dateKey}`,
          })
        }
      }
    })
  }
)
