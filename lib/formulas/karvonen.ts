// ============================================================
// lib/formulas/karvonen.ts
// Karvonen formula for HR zones calculation
// ============================================================

import { FormulaResult, FORMULA_VERSIONS, CONFIDENCE_MARGINS } from "./types";
import { validateKarvonen, throwIfInvalid } from "./validators";

/**
 * Input interface for Karvonen HR zones
 */
export interface KarvonenInput {
  age: number; // years (15-120)
  restingHeartRate?: number; // bpm (default 60 if not provided)
  targetZone?: "Z1" | "Z2" | "Z3" | "Z4" | "Z5";
}

/**
 * Heart rate zone definition
 */
export interface HeartRateZone {
  zone: string; // Z1, Z2, etc.
  name: string; // Recovery, Aerobic, etc.
  minHR: number; // bpm
  maxHR: number; // bpm
  percentageReserve: {
    min: number;
    max: number;
  };
  objective: string;
  color?: string; // For UI visualization
}

/**
 * Output of Karvonen calculation
 */
export interface KarvonenOutput extends FormulaResult {
  maxHeartRate: number; // bpm (220 - age)
  heartRateReserve: number; // maxHR - restingHR
  zones: HeartRateZone[];
  formula: "Karvonen";
}

/**
 * Calculate Heart Rate zones using Karvonen formula
 * Formula: HRR = MaxHR - RestingHR
 *          TargetHR = (HRR × Intensity%) + RestingHR
 *
 * Example:
 *   calculateKarvonenZones({ age: 35, restingHeartRate: 60 })
 *   → { maxHeartRate: 185, heartRateReserve: 125, zones: [...], ... }
 */
export function calculateKarvonenZones(input: KarvonenInput): KarvonenOutput {
  // Set default resting HR if not provided
  const restingHeartRate = input.restingHeartRate ?? 60;

  // Validate input
  const validation = validateKarvonen({ ...input, restingHeartRate });
  throwIfInvalid(validation, "Karvonen HR Zones");

  const { age } = input;

  // Step 1: Calculate max heart rate (220 - age formula)
  const maxHeartRate = 220 - age;

  // Step 2: Calculate heart rate reserve
  const heartRateReserve = maxHeartRate - restingHeartRate;

  // Step 3: Calculate zones based on percentage of HRR
  const zones = calculateHRZones(heartRateReserve, restingHeartRate);

  // Get confidence margin
  const confidence = CONFIDENCE_MARGINS.KARVONEN_ZONES();

  return {
    maxHeartRate,
    heartRateReserve,
    zones,
    formula: "Karvonen",
    formulaVersion: FORMULA_VERSIONS.KARVONEN_ZONES,
    calculatedAt: new Date().toISOString(),
    confidence,
  };
}

/**
 * Calculate all 5 training zones based on HRR percentages
 */
function calculateHRZones(hrr: number, restingHR: number): HeartRateZone[] {
  type PartialZone = Omit<HeartRateZone, "minHR" | "maxHR">;

  const zones: PartialZone[] = [
    {
      zone: "Z1",
      name: "Recovery",
      percentageReserve: { min: 50, max: 60 },
      objective: "Active recovery, conversational pace",
      color: "#4CAF50", // Green
    },
    {
      zone: "Z2",
      name: "Aerobic Base",
      percentageReserve: { min: 60, max: 70 },
      objective: "Fat burning, long duration workouts",
      color: "#2196F3", // Blue
    },
    {
      zone: "Z3",
      name: "Tempo",
      percentageReserve: { min: 70, max: 80 },
      objective: "Sustainable effort, threshold training",
      color: "#FF9800", // Orange
    },
    {
      zone: "Z4",
      name: "VO2 Max",
      percentageReserve: { min: 80, max: 90 },
      objective: "High intensity intervals, max aerobic power",
      color: "#F44336", // Red
    },
    {
      zone: "Z5",
      name: "Maximum Effort",
      percentageReserve: { min: 90, max: 100 },
      objective: "Anaerobic threshold, max effort sprints",
      color: "#9C27B0", // Purple
    },
  ];

  // Calculate actual HR values for each zone
  return zones.map((zone) => {
    const minHR = Math.round(
      (hrr * zone.percentageReserve.min) / 100 + restingHR,
    );
    const maxHR = Math.round(
      (hrr * zone.percentageReserve.max) / 100 + restingHR,
    );

    return {
      ...zone,
      minHR,
      maxHR,
    } as HeartRateZone;
  });
}

/**
 * Get HR range for a specific intensity percentage
 */
export function getHRAtIntensity(
  hrr: number,
  restingHR: number,
  intensityPercent: number,
): number {
  return Math.round((hrr * intensityPercent) / 100 + restingHR);
}

/**
 * Get zone name for a given heart rate
 */
export function getZoneAtHR(
  hr: number,
  zones: HeartRateZone[],
): HeartRateZone | null {
  return zones.find((z) => hr >= z.minHR && hr <= z.maxHR) ?? null;
}
