import { describe, expect, it } from 'vitest'

import { isPendingAssessmentReminderDue } from '@/lib/assessments/pending-reminder'

const now = new Date('2026-07-16T12:00:00.000Z')

describe('pending assessment reminders', () => {
  it('waits at least 24 hours before reminding a pending assessment', () => {
    expect(isPendingAssessmentReminderDue({
      status: 'pending',
      createdAt: '2026-07-15T12:01:00.000Z',
      expiresAt: '2026-07-22T12:00:00.000Z',
    }, now)).toBe(false)

    expect(isPendingAssessmentReminderDue({
      status: 'pending',
      createdAt: '2026-07-15T12:00:00.000Z',
      expiresAt: '2026-07-22T12:00:00.000Z',
    }, now)).toBe(true)
  })

  it('does not remind completed or expired assessments', () => {
    expect(isPendingAssessmentReminderDue({
      status: 'completed',
      createdAt: '2026-07-14T12:00:00.000Z',
      expiresAt: '2026-07-22T12:00:00.000Z',
    }, now)).toBe(false)

    expect(isPendingAssessmentReminderDue({
      status: 'pending',
      createdAt: '2026-07-14T12:00:00.000Z',
      expiresAt: '2026-07-16T11:59:00.000Z',
    }, now)).toBe(false)
  })
})
