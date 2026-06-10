/**
 * 1RM Auto-Estimation Library
 *
 * Formulas:
 * - Epley: 1RM = weight × (1 + reps/30)
 * - Brzycki: 1RM = weight / (1.0278 - 0.0278 × reps)
 *
 * We use average of both for reps ≤ 12, Epley only for reps > 12.
 *
 * RIR Adjustment:
 * If rir_actual > 0, we estimate the true max weight first:
 * true_weight = actual_weight / (1 - rir_actual × 0.025)
 * Each RIR unit represents approximately 2.5% of max.
 */

export interface OneRMSet {
  weight: number
  reps: number
  rir: number
}

export interface OneRMTrend {
  exercise: string
  current1RM: number
  previous1RM: number
  delta: number
  percentChange: number
}

export interface RawSetLogEntry {
  exercise_name: string
  actual_weight_kg: number | string | null
  actual_reps: number | null
  rir_actual: number | null
  completed_at: string | null
}

/**
 * Estimate 1RM from a single set using Epley and/or Brzycki formulas.
 * @param weightKg - Actual weight lifted
 * @param reps - Reps completed
 * @param rirActual - Reps in reserve (0-10)
 * @returns Estimated 1RM in kg, rounded to 0.25kg
 */
export function estimateOneRM(
  weightKg: number,
  reps: number,
  rirActual: number = 0
): number {
  if (reps <= 0 || weightKg <= 0) return 0

  // Adjust for RIR: each RIR unit = ~2.5% of max
  const effectiveWeight =
    rirActual > 0 ? weightKg / (1 - Math.min(rirActual, 8) * 0.025) : weightKg

  const epley = effectiveWeight * (1 + reps / 30)

  // For high rep ranges, Brzycki becomes unstable; use Epley only
  if (reps > 12) {
    return Math.round(epley * 4) / 4 // round to 0.25kg
  }

  // For 1-12 reps, average Epley and Brzycki
  const brzycki = effectiveWeight / (1.0278 - 0.0278 * reps)
  const average = (epley + brzycki) / 2

  return Math.round(average * 4) / 4 // round to 0.25kg
}

/**
 * Find the best (highest) 1RM from a collection of sets.
 * @param sets - Array of sets with weight, reps, rir
 * @returns Highest estimated 1RM
 */
export function bestOneRM(sets: OneRMSet[]): number {
  if (sets.length === 0) return 0
  return Math.max(0, ...sets.map(s => estimateOneRM(s.weight, s.reps, s.rir)))
}

/**
 * Compute 1RM trends over 8 weeks for each exercise.
 *
 * Logic:
 * - Group sets by exercise name
 * - For each exercise: best 1RM from last 2 weeks (recent)
 * - Compare to best 1RM from 4-6 weeks ago (previous)
 * - Return sorted by percent change (descending)
 */
export function computeOneRMTrends(
  recentSets: RawSetLogEntry[],
  weeksBack: number = 8
): OneRMTrend[] {
  const now = new Date()
  const recent2w = new Date(now.getTime() - 14 * 24 * 3600 * 1000)
  const recent4w = new Date(now.getTime() - 28 * 24 * 3600 * 1000)
  const recent6w = new Date(now.getTime() - 42 * 24 * 3600 * 1000)

  // Group sets by exercise name
  const byExercise = new Map<string, RawSetLogEntry[]>()
  for (const s of recentSets) {
    if (!s.completed_at || !s.actual_weight_kg || s.actual_reps == null) continue
    const list = byExercise.get(s.exercise_name) ?? []
    list.push(s)
    byExercise.set(s.exercise_name, list)
  }

  const trends: OneRMTrend[] = []

  for (const [exercise, sets] of Array.from(byExercise.entries())) {
    // Filter recent sets (last 2 weeks)
    const recentSetsFiltered = sets.filter((s: RawSetLogEntry) => {
      const d = new Date(s.completed_at!)
      return d >= recent2w
    })

    // Filter older sets (4-6 weeks ago)
    const olderSets = sets.filter((s: RawSetLogEntry) => {
      const d = new Date(s.completed_at!)
      return d >= recent6w && d < recent4w
    })

    if (recentSetsFiltered.length === 0 || olderSets.length === 0) continue

    // Compute best 1RM for each period
    const recentSetsConverted: OneRMSet[] = recentSetsFiltered.map((s: RawSetLogEntry) => ({
      weight: Number(s.actual_weight_kg),
      reps: Number(s.actual_reps),
      rir: Number(s.rir_actual ?? 2),
    }))

    const olderSetsConverted: OneRMSet[] = olderSets.map((s: RawSetLogEntry) => ({
      weight: Number(s.actual_weight_kg),
      reps: Number(s.actual_reps),
      rir: Number(s.rir_actual ?? 2),
    }))

    const current = bestOneRM(recentSetsConverted)
    const previous = bestOneRM(olderSetsConverted)

    if (current === 0 || previous === 0) continue

    const delta = Math.round((current - previous) * 4) / 4
    const percentChange = Math.round((delta / previous) * 100)

    trends.push({
      exercise,
      current1RM: current,
      previous1RM: previous,
      delta,
      percentChange,
    })
  }

  // Sort by percent change descending
  return trends.sort((a, b) => b.percentChange - a.percentChange)
}
