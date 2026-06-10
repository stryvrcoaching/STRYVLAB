// lib/morpho/exerciseCoherence.ts
// Cohérence exercice ↔ morphologie.
// Niveau 1 : pattern moteur × pattern_verdicts.
// Niveau 2 : table de règles fines (insertions, leviers, angles, frame).

import type { BiomechMovementPattern, PatternVerdict } from './types'
import type { MorphoTraits } from './morphoTraits'

export type CoherenceLevel = 'optimal' | 'neutral' | 'caution'

export type CoherenceReason = {
  text: string
  effect: 'boost' | 'penalty' | 'contraindication' | 'pattern'
}

export type CoherenceResult = {
  level: CoherenceLevel
  reasons: CoherenceReason[]
  confidence: 'low' | 'medium' | 'high'
} | null

export type ExerciseLike = {
  name: string
  movement_pattern: string | null
  primary_muscles?: string[]
  primaryMuscle?: string | null
  constraintProfile?: string | null
  equipment_required?: string[]
}

// ─── Niveau 1 : mapping pattern catalogue → biomech ──────────────────────────

const CATALOG_TO_BIOMECH: Record<string, BiomechMovementPattern | null> = {
  horizontal_push: 'horizontal_push',
  horizontal_pull: 'horizontal_pull',
  vertical_push: 'vertical_push',
  vertical_pull: 'vertical_pull',
  carry: 'carry',
  squat: 'squat',
  squat_pattern: 'squat',
  hinge: 'hinge',
  hip_hinge: 'hinge',
  lunge: 'lunge',
  core_rotation: 'rotation',
  core_anti_flex: 'anti_rotation',
  core_anti_flexion: 'anti_rotation',
  core_anti_rotation: 'anti_rotation',
  core_anti_extension: 'anti_rotation',
  unilateral_push: 'horizontal_push',
  unilateral_pull: 'horizontal_pull',
  knee_flexion: null,
  knee_extension: null,
  calf_raise: null,
  elbow_flexion: null,
  elbow_extension: null,
  lateral_raise: null,
  hip_abduction: null,
  hip_adduction: null,
  shoulder_rotation: null,
  scapular_elevation: null,
  scapular_retraction: null,
  scapular_protraction: null,
  core_flex: null,
  isolation: null,
}

const VERDICT_TO_SCORE: Record<PatternVerdict['verdict'], number> = {
  advantage: 1,
  neutral: 0,
  disadvantage: -1,
}

export function buildVerdictMap(verdicts: PatternVerdict[]): Map<BiomechMovementPattern, PatternVerdict> {
  const map = new Map<BiomechMovementPattern, PatternVerdict>()
  for (const v of verdicts) map.set(v.pattern, v)
  return map
}

// ─── Niveau 2 : table de règles ──────────────────────────────────────────────

type RuleMatch = {
  patterns?: string[]      // movement_pattern catalogue
  muscles?: string[]       // primary_muscles slugs
  primaryMuscles?: string[] // primaryMuscle biomécanique précis
  equipment?: string[]     // equipment requis (au moins un)
  notEquipment?: string[]  // exclure si un de ces equipements présent
  nameKeywords?: string[]  // fallback sur le nom (lowercase includes)
  excludeNameKeywords?: string[] // mots-clés qui annulent le match
}

type MorphoRule = {
  id: string
  match: RuleMatch
  when: (t: MorphoTraits) => boolean
  effect: 'boost' | 'penalty' | 'contraindication'
  reason: string
}

const ins = (t: MorphoTraits, ...keys: string[]) => {
  for (const k of keys) { if (t.insertions[k]) return t.insertions[k] }
  return undefined
}

