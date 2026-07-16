type TrainingGoalProfile = 'hypertrophy' | 'strength' | 'endurance'

export interface HistoryEntryLike {
  weight: number | null
  reps: number | null
  rir?: number | null
  side?: string | null
  set_number?: number | null
  completed_at?: string | null
}

export interface HistoryReferenceSelection {
  weight: number
  reps: number
  rir: number | null
  completed_at: string | null
  quality: 'ideal' | 'acceptable'
}

export interface SelectHistoryReferenceInput<TEntry extends HistoryEntryLike> {
  entries: TEntry[]
  side: 'left' | 'right' | 'bilateral'
  setNumber: number
  plannedReps: number | null
  targetRir: number | null
  goal: string
}

function resolveGoalProfile(goal: string): TrainingGoalProfile {
  const normalized = goal.trim().toLowerCase()
  if (normalized.includes('strength') || normalized.includes('force')) return 'strength'
  if (normalized.includes('endurance') || normalized.includes('endur')) return 'endurance'
  return 'hypertrophy'
}

function getToleranceProfile(goal: TrainingGoalProfile) {
  switch (goal) {
    case 'strength':
      return {
        idealRepDiff: 1,
        maxRepDiff: 2,
        idealRirDiff: 1,
        maxRirDiff: 2,
        repWeight: 12,
        rirWeight: 10,
        sameSetBonus: 12,
      }
    case 'endurance':
      return {
        idealRepDiff: 3,
        maxRepDiff: 5,
        idealRirDiff: 1,
        maxRirDiff: 2,
        repWeight: 7,
        rirWeight: 12,
        sameSetBonus: 10,
      }
    case 'hypertrophy':
    default:
      return {
        idealRepDiff: 2,
        maxRepDiff: 3,
        idealRirDiff: 1,
        maxRirDiff: 1,
        repWeight: 8,
        rirWeight: 16,
        sameSetBonus: 12,
      }
  }
}

function toDaysAgo(completedAt: string | null | undefined): number {
  if (!completedAt) return 365
  const timestamp = Date.parse(completedAt)
  if (Number.isNaN(timestamp)) return 365
  return Math.max(0, (Date.now() - timestamp) / 86_400_000)
}

function estimatePerformance(entry: { weight: number; reps: number }, goal: TrainingGoalProfile): number {
  switch (goal) {
    case 'strength':
      return entry.weight * (1 + entry.reps / 30)
    case 'endurance':
      return entry.weight * entry.reps
    case 'hypertrophy':
    default:
      return entry.weight * entry.reps
  }
}

export function selectHistoryReference<TEntry extends HistoryEntryLike>({
  entries,
  side,
  setNumber,
  plannedReps,
  targetRir,
  goal,
}: SelectHistoryReferenceInput<TEntry>): HistoryReferenceSelection | null {
  const profile = resolveGoalProfile(goal)
  const tolerance = getToleranceProfile(profile)

  const candidates = entries
    .filter((entry) => {
      const sameSide = side === 'bilateral'
        ? (entry.side == null || entry.side === 'bilateral')
        : (entry.side === side || entry.side == null || entry.side === 'bilateral')

      if (!sameSide || entry.weight == null || entry.reps == null) return false

      const repsDiff = plannedReps == null ? 0 : Math.abs(entry.reps - plannedReps)
      if (plannedReps != null && repsDiff > tolerance.maxRepDiff) return false

      const hasComparableRir = targetRir != null && entry.rir != null
      if (hasComparableRir) {
        const rirDiff = Math.abs((entry.rir as number) - targetRir)
        if (rirDiff > tolerance.maxRirDiff) return false
      }

      return true
    })
    .map((entry) => {
      const reps = entry.reps as number
      const weight = entry.weight as number
      const rir = entry.rir ?? null
      const repsDiff = plannedReps == null ? 0 : Math.abs(reps - plannedReps)
      const rirDiff = targetRir == null || rir == null ? 0 : Math.abs(rir - targetRir)
      const sameSet = entry.set_number === setNumber
      const daysAgo = toDaysAgo(entry.completed_at)
      const quality =
        repsDiff <= tolerance.idealRepDiff &&
        (targetRir == null || rir == null || rirDiff <= tolerance.idealRirDiff)
          ? 'ideal'
          : 'acceptable'

      const score =
        repsDiff * tolerance.repWeight +
        rirDiff * tolerance.rirWeight +
        (sameSet ? -tolerance.sameSetBonus : 0) +
        Math.min(daysAgo, 84) / 7

      return {
        entry,
        score,
        quality,
        performance: estimatePerformance({ weight, reps }, profile),
      }
    })
    .sort((left, right) => {
      if (left.score !== right.score) return left.score - right.score
      if (left.quality !== right.quality) return left.quality === 'ideal' ? -1 : 1
      if (left.performance !== right.performance) return right.performance - left.performance
      return toDaysAgo(left.entry.completed_at) - toDaysAgo(right.entry.completed_at)
    })

  const best = candidates[0]
  if (!best || best.entry.weight == null || best.entry.reps == null) return null

  return {
    weight: best.entry.weight,
    reps: best.entry.reps,
    rir: best.entry.rir ?? null,
    completed_at: best.entry.completed_at ?? null,
    quality: best.quality,
  }
}
