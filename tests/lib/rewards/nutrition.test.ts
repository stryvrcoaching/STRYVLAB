import { describe, expect, it } from 'vitest'
import { scoreNutritionDay } from '@/lib/rewards/nutrition'

const target = { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 70 }

describe('scoreNutritionDay', () => {
  it('rewards a day within the target corridors', () => {
    const result = scoreNutritionDay(target, { calories: 2020, protein_g: 148, carbs_g: 204, fat_g: 69 })
    expect(result?.adherence).toBeGreaterThan(0.95)
    expect(result?.points).toBeGreaterThan(0)
  })

  it('does not create negative points for a day far from the targets', () => {
    const result = scoreNutritionDay(target, { calories: 4200, protein_g: 20, carbs_g: 600, fat_g: 180 })
    expect(result?.points).toBe(0)
  })

  it('does not score a day without a usable target', () => {
    expect(scoreNutritionDay({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, target)).toBeNull()
  })
})
