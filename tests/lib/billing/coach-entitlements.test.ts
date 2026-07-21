import { describe, expect, it } from 'vitest'
import { buildCoachEntitlements } from '@/lib/billing/coach-entitlements'
import { PLAN_CAPABILITIES, hasCapability } from '@/lib/billing/plans'

describe('buildCoachEntitlements', () => {
  it('Solo never gets client app even if billing is active', () => {
    const e = buildCoachEntitlements({ plan: 'solo', billing_status: 'active' })
    expect(e.clientAppEnabled).toBe(false)
    expect(e.hasClientAppCapability).toBe(false)
    expect(e.clientAppBlockedReason).toMatch(/Pro/i)
  })

  it('Pro trialing/active enables client app', () => {
    expect(
      buildCoachEntitlements({ plan: 'pro', billing_status: 'trialing' })
        .clientAppEnabled,
    ).toBe(true)
    expect(
      buildCoachEntitlements({ plan: 'pro', billing_status: 'active' })
        .clientAppEnabled,
    ).toBe(true)
  })

  it('Pro past_due/canceled/inactive blocks client app', () => {
    for (const billing_status of ['past_due', 'canceled', 'inactive'] as const) {
      const e = buildCoachEntitlements({ plan: 'pro', billing_status })
      expect(e.clientAppEnabled).toBe(false)
      expect(e.hasClientAppCapability).toBe(true)
    }
  })

  it('Studio mirrors Pro capabilities for client app', () => {
    expect(
      buildCoachEntitlements({ plan: 'studio', billing_status: 'active' })
        .clientAppEnabled,
    ).toBe(true)
  })
})

describe('PLAN_CAPABILITIES matrix', () => {
  it('Solo has coach tools but no STRYVR stack', () => {
    const solo = PLAN_CAPABILITIES.solo
    expect(solo).toContain('client_management')
    expect(solo).toContain('nutrition_protocols')
    expect(solo).toContain('training_programs')
    expect(solo).not.toContain('client_app_access')
    expect(solo).not.toContain('client_checkins')
    expect(hasCapability('solo', 'client_app_access')).toBe(false)
  })

  it('Pro and Studio share the same STRYVR capability set', () => {
    for (const cap of [
      'client_app_access',
      'client_checkins',
      'client_routines',
      'client_progress_dashboard',
      'adherence_signals',
      'smart_recommendations',
      'coach_quick_actions',
    ] as const) {
      expect(hasCapability('pro', cap)).toBe(true)
      expect(hasCapability('studio', cap)).toBe(true)
      expect(hasCapability('solo', cap)).toBe(false)
    }
  })
})
