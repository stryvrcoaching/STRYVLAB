/**
 * Morphology Module Types
 *
 * Types for morphological analysis (MorphoPro Bridge — Phase 0)
 * Represents versioned body composition and stimulus adjustments per client.
 */

/**
 * MorphoAnalysis database row
 * Stores OpenAI Vision API output + parsed metrics + stimulus adjustments
 */
export interface MorphoAnalysis {
  id: string // UUID
  client_id: string // UUID, FK to coach_clients
  assessment_submission_id?: string | null // UUID, nullable FK

  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
  analysis_date: string // ISO date (YYYY-MM-DD)

  raw_payload?: Record<string, unknown> | null // Complete OpenAI Vision response
  body_composition?: Record<string, unknown> | null // Parsed: body_fat_pct, lean_mass_kg, etc.
  dimensions?: Record<string, unknown> | null // Measurements: waist_cm, hip_cm, chest_cm, etc.
  asymmetries?: Record<string, unknown> | null // Asymmetry detection: side → deviation_pct
  stimulus_adjustments?: Record<string, unknown> | null // Morpho-derived adjustments per pattern

  status: 'pending' | 'completed' | 'failed'
  job_id?: string | null // n8n job ID for async tracking
  error_message?: string | null // Error details if status = 'failed'
  analyzed_by?: string | null // UUID of coach who triggered analysis
}

/**
 * OpenAI Vision API response structure (simplified)
 * Represents the parsed output from image analysis
 */
export interface MorphoRawPayload {
  body_fat_pct?: number // Estimated body fat percentage
  lean_mass_kg?: number
  fat_mass_kg?: number

  // Measurements
  waist_cm?: number
  hip_cm?: number
  chest_cm?: number
  arm_cm?: number
  thigh_cm?: number
  calf_cm?: number

  // Asymmetries (side → deviation as %)
  asymmetries?: {
    shoulders?: number // % deviation left vs right
    hips?: number
    arms?: number
    legs?: number
  }

  // Overall assessment
  posture?: 'neutral' | 'anterior_pelvic_tilt' | 'posterior_pelvic_tilt' | 'kyphosis'
  muscle_quality?: 'poor' | 'fair' | 'good' | 'excellent'
  confidence_score?: number // 0–100, OpenAI Vision confidence

  analysis_notes?: string
}

/**
 * Stimulus adjustments derived from morpho metrics
 * Applied to base stimulus coefficients in scoring
 *
 * Range: 0.8–1.2 per pattern
 * Example:
 *   base_coeff = 0.85 (vertical_pull)
 *   morpho_adjustment = { vertical_pull: 1.1 }
 *   final_coeff = 0.85 * 1.1 = 0.935
 */
export interface MorphoStimulusAdjustments {
  [pattern: string]: number // pattern_slug → coefficient multiplier (0.8–1.2)
}

/**
 * Async job status for MorphoPro analysis
 * Used for polling job completion
 */
export interface MorphoJobStatus {
  job_id: string
  status: 'pending' | 'completed' | 'failed'
  progress?: number // 0–100 if available
  error?: string
  completed_at?: string
}

/**
 * Request payload for triggering morpho analysis
 * Coach uploads photo → API queues n8n job
 */
export interface MorphoAnalysisRequest {
  client_id: string // UUID
  assessment_submission_id?: string // Optional: link to bilan
  photo_url: string // Signed URL to image in Supabase Storage
  analysis_date?: string // ISO date, defaults to today
}

/**
 * Response from analysis trigger endpoint
 */
export interface MorphoAnalysisResponse {
  id: string // UUID of created morpho_analyses row
  job_id: string // n8n job ID for polling
  status: 'pending'
  created_at: string
}

/**
 * Timeline entry for morpho history
 */
export interface MorphoTimelineEntry {
  id: string
  analysis_date: string
  status: 'completed' | 'failed'
  body_composition?: {
    body_fat_pct?: number
    lean_mass_kg?: number
  }
  created_at: string
}
