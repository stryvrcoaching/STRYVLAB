type NutritionShape = {
  kcal_per_100g?: number | null
  protein_per_100g?: number | null
  carbs_per_100g?: number | null
  fat_per_100g?: number | null
  fiber_per_100g?: number | null
}

function safeNumber(value: number | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function computeMacroDerivedKcalPer100g(nutrition: NutritionShape) {
  const protein = safeNumber(nutrition.protein_per_100g)
  const carbs = safeNumber(nutrition.carbs_per_100g)
  const fat = safeNumber(nutrition.fat_per_100g)
  const fiber = safeNumber(nutrition.fiber_per_100g)

  return protein * 4 + carbs * 4 + fat * 9 + fiber * 2
}

export function hasMeaningfulMacros(nutrition: NutritionShape) {
  return (
    safeNumber(nutrition.protein_per_100g) > 0 ||
    safeNumber(nutrition.carbs_per_100g) > 0 ||
    safeNumber(nutrition.fat_per_100g) > 0 ||
    safeNumber(nutrition.fiber_per_100g) > 0
  )
}

export function isMacroEnergyIncoherent(
  nutrition: NutritionShape,
  options?: {
    lowRatio?: number
    highRatio?: number
    absoluteToleranceKcal?: number
  },
) {
  const kcal = safeNumber(nutrition.kcal_per_100g)
  const derived = computeMacroDerivedKcalPer100g(nutrition)
  if (kcal <= 0 || derived <= 0) return false

  const lowRatio = options?.lowRatio ?? 0.78
  const highRatio = options?.highRatio ?? 1.22
  const absoluteToleranceKcal = options?.absoluteToleranceKcal ?? 30

  if (Math.abs(kcal - derived) <= absoluteToleranceKcal) return false
  if (kcal < derived * lowRatio) return true
  if (kcal > derived * highRatio) return true
  return false
}
