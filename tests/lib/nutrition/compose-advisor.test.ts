import { describe, expect, it } from 'vitest'
import type { FoodItem } from '@/lib/nutrition/food-items'
import { evaluateFoodCompatibility, isCompletionMode, suggestFoodQuantity } from '@/lib/nutrition/compose-advisor'

function mkFood(partial: Partial<FoodItem>): FoodItem {
  return {
    id: partial.id ?? 'f1',
    name_fr: partial.name_fr ?? 'Food',
    category_l1: partial.category_l1 ?? 'proteins',
    category_l2: partial.category_l2 ?? null,
    item_key: partial.item_key ?? 'food',
    kcal_per_100g: partial.kcal_per_100g ?? 100,
    protein_per_100g: partial.protein_per_100g ?? 0,
    carbs_per_100g: partial.carbs_per_100g ?? 0,
    fat_per_100g: partial.fat_per_100g ?? 0,
    fiber_per_100g: partial.fiber_per_100g ?? 0,
    source: partial.source ?? 'ciqual',
    is_verified: partial.is_verified ?? true,
  }
}

describe('suggestFoodQuantity', () => {
  it('suggests coherent grams for protein food', () => {
    const chicken = mkFood({ name_fr: 'Poulet', protein_per_100g: 24, fat_per_100g: 2, carbs_per_100g: 0, kcal_per_100g: 120 })
    const out = suggestFoodQuantity({
      food: chicken,
      remainingTargets: { protein_g: 40, carbs_g: 10, fat_g: 0 },
    })
    expect(out).not.toBeNull()
    expect(out?.macroFilled).toBe('protein')
    expect(out?.grams).toBeGreaterThan(150)
    expect(out?.grams).toBeLessThan(180)
    expect((out?.grams ?? 0) % 5).toBe(0)
  })

  it('suggests coherent grams for carb food', () => {
    const rice = mkFood({ name_fr: 'Riz', carbs_per_100g: 28, protein_per_100g: 2, fat_per_100g: 0.3, kcal_per_100g: 130, category_l1: 'carbs' })
    const out = suggestFoodQuantity({
      food: rice,
      remainingTargets: { protein_g: 0, carbs_g: 42, fat_g: 0 },
    })
    expect(out?.macroFilled).toBe('carbs')
    expect(out?.grams).toBe(150)
  })

  it('warns on lipidic food when fats are already covered', () => {
    const sardines = mkFood({ name_fr: "Sardines a l'huile", protein_per_100g: 23, fat_per_100g: 14, carbs_per_100g: 0, kcal_per_100g: 220 })
    const out = suggestFoodQuantity({
      food: sardines,
      remainingTargets: { protein_g: 40, carbs_g: 10, fat_g: 0 },
    })
    expect(out?.warning).toBeTruthy()
  })

  it('treats peanut butter as a fat food and caps the portion realistically', () => {
    const peanutButter = mkFood({
      name_fr: 'Beurre de cacahuète',
      category_l1: 'carbs',
      category_l2: 'sauces',
      protein_per_100g: 25,
      carbs_per_100g: 20,
      fat_per_100g: 50,
      kcal_per_100g: 588,
    })
    const out = suggestFoodQuantity({
      food: peanutButter,
      remainingTargets: { protein_g: 153, carbs_g: 260, fat_g: 65 },
      applyMealFraction: true,
    })
    expect(out).not.toBeNull()
    expect(out?.macroFilled).toBe('fat')
    expect(out?.grams).toBeLessThanOrEqual(40)
    expect(out?.warning).toContain('plafonnee')
  })

  it('keeps roasted chicken portions in a plausible range', () => {
    const chicken = mkFood({
      name_fr: 'Cuisse de poulet rôtie',
      category_l1: 'proteins',
      category_l2: 'viandes',
      protein_per_100g: 27,
      carbs_per_100g: 0,
      fat_per_100g: 11,
      kcal_per_100g: 215,
    })
    const out = suggestFoodQuantity({
      food: chicken,
      remainingTargets: { protein_g: 90, carbs_g: 260, fat_g: 65 },
      applyMealFraction: true,
    })
    expect(out).not.toBeNull()
    expect(out?.macroFilled).toBe('protein')
    expect(out?.grams).toBeGreaterThanOrEqual(120)
    expect(out?.grams).toBeLessThanOrEqual(180)
  })

  it('returns null when no macro remains to fill', () => {
    const food = mkFood({ protein_per_100g: 20, carbs_per_100g: 20, fat_per_100g: 10 })
    const out = suggestFoodQuantity({
      food,
      remainingTargets: { protein_g: 0, carbs_g: 0, fat_g: -5 },
    })
    expect(out).toBeNull()
  })
})

