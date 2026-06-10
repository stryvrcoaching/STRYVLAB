/**
 * BMR and body composition calculation formulas
 * Used in Nutrition Studio parameter adjustment panel
 */

/**
 * Katch-McArdle formula: BMR = 370 + (21.6 × lean_body_mass_kg)
 * More accurate for individuals with known body composition
 */
export function calculateBMRKatchMcArdle(
  weight_kg: number,
  body_fat_pct: number,
): number | null {
  if (
    !weight_kg ||
    body_fat_pct === null ||
    body_fat_pct < 0 ||
    body_fat_pct > 100
  ) {
    return null;
  }
  const lean_mass = calculateLBMFromBF(weight_kg, body_fat_pct);
  if (lean_mass === null) return null;
  return Math.round(370 + 21.6 * lean_mass);
}

/**
 * Mifflin-St Jeor formula: BMR = (10×weight_kg) + (6.25×height_cm) - (5×age_years) ± 5
 * ± 5: +5 for men, -5 for women
 * More accurate for healthy range body fat
 */
export function calculateBMRMifflin(
  weight_kg: number,
  height_cm: number,
  age_years: number,
  gender: "M" | "F" | null,
): number | null {
  if (
    !weight_kg ||
    !height_cm ||
    !age_years ||
    age_years < 10 ||
    age_years > 120
  ) {
    return null;
  }
  const genderAdjust = gender === "F" ? -5 : gender === "M" ? 5 : 0;
  return Math.round(
    10 * weight_kg + 6.25 * height_cm - 5 * age_years + genderAdjust,
  );
}

/**
 * Lean body mass from body fat percentage
 * LBM = weight_kg × (1 - body_fat_pct / 100)
 */
export function calculateLBMFromBF(
  weight_kg: number,
  body_fat_pct: number,
): number | null {
  if (
    !weight_kg ||
    body_fat_pct === null ||
    body_fat_pct < 0 ||
    body_fat_pct > 100
  ) {
    return null;
  }
  return Math.round(((weight_kg * (100 - body_fat_pct)) / 100) * 10) / 10;
}

/**
 * Estimate muscle mass from body composition
 * Simple heuristic: muscle_mass ≈ LBM × 0.85 (rest is bone, organs, water)
 */
export function calculateMuscleMassFromBF(
  weight_kg: number,
  body_fat_pct: number,
): number | null {
  const lbm = calculateLBMFromBF(weight_kg, body_fat_pct);
  if (lbm === null) return null;
  return Math.round(lbm * 0.85 * 10) / 10;
}

/**
 * Format BMR result with source label
 */
export type BMRSource = "measured" | "estimated" | "calculated";

export interface BMRResult {
  value: number;
  source: BMRSource;
  formula?: "katch-mcardle" | "mifflin-st-jeor";
}

export function describeBMRFormula(
  formula: "katch-mcardle" | "mifflin-st-jeor",
): string {
  if (formula === "katch-mcardle") {
    return "Katch-McArdle (370 + 21.6 × LBM)";
  }
  return "Mifflin-St Jeor (10W + 6.25H - 5A ± 5)";
}
