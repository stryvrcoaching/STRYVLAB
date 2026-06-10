import { describe, it, expect } from 'vitest'
import { computeNutritionAlerts, type NutritionInput } from '@/lib/client/smart/nutritionAlerts'

describe('computeNutritionAlerts', () => {
  const baseInput: NutritionInput = {
    consumed: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, water_ml: 0 },
    target: { kcal: 2400, protein_g: 160, carbs_g: 280, fat_g: 70, water_ml: 2500 },
    currentHour: 14,
    hasLunchLog: true,
  }

  it('returns empty array if everything on track', () => {
    const input: NutritionInput = {
      ...baseInput,
      consumed: { kcal: 1400, protein_g: 110, carbs_g: 180, fat_g: 40, water_ml: 1500 },
    }
    const r = computeNutritionAlerts(input)
    expect(r.length).toBe(0)
  })

  it('triggers protein_low warning when behind schedule after 14h', () => {
    const input: NutritionInput = {
      ...baseInput,
      consumed: { ...baseInput.consumed, protein_g: 50 },
    }
    const r = computeNutritionAlerts(input)
    expect(r.find(a => a.code === 'protein_low')).toBeDefined()
    expect(r.find(a => a.code === 'protein_low')?.severity).toBe('warning')
  })

  it('triggers carbs_limit critical when carbs exceeds target', () => {
    const input: NutritionInput = {
      ...baseInput,
      consumed: { ...baseInput.consumed, carbs_g: 300 },
    }
    const r = computeNutritionAlerts(input)
    expect(r.find(a => a.code === 'carbs_limit')?.severity).toBe('critical')
  })

  it('triggers hydration_low warning if water < 50% after 14h', () => {
    const input: NutritionInput = {
      ...baseInput,
      consumed: { ...baseInput.consumed, water_ml: 1000 },
    }
    const r = computeNutritionAlerts(input)
    expect(r.find(a => a.code === 'hydration_low')?.severity).toBe('warning')
  })

  it('triggers lunch_missing info between 13h-14h if no lunch log', () => {
    const input: NutritionInput = { ...baseInput, currentHour: 13, hasLunchLog: false }
    const r = computeNutritionAlerts(input)
    expect(r.find(a => a.code === 'lunch_missing')?.severity).toBe('info')
  })

  it('does NOT trigger protein_low before 14h', () => {
    const input: NutritionInput = { ...baseInput, currentHour: 10, consumed: { ...baseInput.consumed, protein_g: 10 } }
    const r = computeNutritionAlerts(input)
    expect(r.find(a => a.code === 'protein_low')).toBeUndefined()
  })
})
