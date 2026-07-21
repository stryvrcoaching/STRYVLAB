/**
 * Cockpit activity budget: NEAT (steps) + EAT (training / cardio).
 * Pure estimates aligned with lib/formulas/macros.ts (no double-count).
 */

import type { GaugeState } from '@/lib/coach/cockpit-directions'

const TRAINING_TYPE_MET: Record<string, number> = {
  'Musculation / Powerlifting': 6.0,
  Hypertrophie: 5.0,
  Force: 6.0,
  Endurance: 4.5,
  default: 5.0,
}

const CARDIO_TYPE_MET: Record<string, number> = {
  Marche: 3.5,
  Course: 8.0,
  Vélo: 7.0,
  HIIT: 10.0,
  'HIIT cardio': 10.0,
  default: 6.0,
}

const TRAINING_TABLE_WEEKLY: Record<number, number> = {
  0: 0,
  1: 200,
  2: 260,
  3: 330,
  4: 410,
  5: 490,
  6: 570,
  7: 650,
}

export type ActivityComponent = {
  neatKcalDay: number | null
  eatKcalDay: number | null
  /** kcal/j total when at least one component is known */
  totalKcalDay: number | null
  stepsPerDay: number | null
  strengthSessionsPerWeek: number | null
  cardioSessionsPerWeek: number | null
}

export type ActivityBudget = {
  reality: ActivityComponent
  plan: ActivityComponent
  /** reality.total / plan.total when both defined and plan > 0 */
  ratio: number | null
  state: GaugeState
  /** 0–1 rough coverage of expected signals */
  coverage: number
  /** Short coach-facing breakdown */
  summary: string
  method: string
}

export function estimateNeatKcalDay(
  steps: number | null | undefined,
  weightKg: number | null | undefined,
  occupationMultiplier = 1,
): number | null {
  if (steps == null || !Number.isFinite(steps) || steps < 0) return null
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0) {
    // Fallback ~0.04 kcal/step equivalent of 80 kg body
    return Math.round(steps * 0.04 * occupationMultiplier)
  }
  return Math.round(steps * 0.0005 * weightKg * occupationMultiplier)
}

export function estimateEatStrengthKcalDay(input: {
  weightKg: number | null | undefined
  sessionsPerWeek: number | null | undefined
  sessionDurationMin?: number | null
  trainingTypes?: string[] | null
  trainingRir?: number | null
}): number | null {
  const sessions = Number(input.sessionsPerWeek ?? 0)
  if (!Number.isFinite(sessions) || sessions <= 0) return 0

  const weight = Number(input.weightKg ?? 75)
  const duration = Number(input.sessionDurationMin ?? 0)

  if (duration > 0 && weight > 0) {
    const types = input.trainingTypes ?? []
    const met =
      types.length > 0
        ? types.reduce((s, t) => s + (TRAINING_TYPE_MET[t] ?? TRAINING_TYPE_MET.default), 0) /
          types.length
        : TRAINING_TYPE_MET.default
    const rir =
      input.trainingRir == null
        ? null
        : Math.min(5, Math.max(0, Number(input.trainingRir)))
    const rirFactor = rir == null ? 1 : 1 + (2 - rir) * 0.03
    return Math.round((met * rirFactor * weight * duration) / 60 * (sessions / 7))
  }

  const table = TRAINING_TABLE_WEEKLY[Math.min(7, Math.floor(sessions))] ?? 330
  return Math.round(table / 7)
}

