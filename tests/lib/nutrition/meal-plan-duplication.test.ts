import { describe, expect, it } from 'vitest'
import { duplicateMealPlanToDays } from '@/lib/nutrition/meal-plan-duplication'
import type { DayDraft } from '@/lib/nutrition/types'

function day(name: string, protein: string, carbs: string, fat: string): DayDraft {
  return {
    localId: name,
    name,
    calories: '2000',
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    hydration_ml: '',
    role: 'neutral',
    carb_cycle_type: '',
    cycle_sync_phase: '',
    recommendations: '',
    meal_plan: [
      {
        id: 'lunch',
        title: 'Déjeuner',
        items: [
          {
            id: 'chicken',
            quantity_g: 150,
            alternatives: [],
            food: {
              id: 'chicken',
              name_fr: 'Poulet',
              category_l1: 'proteins',
              category_l2: null,
              icon_key: null,
              item_key: 'chicken',
              kcal_per_100g: 165,
              protein_per_100g: 31,
              carbs_per_100g: 0,
              fat_per_100g: 3.6,
              fiber_per_100g: 0,
              source: 'test',
              is_verified: true,
            },
          },
          {
            id: 'rice',
            quantity_g: 120,
            alternatives: [],
            food: {
              id: 'rice',
              name_fr: 'Riz',
              category_l1: 'carbs',
              category_l2: null,
              icon_key: null,
              item_key: 'rice',
              kcal_per_100g: 360,
              protein_per_100g: 7,
              carbs_per_100g: 78,
              fat_per_100g: 0.6,
              fiber_per_100g: 1,
              source: 'test',
              is_verified: true,
            },
          },
        ],
      },
    ],
  }
}

describe('meal plan duplication', () => {
  it('copies meals without sharing mutable references', () => {
    const source = day('Source', '140', '220', '60')
    const result = duplicateMealPlanToDays({
      sourceDay: source,
      targets: [{ dayIndex: 1, day: day('Cible', '140', '220', '60') }],
      mode: 'exact_copy',
    })

    expect(result[0].mealPlan).toEqual(source.meal_plan)
    expect(result[0].mealPlan).not.toBe(source.meal_plan)
    expect(result[0].mealPlan[0].items[0]).not.toBe(source.meal_plan[0].items[0])
  })

  it('adjusts quantities to the macro targets of each destination day', () => {
    const source = day('Entraînement', '140', '220', '60')
    const result = duplicateMealPlanToDays({
      sourceDay: source,
      targets: [{ dayIndex: 1, day: day('Repos', '130', '180', '60') }],
      mode: 'adapt_to_target',
    })

    const chicken = result[0].mealPlan[0].items.find((item) => item.id === 'chicken')!
    const rice = result[0].mealPlan[0].items.find((item) => item.id === 'rice')!
    expect(chicken.quantity_g).toBeLessThan(150)
    expect(rice.quantity_g).toBeLessThan(120)
    expect(result[0].adjusted).toBe(true)
  })
})
