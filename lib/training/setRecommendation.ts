import { epley } from '@/lib/formulas/oneRM'

// Future hook for Approach C (ML regression) — unused in Phase 1
export interface HistoricalSession {
  date: string
  sets: Array<{ set_number: number; weight_kg: number; reps: number; rir_actual: number }>
}

export interface SetRecommendationInput {
  actual_weight_kg: number
  actual_reps: number
  rir_actual: number
  goal: string
  level: string
  planned_reps: number
  set_number: number
  rep_min?: number
  rep_max?: number
  target_rir?: number
  weight_increment_kg?: number
  lastWeek?: {
    weight_kg: number
    reps: number
    rir_actual: number
  }
  // Weight used in the previous set this session — recommendation never goes below this
  prev_set_weight_kg?: number
  historicalSessions?: HistoricalSession[]
  /**
   * If true, the exercise is unilateral (e.g. lunges, lateral raises).
   * actual_weight_kg is the load PER LIMB. The engine works entirely in
   * per-limb units — no ×2 or ÷2 conversion is performed internally.
   * The caller (SessionLogger) is responsible for passing the correct value.
   * The output weight_kg is also per-limb.
   */
  is_unilateral?: boolean
  /**
   * Explicit rep target for the next set (coach per-set prescription).
   * When present, overrides the rep_min fallback in 1RM calculations.
   */
  target_reps?: number
}

export interface SetRecommendation {
  weight_kg: number
  reps: number
  confidence: 'high' | 'low'
  delta_vs_last: number | null
  phase: 'double_progression_reps' | 'double_progression_overload' | 'intra_session' | 'prescription' | 'failure_recovery'
  /** True when the recommendation was derived from a 1RM estimate (Phase 2+) */
  used_one_rm_estimate?: boolean
  /** Mirrors is_unilateral from input — lets the UI render "X kg / side" */
  is_unilateral?: boolean
}

const GOAL_REP_RANGES: Record<string, { min: number; max: number }> = {
  strength: { min: 3, max: 6 },
  power: { min: 3, max: 5 },
  hypertrophy: { min: 8, max: 15 },
  endurance: { min: 12, max: 20 },
  fat_loss: { min: 10, max: 15 },
  recomp: { min: 8, max: 15 },
  maintenance: { min: 8, max: 12 },
  athletic: { min: 4, max: 8 },
}

export function getGoalRepRange(goal: string): { min: number; max: number } {
  return GOAL_REP_RANGES[goal] ?? GOAL_REP_RANGES.hypertrophy
}

/** The range format stored in a coach prescription, e.g. "8-15". */
export function getDefaultReps(goal: string): string {
  const { min, max } = getGoalRepRange(goal)
  return `${min}-${max}`
}

export function normalizeWeightIncrement(increment?: number): number {
  if (!Number.isFinite(increment) || !increment || increment <= 0) return 2.5

  const commonIncrements = [0.5, 1, 1.25, 2, 2.5, 5, 10]
  const closest = commonIncrements.reduce((best, candidate) =>
    Math.abs(candidate - increment) < Math.abs(best - increment) ? candidate : best,
  commonIncrements[0])

  if (Math.abs(closest - increment) <= 0.05) return closest
  if (increment < 0.5) return 0.5
  return Math.max(0.5, Math.round(increment * 2) / 2)
}

function resolvePlannedReps(plannedReps: number, repMin: number, repMax: number, actualReps: number): number {
  if (plannedReps > 0) return plannedReps
  const midpoint = Math.round((repMin + repMax) / 2)
  return Math.min(repMax, Math.max(repMin, actualReps || midpoint))
}

// Round to nearest increment — parseFloat/toFixed eliminates IEEE 754 floating point noise
function roundToIncrement(value: number, increment: number): number {
  if (increment <= 0) return Math.round(value * 4) / 4
  return parseFloat((Math.round(value / increment) * increment).toFixed(10))
}

// ── 1RM estimation helpers ─────────────────────────────────────────────────

/**
 * Maximum jump allowed from a 1RM-derived suggestion, expressed as a
 * multiplier of the weight_increment_kg.  Prevents absurd leaps when the
 * Epley estimate overshoots (e.g. very high-rep sets).
 */
