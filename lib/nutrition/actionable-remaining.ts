import type { NutritionMacros } from '@/components/client/smart/SmartNutritionWidget'
import { getRemainingNutritionTargets, type RemainingNutritionTargets } from './remaining-targets'

type GenderLike = string | null | undefined

export interface ActionableRemainingProfile {
  gender?: GenderLike
  weightKg?: number | null
}

export interface ActionableCompensationTrace {
  overflowSource: Array<'protein' | 'carbs' | 'fat'>
  overflowKcal: number
  carbsReducedG: number
  fatReducedG: number
  proteinReducedG: number
  fatFloorProtected: boolean
}

export interface ActionableRemainingResult {
  informativeRemaining: RemainingNutritionTargets
  actionableRemaining: RemainingNutritionTargets
  overflow: {
    protein_g: number
    carbs_g: number
    fat_g: number
  }
  fatFloorG: number
  minActionableFatG: number
  compensation: ActionableCompensationTrace
  isExtremeCase: boolean
}

type MacroState = {
  protein: number
  carbs: number
  fat: number
}

export function computeActionableRemaining({
  target,
  consumed,
  profile,
}: {
  target: Pick<NutritionMacros, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>
  consumed: Pick<NutritionMacros, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>
  profile?: ActionableRemainingProfile
}): ActionableRemainingResult {
  const informativeRemaining = getRemainingNutritionTargets({
    dailyTargets: target,
    consumedToday: consumed,
  })

  const overflow = {
    protein_g: Math.max(0, -informativeRemaining.protein),
    carbs_g: Math.max(0, -informativeRemaining.carbs),
    fat_g: Math.max(0, -informativeRemaining.fat),
  }

  const actionable: MacroState = {
    protein: Math.max(0, informativeRemaining.protein),
    carbs: Math.max(0, informativeRemaining.carbs),
    fat: Math.max(0, informativeRemaining.fat),
  }

  // Cap fat floor at 85% of target so a low-fat protocol is never fully overridden
  const rawFatFloorG = getFatFloorGrams(profile?.gender, profile?.weightKg)
  const fatFloorG = target.fat_g > 0 ? Math.min(rawFatFloorG, round1(target.fat_g * 0.85)) : rawFatFloorG
  const minActionableFatG = Math.max(0, round1(fatFloorG - consumed.fat_g))
  const maxReducibleFatG = Math.max(0, round1(actionable.fat - minActionableFatG))

  const overflowKcal = round1(
    overflow.protein_g * 4 +
    overflow.carbs_g * 4 +
    overflow.fat_g * 9,
  )

  let remainingOverflowKcal = overflowKcal

  const carbsReducedG = Math.min(actionable.carbs, round1(remainingOverflowKcal / 4))
  actionable.carbs = round1(actionable.carbs - carbsReducedG)
  remainingOverflowKcal = round1(Math.max(0, remainingOverflowKcal - carbsReducedG * 4))

  const fatReducedG = Math.min(maxReducibleFatG, round1(remainingOverflowKcal / 9))
  actionable.fat = round1(actionable.fat - fatReducedG)
  remainingOverflowKcal = round1(Math.max(0, remainingOverflowKcal - fatReducedG * 9))

  const proteinReducedG = Math.min(actionable.protein, round1(remainingOverflowKcal / 4))
  actionable.protein = round1(actionable.protein - proteinReducedG)
  remainingOverflowKcal = round1(Math.max(0, remainingOverflowKcal - proteinReducedG * 4))

  const actionableRemaining: RemainingNutritionTargets = {
    calories: round1(actionable.protein * 4 + actionable.carbs * 4 + actionable.fat * 9),
    protein: actionable.protein,
    carbs: actionable.carbs,
    fat: actionable.fat,
  }

  const overflowSource: Array<'protein' | 'carbs' | 'fat'> = []
  if (overflow.protein_g > 0) overflowSource.push('protein')
  if (overflow.carbs_g > 0) overflowSource.push('carbs')
  if (overflow.fat_g > 0) overflowSource.push('fat')

  return {
    informativeRemaining,
    actionableRemaining,
    overflow,
    fatFloorG,
    minActionableFatG,
    compensation: {
      overflowSource,
      overflowKcal,
      carbsReducedG,
      fatReducedG,
      proteinReducedG,
      fatFloorProtected: fatReducedG < round1(overflowKcal / 9) || minActionableFatG > 0,
    },
    isExtremeCase: proteinReducedG > 0 || remainingOverflowKcal > 0.1,
  }
}

function getFatFloorGrams(gender: GenderLike, weightKg?: number | null): number {
  if (!weightKg || weightKg <= 0) return 0
  const ratio = gender === 'female' ? 0.7 : 0.6
  return round1(weightKg * ratio)
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
