/** Profil athlète et phase active pour le moteur d'optimisation de phase. */

import { resolveProtocolDayByDate } from '@/lib/nutrition/protocol-schedule'
import type { NutritionProtocolDay } from '@/lib/nutrition/types'
import {
  resolveTransformationPhase,
  transformationPhaseToFamily,
  type TransformationPhase,
} from '@/lib/coach/transformationPhase'
import type {
  CurrentPhase,
  CyclicProtocolMode,
  ExperienceLevel,
  PhaseClientProfile,
} from './types'

export type { ExperienceLevel, CurrentPhase, CyclicProtocolMode, PhaseClientProfile }

const COMPOUND_NAME_HINTS = [
  'squat',
  'deadlift',
  'soulevé',
  'hip thrust',
  'bench',
  'développé',
  'developpe',
  'row',
  'rowing',
  'traction',
  'pull-up',
  'pull up',
  'overhead',
  'military',
  'presse',
]

export function mapFitnessToExperienceLevel(
  fitnessLevel: string | null | undefined,
): ExperienceLevel {
  const v = (fitnessLevel ?? '').toLowerCase()
  if (v === 'advanced' || v === 'elite') return 'advanced'
  if (v === 'intermediate') return 'intermediate'
  return 'beginner'
}

export function trainingGoalToPhase(trainingGoal: string | null | undefined): CurrentPhase {
  const g = (trainingGoal ?? '').toLowerCase()
  if (g === 'fat_loss' || g === 'weight_loss' || g === 'cut') return 'cut'
  if (g === 'hypertrophy' || g === 'muscle_gain' || g === 'bulk') return 'bulk'
  if (g === 'maintenance') return 'maintenance'
  if (g === 'recomp' || g === 'athletic' || g === 'strength' || g === 'endurance') return 'recomp'
  return 'recomp'
}

export function carbCycleTypeToMode(
  carbCycleType: string | null | undefined,
): CyclicProtocolMode | null {
  if (!carbCycleType) return null
  const t = carbCycleType.toLowerCase()
  if (t === 'low') return 'deficit'
  if (t === 'high') return 'surplus'
  if (t === 'medium') return 'maintenance'
  return null
}

export function deriveCurrentPhase(input: {
  transformationPhase?: TransformationPhase | string | null
  trainingGoal: string | null | undefined
  cyclicProtocolMode: CyclicProtocolMode | null
}): CurrentPhase {
  if (input.cyclicProtocolMode === 'deficit') return 'cut'
  if (input.cyclicProtocolMode === 'surplus') return 'bulk'
  if (input.cyclicProtocolMode === 'maintenance') return 'maintenance'
  const resolvedPhase = resolveTransformationPhase({
    transformationPhase: input.transformationPhase,
    trainingGoal: input.trainingGoal,
  })
  return transformationPhaseToFamily(resolvedPhase)
}

export function resolveCyclicProtocolForToday(
  protocol: {
    schedule_start_date?: string | null
    nutrition_protocol_days?: Pick<NutritionProtocolDay, 'position' | 'carb_cycle_type'>[]
    nutrition_protocol_schedule_slots?: {
      week_index: number
      dow: number
      protocol_day_position: number
    }[]
  } | null,
  dateIso = new Date().toISOString().slice(0, 10),
): CyclicProtocolMode | null {
  if (!protocol?.nutrition_protocol_days?.length) return null
  const day = resolveProtocolDayByDate(
    dateIso,
    protocol.schedule_start_date,
    protocol.nutrition_protocol_days,
    protocol.nutrition_protocol_schedule_slots ?? [],
  )
  return carbCycleTypeToMode(day?.carb_cycle_type ?? null)
}

export function buildPhaseClientProfile(input: {
  fitnessLevel: string | null | undefined
  transformationPhase?: TransformationPhase | string | null
  trainingGoal: string | null | undefined
  cyclicProtocolMode: CyclicProtocolMode | null
}): PhaseClientProfile {
  return {
    experienceLevel: mapFitnessToExperienceLevel(input.fitnessLevel),
    currentPhase: deriveCurrentPhase({
      transformationPhase: input.transformationPhase,
      trainingGoal: input.trainingGoal,
      cyclicProtocolMode: input.cyclicProtocolMode,
    }),
    cyclicProtocolMode: input.cyclicProtocolMode,
  }
}

/** Phase active ou protocole cyclique en déficit → zone optimale à gauche. */
export function shouldAnchorOptimalZoneInDeficit(profile: PhaseClientProfile): boolean {
  if (profile.currentPhase === 'cut') return true
  if (profile.cyclicProtocolMode === 'deficit') return true
  return false
}

export function isLikelyCompoundExercise(exerciseName: string): boolean {
  const n = exerciseName.toLowerCase()
  return COMPOUND_NAME_HINTS.some(h => n.includes(h))
}

/** Réduit le poids du subjectif (check-in) quand la progression objective est forte. */
export function progressionFatigueDampener(input: {
  experienceLevel: ExperienceLevel
  overloadEventCount: number
  compoundOneRmImproving: boolean
  recentPrDetected: boolean
}): number {
  let dampen = 0
  if (input.overloadEventCount >= 2) dampen += 0.22
  else if (input.overloadEventCount >= 1) dampen += 0.12
  if (input.compoundOneRmImproving) dampen += 0.18
  if (input.recentPrDetected) dampen += 0.12
  if (input.experienceLevel === 'advanced') dampen += 0.08
  else if (input.experienceLevel === 'intermediate') dampen += 0.04
  return Math.min(0.55, dampen)
}
