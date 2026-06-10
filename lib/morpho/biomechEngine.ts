// lib/morpho/biomechEngine.ts
// Maps MorphoAnalysisResultV2 → Gold Standard DB → ExerciseAdvantageLevel per slot

import type {
  MorphoAnalysisResultV2,
  PosturalSyndrome,
  BiomechSegments,
  MorphoFlag,
} from './types'

// ─── Types publics ────────────────────────────────────────────────────────────

export type ExerciseAdvantageLevel =
  | 'advantageous'
  | 'neutral'
  | 'disadvantageous'
  | 'contraindicated'

export type ExerciseRecommendation = {
  muscle_group: string
  slot: string
  ex_name: string
  advantage: ExerciseAdvantageLevel
  reasoning: string
  suggested_substitution: string | null
  triggered_rules: string[]
}

// ─── Gold Standard types (inferred from DB schema) ───────────────────────────

type TriggerCondition = {
  condition_field: string
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'IN' | 'NOT_IN'
  threshold: number | string | boolean | (number | string)[]
  substitute_ex_name?: string
  substitute_slot?: string
}

type SubstitutionTrigger = {
  conditions: TriggerCondition[]
  logic?: 'AND' | 'OR'
}

type GoldStandardSlot = {
  ex_name: string
  slot: string
  risk_tags: string[]
  substitution_trigger?: SubstitutionTrigger
  optimal_morphotype?: Record<string, string>
  morpho_logic?: string
}

type GoldStandardMuscleGroup = {
  label: string
  slots: Record<string, GoldStandardSlot>
}

type GoldStandardDB = {
  muscle_groups: Record<string, GoldStandardMuscleGroup>
}

// ─── Proxy field derivation ───────────────────────────────────────────────────

// Maps v2 MorphoAnalysisResultV2 to the numeric/boolean proxy fields
// used in Gold Standard substitution_trigger conditions.
// Fields we can't derive return null → condition skipped (treated as neutral).

export type DerivedMorphoFields = Record<string, number | boolean | null>

function getSyndrome(syndromes: PosturalSyndrome[], name: string) {
  return syndromes.find(s => s.name === name)
}

function severityToOrdinal(severity: PosturalSyndrome['severity']): number {
  if (severity === 'marked') return 3
  if (severity === 'moderate') return 2
  if (severity === 'mild') return 1
  return 0
}

