import { describe, it, expect } from 'vitest'
import { analyzeWeek } from '@/lib/nutrition/engine/weeklyAnalysis'
import type { WeeklyCheckinSummary } from '@/lib/nutrition/engine/types'

const BASE: WeeklyCheckinSummary = {
  weightSamples: 5,
  avgWeightKg: 80,
  prevWeekAvgWeightKg: 80,
  waistMeasurements: 1,
  waistTrend: 'stable',
  avgEnergyLevel: 3.5,
  avgSleepH: 7,
  avgStressLevel: 2,
  avgHungerLevel: 2,
  avgMuscleSoreness: 2,
  adherencePct: 0.92,
  performanceTrend: 'stable',
  consecutiveFatigueDays: 0,
}

describe('analyzeWeek — Case 1: optimal recomposition', () => {
  it('stable weight + waist down → no_change', () => {
    const r = analyzeWeek({ ...BASE, waistTrend: 'down', avgWeightKg: 80.1, prevWeekAvgWeightKg: 80 })
    expect(r.diagnosis).toBe('optimal_recomp')
    expect(r.action).toBe('no_change')
    expect(r.carbAdjustmentPct).toBeNull()
    expect(r.guardrailTriggered).toBeNull()
    expect(r.confidence).toBeDefined()
  })
})

describe('analyzeWeek — Case 2: behavioral', () => {
  it('adherence < 85% → focus_adherence, no calorie change', () => {
    const r = analyzeWeek({ ...BASE, adherencePct: 0.70, waistTrend: 'stable' })
    expect(r.diagnosis).toBe('behavioral')
    expect(r.action).toBe('focus_adherence')
    expect(r.carbAdjustmentPct).toBeNull()
  })
})

describe('analyzeWeek — Case 3: deficit too aggressive', () => {
  it('fast weight loss + low energy + declining perf → adjust_carbs_up', () => {
    const r = analyzeWeek({
      ...BASE,
      avgWeightKg: 78.5,
      prevWeekAvgWeightKg: 80,
      avgEnergyLevel: 2,
      performanceTrend: 'declining',
      adherencePct: 0.90,
    })
    expect(r.diagnosis).toBe('deficit_aggressive')
    expect(r.action).toBe('adjust_carbs_up')
    expect(r.carbAdjustmentPct).toBeGreaterThan(0)
    expect(r.carbAdjustmentPct).toBeLessThanOrEqual(10)
  })

  it('weight loss > 0.8kg without low energy or perf decline → NOT aggressive', () => {
    const r = analyzeWeek({
      ...BASE,
      avgWeightKg: 79,
      prevWeekAvgWeightKg: 80,
      avgEnergyLevel: 4,
      performanceTrend: 'stable',
    })
    expect(r.diagnosis).not.toBe('deficit_aggressive')
  })
})

describe('analyzeWeek — Case 4: real surplus', () => {
  it('waist up + weight up + good adherence → adjust_carbs_down', () => {
    const r = analyzeWeek({
      ...BASE,
      waistTrend: 'up',
      avgWeightKg: 81,
      prevWeekAvgWeightKg: 80,
      adherencePct: 0.95,
    })
    expect(r.diagnosis).toBe('surplus_real')
    expect(r.action).toBe('adjust_carbs_down')
    expect(r.carbAdjustmentPct).toBeLessThan(0)
    expect(r.carbAdjustmentPct).toBeGreaterThanOrEqual(-10)
  })
})

describe('analyzeWeek — guardrails', () => {
  it('adherence < 85% → behavioral regardless of other signals', () => {
    const r = analyzeWeek({
      ...BASE,
      adherencePct: 0.70,
      waistTrend: 'up',
      avgWeightKg: 82,
      prevWeekAvgWeightKg: 80,
    })
    expect(r.diagnosis).toBe('behavioral')
    expect(r.guardrailTriggered).toBe('adherence_block')
  })

  it('fatigue block → recovery action, no calorie change', () => {
    const r = analyzeWeek({
      ...BASE,
      avgSleepH: 5,
      avgEnergyLevel: 2,
      consecutiveFatigueDays: 4,
      adherencePct: 0.90,
    })
    expect(r.action).toBe('recovery')
    expect(r.guardrailTriggered).toBe('fatigue_block')
    expect(r.carbAdjustmentPct).toBeNull()
  })
})

describe('analyzeWeek — insufficient data', () => {
  it('< 3 weight samples → insufficient_data', () => {
    const r = analyzeWeek({ ...BASE, weightSamples: 2 })
    expect(r.diagnosis).toBe('insufficient_data')
    expect(r.action).toBe('no_change')
    expect(r.confidence).toBe('medium')
  })

  it('downgrades confidence when nutrition data quality is low', () => {
    const r = analyzeWeek({
      ...BASE,
      dataQualityScore: 42,
      dataQualityNotes: ['poids:fallback'],
      performanceTrend: null,
      waistTrend: null,
    })
    expect(r.confidence).toBe('medium')
    expect(r.confidenceScore).toBeLessThan(80)
    expect(r.confidenceReasons.some((reason) => reason.includes('qualité'))).toBe(true)
  })
})
