import { describe, it, expect } from 'vitest'
import { computeTriggers } from '@/lib/nutrition/engine/triggers'

describe('computeTriggers — fatigue trigger', () => {
  it('low sleep + high stress + low energy → fatigue trigger', () => {
    const triggers = computeTriggers({
      avgSleepH: 5.5,
      avgEnergyLevel: 2,
      avgStressLevel: 4,
      avgHungerLevel: 2,
      avgMuscleSoreness: 2,
      isLowCarbDay: false,
      rpeLastSession: null,
      performanceTrend: 'stable',
    })
    const fatigue = triggers.find(t => t.trigger === 'fatigue')
    expect(fatigue).toBeDefined()
    expect(fatigue!.doNotCutCalories).toBe(true)
    expect(fatigue!.severity).toBe('warning')
  })

  it('low sleep alone triggers fatigue', () => {
    const triggers = computeTriggers({
      avgSleepH: 5.5,
      avgEnergyLevel: 4,
      avgStressLevel: 2,
      avgHungerLevel: 2,
      avgMuscleSoreness: 1,
      isLowCarbDay: false,
      rpeLastSession: null,
      performanceTrend: 'stable',
    })
    expect(triggers.find(t => t.trigger === 'fatigue')).toBeDefined()
  })

  it('no fatigue trigger when all signals normal', () => {
    const triggers = computeTriggers({
      avgSleepH: 7.5,
      avgEnergyLevel: 4,
      avgStressLevel: 2,
      avgHungerLevel: 2,
      avgMuscleSoreness: 1,
      isLowCarbDay: false,
      rpeLastSession: null,
      performanceTrend: 'stable',
    })
    expect(triggers.find(t => t.trigger === 'fatigue')).toBeUndefined()
  })
})

describe('computeTriggers — stagnation trigger', () => {
  it('RPE high + declining performance + soreness ≥ 3 → stagnation trigger', () => {
    const triggers = computeTriggers({
      avgSleepH: 7,
      avgEnergyLevel: 3,
      avgStressLevel: 3,
      avgHungerLevel: 2,
      avgMuscleSoreness: 3,
      isLowCarbDay: false,
      rpeLastSession: 9,
      performanceTrend: 'declining',
    })
    const stagnation = triggers.find(t => t.trigger === 'stagnation')
    expect(stagnation).toBeDefined()
    expect(stagnation!.doNotCutCalories).toBe(true)
  })

  it('no stagnation without all 3 signals', () => {
    const triggers = computeTriggers({
      avgSleepH: 7,
      avgEnergyLevel: 3,
      avgStressLevel: 2,
      avgHungerLevel: 2,
      avgMuscleSoreness: 2,
      isLowCarbDay: false,
      rpeLastSession: 9,
      performanceTrend: 'improving',
    })
    expect(triggers.find(t => t.trigger === 'stagnation')).toBeUndefined()
  })
})

describe('computeTriggers — hunger trigger', () => {
  it('repeated high hunger on low-carb day → hunger trigger', () => {
    const triggers = computeTriggers({
      avgSleepH: 7,
      avgEnergyLevel: 3,
      avgStressLevel: 2,
      avgHungerLevel: 3,
      avgMuscleSoreness: 1,
      isLowCarbDay: true,
      rpeLastSession: null,
      performanceTrend: 'stable',
    })
    const hunger = triggers.find(t => t.trigger === 'hunger')
    expect(hunger).toBeDefined()
    expect(hunger!.doNotCutCalories).toBe(true)
  })

  it('hunger 3 on HIGH carb day → no hunger trigger', () => {
    const triggers = computeTriggers({
      avgSleepH: 7,
      avgEnergyLevel: 3,
      avgStressLevel: 2,
      avgHungerLevel: 3,
      avgMuscleSoreness: 1,
      isLowCarbDay: false,
      rpeLastSession: null,
      performanceTrend: 'stable',
    })
    expect(triggers.find(t => t.trigger === 'hunger')).toBeUndefined()
  })

  it('no trigger when hunger is low (≤ 2)', () => {
    const triggers = computeTriggers({
      avgSleepH: 7,
      avgEnergyLevel: 3,
      avgStressLevel: 2,
      avgHungerLevel: 2,
      avgMuscleSoreness: 1,
      isLowCarbDay: true,
      rpeLastSession: null,
      performanceTrend: 'stable',
    })
    expect(triggers.find(t => t.trigger === 'hunger')).toBeUndefined()
  })
})

describe('computeTriggers — multiple triggers', () => {
  it('can return multiple triggers simultaneously', () => {
    const triggers = computeTriggers({
      avgSleepH: 5,
      avgEnergyLevel: 2,
      avgStressLevel: 4,
      avgHungerLevel: 4,
      avgMuscleSoreness: 4,
      isLowCarbDay: true,
      rpeLastSession: 10,
      performanceTrend: 'declining',
    })
    expect(triggers.length).toBeGreaterThanOrEqual(2)
  })
})
