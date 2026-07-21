import { describe, expect, it } from 'vitest'
import { advanceBillingDate, billingPeriodLabel } from '@/lib/payments/billing-cycle'
import { planSubscriptionDues } from '@/lib/payments/generate-subscription-dues'

describe('advanceBillingDate', () => {
  it('advances monthly across month ends', () => {
    expect(advanceBillingDate('2026-01-31', 'monthly')).toBe('2026-02-28')
    expect(advanceBillingDate('2026-03-15', 'monthly')).toBe('2026-04-15')
  })

  it('advances weekly / quarterly / yearly', () => {
    expect(advanceBillingDate('2026-03-01', 'weekly')).toBe('2026-03-08')
    expect(advanceBillingDate('2026-01-15', 'quarterly')).toBe('2026-04-15')
    expect(advanceBillingDate('2026-01-15', 'yearly')).toBe('2027-01-15')
  })

  it('one_time returns null', () => {
    expect(advanceBillingDate('2026-03-01', 'one_time')).toBeNull()
  })
})

describe('billingPeriodLabel', () => {
  it('formats French month', () => {
    expect(billingPeriodLabel('2026-03-10')).toBe('Mars 2026')
  })
})

describe('planSubscriptionDues', () => {
  const baseSub = {
    id: 'sub-1',
    coach_id: 'coach-1',
    client_id: 'client-1',
    status: 'active',
    start_date: '2026-01-01',
    end_date: null as string | null,
    next_billing_date: '2026-03-10' as string | null,
    price_override_eur: null as number | null,
    formula: {
      id: 'f-1',
      name: 'Coaching Premium',
      price_eur: 120,
      billing_cycle: 'monthly' as const,
      is_active: true,
    },
  }

  it('creates a pending due when next_billing is within lead window', () => {
    const { payments, updates } = planSubscriptionDues(
      [baseSub],
      {},
      { today: '2026-03-05', leadDays: 7 },
    )
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({
      dueDate: '2026-03-10',
      amountEur: 120,
      description: 'Coaching Premium — Mars 2026',
    })
    expect(updates[0].nextBillingDate).toBe('2026-04-10')
  })

  it('skips duplicate due dates already paid/pending', () => {
    const { payments } = planSubscriptionDues(
      [baseSub],
      { 'sub-1': ['2026-03-10'] },
      { today: '2026-03-05', leadDays: 7 },
    )
    expect(payments).toHaveLength(0)
  })

  it('does not create when billing is beyond lead window', () => {
    const { payments, updates } = planSubscriptionDues(
      [{ ...baseSub, next_billing_date: '2026-04-20' }],
      {},
      { today: '2026-03-05', leadDays: 7 },
    )
    expect(payments).toHaveLength(0)
    expect(updates).toHaveLength(0)
  })

  it('seeds next_billing when missing and due is far', () => {
    const { payments, updates } = planSubscriptionDues(
      [
        {
          ...baseSub,
          next_billing_date: null,
          start_date: '2026-06-01',
        },
      ],
      {},
      { today: '2026-03-05', leadDays: 7 },
    )
    expect(payments).toHaveLength(0)
    expect(updates).toEqual([
      { subscriptionId: 'sub-1', nextBillingDate: '2026-06-01' },
    ])
  })

  it('uses price override', () => {
    const { payments } = planSubscriptionDues(
      [{ ...baseSub, price_override_eur: 99 }],
      {},
      { today: '2026-03-05', leadDays: 7 },
    )
    expect(payments[0].amountEur).toBe(99)
  })

  it('catches up overdue periods up to max', () => {
    const { payments, updates } = planSubscriptionDues(
      [{ ...baseSub, next_billing_date: '2026-01-10' }],
      {},
      { today: '2026-03-05', leadDays: 7, maxPeriodsPerSub: 3 },
    )
    expect(payments).toHaveLength(3)
    expect(payments.map((p) => p.dueDate)).toEqual([
      '2026-01-10',
      '2026-02-10',
      '2026-03-10',
    ])
    expect(updates[0].nextBillingDate).toBe('2026-04-10')
  })

  it('stops at end_date', () => {
    const { payments, updates } = planSubscriptionDues(
      [
        {
          ...baseSub,
          next_billing_date: '2026-03-10',
          end_date: '2026-03-15',
        },
      ],
      {},
      { today: '2026-03-05', leadDays: 7 },
    )
    expect(payments).toHaveLength(1)
    // Next period (April) would be after end_date → no further billing
    expect(updates[0].nextBillingDate).toBeNull()
  })

  it('ignores paused subscriptions', () => {
    const { payments, skipped } = planSubscriptionDues(
      [{ ...baseSub, status: 'paused' }],
      {},
      { today: '2026-03-05', leadDays: 7 },
    )
    expect(payments).toHaveLength(0)
    expect(skipped).toBe(1)
  })
})
