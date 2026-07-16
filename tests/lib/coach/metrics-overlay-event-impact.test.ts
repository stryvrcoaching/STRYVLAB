import { describe, expect, it } from 'vitest'
import { analyzeEventImpact } from '@/lib/coach/metricsOverlay/eventImpact'

function dateAt(dayOffset: number) {
  return new Date(Date.UTC(2026, 0, 15 + dayOffset)).toISOString().slice(0, 10)
}

describe('metrics overlay event impact engine', () => {
  it('compares means around an event and excludes the event day', () => {
    const result = analyzeEventImpact([{
      key: 'weight',
      points: [
        { date: dateAt(-3), value: 70 },
        { date: dateAt(-2), value: 72 },
        { date: dateAt(-1), value: 74 },
        { date: dateAt(0), value: 999 },
        { date: dateAt(1), value: 76 },
        { date: dateAt(2), value: 78 },
        { date: dateAt(3), value: 80 },
      ],
    }], dateAt(0), 7)[0]

    expect(result).toMatchObject({
      beforeCount: 3,
      afterCount: 3,
      beforeAverage: 72,
      afterAverage: 78,
      absoluteDelta: 6,
      direction: 'up',
      reliability: 'low',
    })
  })

  it('marks an asymmetric comparison as insufficient when one side lacks data', () => {
    const result = analyzeEventImpact([{
      key: 'energy',
      points: [
        { date: dateAt(-2), value: 5 },
        { date: dateAt(-1), value: 6 },
        { date: dateAt(2), value: 8 },
      ],
    }], dateAt(0), 7)[0]

    expect(result.reliability).toBe('insufficient')
    expect(result.direction).toBe('insufficient')
    expect(result.limitations[0]).toContain('2 mesures')
  })

  it('labels a small relative change as stable', () => {
    const result = analyzeEventImpact([{
      key: 'sleep',
      points: [
        { date: dateAt(-2), value: 8 },
        { date: dateAt(-1), value: 8 },
        { date: dateAt(1), value: 8.1 },
        { date: dateAt(2), value: 8.1 },
      ],
    }], dateAt(0), 7)[0]

    expect(result.direction).toBe('stable')
  })

  it('keeps only points inside the selected before and after windows', () => {
    const result = analyzeEventImpact([{
      key: 'calories',
      points: [
        { date: dateAt(-8), value: 0 },
        { date: dateAt(-7), value: 100 },
        { date: dateAt(-1), value: 200 },
        { date: dateAt(1), value: 300 },
        { date: dateAt(7), value: 400 },
        { date: dateAt(8), value: 500 },
      ],
    }], dateAt(0), 7)[0]

    expect(result.beforeAverage).toBe(150)
    expect(result.afterAverage).toBe(350)
  })
})
