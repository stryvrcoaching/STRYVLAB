// lib/nutrition/types.ts

export interface NutritionProtocol {
  id: string
  client_id: string
  coach_id: string
  name: string
  status: 'draft' | 'shared'
  notes: string | null
  schedule_start_date?: string | null
  cycle_sync_enabled: boolean
  tdee_auto_enabled: boolean
  tdee_adaptive_active: boolean
  tdee_adaptive?: number | null
  tdee_adaptive_at?: string | null
  tdee_data_source?: 'weight_delta' | 'formula_proxy' | null
  created_at: string
  updated_at: string
  days?: NutritionProtocolDay[]
  schedule_slots?: NutritionProtocolScheduleSlot[]
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
  carb_cycle_type: 'high' | 'medium' | 'low' | null
  cycle_sync_phase: 'follicular' | 'ovulatory' | 'luteal' | 'menstrual' | null
  recommendations: string | null
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
  carb_cycle_type: 'high' | 'medium' | 'low' | ''
  cycle_sync_phase: 'follicular' | 'ovulatory' | 'luteal' | 'menstrual' | ''
  recommendations: string
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
    carb_cycle_type: '',
    cycle_sync_phase: '',
    recommendations: '',
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
    carb_cycle_type: day.carb_cycle_type ?? '',
    cycle_sync_phase: day.cycle_sync_phase ?? '',
    recommendations: day.recommendations ?? '',
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
