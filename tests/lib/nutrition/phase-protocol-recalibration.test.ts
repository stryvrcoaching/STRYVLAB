import { describe, expect, it } from 'vitest'
import { buildPhaseProtocolPreview } from '@/lib/nutrition/phase-protocol-recalibration'
import type { DayDraft } from '@/lib/nutrition/types'

const days: DayDraft[] = [
  {
    localId: 'training', name: 'Entraînement', calories: '2000', protein_g: '140', carbs_g: '220', fat_g: '62', hydration_ml: '', role: 'training', carb_cycle_type: '', cycle_sync_phase: '', recommendations: '',
    meal_plan: [{ id: 'lunch', title: 'Déjeuner', items: [{ id: 'rice', quantity_g: 100, alternatives: [], food: { id: 'rice', name_fr: 'Riz', category_l1: 'carbs', category_l2: null, icon_key: null, item_key: 'rice', kcal_per_100g: 360, protein_per_100g: 7, carbs_per_100g: 78, fat_per_100g: 1, fiber_per_100g: 1, source: 'test', is_verified: true } }] }],
  },
  { localId: 'rest', name: 'Repos', calories: '1800', protein_g: '130', carbs_g: '180', fat_g: '62', hydration_ml: '', role: 'rest', carb_cycle_type: '', cycle_sync_phase: '', recommendations: '', meal_plan: [] },
]

describe('phase protocol recalibration', () => {
  it('preserves day-type differences while applying the new macro ratios', () => {
    const preview = buildPhaseProtocolPreview({
      days,
      previousTarget: { calories: 2000, protein: 140, carbs: 220, fat: 62 },
      nextTarget: { calories: 2400, protein: 154, carbs: 286, fat: 68 },
    })

    expect(preview.days[0].protein_g).toBe('154')
    expect(preview.days[1].protein_g).toBe('143')
    expect(preview.days[1].carbs_g).toBe('234')
    expect(preview.days[0].meal_plan[0].items[0].quantity_g).toBeGreaterThan(100)
    expect(preview.changedDays).toBe(2)
  })
})