export function deriveMorphoFields(analysis: MorphoAnalysisResultV2): DerivedMorphoFields {
  const { biomech, asymmetries } = analysis
  const segs: BiomechSegments = biomech.segments
  const syndromes = biomech.postural_syndromes
  const flags: MorphoFlag[] = analysis.flags

  const upperCrossed = getSyndrome(syndromes, 'upper_crossed')
  const lowerCrossed = getSyndrome(syndromes, 'lower_crossed')
  const ucSev = upperCrossed?.present ? severityToOrdinal(upperCrossed.severity) : 0
  const lcSev = lowerCrossed?.present ? severityToOrdinal(lowerCrossed.severity) : 0

  // arm_span_height_ratio: wingspan / height. Gold Standard: short <0.98, avg 0.98-1.03, long >1.03.
  // Wingspan ≈ arm_l + arm_r + shoulder_width. Shoulder width not available → proxy with torso width
  // as ~25% of torso length (rough). Direct calc from arm segments + estimated height is most accurate.
  const armSpanHeightRatio: number | null = (() => {
    const al = segs.arm_l.cm
    const ar = segs.arm_r.cm
    // Estimate height from torso: height ≈ torso / 0.30 (canonical)
    const estimatedHeight = segs.torso.cm != null ? segs.torso.cm / 0.30 : null
    if (al !== null && ar !== null && estimatedHeight !== null && estimatedHeight > 0) {
      // Wingspan ≈ 2 × arm + shoulder_width. Shoulder width ≈ 0.26 × height
      const shoulderWidth = estimatedHeight * 0.26
      return (al + ar + shoulderWidth) / estimatedHeight
    }
    return null
  })()

  // femur_tibia_ratio
  const femurTibiaRatio: number | null = (() => {
    const fl = segs.femur_l.cm
    const fr = segs.femur_r.cm
    const tl = segs.tibia_l.cm
    const tr = segs.tibia_r.cm
    if (fl !== null && tl !== null && fr !== null && tr !== null) {
      return ((fl + fr) / 2) / ((tl + tr) / 2)
    }
    return null
  })()

  // glenohumeral_anteversion_deg — proxy from upper_crossed severity
  const ghAnteversion: number | null = (() => {
    // Rough proxy: upper_crossed pushes humeral head anterior
    if (ucSev === 3) return 25
    if (ucSev === 2) return 18
    if (ucSev === 1) return 12
    // Check flags for shoulder enrolment
    const shoulderFlag = flags.find(f => f.zone === 'shoulders' && f.severity !== 'green')
    if (shoulderFlag) return 10
    return 5 // baseline assumption if no syndrome
  })()

  // thoracic_kyphosis_deg — proxy from upper_crossed severity
  const thoracicKyphosis: number | null = (() => {
    if (ucSev === 3) return 52
    if (ucSev === 2) return 45
    if (ucSev === 1) return 38
    return 28 // normal
  })()

  // shoulder_external_rotation_deg — inverse of upper_crossed
  const shoulderExtRot: number | null = (() => {
    if (ucSev === 3) return 28
    if (ucSev === 2) return 42
    if (ucSev === 1) return 58
    return 80 // normal
  })()

  // pelvic_tilt_anterior_deg — from lower_crossed
  const pelvicTilt: number | null = (() => {
    if (lcSev === 3) return 22
    if (lcSev === 2) return 16
    if (lcSev === 1) return 10
    const pelvisFlag = flags.find(f => f.zone === 'pelvis' && f.severity !== 'green')
    if (pelvisFlag) return 8
    return 4
  })()

  // shoulder_abduction_deg — proxy (limited if upper_crossed)
  const shoulderAbduction: number | null = ucSev >= 2 ? 140 : 170

  // shoulder_flexion_deg — proxy from upper_crossed (limits overhead flexion)
  const shoulderFlexion: number | null = (() => {
    if (ucSev === 3) return 140
    if (ucSev === 2) return 155
    if (ucSev === 1) return 165
    return 178
  })()

  // knee_flexion_deg — cannot derive from photo reliably
  const kneeFlexion: number | null = null

  // ankle_dorsiflexion_cm — not derivable from photos
  const ankleDorsiflexion: number | null = null

  // femoral_anteversion_deg — very rough proxy from lower_crossed + hip flags
  const femoralAnteversion: number | null = (() => {
    const hipFlag = flags.find(f => f.zone === 'pelvis')
    if (lcSev >= 2 && hipFlag) return 28
    return null
  })()

  // lumbar_neutrality_score (0-10) — inverse of lower_crossed severity
  const lumbarNeutrality: number | null = (() => {
    if (lcSev === 3) return 2
    if (lcSev === 2) return 4
    if (lcSev === 1) return 6
    return 8
  })()

  // Injury-derived boolean fields — scan flag labels + attention points for keywords
  const flagLabels = flags.map(f => f.label.toLowerCase())
  const attentionDescs = analysis.attention_points.map(a => a.description.toLowerCase())
  const allText = [...flagLabels, ...attentionDescs].join(' ')

  const hasKeyword = (...kws: string[]) => kws.some(k => allText.includes(k))

  return {
    arm_span_height_ratio: armSpanHeightRatio,
    femur_tibia_ratio: femurTibiaRatio,
    glenohumeral_anteversion_deg: ghAnteversion,
    thoracic_kyphosis_deg: thoracicKyphosis,
    shoulder_external_rotation_deg: shoulderExtRot,
    shoulder_abduction_deg: shoulderAbduction,
    shoulder_flexion_deg: shoulderFlexion,
    pelvic_tilt_anterior_deg: pelvicTilt,
    femoral_anteversion_deg: femoralAnteversion,
    lumbar_neutrality_score: lumbarNeutrality,
    knee_flexion_deg: kneeFlexion,
    // boolean flags derived from text analysis
    lumbar_disc_pathology: hasKeyword('hernie', 'disc', 'lombaire chronique') ? true : null,
    lumbar_disc_pathology_acute: null,
    lumbar_disc_herniation_active: null,
    subacromial_pain_vas: hasKeyword('impingement', 'conflict sous-acromial') ? 5 : null,
    subacromial_pain_arc_60_120: hasKeyword('impingement', 'acromion') ? true : null,
    ac_joint_pathology: null,
    shoulder_dash_score: null,
    patellofemoral_syndrome: hasKeyword('genou', 'rotule', 'valgus') ? true : null,
    patellar_tendinopathy_vas: null,
    hip_anterior_impingement: hasKeyword('impingement hanche', 'fai', 'hanche antérieure') ? true : null,
    hip_anterior_impingement_fai: null,
    ankle_dorsiflexion_cm: ankleDorsiflexion,
    proximal_hamstring_tendinopathy: hasKeyword('ischio', 'tendinopathie proximale') ? true : null,
    // Everything else: unknown
    achilles_tendinopathy_active: null,
    acl_post_op_months: null,
    bicipital_tendinopathy: hasKeyword('biceps', 'tendinopathie bicipitale') ? true : null,
    bicipital_tendinopathy_active: null,
    carpal_tunnel_syndrome: null,
    cervical_disc_pathology: hasKeyword('cervicale', 'cervical') ? true : null,
    cervical_stenosis: null,
    cervical_vertigo: null,
    distal_bicep_tendinopathy: null,
    elbow_carrying_angle_deg: null,
    glenohumeral_instability_anterior: hasKeyword('instabilité', 'laxité épaule') ? true : null,
    glenohumeral_laxity_score: null,
    grip_strength_insufficient: null,
    hamstring_tear_grade: null,
    hip_flexor_flexibility_score: null,
    lateral_epicondylitis_active: null,
    lumbar_flexion_loss_before_deg: null,
    lumbar_pain_vas: hasKeyword('douleur lombaire') ? 5 : null,
    lumbar_spondylolisthesis: null,
    medial_epicondylitis_active: null,
    no_partner_available: null,
    osteitis_pubis_active: null,
    patellofemoral_arthritis_grade: null,
    pcl_laxity_positive: null,
    plantar_fasciitis_active: null,
    posterior_femoral_compression_syndrome: null,
    posterior_shoulder_pain_vas: hasKeyword('douleur postérieure épaule') ? 4 : null,
    sacroiliac_pain_vas: hasKeyword('sacro-iliaque', 'si joint') ? 4 : null,
    star_excursion_balance_pct: null,
    thoracic_kyphosis_structural: ucSev >= 2 ? true : null,
    acromion_type: null,
    y_balance_lower_pct: null,
  }
}

