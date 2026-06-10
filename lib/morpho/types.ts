// lib/morpho/types.ts

export type MorphoPhotoPosition =
  | 'front' | 'back' | 'left' | 'right'
  | 'three_quarter_front_left' | 'three_quarter_front_right'
  | 'relaxed' | 'contracted'

export type MorphoPhotoSource = 'assessment' | 'coach_upload'

export interface MorphoPhoto {
  id: string
  client_id: string
  coach_id: string
  storage_path: string
  position: MorphoPhotoPosition
  taken_at: string
  source: MorphoPhotoSource
  assessment_response_id?: string | null
  notes?: string | null
  created_at: string
  // enrichis par l'API
  signed_url?: string | null        // thumbnail 400px — pour l'affichage grille
  full_url?: string | null          // original full-res — pour canvas/comparaison
  has_annotation?: boolean
  thumbnail_url?: string | null     // thumbnail annotation canvas
}

export interface MorphoAnnotation {
  id: string
  photo_id: string
  coach_id: string
  canvas_data: Record<string, unknown>
  thumbnail_path?: string | null
  analysis_snapshot?: MorphoAnalysisResult | null
  created_at: string
  updated_at: string
}

export interface MorphoFlag {
  zone: 'shoulders' | 'pelvis' | 'spine' | 'knees' | 'ankles'
  severity: 'red' | 'orange' | 'green'
  label: string
}

export interface MorphoAttentionPoint {
  priority: number
  description: string
  zone: string
}

export interface MorphoRecommendation {
  type: 'exercise' | 'correction' | 'contraindication'
  description: string
  reference: string
}

export interface MorphoAsymmetries {
  shoulder_imbalance_cm: number | null
  arm_diff_cm: number | null
  hip_imbalance_cm: number | null
  posture_notes: string
}

export interface MorphoStimulusHints {
  dominant_pattern: string | null
  weak_pattern: string | null
  notes: string
}

export interface MorphoAnalysisResult {
  score: number
  posture_summary: string
  flags: MorphoFlag[]
  attention_points: MorphoAttentionPoint[]
  recommendations: MorphoRecommendation[]
  asymmetries: MorphoAsymmetries
  stimulus_hints: MorphoStimulusHints
}

export interface MorphoAnalysis {
  id: string
  client_id: string
  analysis_date: string
  status: 'pending' | 'completed' | 'failed'
  photo_ids: string[]
  analysis_result?: MorphoAnalysisResult | null
  body_composition?: {
    body_fat_pct?: number
    estimated_muscle_mass_kg?: number
  } | null
  asymmetries?: {
    arm_diff_cm?: number
    shoulder_imbalance_cm?: number
    hip_imbalance_cm?: number
    posture_notes?: string
  } | null
  stimulus_adjustments?: Record<string, number> | null
  error_message?: string | null
}

// ─── v2 Biomech types ────────────────────────────────────────────────────────

export type Confidence = 'low' | 'medium' | 'high'

export type SegmentEstimate = {
  cm: number | null
  ratio_to_height: number | null
  classification: 'short' | 'average' | 'long' | 'unknown'
  confidence: Confidence
}

export type BiomechSegments = {
  torso: SegmentEstimate
  arm_l: SegmentEstimate
  arm_r: SegmentEstimate
  forearm_l: SegmentEstimate
  forearm_r: SegmentEstimate
  femur_l: SegmentEstimate
  femur_r: SegmentEstimate
  tibia_l: SegmentEstimate
  tibia_r: SegmentEstimate
  trunk_to_femur_ratio: number | null
  arm_to_torso_ratio: number | null
  humerus_to_forearm_ratio?: number | null  // v3+
}

// v3+ — structure osseuse visible
export type BiomechFrame = {
  biacromial: 'narrow' | 'average' | 'wide' | 'unknown'
  bi_iliac: 'narrow' | 'average' | 'wide' | 'unknown'
  thorax_depth: 'flat' | 'average' | 'deep' | 'unknown'
  skeletal_frame: 'light' | 'medium' | 'heavy' | 'unknown'
  inter_pectoral_gap?: 'narrow' | 'average' | 'wide' | 'unknown'
  knee_alignment?: 'valgus' | 'varus' | 'neutral' | 'unknown'
  elbow_carrying_angle?: 'normal' | 'mild_valgus' | 'marked_valgus' | 'varus' | 'unknown'  // v3+ carrying angle
  confidence: Confidence
}

