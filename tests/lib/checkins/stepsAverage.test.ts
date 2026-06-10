import { describe, it, expect } from 'vitest'
import { computeStepsRollingAverage } from '@/lib/client/checkin/stepsAverage'

describe('computeStepsRollingAverage', () => {
  it('returns null when no data', () => {
    expect(computeStepsRollingAverage([])).toBeNull()
  })

  it('averages up to 7 values', () => {
    const avg = computeStepsRollingAverage([
      { date: '2026-05-29', daily_steps: 10000 },
      { date: '2026-05-28', daily_steps: 8000 },
      { date: '2026-05-27', daily_steps: 6000 },
    ])
    expect(avg).toBe(8000)
  })

  it('uses fewer days when less than 7 entries', () => {
    const avg = computeStepsRollingAverage([
      { date: '2026-05-29', daily_steps: 3000 },
      { date: '2026-05-28', daily_steps: 5000 },
    ])
    expect(avg).toBe(4000)
  })

  it('ignores null or zero steps', () => {
    const avg = computeStepsRollingAverage([
      { date: '2026-05-29', daily_steps: null },
      { date: '2026-05-28', daily_steps: 0 },
      { date: '2026-05-27', daily_steps: 9000 },
    ])
    expect(avg).toBe(9000)
  })
})
