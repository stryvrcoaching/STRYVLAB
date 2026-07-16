import { calcEntryMacros, type FoodItem } from "@/lib/nutrition/food-items"
import { computeMacroEnergy } from "@/lib/nutrition/energy"
import type { PhotoMealAnalysisSummary } from "@/lib/nutrition/photo-log-types"

export function resolvePhotoMealBaselineWeight({
  analysis,
}: {
  analysis: PhotoMealAnalysisSummary
}) {
  const measuredWeight = analysis.scale_weight_g ?? analysis.manual_weight_g ?? null
  if (typeof measuredWeight === "number" && measuredWeight > 0) {
    return measuredWeight
  }

  const estimatedWeight = analysis.components.reduce(
    (sum, component) => sum + Math.max(0, Number(component.grams_estimate ?? 0)),
    0,
  )

  return estimatedWeight > 0 ? estimatedWeight : null
}

export function computeLeftoversConsumedFactor({
  baselineWeightG,
  leftoversWeightG,
}: {
  baselineWeightG: number
  leftoversWeightG: number
}) {
  const safeBaseline = Math.max(0, baselineWeightG)
  const safeLeftovers = Math.max(0, leftoversWeightG)
  if (safeBaseline <= 0) return 1
  if (safeLeftovers >= safeBaseline) return 0
  return Math.max(0, Math.min(1, (safeBaseline - safeLeftovers) / safeBaseline))
}

type EntryWithFood = {
  id: string
  quantity_g: number
  food_item_id: string
  food_items: FoodItem | null
}

export function buildRefinedPhotoEntries({
  entries,
  consumedFactor,
}: {
  entries: EntryWithFood[]
  consumedFactor: number
}) {
  return entries.map((entry) => {
    const quantityG = Math.round(Math.max(0, entry.quantity_g * consumedFactor))
    const food = entry.food_items
    if (!food) {
      throw new Error(`Missing food item for entry ${entry.id}`)
    }
    const macros = calcEntryMacros(food, quantityG)
    return {
      id: entry.id,
      quantity_g: quantityG,
      ...macros,
    }
  })
}

export function computeRefinedMealTotals(
  entries: Array<{
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g: number
  }>,
) {
  const totals = entries.reduce(
    (acc, entry) => ({
      total_protein_g: Math.round((acc.total_protein_g + entry.protein_g) * 10) / 10,
      total_carbs_g: Math.round((acc.total_carbs_g + entry.carbs_g) * 10) / 10,
      total_fat_g: Math.round((acc.total_fat_g + entry.fat_g) * 10) / 10,
      total_fiber_g: Math.round((acc.total_fiber_g + entry.fiber_g) * 10) / 10,
    }),
    { total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0, total_fiber_g: 0 },
  )

  return {
    ...totals,
    total_calories: computeMacroEnergy({
      protein_g: totals.total_protein_g,
      carbs_g: totals.total_carbs_g,
      fat_g: totals.total_fat_g,
      fiber_g: totals.total_fiber_g,
    }),
  }
}
