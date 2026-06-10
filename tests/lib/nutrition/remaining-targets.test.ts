import { describe, expect, it } from 'vitest'
import { getRemainingNutritionTargets } from '@/lib/nutrition/remaining-targets'

describe('getRemainingNutritionTargets', () => {
  it('returns full targets on an empty day', () => {
    const result = getRemainingNutritionTargets({
      dailyTargets: { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 },
      consumedToday: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    })

    expect(result).toEqual({
      calories: 2200,
      protein: 160,
      carbs: 220,
      fat: 70,
    })
  })

  it('returns positive and zero deltas on a partially filled day', () => {
    const result = getRemainingNutritionTargets({
      dailyTargets: { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 },
      consumedToday: { kcal: 1700, protein_g: 120, carbs_g: 210, fat_g: 70 },
    })

    expect(result).toEqual({
      calories: 500,
      protein: 40,
      carbs: 10,
      fat: 0,
    })
  })

  it('keeps negative values when macros are exceeded', () => {
    const result = getRemainingNutritionTargets({
      dailyTargets: { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 },
      consumedToday: { kcal: 2400, protein_g: 170, carbs_g: 210, fat_g: 85 },
    })

    expect(result).toEqual({
      calories: -200,
      protein: -10,
      carbs: 10,
      fat: -15,
    })
  })
})
