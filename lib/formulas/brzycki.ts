// ============================================================
// lib/formulas/brzycki.ts
// Brzycki 1RM formula for estimating maximum strength
// ============================================================

import { FormulaResult, FORMULA_VERSIONS, CONFIDENCE_MARGINS } from "./types";
import { validateBrzycki1RM, throwIfInvalid } from "./validators";

/**
 * Input interface for Brzycki 1RM calculation
 */
export interface Brzycki1RMInput {
  weight: number; // kg
  reps: number; // 1-37 reps (valid range for Brzycki)
  equipment?: "barbell" | "dumbbell" | "machine";
}

/**
 * Training zone for strength development
 */
export interface TrainingZone {
  zone: string; // e.g., "Strength (90%)"
  percentageOfMax: number; // 50-100
  repsRange: [number, number]; // [minReps, maxReps]
  objective: string; // e.g., "Max Strength"
  intensity: number; // Same as percentageOfMax
}

/**
 * Output of Brzycki 1RM calculation
 */
export interface Brzycki1RMOutput extends FormulaResult {
  oneRM: number; // kg, rounded to 0.5 kg
  zones: TrainingZone[];
  formula: "Brzycki";
}

/**
 * Calculate 1RM using Brzycki formula
 * Formula: 1RM = weight / (1.0278 - 0.0278 × reps)
 *
 * Accuracy: ±15% for 1-10 reps, degrades beyond
 * Valid range: 1-37 reps (loses accuracy beyond 37)
 *
 * Example:
 *   calculate1RMBrzycki({ weight: 100, reps: 5 })
 *   → { oneRM: 113.6, zones: [...], formula: 'Brzycki', ... }
 */
export function calculate1RMBrzycki(input: Brzycki1RMInput): Brzycki1RMOutput {
  // Validate input
  const validation = validateBrzycki1RM(input);
  throwIfInvalid(validation, "Brzycki 1RM");

  const { weight, reps } = input;

  // Apply Brzycki formula
  const oneRMRaw = weight / (1.0278 - 0.0278 * reps);

  // Round to 0.5 kg
  const oneRM = Math.round(oneRMRaw * 2) / 2;

  // Calculate training zones based on 1RM
  const zones = calculateTrainingZones(oneRM);

  // Get confidence margin based on rep range
  const confidence = CONFIDENCE_MARGINS.BRZYCKI_1RM(reps);

  return {
    oneRM,
    zones,
    formula: "Brzycki",
    formulaVersion: FORMULA_VERSIONS.BRZYCKI_1RM,
    calculatedAt: new Date().toISOString(),
    confidence,
  };
}

/**
 * Calculate training zones based on 1RM
 * Provides intensity recommendations for different training objectives
 */
function calculateTrainingZones(oneRM: number): TrainingZone[] {
  return [
    {
      zone: "Max Strength (1RM)",
      percentageOfMax: 100,
      intensity: 100,
      repsRange: [1, 1] as [number, number],
      objective: "Maximum Strength - Single Attempt",
    },
    {
      zone: "Heavy Strength (95%)",
      percentageOfMax: 95,
      intensity: 95,
      repsRange: [2, 3] as [number, number],
      objective: "Max Strength Development",
    },
    {
      zone: "Strength (90%)",
      percentageOfMax: 90,
      intensity: 90,
      repsRange: [3, 5],
      objective: "Strength with Low Reps",
    },
    {
      zone: "Strength-Hypertrophy (85%)",
      percentageOfMax: 85,
      intensity: 85,
      repsRange: [5, 7],
      objective: "Strength + Size",
    },
    {
      zone: "Hypertrophy (80%)",
      percentageOfMax: 80,
      intensity: 80,
      repsRange: [6, 10],
      objective: "Muscle Growth - Primary",
    },
    {
      zone: "Hypertrophy-Endurance (75%)",
      percentageOfMax: 75,
      intensity: 75,
      repsRange: [8, 12],
      objective: "Hypertrophy with Moderate Volume",
    },
    {
      zone: "Muscular Endurance (70%)",
      percentageOfMax: 70,
      intensity: 70,
      repsRange: [10, 15],
      objective: "Work Capacity + Pump",
    },
    {
      zone: "Endurance (65%)",
      percentageOfMax: 65,
      intensity: 65,
      repsRange: [12, 20],
      objective: "High Reps - Volume Focus",
    },
    {
      zone: "Light Endurance (60%)",
      percentageOfMax: 60,
      intensity: 60,
      repsRange: [15, 25],
      objective: "Recovery + Conditioning",
    },
    {
      zone: "Warm-up (50%)",
      percentageOfMax: 50,
      intensity: 50,
      repsRange: [20, 30],
      objective: "Technique + Warm-up",
    },
  ].map((zone) => ({
    ...zone,
    // Add calculated weight at each intensity
    weight: Math.round(((oneRM * zone.percentageOfMax) / 100) * 2) / 2,
  })) as unknown as TrainingZone[];
}

/**
 * Verify if Brzycki formula is appropriate for given reps
 * Returns false if reps > 37 (loses accuracy)
 */
export function isBrzyckiApplicable(reps: number): boolean {
  return reps >= 1 && reps <= 37;
}

/**
 * Get accuracy warning for given rep range
 */
export function getBrzyckiAccuracyWarning(reps: number): string | null {
  if (reps <= 10) {
    return null; // Good accuracy range
  }

  if (reps <= 37) {
    const degradation = Math.round((reps - 10) * 1.5);
    return `Accuracy degrades for high reps. Margin of error ~±${Math.min(degradation + 15, 40)}%`;
  }

  return "Brzycki formula not reliable beyond 37 reps. Consider using form-based assessment instead.";
}
