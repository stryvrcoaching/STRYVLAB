import { describe, expect, it } from 'vitest'
import { isClientAppEnabledForPlanState } from '@/lib/billing/assertClientAppEnabled'

describe('client application entitlement', () => {
  it('allows a Pro coach while their trial is active', () => {
    expect(
      isClientAppEnabledForPlanState({
        plan: 'pro',
        billingStatus: 'trialing',
        clientLimit: 30,
        teamSeats: 1,
        capabilities: new Set(),
      }),
    ).toBe(true)
  })

  it('blocks a Pro coach when their subscription is inactive, overdue or canceled', () => {
    for (const billingStatus of ['inactive', 'past_due', 'canceled'] as const) {
      expect(
        isClientAppEnabledForPlanState({
          plan: 'pro',
          billingStatus,
          clientLimit: 30,
          teamSeats: 1,
          capabilities: new Set(),
        }),
      ).toBe(false)
    }
  })

  it('blocks Solo even if its billing status is active', () => {
    expect(
      isClientAppEnabledForPlanState({
        plan: 'solo',
        billingStatus: 'active',
        clientLimit: 5,
        teamSeats: 1,
        capabilities: new Set(),
      }),
    ).toBe(false)
  })
})
