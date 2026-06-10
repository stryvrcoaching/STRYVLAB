/** Mapping scores moteur (−1…1) → coordonnées du cadran SVG. */

import { shouldAnchorOptimalZoneInDeficit } from './clientProfile'
import type { AdaptiveState, EnergeticDirection, PhaseClientProfile } from './types'

export interface PlotLayout {
  width: number
  height: number
  padding: number
}

export interface OptimalZoneTarget {
  directionScore: number
  adaptiveScore: number
}

export interface OptimalZoneContext {
  trainingGoal: string | null | undefined
  clientProfile: PhaseClientProfile
  recommendedDirection: EnergeticDirection
  recommendedAdaptiveState: AdaptiveState
  recommendedDirectionScore: number
  recommendedAdaptiveScore: number
}

function clamp(v: number, min = -1, max = 1): number {
  return Math.max(min, Math.min(max, v))
}

export function plotInnerSize(layout: PlotLayout): { width: number; height: number } {
  return {
    width: layout.width - layout.padding * 2,
    height: layout.height - layout.padding * 2,
  }
}

/** X : directionScore −1 (déficit) → gauche, +1 (surplus) → droite. */
export function scoreToPlotX(directionScore: number, layout: PlotLayout): number {
  const clamped = clamp(directionScore)
  const { width: innerW } = plotInnerSize(layout)
  return layout.padding + ((clamped + 1) / 2) * innerW
}

/** Y : adaptiveScore +1 (supercompensé) → haut, −1 (fatigue) → bas. */
export function scoreToPlotY(adaptiveScore: number, layout: PlotLayout): number {
  const clamped = clamp(adaptiveScore)
  const { height: innerH } = plotInnerSize(layout)
  const midY = layout.height / 2
  return midY - clamped * (innerH / 2)
}

function normalizeTrainingGoal(raw: string | null | undefined): string {
  if (!raw) return 'recomp'
  const g = raw.toLowerCase().trim()
  if (g === 'fat_loss' || g === 'weight_loss' || g === 'cut' || g.includes('fat')) return 'fat_loss'
  if (g === 'hypertrophy' || g === 'muscle_gain') return 'hypertrophy'
  if (g === 'strength') return 'strength'
  if (g === 'endurance') return 'endurance'
  if (g === 'maintenance') return 'maintenance'
  if (g === 'athletic') return 'athletic'
  return g
}

/** Cible stratégique pure selon l'objectif protocole (training_goal). */
function strategicTargetForGoal(goal: string): OptimalZoneTarget {
  switch (goal) {
    case 'fat_loss':
      return { directionScore: -0.48, adaptiveScore: 0.02 }
    case 'hypertrophy':
      return { directionScore: 0.42, adaptiveScore: 0.12 }
    case 'strength':
      return { directionScore: 0.05, adaptiveScore: 0.1 }
    case 'endurance':
      return { directionScore: -0.1, adaptiveScore: 0.08 }
    case 'maintenance':
      return { directionScore: 0, adaptiveScore: 0.05 }
    case 'athletic':
      return { directionScore: 0.15, adaptiveScore: 0.12 }
    case 'recomp':
    default:
      return { directionScore: -0.2, adaptiveScore: 0.08 }
  }
}

function directionScoreFromEnergeticDirection(direction: EnergeticDirection): number {
  switch (direction) {
    case 'aggressive_deficit':
      return -0.62
    case 'controlled_deficit':
      return -0.35
    case 'maintenance':
      return 0
    case 'controlled_surplus':
      return 0.35
    case 'aggressive_surplus':
      return 0.62
    default:
      return 0
  }
}

function adaptiveScoreFromState(state: AdaptiveState): number {
  switch (state) {
    case 'recovery_crash':
      return -0.85
    case 'systemic_fatigue':
      return -0.55
    case 'high_fatigue':
      return -0.25
    case 'stable':
      return 0.05
    case 'recovered':
      return 0.25
    case 'supercompensated':
      return 0.55
    default:
      return 0
  }
}

