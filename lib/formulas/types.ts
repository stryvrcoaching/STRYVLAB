// ============================================================
// lib/formulas/types.ts
// Shared types and interfaces for formula calculations
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
 * Base interface for all calculation results
 * Every calculator must return this structure
 */
export interface FormulaResult {
  formula: string; // e.g., "Brzycki", "Katch-McArdle"
  formulaVersion: string; // "v1.0" for versioning & reproducibility
  calculatedAt: string; // ISO 8601 timestamp
  confidence: ConfidenceMargin;
}

/**
 * Validation error thrown by formula functions
 */
export interface ValidationError {
  field: string;
  message: string;
  value: any;
}

/**
 * Result of input validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ============================================================
// Calculator type union for type safety
// ============================================================

export type CalculatorType =
  | "oneRM"
  | "hrZones"
  | "macros"
  | "bodyFat"
  | "water"
  | "karvonen"
  | "bmi"
  | "intensityHR";

// ============================================================
// Gender enum
// ============================================================

export const GENDER_VALUES = ["M", "F", "other"] as const;
export type Gender = (typeof GENDER_VALUES)[number];

// ============================================================
// Activity level enum
// ============================================================

export const ACTIVITY_LEVELS = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
] as const;

export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

// ============================================================
// Constants for formulas
// ============================================================

/**
 * STRYVR Formula Version Map
 * Update these when formula implementations change
 */
export const FORMULA_VERSIONS = {
  BRZYCKI_1RM: "v1.0",
  KARVONEN_ZONES: "v1.0",
  KATCH_MCARDLE: "v1.0",
  JACKSON_POLLOCK_3: "v1.0",
  JACKSON_POLLOCK_7: "v1.0",
  WATER_DYNAMICS: "v1.0",
  BMI: "v1.0",
} as const;

/**
 * Valid ranges for common inputs
 */
export const INPUT_RANGES = {
  AGE: { min: 15, max: 120 },
  WEIGHT: { min: 30, max: 500 }, // kg
  HEIGHT: { min: 120, max: 230 }, // cm
  BODY_FAT: { min: 1, max: 99 },
  REPS: { min: 1, max: 50 },
  HEART_RATE: { min: 30, max: 200 }, // bpm
  INTENSITY: { min: 0, max: 100 }, // percentage
} as const;

/**
 * Accuracy margins for each formula
 */
export const CONFIDENCE_MARGINS = {
  BRZYCKI_1RM: (reps: number): ConfidenceMargin => ({
    percentageRange: reps <= 10 ? 15 : Math.min(25, 15 + (reps - 10) * 1.5),
    absoluteRange: 5, // ±5 kg
  }),
  KARVONEN_ZONES: (): ConfidenceMargin => ({
    percentageRange: 5,
    absoluteRange: 5, // ±5 bpm
  }),
  KATCH_MCARDLE: (): ConfidenceMargin => ({
    percentageRange: 10,
    absoluteRange: 100, // ±100 kcal
  }),
  BMI: (): ConfidenceMargin => ({
    percentageRange: 0,
    absoluteRange: 0.5, // ±0.5 BMI
  }),
} as const;

// ============================================================
// Enums for result categories
// ============================================================

export const BODY_FAT_CATEGORIES = {
  M: {
    ESSENTIAL: 2, // <= 2%
    ATHLETES: 6, // 3-6%
    FITNESS: 13, // 7-13%
    AVERAGE: 18, // 14-18%
    HIGH: 25, // 19-25%
  },
  F: {
    ESSENTIAL: 10, // <= 10%
    ATHLETES: 14, // 11-14%
    FITNESS: 20, // 15-20%
    AVERAGE: 25, // 21-25%
    HIGH: 32, // 26-32%
  },
} as const;

export const BMI_CATEGORIES = {
  UNDERWEIGHT: 18.5,
  NORMAL: 25,
  OVERWEIGHT: 30,
  OBESE: Number.POSITIVE_INFINITY,
} as const;

export const BMI_HEALTH_RISK = {
  UNDERWEIGHT: "moderate",
  NORMAL: "low",
  OVERWEIGHT: "moderate",
  OBESE: "high",
} as const;
