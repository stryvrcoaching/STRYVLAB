import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { runChatCheckinInitForFlow } from '@/lib/inngest/chatCheckinInitCron'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** Every 15 min — inserts morning_init once during the client local 06:00–07:00 window if pending. */
export const chatMorningBriefFunction = inngest.createFunction(
  {
    id: 'chat-morning-brief',
    retries: 2,
    triggers: [{ cron: '*/15 * * * *' }],
  },
  async ({ step }: { step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> } }) => {
    return await step.run('insert-morning-init-messages', async () => {
      return runChatCheckinInitForFlow(svc(), 'morning', 6, 30)
    })
  }
)