const RULES: MorphoRule[] = [
  // ── INSERTIONS ──
  {
    id: 'biceps_high_curl',
    match: {
      patterns: ['elbow_flexion'],
      primaryMuscles: ['biceps_brachii'],
      nameKeywords: ['curl', 'biceps'],
      excludeNameKeywords: ['pupitre', 'larry scott', 'incliné', 'incline', 'marteau', 'hammer', 'neutre'],
    },
    when: t => ins(t, 'biceps') === 'high',
    effect: 'penalty',
    reason: 'Biceps à ventre court (insertion haute) : privilégier le travail en étirement (curls inclinés, pupitre).',
  },
  {
    id: 'biceps_high_stretch_friendly',
    match: {
      patterns: ['elbow_flexion'],
      primaryMuscles: ['biceps_brachii'],
      nameKeywords: ['pupitre', 'larry scott', 'incliné', 'incline'],
    },
    when: t => ins(t, 'biceps') === 'high',
    effect: 'boost',
    reason: 'Bonne sélection pour un biceps à insertion haute : ce curl favorise davantage l’étirement ou le support recommandé.',
  },
  {
    id: 'gastroc_high_calf',
    match: {
      patterns: ['calf_raise'],
      primaryMuscles: ['gastrocnemius'],
      nameKeywords: ['mollet', 'calf', 'gastro'],
      excludeNameKeywords: ['assis', 'soleaire', 'soléaire', 'soleus'],
    },
    when: t => ins(t, 'gastrocnemius', 'calves') === 'high',
    effect: 'penalty',
    reason: 'Gastrocnémiens hauts : potentiel limité — prioriser le soléaire (mollets assis) et un volume élevé.',
  },
  {
    id: 'gastroc_high_seated_calf',
    match: {
      patterns: ['calf_raise'],
      primaryMuscles: ['soleus'],
      nameKeywords: ['assis', 'soleaire', 'soléaire', 'soleus'],
    },
    when: t => ins(t, 'gastrocnemius', 'calves') === 'high',
    effect: 'boost',
    reason: 'Bonne sélection : la variante assise transfère mieux le travail vers le soléaire quand les gastrocnémiens sont hauts.',
  },
  {
    id: 'pec_sternal_low_flatpress',
    match: { patterns: ['horizontal_push'], muscles: ['chest'], nameKeywords: ['développé couché', 'bench', 'couché'] },
    when: t => ins(t, 'pec_sternal', 'pectorals') === 'low',
    effect: 'boost',
    reason: 'Insertion sternale basse : développé plat à amplitude complète très favorable au pectoral.',
  },
  {
    id: 'pec_clav_low_incline',
    match: { nameKeywords: ['incliné', 'incline'] },
    when: t => ins(t, 'pec_clavicular') === 'low',
    effect: 'boost',
    reason: 'Chef claviculaire peu développé : développé incliné prioritaire pour combler le haut des pectoraux.',
  },
  {
    id: 'quad_sweep_wide_legpress',
    match: { nameKeywords: ['presse', 'leg press', 'hack'] },
    when: t => ins(t, 'quad_sweep', 'quadriceps') === 'wide',
    effect: 'boost',
    reason: 'Vaste latéral dominant : presse à 45° / hack squat exploitent bien le balayage du quadriceps.',
  },
  {
    id: 'delt_ant_high_overhead',
    match: {
      patterns: ['vertical_push'],
      primaryMuscles: ['anterior_deltoid', 'deltoid_anterior'],
      nameKeywords: ['développé militaire', 'overhead', 'ohp', 'épaules'],
    },
    when: t => ins(t, 'deltoid_anterior', 'deltoids') === 'high',
    effect: 'penalty',
    reason: 'Deltoïde antérieur déjà dominant : limiter le volume overhead prise large, équilibrer avec faisceau postérieur.',
  },

  // ── LEVIERS ──
  {
    id: 'femur_long_squat',
    match: { patterns: ['squat', 'squat_pattern'], nameKeywords: ['squat'] },
    when: t => t.segments.femur === 'long',
    effect: 'penalty',
    reason: 'Fémurs longs : squat barre dos à forte inclinaison — privilégier front/high-bar squat + élévation talons.',
  },
  {
    id: 'humerus_long_bench',
    match: { patterns: ['horizontal_push'], nameKeywords: ['développé couché', 'bench', 'couché', 'dips'] },
    when: t => (t.humerus_to_forearm_ratio != null && t.humerus_to_forearm_ratio > 1.15) || t.segments.arm === 'long',
    effect: 'penalty',
    reason: 'Bras longs : grande amplitude au développé (stress épaule en bas) — floor/board press utiles.',
  },
  {
    id: 'trunk_long_deadlift',
    match: { patterns: ['hinge', 'hip_hinge'], nameKeywords: ['deadlift', 'soulevé', 'terre'] },
    when: t => (t.trunk_to_femur_ratio != null && t.trunk_to_femur_ratio > 1.10) || (t.segments.torso === 'long' && t.segments.arm === 'long'),
    effect: 'boost',
    reason: 'Tronc / bras longs : deadlift conventionnel mécaniquement avantageux.',
  },
  {
    id: 'trunk_short_deadlift',
    match: { patterns: ['hinge', 'hip_hinge'], nameKeywords: ['deadlift', 'soulevé', 'terre'] },
    when: t => (t.trunk_to_femur_ratio != null && t.trunk_to_femur_ratio < 0.90) || t.segments.torso === 'short',
    effect: 'penalty',
    reason: 'Tronc court : forte inclinaison au deadlift conventionnel — trap-bar ou sumo réduisent le bras de levier.',
  },

  // ── ANGLES ──
  {
    id: 'elbow_valgus_straightbar',
    match: { equipment: ['barbell'], notEquipment: ['ez_bar'], patterns: ['elbow_flexion'], nameKeywords: ['curl barre', 'développé serré', 'skull'] },
    when: t => t.frame.elbow_carrying_angle === 'marked_valgus',
    effect: 'penalty',
    reason: 'Valgus du coude marqué : préférer la barre EZ à la barre droite (réduit le stress poignet/coude).',
  },
  {
    id: 'knee_valgus_squat',
    match: { patterns: ['squat', 'squat_pattern', 'lunge'], nameKeywords: ['squat', 'fente', 'lunge'] },
    when: t => t.frame.knee_alignment === 'valgus',
    effect: 'penalty',
    reason: 'Genoux valgus : contrôler le valgus dynamique, renforcer fessiers/abducteurs, éviter une stance trop large.',
  },

  // ── FRAME ──
  {
    id: 'clav_wide_bench',
    match: { patterns: ['horizontal_push'], muscles: ['chest'], nameKeywords: ['développé couché', 'bench', 'couché'] },
    when: t => t.frame.biacromial === 'wide',
    effect: 'boost',
    reason: 'Clavicules larges : avantage au développé couché (prise large, bon levier pectoral).',
  },
  {
    id: 'clav_narrow_overhead',
    match: { patterns: ['vertical_push'], nameKeywords: ['développé militaire', 'overhead', 'ohp'] },
    when: t => t.frame.biacromial === 'narrow',
    effect: 'penalty',
    reason: 'Clavicules étroites : prise large en overhead = risque d\'impingement — préférer haltères / prise serrée.',
  },
  {
    id: 'pelvis_wide_squat',
    match: { patterns: ['squat', 'squat_pattern'], nameKeywords: ['squat', 'soulevé', 'deadlift'] },
    when: t => t.frame.bi_iliac === 'wide',
    effect: 'boost',
    reason: 'Bassin large : stance large / sumo avantageux (tibias plus verticaux, meilleur levier hanche).',
  },
]

