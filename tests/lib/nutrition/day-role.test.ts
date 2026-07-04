import { describe, expect, it } from "vitest";
import {
  getNutritionDayIndexesByRole,
  inferNutritionDayRoles,
} from "@/lib/nutrition/day-role";
import type { DayDraft } from "@/lib/nutrition/types";

describe("nutrition day roles", () => {
  it("infers explicit training and rest roles from free coach labels", () => {
    const days: DayDraft[] = [
      {
        localId: "push",
        name: "Push lourd",
        calories: "2400",
        protein_g: "180",
        carbs_g: "260",
        fat_g: "60",
        hydration_ml: "3000",
        role: "neutral",
        carb_cycle_type: "",
        cycle_sync_phase: "",
        recommendations: "",
        meal_plan: [],
      },
      {
        localId: "off",
        name: "Recovery off",
        calories: "1800",
        protein_g: "180",
        carbs_g: "120",
        fat_g: "70",
        hydration_ml: "3000",
        role: "neutral",
        carb_cycle_type: "",
        cycle_sync_phase: "",
        recommendations: "",
        meal_plan: [],
      },
    ];

    expect(inferNutritionDayRoles(days)).toEqual(["training", "rest"]);
    expect(getNutritionDayIndexesByRole(days, "training")).toEqual([0]);
    expect(getNutritionDayIndexesByRole(days, "rest")).toEqual([1]);
  });

  it("keeps multiple explicit role matches so the UI can ask the coach", () => {
    const days: DayDraft[] = [
      {
        localId: "a",
        name: "Push",
        calories: "2400",
        protein_g: "180",
        carbs_g: "260",
        fat_g: "60",
        hydration_ml: "3000",
        role: "training",
        carb_cycle_type: "high",
        cycle_sync_phase: "",
        recommendations: "",
        meal_plan: [],
      },
      {
        localId: "b",
        name: "Legs",
        calories: "2300",
        protein_g: "180",
        carbs_g: "240",
        fat_g: "60",
        hydration_ml: "3000",
        role: "training",
        carb_cycle_type: "high",
        cycle_sync_phase: "",
        recommendations: "",
        meal_plan: [],
      },
      {
        localId: "c",
        name: "Repos",
        calories: "1800",
        protein_g: "180",
        carbs_g: "120",
        fat_g: "70",
        hydration_ml: "3000",
        role: "rest",
        carb_cycle_type: "low",
        cycle_sync_phase: "",
        recommendations: "",
        meal_plan: [],
      },
    ];

    expect(getNutritionDayIndexesByRole(days, "training")).toEqual([0, 1]);
    expect(getNutritionDayIndexesByRole(days, "rest")).toEqual([2]);
  });
});
