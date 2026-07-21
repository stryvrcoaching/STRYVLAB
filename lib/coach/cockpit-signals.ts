/**
 * Shared gauge computation for the Client Cockpit.
 * Pure: raw API payloads → states + direction inputs.
 */

import { calculateMacros } from '@/lib/formulas/macros'
import {
  buildActivityBudget,
  estimateSessionsPerWeekFromPerformance,
  type ActivityBudget,
} from '@/lib/coach/cockpit-activity'
import {
  buildCockpitDirections,
  type CockpitDirection,
  type CockpitDirectionsInput,
  type GaugeState,
} from '@/lib/coach/cockpit-directions'
import type { CycleState } from '@/lib/cycle/cycleEngine'

export type CockpitRawData = {
  client: {
    first_name?: string
    last_name?: string
    step_target?: number | null
    training_goal?: string | null
  }
  nutrition: any | null
  nutritionData: any | null
  checkin: any | null
  performance: any | null
  cycleState: CycleState | null
}

export type CockpitDrafts = {
  nutrition?: { tdee?: number | null; calories?: number | null } | null
  workout?: {
    strengthFrequency?: number | null
    weeklyFrequency?: number | null
    cardioFrequency?: number | null
    cardioDurationMin?: number | null
    cardioTypes?: string[]
    cardioRpe?: number | null
    sessionDurationMin?: number | null
    trainingTypes?: string[]
    trainingRir?: number | null
    setsWeekly?: number | null
  } | null
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value))
}

function inferGoal(value: string | null | undefined): 'deficit' | 'maintenance' | 'surplus' {
  if (value === 'fat_loss') return 'deficit'
  if (value === 'hypertrophy' || value === 'strength') return 'surplus'
  return 'maintenance'
}

function buildFormulaInput(
  raw: any,
  overrides?: {
    steps?: number | null
    workouts?: number | null
    cardioFrequency?: number | null
    cardioDurationMin?: number | null
    cardioTypes?: string[]
    cardioRpe?: number | null
    sessionDurationMin?: number | null
    trainingTypes?: string[]
    trainingRir?: number | null
  },
) {
  const client = raw?.client
  if (!client?.weight_kg || !client?.height_cm || !client?.age || !client?.gender) return null
  const gender =
    client.gender === 'female' ? 'female' : client.gender === 'male' ? 'male' : null
  if (!gender) return null

  return {
    weight: Number(client.weight_kg),
    height: Number(client.height_cm),
    age: Number(client.age),
    gender,
    goal: inferGoal(client.training_goal),
    bodyFat: client.body_fat_pct ?? undefined,
    muscleMassKg: client.muscle_mass_kg ?? undefined,
    bmrKcalMeasured: client.bmr_kcal_measured ?? undefined,
    steps: Math.max(0, Number(overrides?.steps ?? client.daily_steps ?? 0)),
    occupationMultiplier: client.occupation_multiplier ?? undefined,
    workHoursPerWeek: client.work_hours_per_week ?? undefined,
    workouts: Math.max(0, Number(overrides?.workouts ?? client.weekly_frequency ?? 0)),
    sessionDurationMin: overrides?.sessionDurationMin ?? client.session_duration_min ?? undefined,
    trainingCaloriesWeekly:
      overrides?.sessionDurationMin != null
        ? undefined
        : (client.training_calories_weekly ?? undefined),
    trainingTypes: overrides?.trainingTypes ?? undefined,
    trainingRir: overrides?.trainingRir ?? undefined,
    cardioFrequency: Math.max(
      0,
      Number(overrides?.cardioFrequency ?? client.cardio_frequency ?? 0),
    ),
    cardioDurationMin: overrides?.cardioDurationMin ?? client.cardio_duration_min ?? undefined,
    cardioTypes: overrides?.cardioTypes ?? undefined,
    cardioRpe: overrides?.cardioRpe ?? undefined,
    sleepDurationH: client.sleep_duration_h ?? undefined,
    stressLevel: client.stress_level ?? undefined,
    energyLevel: client.energy_level ?? undefined,
    caffeineDaily: client.caffeine_daily_mg ?? undefined,
    alcoholWeekly: client.alcohol_weekly ?? undefined,
  } as const
}

