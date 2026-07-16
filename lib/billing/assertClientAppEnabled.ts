import type { SupabaseClient } from '@supabase/supabase-js'
import { getCoachPlan } from '@/lib/billing/getCoachPlan'
import { hasCapability } from '@/lib/billing/plans'

export class ClientAppAccessError extends Error {
  status: number

  constructor(message = 'Client app access is not enabled for this coach plan.') {
    super(message)
    this.name = 'ClientAppAccessError'
    this.status = 403
  }
}

/**
 * Client application access is a paid entitlement. A coach plan alone is not
 * sufficient: the related subscription must still be active or trialing.
 */
export function isClientAppEnabledForPlanState(planState: Awaited<ReturnType<typeof getCoachPlan>>) {
  return (
    hasCapability(planState.plan, 'client_app_access')
    && (planState.billingStatus === 'trialing' || planState.billingStatus === 'active')
  )
}

export async function isClientAppEnabledForCoach(
  db: SupabaseClient,
  coachId: string,
) {
  return isClientAppEnabledForPlanState(await getCoachPlan(db, coachId))
}

export async function assertClientAppEnabledForCoach(
  db: SupabaseClient,
  coachId: string,
) {
  const planState = await getCoachPlan(db, coachId)

  if (!isClientAppEnabledForPlanState(planState)) {
    throw new ClientAppAccessError()
  }

  return planState
}
