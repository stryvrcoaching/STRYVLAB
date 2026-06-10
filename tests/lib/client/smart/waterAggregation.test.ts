import { describe, it, expect } from 'vitest'
import { groupWaterByTimeOfDay, type WaterLog } from '@/lib/client/smart/waterAggregation'

describe('groupWaterByTimeOfDay', () => {
  const mk = (iso: string, ml: number): WaterLog => ({ logged_at: iso, amount_ml: ml })

  it('returns zero totals for empty input', () => {
    const r = groupWaterByTimeOfDay([])
    expect(r.morning).toBe(0)
    expect(r.midday).toBe(0)
    expect(r.afternoon).toBe(0)
    expect(r.evening).toBe(0)
  })

  it('groups by time slot (morning 5-12, midday 12-15, afternoon 15-19, evening 19-24)', () => {
    const logs = [
      mk('2026-05-17T07:00:00Z', 250),
      mk('2026-05-17T09:30:00Z', 500),
      mk('2026-05-17T13:00:00Z', 250),
      mk('2026-05-17T16:00:00Z', 300),
      mk('2026-05-17T20:00:00Z', 250),
    ]
    const r = groupWaterByTimeOfDay(logs, 'UTC')
    expect(r.morning).toBe(750)
    expect(r.midday).toBe(250)
    expect(r.afternoon).toBe(300)
    expect(r.evening).toBe(250)
  })

  it('ignores logs before 5h or after 24h boundary', () => {
    const logs = [mk('2026-05-17T03:00:00Z', 100), mk('2026-05-17T07:00:00Z', 250)]
    const r = groupWaterByTimeOfDay(logs, 'UTC')
    expect(r.morning).toBe(250)
  })
})
