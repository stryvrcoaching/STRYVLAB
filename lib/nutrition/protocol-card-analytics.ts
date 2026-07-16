import {
  buildNutritionHubSummary,
  computeNutritionDeltaPct,
  type NutritionHubCompleteness,
  type NutritionHubDayInput,
  type NutritionHubDayKind,
} from '@/lib/coach/nutritionHub'
import { addDaysToDateKey } from '@/lib/client/checkin/timeWindows'
import { computeMacroEnergy } from '@/lib/nutrition/energy'
import { resolveProtocolDayByDate } from '@/lib/nutrition/protocol-schedule'
import { applySmoothingOverlay } from '@/lib/nutrition/smoothing/apply-overlay'
import type { NutritionSmoothingPlanDay } from '@/lib/nutrition/smoothing/types'

export type NutritionProtocolCardDay = {
  position: number
  name?: string | null
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  hydration_ml?: number | null
  carb_cycle_type?: string | null
}

export type NutritionProtocolCardSlot = {
  week_index: number
  dow: number
  protocol_day_position: number
}

export type NutritionProtocolCardAnalytics = {
  days_count: number
  avg_kcal_delta: number | null
  nutrition_score: number | null
  avg_daily_kcal_variation: number | null
  reliability_label: 'Fiables' | 'Partielles' | 'Faibles'
  analyzed_days_count: number
  kcal_delta_trend: number[]
  kcal_variation_trend: number[]
}

export type NutritionProtocolPlanAnalytics = {
  days_count: number
  avg_target_kcal: number | null
  kcal_amplitude: number | null
  training_days_count: number
  rest_days_count: number
  hydration_target_avg_ml: number | null
  structure_score: number | null
  warnings: string[]
}

export type NutritionProtocolTrackingAnalytics = NutritionProtocolCardAnalytics & {
  window_label: string
  complete_days_count: number
  partial_days_count: number
  state_label: 'En attente' | 'Précoce' | 'Partiel' | 'Fiable'
}

