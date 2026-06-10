// lib/nutrition/engine/macroMatrix.ts
// Official STRYVR macro matrix — weight-based g/kg ratios, order: protein → fat → carbs (residual)
// Uses body weight, NOT lean mass — simpler UX, better reliability for general population
import type { EngineGoal, StryvrmMacros, CarbCyclingResult } from './types'

export const PROTEIN_RATIO: Record<EngineGoal, number> = {
  deficit: 2.2,
  maintenance: 2.0,
  surplus: 1.8,
}

export const FAT_RATIO: Record<EngineGoal, number> = {
  deficit: 0.8,
  maintenance: 1.0,
  surplus: 1.0,
}

export function computeBaseMacros(
  weight_kg: number,
  goal: EngineGoal,
  calories: number,
): StryvrmMacros {
  const protein_g = Math.round(weight_kg * PROTEIN_RATIO[goal])
  const fat_g = Math.round(weight_kg * FAT_RATIO[goal])
  const remaining = calories - protein_g * 4 - fat_g * 9
  const carbs_g = Math.max(0, Math.round(remaining / 4))
  return { protein_g, fat_g, carbs_g, calories }
}

// Carb cycling: only carbs flex, protein and fat stay fixed (per brief spec)
// carbHighMultiplier: e.g. 1.4 = +40% carbs on training days
// carbLowMultiplier:  e.g. 0.5 = -50% carbs on rest days
export function computeCarbCycling(
  base: StryvrmMacros,
  carbHighMultiplier: number,
  carbLowMultiplier: number,
): CarbCyclingResult {
  const highCarbs = Math.max(0, Math.round(base.carbs_g * carbHighMultiplier))
  const lowCarbs = Math.max(0, Math.round(base.carbs_g * carbLowMultiplier))
  const highCalories = base.protein_g * 4 + base.fat_g * 9 + highCarbs * 4
  const lowCalories = base.protein_g * 4 + base.fat_g * 9 + lowCarbs * 4
  return {
    base,
    high: { protein_g: base.protein_g, fat_g: base.fat_g, carbs_g: highCarbs, calories: highCalories },
    low: { protein_g: base.protein_g, fat_g: base.fat_g, carbs_g: lowCarbs, calories: lowCalories },
  }
}
