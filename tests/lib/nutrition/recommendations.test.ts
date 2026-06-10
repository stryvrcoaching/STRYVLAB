import { describe, expect, it } from 'vitest'
import { computeNutritionBalance } from '@/lib/nutrition/balance'
import { suggestFoodsFromBalance } from '@/lib/nutrition/recommendations'

describe('suggestFoodsFromBalance', () => {
  it('prioritizes carb-lean suggestions when protein and fat are already over', () => {
    const balance = computeNutritionBalance(
      { kcal: 1900, protein_g: 150, carbs_g: 80, fat_g: 80, water_ml: 1500 },
      { kcal: 2200, protein_g: 120, carbs_g: 160, fat_g: 65, water_ml: 2500 },
    )

    const suggestions = suggestFoodsFromBalance(balance)
    expect(suggestions[0]?.label).toContain('Fruits')
    expect(suggestions.some(s => s.label.includes('poulet'))).toBe(false)
  })
})
