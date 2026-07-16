import { describe, expect, it } from 'vitest'
import { estimateClientTdeeV2, theilSenSlope } from '@/lib/nutrition/tdee-model-v2'

const DAY = (offset: number, weight: number) => ({
  date: new Date(Date.UTC(2026, 6, offset + 1)).toISOString().slice(0, 10),
  weight_kg: weight,
})

describe('estimateClientTdeeV2', () => {
  it('uses a robust median slope despite one weight spike', () => {
    const samples = [DAY(0, 80), DAY(3, 79.8), DAY(6, 83), DAY(9, 79.4), DAY(12, 79.2)]
    expect(theilSenSlope(samples.filter((sample) => sample.weight_kg !== 83))).toBeCloseTo(-0.067, 2)

    const result = estimateClientTdeeV2({
      weightSamples: samples,
      dailyIntakes: Array.from({ length: 12 }, (_, index) => ({ date: DAY(index, 0).date, kcal: 2200, complete: true })),
      fallbackIntakeKcal: 2200,
      windowDays: 14,
      contextChanged: false,
    })

    expect(result.outlierCount).toBe(1)
    expect(result.estimate).toBeGreaterThan(2200)
  })

  it('requires dense and stable client data before becoming actionable', () => {
    const result = estimateClientTdeeV2({
      weightSamples: Array.from({ length: 10 }, (_, index) => DAY(index, 75 - index * 0.03)),
      dailyIntakes: Array.from({ length: 12 }, (_, index) => ({ date: DAY(index, 0).date, kcal: 2300, complete: true })),
      fallbackIntakeKcal: 2300,
      windowDays: 14,
      contextChanged: false,
    })

    expect(result.status).toBe('actionable')
    expect(result.upper).toBeGreaterThan(result.lower)
  })

  it('keeps a recent context change under observation', () => {
    const result = estimateClientTdeeV2({
      weightSamples: Array.from({ length: 10 }, (_, index) => DAY(index, 75 - index * 0.03)),
      dailyIntakes: Array.from({ length: 12 }, (_, index) => ({ date: DAY(index, 0).date, kcal: 2300, complete: true })),
      fallbackIntakeKcal: 2300,
      windowDays: 14,
      contextChanged: true,
    })

    expect(result.status).toBe('observing')
    expect(result.reasons.join(' ')).toContain('contexte')
  })
})
