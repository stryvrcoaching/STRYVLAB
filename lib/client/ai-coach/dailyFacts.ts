export type DayKind = 'training' | 'rest' | 'cancelled'
export type SessionStatus = 'completed' | 'skipped' | 'cancelled' | 'rest' | 'none'
export type NutritionStatus = 'under' | 'on_track' | 'over'

const OVER_KCAL = 200   // delta above target -> over
const UNDER_KCAL = -300 // delta below target -> under
const PROTEIN_SHORT_RATIO = 0.8

export type CheckinSignals = {
  sleepHours?: number; sleepQuality?: number; energy?: number
  stress?: number; soreness?: number; rhr?: number; weight?: number
}

export type DailyFactsInput = {
  dayKind: DayKind
  sessionStatus: SessionStatus
  plannedSessionName: string | null
  kcalLogged: number
  kcalTarget: number
  proteinLogged: number
  proteinTarget: number
  hydrationMl: number
  hydrationTargetMl: number
  steps: number | null
  checkin: CheckinSignals
}

export type DailyFacts = {
  dayKind: DayKind
  session: { planned: string | null; status: SessionStatus }
  nutrition: {
    kcalLogged: number; kcalTarget: number; deltaKcal: number; pctKcal: number
    proteinLogged: number; proteinTarget: number; proteinShort: boolean
    status: NutritionStatus
  }
  hydration: { ml: number; targetMl: number; pct: number }
  steps: number | null
  checkin: CheckinSignals
}

function pct(value: number, total: number): number {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

function nutritionStatus(deltaKcal: number): NutritionStatus {
  if (deltaKcal > OVER_KCAL) return 'over'
  if (deltaKcal < UNDER_KCAL) return 'under'
  return 'on_track'
}

export function computeDailyFacts(input: DailyFactsInput): DailyFacts {
  const deltaKcal = Math.round(input.kcalLogged - input.kcalTarget)
  const proteinShort = input.proteinTarget > 0
    ? input.proteinLogged < input.proteinTarget * PROTEIN_SHORT_RATIO
    : false

  return {
    dayKind: input.dayKind,
    session: { planned: input.plannedSessionName, status: input.sessionStatus },
    nutrition: {
      kcalLogged: Math.round(input.kcalLogged),
      kcalTarget: Math.round(input.kcalTarget),
      deltaKcal,
      pctKcal: pct(input.kcalLogged, input.kcalTarget),
      proteinLogged: Math.round(input.proteinLogged),
      proteinTarget: Math.round(input.proteinTarget),
      proteinShort,
      status: nutritionStatus(deltaKcal),
    },
    hydration: { ml: input.hydrationMl, targetMl: input.hydrationTargetMl, pct: pct(input.hydrationMl, input.hydrationTargetMl) },
    steps: input.steps,
    checkin: input.checkin,
  }
}

export type DayKindInput = {
  plannedSessionName: string | null
  completed: boolean
  skipped: boolean
  overrideOff: boolean
}

export function computeDayKind(input: DayKindInput): { dayKind: DayKind; sessionStatus: SessionStatus } {
  if (!input.plannedSessionName) return { dayKind: 'rest', sessionStatus: 'rest' }
  if (input.completed) return { dayKind: 'training', sessionStatus: 'completed' }
  if (input.skipped) return { dayKind: 'cancelled', sessionStatus: 'skipped' }
  if (input.overrideOff) return { dayKind: 'cancelled', sessionStatus: 'cancelled' }
  return { dayKind: 'training', sessionStatus: 'none' }
}