export type CockpitSignals = {
  energyState: GaugeState
  adherenceState: GaugeState
  activityState: GaugeState
  recoveryState: GaugeState
  cockpitState: GaugeState
  energyReality: number | null
  energyPrescription: number | null
  energyDifference: number | null
  adherence: number | null
  activityRatio: number | null
  actualSteps: number | null
  plannedSteps: number | null
  /** Full NEAT+EAT budget for UI */
  activityBudget: ActivityBudget
  recovery: number | null
  overreaching: boolean | null
  hasLiveDraft: boolean
  directionsInput: CockpitDirectionsInput
  directions: CockpitDirection[]
}

export function computeCockpitSignals(
  clientId: string,
  data: CockpitRawData,
  drafts: CockpitDrafts = {},
): CockpitSignals {
  const nutritionDraft = drafts.nutrition ?? null
  const workoutDraft = drafts.workout ?? null

  const baseInput = buildFormulaInput(data.nutritionData)
  const baseFormula = baseInput ? calculateMacros(baseInput) : null

  const plannedSteps =
    data.client.step_target != null ? Number(data.client.step_target) : null
  const plannedTraining = data.nutritionData?.plannedTraining ?? {}
  const coachInput = buildFormulaInput(data.nutritionData, {
    steps: plannedSteps,
    workouts:
      workoutDraft?.strengthFrequency ??
      plannedTraining.strengthFrequency ??
      workoutDraft?.weeklyFrequency ??
      plannedTraining.weeklyFrequency,
    cardioFrequency: workoutDraft?.cardioFrequency ?? plannedTraining.cardioFrequency,
    cardioDurationMin: workoutDraft?.cardioDurationMin ?? plannedTraining.cardioDurationMin,
    cardioTypes: workoutDraft?.cardioTypes ?? plannedTraining.cardioTypes,
    cardioRpe: workoutDraft?.cardioRpe ?? plannedTraining.cardioRpe,
    sessionDurationMin: workoutDraft?.sessionDurationMin ?? plannedTraining.sessionDurationMin,
    trainingTypes: workoutDraft?.trainingTypes ?? plannedTraining.trainingTypes,
    trainingRir: workoutDraft?.trainingRir ?? plannedTraining.trainingRir,
  })
  const coachFormula = coachInput ? calculateMacros(coachInput) : null

  const averages = data.checkin?.field_averages ?? {}
  const summary = data.nutrition?.summary ?? {}
  const energy = data.nutrition?.energy ?? {}
  const adaptiveTdee = energy.clientTdee != null ? Number(energy.clientTdee) : null
  const currentTdee = adaptiveTdee ?? baseFormula?.tdee ?? null
  const draftTdee = nutritionDraft?.tdee != null ? Number(nutritionDraft.tdee) : null
  const plannedFormulaDelta =
    coachFormula && baseFormula ? coachFormula.tdee - baseFormula.tdee : 0
  const coachTdee =
    draftTdee ??
    (currentTdee != null
      ? currentTdee + plannedFormulaDelta
      : (coachFormula?.tdee ?? null))

  const targetCalories = data.nutrition?.trend?.points?.length
    ? Math.round(
        data.nutrition.trend.points.reduce(
          (sum: number, point: any) => sum + Number(point.target?.calories ?? 0),
          0,
        ) / data.nutrition.trend.points.length,
      )
    : null
  const actualCalories = data.nutrition?.trend?.points?.length
    ? Math.round(
        data.nutrition.trend.points.reduce(
          (sum: number, point: any) => sum + Number(point.consumed?.calories ?? 0),
          0,
        ) / data.nutrition.trend.points.length,
      )
    : null
  const draftCalories =
    nutritionDraft?.calories != null ? Number(nutritionDraft.calories) : null
  const coachTargetCalories = draftCalories ?? targetCalories

  const actualSteps =
    averages.daily_steps != null
      ? Number(averages.daily_steps)
      : data.nutritionData?.client?.daily_steps != null
        ? Number(data.nutritionData.client.daily_steps)
        : null

  const weightKg =
    data.nutritionData?.client?.weight_kg != null
      ? Number(data.nutritionData.client.weight_kg)
      : null
  const occupationMultiplier =
    data.nutritionData?.client?.occupation_multiplier != null
      ? Number(data.nutritionData.client.occupation_multiplier)
      : 1

  const planStrengthSessions =
    workoutDraft?.strengthFrequency ??
    plannedTraining.strengthFrequency ??
    workoutDraft?.weeklyFrequency ??
    plannedTraining.weeklyFrequency ??
    data.nutritionData?.client?.weekly_frequency ??
    null
  const planSessionDuration =
    workoutDraft?.sessionDurationMin ??
    plannedTraining.sessionDurationMin ??
    data.nutritionData?.client?.session_duration_min ??
    null
  const planCardioSessions =
    workoutDraft?.cardioFrequency ?? plannedTraining.cardioFrequency ?? null
  const planCardioDuration =
    workoutDraft?.cardioDurationMin ?? plannedTraining.cardioDurationMin ?? null

  const actualStrengthSessions = estimateSessionsPerWeekFromPerformance(
    data.performance,
  )

  // Free activities + cardio from nutrition-data (aggregated from client_activity_logs)
  const actualCardioFromLogs =
    data.nutritionData?.client?.cardio_frequency != null
      ? Number(data.nutritionData.client.cardio_frequency)
      : null
  const actualCardioDurationFromLogs =
    data.nutritionData?.client?.cardio_duration_min != null
      ? Number(data.nutritionData.client.cardio_duration_min)
      : null

  // Prefer tracker training calories when available (kcal/week → /day)
  const trainingCaloriesWeekly =
    data.nutritionData?.client?.training_calories_weekly != null
      ? Number(data.nutritionData.client.training_calories_weekly)
      : null
  const freeActivityFromTracker =
    trainingCaloriesWeekly != null && trainingCaloriesWeekly > 0
      ? Math.round(trainingCaloriesWeekly / 7)
      : null

  const activityBudget = buildActivityBudget({
    weightKg,
    occupationMultiplier,
    actualSteps,
    plannedSteps,
    planStrengthSessions:
      planStrengthSessions != null ? Number(planStrengthSessions) : null,
    planSessionDurationMin:
      planSessionDuration != null ? Number(planSessionDuration) : null,
    planTrainingTypes:
      workoutDraft?.trainingTypes ?? plannedTraining.trainingTypes ?? null,
    planTrainingRir:
      workoutDraft?.trainingRir ?? plannedTraining.trainingRir ?? null,
    planCardioSessions:
      planCardioSessions != null ? Number(planCardioSessions) : null,
    planCardioDurationMin:
      planCardioDuration != null ? Number(planCardioDuration) : null,
    planCardioTypes: workoutDraft?.cardioTypes ?? plannedTraining.cardioTypes ?? null,
    planCardioRpe: workoutDraft?.cardioRpe ?? plannedTraining.cardioRpe ?? null,
    actualStrengthSessions,
    // client_activity_logs → cardio_frequency / duration (course, vélo, etc.)
    actualCardioSessions: actualCardioFromLogs,
    actualCardioDurationMin: actualCardioDurationFromLogs,
    // Tracker weekly training kcal only when no session-based EAT is available
    actualFreeActivityKcalDay:
      actualStrengthSessions == null &&
      actualCardioFromLogs == null &&
      freeActivityFromTracker != null
        ? freeActivityFromTracker
        : null,
  })

  const energyReality =
    actualCalories != null && currentTdee != null ? actualCalories - currentTdee : null
  const energyPrescription =
    coachTargetCalories != null && coachTdee != null
      ? coachTargetCalories - coachTdee
      : null
  const energyDifference =
    energyReality != null && energyPrescription != null
      ? Math.abs(energyReality - energyPrescription)
      : null

  const energyState: GaugeState =
    energyDifference == null
      ? 'à compléter'
      : energyDifference <= 150
        ? 'aligné'
        : energyDifference <= 350
          ? 'à surveiller'
          : 'à corriger'

  const adherence =
    summary.adherenceCalories != null ? Number(summary.adherenceCalories) * 100 : null
  const adherenceState: GaugeState =
    adherence == null
      ? 'à compléter'
      : adherence >= 85
        ? 'aligné'
        : adherence >= 70
          ? 'à surveiller'
          : 'à corriger'

  const activityRatio = activityBudget.ratio
  const activityState = activityBudget.state

  const overreaching = data.performance?.analysis?.global_overreaching
  const recoverySignals = [
    averages.sleep_duration != null
      ? clamp(((Number(averages.sleep_duration) - 5) / 3) * 100)
      : null,
    averages.energy != null ? clamp(Number(averages.energy) * 10) : null,
    overreaching === true ? 25 : overreaching === false ? 75 : null,
  ].filter((value): value is number => value != null)
  const recovery = recoverySignals.length
    ? recoverySignals.reduce((total, value) => total + value, 0) / recoverySignals.length
    : null
  const recoveryState: GaugeState =
    recovery == null
      ? 'à compléter'
      : recovery >= 70
        ? 'aligné'
        : recovery >= 50
          ? 'à surveiller'
          : 'à corriger'

  const hasLiveDraft = nutritionDraft != null || workoutDraft != null
  const cockpitState: GaugeState = [
    energyState,
    adherenceState,
    activityState,
    recoveryState,
  ].includes('à corriger')
    ? 'à corriger'
    : [energyState, adherenceState, activityState, recoveryState].includes('à surveiller')
      ? 'à surveiller'
      : [energyState, adherenceState, activityState, recoveryState].every(
            (state) => state === 'à compléter',
          )
        ? 'à compléter'
        : 'aligné'

  const directionsInput: CockpitDirectionsInput = {
    clientId,
    energyState,
    adherenceState,
    activityState,
    recoveryState,
    energyReality,
    energyPrescription,
    energyDifference,
    adherencePct: adherence,
    activityRatio,
    actualSteps,
    plannedSteps,
    activityRealityKcal: activityBudget.reality.totalKcalDay,
    activityPlanKcal: activityBudget.plan.totalKcalDay,
    activityNeatReality: activityBudget.reality.neatKcalDay,
    activityEatReality: activityBudget.reality.eatKcalDay,
    activityNeatPlan: activityBudget.plan.neatKcalDay,
    activityEatPlan: activityBudget.plan.eatKcalDay,
    activityStrengthSessionsActual: activityBudget.reality.strengthSessionsPerWeek,
    activityStrengthSessionsPlan: activityBudget.plan.strengthSessionsPerWeek,
    recoveryScore: recovery,
    overreaching: overreaching === true ? true : overreaching === false ? false : null,
    cyclePhase: data.cycleState?.currentPhase ?? null,
    hasLiveDraft,
  }

  return {
    energyState,
    adherenceState,
    activityState,
    recoveryState,
    cockpitState,
    energyReality,
    energyPrescription,
    energyDifference,
    adherence,
    activityRatio,
    actualSteps,
    plannedSteps,
    activityBudget,
    recovery,
    overreaching: overreaching === true ? true : overreaching === false ? false : null,
    hasLiveDraft,
    directionsInput,
    directions: buildCockpitDirections(directionsInput),
  }
}
