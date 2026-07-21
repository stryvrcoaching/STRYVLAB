/**
 * Coach-facing entitlement helpers (plan Solo / Pro / Studio).
 * Single source for UI + lightweight checks.
 */

import {
  PLAN_CAPABILITIES,
  PLAN_LIMITS,
  hasCapability,
  type BillingStatus,
  type Capability,
  type CoachPlan,
} from '@/lib/billing/plans'
import { isClientAppEnabledForPlanState } from '@/lib/billing/assertClientAppEnabled'

export type CoachEntitlements = {
  plan: CoachPlan
  billingStatus: BillingStatus
  clientLimit: number | null
  /** STRYVR client app usable right now */
  clientAppEnabled: boolean
  /** Has plan capability even if billing is soft-blocked */
  hasClientAppCapability: boolean
  capabilities: Capability[]
  /** Short French reason when client app is off */
  clientAppBlockedReason: string | null
}

export function buildCoachEntitlements(input: {
  plan?: string | null
  billing_status?: string | null
  client_limit?: number | null
}): CoachEntitlements {
  const plan: CoachPlan =
    input.plan === 'pro' || input.plan === 'studio' ? input.plan : 'solo'
  const billingStatus = normalizeBilling(input.billing_status)
  const defaults = PLAN_LIMITS[plan]
  const clientLimit = input.client_limit ?? defaults.clientLimit
  const capabilities = PLAN_CAPABILITIES[plan] ?? PLAN_CAPABILITIES.solo
  const hasClientAppCapability = hasCapability(plan, 'client_app_access')
  const clientAppEnabled = isClientAppEnabledForPlanState({
    plan,
    billingStatus,
    clientLimit,
    teamSeats: defaults.teamSeats,
    capabilities: new Set(capabilities),
  })

  let clientAppBlockedReason: string | null = null
  if (!clientAppEnabled) {
    if (!hasClientAppCapability) {
      clientAppBlockedReason =
        'Disponible à partir du plan Pro — active l’app client STRYVR pour vos athlètes.'
    } else if (billingStatus === 'past_due') {
      clientAppBlockedReason =
        'Abonnement en impayé — régularisez pour réactiver l’app client.'
    } else if (billingStatus === 'canceled' || billingStatus === 'inactive') {
      clientAppBlockedReason =
        'Abonnement inactif — réactivez Pro pour l’app client STRYVR.'
    } else {
      clientAppBlockedReason = 'App client non disponible sur votre offre actuelle.'
    }
  }

  return {
    plan,
    billingStatus,
    clientLimit,
    clientAppEnabled,
    hasClientAppCapability,
    capabilities: [...capabilities],
    clientAppBlockedReason,
  }
}

function normalizeBilling(value: string | null | undefined): BillingStatus {
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

/** Features that require client app entitlement in the coach UI */
export const CLIENT_APP_UI_FEATURES = [
  'invite_stryvr',
  'checkin_config',
  'client_rewards',
  'ai_client_routines',
] as const

export type ClientAppUiFeature = (typeof CLIENT_APP_UI_FEATURES)[number]