export function estimateEatCardioKcalDay(input: {
  weightKg: number | null | undefined
  sessionsPerWeek: number | null | undefined
  durationMin?: number | null
  cardioTypes?: string[] | null
  cardioRpe?: number | null
}): number | null {
  const sessions = Number(input.sessionsPerWeek ?? 0)
  const duration = Number(input.durationMin ?? 0)
  if (!Number.isFinite(sessions) || sessions <= 0 || !Number.isFinite(duration) || duration <= 0) {
    return 0
  }
  const weight = Number(input.weightKg ?? 75)
  const types = input.cardioTypes ?? []
  const met =
    types.length > 0
      ? types.reduce((s, t) => s + (CARDIO_TYPE_MET[t] ?? CARDIO_TYPE_MET.default), 0) /
        types.length
      : CARDIO_TYPE_MET.default
  const rpe =
    input.cardioRpe == null ? null : Math.min(10, Math.max(1, Number(input.cardioRpe)))
  const rpeFactor = rpe == null ? 1 : 0.85 + ((rpe - 1) / 9) * 0.3
  return Math.round((met * rpeFactor * weight * duration) / 60 * (sessions / 7))
}

export function activityStateFromRatio(ratio: number | null): GaugeState {
  if (ratio == null || !Number.isFinite(ratio)) return 'à compléter'
  if (ratio >= 0.8 && ratio <= 1.15) return 'aligné'
  if (ratio >= 0.6 && ratio <= 1.35) return 'à surveiller'
  return 'à corriger'
}

function sumComponents(neat: number | null, eat: number | null): number | null {
  if (neat == null && eat == null) return null
  return Math.round((neat ?? 0) + (eat ?? 0))
}

/**
 * Estimate sessions/week from performance analysis over N weeks.
 * Uses max exercise sessions_count as lower-bound of completed sessions.
 */
export function estimateSessionsPerWeekFromPerformance(
  performance: {
    analysis?: {
      exercises?: Array<{ sessions_count?: number }>
      analysis_period_weeks?: number
    } | null
  } | null,
): number | null {
  const exercises = performance?.analysis?.exercises ?? []
  if (exercises.length === 0) return null
  const weeks = Math.max(1, Number(performance?.analysis?.analysis_period_weeks ?? 8))
  const maxSessions = Math.max(
    0,
    ...exercises.map((e) => Number(e.sessions_count ?? 0)),
  )
  if (maxSessions <= 0) return 0
  return Math.round((maxSessions / weeks) * 10) / 10
}

/**
 * Free-form activities (running, cycling, …) → average kcal/day over the sample.
 * intensity 1–10 maps roughly to RPE for MET scaling.
 */
export function estimateFreeActivityKcalDay(
  logs: Array<{
    activity_type?: string | null
    duration_min?: number | null
    intensity?: number | null
  }> | null | undefined,
  weightKg: number | null | undefined,
  windowDays = 28,
): number | null {
  if (!logs || logs.length === 0) return null
  const weight = Number(weightKg ?? 75)
  if (!Number.isFinite(weight) || weight <= 0) return null
  const days = Math.max(1, windowDays)

  const typeMet: Record<string, number> = {
    running: 9.0,
    cycling: 7.5,
    swimming: 8.0,
    walking: 3.5,
    team_sport: 7.0,
    other: 5.5,
  }

  let totalKcal = 0
  for (const log of logs) {
    const duration = Number(log.duration_min ?? 0)
    if (!Number.isFinite(duration) || duration <= 0) continue
    const baseMet = typeMet[String(log.activity_type ?? 'other')] ?? typeMet.other
    const intensity = Number(log.intensity ?? 5)
    const rpe = Number.isFinite(intensity)
      ? Math.min(10, Math.max(1, intensity))
      : 5
    const rpeFactor = 0.85 + ((rpe - 1) / 9) * 0.3
    totalKcal += (baseMet * rpeFactor * weight * duration) / 60
  }

  return Math.round(totalKcal / days)
}