// ─── Trigger evaluator ────────────────────────────────────────────────────────

function evaluateCondition(
  cond: TriggerCondition,
  fields: DerivedMorphoFields
): boolean | null {
  const val = fields[cond.condition_field]
  if (val === null || val === undefined) return null // unknown → skip

  const { operator, threshold } = cond

  if (operator === '>' && typeof val === 'number' && typeof threshold === 'number') return val > threshold
  if (operator === '<' && typeof val === 'number' && typeof threshold === 'number') return val < threshold
  if (operator === '>=' && typeof val === 'number' && typeof threshold === 'number') return val >= threshold
  if (operator === '<=' && typeof val === 'number' && typeof threshold === 'number') return val <= threshold
  if (operator === '==' ) return val === threshold
  if (operator === '!=' ) return val !== threshold
  if (operator === 'IN' && Array.isArray(threshold)) return (threshold as (number | string)[]).includes(val as number | string)
  if (operator === 'NOT_IN' && Array.isArray(threshold)) return !(threshold as (number | string)[]).includes(val as number | string)

  return null
}

function evaluateTrigger(
  trigger: SubstitutionTrigger,
  fields: DerivedMorphoFields
): { fired: boolean; matchedConditions: TriggerCondition[] } {
  const logic = trigger.logic ?? 'OR'
  const results: Array<{ cond: TriggerCondition; result: boolean | null }> = trigger.conditions.map(c => ({
    cond: c,
    result: evaluateCondition(c, fields),
  }))

  const known = results.filter(r => r.result !== null)
  const fired = known.length === 0
    ? false
    : logic === 'OR'
      ? known.some(r => r.result === true)
      // AND: all conditions must be known and true — unknown fields block the trigger
      : known.length === trigger.conditions.length && known.every(r => r.result === true)

  return {
    fired,
    matchedConditions: results.filter(r => r.result === true).map(r => r.cond),
  }
}

// ─── Red-flag zone matching ───────────────────────────────────────────────────

// Map morpho flag zones to risk_tags that should elevate to contraindicated
const FLAG_ZONE_TO_RISK_TAGS: Record<string, string[]> = {
  shoulders: ['SHEAR_FORCE', 'IMPINGEMENT_ZONE', 'ROTATOR_CUFF_IMPINGEMENT', 'AC_JOINT_STRESS', 'POSTERIOR_CAPSULE_STRETCH'],
  spine:     ['AXIAL_COMPRESSION', 'DISC_FLEXION_LOAD', 'ANTERIOR_SHEAR_LUMBAR', 'CERVICAL_COMPRESSION', 'THORACIC_KYPHOSIS_LOAD'],
  pelvis:    ['SACROILIAC_STRESS'],
  knees:     ['VALGUS_STRESS', 'VARUS_KNEE_STRESS', 'PATELLAR_TENDON_OVERLOAD', 'PATELLOFEMORAL'],
  ankles:    ['ACHILLES_LOAD', 'PLANTAR_FASCIA_LOAD'],
}

