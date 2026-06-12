import { describe, expect, it } from 'vitest'
import type { FoodItem } from '@/lib/nutrition/food-items'
import { buildFoodMetabolicProfile, getDominantMacroProfile, recommendFoodCategory } from '@/lib/nutrition/food-profile'

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

describe('food metabolic profile', () => {
  it('classifies peanut butter as fat-dominant with realistic bounds', () => {
    const peanutButter = mkFood({
      name_fr: 'Beurre de cacahuète',
      category_l1: 'carbs',
      category_l2: 'sauces',
      kcal_per_100g: 588,
      protein_per_100g: 25,
      carbs_per_100g: 20,
      fat_per_100g: 50,
    })

    expect(getDominantMacroProfile(peanutButter)).toBe('fat')
    expect(recommendFoodCategory(peanutButter)).toBe('fats')
    expect(buildFoodMetabolicProfile(peanutButter)).toMatchObject({
      family: 'nut_butter',
      minPortionG: 10,
      maxPortionG: 40,
    })
  })

  it('classifies roasted chicken thigh as protein-dominant', () => {
    const chicken = mkFood({
      name_fr: 'Cuisse de poulet rôtie',
      category_l1: 'proteins',
      category_l2: 'viandes',
      kcal_per_100g: 215,
      protein_per_100g: 27,
      carbs_per_100g: 0,
      fat_per_100g: 11,
    })

    expect(getDominantMacroProfile(chicken)).toBe('protein')
    expect(recommendFoodCategory(chicken)).toBe('proteins')
    expect(buildFoodMetabolicProfile(chicken).maxPortionG).toBe(180)
  })

  it('keeps extras as extras unless the item is an explicit special case', () => {
    const ketchup = mkFood({
      name_fr: 'Ketchup',
      category_l1: 'extras',
      category_l2: 'sauces',
      kcal_per_100g: 101,
      protein_per_100g: 1,
      carbs_per_100g: 23,
      fat_per_100g: 0.3,
    })

    expect(recommendFoodCategory(ketchup)).toBe('extras')
    expect(buildFoodMetabolicProfile(ketchup).family).toBe('sauce')
  })
})
