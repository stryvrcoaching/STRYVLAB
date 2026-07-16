import type { DayDraft, NutritionProtocolDay } from "@/lib/nutrition/types";

export type NutritionDayRole = "training" | "rest" | "neutral";

export const NUTRITION_DAY_ROLE_LABELS: Record<NutritionDayRole, string> = {
  training: "Entraînement",
  rest: "Repos",
  neutral: "Neutre",
};

const TRAINING_RE = /entra[îi]n|training|sport|muscu|push|pull|legs|jambe|perf/i;
const REST_RE = /repos|rest|recovery|off|regen|recup|récup|deload/i;

type RoleDayShape = {
  name: string;
  calories: string | number | null | undefined;
  carbs_g: string | number | null | undefined;
  carb_cycle_type: DayDraft["carb_cycle_type"] | NutritionProtocolDay["carb_cycle_type"];
  role?: NutritionDayRole | "";
};

function normalizeStoredRole(role: string | null | undefined): NutritionDayRole | null {
  if (role === "training" || role === "rest" || role === "neutral") return role;
  return null;
}

function rankDaysByLoad(days: RoleDayShape[]) {
  return days
    .map((day, index) => ({
      index,
      calories: Number(day.calories),
      carbs: Number(day.carbs_g),
    }))
    .filter((day) => Number.isFinite(day.calories) || Number.isFinite(day.carbs))
    .sort((a, b) => {
      const caloriesDelta =
        (Number.isFinite(b.calories) ? b.calories : -Infinity)
        - (Number.isFinite(a.calories) ? a.calories : -Infinity);
      if (caloriesDelta !== 0) return caloriesDelta;
      return (
        (Number.isFinite(b.carbs) ? b.carbs : -Infinity)
        - (Number.isFinite(a.carbs) ? a.carbs : -Infinity)
      );
    });
}

export function inferNutritionDayRole(day: RoleDayShape): NutritionDayRole {
  const explicitRole = normalizeStoredRole(day.role);
  if (explicitRole) return explicitRole;

  const name = day.name.toLowerCase();
  if (TRAINING_RE.test(name)) return "training";
  if (REST_RE.test(name)) return "rest";
  if (day.carb_cycle_type === "high") return "training";
  if (day.carb_cycle_type === "low") return "rest";
  return "neutral";
}

export function inferNutritionDayRoles(days: RoleDayShape[]): NutritionDayRole[] {
  const inferred = days.map((day) => inferNutritionDayRole(day));
  const ranked = rankDaysByLoad(days);
  const highestLoadIdx = ranked[0]?.index ?? null;
  const lowestLoadIdx = ranked.at(-1)?.index ?? null;

  if (!inferred.includes("training") && highestLoadIdx != null) {
    inferred[highestLoadIdx] = "training";
  }

  if (!inferred.includes("rest") && lowestLoadIdx != null) {
    inferred[lowestLoadIdx] = "rest";
  }

  return inferred;
}

export function getNutritionDayIndexesByRole(
  days: RoleDayShape[],
  role: Exclude<NutritionDayRole, "neutral">,
): number[] {
  return inferNutritionDayRoles(days)
    .map((dayRole, index) => (dayRole === role ? index : -1))
    .filter((index) => index >= 0);
}

export function getNutritionDaysByRole(
  days: NutritionProtocolDay[],
  role: Exclude<NutritionDayRole, "neutral">,
): NutritionProtocolDay[] {
  const indexes = getNutritionDayIndexesByRole(days, role);
  return indexes.map((index) => days[index]).filter(Boolean);
}
