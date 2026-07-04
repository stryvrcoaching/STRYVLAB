import { describe, expect, it } from 'vitest'
import { buildProtocolDateKeysForAnalytics } from '@/lib/nutrition/protocol-card-date-keys'

describe('buildProtocolDateKeysForAnalytics', () => {
  it('falls back to the protocol schedule start when no assignment is available', () => {
    const dateKeys = buildProtocolDateKeysForAnalytics({
      protocol: {
        id: 'protocol-1',
        schedule_start_date: '2026-06-29',
      },
      referenceDateKey: '2026-07-01',
      timezone: 'UTC',
    })

    expect(dateKeys).toEqual(['2026-06-29', '2026-06-30', '2026-07-01'])
  })

  it('uses the assignment window when it exists', () => {
    const dateKeys = buildProtocolDateKeysForAnalytics({
      protocol: {
        id: 'protocol-2',
        schedule_start_date: '2026-06-01',
      },
      assignment: {
        started_at: '2026-06-29T05:00:00.000Z',
        ended_at: '2026-07-01T05:00:00.000Z',
      },
      referenceDateKey: '2026-07-01',
      timezone: 'UTC',
    })

    expect(dateKeys).toEqual(['2026-06-29', '2026-06-30', '2026-07-01'])
  })
})
