import type { SupabaseClient } from '@supabase/supabase-js'
import { PLAN_LIMITS, getCapabilities, type BillingStatus, type Capability, type CoachPlan } from '@/lib/billing/plans'

export interface CoachPlanState {
  plan: CoachPlan
  billingStatus: BillingStatus
  clientLimit: number | null
  teamSeats: number | null
  capabilities: Set<Capability>
}

type CoachProfilePlanRow = {
  plan?: string | null
  billing_status?: string | null
  client_limit?: number | null
  team_seats?: number | null
}

function normalizePlan(value: string | null | undefined): CoachPlan {
  return value === 'pro' || value === 'studio' ? value : 'solo'
}

function normalizeBillingStatus(value: string | null | undefined): BillingStatus {
  switch (value) {
    case 'trialing':
    case 'active':
    case 'past_due':
    case 'canceled':
      return value
    default:
      return 'inactive'
  }
}

export async function getCoachPlan(
  db: SupabaseClient,
  coachId: string,
): Promise<CoachPlanState> {
  const { data } = await db
    .from('coach_profiles')
    .select('plan, billing_status, client_limit, team_seats')
    .eq('coach_id', coachId)
    .maybeSingle()

  const row = (data ?? null) as CoachProfilePlanRow | null
  const plan = normalizePlan(row?.plan)
  const defaults = PLAN_LIMITS[plan] ?? PLAN_LIMITS.solo

  return {
    plan,
    billingStatus: normalizeBillingStatus(row?.billing_status),
    clientLimit: row?.client_limit ?? defaults.clientLimit,
    teamSeats: row?.team_seats ?? defaults.teamSeats,
    capabilities: getCapabilities(plan),
  }
}
