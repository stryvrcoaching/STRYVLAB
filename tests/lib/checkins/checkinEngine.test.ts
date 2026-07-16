import { describe, it, expect } from 'vitest'
import {
  determineFlowForClick,
  determineSlotForClick,
  shouldProactiveInitNow,
} from '@/lib/client/checkin/checkinEngine'
import { getPendingSlots } from '@/lib/client/checkin/pendingCheckins'
import { computePhysiologicalDateInTimezone } from '@/lib/client/checkin/timeWindows'
import { findExistingInitMessageForDate } from '@/lib/client/checkin/initMessages'
import { activeWindowAt } from '@/lib/client/checkin/timeWindows'

type SessionData = { flow_type: string; completed_at: string | null; date?: string }

const completed = (type: string, date = '2026-05-29'): SessionData => ({
  flow_type: type,
  completed_at: new Date().toISOString(),
  date,
})
const pending = (type: string, date = '2026-05-29'): SessionData => ({
  flow_type: type,
  completed_at: null,
  date,
})

const TZ = 'Europe/Paris'

describe('activeWindowAt (Europe/Paris)', () => {
  it('returns morning at 10:00', () => {
    const now = new Date('2026-05-29T08:00:00.000Z') // ~10:00 Paris May
    expect(activeWindowAt(now, TZ)).toBe('morning')
  })

  it('returns evening at 22:00 Paris', () => {
    const now = new Date('2026-05-29T20:00:00.000Z') // 22:00 CEST
    expect(activeWindowAt(now, TZ)).toBe('evening')
  })

  it('returns null in gap (18:00 Paris)', () => {
    const now = new Date('2026-05-29T16:00:00.000Z')
    expect(activeWindowAt(now, TZ)).toBeNull()
  })
})

describe('determineSlotForClick', () => {
  it('opens the oldest pending slot, even in the evening window', () => {
    const now = new Date('2026-05-29T20:00:00.000Z')
    const slot = determineSlotForClick(now, TZ, [
      pending('morning'),
      pending('evening'),
    ])
    expect(slot).toEqual({ date: '2026-05-29', flow_type: 'morning' })
  })

  it('opens a missed evening check-in before the current morning check-in', () => {
    const now = new Date('2026-05-29T08:00:00.000Z')
    const slot = determineSlotForClick(now, TZ, [
      pending('evening', '2026-05-28'),
      pending('morning', '2026-05-29'),
    ])
    expect(slot).toEqual({ date: '2026-05-28', flow_type: 'evening' })
  })

  it('returns null when nothing pending', () => {
    const now = new Date('2026-05-29T08:00:00.000Z')
    expect(
      determineSlotForClick(now, TZ, [
        completed('morning', '2026-05-28'),
        completed('evening', '2026-05-28'),
        completed('morning', '2026-05-29'),
        completed('evening', '2026-05-29'),
      ]),
    ).toBeNull()
  })

  it('does not open the evening check-in before its window', () => {
    const now = new Date('2026-05-29T08:00:00.000Z')

    expect(
      determineSlotForClick(now, TZ, [
        completed('morning', '2026-05-28'),
        completed('evening', '2026-05-28'),
        completed('morning', '2026-05-29'),
      ]),
    ).toBeNull()
  })

  it('returns oldest pending in gap window', () => {
    const now = new Date('2026-05-29T16:00:00.000Z')
    const slot = determineSlotForClick(now, TZ, [
      pending('morning', '2026-05-28'),
      pending('evening', '2026-05-28'),
    ])
    expect(slot).not.toBeNull()
    expect(['morning', 'evening']).toContain(slot?.flow_type)
  })

  it('keeps previous evening pending at 02:00 local until completed', () => {
    const now = new Date('2026-07-09T00:00:00.000Z')
    const physiologicalDate = computePhysiologicalDateInTimezone(now, 'Europe/Brussels')

    expect(physiologicalDate).toBe('2026-07-08')

    const slot = determineSlotForClick(now, 'Europe/Brussels', [
      completed('morning', '2026-07-08'),
    ])

    expect(slot).toEqual({ date: '2026-07-08', flow_type: 'evening' })
  })

  it('clears previous evening from pending list once completed at 02:00 local', () => {
    const now = new Date('2026-07-09T00:00:00.000Z')

    const pendingSlots = getPendingSlots(now, 'Europe/Brussels', [
      completed('morning', '2026-07-08'),
      completed('evening', '2026-07-08'),
    ])

    expect(pendingSlots).toHaveLength(0)
    expect(determineSlotForClick(now, 'Europe/Brussels', [
      completed('morning', '2026-07-08'),
      completed('evening', '2026-07-08'),
    ])).toBeNull()
  })
})

describe('determineFlowForClick', () => {
  it('maps slot to flow type', () => {
    const now = new Date('2026-05-29T08:00:00.000Z')
    expect(determineFlowForClick(now, TZ, [
      completed('morning', '2026-05-28'),
      completed('evening', '2026-05-28'),
      pending('morning'),
    ])).toBe('morning')
  })
})

describe('shouldProactiveInitNow', () => {
  it('true in morning window with pending morning', () => {
    const now = new Date('2026-05-29T08:00:00.000Z')
    expect(shouldProactiveInitNow(now, TZ, 'morning', [pending('morning')])).toBe(true)
  })

  it('false when morning already completed', () => {
    const now = new Date('2026-05-29T08:00:00.000Z')
    expect(
      shouldProactiveInitNow(now, TZ, 'morning', [
        completed('morning', '2026-05-28'),
        completed('evening', '2026-05-28'),
        completed('morning', '2026-05-29'),
      ]),
    ).toBe(false)
  })

  it('false outside window', () => {
    const now = new Date('2026-05-29T16:00:00.000Z')
    expect(shouldProactiveInitNow(now, TZ, 'evening', [pending('evening')])).toBe(false)
  })
})

describe('findExistingInitMessageForDate', () => {
  it('does not let yesterday morning_init block today morning_init', () => {
    const rows = [
      {
        id: 'msg-1',
        message_type: 'morning_init',
        created_at: '2026-05-29T06:30:00.000Z',
      },
    ]

    expect(
      findExistingInitMessageForDate(rows, 'morning_init', 'Europe/Paris', '2026-05-30'),
    ).toBeUndefined()
  })

  it('matches init message for the same physiological day', () => {
    const rows = [
      {
        id: 'msg-2',
        message_type: 'morning_init',
        created_at: '2026-05-30T06:30:00.000Z',
      },
    ]

    expect(
      findExistingInitMessageForDate(rows, 'morning_init', 'Europe/Paris', '2026-05-30'),
    )?.toMatchObject({ id: 'msg-2' })
  })
})
