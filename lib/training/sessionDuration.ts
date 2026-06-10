import { parseRepsRange } from '@/lib/progression/double-progression'
import { calcTUT, getDefaultTempo, parseTempo } from '@/lib/training/tempo'

export type SessionDurationExercise = {
  name?: string | null
  sets?: number | null
  reps?: string | null
  rep_min?: number | null
  rep_max?: number | null
  rest_sec?: number | null
  tempo?: string | null
  movement_pattern?: string | null
  is_unilateral?: boolean | null
  is_compound?: boolean | null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function inferCompound(exercise: SessionDurationExercise): boolean {
  if (typeof exercise.is_compound === 'boolean') return exercise.is_compound
  const label = `${exercise.name ?? ''} ${exercise.movement_pattern ?? ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return /squat|hinge|push|pull|row|press|deadlift|lunge|split|thrust|dip|traction|tirage|developpe|presse/.test(label)
}

function resolveTargetReps(exercise: SessionDurationExercise): number {
  if (typeof exercise.rep_min === 'number' && typeof exercise.rep_max === 'number') {
    return Math.round((exercise.rep_min + exercise.rep_max) / 2)
  }

  const parsed = parseRepsRange(exercise.reps ?? '')
  if (parsed) {
    return Math.round((parsed.rep_min + parsed.rep_max) / 2)
  }

  if (typeof exercise.rep_min === 'number' && exercise.rep_min > 0) return exercise.rep_min
  if (typeof exercise.rep_max === 'number' && exercise.rep_max > 0) return exercise.rep_max
  return 10
}

function estimateWorkingRoundSec(exercise: SessionDurationExercise, goal: string): number {
  const reps = resolveTargetReps(exercise)
  const parsedTempo = parseTempo(exercise.tempo ?? getDefaultTempo(exercise.movement_pattern ?? null, goal))
  const tutSec = parsedTempo ? calcTUT(parsedTempo, reps) : reps * 4
  const compound = inferCompound(exercise)
  const unilateral = exercise.is_unilateral === true
  const setupBuffer = compound ? 18 : 12
  const stabilizationBuffer = unilateral ? 12 : 0
  return clamp(Math.round(tutSec + setupBuffer + stabilizationBuffer), 35, 95)
}

function estimateWarmupSec(exercise: SessionDurationExercise, isFirstExercise: boolean): number {
  const compound = inferCompound(exercise)
  if (!compound) return isFirstExercise ? 120 : 45
  return isFirstExercise ? 300 : 135
}

export function estimateSessionDurationMin(
  exercises: SessionDurationExercise[],
  goal: string,
): number {
  if (!Array.isArray(exercises) || exercises.length === 0) return 0

  let totalSec = 300

  exercises.forEach((exercise, index) => {
    const sets = Math.max(1, Number(exercise.sets ?? 3))
    const restSec = clamp(Number(exercise.rest_sec ?? 90), 45, 240)
    const unilateral = exercise.is_unilateral === true
    const roundSec = estimateWorkingRoundSec(exercise, goal)
    const perSetWorkSec = unilateral ? roundSec * 2 + 15 : roundSec
    const transitionSec = index === 0 ? 0 : 75

    totalSec += transitionSec
    totalSec += estimateWarmupSec(exercise, index === 0)
    totalSec += sets * perSetWorkSec
    totalSec += Math.max(0, sets - 1) * (restSec + 15)
  })

  const estimatedMin = Math.round(totalSec / 60)
  return Math.max(25, estimatedMin)
}

export function estimateProgramAverageDurationMin(
  sessions: Array<{ program_exercises?: SessionDurationExercise[] | null }>,
  goal: string,
): number | null {
  const estimates = sessions
    .map((session) => estimateSessionDurationMin(session.program_exercises ?? [], goal))
    .filter((value) => value > 0)

  if (estimates.length === 0) return null
  return Math.round(estimates.reduce((sum, value) => sum + value, 0) / estimates.length)
}