describe('isCompletionMode', () => {
  it('returns true when all macros < 30g and kcal < 200', () => {
    // P:10×4=40 + G:20×4=80 + F:5×9=45 = 165 kcal < 200
    expect(isCompletionMode({ protein_g: 10, carbs_g: 20, fat_g: 5 })).toBe(true)
  })
  it('returns false when any macro >= 30g', () => {
    expect(isCompletionMode({ protein_g: 30, carbs_g: 20, fat_g: 5 })).toBe(false)
  })
  it('returns false when total kcal >= 200', () => {
    // P:25×4=100 + G:25×4=100 = 200 — not < 200
    expect(isCompletionMode({ protein_g: 25, carbs_g: 25, fat_g: 0 })).toBe(false)
  })
})

describe('suggestFoodQuantity — applyMealFraction: true', () => {
  it('caps suggestion at 40% of remaining in normal mode', () => {
    const chicken = mkFood({ protein_per_100g: 24, fat_per_100g: 2, carbs_per_100g: 0, kcal_per_100g: 120 })
    // P:100g × 0.40 = 40g available → 40/24 × 100 = 166.7 → roundToStep = 165
    const out = suggestFoodQuantity({
      food: chicken,
      remainingTargets: { protein_g: 100, carbs_g: 200, fat_g: 60 },
      applyMealFraction: true,
    })
    expect(out).not.toBeNull()
    expect(out!.grams).toBeGreaterThanOrEqual(160)
    expect(out!.grams).toBeLessThanOrEqual(170)
  })
})

describe('suggestFoodQuantity — completion mode (applyMealFraction: true)', () => {
  it('uses min-grams algo: chicken fills protein, avoids fat overflow', () => {
    const chicken = mkFood({ protein_per_100g: 31, fat_per_100g: 3.6, carbs_per_100g: 0, kcal_per_100g: 165 })
    // P=10, G=20, F=5 → completion (allSmall + kcal=165 < 200)
    // fraction=0.80 → P_avail=8, F_avail=4
    // grams_P = (8/31)×100 = 25.8, grams_F = (4/3.6)×100 = 111 → min=25.8 → macro=protein
    const out = suggestFoodQuantity({
      food: chicken,
      remainingTargets: { protein_g: 10, carbs_g: 20, fat_g: 5 },
      applyMealFraction: true,
    })
    expect(out).not.toBeNull()
    expect(out!.macroFilled).toBe('protein')
    expect(out!.grams).toBe(40)
  })

  it('picks carbs fill for rice (min-grams wins over protein)', () => {
    const rice = mkFood({ protein_per_100g: 2.7, carbs_per_100g: 28, fat_per_100g: 0.3, kcal_per_100g: 130, category_l1: 'carbs' })
    // P=10, G=20, F=5 → completion
    // fraction=0.80 → G_avail=16, P_avail=8
    // grams_G = (16/28)×100 = 57.1, grams_P = (8/2.7)×100 = 296 → min=57.1 → macro=carbs
    const out = suggestFoodQuantity({
      food: rice,
      remainingTargets: { protein_g: 10, carbs_g: 20, fat_g: 5 },
      applyMealFraction: true,
    })
    expect(out).not.toBeNull()
    expect(out!.macroFilled).toBe('carbs')
    expect(out!.grams).toBeGreaterThanOrEqual(55)
    expect(out!.grams).toBeLessThanOrEqual(60)
  })

  it('adds warning when raw portion < 25g', () => {
    const chicken = mkFood({ protein_per_100g: 31, fat_per_100g: 3.6, carbs_per_100g: 0, kcal_per_100g: 165 })
    // P=5, G=8, F=3 → completion (kcal=5×4+8×4+3×9=20+32+27=79 < 200)
    // grams_P = (5×0.80/31)×100 = 12.9 → tooSmall=true
    const out = suggestFoodQuantity({
      food: chicken,
      remainingTargets: { protein_g: 5, carbs_g: 8, fat_g: 3 },
      applyMealFraction: true,
    })
    expect(out).not.toBeNull()
    expect(out!.warning).toContain('couvre bien')
  })
})

describe('evaluateFoodCompatibility', () => {
  it('marks poor fit for fat-heavy item when fat already covered', () => {
    const sardines = mkFood({ name_fr: "Sardines a l'huile", protein_per_100g: 23, fat_per_100g: 14, carbs_per_100g: 0 })
    const chicken = mkFood({ id: 'c2', name_fr: 'Blanc de poulet', protein_per_100g: 24, fat_per_100g: 2 })
    const skyr = mkFood({ id: 'c3', name_fr: 'Skyr 0%', protein_per_100g: 10, fat_per_100g: 0, category_l1: 'proteins' })

    const out = evaluateFoodCompatibility({
      food: sardines,
      remainingTargets: { protein_g: 40, carbs_g: 10, fat_g: 0 },
      alternativesPool: [sardines, chicken, skyr],
    })
    expect(out.status).toBe('poor_fit')
    expect(out.suggestedAlternatives?.length).toBeGreaterThan(0)
  })
})
