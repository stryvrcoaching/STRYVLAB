// lib/nutrition/engine/types.ts

export type EngineGoal = 'deficit' | 'maintenance' | 'surplus'
export type EngineGender = 'male' | 'female'

// Macros from the official STRYVR weight-based matrix
export interface StryvrmMacros {
  protein_g: number
  fat_g: number
  carbs_g: number
  calories: number
}

// Carb cycling — P and F stay fixed, only carbs vary
export interface CarbCyclingResult {
  high: StryvrmMacros
  low: StryvrmMacros
  base: StryvrmMacros
}

// TDEE component breakdown per brief
export interface TdeeComponents {
  bmr: number
  neat: number   // steps + occupation
  eat: number    // training energy
  tef: number    // 8-10% of BMR
  total: number  // BMR + NEAT + EAT + TEF
}

// Weekly check-in averages (7-day window)
export interface WeeklyCheckinSummary {
  weightSamples: number           // count of weight_kg entries
  avgWeightKg: number | null
  prevWeekAvgWeightKg: number | null
  waistMeasurements: number       // count from bilans/checkins
  waistTrend: 'up' | 'stable' | 'down' | null
  avgEnergyLevel: number | null   // 1-5 from checkins
  avgSleepH: number | null
  avgStressLevel: number | null   // 1-5
  avgHungerLevel: number | null   // 1-4 (evening only)
  avgMuscleSoreness: number | null // 1-4
  adherencePct: number | null     // 0-1 (tracked days / total days)
  performanceTrend: 'improving' | 'stable' | 'declining' | null
  consecutiveFatigueDays: number
  dataQualityScore?: number | null
  dataQualityNotes?: string[]
}

// 4-case decision matrix output
export type WeeklyDiagnosis =
  | 'optimal_recomp'       // Case 1: weight stable + waist down
  | 'behavioral'           // Case 2: stable + adherence < 85%
  | 'deficit_aggressive'   // Case 3: fast weight loss + low energy + perf decline
  | 'surplus_real'         // Case 4: waist up + weight up + adherence good
  | 'insufficient_data'    // < 3 weight samples or no adherence data

export type WeeklyAction =
  | 'no_change'
  | 'adjust_carbs_up'   // +5 to +10% on high-carb days
  | 'adjust_carbs_down' // -5 to -10% on low-carb days
  | 'focus_adherence'   // no calorie change, behavioral coaching
  | 'recovery'          // reduce volume, maintain calories

export interface WeeklyAnalysisResult {
  diagnosis: WeeklyDiagnosis
  action: WeeklyAction
  carbAdjustmentPct: number | null  // -10 to +10, null if no_change
  guardrailTriggered: 'adherence_block' | 'fatigue_block' | null
  reasoning: string
  confidence: 'high' | 'medium' | 'low'
  confidenceScore: number
  confidenceReasons: string[]
}

// Real-time recommendation trigger
export type TriggerCode = 'fatigue' | 'stagnation' | 'hunger'

export interface TriggerRecommendation {
  trigger: TriggerCode
  severity: 'info' | 'warning'
  title: string
  action: string
  doNotCutCalories: true
}