// ─── Matching ────────────────────────────────────────────────────────────────

function matchExercise(m: RuleMatch, ex: ExerciseLike): boolean {
  const name = ex.name.toLowerCase()
  const equip = ex.equipment_required ?? []
  const muscles = ex.primary_muscles ?? []
  const primaryMuscle = (ex.primaryMuscle ?? '').toLowerCase()

  // Exclusion equipment
  if (m.notEquipment && m.notEquipment.some(e => equip.includes(e))) return false
  if (m.excludeNameKeywords && m.excludeNameKeywords.some(kw => name.includes(kw))) return false

  // Au moins un critère positif doit matcher
  const byPattern = m.patterns ? (ex.movement_pattern ? m.patterns.includes(ex.movement_pattern) : false) : false
  const byMuscle = m.muscles ? m.muscles.some(mu => muscles.includes(mu)) : false
  const byPrimaryMuscle = m.primaryMuscles
    ? m.primaryMuscles.some(mu => primaryMuscle === mu.toLowerCase())
    : false
  const byEquip = m.equipment ? m.equipment.some(e => equip.includes(e)) : false
  const byName = m.nameKeywords ? m.nameKeywords.some(kw => name.includes(kw)) : false

  const criteria = [
    m.patterns ? byPattern : null,
    m.muscles ? byMuscle : null,
    m.primaryMuscles ? byPrimaryMuscle : null,
    m.equipment ? byEquip : null,
    m.nameKeywords ? byName : null,
  ].filter((value): value is boolean => value !== null)

  // Si aucun critère défini → pas de match
  if (criteria.length === 0) return false

  return criteria.every(Boolean)
}

