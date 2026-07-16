import { adjustPlanMealsForCycle } from '@/lib/nutrition/cycle-meal-plan-adjustment'
import type { DayDraft } from '@/lib/nutrition/types'
import type { NutritionPlanMeal } from '@/lib/nutrition/protocol-builder'

export type MealPlanDuplicationMode = 'adapt_to_target' | 'exact_copy'

export type MealPlanDuplicationTarget = {
  dayIndex: number
  day: DayDraft
}

export type MealPlanDuplicationResult = {
  dayIndex: number
  mealPlan: NutritionPlanMeal[]
  adjusted: boolean
  warnings: string[]
}

function valueOf(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function cloneMeals(meals: NutritionPlanMeal[]): NutritionPlanMeal[] {
  return meals.map((meal) => ({
    ...meal,
    items: meal.items.map((item) => ({
      ...item,
      alternatives: item.alternatives.map((alternative) => ({ ...alternative })),
      cycle_adjustment: item.cycle_adjustment
        ? { ...item.cycle_adjustment }
        : undefined,
    })),
  }))
}

export function duplicateMealPlanToDays(args: {
  sourceDay: DayDraft
  targets: MealPlanDuplicationTarget[]
  mode: MealPlanDuplicationMode
}): MealPlanDuplicationResult[] {
  const sourceMeals = cloneMeals(args.sourceDay.meal_plan)
  const sourceMacros = {
    protein: valueOf(args.sourceDay.protein_g),
    carbs: valueOf(args.sourceDay.carbs_g),
    fat: valueOf(args.sourceDay.fat_g),
  }

  return args.targets.map(({ dayIndex, day }) => {
    const mealPlan = cloneMeals(sourceMeals)
    if (args.mode === 'exact_copy') {
      return { dayIndex, mealPlan, adjusted: false, warnings: [] }
    }

    const targetMacros = {
      protein: valueOf(day.protein_g),
      carbs: valueOf(day.carbs_g),
      fat: valueOf(day.fat_g),
    }
    const adjustment = adjustPlanMealsForCycle({
      meals: mealPlan,
      adjustment: {
        proteinDelta: targetMacros.protein - sourceMacros.protein,
        carbsDelta: targetMacros.carbs - sourceMacros.carbs,
        fatDelta: targetMacros.fat - sourceMacros.fat,
      },
    })

    return {
      dayIndex,
      mealPlan: adjustment.meals,
      adjusted: adjustment.adjusted,
      warnings: adjustment.warnings,
    }
  })
}