const MAX_RM_JUMP_INCREMENTS = 4

/**
 * Minimum rep-range where Epley is considered reliable enough to replace
 * the fixed-increment logic.  Outside this window we fall back.
 */
const EPLEY_MIN_REPS = 2
const EPLEY_MAX_REPS = 20

/**
 * Estimates the optimal load for the next set using the Epley formula.
 *
 * Uses the *observed* set (weight + reps + RIR) to compute an estimated 1RM,
 * then back-calculates the load that would produce `targetReps` reps at
 * `targetRir` reps-in-reserve.
 *
 * The result is:
 *  - rounded to the nearest equipment increment
 *  - clamped to ±MAX_RM_JUMP_INCREMENTS increments from the observed load
 *    (safety guard against formula noise on high-rep sets)
 *
 * Returns null when:
 *  - observed reps are outside Epley's reliable domain [2, 20]
 *  - the computed delta is smaller than one equipment increment (fixed-
 *    increment logic is sufficient and more predictable in that case)
 *
 * @param observedWeight    Load used in the observed set (kg, per-limb if unilateral)
 * @param observedReps      Reps actually performed
 * @param observedRirActual Reps-in-reserve reported after the set
 * @param targetReps        Desired rep count for the recommended set
 * @param targetRir         Desired RIR for the recommended set
 * @param increment         Equipment weight increment (kg)
 */
export function estimateLoadFromOneRM(
  observedWeight: number,
  observedReps: number,
  observedRirActual: number,
  targetReps: number,
  targetRir: number,
  increment: number,
): { weight_kg: number; e1rm: number; delta_kg: number } | null {
  // Guard: Epley reliable domain
  if (observedReps < EPLEY_MIN_REPS || observedReps > EPLEY_MAX_REPS) return null
  if (targetReps <= 0 || targetRir < 0) return null

  // Estimated maximal reps at this load = performed reps + perceived RIR
  // (conservative — perceived RIR tends to be slightly over-estimated)
  const rMaxEstimated = observedReps + observedRirActual

  // e1RM via Epley: w × (1 + rMax / 30)
  const e1rm = epley(observedWeight, rMaxEstimated)

  // Back-calculate load for target (reps + RIR) reps-to-failure
  const rTargetToFailure = targetReps + targetRir
  const rawWeight = e1rm / (1 + rTargetToFailure / 30)

  // Snap to equipment grid
  const snapped = roundToIncrement(rawWeight, increment)

  const delta_kg = parseFloat((snapped - observedWeight).toFixed(10))

  // If the delta is less than one full increment, the fixed-increment path
  // is more predictable — signal the caller to fall back.
  if (Math.abs(delta_kg) < increment - 0.001) return null

  // Safety clamp: never suggest more than MAX_RM_JUMP_INCREMENTS steps away
  const maxDelta = increment * MAX_RM_JUMP_INCREMENTS
  const clampedWeight = Math.min(
    Math.max(snapped, roundToIncrement(observedWeight - maxDelta, increment)),
    roundToIncrement(observedWeight + maxDelta, increment),
  )

  return {
    weight_kg: Math.max(clampedWeight, increment),
    e1rm: parseFloat(e1rm.toFixed(2)),
    delta_kg: parseFloat((clampedWeight - observedWeight).toFixed(10)),
  }
}

// ── Main recommendation function ───────────────────────────────────────────

