import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { runDeferReminders } from '@/lib/inngest/checkinDeferReminder'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Every 15 min — one light reminder (chat + push) ~1h after a client deferred a check-in. */
export const checkinDeferReminderFunction = inngest.createFunction(
  { id: 'checkin-defer-reminder', retries: 1, triggers: [{ cron: '*/15 * * * *' }] },
  async ({ step }: { step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> } }) => {
    return await step.run('send-defer-reminders', async () => runDeferReminders(svc()))
  },
)
