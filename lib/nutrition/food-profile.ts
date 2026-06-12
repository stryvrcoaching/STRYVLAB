import type { CategoryL1, FoodItem } from './food-items'

export type AdvisorMacroKey = 'protein' | 'carbs' | 'fat'

export type FoodPortionFamily =
  | 'oil'
  | 'nut_butter'
  | 'nuts_seeds'
  | 'sauce'
  | 'lean_protein'
  | 'fatty_protein'
  | 'dairy_protein'
  | 'starch_cooked'
  | 'starch_dry'
  | 'fruit'
  | 'vegetable'
  | 'drink'
  | 'generic'

export interface FoodMetabolicProfile {
  dominantMacro: AdvisorMacroKey | null
  recommendedCategory: CategoryL1
  family: FoodPortionFamily
  minPortionG: number
  maxPortionG: number
}

function normalize(text: string | null | undefined): string {
  return (text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
}

function getEnergyShares(item: FoodItem) {
  const proteinKcal = item.protein_per_100g * 4
  const carbsKcal = item.carbs_per_100g * 4
  const fatKcal = item.fat_per_100g * 9
  const total = proteinKcal + carbsKcal + fatKcal

  if (total <= 0) {
    return { proteinShare: 0, carbsShare: 0, fatShare: 0 }
  }

  return {
    proteinShare: proteinKcal / total,
    carbsShare: carbsKcal / total,
    fatShare: fatKcal / total,
  }
}

export function getDominantMacroProfile(item: FoodItem): AdvisorMacroKey | null {
  const { proteinShare, carbsShare, fatShare } = getEnergyShares(item)
  const category = item.category_l1
  const fatG = item.fat_per_100g
  const carbsG = item.carbs_per_100g
  const proteinG = item.protein_per_100g
  const itemName = normalize(item.name_fr)

  if (category === 'vegetables' || category === 'fruits' || category === 'drinks') {
    if (category === 'fruits') return 'carbs'
    return null
  }

  if (
    itemName.includes('beurre de cacahu') ||
    itemName.includes('beurre d amande') ||
    itemName.includes('beurre de noix') ||
    itemName.includes('peanut butter') ||
    itemName.includes('pate de cacahu')
  ) {
    return 'fat'
  }

  if (proteinG >= 10 && proteinShare >= 0.38) return 'protein'
  if (fatG >= 8 && fatShare >= 0.42) return 'fat'
  if (carbsG >= 12 && carbsShare >= 0.45) return 'carbs'

  if (fatShare >= proteinShare && fatShare >= carbsShare && fatG >= 5) return 'fat'
  if (proteinShare >= carbsShare && proteinG >= 6) return 'protein'
  if (carbsG > 0) return 'carbs'
  return null
}

export function recommendFoodCategory(item: FoodItem): CategoryL1 {
  const normalizedName = normalize(item.name_fr)

  if (item.category_l1 === 'vegetables' || item.category_l1 === 'fruits' || item.category_l1 === 'drinks') {
    return item.category_l1
  }

  if (normalizedName.includes('beurre de cacahu') || normalizedName.includes('peanut butter')) {
    return 'fats'
  }
  if (
    normalizedName.includes('whey') ||
    normalizedName.includes('isolate') ||
    normalizedName.includes('caseine') ||
    normalizedName.includes('caséine') ||
    normalizedName.includes('protein powder') ||
    normalizedName.includes('protéine')
  ) {
    return 'proteins'
  }

  if (item.category_l1 !== 'extras') {
    const dominant = getDominantMacroProfile(item)
    if (dominant === 'protein') return 'proteins'
    if (dominant === 'carbs') return 'carbs'
    if (dominant === 'fat') return 'fats'
  }

  return item.category_l1
}

export function inferFoodPortionFamily(item: FoodItem): FoodPortionFamily {
  const name = normalize(item.name_fr)
  const subcategory = normalize(item.category_l2)
  const dominant = getDominantMacroProfile(item)

  if (subcategory.includes('huile') || name.includes('huile ')) return 'oil'
  if (
    name.includes('beurre de cacahu') ||
    name.includes('beurre d amande') ||
    name.includes('peanut butter') ||
    name.includes('tahini')
  ) return 'nut_butter'
  if (subcategory.includes('noix') || subcategory.includes('graines') || name.includes('amande') || name.includes('noix')) return 'nuts_seeds'
  if (
    subcategory.includes('sauce') ||
    name.includes('sirop') ||
    name.includes('coulis') ||
    name.includes('ketchup') ||
    name.includes('barbecue') ||
    name.includes('bbq') ||
    name.includes('vinaigrette') ||
    name.includes('mayonnaise') ||
    name.includes('pesto')
  ) return 'sauce'
  if (item.category_l1 === 'vegetables') return 'vegetable'
  if (item.category_l1 === 'fruits') return 'fruit'
  if (item.category_l1 === 'drinks') return 'drink'
  if (subcategory.includes('fecule') || subcategory.includes('cereale') || subcategory.includes('pain') || dominant === 'carbs') {
    if (name.includes('cru') || name.includes('sec')) return 'starch_dry'
    return 'starch_cooked'
  }
  if (subcategory.includes('laitier') || name.includes('skyr') || name.includes('yaourt') || name.includes('fromage blanc')) {
    return 'dairy_protein'
  }
  if (dominant === 'protein') {
    return item.fat_per_100g >= 10 ? 'fatty_protein' : 'lean_protein'
  }
  if (dominant === 'fat') return 'nuts_seeds'
  return 'generic'
}

export function getPortionBoundsForFamily(family: FoodPortionFamily): { min: number; max: number } {
  switch (family) {
    case 'oil':
      return { min: 5, max: 15 }
    case 'nut_butter':
      return { min: 10, max: 40 }
    case 'nuts_seeds':
      return { min: 10, max: 35 }
    case 'sauce':
      return { min: 10, max: 40 }
    case 'lean_protein':
      return { min: 40, max: 250 }
    case 'fatty_protein':
      return { min: 40, max: 180 }
    case 'dairy_protein':
      return { min: 80, max: 300 }
    case 'starch_dry':
      return { min: 25, max: 120 }
    case 'starch_cooked':
      return { min: 60, max: 300 }
    case 'fruit':
      return { min: 80, max: 250 }
    case 'vegetable':
      return { min: 60, max: 350 }
    case 'drink':
      return { min: 150, max: 500 }
    default:
      return { min: 25, max: 180 }
  }
}

export function buildFoodMetabolicProfile(item: FoodItem): FoodMetabolicProfile {
  const dominantMacro = getDominantMacroProfile(item)
  const family = inferFoodPortionFamily(item)
  const bounds = getPortionBoundsForFamily(family)

  return {
    dominantMacro,
    recommendedCategory: recommendFoodCategory(item),
    family,
    minPortionG: bounds.min,
    maxPortionG: bounds.max,
  }
}
