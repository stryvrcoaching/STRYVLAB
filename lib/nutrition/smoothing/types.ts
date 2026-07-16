import type { NutritionMacros } from '@/components/client/smart/SmartNutritionWidget'

export const SMOOTHING_DURATION_OPTIONS = [3, 4, 5, 7, 10] as const

export type SmoothingDurationOption = (typeof SMOOTHING_DURATION_OPTIONS)[number]
export type NutritionSmoothingDirection = 'surplus' | 'deficit'
export type NutritionSmoothingStrategy = 'recommended' | 'manual'
export type NutritionSmoothingStatus = 'active' | 'completed' | 'cancelled' | 'replaced'
export type NutritionSmoothingCreatedBy = 'client' | 'coach'
export type NutritionSmoothingClientDecision = 'confirmed' | 'modified' | 'ignored'
export type NutritionSmoothingCoachAction = 'modified' | 'cancelled' | 'noted'
export type NutritionSmoothingDayStatus = 'pending' | 'applied' | 'skipped' | 'overridden'
export type NutritionSmoothingBucket = 'protected_day' | 'neutral_day' | 'absorbent_day'

export interface NutritionSmoothingPlan {
  id: string
  client_id: string
  coach_id: string
  source_date: string
  source_target_kcal: number
  source_consumed_kcal: number
  threshold_kcal: number
  raw_delta_kcal: number
  smoothable_delta_kcal: number
  direction: NutritionSmoothingDirection
  duration_days: number
  strategy: NutritionSmoothingStrategy
  status: NutritionSmoothingStatus
  created_by: NutritionSmoothingCreatedBy
  client_decision: NutritionSmoothingClientDecision | null
  replaced_by_plan_id: string | null
  coach_note: string | null
  coach_note_updated_at: string | null
  coach_last_action: NutritionSmoothingCoachAction | null
  created_at: string
  updated_at: string
  days?: NutritionSmoothingPlanDay[]
}

export interface NutritionSmoothingPlanDay {
  id: string
  plan_id: string
  date: string
  sequence_index: number
  resolved_bucket: NutritionSmoothingBucket
  source_day_label: string | null
  day_weight: number
  base_target_kcal: number
  cycle_synced_target_kcal: number
  kcal_delta: number
  protein_delta_g: number
  carbs_delta_g: number
  fat_delta_g: number
  status: NutritionSmoothingDayStatus
  created_at: string
  updated_at: string
}

export interface NutritionSmoothingPlanDayCandidate {
  date: string
  label?: string | null
  target_kcal: number
}

export interface NutritionSmoothingProposal {
  eligible: boolean
  thresholdKcal: number
  rawDeltaKcal: number
  smoothableDeltaKcal: number
  direction: NutritionSmoothingDirection | null
  recommendedDurationDays: number | null
}

export interface NutritionSmoothingPanelState {
  proposal: NutritionSmoothingProposal
  activePlan: NutritionSmoothingPlan | null
}

export interface NutritionSmoothingGuardrails {
  maxDailyAdjustmentPct: number
  minTargetPct: number
}

export interface NutritionSmoothingDailyAdjustment {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export interface NutritionSmoothingOverlaySummary {
  totalKcalDelta: number
  totalProteinDeltaG: number
  totalCarbsDeltaG: number
  totalFatDeltaG: number
  dayCount: number
  planIds: string[]
}

export type NutritionTargetLike = Pick<NutritionMacros, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'water_ml'>
