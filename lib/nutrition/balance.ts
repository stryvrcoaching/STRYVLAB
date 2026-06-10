export interface NutritionBalanceMacros {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  water_ml: number
}

export interface NutritionBalanceResult {
  remaining: NutritionBalanceMacros
  overflow: NutritionBalanceMacros
  remainingCaloriesNet: number
  remainingCaloriesFromMacros: number
  statusByMacro: {
    kcal: 'under' | 'met' | 'over'
    protein_g: 'under' | 'met' | 'over'
    carbs_g: 'under' | 'met' | 'over'
    fat_g: 'under' | 'met' | 'over'
    water_ml: 'under' | 'met' | 'over'
  }
}

function diff(target: number, consumed: number) {
  const delta = target - consumed
  return {
    remaining: Math.max(0, delta),
    overflow: Math.max(0, -delta),
    status: delta > 0 ? 'under' : delta < 0 ? 'over' : 'met',
  } as const
}

function computeRemainingMacroBudget(
  consumed: NutritionBalanceMacros,
  target: NutritionBalanceMacros,
) {
  const remainingCaloriesNet = Math.max(0, target.kcal - consumed.kcal)
  const remainingProteinNeeded = Math.max(0, target.protein_g - consumed.protein_g)
  const remainingProteinKcal = remainingProteinNeeded * 4

  if (remainingCaloriesNet <= 0) {
    return {
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    }
  }

  if (remainingProteinKcal >= remainingCaloriesNet) {
    return {
      protein_g: remainingCaloriesNet / 4,
      carbs_g: 0,
      fat_g: 0,
    }
  }

  return {
    protein_g: remainingProteinNeeded,
    carbs_g: (remainingCaloriesNet - remainingProteinKcal) / 4,
    fat_g: 0,
  }
}

export function computeNutritionBalance(
  consumed: NutritionBalanceMacros,
  target: NutritionBalanceMacros,
): NutritionBalanceResult {
  const kcal = diff(target.kcal, consumed.kcal)
  const protein = diff(target.protein_g, consumed.protein_g)
  const carbs = diff(target.carbs_g, consumed.carbs_g)
  const fat = diff(target.fat_g, consumed.fat_g)
  const water = diff(target.water_ml, consumed.water_ml)
  const remaining = computeRemainingMacroBudget(consumed, target)
  const remainingCaloriesFromMacros =
    remaining.protein_g * 4 + remaining.carbs_g * 4 + remaining.fat_g * 9

  return {
    remaining: {
      kcal: kcal.remaining,
      protein_g: remaining.protein_g,
      carbs_g: remaining.carbs_g,
      fat_g: remaining.fat_g,
      water_ml: water.remaining,
    },
    overflow: {
      kcal: kcal.overflow,
      protein_g: protein.overflow,
      carbs_g: carbs.overflow,
      fat_g: fat.overflow,
      water_ml: water.overflow,
    },
    remainingCaloriesNet: kcal.remaining,
    remainingCaloriesFromMacros,
    statusByMacro: {
      kcal: kcal.status,
      protein_g: protein.status,
      carbs_g: carbs.status,
      fat_g: fat.status,
      water_ml: water.status,
    },
  }
}
