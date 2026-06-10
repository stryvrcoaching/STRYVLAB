import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { runChatCheckinInitForFlow } from '@/lib/inngest/chatCheckinInitCron'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** Every 15 min — inserts evening_init when client local time ≈ 21:00 and check-in pending. */
export const chatEveningBriefFunction = inngest.createFunction(
  {
    id: 'chat-evening-brief',
    retries: 2,
    triggers: [{ cron: '*/15 * * * *' }],
  },
  async ({ step }: { step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> } }) => {
    return await step.run('insert-evening-init-messages', async () => {
      return runChatCheckinInitForFlow(svc(), 'evening', 21, 0)
    })
  }
)
