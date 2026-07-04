import { describe, expect, it } from 'vitest'
import { applySmoothingOverlay } from '@/lib/nutrition/smoothing/apply-overlay'
import { buildSmoothingPlanDays } from '@/lib/nutrition/smoothing/compute-plan'

describe('nutrition smoothing overlay', () => {
  it('builds weighted future day adjustments that reconcile to the full budget', () => {
    const planDays = buildSmoothingPlanDays({
      planId: 'plan-1',
      direction: 'surplus',
      smoothableDeltaKcal: 361,
      futureDays: [
        { date: '2026-06-30', label: 'Jour haut', target_kcal: 2200 },
        { date: '2026-07-01', label: 'Jour bas', target_kcal: 1800 },
        { date: '2026-07-02', label: 'Jour moyen', target_kcal: 1950 },
        { date: '2026-07-03', label: 'Jour bas', target_kcal: 1750 },
      ],
    })

    expect(planDays).toHaveLength(4)
    expect(planDays.reduce((sum, day) => sum + day.kcal_delta, 0)).toBe(-361)
  })

  it('applies aggregated plan day deltas onto a target', () => {
    const result = applySmoothingOverlay({
      kcal: 1930,
      protein_g: 150,
      carbs_g: 200,
      fat_g: 60,
      water_ml: 2500,
    }, [
      {
        plan_id: 'plan-1',
        kcal_delta: -90,
        protein_delta_g: 0,
        carbs_delta_g: -15.8,
        fat_delta_g: -3,
      },
      {
        plan_id: 'plan-2',
        kcal_delta: -10,
        protein_delta_g: 0,
        carbs_delta_g: -1.7,
        fat_delta_g: -0.3,
      },
    ])

    expect(result.target).toMatchObject({
      kcal: 1830,
      protein_g: 150,
      carbs_g: 182.5,
      fat_g: 56.7,
      water_ml: 2500,
    })
    expect(result.overlay.totalKcalDelta).toBe(-100)
    expect(result.overlay.planIds).toEqual(['plan-1', 'plan-2'])
  })
})
