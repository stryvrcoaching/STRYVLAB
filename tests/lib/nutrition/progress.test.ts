import { describe, expect, it } from 'vitest'
import { getNutritionProgressMeta } from '@/lib/nutrition/progress'

describe('getNutritionProgressMeta', () => {
  it('returns under state when clearly below target', () => {
    expect(getNutritionProgressMeta(40, 100)).toMatchObject({
      state: 'under',
      clampedPercent: 40,
      overflowPercent: 0,
    })
  })

  it('returns in_target state when comfortably within target', () => {
    expect(getNutritionProgressMeta(80, 100)).toMatchObject({
      state: 'in_target',
      clampedPercent: 80,
      overflowPercent: 0,
    })
  })

  it('returns near_limit state close to the cap', () => {
    expect(getNutritionProgressMeta(95, 100)).toMatchObject({
      state: 'near_limit',
      clampedPercent: 95,
      overflowPercent: 0,
    })
  })

  it('returns over state with overflow percent above target', () => {
    expect(getNutritionProgressMeta(115, 100)).toMatchObject({
      state: 'over',
      clampedPercent: 100,
      overflowPercent: 15,
    })
  })
})
