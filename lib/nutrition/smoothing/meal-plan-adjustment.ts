import {
  computePlanItemTotals,
  computePlanMealsTotals,
  type NutritionPlanItem,
  type NutritionPlanMeal,
} from "@/lib/nutrition/protocol-builder"

const ADJUSTABLE_CATEGORIES = new Set(["carbs", "fats", "fruits", "extras"])

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function isAdjustableItem(item: NutritionPlanItem) {
  return ADJUSTABLE_CATEGORIES.has(String(item.food.category_l1 ?? ""))
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

export function adjustPlanMealsForSmoothing(args: {
  meals: NutritionPlanMeal[]
  baseTargetKcal: number
  adjustedTargetKcal: number
}) {
  const meals = args.meals.map((meal) => ({
    ...meal,
    items: meal.items.map((item) => ({
      ...item,
      alternatives: item.alternatives.map((alternative) => ({ ...alternative })),
    })),
  }))

  if (meals.length === 0 || args.baseTargetKcal <= 0 || args.adjustedTargetKcal <= 0) {
    return {
      meals,
      scalingRatio: 1,
      strategy: "none" as const,
    }
  }

  const targetRatio = args.adjustedTargetKcal / args.baseTargetKcal
  if (!Number.isFinite(targetRatio) || Math.abs(targetRatio - 1) < 0.001) {
    return {
      meals,
      scalingRatio: 1,
      strategy: "none" as const,
    }
  }

  const planTotals = computePlanMealsTotals(meals)
  if (planTotals.calories <= 0) {
    return {
      meals,
      scalingRatio: round1(targetRatio),
      strategy: "none" as const,
    }
  }

  const desiredPlanCalories = planTotals.calories * targetRatio
  let adjustableCalories = 0
  let fixedCalories = 0

  for (const meal of meals) {
    for (const item of meal.items) {
      const itemCalories = computePlanItemTotals(item).calories
      if (isAdjustableItem(item)) adjustableCalories += itemCalories
      else fixedCalories += itemCalories
    }
  }

  const canUseSelectiveScaling = adjustableCalories > 0
  const selectiveFactor = canUseSelectiveScaling
    ? Math.max(0, (desiredPlanCalories - fixedCalories) / adjustableCalories)
    : 1
  const uniformFactor = Math.max(0, desiredPlanCalories / planTotals.calories)

  const strategy = canUseSelectiveScaling ? "selective" as const : "uniform" as const
  const factor = strategy === "selective" ? selectiveFactor : uniformFactor

  const adjustedMeals = meals.map((meal) => ({
    ...meal,
    items: meal.items.map((item) => {
      if (strategy === "selective" && !isAdjustableItem(item)) return item
      return scaleItem(item, factor)
    }),
  }))

  const adjustedTotals = computePlanMealsTotals(adjustedMeals)
  return {
    meals: adjustedMeals,
    scalingRatio: planTotals.calories > 0
      ? round1(adjustedTotals.calories / planTotals.calories)
      : round1(targetRatio),
    strategy,
  }
}
