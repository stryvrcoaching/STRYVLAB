import { describe, it, expect } from 'vitest'
import { calcAdaptiveTdee, linearRegression } from '@/lib/nutrition/adaptiveTdee'

const DAY = (offset: number, weight: number) => ({
  date: new Date(Date.UTC(2026, 4, offset + 1)).toISOString().slice(0, 10),
  weight_kg: weight,
})

describe('linearRegression', () => {
  it('returns correct slope for steady weight loss', () => {
    const samples = [DAY(0, 80), DAY(7, 79.3), DAY(14, 78.6)]
    const { slope } = linearRegression(samples)
    expect(slope).toBeCloseTo(-0.1, 1)
  })

  it('returns near-zero slope for stable weight', () => {
    const samples = [DAY(0, 75), DAY(7, 75.1), DAY(14, 74.9)]
    const { slope } = linearRegression(samples)
    expect(Math.abs(slope)).toBeLessThan(0.02)
  })

  it('handles unsorted samples correctly', () => {
    const sorted = [DAY(0, 80), DAY(7, 79.3)]
    const unsorted = [DAY(7, 79.3), DAY(0, 80)]
    const r1 = linearRegression(sorted)
    const r2 = linearRegression(unsorted)
    expect(r1.slope).toBeCloseTo(r2.slope, 4)
  })
})

describe('calcAdaptiveTdee', () => {
  it('TDEE > intake when losing weight', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 80), DAY(7, 79.5), DAY(14, 79.0)],
      avgIntakeKcal: 2000,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    expect(result.tdeeAdaptive).toBeGreaterThan(2000)
  })

  it('TDEE < intake when gaining weight', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 75), DAY(7, 75.4), DAY(14, 75.8)],
      avgIntakeKcal: 2500,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    expect(result.tdeeAdaptive).toBeLessThan(2500)
  })

  it('TDEE ≈ intake when weight stable', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 70), DAY(7, 70.05), DAY(14, 69.95)],
      avgIntakeKcal: 2200,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    expect(Math.abs(result.tdeeAdaptive - 2200)).toBeLessThan(100)
  })

  it('throws when fewer than 2 samples', () => {
    expect(() => calcAdaptiveTdee({
      weightSamples: [DAY(0, 80)],
      avgIntakeKcal: 2000,
      caloriesSource: 'logs',
      windowDays: 14,
    })).toThrow('At least 2 weight samples required')
  })

  it('rounds result to nearest 10 kcal', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 80), DAY(14, 79.0)],
      avgIntakeKcal: 2000,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    expect(result.tdeeAdaptive % 10).toBe(0)
  })

  it('confidence = low when source is protocol', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 80), DAY(7, 79.5), DAY(14, 79.0), DAY(10, 79.2)],
      avgIntakeKcal: 2000,
      caloriesSource: 'protocol',
      windowDays: 14,
    })
    expect(result.confidence).toBe('low')
    expect(result.confidenceReasons.length).toBeGreaterThan(0)
  })

  it('confidence = low when fewer than 4 samples', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 80), DAY(14, 79.0)],
      avgIntakeKcal: 2000,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    expect(result.confidence).toBe('low')
  })

  it('confidence = high when ≥4 samples + logs source', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 80), DAY(4, 79.7), DAY(8, 79.4), DAY(14, 79.0)],
      avgIntakeKcal: 2000,
      caloriesSource: 'logs',
      windowDays: 14,
      trackedDays: 10,
    })
    expect(result.confidence).toBe('high')
  })

  it('confidence drops to medium with partial tracked days', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 80), DAY(4, 79.8), DAY(8, 79.5), DAY(14, 79.2)],
      avgIntakeKcal: 2100,
      caloriesSource: 'logs',
      windowDays: 14,
      trackedDays: 5,
    })
    expect(result.confidence).toBe('medium')
    expect(result.confidenceScore).toBeLessThan(80)
  })

  it('weightDeltaKg = slope × windowDays', () => {
    const samples = [DAY(0, 80), DAY(7, 79.5), DAY(14, 79.0)]
    const result = calcAdaptiveTdee({
      weightSamples: samples,
      avgIntakeKcal: 2000,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    const { slope } = linearRegression(samples)
    expect(result.weightDeltaKg).toBeCloseTo(slope * 14, 2)
  })

  it('handles rapid weight loss (1 kg/week)', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 85), DAY(7, 84), DAY(14, 83)],
      avgIntakeKcal: 1800,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    expect(result.tdeeAdaptive).toBeGreaterThan(2500)
  })

  it('formula: tdee = avgIntake - slope * 7700', () => {
    const samples = [DAY(0, 80), DAY(14, 78.6)]
    const { slope } = linearRegression(samples)
    const expected = Math.round((2000 - slope * 7700) / 10) * 10
    const result = calcAdaptiveTdee({
      weightSamples: samples,
      avgIntakeKcal: 2000,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    expect(result.tdeeAdaptive).toBe(expected)
  })
})
