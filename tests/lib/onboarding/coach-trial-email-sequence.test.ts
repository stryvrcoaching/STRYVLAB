import { describe, expect, it } from 'vitest'
import {
  getNextDueCoachTrialEmail,
  getTrialDay,
} from '@/lib/onboarding/coach-trial-email-sequence'

describe('coach trial onboarding email sequence', () => {
  it('does not schedule an email before its due day', () => {
    expect(getNextDueCoachTrialEmail(2, [])).toBeNull()
  })

  it('chooses the first unfinished email and never bunches the sequence', () => {
    expect(getNextDueCoachTrialEmail(10, [])?.key).toBe('setup')
    expect(getNextDueCoachTrialEmail(10, ['setup'])?.key).toBe('workflow')
    expect(getNextDueCoachTrialEmail(10, ['setup', 'workflow'])?.key).toBe('progress')
  })

  it('calculates complete days elapsed since the trial began', () => {
    const startedAt = new Date('2026-07-01T08:00:00.000Z')
    const now = new Date('2026-07-04T07:59:59.000Z')

    expect(getTrialDay(startedAt, now)).toBe(2)
    expect(getTrialDay(startedAt, new Date('2026-07-04T08:00:00.000Z'))).toBe(3)
  })
})
