import { describe, expect, it } from 'vitest'
import { getCycleSyncAdjustment } from '@/lib/nutrition/engine/cycleSync'
import {
  getEffectiveCycleSyncAdjustment,
  normalizeCycleSyncProfile,
} from '@/lib/nutrition/cycle-sync-profile'

describe('cycle sync profile', () => {
  it('applies the full standard adjustment to a calibrated regular cycle', () => {
    const result = getEffectiveCycleSyncAdjustment({
      adjustment: getCycleSyncAdjustment('luteal'),
      cycleState: { confidence: 'calibrated', regularity: 'regular' },
      profile: { mode: 'standard', intensity_percent: 100 },
    })

    expect(result.adjustment.proteinDelta).toBe(10)
    expect(result.adjustment.carbsDelta).toBe(20)
    expect(result.adjustment.caloriesDelta).toBe(120)
    expect(result.isCautious).toBe(false)
  })

  it('caps the adjustment when an irregular cycle is still learning', () => {
    const result = getEffectiveCycleSyncAdjustment({
      adjustment: getCycleSyncAdjustment('luteal'),
      cycleState: { confidence: 'learning', regularity: 'irregular' },
      profile: { mode: 'standard', intensity_percent: 100 },
    })

    expect(result.confidenceFactor).toBe(0.65)
    expect(result.adjustment.proteinDelta).toBe(7)
    expect(result.adjustment.carbsDelta).toBe(13)
    expect(result.adjustment.caloriesDelta).toBe(80)
    expect(result.isCautious).toBe(true)
  })

  it('keeps custom intensity within safe bounds and reserves it to custom mode', () => {
    expect(normalizeCycleSyncProfile({ mode: 'custom', intensity_percent: 150 }).intensity_percent).toBe(125)
    expect(normalizeCycleSyncProfile({ mode: 'standard', intensity_percent: 50 }).intensity_percent).toBe(100)
    expect(normalizeCycleSyncProfile({ mode: 'conservative', intensity_percent: 100 }).intensity_percent).toBe(50)
  })
})