/**
 * Centre de la zone optimale : ancrage stratégique (objectif) + contraintes moteur.
 * Évite une ellipse en surplus/supercompensé quand le client est en déficit (fat_loss).
 */
function strategicTargetForPhase(profile: PhaseClientProfile, fallbackGoal: string): OptimalZoneTarget {
  switch (profile.currentPhase) {
    case 'cut':
      return { directionScore: -0.48, adaptiveScore: 0.02 }
    case 'bulk':
      return { directionScore: 0.4, adaptiveScore: 0.12 }
    case 'maintenance':
      return { directionScore: 0, adaptiveScore: 0.05 }
    case 'recomp':
    default:
      return strategicTargetForGoal(fallbackGoal)
  }
}

export function optimalZoneCenterFromContext(ctx: OptimalZoneContext): OptimalZoneTarget {
  const goal = normalizeTrainingGoal(ctx.trainingGoal)
  const strategic = strategicTargetForPhase(ctx.clientProfile, goal)
  const deficitAnchor = shouldAnchorOptimalZoneInDeficit(ctx.clientProfile)

  const recoveryStates: AdaptiveState[] = ['recovery_crash', 'systemic_fatigue']
  if (recoveryStates.includes(ctx.recommendedAdaptiveState)) {
    return {
      directionScore: deficitAnchor ? -0.12 : 0,
      adaptiveScore: -0.3,
    }
  }

  if (ctx.recommendedDirection === 'maintenance' && ctx.recommendedAdaptiveState !== 'recovered') {
    let directionScore = clamp(ctx.recommendedDirectionScore, -0.15, 0.15)
    let adaptiveScore = Math.min(ctx.recommendedAdaptiveScore, 0)
    if (deficitAnchor) {
      directionScore = Math.min(directionScore, -0.28)
      adaptiveScore = Math.min(adaptiveScore, 0.12)
    }
    return {
      directionScore: clamp(directionScore),
      adaptiveScore: clamp(adaptiveScore),
    }
  }

  const recDir = directionScoreFromEnergeticDirection(ctx.recommendedDirection)
  const recAdapt = adaptiveScoreFromState(ctx.recommendedAdaptiveState)

  const blend = 0.35
  let directionScore =
    strategic.directionScore * (1 - blend) +
    recDir * blend * 0.6 +
    ctx.recommendedDirectionScore * blend * 0.4

  let adaptiveScore =
    strategic.adaptiveScore * (1 - blend) +
    recAdapt * blend * 0.6 +
    ctx.recommendedAdaptiveScore * blend * 0.4

  if (deficitAnchor) {
    const deficitDirections: EnergeticDirection[] = ['aggressive_deficit', 'controlled_deficit']
    if (deficitDirections.includes(ctx.recommendedDirection)) {
      directionScore = Math.min(directionScore, -0.32)
    } else {
      directionScore = Math.min(directionScore, -0.22)
    }
    adaptiveScore = Math.min(adaptiveScore, 0.12)
  } else if (goal === 'fat_loss') {
    directionScore = Math.min(directionScore, -0.28)
    adaptiveScore = Math.min(adaptiveScore, 0.15)
  }

  if (!deficitAnchor && (goal === 'hypertrophy' || goal === 'strength' || ctx.clientProfile.currentPhase === 'bulk')) {
    directionScore = Math.max(directionScore, 0.12)
  }

  return {
    directionScore: clamp(directionScore),
    adaptiveScore: clamp(adaptiveScore),
  }
}

/** @deprecated Préférer optimalZoneCenterFromContext */
export function optimalZoneCenterFromTrainingGoal(
  trainingGoal: string | null | undefined,
): OptimalZoneTarget {
  return strategicTargetForGoal(normalizeTrainingGoal(trainingGoal))
}
