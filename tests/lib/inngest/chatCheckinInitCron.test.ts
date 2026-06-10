import { describe, expect, it } from 'vitest'

import {
  configuredDayFromJsWeekday,
  getAutomatedInitSkipReason,
  isAiRoutineAllowed,
  isCheckinMomentConfiguredToday,
  isLocalTimeInRange,
  isLocalTimeNear,
  shouldInsertAutomatedInit,
} from '@/lib/inngest/chatCheckinInitCron'

describe('chatCheckinInitCron time gating', () => {
  it('matches the historical +/-14 minute target window', () => {
    expect(isLocalTimeNear(new Date('2026-05-30T04:16:00.000Z'), 'Europe/Paris', 6, 30)).toBe(true)
    expect(isLocalTimeNear(new Date('2026-05-30T04:45:00.000Z'), 'Europe/Paris', 6, 30)).toBe(false)
  })

  it('accepts any local time between 06:00 and 07:00 for morning send', () => {
    expect(isLocalTimeInRange(new Date('2026-05-30T04:00:00.000Z'), 'Europe/Paris', 6, 0, 7, 0)).toBe(true)
    expect(isLocalTimeInRange(new Date('2026-05-30T04:45:00.000Z'), 'Europe/Paris', 6, 0, 7, 0)).toBe(true)
    expect(isLocalTimeInRange(new Date('2026-05-30T05:00:00.000Z'), 'Europe/Paris', 6, 0, 7, 0)).toBe(false)
  })
})

describe('chatCheckinInitCron AI routine gating', () => {
  it('requires global AI and per-client AI before sending autonomous routines', () => {
    expect(isAiRoutineAllowed('morning', false, {
      ai_llm_enabled: true,
      ai_morning_routine_enabled: true,
    })).toBe(false)
    expect(isAiRoutineAllowed('morning', true, null)).toBe(false)
    expect(isAiRoutineAllowed('morning', true, {
      ai_llm_enabled: false,
      ai_morning_routine_enabled: true,
    })).toBe(false)
  })

  it('uses separate routine toggles and treats missing toggle values as enabled', () => {
    expect(isAiRoutineAllowed('morning', true, {
      ai_llm_enabled: true,
      ai_morning_routine_enabled: false,
      ai_evening_routine_enabled: true,
    })).toBe(false)
    expect(isAiRoutineAllowed('evening', true, {
      ai_llm_enabled: true,
      ai_morning_routine_enabled: false,
      ai_evening_routine_enabled: true,
    })).toBe(true)
    expect(isAiRoutineAllowed('morning', true, {
      ai_llm_enabled: true,
    })).toBe(true)
  })
})

describe('chatCheckinInitCron message eligibility', () => {
  it('sends when either a routine is allowed or a check-in is due', () => {
    expect(shouldInsertAutomatedInit(true, false)).toBe(true)
    expect(shouldInsertAutomatedInit(false, true)).toBe(true)
    expect(shouldInsertAutomatedInit(true, true)).toBe(true)
    expect(shouldInsertAutomatedInit(false, false)).toBe(false)
  })

  it('explains whether a skip came from config absence or no pending slot', () => {
    expect(getAutomatedInitSkipReason(false, false, false)).toBe('checkin_not_configured')
    expect(getAutomatedInitSkipReason(false, true, false)).toBe('checkin_not_due')
    expect(getAutomatedInitSkipReason(true, false, false)).toBe('sendable')
    expect(getAutomatedInitSkipReason(false, true, true)).toBe('sendable')
  })
})

describe('chatCheckinInitCron check-in config gating', () => {
  it('maps JS weekdays to stored config weekdays with Monday as 0', () => {
    expect(configuredDayFromJsWeekday(1)).toBe(0)
    expect(configuredDayFromJsWeekday(6)).toBe(5)
    expect(configuredDayFromJsWeekday(0)).toBe(6)
  })

  it('requires active config, current day, and matching moment before prompting check-in', () => {
    const config = {
      client_id: 'client-1',
      is_active: true,
      days_of_week: [0],
      moments: [{ moment: 'morning', fields: ['rhr_morning'] }],
    }

    expect(isCheckinMomentConfiguredToday(config, 'morning', 1)).toBe(true)
    expect(isCheckinMomentConfiguredToday(config, 'evening', 1)).toBe(false)
    expect(isCheckinMomentConfiguredToday(config, 'morning', 2)).toBe(false)
    expect(isCheckinMomentConfiguredToday({ ...config, is_active: false }, 'morning', 1)).toBe(false)
  })
})
