// lib/nutrition/types.ts
import type { NutritionPlanMeal } from '@/lib/nutrition/protocol-builder'
import type { NutritionDayRole } from '@/lib/nutrition/day-role'
import type { CycleSyncProfile } from '@/lib/nutrition/cycle-sync-profile'
import { inferNutritionDayRole } from '@/lib/nutrition/day-role'

export interface NutritionProtocol {
  id: string
  client_id: string
  coach_id: string
  name: string
  status: 'draft' | 'shared'
  notes: string | null
  schedule_start_date?: string | null
  cycle_sync_enabled: boolean
  cycle_sync_profile?: CycleSyncProfile | null
  tdee_auto_enabled: boolean
  tdee_adaptive_active: boolean
  tdee_adaptive?: number | null
  tdee_adaptive_at?: string | null
  tdee_data_source?: 'weight_delta' | 'formula_proxy' | null
  tdee_snapshot_source?: 'client_state' | 'manual' | 'formula' | null
  tdee_snapshot_used_at?: string | null
  created_at: string
  updated_at: string
  days?: NutritionProtocolDay[]
  schedule_slots?: NutritionProtocolScheduleSlot[]
  analytics?: NutritionProtocolAnalytics
  plan_analytics?: NutritionProtocolPlanAnalytics
  tracking_analytics?: NutritionProtocolTrackingAnalytics | null
  historical_tracking_analytics?: NutritionProtocolTrackingAnalytics | null
  card_mode?: 'plan' | 'tracking'
  card_state?: NutritionProtocolCardState
}

export interface NutritionProtocolAnalytics {
  days_count: number
  avg_kcal_delta: number | null
  nutrition_score: number | null
  avg_daily_kcal_variation: number | null
  reliability_label: 'Fiables' | 'Partielles' | 'Faibles'
  analyzed_days_count: number
  kcal_delta_trend: number[]
  kcal_variation_trend: number[]
}

export type NutritionProtocolCardState = 'waiting' | 'early' | 'partial' | 'reliable'

export interface NutritionProtocolPlanAnalytics {
  days_count: number
  avg_target_kcal: number | null
  kcal_amplitude: number | null
  training_days_count: number
  rest_days_count: number
  hydration_target_avg_ml: number | null
  structure_score: number | null
  warnings: string[]
}

export interface NutritionProtocolTrackingAnalytics extends NutritionProtocolAnalytics {
  window_label: string
  complete_days_count: number
  partial_days_count: number
  state_label: 'En attente' | 'Précoce' | 'Partiel' | 'Fiable'
}

export interface NutritionProtocolDay {
  id: string
  protocol_id: string
  name: string
  position: number
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  hydration_ml: number | null
  role: NutritionDayRole
  carb_cycle_type: 'high' | 'medium' | 'low' | null
  cycle_sync_phase: 'follicular' | 'ovulatory' | 'luteal' | 'menstrual' | null
  recommendations: string | null
  meal_plan: NutritionPlanMeal[] | null
  created_at: string
}

export interface NutritionProtocolScheduleSlot {
  id: string
  protocol_id: string
  week_index: number
  dow: number
  protocol_day_position: number
  created_at: string
}

// Local state for a day being edited in the tool (includes unsaved changes)
export interface DayDraft {
  localId: string        // temp id for new days not yet saved
  dbId?: string          // undefined until saved
  name: string
  calories: string       // string for input binding
  protein_g: string
  carbs_g: string
  fat_g: string
  hydration_ml: string
  role: NutritionDayRole
  carb_cycle_type: 'high' | 'medium' | 'low' | ''
  cycle_sync_phase: 'follicular' | 'ovulatory' | 'luteal' | 'menstrual' | ''
  recommendations: string
  meal_plan: NutritionPlanMeal[]
}

export function emptyDayDraft(name = 'Nouveau jour'): DayDraft {
  return {
    localId: crypto.randomUUID(),
    name,
    calories: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
    hydration_ml: '',
    role: 'neutral',
    carb_cycle_type: '',
    cycle_sync_phase: '',
    recommendations: '',
    meal_plan: [],
  }
}

export function dayDraftFromDb(day: NutritionProtocolDay): DayDraft {
  return {
    localId: day.id,
    dbId: day.id,
    name: day.name,
    calories: day.calories != null ? String(day.calories) : '',
    protein_g: day.protein_g != null ? String(day.protein_g) : '',
    carbs_g: day.carbs_g != null ? String(day.carbs_g) : '',
    fat_g: day.fat_g != null ? String(day.fat_g) : '',
    hydration_ml: day.hydration_ml != null ? String(day.hydration_ml) : '',
    role: day.role ?? inferNutritionDayRole(day),
    carb_cycle_type: day.carb_cycle_type ?? '',
    cycle_sync_phase: day.cycle_sync_phase ?? '',
    recommendations: day.recommendations ?? '',
    meal_plan: Array.isArray(day.meal_plan) ? day.meal_plan : [],
  }
}

// Enriched client data for pre-filling the tool
export interface NutritionClientData {
  id: string
  name: string
  gender: string | null
  age: number | null
  height_cm: number | null
  weight_kg: number | null
  waist_cm?: number | null
  neck_cm?: number | null
  hips_cm?: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  lean_mass_kg: number | null
  bmr_kcal_measured: number | null
  visceral_fat_level: number | null
  weekly_frequency: number | null
  transformation_phase?: string | null
  training_goal: string | null
  sport_practice: string | null
  session_duration_min: number | null
  training_calories_weekly: number | null
  cardio_frequency: number | null
  cardio_duration_min: number | null
  daily_steps: number | null
  stress_level: number | null
  sleep_duration_h: number | null
  sleep_quality: number | null
  energy_level: number | null
  caffeine_daily_mg: number | null
  alcohol_weekly: number | null
  work_hours_per_week: number | null
  menstrual_cycle: string | null
  occupation: string | null
  occupation_multiplier: number | null
}

export * from '@/lib/nutrition/smoothing/types'
