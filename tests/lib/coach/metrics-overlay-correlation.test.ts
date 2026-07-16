import { describe, expect, it } from 'vitest'
import { analyzeOverlayCorrelations } from '@/lib/coach/metricsOverlay/correlation'
import type { OverlaySeriesPoint } from '@/lib/coach/metricsOverlay/types'

function dateAt(dayOffset: number) {
  const date = new Date(Date.UTC(2026, 0, 1 + dayOffset))
  return date.toISOString().slice(0, 10)
}

function points(values: number[], startDay = 0): OverlaySeriesPoint[] {
  return values.map((value, index) => ({ date: dateAt(startDay + index), value }))
}

const dailyValues = [
  4, 9, 2, 8, 5, 11, 3, 10, 6, 13,
  7, 12, 5, 15, 8, 14, 9, 17, 11, 16,
  10, 18, 13, 20, 12, 19, 15, 22, 14, 21,
]

describe('metrics overlay correlation engine', () => {
  it('detects a reliable positive signal and exposes its evidence', () => {
    const results = analyzeOverlayCorrelations([
      { key: 'sleep', family: 'recovery', points: points(dailyValues) },
      { key: 'energy', family: 'recovery', points: points(dailyValues.map((value) => value * 2 + 3)) },
    ], { smoothingWindowDays: 1 })

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      direction: 'positive',
      reliability: 'high',
      overlapCount: 30,
      bestLagDays: 0,
    })
    expect(results[0].coefficient).toBeCloseTo(1, 5)
    expect(results[0].coverage).toBe(1)
  })

  it('detects an inverse signal', () => {
    const result = analyzeOverlayCorrelations([
      { key: 'stress', family: 'recovery', points: points(dailyValues) },
      { key: 'energy', family: 'recovery', points: points(dailyValues.map((value) => 30 - value)) },
    ], { smoothingWindowDays: 1 })[0]

    expect(result.direction).toBe('inverse')
    expect(result.coefficient).toBeCloseTo(-1, 5)
  })

  it('identifies a leading series only when the delayed fit improves clearly', () => {
    const leadingValues = dailyValues.slice(0, 25)
    const result = analyzeOverlayCorrelations([
      { key: 'training_load', family: 'performance', points: points(leadingValues) },
      { key: 'fatigue', family: 'recovery', points: points(leadingValues, 3) },
    ], { smoothingWindowDays: 1, maxLagDays: 7 })[0]

    expect(result.bestLagDays).toBe(3)
    expect(result.leadingKey).toBe('training_load')
    expect(result.followingKey).toBe('fatigue')
    expect(result.coefficient).toBeCloseTo(1, 5)
  })

  it('keeps a five-point result at low reliability', () => {
    const values = dailyValues.slice(0, 5)
    const result = analyzeOverlayCorrelations([
      { key: 'sleep', family: 'recovery', points: points(values) },
      { key: 'energy', family: 'recovery', points: points(values.map((value) => value * 2)) },
    ], { smoothingWindowDays: 1 })[0]

    expect(result.reliability).toBe('low')
    expect(result.limitations).toContain('Échantillon limité : moins de 10 observations comparables.')
  })

  it('lowers confidence when gaps reduce coverage', () => {
    const sparsePoints = dailyValues
      .map((value, index) => ({ date: dateAt(index), value }))
      .filter((_, index) => index < 8 || index > 21)
    const result = analyzeOverlayCorrelations([
      { key: 'sleep', family: 'recovery', points: points(dailyValues) },
      { key: 'energy', family: 'recovery', points: sparsePoints },
    ], { smoothingWindowDays: 1 })[0]

    expect(result.coverage).toBeLessThan(0.75)
    expect(result.limitations).toContain('Couverture partielle sur la période sélectionnée.')
  })

  it('does not emit a result below the minimum overlap', () => {
    const values = dailyValues.slice(0, 4)
    const results = analyzeOverlayCorrelations([
      { key: 'sleep', family: 'recovery', points: points(values) },
      { key: 'energy', family: 'recovery', points: points(values) },
    ])

    expect(results).toEqual([])
  })
})
