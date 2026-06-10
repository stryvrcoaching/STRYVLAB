import { describe, expect, it } from 'vitest'
import { computeSimulationState } from '@/lib/nutrition/simulation-state'

describe('computeSimulationState', () => {
  it('adds only active preps to the simulated consumed totals', () => {
    const result = computeSimulationState({
      consumed: { kcal: 1200, protein_g: 90, carbs_g: 110, fat_g: 30, water_ml: 1500 },
      preps: [
        {
          id: 'prep-1',
          meal_slot: 'breakfast',
          variant_group_id: 'breakfast',
          scenario_key: 'default',
          is_active: true,
          total_calories: 420,
          total_protein_g: 30,
          total_carbs_g: 40,
          total_fat_g: 12,
        },
        {
          id: 'prep-2',
          meal_slot: 'breakfast',
          variant_group_id: 'breakfast',
          scenario_key: 'default',
          is_active: false,
          total_calories: 510,
          total_protein_g: 28,
          total_carbs_g: 55,
          total_fat_g: 18,
        },
      ],
      draftTotals: { calories: 200, protein: 10, carbs: 15, fat: 5 },
    })

    expect(result.activePreps).toHaveLength(1)
    expect(result.prepTotals).toEqual({
      kcal: 420,
      protein_g: 30,
      carbs_g: 40,
      fat_g: 12,
    })
    expect(result.simulatedConsumed).toEqual({
      kcal: 1820,
      protein_g: 130,
      carbs_g: 165,
      fat_g: 47,
      water_ml: 1500,
    })
  })

  it('groups active preps by meal slot', () => {
    const result = computeSimulationState({
      consumed: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, water_ml: 0 },
      preps: [
        {
          id: 'prep-a',
          meal_slot: 'dinner',
          variant_group_id: 'dinner',
          scenario_key: 'default',
          is_active: true,
          total_calories: 600,
          total_protein_g: 40,
          total_carbs_g: 55,
          total_fat_g: 18,
        },
        {
          id: 'prep-b',
          meal_slot: 'snack',
          variant_group_id: 'snack',
          scenario_key: 'default',
          is_active: true,
          total_calories: 180,
          total_protein_g: 12,
          total_carbs_g: 20,
          total_fat_g: 6,
        },
      ],
    })

    expect(result.activePrepsBySlot.breakfast).toEqual([])
    expect(result.activePrepsBySlot.lunch).toEqual([])
    expect(result.activePrepsBySlot.dinner.map(prep => prep.id)).toEqual(['prep-a'])
    expect(result.activePrepsBySlot.snack.map(prep => prep.id)).toEqual(['prep-b'])
  })

  it('filters simulated preps by active scenario key', () => {
    const result = computeSimulationState({
      consumed: { kcal: 1000, protein_g: 80, carbs_g: 90, fat_g: 30, water_ml: 1200 },
      preps: [
        {
          id: 'prep-default',
          meal_slot: 'lunch',
          variant_group_id: 'lunch',
          scenario_key: 'default',
          is_active: true,
          total_calories: 300,
          total_protein_g: 20,
          total_carbs_g: 25,
          total_fat_g: 8,
        },
        {
          id: 'prep-alt',
          meal_slot: 'lunch',
          variant_group_id: 'lunch',
          scenario_key: 'scenario-2',
          is_active: true,
          total_calories: 450,
          total_protein_g: 30,
          total_carbs_g: 40,
          total_fat_g: 12,
        },
      ],
      activeScenarioKey: 'scenario-2',
    })

    expect(result.activePreps.map((prep) => prep.id)).toEqual(['prep-alt'])
    expect(result.simulatedConsumed).toEqual({
      kcal: 1450,
      protein_g: 110,
      carbs_g: 130,
      fat_g: 42,
      water_ml: 1200,
    })
  })

  it('does not count preps without an explicit active flag', () => {
    const result = computeSimulationState({
      consumed: { kcal: 800, protein_g: 60, carbs_g: 70, fat_g: 20, water_ml: 0 },
      preps: [
        {
          id: 'prep-implicit',
          meal_slot: 'dinner',
          variant_group_id: 'dinner',
          total_calories: 500,
          total_protein_g: 30,
          total_carbs_g: 50,
          total_fat_g: 15,
        },
      ],
    })

    expect(result.activePreps).toHaveLength(0)
    expect(result.simulatedConsumed).toEqual({
      kcal: 800,
      protein_g: 60,
      carbs_g: 70,
      fat_g: 20,
      water_ml: 0,
    })
  })
})
