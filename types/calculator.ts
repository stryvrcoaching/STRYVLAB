// ============================================================
// types/calculator.ts
// TypeScript types for all calculator results and operations
// ============================================================

// ============================================================
// 1. GENERIC CALCULATION OUTPUT
// ============================================================

/**
 * Confidence margin for a calculation result
 * Represents uncertainty in the formula
 */
export interface ConfidenceMargin {
  percentageRange: number; // e.g., 15 for ±15%
  absoluteRange?: number; // e.g., 5 for ±5 kg
}

/**
 * Base type for all calculation results
 * Every calculator returns this structure
 */
export interface CalculationResult {
  formula: string; // e.g., "Brzycki", "Katch-McArdle"
  formulaVersion: string; // e.g., "v1.0" for versioning
  calculatedAt: string; // ISO timestamp
  confidence: ConfidenceMargin;
}

// ============================================================
// 2. 1RM CALCULATOR (Brzycki)
// ============================================================

export interface Brzycki1RMInput {
  weight: number; // kg
  reps: number; // 1-37 reps (Brzycki valid range)
  equipment?: "barbell" | "dumbbell" | "machine";
}

export interface TrainingZone {
  zone: string; // e.g., "Strength (90%)"
  percentageOfMax: number; // 50-100
  repsRange: [number, number]; // [minReps, maxReps]
  objective: string; // e.g., "Max Strength"
}

export interface Brzycki1RMOutput extends CalculationResult {
  oneRM: number; // kg, rounded to 0.5 kg
  zones: TrainingZone[];
  formula: "Brzycki";
}

// ============================================================
// 3. HR ZONES CALCULATOR (Karvonen)
// ============================================================

export interface KarvonenInput {
  age: number; // years
  restingHeartRate?: number; // bpm (default 60 if not provided)
  targetZone?: "Z1" | "Z2" | "Z3" | "Z4" | "Z5";
}

export interface HeartRateZone {
  zone: string; // Z1, Z2, etc.
  name: string; // Recovery, Aerobic, etc.
  minHR: number; // bpm
  maxHR: number; // bpm
  percentageReserve: [number, number]; // [min%, max%] of HRR
}

export interface KarvonenOutput extends CalculationResult {
  maxHeartRate: number; // bpm
  heartRateReserve: number; // maxHR - restingHR
  zones: HeartRateZone[];
  formula: "Karvonen";
}

// ============================================================
// 4. MACROS CALCULATOR (Katch-McArdle + TDEE)
// ============================================================

export interface MacrosInput {
  weight: number; // kg
  height: number; // cm
  age: number; // years
  gender: "M" | "F";
  bodyFat?: number; // percentage (optional, uses Boer fallback)
  dailySteps?: number; // for NEAT calculation
  weeklyWorkouts?: number; // 0-7 for training load
  goal?: "maintenance" | "deficit" | "surplus";
}

export interface MacroAllocation {
  protein: number; // grams
  fat: number; // grams
  carbs: number; // grams
}

export interface MacrosOutput extends CalculationResult {
  bmr: number; // Basal Metabolic Rate (kcal)
  tdee: number; // Total Daily Energy Expenditure (kcal)
  leanMass: number; // kg
  estimatedBodyFat: number; // percentage
  macros: MacroAllocation;
  phases?: {
    phase: string; // e.g., "Building", "Cutting"
    targetCalories: number;
    macros: MacroAllocation;
  }[];
  formula: "Katch-McArdle";
}

// ============================================================
// 5. BODY FAT CALCULATOR (Various methods)
// ============================================================

export interface BodyFatInput {
  method: "jackson_pollock_3" | "jackson_pollock_7" | "boer" | "manual";
  gender: "M" | "F";
  age: number;

  // For Jackson-Pollock 3-site
  chest?: number; // mm
  abdominal?: number; // mm
  thigh?: number; // mm

  // For Jackson-Pollock 7-site
  triceps?: number; // mm
  suprailiac?: number; // mm
  midaxilla?: number; // mm

  // For manual entry
  bodyFatPercentage?: number; // already measured percentage
}

export interface BodyCompositionData {
  bodyFatPercentage: number;
  leanMass: number; // kg (weight × (1 - BF%))
  fatMass: number; // kg
  category: string; // e.g., "Athletic", "Average", "Overweight"
}

export interface BodyFatOutput extends CalculationResult {
  bodyFat: BodyCompositionData;
  formula: "Jackson-Pollock 3" | "Jackson-Pollock 7" | "Boer" | "Manual";
}

// ============================================================
// 6. WATER INTAKE CALCULATOR
// ============================================================

export interface WaterIntakeInput {
  weight: number; // kg
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  climate?: "temperate" | "hot" | "cold";
  workoutsPerWeek?: number;
}

export interface WaterSchedule {
  time: string; // e.g., "09:00"
  volumeMl: number;
}

export interface WaterIntakeOutput extends CalculationResult {
  dailyIntakeMl: number;
  cupsPerDay: number;
  schedule: WaterSchedule[];
  formula: "Dynamic Water Formula";
}

// ============================================================
// 7. BMI CALCULATOR
// ============================================================

export interface BMIInput {
  weight: number; // kg
  height: number; // cm
}

export interface BMIOutput extends CalculationResult {
  bmi: number; // rounded to 1 decimal
  category: "underweight" | "normal" | "overweight" | "obese";
  healthRisk: "low" | "moderate" | "high";
  formula: "BMI";
}

// ============================================================
// 8. KARVONEN-DERIVED - HR AT INTENSITY
// ============================================================

export interface IntensityHeartRateInput {
  age: number;
  restingHeartRate: number;
  intensityPercentage: number; // 0-100
}

export interface IntensityHeartRateOutput extends CalculationResult {
  heartRate: number; // bpm at specified intensity
  formula: "Karvonen-Intensity";
}

// ============================================================
// 9. DATABASE STORAGE
// ============================================================

/**
 * Record stored in calculator_results table
 */
export interface CalculatorResultRecord {
  id: string; // UUID
  clientId: string; // UUID
  calculatorType:
    | "oneRM"
    | "hrZones"
    | "macros"
    | "bodyFat"
    | "water"
    | "karvonen"
    | "bmi"
    | "intensityHR";
  input: Record<string, any>; // JSONB
  output: Record<string, any>; // JSONB (CalculationResult subtype)
  formulaVersion: string; // "v1.0"
  metadata?: Record<string, any>;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/**
 * Query filters for calculator results
 */
export interface CalculatorResultsQueryFilter {
  clientId: string;
  calculatorType?: string;
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  limit?: number;
  offset?: number;
}

// ============================================================
// 10. EXPORT FORMATS
// ============================================================

export interface CalculatorResultExportRow {
  date: string;
  calculator: string;
  input: string; // JSON.stringify
  output: string; // JSON.stringify
  confidence: string;
  formulaVersion: string;
}

/**
 * CSV export row for calculator results
 */
export interface CSVExportRow {
  Date: string;
  Type: string;
  Input: string;
  Result: string;
  Confidence: string;
  Formula: string;
}

/**
 * PDF export data
 */
export interface PDFExportData {
  clientName: string;
  dateRange: {
    start: string;
    end: string;
  };
  results: Array<{
    calculator: string;
    timestamp: string;
    input: string;
    output: string;
  }>;
  generatedAt: string;
}