export function buildActivityBudget(input: {
  weightKg?: number | null
  occupationMultiplier?: number | null
  actualSteps?: number | null
  plannedSteps?: number | null
  /** Planned strength sessions / week */
  planStrengthSessions?: number | null
  planSessionDurationMin?: number | null
  planTrainingTypes?: string[] | null
  planTrainingRir?: number | null
  planCardioSessions?: number | null
  planCardioDurationMin?: number | null
  planCardioTypes?: string[] | null
  planCardioRpe?: number | null
  /** Observed strength sessions / week (from logs) */
  actualStrengthSessions?: number | null
  /** Observed cardio sessions / week (activity logs) */
  actualCardioSessions?: number | null
  actualCardioDurationMin?: number | null
  /** Optional free-form activity EAT already estimated (kcal/j) */
  actualFreeActivityKcalDay?: number | null
}): ActivityBudget {
  const weight = input.weightKg ?? null
  const occ = input.occupationMultiplier ?? 1

  const neatReality = estimateNeatKcalDay(input.actualSteps, weight, occ)
  const neatPlan = estimateNeatKcalDay(input.plannedSteps, weight, occ)

  const eatStrengthPlan = estimateEatStrengthKcalDay({
    weightKg: weight,
    sessionsPerWeek: input.planStrengthSessions,
    sessionDurationMin: input.planSessionDurationMin,
    trainingTypes: input.planTrainingTypes,
    trainingRir: input.planTrainingRir,
  })
  const eatCardioPlan = estimateEatCardioKcalDay({
    weightKg: weight,
    sessionsPerWeek: input.planCardioSessions,
    durationMin: input.planCardioDurationMin,
    cardioTypes: input.planCardioTypes,
    cardioRpe: input.planCardioRpe,
  })
  const eatPlan =
    (eatStrengthPlan ?? 0) + (eatCardioPlan ?? 0) > 0
      ? Math.round((eatStrengthPlan ?? 0) + (eatCardioPlan ?? 0))
      : input.planStrengthSessions != null || input.planCardioSessions != null
        ? 0
        : null

  // Reality EAT: use logged strength sessions with plan duration/MET as estimate
  const actualStrength = input.actualStrengthSessions
  const eatStrengthReality =
    actualStrength == null
      ? null
      : estimateEatStrengthKcalDay({
          weightKg: weight,
          sessionsPerWeek: actualStrength,
          sessionDurationMin: input.planSessionDurationMin ?? 55,
          trainingTypes: input.planTrainingTypes,
          trainingRir: input.planTrainingRir,
        })
  const eatCardioReality =
    input.actualCardioSessions == null
      ? null
      : estimateEatCardioKcalDay({
          weightKg: weight,
          sessionsPerWeek: input.actualCardioSessions,
          durationMin:
            input.actualCardioDurationMin ??
            input.planCardioDurationMin ??
            30,
          cardioTypes: input.planCardioTypes,
          cardioRpe: input.planCardioRpe,
        })

  const freeActivity =
    input.actualFreeActivityKcalDay != null &&
    Number.isFinite(input.actualFreeActivityKcalDay)
      ? Math.max(0, Math.round(input.actualFreeActivityKcalDay))
      : 0

  let eatReality: number | null = null
  if (
    eatStrengthReality != null ||
    eatCardioReality != null ||
    freeActivity > 0
  ) {
    eatReality = Math.round(
      (eatStrengthReality ?? 0) + (eatCardioReality ?? 0) + freeActivity,
    )
  }

  const realityTotal = sumComponents(neatReality, eatReality)
  const planTotal = sumComponents(neatPlan, eatPlan)

  // Coverage: steps plan+reality, training plan, training reality if plan has training
  let signals = 0
  let present = 0
  if (input.plannedSteps != null && input.plannedSteps > 0) {
    signals++
    if (input.actualSteps != null) present++
  }
  const planHasTraining =
    (input.planStrengthSessions ?? 0) > 0 || (input.planCardioSessions ?? 0) > 0
  if (planHasTraining) {
    signals++
    if (
      actualStrength != null ||
      input.actualCardioSessions != null ||
      freeActivity > 0
    ) {
      present++
    }
  } else if (input.actualCardioSessions != null || freeActivity > 0) {
    // Free activities even without cardio plan still count as signal
    signals++
    present++
  }
  // Always count NEAT plan existence as needing a plan target
  if (signals === 0) {
    // No plan at all
    if (input.actualSteps != null) {
      signals = 1
      present = 1
    }
  }
  const coverage = signals === 0 ? 0 : present / signals

  let ratio: number | null = null
  let state: GaugeState = 'à compléter'

  if (planTotal != null && planTotal > 0 && realityTotal != null) {
    // If plan has training but no session logs, still allow NEAT-only partial
    // but mark incomplete when training is majority of plan and missing
    const planEatShare = (eatPlan ?? 0) / planTotal
    if (planEatShare >= 0.35 && eatReality == null && neatReality != null) {
      // Partial: compare NEAT only if NEAT plan exists
      if (neatPlan != null && neatPlan > 0) {
        ratio = neatReality / neatPlan
        state = activityStateFromRatio(ratio)
        // Downgrade confidence: if NEAT ok but EAT unknown → at best "à surveiller"
        if (state === 'aligné') state = 'à surveiller'
      } else {
        state = 'à compléter'
      }
    } else if (planEatShare >= 0.35 && eatReality == null && neatReality == null) {
      state = 'à compléter'
    } else {
      ratio = realityTotal / planTotal
      state = activityStateFromRatio(ratio)
    }
  } else if (
    neatPlan != null &&
    neatPlan > 0 &&
    neatReality != null &&
    (eatPlan == null || eatPlan === 0)
  ) {
    // Steps-only plan (legacy)
    ratio = neatReality / neatPlan
    state = activityStateFromRatio(ratio)
  }

  const reality: ActivityComponent = {
    neatKcalDay: neatReality,
    eatKcalDay: eatReality,
    totalKcalDay: realityTotal,
    stepsPerDay: input.actualSteps ?? null,
    strengthSessionsPerWeek: actualStrength ?? null,
    cardioSessionsPerWeek: input.actualCardioSessions ?? null,
  }
  const plan: ActivityComponent = {
    neatKcalDay: neatPlan,
    eatKcalDay: eatPlan,
    totalKcalDay: planTotal,
    stepsPerDay: input.plannedSteps ?? null,
    strengthSessionsPerWeek: input.planStrengthSessions ?? null,
    cardioSessionsPerWeek: input.planCardioSessions ?? null,
  }

  const summary = buildActivitySummary(reality, plan, ratio, state)
  const method =
    'Budget d’activité = NEAT (pas × poids) + EAT (séances force/cardio estimées). ' +
    'Réel : pas check-in + séances loguées. Plan : objectif pas + programme/cardio prescrit. ' +
    'Pas de double comptage : les pas restent en NEAT, les séances en EAT. Zone alignée 80–115% du plan.'

  return { reality, plan, ratio, state, coverage, summary, method }
}

function buildActivitySummary(
  reality: ActivityComponent,
  plan: ActivityComponent,
  ratio: number | null,
  state: GaugeState,
): string {
  if (state === 'à compléter') {
    return 'Il manque un objectif d’activité ou des relevés (pas / séances) pour comparer.'
  }
  const pct = ratio != null ? Math.round(ratio * 100) : null
  const real = reality.totalKcalDay
  const planned = plan.totalKcalDay
  if (real != null && planned != null && pct != null) {
    const neatBit =
      reality.neatKcalDay != null
        ? `NEAT ${Math.round(reality.neatKcalDay)}`
        : null
    const eatBit =
      reality.eatKcalDay != null ? `EAT ${Math.round(reality.eatKcalDay)}` : null
    const parts = [neatBit, eatBit].filter(Boolean).join(' · ')
    return `${pct}% du plan · ${Math.round(real)} vs ${Math.round(planned)} kcal/j${parts ? ` (${parts})` : ''}`
  }
  if (reality.stepsPerDay != null && plan.stepsPerDay != null) {
    return `${Math.round(reality.stepsPerDay)} pas/j vs objectif ${Math.round(plan.stepsPerDay)}`
  }
  return 'Activité comparée au plan.'
}