function hasRiskTagConflict(riskTags: string[], redFlags: MorphoFlag[]): boolean {
  const redFlagZones = redFlags.filter(f => f.severity === 'red').map(f => f.zone)
  return redFlagZones.some(zone => {
    const dangerousTags = FLAG_ZONE_TO_RISK_TAGS[zone] ?? []
    return dangerousTags.some(tag => riskTags.includes(tag))
  })
}

// ─── Pattern verdict advantage pass-through ───────────────────────────────────

const MUSCLE_GROUP_PATTERN_MAP: Record<string, string> = {
  PECTORAUX:         'horizontal_push',
  DORSAUX:           'horizontal_pull',
  QUADRICEPS:        'squat',
  ISCHIO_JAMBIERS:   'hinge',
  EPAULES:           'vertical_push',
  TRICEPS:           'horizontal_push',
  BICEPS:            'horizontal_pull',
  FESSIERS:          'hinge',
  MOLLETS:           'squat',
  TRAPEZE:           'vertical_pull',
  ABDOMINAUX_CORE:   'anti_rotation',
  ERECTEURS_SPINAUX: 'hinge',
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export function generateExerciseRecommendations(
  analysis: MorphoAnalysisResultV2,
  goldStandardDb: GoldStandardDB
): ExerciseRecommendation[] {
  const fields = deriveMorphoFields(analysis)
  const redFlags = analysis.flags.filter(f => f.severity === 'red')
  const results: ExerciseRecommendation[] = []

  for (const [mgKey, mg] of Object.entries(goldStandardDb.muscle_groups)) {
    const relatedPattern = MUSCLE_GROUP_PATTERN_MAP[mgKey]
    const patternVerdict = analysis.biomech.pattern_verdicts.find(
      pv => pv.pattern === relatedPattern
    )

    for (const [, slot] of Object.entries(mg.slots as Record<string, GoldStandardSlot>)) {
      const triggeredRules: string[] = []
      let advantage: ExerciseAdvantageLevel = 'neutral'
      let reasoning = slot.morpho_logic?.slice(0, 120) ?? ''
      let suggestedSubstitution: string | null = null

      // Step 1: Check red-flag + risk_tag conflict → contraindicated
      if (hasRiskTagConflict(slot.risk_tags ?? [], redFlags)) {
        advantage = 'contraindicated'
        triggeredRules.push('red_flag_risk_tag_conflict')
        reasoning = `Flag rouge présent sur zone critique pour les tags: ${slot.risk_tags.filter(t => {
          const redZones = redFlags.map(f => f.zone)
          return redZones.some(z => (FLAG_ZONE_TO_RISK_TAGS[z] ?? []).includes(t))
        }).join(', ')}`
      }

      // Step 2: Evaluate substitution trigger
      if (slot.substitution_trigger && advantage !== 'contraindicated') {
        const { fired, matchedConditions } = evaluateTrigger(slot.substitution_trigger, fields)
        if (fired) {
          advantage = 'disadvantageous'
          triggeredRules.push(
            ...matchedConditions.map(c => `${c.condition_field}_${c.operator}_${c.threshold}`)
          )
          // Pick first substitute from matched conditions
          const firstSub = matchedConditions.find(c => c.substitute_ex_name)
          suggestedSubstitution = firstSub?.substitute_ex_name ?? null
          reasoning = `Trigger actif: ${matchedConditions.map(c => `${c.condition_field} ${c.operator} ${c.threshold}`).join(' | ')}`
        }
      }

      // Step 3: Pattern verdict bonus if advantage still neutral
      if (advantage === 'neutral' && patternVerdict) {
        if (patternVerdict.verdict === 'advantage') {
          advantage = 'advantageous'
          triggeredRules.push(`pattern_verdict_${relatedPattern}_advantage`)
          reasoning = patternVerdict.rationale
        } else if (patternVerdict.verdict === 'disadvantage') {
          advantage = 'disadvantageous'
          triggeredRules.push(`pattern_verdict_${relatedPattern}_disadvantage`)
          reasoning = patternVerdict.rationale
        }
      }

      results.push({
        muscle_group: mgKey,
        slot: slot.slot,
        ex_name: slot.ex_name,
        advantage,
        reasoning,
        suggested_substitution: suggestedSubstitution,
        triggered_rules: triggeredRules,
      })
    }
  }

  return results
}
