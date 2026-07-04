import { describe, expect, it } from 'vitest'
import {
  buildSmoothingProposal,
  computeSmoothableDeltaKcal,
  isDurationSafe,
  kcalDeltaToMacroAdjustment,
  recommendSmoothingDuration,
  resolveSmoothingDirection,
} from '@/lib/nutrition/smoothing/rules'

describe('nutrition smoothing rules', () => {
  it('treats the threshold symmetrically', () => {
    expect(resolveSmoothingDirection(50)).toBeNull()
    expect(resolveSmoothingDirection(-50)).toBeNull()
    expect(resolveSmoothingDirection(51)).toBe('surplus')
    expect(resolveSmoothingDirection(-51)).toBe('deficit')
  })

  it('computes smoothable delta beyond the threshold', () => {
    expect(computeSmoothableDeltaKcal(411)).toBe(361)
    expect(computeSmoothableDeltaKcal(-300)).toBe(-250)
  })

  it('rejects unsafe aggressive durations', () => {
    expect(isDurationSafe({
      smoothableDeltaKcal: 600,
      durationDays: 3,
      baseTargetKcal: 1900,
      direction: 'surplus',
    })).toBe(false)
  })

  it('recommends a safe duration among allowed options', () => {
    expect(recommendSmoothingDuration({
      rawDeltaKcal: 411,
      smoothableDeltaKcal: 361,
      baseTargetKcal: 1930,
    })).toBe(4)
  })

  it('builds a proposal from current target and intake', () => {
    expect(buildSmoothingProposal({
      targetKcal: 1930,
      consumedKcal: 2341,
    })).toMatchObject({
      eligible: true,
      rawDeltaKcal: 411,
      smoothableDeltaKcal: 361,
      direction: 'surplus',
      recommendedDurationDays: 4,
    })
  })

  it('converts kcal deltas to carbs and fats while keeping protein fixed', () => {
    expect(kcalDeltaToMacroAdjustment(-100)).toEqual({
      kcal: -100,
      protein_g: 0,
      carbs_g: -17.5,
      fat_g: -3.3,
    })
  })
})
