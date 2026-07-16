import { inngest } from '@/lib/inngest/client'
import { runAdaptiveTdeeNightly } from '@/lib/nutrition/adaptiveTdeeNightly'

// Nightly at 04:00 UTC — processes each opted-in client once.
// Protocols only consume a confirmed client TDEE; they are never rescaled automatically.
export const adaptiveTdeeFunction = inngest.createFunction(
  {
    id: 'nutrition-adaptive-tdee-nightly',
    retries: 2,
    triggers: [{ cron: '0 4 * * *' }],
  },
  async () => {
    return runAdaptiveTdeeNightly()
  }
)