// v3+ — prescriptions spécifiques par morphologie
export type SetupPrescriptions = {
  squat_stance: string
  squat_variation: 'high_bar' | 'low_bar' | 'safety_bar' | 'goblet' | 'front_squat' | 'other'
  deadlift_variation: 'conventional' | 'sumo' | 'trap_bar' | 'romanian' | 'other'
  bench_grip: string
  ohp_implement: 'barbell' | 'dumbbell' | 'landmine' | 'other'
  pull_grip: 'pronated' | 'supinated' | 'neutral' | 'mixed'
  rationale: string
}

export type MuscleInsertion = {
  muscle:
    // v2 legacy
    | 'biceps' | 'triceps' | 'calves' | 'pectorals' | 'traps'
    | 'quadriceps' | 'lats' | 'hamstrings' | 'deltoids'
    // v3
    | 'pec_sternal' | 'pec_clavicular' | 'gastrocnemius'
    | 'quad_sweep' | 'deltoid_anterior'
  value: 'high' | 'low' | 'balanced' | 'wide' | 'narrow' | 'unknown'
  confidence: Confidence
  note?: string
}

export type PosturalSyndrome = {
  name: 'upper_crossed' | 'lower_crossed' | 'layered' | 'none'
  present: boolean
  severity: 'mild' | 'moderate' | 'marked' | null
  markers: string[]
  confidence: Confidence
}

export type BiomechMovementPattern =
  | 'horizontal_push' | 'horizontal_pull'
  | 'vertical_push'   | 'vertical_pull'
  | 'squat'           | 'hinge'
  | 'lunge'           | 'carry'
  | 'rotation'        | 'anti_rotation'

export type PatternVerdict = {
  pattern: BiomechMovementPattern
  verdict: 'advantage' | 'neutral' | 'disadvantage'
  rationale: string
  confidence: Confidence
}

export type BiomechProfile = {
  segments: BiomechSegments
  insertions: MuscleInsertion[]
  postural_syndromes: PosturalSyndrome[]
  pattern_verdicts: PatternVerdict[]
  chain_assessment: {
    posterior_chain: 'underdeveloped' | 'balanced' | 'developed' | 'unknown'
    anterior_chain: 'underdeveloped' | 'balanced' | 'developed' | 'unknown'
    dominant_cross_chain: 'anterior' | 'posterior' | 'balanced' | 'unknown'
  }
  frame?: BiomechFrame
  setup_prescriptions?: SetupPrescriptions
}

export interface MorphoAnalysisResultV2 extends MorphoAnalysisResult {
  asymmetries: MorphoAsymmetries & {
    leg_length_diff_cm: number | null
    pelvic_rotation_deg: number | null
  }
  biomech: BiomechProfile
  meta: {
    prompt_version: 'v2' | 'v3'
    analyzed_at: string
    photo_count: number
    overall_confidence: Confidence
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isMorphoV2(r: any): r is MorphoAnalysisResultV2 {
  return (
    r != null && typeof r === 'object' &&
    r.biomech != null && typeof r.biomech === 'object' &&
    r.biomech.segments != null &&
    r.meta != null && typeof r.meta === 'object' &&
    (r.meta.prompt_version === 'v2' || r.meta.prompt_version === 'v3')
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export interface MorphoAnalysisSummary {
  id: string
  analysis_date: string
  status: 'pending' | 'completed' | 'failed'
  photo_ids: string[] | null
  analysis_result: MorphoAnalysisResult | null
  biomech_profile: BiomechProfile | null
  prompt_version: string | null
  stimulus_adjustments: Record<string, number> | null
  body_composition: {
    body_fat_pct?: number
    estimated_muscle_mass_kg?: number
  } | null
  asymmetries: MorphoAsymmetries | null
  error_message: string | null
}

// ─────────────────────────────────────────────────────────────────────────────

export const POSITION_LABELS: Record<MorphoPhotoPosition, string> = {
  front: 'Face',
  back: 'Dos',
  left: 'Profil G',
  right: 'Profil D',
  three_quarter_front_left: '¾ Avant G',
  three_quarter_front_right: '¾ Avant D',
  relaxed: 'Relâché',
  contracted: 'Contracté',
}
