import { describe, expect, it } from 'vitest'

import {
  bucketForNotification,
  getMarkableNotificationIds,
  isHomeSystemNotification,
  isPersistentHomeAction,
} from '@/lib/client/notificationBuckets'

describe('client notification buckets', () => {
  it('keeps check-in delivery reminders out of the home inbox', () => {
    const reminder = {
      type: 'system_reminder',
      payload: {
        event: 'checkin_reminder',
        date: '2026-07-18',
        moment: 'morning',
      },
    }

    expect(isHomeSystemNotification(reminder)).toBe(false)
    expect(isPersistentHomeAction(reminder)).toBe(false)
    expect(bucketForNotification(reminder)).toBeNull()
  })

  it('keeps genuine action items on Accueil', () => {
    const paymentReminder = {
      type: 'system_reminder',
      payload: { event: 'payment_reminder', payment_id: 'payment-1' },
    }

    expect(isHomeSystemNotification(paymentReminder)).toBe(true)
    expect(isPersistentHomeAction(paymentReminder)).toBe(true)
    expect(bucketForNotification(paymentReminder)).toBe('home')
  })

  it('allows programme updates to be marked read without hiding a required action', () => {
    const update = {
      type: 'program_updated',
      payload: { action_url: '/client/nutrition' },
    }

    expect(isHomeSystemNotification(update)).toBe(true)
    expect(isPersistentHomeAction(update)).toBe(false)
  })

  it('marks only informational rows read in bulk', () => {
    expect(getMarkableNotificationIds([
      { id: 'nutrition-1', type: 'program_updated', payload: { protocol_id: 'p1' } },
      { id: 'workout-1', type: 'program_updated', payload: null },
      { id: 'payment-1', type: 'system_reminder', payload: { event: 'payment_reminder', payment_id: 'pay-1' } },
      { id: 'bilan-1', type: 'bilan_pending', payload: null },
    ])).toEqual(['nutrition-1', 'workout-1'])
  })
})
