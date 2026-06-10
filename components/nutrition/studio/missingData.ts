import type { NutritionSignalKey } from "@/lib/nutrition/dataGovernance";

export type MissingDataKey =
  | "bmr"
  | "weight"
  | "height"
  | "bf"
  | "steps"
  | "lean_mass"
  | "muscle_mass";

export function signalToMissingDataKey(
  key: NutritionSignalKey,
): MissingDataKey | null {
  switch (key) {
    case "bmr_kcal_measured":
      return "bmr";
    case "weight_kg":
      return "weight";
    case "height_cm":
      return "height";
    case "body_fat_pct":
      return "bf";
    case "daily_steps":
      return "steps";
    case "lean_mass_kg":
      return "lean_mass";
    case "muscle_mass_kg":
      return "muscle_mass";
    default:
      return null;
  }
}
