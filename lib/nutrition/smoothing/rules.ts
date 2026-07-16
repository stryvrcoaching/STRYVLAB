import {
  SMOOTHING_DURATION_OPTIONS,
  type NutritionSmoothingDailyAdjustment,
  type NutritionSmoothingDirection,
  type NutritionSmoothingGuardrails,
  type NutritionSmoothingProposal,
} from '@/lib/nutrition/smoothing/types'

const DEFAULT_THRESHOLD_KCAL = 50
const DEFAULT_GUARDRAILS: NutritionSmoothingGuardrails = {
  maxDailyAdjustmentPct: 0.1,
  minTargetPct: 0.8,
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function resolveSmoothingDirection(deltaKcal: number, thresholdKcal = DEFAULT_THRESHOLD_KCAL): NutritionSmoothingDirection | null {
  if (deltaKcal > thresholdKcal) return 'surplus'
  if (deltaKcal < -thresholdKcal) return 'deficit'
  return null
}

export function computeSmoothableDeltaKcal(deltaKcal: number, thresholdKcal = DEFAULT_THRESHOLD_KCAL): number {
  if (deltaKcal > thresholdKcal) return deltaKcal - thresholdKcal
  if (deltaKcal < -thresholdKcal) return deltaKcal + thresholdKcal
  return 0
}

export function computePerDayAdjustmentKcal(smoothableDeltaKcal: number, durationDays: number): number {
  if (durationDays <= 0) return 0
  return Math.abs(smoothableDeltaKcal) / durationDays
}

export function isDurationSafe(args: {
  smoothableDeltaKcal: number
  durationDays: number
  baseTargetKcal: number
  direction: NutritionSmoothingDirection
  guardrails?: Partial<NutritionSmoothingGuardrails>
}): boolean {
  const { smoothableDeltaKcal, durationDays, baseTargetKcal, direction } = args
  const guardrails = { ...DEFAULT_GUARDRAILS, ...(args.guardrails ?? {}) }
  if (durationDays <= 0 || baseTargetKcal <= 0) return false

  const dailyAdjustment = computePerDayAdjustmentKcal(smoothableDeltaKcal, durationDays)
  const maxAllowed = baseTargetKcal * guardrails.maxDailyAdjustmentPct
  if (dailyAdjustment > maxAllowed) return false

  if (direction === 'surplus') {
    const adjustedTarget = baseTargetKcal - dailyAdjustment
    const minTarget = baseTargetKcal * guardrails.minTargetPct
    return adjustedTarget >= minTarget
  }

  return true
}

export function recommendSmoothingDuration(args: {
  rawDeltaKcal: number
  smoothableDeltaKcal: number
  baseTargetKcal: number
  thresholdKcal?: number
  guardrails?: Partial<NutritionSmoothingGuardrails>
}): number | null {
  const thresholdKcal = args.thresholdKcal ?? DEFAULT_THRESHOLD_KCAL
  const direction = resolveSmoothingDirection(args.rawDeltaKcal, thresholdKcal)
  if (!direction || args.smoothableDeltaKcal === 0) return null

  const absoluteSmoothable = Math.abs(args.smoothableDeltaKcal)
  const preferredMinimum =
    absoluteSmoothable <= 150 ? 3 :
    absoluteSmoothable <= 450 ? 4 :
    absoluteSmoothable <= 900 ? 5 :
    absoluteSmoothable <= 1200 ? 7 :
    10

  for (const option of SMOOTHING_DURATION_OPTIONS) {
    if (option < preferredMinimum) continue
    if (isDurationSafe({
      smoothableDeltaKcal: args.smoothableDeltaKcal,
      durationDays: option,
      baseTargetKcal: args.baseTargetKcal,
      direction,
      guardrails: args.guardrails,
    })) {
      return option
    }
  }

  for (const option of SMOOTHING_DURATION_OPTIONS) {
    if (isDurationSafe({
      smoothableDeltaKcal: args.smoothableDeltaKcal,
      durationDays: option,
      baseTargetKcal: args.baseTargetKcal,
      direction,
      guardrails: args.guardrails,
    })) {
      return option
    }
  }

  return null
}

export function buildSmoothingProposal(args: {
  targetKcal: number
  consumedKcal: number
  thresholdKcal?: number
  guardrails?: Partial<NutritionSmoothingGuardrails>
  allowDeficit?: boolean
  allowSurplus?: boolean
}): NutritionSmoothingProposal {
  const thresholdKcal = args.thresholdKcal ?? DEFAULT_THRESHOLD_KCAL
  const allowDeficit = args.allowDeficit ?? true
  const allowSurplus = args.allowSurplus ?? true

  if (args.targetKcal <= 0) {
    return {
      eligible: false,
      thresholdKcal,
      rawDeltaKcal: 0,
      smoothableDeltaKcal: 0,
      direction: null,
      recommendedDurationDays: null,
    }
  }

  const rawDeltaKcal = Math.round(args.consumedKcal - args.targetKcal)
  const initialSmoothableDeltaKcal = computeSmoothableDeltaKcal(rawDeltaKcal, thresholdKcal)
  const initialDirection = resolveSmoothingDirection(rawDeltaKcal, thresholdKcal)

  const direction =
    initialDirection === 'deficit' && !allowDeficit ? null :
    initialDirection === 'surplus' && !allowSurplus ? null :
    initialDirection

  const smoothableDeltaKcal = direction ? initialSmoothableDeltaKcal : 0
  const recommendedDurationDays = direction
    ? recommendSmoothingDuration({
        rawDeltaKcal,
        smoothableDeltaKcal,
        baseTargetKcal: args.targetKcal,
        thresholdKcal,
        guardrails: args.guardrails,
      })
    : null

  return {
    eligible: direction !== null && smoothableDeltaKcal !== 0,
    thresholdKcal,
    rawDeltaKcal,
    smoothableDeltaKcal,
    direction,
    recommendedDurationDays,
  }
}

export function kcalDeltaToMacroAdjustment(kcalDelta: number): NutritionSmoothingDailyAdjustment {
  if (kcalDelta === 0) {
    return { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  }

  const carbsKcal = kcalDelta * 0.7
  const fatsKcal = kcalDelta * 0.3

  return {
    kcal: Math.round(kcalDelta),
    protein_g: 0,
    carbs_g: round1(carbsKcal / 4),
    fat_g: round1(fatsKcal / 9),
  }
}
