// Types pour STRYVR App Mobile
// Basé sur le modèle de données PostgreSQL (20 entités)

// CORE
export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface UserNotificationPreference {
  id: string;
  user_id: string;
  type: string;
  enabled: boolean;
  created_at: string;
}

export interface HealthkitSyncLog {
  id: string;
  user_id: string;
  sync_type: string;
  synced_at: string;
  records_count: number;
}

// MESURES
export interface BodyMeasurement {
  id: string;
  user_id: string;
  weight_kg: number;
  height_cm: number;
  body_fat_pct?: number;
  measured_at: string;
  source: "manual" | "healthkit" | "scale";
}

export interface DailyCheckin {
  id: string;
  user_id: string;
  date: string;
  energy_level: number; // 1-10
  stress_level: number; // 1-10
  sleep_quality: number; // 1-10
  sleep_duration_h: number;
  notes?: string;
}

export interface CycleLog {
  id: string;
  user_id: string;
  date: string;
  phase: "menstrual" | "follicular" | "ovulatory" | "luteal";
  flow_intensity?: number; // 1-5
  symptoms: string[];
}

// NUTRITION
export interface NutritionEntry {
  id: string;
  user_id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  date: string;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
}

export interface Meal {
  id: string;
  nutrition_entry_id: string;
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  category: string;
}

export interface HydrationEntry {
  id: string;
  user_id: string;
  date: string;
  amount_ml: number;
  source: "water" | "drink" | "food";
}

export interface SupplementEntry {
  id: string;
  user_id: string;
  supplement_id: string;
  date: string;
  quantity_mg: number;
  timing: "morning" | "afternoon" | "evening";
}

export interface SupplementReference {
  id: string;
  name: string;
  dosage_mg: number;
  purpose: string;
  category: string;
}

// TRAINING
export interface TrainingSession {
  id: string;
  user_id: string;
  date: string;
  duration_min: number;
  rpe: number; // 1-10
  notes?: string;
  exercises: TrainingExercise[];
}

export interface TrainingExercise {
  id: string;
  session_id: string;
  name: string;
  sets: number;
  reps: number;
  weight_kg: number;
  rest_sec: number;
}

export interface Mesocycle {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  goal: "hypertrophy" | "strength" | "endurance" | "fat_loss";
}

// ÉTAT
export interface Phase {
  id: string;
  user_id: string;
  current_phase: "adaptation" | "progression" | "maintenance" | "recovery";
  started_at: string;
  estimated_end?: string;
}

export interface MotorState {
  id: string;
  user_id: string;
  date: string;
  readiness_score: number; // 0-100
  fatigue_level: number; // 0-100
  recovery_score: number; // 0-100
  computed_at: string;
}

export interface Intervention {
  id: string;
  user_id: string;
  type:
    | "volume_adjustment"
    | "rest_day"
    | "supplement_increase"
    | "training_pause";
  reason: string;
  applied_at: string;
  duration_days?: number;
}

export interface AlertLog {
  id: string;
  user_id: string;
  type: "safety" | "progression" | "nutrition" | "recovery";
  severity: "info" | "warning" | "critical";
  message: string;
  created_at: string;
  resolved_at?: string;
}

export interface MonthlySummary {
  id: string;
  user_id: string;
  month: string; // YYYY-MM
  avg_weight_kg: number;
  total_training_sessions: number;
  avg_calories: number;
  avg_protein_g: number;
  body_fat_change_pct: number;
  generated_at: string;
}

export interface MessageHistory {
  id: string;
  user_id: string;
  type: "motivation" | "advice" | "warning" | "celebration";
  content: string;
  sent_at: string;
  read_at?: string;
}
