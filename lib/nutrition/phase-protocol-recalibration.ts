import { adjustPlanMealsForCycle } from '@/lib/nutrition/cycle-meal-plan-adjustment'
import type { DayDraft } from '@/lib/nutrition/types'

export type ProtocolMacroTarget = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type PhaseProtocolPreview = {
  days: DayDraft[]
  changedDays: number
  changedMealPlans: number
  warnings: string[]
}

function numberValue(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function ratio(next: number, previous: number) {
  return previous > 0 ? next / previous : 1
}

export function buildPhaseProtocolPreview(args: {
  days: DayDraft[]
  previousTarget: ProtocolMacroTarget
  nextTarget: ProtocolMacroTarget
}): PhaseProtocolPreview {
  const proteinRatio = ratio(args.nextTarget.protein, args.previousTarget.protein)
  const carbsRatio = ratio(args.nextTarget.carbs, args.previousTarget.carbs)
  const fatRatio = ratio(args.nextTarget.fat, args.previousTarget.fat)
  const warnings: string[] = []
  let changedDays = 0
  let changedMealPlans = 0

  const days = args.days.map((day) => {
    const previous = {
      protein: numberValue(day.protein_g),
      carbs: numberValue(day.carbs_g),
      fat: numberValue(day.fat_g),
    }
    if (!previous.protein && !previous.carbs && !previous.fat) return day

    const next = {
      protein: Math.max(0, Math.round(previous.protein * proteinRatio)),
      carbs: Math.max(0, Math.round(previous.carbs * carbsRatio)),
      fat: Math.max(0, Math.round(previous.fat * fatRatio)),
    }
    const calories = next.protein * 4 + next.carbs * 4 + next.fat * 9
    const mealAdjustment = day.meal_plan.length > 0
      ? adjustPlanMealsForCycle({
          meals: day.meal_plan,
          adjustment: {
            proteinDelta: next.protein - previous.protein,
            carbsDelta: next.carbs - previous.carbs,
            fatDelta: next.fat - previous.fat,
          },
        })
      : null

    changedDays += 1
    if (mealAdjustment?.adjusted) changedMealPlans += 1
    if (mealAdjustment?.warnings.length) warnings.push(`${day.name} : ${mealAdjustment.warnings[0]}`)

    return {
      ...day,
      calories: String(calories),
      protein_g: String(next.protein),
      carbs_g: String(next.carbs),
      fat_g: String(next.fat),
      meal_plan: mealAdjustment?.meals ?? day.meal_plan,
    }
  })

  return { days, changedDays, changedMealPlans, warnings }
}
