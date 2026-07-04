import { describe, expect, it } from 'vitest'
import { aggregateMealsByDate, buildNutritionProtocolCardAnalytics } from '@/lib/nutrition/protocol-card-analytics'

describe('nutrition protocol card analytics', () => {
  it('builds workout-aligned analytics from recent nutrition data', () => {
    const mealsByDate = aggregateMealsByDate([
      { physiological_date: '2026-07-01', total_protein_g: 150, total_carbs_g: 200, total_fat_g: 70, total_fiber_g: 20 },
      { physiological_date: '2026-06-30', total_protein_g: 140, total_carbs_g: 180, total_fat_g: 60, total_fiber_g: 18 },
      { physiological_date: '2026-06-29', total_protein_g: 160, total_carbs_g: 210, total_fat_g: 72, total_fiber_g: 21 },
    ])
    const waterByDate = new Map([
      ['2026-07-01', 2500],
      ['2026-06-30', 2400],
      ['2026-06-29', 2300],
    ])

    const analytics = buildNutritionProtocolCardAnalytics({
      dateKeys: ['2026-06-29', '2026-06-30', '2026-07-01'],
      protocol: {
        schedule_start_date: '2026-06-01',
        days: [
          { position: 0, name: 'Training day', calories: 2200, protein_g: 150, carbs_g: 220, fat_g: 65, hydration_ml: 2400, carb_cycle_type: 'high' },
        ],
        schedule_slots: [],
      },
      mealsByDate,
      waterByDate,
    })

    expect(analytics.days_count).toBe(1)
    expect(analytics.analyzed_days_count).toBe(3)
    expect(analytics.kcal_delta_trend.length).toBe(3)
    expect(analytics.kcal_variation_trend.length).toBe(2)
    expect(analytics.reliability_label).toBe('Fiables')
    expect(analytics.nutrition_score).not.toBeNull()
  })

  it('falls back to the protocol schedule range when no date keys are provided', () => {
    const mealsByDate = aggregateMealsByDate([
      { physiological_date: '2026-06-29', total_protein_g: 160, total_carbs_g: 210, total_fat_g: 72, total_fiber_g: 21 },
      { physiological_date: '2026-06-30', total_protein_g: 140, total_carbs_g: 180, total_fat_g: 60, total_fiber_g: 18 },
      { physiological_date: '2026-07-01', total_protein_g: 150, total_carbs_g: 200, total_fat_g: 70, total_fiber_g: 20 },
    ])
    const waterByDate = new Map([
      ['2026-06-29', 2300],
      ['2026-06-30', 2400],
      ['2026-07-01', 2500],
    ])

    const analytics = buildNutritionProtocolCardAnalytics({
      dateKeys: [],
      referenceDateKey: '2026-07-01',
      protocol: {
        schedule_start_date: '2026-06-29',
        days: [
          { position: 0, name: 'Training day', calories: 2200, protein_g: 150, carbs_g: 220, fat_g: 65, hydration_ml: 2400, carb_cycle_type: 'high' },
        ],
        schedule_slots: [],
      },
      mealsByDate,
      waterByDate,
    })

    expect(analytics.analyzed_days_count).toBe(3)
    expect(analytics.reliability_label).toBe('Fiables')
  })
})
