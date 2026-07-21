import { describe, expect, it } from 'vitest'
import {
  addLocalDays,
  defaultPendingDueDate,
  localIsoDate,
  resolvePaymentDueDate,
} from '@/lib/payments/due-date'

describe('payment due-date helpers', () => {
  it('formats local ISO date', () => {
    const d = new Date(2026, 2, 5) // 5 Mar 2026 local
    expect(localIsoDate(d)).toBe('2026-03-05')
  })

  it('adds calendar days without UTC drift', () => {
    expect(addLocalDays('2026-03-05', 7)).toBe('2026-03-12')
    expect(addLocalDays('2026-03-28', 5)).toBe('2026-04-02')
  })

  it('defaults pending due to +7 from today when payment_date is past', () => {
    const from = new Date(2026, 5, 10) // 10 Jun 2026
    expect(defaultPendingDueDate('2026-01-01', from)).toBe('2026-06-17')
  })

  it('defaults pending due to +7 from payment_date when in the future', () => {
    const from = new Date(2026, 5, 10)
    expect(defaultPendingDueDate('2026-06-15', from)).toBe('2026-06-22')
  })

  it('resolvePaymentDueDate keeps explicit due_date', () => {
    expect(
      resolvePaymentDueDate({
        status: 'pending',
        due_date: '2026-07-01',
        payment_date: '2026-06-01',
      }),
    ).toBe('2026-07-01')
  })

  it('resolvePaymentDueDate fills pending without due_date', () => {
    const from = new Date()
    const expected = defaultPendingDueDate('2026-06-01', from)
    // use real now inside resolve — compare shape
    const result = resolvePaymentDueDate({
      status: 'pending',
      due_date: null,
      payment_date: localIsoDate(from),
    })
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result).toBe(addLocalDays(localIsoDate(from), 7))
    void expected
  })

  it('resolvePaymentDueDate allows null for paid', () => {
    expect(
      resolvePaymentDueDate({
        status: 'paid',
        due_date: null,
        payment_date: '2026-06-01',
      }),
    ).toBeNull()
  })
})
