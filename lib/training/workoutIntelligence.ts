import { getGoalRepRange, normalizeWeightIncrement, recommendNextSet, type SetRecommendation } from '@/lib/training/setRecommendation'
import { selectHistoryReference, type HistoryReferenceSelection } from '@/lib/training/historyReference'
import { getExerciseHistoryEntries } from '@/lib/training/exerciseHistoryKey'

export type WorkoutSetType = 'warmup' | 'working' | 'cooldown' | 'dropset'
export type WorkoutSetSide = 'left' | 'right' | 'bilateral'

export interface WorkoutSetSnapshot {
  exercise_id: string
  exercise_name: string
  set_number: number
  side: WorkoutSetSide
  set_type: WorkoutSetType
  planned_reps: string
  actual_reps: string
  actual_weight_kg: string
  completed: boolean
  rir_actual: string
}

export interface WorkoutExerciseSnapshot {
  id: string
  name: string
  reps?: string | null
  rep_min?: number | null
  rep_max?: number | null
  rir?: number | null
  target_rir?: number | null
  weight_increment_kg?: number | null
}

export interface WorkoutHistoryEntry {
  weight: number | null
  reps: number | null
  rir?: number | null
  side?: string | null
  set_number?: number | null
  completed_at?: string | null
}

export type WorkoutHistoryIndex = Record<string, WorkoutHistoryEntry[]>

export function formatWorkoutWeight(kg: number): string {
  const snapped = Math.round(kg * 4) / 4
  return parseFloat(snapped.toFixed(2)).toString()
}

export function workoutSetKey(exerciseId: string, setNumber: number, side: string): string {
  return `${exerciseId}_set${setNumber}_${side}`
}

export function averagePlannedReps(value: string): number | null {
  const normalized = value.trim()
  if (!normalized) return null
  const rangeMatch = normalized.match(/^(\d+)\s*[-–]\s*(\d+)$/)
  if (rangeMatch) {
    const min = Number(rangeMatch[1])
    const max = Number(rangeMatch[2])
    if (Number.isFinite(min) && Number.isFinite(max) && max >= min) {
      return Math.round((min + max) / 2)
    }
  }
  const singleValue = Number.parseInt(normalized, 10)
  return Number.isFinite(singleValue) ? singleValue : null
}

export function resolveWorkoutRepRange({
  goal,
  exercise,
}: {
  goal: string
  exercise?: WorkoutExerciseSnapshot | null
}): { repMin: number; repMax: number } {
  const goalRange = getGoalRepRange(goal)
  return {
    repMin: exercise?.rep_min ?? goalRange.min,
    repMax: exercise?.rep_max ?? goalRange.max,
  }
}

export function getWorkoutCoachingCue({
  rir,
  setNumber,
  totalSets,
  isLastSet,
  setType,
  prescribedRir,
  t,
}: {
  rir: number | null
  setNumber: number
  totalSets: number
  isLastSet: boolean
  setType: WorkoutSetType
  prescribedRir: number | null
  t: (key: string) => string
}): string | null {
  if (rir === null) return null
  if (setType === 'warmup' || setType === 'cooldown') return null
  if (rir === 0) return isLastSet ? t('logger.coaching.maxLast') : t('logger.coaching.failure')
  if (rir <= 1 && isLastSet) return t('logger.coaching.perfect')
  if (rir <= 2) return t('logger.coaching.good')
  if (rir >= 5 && setNumber < totalSets && (prescribedRir === null || rir > prescribedRir + 1)) {
    return t('logger.coaching.tooEasy')
  }
  if (rir >= 4 && isLastSet) return t('logger.coaching.comfortable')
  return null
}

export function selectWorkoutHistoryReference({
  historyIndex,
  set,
  targetRir,
  goal,
}: {
  historyIndex: WorkoutHistoryIndex
  set: WorkoutSetSnapshot
  targetRir: number | null
  goal: string
}): HistoryReferenceSelection | null {
  return selectHistoryReference({
    entries: getExerciseHistoryEntries(historyIndex, set.exercise_name),
    side: set.side,
    setNumber: set.set_number,
    plannedReps: averagePlannedReps(set.planned_reps),
    targetRir,
    goal,
  })
}

export function buildWorkoutHistoryReferences({
  sets,
  exercises,
  historyIndex,
  goal,
  resolveTargetRir,
}: {
  sets: WorkoutSetSnapshot[]
  exercises: WorkoutExerciseSnapshot[]
  historyIndex: WorkoutHistoryIndex
  goal: string
  resolveTargetRir: (exercise: WorkoutExerciseSnapshot, setNumber: number) => number | null
}): Record<string, HistoryReferenceSelection | null> {
  const map: Record<string, HistoryReferenceSelection | null> = {}
  for (const set of sets) {
    const exercise = exercises.find((entry) => entry.id === set.exercise_id)
    if (!exercise) continue
    map[workoutSetKey(set.exercise_id, set.set_number, set.side)] = selectWorkoutHistoryReference({
      historyIndex,
      set,
      targetRir: resolveTargetRir(exercise, set.set_number),
      goal,
    })
  }
  return map
}