// ─── Compute ─────────────────────────────────────────────────────────────────

const scoreToLevel = (s: number): CoherenceLevel => (s > 0 ? 'optimal' : s < 0 ? 'caution' : 'neutral')

/**
 * Cohérence complète (Niveau 1 + Niveau 2).
 * - Niveau 1 : verdict du pattern moteur (si verdictMap fourni)
 * - Niveau 2 : règles fines (si traits fournis)
 * Retourne null si aucun signal (pas de verdict pattern ET aucune règle déclenchée).
 */
export function computeCoherence(
  exercise: ExerciseLike,
  verdictMap: Map<BiomechMovementPattern, PatternVerdict> | null,
  traits?: MorphoTraits | null
): CoherenceResult {
  const reasons: CoherenceReason[] = []
  let score = 0
  let hasSignal = false
  let confidence: 'low' | 'medium' | 'high' = 'medium'

  // ── Niveau 1 : pattern verdict ──
  const biomech = exercise.movement_pattern ? CATALOG_TO_BIOMECH[exercise.movement_pattern] : null
  if (biomech && verdictMap) {
    const verdict = verdictMap.get(biomech)
    if (verdict) {
      hasSignal = true
      score += VERDICT_TO_SCORE[verdict.verdict]
      confidence = verdict.confidence
      if (verdict.verdict !== 'neutral') {
        reasons.push({ text: verdict.rationale, effect: 'pattern' })
      }
    }
  }

  // ── Niveau 2 : règles fines ──
  let contraindicated = false
  if (traits) {
    for (const rule of RULES) {
      if (!matchExercise(rule.match, exercise)) continue
      if (!rule.when(traits)) continue
      hasSignal = true
      if (rule.effect === 'boost') { score += 1; reasons.push({ text: rule.reason, effect: 'boost' }) }
      else if (rule.effect === 'penalty') { score -= 1; reasons.push({ text: rule.reason, effect: 'penalty' }) }
      else { contraindicated = true; reasons.push({ text: rule.reason, effect: 'contraindication' }) }
    }
  }

  if (!hasSignal) return null

  const level: CoherenceLevel = contraindicated ? 'caution' : scoreToLevel(score)

  // Ordonner : contraindication > penalty > pattern > boost (le plus actionnable en tête)
  const order = { contraindication: 0, penalty: 1, pattern: 2, boost: 3 }
  reasons.sort((a, b) => order[a.effect] - order[b.effect])

  return { level, reasons, confidence }
}
