// lib/morpho/morphoTraits.ts
// Extrait un set plat de traits morphologiques exploitables par le moteur de règles (Niveau 2).

import { isMorphoV2 } from './types'
import type { SegmentEstimate } from './types'

export type SegClass = 'short' | 'average' | 'long'
export type InsertionVal = 'high' | 'low' | 'balanced' | 'wide' | 'narrow'

export type MorphoTraits = {
  // insertions, clé = nom muscle canonique (v3) ; valeurs legacy v2 normalisées
  insertions: Partial<Record<string, InsertionVal>>
  // leviers — classification moyenne G/D
  segments: Partial<Record<'femur' | 'tibia' | 'torso' | 'arm' | 'forearm', SegClass>>
  frame: {
    biacromial?: string
    bi_iliac?: string
    thorax_depth?: string
    elbow_carrying_angle?: string
    knee_alignment?: string
  }
  trunk_to_femur_ratio: number | null
  arm_to_torso_ratio: number | null
  humerus_to_forearm_ratio: number | null
}

const SEG_LEVELS: SegClass[] = ['short', 'average', 'long']

function avgSegClass(a?: SegmentEstimate, b?: SegmentEstimate): SegClass | undefined {
  const ords = [a, b]
    .map(s => (s ? SEG_LEVELS.indexOf(s.classification as SegClass) : -1))
    .filter(i => i >= 0)
  if (ords.length === 0) return undefined
  const avg = Math.round(ords.reduce((x, y) => x + y, 0) / ords.length)
  return SEG_LEVELS[avg]
}

// Legacy v2 → canonical v3 insertion keys
const INSERTION_ALIAS: Record<string, string> = {
  pectorals: 'pec_sternal',
  calves: 'gastrocnemius',
  quadriceps: 'quad_sweep',
  deltoids: 'deltoid_anterior',
}

/**
 * Returns null when the analysis is not v2/v3 (no biomech data).
 */
export function extractMorphoTraits(analysisResult: unknown): MorphoTraits | null {
  if (!analysisResult || !isMorphoV2(analysisResult)) return null
  const b = analysisResult.biomech
  const seg = b.segments

  const insertions: Partial<Record<string, InsertionVal>> = {}
  for (const ins of b.insertions ?? []) {
    if (ins.value === 'unknown') continue
    const key = INSERTION_ALIAS[ins.muscle] ?? ins.muscle
    insertions[key] = ins.value as InsertionVal
    // garder aussi la clé d'origine si différente (robustesse matching)
    insertions[ins.muscle] = ins.value as InsertionVal
  }

  return {
    insertions,
    segments: {
      femur: avgSegClass(seg.femur_l, seg.femur_r),
      tibia: avgSegClass(seg.tibia_l, seg.tibia_r),
      torso: avgSegClass(seg.torso),
      arm: avgSegClass(seg.arm_l, seg.arm_r),
      forearm: avgSegClass(seg.forearm_l, seg.forearm_r),
    },
    frame: {
      biacromial: b.frame?.biacromial,
      bi_iliac: b.frame?.bi_iliac,
      thorax_depth: b.frame?.thorax_depth,
      elbow_carrying_angle: b.frame?.elbow_carrying_angle,
      knee_alignment: b.frame?.knee_alignment,
    },
    trunk_to_femur_ratio: seg.trunk_to_femur_ratio,
    arm_to_torso_ratio: seg.arm_to_torso_ratio,
    humerus_to_forearm_ratio: seg.humerus_to_forearm_ratio ?? null,
  }
}
