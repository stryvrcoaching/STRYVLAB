import { PLAN_LIMITS, type BillingStatus, type CoachPlan } from '@/lib/billing/plans'

const PLAN_PRICE_IDS: Partial<Record<CoachPlan, string | undefined>> = {
  solo: process.env.STRIPE_PRICE_STRYVLAB_SOLO,
  pro: process.env.STRIPE_PRICE_STRYVLAB_PRO,
  studio: process.env.STRIPE_PRICE_STRYVLAB_STUDIO,
}

export function getStripePriceIdForPlan(plan: CoachPlan): string | null {
  const priceId = PLAN_PRICE_IDS[plan]
  return priceId && priceId.trim() ? priceId : null
}

export function resolvePlanFromStripePriceId(priceId: string | null | undefined): CoachPlan | null {
  if (!priceId) return null

  for (const [plan, configuredPriceId] of Object.entries(PLAN_PRICE_IDS) as Array<[CoachPlan, string | undefined]>) {
    if (configuredPriceId === priceId) return plan
  }

  return null
}

export function getPlanDefaults(plan: CoachPlan) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.solo
}

export function mapStripeSubscriptionStatusToBillingStatus(
  status: string | null | undefined,
): BillingStatus {
  switch (status) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled'
    default:
      return 'inactive'
  }
}
