import type { SupabaseClient } from '@supabase/supabase-js'
import { getCoachPlan } from '@/lib/billing/getCoachPlan'

export class ClientLimitReachedError extends Error {
  status: number

  constructor(message = 'Client limit reached for the current plan.') {
    super(message)
    this.name = 'ClientLimitReachedError'
    this.status = 403
  }
}

export async function getActiveClientCount(db: SupabaseClient, coachId: string): Promise<number> {
  const { count, error } = await db
    .from('coach_clients')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .eq('status', 'active')

  if (error) throw error
  return count ?? 0
}

export async function assertCoachClientCapacity(db: SupabaseClient, coachId: string) {
  const planState = await getCoachPlan(db, coachId)
  if (planState.clientLimit == null) return planState

  const activeCount = await getActiveClientCount(db, coachId)
  if (activeCount >= planState.clientLimit) {
    throw new ClientLimitReachedError()
  }

  return planState
}