export function buildWorkoutCoachingCues({
  sets,
  exercises,
  resolveTargetRir,
  t,
}: {
  sets: WorkoutSetSnapshot[]
  exercises: WorkoutExerciseSnapshot[]
  resolveTargetRir: (exercise: WorkoutExerciseSnapshot, setNumber: number) => number | null
  t: (key: string) => string
}): Record<string, string | null> {
  const map: Record<string, string | null> = {}
  for (const set of sets) {
    if (!set.completed) continue
    const key = workoutSetKey(set.exercise_id, set.set_number, set.side)
    const exerciseSets = sets.filter((entry) => entry.exercise_id === set.exercise_id && entry.side === set.side)
    const totalSets = exerciseSets.length
    const isLastSet = set.set_number === Math.max(...exerciseSets.map((entry) => entry.set_number))
    const rir = set.rir_actual !== '' ? Number.parseInt(set.rir_actual, 10) : null
    const exercise = exercises.find((entry) => entry.id === set.exercise_id)
    map[key] = getWorkoutCoachingCue({
      rir: Number.isNaN(rir) ? null : rir,
      setNumber: set.set_number,
      totalSets,
      isLastSet,
      setType: set.set_type,
      prescribedRir: exercise ? resolveTargetRir(exercise, set.set_number) : null,
      t,
    })
  }
  return map
}

export function recommendFollowingWorkoutSet({
  completedSet,
  sets,
  exercises,
  historyIndex,
  goal,
  level,
  manuallyEdited,
  resolveTargetRir,
}: {
  completedSet: WorkoutSetSnapshot
  sets: WorkoutSetSnapshot[]
  exercises: WorkoutExerciseSnapshot[]
  historyIndex: WorkoutHistoryIndex
  goal: string
  level: string
  manuallyEdited: Set<string>
  resolveTargetRir: (exercise: WorkoutExerciseSnapshot, setNumber: number) => number | null
}): { nextKey: string; nextSet: WorkoutSetSnapshot; recommendation: SetRecommendation } | null {
  const reps = Number.parseInt(completedSet.actual_reps, 10)
  const weight = Number.parseFloat(completedSet.actual_weight_kg)
  const rir = Number.parseInt(completedSet.rir_actual, 10)
  if (!Number.isFinite(reps) || !Number.isFinite(weight) || !Number.isFinite(rir)) return null
  if (completedSet.set_type !== 'working') return null

  const exerciseSets = sets.filter((entry) => entry.exercise_id === completedSet.exercise_id && entry.side === completedSet.side)
  const currentIndex = exerciseSets.findIndex((entry) => entry.set_number === completedSet.set_number)
  if (currentIndex === -1 || currentIndex >= exerciseSets.length - 1) return null

  const nextSet = exerciseSets[currentIndex + 1]
  if (nextSet.set_type !== 'working') return null

  const nextKey = workoutSetKey(completedSet.exercise_id, nextSet.set_number, completedSet.side)
  if (manuallyEdited.has(nextKey)) return null

  const exercise = exercises.find((entry) => entry.id === completedSet.exercise_id)
  const historyEntry = selectWorkoutHistoryReference({
    historyIndex,
    set: nextSet,
    targetRir: exercise ? resolveTargetRir(exercise, nextSet.set_number) : null,
    goal,
  })
  const { repMin, repMax } = resolveWorkoutRepRange({ goal, exercise })
  const plannedReps = Number.parseInt(nextSet.planned_reps, 10)
    || averagePlannedReps(nextSet.planned_reps)
    || Math.round((repMin + repMax) / 2)
  const recommendation = recommendNextSet({
    actual_weight_kg: weight,
    actual_reps: reps,
    rir_actual: rir,
    goal,
    level,
    planned_reps: plannedReps,
    set_number: nextSet.set_number,
    rep_min: repMin,
    rep_max: repMax,
    target_rir: exercise ? (resolveTargetRir(exercise, nextSet.set_number) ?? undefined) : undefined,
    weight_increment_kg: normalizeWeightIncrement(exercise?.weight_increment_kg ?? 2.5),
    lastWeek: historyEntry
      ? { weight_kg: historyEntry.weight, reps: historyEntry.reps, rir_actual: historyEntry.rir ?? 2 }
      : undefined,
    prev_set_weight_kg: weight,
  })

  if (!recommendation) return null
  return { nextKey, nextSet, recommendation }
}