export function recommendNextSet(input: SetRecommendationInput): SetRecommendation | null {
  const {
    actual_weight_kg, actual_reps, rir_actual,
    planned_reps,
    rep_min, rep_max, target_rir,
    weight_increment_kg = 2.5,
    lastWeek, prev_set_weight_kg,
    is_unilateral = false,
    target_reps,
  } = input

  if (actual_weight_kg <= 0 || actual_reps <= 0) return null

  const increment = weight_increment_kg > 0 ? weight_increment_kg : 2.5
  const effectiveTargetRir = target_rir ?? 2
  const goalRange = getGoalRepRange(input.goal)
  const effectiveRepMin = rep_min ?? goalRange.min
  const effectiveRepMax = rep_max ?? goalRange.max
  const resolvedPlannedReps = resolvePlannedReps(planned_reps, effectiveRepMin, effectiveRepMax, actual_reps)
  const belowZone = actual_reps < effectiveRepMin
  const shouldRecoverFromFailure = belowZone && rir_actual <= 1

  // Helper: try 1RM-based load for given target reps/RIR, fallback to fixed delta
  function tryOneRM(
    targetRepsForSet: number,
    fallbackWeight: number,
  ): { weight_kg: number; used_one_rm: boolean } {
    const est = estimateLoadFromOneRM(
      actual_weight_kg,
      actual_reps,
      rir_actual,
      targetRepsForSet,
      effectiveTargetRir,
      increment,
    )
    if (est) return { weight_kg: est.weight_kg, used_one_rm: true }
    return { weight_kg: roundToIncrement(fallbackWeight, increment), used_one_rm: false }
  }

  // ── Failure recovery (belowZone + RIR ≤ 1) ────────────────────────────────
  if (shouldRecoverFromFailure) {
    // Try 1RM-based descent to the prescription target at target_rir
    const est = estimateLoadFromOneRM(
      actual_weight_kg,
      actual_reps,
      rir_actual,
      target_reps ?? resolvedPlannedReps,
      effectiveTargetRir,
      increment,
    )
    const rawWeight = est
      ? est.weight_kg
      : roundToIncrement(Math.max(actual_weight_kg - increment, increment), increment)
    // Failure recovery must always go DOWN (never above actual_weight_kg)
    const targetWeight = Math.min(rawWeight, roundToIncrement(actual_weight_kg - increment, increment))
    return {
      weight_kg: Math.max(targetWeight, increment),
      reps: target_reps ?? resolvedPlannedReps,
      confidence: 'high',
      delta_vs_last: null,
      phase: 'failure_recovery',
      used_one_rm_estimate: !!est,
      is_unilateral: is_unilateral || undefined,
    }
  }

  // ── Path A : double progression (previous week data available) ───────────
  if (lastWeek && lastWeek.weight_kg > 0 && lastWeek.reps > 0) {
    const lastAtOrAboveRepMax = lastWeek.reps >= effectiveRepMax
    // Last week RIR must be >= 1 (not absolute failure) AND within target+1 tolerance
    const lastRirCompliant = lastWeek.rir_actual >= 1 && lastWeek.rir_actual <= effectiveTargetRir + 1
    // Hold: client below target RIR this set → struggling, veto overload
    const rir_hold  = rir_actual < effectiveTargetRir
    const rirTooHigh = rir_actual >= effectiveTargetRir + 3  // way too easy → double increment

    if (lastAtOrAboveRepMax && lastRirCompliant) {
      if (rir_hold) {
        // HOLD — client struggling (RIR below target), don't overload, maintain S-1 weight
        let targetWeight = roundToIncrement(lastWeek.weight_kg, increment)
        if (prev_set_weight_kg !== undefined && prev_set_weight_kg > 0) {
          targetWeight = Math.max(targetWeight, prev_set_weight_kg)
        }
        return {
          weight_kg: targetWeight,
          reps: effectiveRepMin,
          confidence: 'high',
          delta_vs_last: null,
          phase: 'double_progression_overload',
          is_unilateral: is_unilateral || undefined,
        }
      }
      // Overload phase: S-1 reached rep_max with good effort
      const baseWeight = rirTooHigh
        ? lastWeek.weight_kg + increment * 2  // too easy → double increment
        : lastWeek.weight_kg + increment       // normal progression
      let targetWeight = roundToIncrement(baseWeight, increment)
      if (prev_set_weight_kg !== undefined && prev_set_weight_kg > 0) {
        targetWeight = Math.max(targetWeight, prev_set_weight_kg)
      }
      const delta = roundToIncrement(targetWeight - lastWeek.weight_kg, increment)
      const delta_vs_last = (prev_set_weight_kg !== undefined && targetWeight <= prev_set_weight_kg)
        ? null
        : (delta !== 0 ? delta : null)
      return {
        weight_kg: targetWeight,
        reps: effectiveRepMin,
        confidence: 'high',
        delta_vs_last,
        phase: 'double_progression_overload',
        is_unilateral: is_unilateral || undefined,
      }
    }

    // Rep progression: keep S-1 weight, target +1 rep toward rep_max
    let targetWeight = roundToIncrement(lastWeek.weight_kg, increment)
    if (prev_set_weight_kg !== undefined && prev_set_weight_kg > 0) {
      targetWeight = Math.max(targetWeight, prev_set_weight_kg)
    }
    const targetReps = Math.min(lastWeek.reps + 1, effectiveRepMax)
    const delta = roundToIncrement(targetWeight - lastWeek.weight_kg, increment)
    const delta_vs_last = (prev_set_weight_kg !== undefined && targetWeight <= prev_set_weight_kg)
      ? null
      : (delta !== 0 ? delta : null)
    return {
      weight_kg: targetWeight,
      reps: targetReps,
      confidence: 'high',
      delta_vs_last,
      phase: 'double_progression_reps',
      is_unilateral: is_unilateral || undefined,
    }
  }

  // ── Path B : intra-session (no previous week data) ───────────────────────
  const inZone = actual_reps >= effectiveRepMin && actual_reps <= effectiveRepMax
  const aboveZone = actual_reps > effectiveRepMax
  const rirTooHigh = rir_actual > effectiveTargetRir + 2  // too easy (>2 above target)

  let targetWeight: number
  let targetReps: number
  let confidence: 'high' | 'low' = 'high'
  let used_one_rm_estimate = false

  if (aboveZone && rirTooHigh) {
    // Way too easy AND too many reps → 1RM-based load for rep_min @ target_rir
    const { weight_kg, used_one_rm } = tryOneRM(
      target_reps ?? effectiveRepMin,
      actual_weight_kg + increment * 2,
    )
    targetWeight = weight_kg
    targetReps = target_reps ?? effectiveRepMin
    used_one_rm_estimate = used_one_rm
  } else if (aboveZone) {
    // More reps than prescribed, effort OK → 1RM-based load for rep_min @ target_rir
    const { weight_kg, used_one_rm } = tryOneRM(
      target_reps ?? effectiveRepMin,
      actual_weight_kg + increment,
    )
    targetWeight = weight_kg
    targetReps = target_reps ?? effectiveRepMin
    used_one_rm_estimate = used_one_rm
  } else if (belowZone) {
    // Fewer reps than prescribed (RIR > 1 here — ≤1 handled by failure_recovery above)
    // Maintain weight, aim for planned prescription — never round up above actual load
    let targetWeightRaw = roundToIncrement(actual_weight_kg, increment)
    if (targetWeightRaw > actual_weight_kg) {
      targetWeightRaw = parseFloat((Math.floor(actual_weight_kg / increment) * increment).toFixed(10))
    }
    targetWeight = targetWeightRaw
    targetReps = target_reps ?? resolvedPlannedReps
    confidence = 'low'
  } else if (inZone && rirTooHigh) {
    // In zone but way too easy → 1RM-based load keeping same rep count @ target_rir
    // (avoid rep drop when the weight adjustment is the right lever here)
    const { weight_kg, used_one_rm } = tryOneRM(
      target_reps ?? actual_reps,
      actual_weight_kg + increment,
    )
    targetWeight = weight_kg
    targetReps = target_reps ?? actual_reps
    used_one_rm_estimate = used_one_rm
  } else if (inZone && rir_actual === 0) {
    // In zone but absolute failure — maintain weight AND reps (no progression at failure)
    targetWeight = roundToIncrement(actual_weight_kg, increment)
    targetReps = actual_reps
    confidence = 'low'
  } else {
    // In zone, good effort → maintain weight, +1 rep
    targetWeight = roundToIncrement(actual_weight_kg, increment)
    targetReps = Math.min(actual_reps + 1, effectiveRepMax)
    confidence = 'low'
  }

  // Never go below previous set weight in same session
  if (prev_set_weight_kg !== undefined && prev_set_weight_kg > 0) {
    targetWeight = Math.max(targetWeight, prev_set_weight_kg)
  }
  targetWeight = Math.max(targetWeight, increment)

  return {
    weight_kg: targetWeight,
    reps: targetReps,
    confidence,
    delta_vs_last: null,
    phase: 'intra_session',
    used_one_rm_estimate: used_one_rm_estimate || undefined,
    is_unilateral: is_unilateral || undefined,
  }
}
