import type { CycleSyncAdjustment } from '@/lib/nutrition/engine/cycleSync'
import {
  computePlanItemTotals,
  computePlanMealsTotals,
  type NutritionPlanItem,
  type NutritionPlanMeal,
  type NutritionPlanTotals,
} from '@/lib/nutrition/protocol-builder'

type MacroKey = 'protein' | 'carbs' | 'fat'

const CATEGORY_RULES: Array<{
  categories: Set<string>
  macro: MacroKey
  deltaKey: 'proteinDelta' | 'carbsDelta' | 'fatDelta'
}> = [
  { categories: new Set(['proteins']), macro: 'protein', deltaKey: 'proteinDelta' },
  { categories: new Set(['carbs', 'fruits']), macro: 'carbs', deltaKey: 'carbsDelta' },
  { categories: new Set(['fats']), macro: 'fat', deltaKey: 'fatDelta' },
]

export type CycleMealPlanAllocation = {
  meals: NutritionPlanMeal[]
  adjusted: boolean
  changedItemIds: string[]
  baseTotals: NutritionPlanTotals
  finalTotals: NutritionPlanTotals
  requestedDelta: Pick<NutritionPlanTotals, MacroKey>
  appliedDelta: Pick<NutritionPlanTotals, MacroKey>
  residualDelta: Pick<NutritionPlanTotals, MacroKey>
  warnings: string[]
}

function cloneMeals(meals: NutritionPlanMeal[]): NutritionPlanMeal[] {
  return meals.map((meal) => ({
    ...meal,
    items: meal.items.map((item) => ({
      ...item,
      alternatives: item.alternatives.map((alternative) => ({ ...alternative })),
    })),
  }))
}

function scaleQuantity(quantityG: number, factor: number) {
  if (quantityG <= 0) return quantityG
  return Math.max(1, Math.round(quantityG * factor))
}

