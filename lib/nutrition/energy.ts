export interface MacroEnergyInput {
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  alcohol_g?: number
}

export interface MacroEnergyBreakdown {
  protein_kcal: number
  carbs_kcal: number
  fat_kcal: number
  fiber_kcal: number
  alcohol_kcal: number
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function computeMacroEnergy(input: MacroEnergyInput): number {
  const breakdown = computeMacroEnergyBreakdown(input)
  return round1(
    breakdown.protein_kcal +
      breakdown.carbs_kcal +
      breakdown.fat_kcal +
      breakdown.fiber_kcal +
      breakdown.alcohol_kcal,
  )
}

export function computeMacroEnergyBreakdown(
  input: MacroEnergyInput,
): MacroEnergyBreakdown {
  return {
    protein_kcal: round1((input.protein_g || 0) * 4),
    carbs_kcal: round1((input.carbs_g || 0) * 4),
    fat_kcal: round1((input.fat_g || 0) * 9),
    fiber_kcal: round1((input.fiber_g || 0) * 0),
    alcohol_kcal: round1((input.alcohol_g || 0) * 7),
  }
}
