import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const chatArchiveFunction = inngest.createFunction(
  {
    id: 'chat-archive',
    retries: 2,
    triggers: [{ cron: '0 3 * * *' }], // 03:00 UTC — avant cutoff physiologique 04:00
  },
  async ({ step }: { step: any }) => {
    const result = await step.run('archive-messages-older-than-3-days', async () => {
      const db = svc()
      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const { error } = await db
        .from('chat_messages')
        .update({ archived_at: new Date().toISOString() })
        .is('archived_at', null)
        .lt('created_at', cutoff)

      if (error) throw new Error(`chat-archive: ${error.message}`)
      return { archived: true, cutoff }
    })
    return result
  }
)