function scaleItem(item: NutritionPlanItem, factor: number): NutritionPlanItem {
  return {
    ...item,
    quantity_g: scaleQuantity(item.quantity_g, factor),
    alternatives: item.alternatives.map((alternative) => ({
      ...alternative,
      quantity_g: scaleQuantity(alternative.quantity_g, factor),
    })),
  }
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function macroSnapshot(totals: NutritionPlanTotals): Pick<NutritionPlanTotals, MacroKey> {
  return {
    protein: round1(totals.protein),
    carbs: round1(totals.carbs),
    fat: round1(totals.fat),
  }
}

function quantityBounds(item: NutritionPlanItem) {
  const settings = item.cycle_adjustment
  const min = Math.max(1, Number(settings?.min_quantity_g ?? item.quantity_g * 0.5))
  const max = Math.max(min, Number(settings?.max_quantity_g ?? item.quantity_g * 1.5))
  return { min, max }
}

function allocateMacroDelta(args: {
  meals: NutritionPlanMeal[]
  categories: Set<string>
  macro: MacroKey
  delta: number
}) {
  const candidates = args.meals.flatMap((meal, mealIndex) => (
    meal.items.flatMap((item, itemIndex) => {
      if (
        !args.categories.has(String(item.food.category_l1 ?? '')) ||
        item.cycle_adjustment?.locked
      ) return []

      const macroPerGram = Number(computePlanItemTotals(item)[args.macro] ?? 0) / item.quantity_g
      if (macroPerGram <= 0) return []

      const bounds = quantityBounds(item)
      const availableQuantity = args.delta >= 0
        ? Math.max(0, bounds.max - item.quantity_g)
        : Math.max(0, item.quantity_g - bounds.min)
      const capacity = availableQuantity * macroPerGram
      if (capacity <= 0) return []

      return [{
        mealIndex,
        itemIndex,
        macroPerGram,
        capacity,
        weight: Number(item.cycle_adjustment?.priority ?? 1) * Number(computePlanItemTotals(item)[args.macro] ?? 0),
      }]
    })
  ))

  if (candidates.length === 0) return { meals: args.meals, changedItemIds: [], applied: 0 }

  let remaining = Math.abs(args.delta)
  const allocations = new Map<number, number>()
  const active = new Set(candidates.map((_, index) => index))

  while (remaining > 0.01 && active.size > 0) {
    const totalWeight = Array.from(active).reduce(
      (sum, index) => sum + Math.max(candidates[index].weight, 0.001),
      0,
    )
    let distributed = 0

    for (const index of Array.from(active)) {
      const candidate = candidates[index]
      const current = allocations.get(index) ?? 0
      const available = Math.max(0, candidate.capacity - current)
      const share = remaining * (Math.max(candidate.weight, 0.001) / totalWeight)
      const allocation = Math.min(share, available)
      if (allocation > 0) {
        allocations.set(index, current + allocation)
        distributed += allocation
      }
      if (allocation >= available - 0.01) active.delete(index)
    }

    if (distributed <= 0.01) break
    remaining -= distributed
  }

  const changedItemIds: string[] = []
  const meals = args.meals.map((meal, mealIndex) => ({
    ...meal,
    items: meal.items.map((item, itemIndex) => {
      const candidateIndex = candidates.findIndex((candidate) => (
        candidate.mealIndex === mealIndex && candidate.itemIndex === itemIndex
      ))
      if (candidateIndex < 0) return item

      const allocation = allocations.get(candidateIndex) ?? 0
      if (allocation <= 0) return item

      const candidate = candidates[candidateIndex]
      const { min, max } = quantityBounds(item)
      const direction = args.delta >= 0 ? 1 : -1
      const quantity = Math.min(max, Math.max(min, Math.round(item.quantity_g + direction * allocation / candidate.macroPerGram)))
      if (quantity === item.quantity_g) return item

      changedItemIds.push(item.id)
      const factor = quantity / item.quantity_g
      return {
        ...scaleItem(item, factor),
        quantity_g: quantity,
      }
    }),
  }))

  const applied = candidates.reduce((sum, candidate, index) => {
    const original = args.meals[candidate.mealIndex].items[candidate.itemIndex]
    const adjusted = meals[candidate.mealIndex].items[candidate.itemIndex]
    return sum + Number(computePlanItemTotals(adjusted)[args.macro] ?? 0) - Number(computePlanItemTotals(original)[args.macro] ?? 0)
  }, 0)

  return { meals, changedItemIds, applied: round1(applied) }
}

export function adjustPlanMealsForCycle(args: {
  meals: NutritionPlanMeal[]
  adjustment: Pick<CycleSyncAdjustment, 'proteinDelta' | 'carbsDelta' | 'fatDelta'>
}): CycleMealPlanAllocation {
  const baseTotals = computePlanMealsTotals(args.meals)
  let meals = cloneMeals(args.meals)
  const changedItemIds = new Set<string>()
  const warnings: string[] = []

  for (const rule of CATEGORY_RULES) {
    const delta = Number(args.adjustment[rule.deltaKey] ?? 0)
    if (!delta) continue

    const allocation = allocateMacroDelta({
      meals,
      categories: rule.categories,
      macro: rule.macro,
      delta,
    })
    meals = allocation.meals
    allocation.changedItemIds.forEach((id) => changedItemIds.add(id))
    if (Math.abs(delta - allocation.applied) > 1) {
      warnings.push(`Ajustement ${rule.macro} partiel : ${round1(allocation.applied)} g appliqués sur ${delta} g demandés.`)
    }
  }

  const finalTotals = computePlanMealsTotals(meals)
  const base = macroSnapshot(baseTotals)
  const final = macroSnapshot(finalTotals)
  const requestedDelta = {
    protein: Number(args.adjustment.proteinDelta ?? 0),
    carbs: Number(args.adjustment.carbsDelta ?? 0),
    fat: Number(args.adjustment.fatDelta ?? 0),
  }
  const appliedDelta = {
    protein: round1(final.protein - base.protein),
    carbs: round1(final.carbs - base.carbs),
    fat: round1(final.fat - base.fat),
  }
  const residualDelta = {
    protein: round1(requestedDelta.protein - appliedDelta.protein),
    carbs: round1(requestedDelta.carbs - appliedDelta.carbs),
    fat: round1(requestedDelta.fat - appliedDelta.fat),
  }

  return {
    meals,
    adjusted: changedItemIds.size > 0,
    changedItemIds: Array.from(changedItemIds),
    baseTotals,
    finalTotals,
    requestedDelta,
    appliedDelta,
    residualDelta,
    warnings,
  }
}