type AggregatedMeal = {
  mealCount: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

type DailyNutritionInput = {
  date: string
  consumed: AggregatedMeal
  hydration_ml: number
}

function inferTrainingDay(protocolDay: NutritionProtocolCardDay | null): boolean {
  if (!protocolDay) return false
  const name = String(protocolDay.name ?? '').toLowerCase()
  const cycle = String(protocolDay.carb_cycle_type ?? '').toLowerCase()
  return (
    name.includes('entraînement') ||
    name.includes('entrainement') ||
    name.includes('training') ||
    cycle.includes('high')
  )
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function average(values: number[]) {
  if (values.length === 0) return null
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function buildTrailingDateKeys(startDate: string, endDate: string) {
  const keys: string[] = []
  let cursor = endDate
  while (cursor >= startDate) {
    keys.unshift(cursor)
    cursor = addDaysToDateKey(cursor, -1)
  }
  return keys
}

function reliabilityLabel(input: {
  validDays: number
  partialDays: number
  analyzedDaysCount: number
}) {
  if (input.analyzedDaysCount <= 1 || input.validDays <= 1) return 'Faibles' as const
  const partialRatio = input.analyzedDaysCount > 0 ? input.partialDays / input.analyzedDaysCount : 1
  if (partialRatio >= 0.45) return 'Faibles' as const
  if (partialRatio >= 0.2 || input.partialDays > 0) return 'Partielles' as const
  return 'Fiables' as const
}

function trackingStateLabel(input: {
  analyzedDaysCount: number
  validDays: number
  partialDays: number
}) {
  if (input.analyzedDaysCount === 0) return 'En attente' as const
  if (input.analyzedDaysCount < 3) return 'Précoce' as const
  const completeRatio = input.analyzedDaysCount > 0 ? input.validDays / input.analyzedDaysCount : 0
  if (completeRatio < 0.6 || input.partialDays > input.validDays) return 'Partiel' as const
  return 'Fiable' as const
}

export function buildNutritionProtocolPlanAnalytics(input: {
  protocol: {
    days?: NutritionProtocolCardDay[]
  }
}): NutritionProtocolPlanAnalytics {
  const days = (input.protocol.days ?? []).slice().sort((a, b) => a.position - b.position)
  const calories = days
    .map((day) => Number(day.calories))
    .filter((value) => Number.isFinite(value))
  const hydrationTargets = days
    .map((day) => Number(day.hydration_ml))
    .filter((value) => Number.isFinite(value))
  const trainingDays = days.filter((day) => inferTrainingDay(day)).length
  const restDays = days.filter((day) => !inferTrainingDay(day)).length
  const warnings: string[] = []

  if (trainingDays === 0) warnings.push('Aucun jour entraînement')
  if (restDays === 0) warnings.push('Aucun jour repos')
  if (calories.length < days.length) warnings.push('Calories incomplètes')
  if (hydrationTargets.length < days.length) warnings.push('Hydratation incomplète')

  const avgTargetKcal = average(calories)
  const kcalAmplitude =
    calories.length > 0
      ? Math.max(...calories) - Math.min(...calories)
      : null
  if (kcalAmplitude != null && kcalAmplitude < 150 && days.length > 1) warnings.push('Amplitude calorique faible')

  const scoreBase =
    (days.length > 0 ? 40 : 0) +
    Math.round((calories.length / Math.max(days.length, 1)) * 25) +
    Math.round((hydrationTargets.length / Math.max(days.length, 1)) * 15) +
    (trainingDays > 0 ? 10 : 0) +
    (restDays > 0 ? 10 : 0)

  return {
    days_count: days.length,
    avg_target_kcal: avgTargetKcal,
    kcal_amplitude: kcalAmplitude != null ? round1(kcalAmplitude) : null,
    training_days_count: trainingDays,
    rest_days_count: restDays,
    hydration_target_avg_ml: average(hydrationTargets),
    structure_score: days.length > 0 ? clamp(scoreBase, 0, 100) : null,
    warnings,
  }
}

export function aggregateMealsByDate(
  meals: Array<{
    physiological_date: string | null
    total_protein_g?: number | null
    total_carbs_g?: number | null
    total_fat_g?: number | null
    total_fiber_g?: number | null
  }>,
) {
  const mealsByDate = new Map<string, AggregatedMeal>()

  for (const meal of meals) {
    const key = String(meal.physiological_date ?? '').trim()
    if (!key) continue

    const current = mealsByDate.get(key) ?? {
      mealCount: 0,
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    }

    current.mealCount += 1
    current.protein_g += Number(meal.total_protein_g ?? 0)
    current.carbs_g += Number(meal.total_carbs_g ?? 0)
    current.fat_g += Number(meal.total_fat_g ?? 0)
    current.calories += computeMacroEnergy({
      protein_g: Number(meal.total_protein_g ?? 0),
      carbs_g: Number(meal.total_carbs_g ?? 0),
      fat_g: Number(meal.total_fat_g ?? 0),
      fiber_g: Number(meal.total_fiber_g ?? 0),
    })

    mealsByDate.set(key, current)
  }

  return mealsByDate
}

export function buildNutritionProtocolCardAnalytics(input: {
  dateKeys: string[]
  referenceDateKey?: string
  protocol: {
    schedule_start_date?: string | null
    days?: NutritionProtocolCardDay[]
    schedule_slots?: NutritionProtocolCardSlot[]
  }
  smoothingDaysByDate?: Map<string, NutritionSmoothingPlanDay>
  mealsByDate: Map<string, AggregatedMeal>
  waterByDate: Map<string, number>
}): NutritionProtocolTrackingAnalytics {
  const days = (input.protocol.days ?? []).slice().sort((a, b) => a.position - b.position)
  const slots = input.protocol.schedule_slots ?? []
  const fallbackDateKeys =
    input.dateKeys.length > 0 || !input.referenceDateKey
      ? []
      : buildTrailingDateKeys(
          input.protocol.schedule_start_date ?? input.referenceDateKey,
          input.referenceDateKey,
        )
  const resolvedDateKeys = input.dateKeys.length > 0 ? input.dateKeys : fallbackDateKeys
  const dailyInputs: NutritionHubDayInput[] = []
  const dailyDeltas: number[] = []
  const dailyConsumedCalories: number[] = []
  const usedDateKeys: string[] = []
  let partialDays = 0
  let validDays = 0

  for (const dateKey of resolvedDateKeys) {
    const protocolDay = resolveProtocolDayByDate(
      dateKey,
      input.protocol.schedule_start_date ?? null,
      days,
      slots,
    )

    const consumed = input.mealsByDate.get(dateKey) ?? {
      mealCount: 0,
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    }
    const hydration_ml = input.waterByDate.get(dateKey) ?? 0
    const completeness: NutritionHubCompleteness =
      consumed.mealCount === 0 && hydration_ml === 0
        ? 'missing'
        : consumed.mealCount === 0 || hydration_ml === 0
          ? 'partial'
          : 'complete'

    if (completeness === 'partial') partialDays += 1
    if (completeness === 'complete') validDays += 1

    let target = {
      calories: protocolDay?.calories != null ? Number(protocolDay.calories) : null,
      protein_g: protocolDay?.protein_g != null ? Number(protocolDay.protein_g) : null,
      carbs_g: protocolDay?.carbs_g != null ? Number(protocolDay.carbs_g) : null,
      fat_g: protocolDay?.fat_g != null ? Number(protocolDay.fat_g) : null,
      hydration_ml: protocolDay?.hydration_ml != null ? Number(protocolDay.hydration_ml) : null,
    }

    const smoothingDay = input.smoothingDaysByDate?.get(dateKey)
    if (smoothingDay && target.calories != null) {
      const overlay = applySmoothingOverlay({
        kcal: target.calories,
        protein_g: target.protein_g ?? 0,
        carbs_g: target.carbs_g ?? 0,
        fat_g: target.fat_g ?? 0,
        water_ml: target.hydration_ml ?? 0,
      }, [smoothingDay])
      target = {
        calories: overlay.target.kcal,
        protein_g: overlay.target.protein_g,
        carbs_g: overlay.target.carbs_g,
        fat_g: overlay.target.fat_g,
        hydration_ml: overlay.target.water_ml,
      }
    }

    dailyInputs.push({
      dayKind: inferTrainingDay(protocolDay) ? 'training' : protocolDay ? 'off' : 'unknown',
      completeness,
      consumed: {
        calories: consumed.calories,
        protein_g: consumed.protein_g,
        carbs_g: consumed.carbs_g,
        fat_g: consumed.fat_g,
        hydration_ml,
      },
      target,
    })

    if (completeness !== 'missing') {
      usedDateKeys.push(dateKey)
      dailyConsumedCalories.push(Math.round(consumed.calories))
      if (target.calories != null) {
        dailyDeltas.push(Math.round(consumed.calories - target.calories))
      }
    }
  }

  const summary = buildNutritionHubSummary(dailyInputs)
  const kcalVariationTrend: number[] = []
  for (let index = 1; index < dailyConsumedCalories.length; index += 1) {
    kcalVariationTrend.push(Math.abs(dailyConsumedCalories[index] - dailyConsumedCalories[index - 1]))
  }

  const deltaForAverage = dailyDeltas.filter((value) => Number.isFinite(value))
  const avgKcalDelta = average(deltaForAverage)
  const avgDailyVariation = average(kcalVariationTrend)
  const analyzedDaysCount = usedDateKeys.length
  const stateLabel = trackingStateLabel({
    analyzedDaysCount,
    validDays,
    partialDays,
  })

  return {
    days_count: days.length,
    avg_kcal_delta: avgKcalDelta,
    nutrition_score:
      summary.nutritionScore != null ? Math.round(summary.nutritionScore * 100) : null,
    avg_daily_kcal_variation: avgDailyVariation,
    reliability_label: reliabilityLabel({
      validDays,
      partialDays,
      analyzedDaysCount,
    }),
    analyzed_days_count: analyzedDaysCount,
    complete_days_count: validDays,
    partial_days_count: partialDays,
    state_label: stateLabel,
    window_label: analyzedDaysCount === 0 ? 'En attente de données client' : `Depuis activation : ${analyzedDaysCount} jour${analyzedDaysCount > 1 ? 's' : ''}`,
    kcal_delta_trend: dailyDeltas,
    kcal_variation_trend: kcalVariationTrend,
  }
}
