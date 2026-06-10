import { calculateOneRM } from '@/lib/formulas/oneRM'

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
}

export interface SetRecommendation {
  weight_kg: number
  reps: number
  confidence: 'high' | 'low'
  delta_vs_last: number | null
  phase: 'double_progression_reps' | 'double_progression_overload' | 'intra_session' | 'prescription' | 'failure_recovery'
}

// Round to nearest increment — parseFloat/toFixed eliminates IEEE 754 floating point noise
function roundToIncrement(value: number, increment: number): number {
  if (increment <= 0) return Math.round(value * 4) / 4
  return parseFloat((Math.round(value / increment) * increment).toFixed(10))
}

export function recommendNextSet(input: SetRecommendationInput): SetRecommendation | null {
  const {
    actual_weight_kg, actual_reps, rir_actual,
    planned_reps,
    rep_min, rep_max, target_rir,
    weight_increment_kg = 2.5,
    lastWeek, prev_set_weight_kg,
  } = input

  if (actual_weight_kg <= 0 || actual_reps <= 0) return null

  const increment = weight_increment_kg > 0 ? weight_increment_kg : 2.5
  const effectiveTargetRir = target_rir ?? 2
  const effectiveRepMin = rep_min ?? 6
  const effectiveRepMax = rep_max ?? 12

  // ── Path A : double progression (previous week data available) ───────────
  if (lastWeek && lastWeek.weight_kg > 0 && lastWeek.reps > 0) {
    const lastAtOrAboveRepMax = lastWeek.reps >= effectiveRepMax
    // Last week RIR must be >= 1 (not absolute failure) AND within target+1 tolerance
    const lastRirCompliant = lastWeek.rir_actual >= 1 && lastWeek.rir_actual <= effectiveTargetRir + 1
    // Hold: client below target RIR this set → struggling, veto overload
    // Fixes: previous rir_hold = rir_actual <= target-2 which is impossible when target<=1
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
    }
  }

  // ── Path B : intra-session (no previous week data) ───────────────────────
  // At this point: RIR > 0 and RIR not too low (those cases handled above)
  const inZone = actual_reps >= effectiveRepMin && actual_reps <= effectiveRepMax
  const aboveZone = actual_reps > effectiveRepMax
  const belowZone = actual_reps < effectiveRepMin
  const rirTooHigh = rir_actual > effectiveTargetRir + 2  // too easy

  let targetWeight: number
  let targetReps: number
  let confidence: 'high' | 'low' = 'high'

  if (aboveZone && rirTooHigh) {
    // Way too easy AND too many reps → increase weight significantly
    targetWeight = roundToIncrement(actual_weight_kg + increment * 2, increment)
    targetReps = effectiveRepMin
  } else if (aboveZone) {
    // More reps than prescribed, effort OK → increase weight one step
    targetWeight = roundToIncrement(actual_weight_kg + increment, increment)
    targetReps = effectiveRepMin
  } else if (belowZone && rir_actual === 0) {
    // Below zone AND failure → drop weight, target rep_min
    targetWeight = roundToIncrement(Math.max(actual_weight_kg - increment, increment), increment)
    targetReps = effectiveRepMin
    return { weight_kg: Math.max(targetWeight, increment), reps: targetReps, confidence: 'high', delta_vs_last: null, phase: 'failure_recovery' }
  } else if (belowZone) {
    // Fewer reps than prescribed (RIR > 0) → maintain weight, aim for prescription
    targetWeight = roundToIncrement(actual_weight_kg, increment)
    targetReps = planned_reps > 0 ? planned_reps : effectiveRepMin
    confidence = 'low'
  } else if (inZone && rirTooHigh) {
    // In zone but too easy → increase weight
    targetWeight = roundToIncrement(actual_weight_kg + increment, increment)
    targetReps = effectiveRepMin
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
  }
}
