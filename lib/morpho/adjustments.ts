// lib/morpho/adjustments.ts

import type { PosturalSyndrome, BiomechProfile } from './types'

export interface MorphoForAdjustment {
  asymmetries?: {
    arm_diff_cm?: number
    leg_diff_cm?: number
    shoulder_imbalance_cm?: number
    hip_imbalance_cm?: number
  }
  dimensions?: {
    arm_cm_l?: number
    arm_cm_r?: number
    leg_cm_l?: number
    leg_cm_r?: number
  }
  body_fat_pct?: number
  // v2 additions
  biomech?: Pick<BiomechProfile, 'segments' | 'postural_syndromes' | 'chain_assessment'>
}

export interface CoachClientMeta {
  height_cm?: number
}

export const MOVEMENT_PATTERNS = [
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hinge',
  'carry',
  'core_anti_flex',
  'unilateral_push',
  'unilateral_pull',
] as const

export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number]

function getSyndrome(syndromes: PosturalSyndrome[] | undefined, name: PosturalSyndrome['name']) {
  return syndromes?.find(s => s.name === name)
}

/**
 * Calculates stimulus adjustment coefficients based on morphological data.
 * Returns adjustment multipliers (0.8–1.2 range) for each movement pattern.
 *
 * v1 rules:
 * - Arm asymmetry >2cm: boost unilateral patterns (1.15)
 * - Shoulder imbalance >2cm: reduce horizontal push (0.90), boost horizontal pull (1.10)
 * - Long arms (>0.40 ratio): boost vertical pull (1.12), horizontal pull (1.05)
 * - Short arms (<0.36 ratio): boost horizontal push (1.10), vertical push (1.08)
 *
 * v2 rules (active when biomech present):
 * - trunk_to_femur <0.9: squat ×0.92
 * - trunk_to_femur >1.1: squat ×1.05
 * - arm_to_torso >1.05: hinge ×1.10
 * - upper_crossed moderate/marked: vertical_push ×0.85, horizontal_pull ×1.15
 * - lower_crossed moderate/marked: core_anti_flex ×1.15, hinge ×0.90
 * - posterior_chain underdeveloped: hinge ×1.10
 */
export function calculateStimulusAdjustments(
  morpho: MorphoForAdjustment,
  clientMeta: CoachClientMeta
): Record<string, number> {
  const adjustments: Record<string, number> = {}

  for (const pattern of MOVEMENT_PATTERNS) {
    adjustments[pattern] = 1.0
  }

  // Rule 1: Arm asymmetry >2cm
  const armDiff = morpho.asymmetries?.arm_diff_cm ?? 0
  if (armDiff > 2) {
    adjustments['unilateral_push'] = 1.15
    adjustments['unilateral_pull'] = 1.15
  }

  // Rule 2: Shoulder imbalance >2cm
  const shoulderImbalance = morpho.asymmetries?.shoulder_imbalance_cm ?? 0
  if (shoulderImbalance > 2) {
    adjustments['horizontal_push'] = 0.9
    adjustments['horizontal_pull'] = 1.1
  }

  // Rules 3 & 4: Arm length ratio (now fed from v2 biomech.segments or legacy dimensions)
  const armLengthFromBiomech = morpho.biomech?.segments
    ? Math.max(morpho.biomech.segments.arm_l.cm ?? 0, morpho.biomech.segments.arm_r.cm ?? 0)
    : 0
  const armLengthFromDims = Math.max(
    morpho.dimensions?.arm_cm_l ?? 0,
    morpho.dimensions?.arm_cm_r ?? 0
  )
  const armLength = armLengthFromBiomech > 0 ? armLengthFromBiomech : armLengthFromDims

  if (armLength > 0 && clientMeta.height_cm && clientMeta.height_cm > 0) {
    const armRatio = armLength / clientMeta.height_cm
    if (armRatio > 0.4) {
      adjustments['vertical_pull'] = Math.max(adjustments['vertical_pull'], 1.12)
      adjustments['horizontal_pull'] = Math.max(adjustments['horizontal_pull'], 1.05)
    }
    if (armRatio < 0.36) {
      adjustments['horizontal_push'] = Math.max(adjustments['horizontal_push'], 1.1)
      adjustments['vertical_push'] = Math.max(adjustments['vertical_push'], 1.08)
    }
  }

  // ─── v2 rules (require biomech data) ─────────────────────────────────────

  const segs = morpho.biomech?.segments
  const syndromes = morpho.biomech?.postural_syndromes
  const chain = morpho.biomech?.chain_assessment

  if (segs) {
    const tfr = segs.trunk_to_femur_ratio
    const atr = segs.arm_to_torso_ratio

    if (tfr !== null) {
      if (tfr < 0.9) adjustments['squat'] = Math.min(adjustments['squat'], 0.92)
      if (tfr > 1.1) adjustments['squat'] = Math.max(adjustments['squat'], 1.05)
    }

    if (atr !== null && atr > 1.05) {
      adjustments['hinge'] = Math.max(adjustments['hinge'], 1.10)
    }
  }

  if (syndromes) {
    const upperCrossed = getSyndrome(syndromes, 'upper_crossed')
    if (upperCrossed?.present && (upperCrossed.severity === 'moderate' || upperCrossed.severity === 'marked')) {
      adjustments['vertical_push'] = Math.min(adjustments['vertical_push'], 0.85)
      adjustments['horizontal_pull'] = Math.max(adjustments['horizontal_pull'], 1.15)
    }

    const lowerCrossed = getSyndrome(syndromes, 'lower_crossed')
    if (lowerCrossed?.present && (lowerCrossed.severity === 'moderate' || lowerCrossed.severity === 'marked')) {
      adjustments['core_anti_flex'] = Math.max(adjustments['core_anti_flex'], 1.15)
      adjustments['hinge'] = Math.min(adjustments['hinge'], 0.90)
    }
  }

  if (chain?.posterior_chain === 'underdeveloped') {
    adjustments['hinge'] = Math.max(adjustments['hinge'], 1.10)
  }

  // Final clamp [0.8, 1.2]
  for (const pattern of MOVEMENT_PATTERNS) {
    adjustments[pattern] = Math.max(0.8, Math.min(1.2, adjustments[pattern]))
  }

  return adjustments
}

/**
 * Applies stimulus adjustments to a base stimulus coefficient.
 * Used during programme scoring to modulate exercise value based on morphology.
 */
export function applyMorphoAdjustment(baseCoeff: number, adjustmentCoeff: number): number {
  const adjusted = baseCoeff * adjustmentCoeff
  return Math.max(0.4, Math.min(1.2, adjusted))
}
