export type PerformanceSet = {
  exerciseId: string | null
  exerciseName: string | null
  weightKg: number | null
  reps: number | null
}

export type PersonalRecord = Required<PerformanceSet>

export function weekStartFromDateKey(dateKey: string, weekday: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`)
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1
  date.setUTCDate(date.getUTCDate() - daysSinceMonday)
  return date.toISOString().slice(0, 10)
}

export function hasReachedWeeklyGoal(completedSessions: number, targetSessions: number | null): boolean {
  return Number.isInteger(targetSessions)
    && targetSessions !== null
    && targetSessions > 0
    && completedSessions >= targetSessions
}

export function isWeeklyGoalAtRisk(
  completedSessions: number,
  targetSessions: number | null,
): boolean {
  return Number.isInteger(targetSessions)
    && targetSessions !== null
    && targetSessions > 0
    && completedSessions < targetSessions
}

export function findPersonalRecord(
  currentSets: PerformanceSet[],
  historicSets: PerformanceSet[],
): PersonalRecord | null {
  const records = currentSets
    .filter(isUsablePerformanceSet)
    .filter((current) => {
      const previous = historicSets
        .filter(isUsablePerformanceSet)
        .filter((historic) => sameExercise(historic, current))

      return previous.length > 0 && previous.every(
        (historic) => isBetterPerformance(current, historic),
      )
    })
    .sort(comparePerformance)

  return records[0] ?? null
}

function isUsablePerformanceSet(
  set: PerformanceSet,
): set is PersonalRecord {
  return Boolean(
    (set.exerciseId || set.exerciseName)
    && Number.isFinite(set.weightKg)
    && Number.isFinite(set.reps)
    && Number(set.weightKg) > 0
    && Number(set.reps) > 0,
  )
}

function sameExercise(left: PersonalRecord, right: PersonalRecord): boolean {
  return left.exerciseId && right.exerciseId
    ? left.exerciseId === right.exerciseId
    : left.exerciseName.trim().toLocaleLowerCase() === right.exerciseName.trim().toLocaleLowerCase()
}

function comparePerformance(left: PersonalRecord, right: PersonalRecord): number {
  if (left.weightKg !== right.weightKg) return right.weightKg - left.weightKg
  return right.reps - left.reps
}

function isBetterPerformance(left: PersonalRecord, right: PersonalRecord): boolean {
  return left.weightKg > right.weightKg
    || (left.weightKg === right.weightKg && left.reps > right.reps)
}
