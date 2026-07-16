import { normalizeSetPrescriptions } from '@/lib/programs/setPrescriptions'
import type { ProgramCompletionBehavior } from '@/lib/programs/cycleSchedule'
import type { ProgramWeekType } from '@/lib/programs/programWeeks'

export const MESOCYCLE_ENGINE_VERSION = 'mesocycle-v1'

export type MesocycleProgressionMode = 'stable' | 'linear'

export interface MesocycleConfig {
  version: typeof MESOCYCLE_ENGINE_VERSION
  sourceWeekIds: string[]
  outputWeekCount: number
  volume: {
    mode: MesocycleProgressionMode
    startPercent: number
    endPercent: number
  }
  rir: {
    mode: MesocycleProgressionMode
    start: number
    end: number
  }
  deload: {
    enabled: boolean
    volumePercent: number
    rir: number
  }
  safety: {
    minSetsPerExercise: number
    maxSetsPerExercise: number
  }
  completionBehavior: ProgramCompletionBehavior
}

export interface MesocycleSourceWeek {
  id: string
  label: string
  sessionCount: number
  exerciseCount: number
  totalSets: number
}

export interface MesocycleWeekPlan {
  position: number
  label: string
  weekType: ProgramWeekType
  sourceWeekId: string
  sourceWeekLabel: string
  volumePercent: number
  targetRir: number
  sessionCount: number
  exerciseCount: number
  sourceTotalSets: number
  projectedTotalSets: number
}

export interface MesocyclePreview {
  engineVersion: typeof MESOCYCLE_ENGINE_VERSION
  outputWeekCount: number
  sourceWeekCount: number
  replacesExistingCycle: boolean
  weeks: MesocycleWeekPlan[]
}

type MesocycleExercise = Record<string, unknown> & {
  sets?: number | null
  reps?: string | null
  rest_sec?: number | null
  rir?: number | null
  target_rir?: number | null
  tempo?: string | null
  superset_rest_mode?: 'after_exercise' | 'after_round' | null
  execution_type?: string | null
  set_prescriptions?: unknown
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function interpolate(start: number, end: number, index: number, count: number): number {
  if (count <= 1) return start
  return start + ((end - start) * index) / (count - 1)
}

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2
}

export function adjustMesocycleSets(
  sourceSets: number,
  volumePercent: number,
  safety: MesocycleConfig['safety'],
): number {
  if (sourceSets <= 0) return 0
  return clamp(
    Math.round(sourceSets * (volumePercent / 100)),
    safety.minSetsPerExercise,
    safety.maxSetsPerExercise,
  )
}

export function applyMesocycleExercisePatch<T extends MesocycleExercise>(
  exercise: T,
  week: Pick<MesocycleWeekPlan, 'volumePercent' | 'targetRir'>,
  safety: MesocycleConfig['safety'],
): T {
  if ((exercise.execution_type ?? 'reps_rir') !== 'reps_rir') return { ...exercise }

  const sourceSets = Number(exercise.sets ?? 0)
  const sets = adjustMesocycleSets(sourceSets, week.volumePercent, safety)
  const targetRir = clamp(roundToHalf(week.targetRir), 0, 5)
  const prescriptions = sets <= 0
    ? []
    : normalizeSetPrescriptions(exercise.set_prescriptions, {
        sets,
        reps: exercise.reps || '',
        rest_sec: exercise.rest_sec ?? null,
        rir: targetRir,
        tempo: exercise.tempo ?? null,
        superset_rest_mode: exercise.superset_rest_mode ?? null,
      }).map((prescription) => ({ ...prescription, rir: targetRir }))

  return {
    ...exercise,
    sets,
    rir: targetRir,
    target_rir: targetRir,
    set_prescriptions: prescriptions,
  }
}

export function buildMesocyclePreview(
  config: MesocycleConfig,
  sourceWeeks: MesocycleSourceWeek[],
): MesocyclePreview {
  if (config.version !== MESOCYCLE_ENGINE_VERSION) {
    throw new Error('Version du moteur de mésocycle non prise en charge')
  }
  if (sourceWeeks.length === 0) {
    throw new Error('Sélectionnez au moins une semaine source')
  }
  if (config.outputWeekCount < 2 || config.outputWeekCount > 12) {
    throw new Error('Un mésocycle doit contenir entre 2 et 12 semaines')
  }
  if (config.safety.minSetsPerExercise > config.safety.maxSetsPerExercise) {
    throw new Error('La limite minimale de séries dépasse la limite maximale')
  }

  const buildWeekCount = config.deload.enabled
    ? config.outputWeekCount - 1
    : config.outputWeekCount

  const weeks = Array.from({ length: config.outputWeekCount }, (_, position) => {
    const source = sourceWeeks[position % sourceWeeks.length]
    const isDeload = config.deload.enabled && position === config.outputWeekCount - 1
    const buildPosition = Math.min(position, Math.max(0, buildWeekCount - 1))
    const volumePercent = isDeload
      ? config.deload.volumePercent
      : config.volume.mode === 'stable'
        ? config.volume.startPercent
        : Math.round(interpolate(
            config.volume.startPercent,
            config.volume.endPercent,
            buildPosition,
            buildWeekCount,
          ))
    const targetRir = isDeload
      ? config.deload.rir
      : config.rir.mode === 'stable'
        ? config.rir.start
        : roundToHalf(interpolate(
            config.rir.start,
            config.rir.end,
            buildPosition,
            buildWeekCount,
          ))
    const projectedTotalSets = source.totalSets <= 0
      ? 0
      : Math.round(source.totalSets * (volumePercent / 100))
    const isLastBuildWeek = !isDeload && buildPosition === buildWeekCount - 1
    const weekType: ProgramWeekType = isDeload
      ? 'deload'
      : position === 0
        ? 'base'
        : isLastBuildWeek
          ? 'overload'
          : 'build'

    return {
      position,
      label: `Semaine ${position + 1}`,
      weekType,
      sourceWeekId: source.id,
      sourceWeekLabel: source.label,
      volumePercent,
      targetRir: clamp(targetRir, 0, 5),
      sessionCount: source.sessionCount,
      exerciseCount: source.exerciseCount,
      sourceTotalSets: source.totalSets,
      projectedTotalSets,
    }
  })

  return {
    engineVersion: MESOCYCLE_ENGINE_VERSION,
    outputWeekCount: config.outputWeekCount,
    sourceWeekCount: sourceWeeks.length,
    replacesExistingCycle: true,
    weeks,
  }
}
