import { describe, expect, it } from 'vitest'
import {
  createPostCancellationWindow,
  getCoachDataAccessMode,
  POST_CANCELLATION_ACCESS_DAYS,
} from '@/lib/privacy/retention'

describe('post-cancellation retention window', () => {
  it('creates a 90-day read and export window', () => {
    const window = createPostCancellationWindow(new Date('2026-07-15T00:00:00.000Z'))

    expect(POST_CANCELLATION_ACCESS_DAYS).toBe(90)
    expect(window.billingEndedAt).toBe('2026-07-15T00:00:00.000Z')
    expect(window.exportAvailableUntil).toBe('2026-10-13T00:00:00.000Z')
    expect(window.deletionScheduledAt).toBe(window.exportAvailableUntil)
  })

  it('distinguishes active, read-only and expired access', () => {
    const now = new Date('2026-07-15T00:00:00.000Z')

    expect(getCoachDataAccessMode('active', null, now)).toBe('active')
    expect(getCoachDataAccessMode('canceled', '2026-08-01T00:00:00.000Z', now)).toBe('read_only')
    expect(getCoachDataAccessMode('canceled', '2026-07-01T00:00:00.000Z', now)).toBe('expired')
    expect(getCoachDataAccessMode('canceled', null, now)).toBe('read_only')
  })
})
