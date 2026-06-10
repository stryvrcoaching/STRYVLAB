import { describe, expect, it } from 'vitest'
import { computeActionableRemaining } from '@/lib/nutrition/actionable-remaining'

describe('computeActionableRemaining', () => {
  it('keeps informative and actionable layers identical when there is no overflow', () => {
    const result = computeActionableRemaining({
      target: { kcal: 2237, protein_g: 153, carbs_g: 260, fat_g: 65 },
      consumed: { kcal: 1000, protein_g: 80, carbs_g: 100, fat_g: 20 },
      profile: { gender: 'male', weightKg: 90 },
    })

    expect(result.informativeRemaining).toEqual({
      calories: 1237,
      protein: 73,
      carbs: 160,
      fat: 45,
    })
    expect(result.actionableRemaining).toEqual({
      calories: 1337,
      protein: 73,
      carbs: 160,
      fat: 45,
    })
    expect(result.isExtremeCase).toBe(false)
  })

  it('compensates fat overflow on carbs first', () => {
    const result = computeActionableRemaining({
      target: { kcal: 2337, protein_g: 153, carbs_g: 260, fat_g: 65 },
      consumed: { kcal: 1749, protein_g: 94, carbs_g: 145, fat_g: 88 },
      profile: { gender: 'male', weightKg: 90 },
    })

    expect(result.informativeRemaining).toEqual({
      calories: 588,
      protein: 59,
      carbs: 115,
      fat: -23,
    })
    expect(result.actionableRemaining.protein).toBe(59)
    expect(result.actionableRemaining.carbs).toBe(63.2)
    expect(result.actionableRemaining.fat).toBe(0)
    expect(result.actionableRemaining.calories).toBe(488.8)
    expect(result.compensation.carbsReducedG).toBe(51.8)
    expect(result.compensation.fatReducedG).toBe(0)
  })

  it('protects the fat floor when carbs overflow must be compensated', () => {
    const result = computeActionableRemaining({
      target: { kcal: 2200, protein_g: 160, carbs_g: 200, fat_g: 70 },
      consumed: { kcal: 2100, protein_g: 120, carbs_g: 235, fat_g: 20 },
      profile: { gender: 'male', weightKg: 90 },
    })

    expect(result.fatFloorG).toBe(54)
    expect(result.minActionableFatG).toBe(34)
    expect(result.informativeRemaining.fat).toBe(50)
    expect(result.actionableRemaining.fat).toBe(34.4)
    expect(result.compensation.fatReducedG).toBe(15.6)
    expect(result.isExtremeCase).toBe(false)
  })

  it('enters extreme mode only when carbs and reducible fats are exhausted', () => {
    const result = computeActionableRemaining({
      target: { kcal: 2100, protein_g: 160, carbs_g: 50, fat_g: 55 },
      consumed: { kcal: 2400, protein_g: 90, carbs_g: 180, fat_g: 54 },
      profile: { gender: 'male', weightKg: 90 },
    })

    expect(result.actionableRemaining.carbs).toBe(0)
    expect(result.actionableRemaining.fat).toBe(0)
    expect(result.compensation.proteinReducedG).toBeGreaterThan(0)
    expect(result.isExtremeCase).toBe(true)
  })
})
