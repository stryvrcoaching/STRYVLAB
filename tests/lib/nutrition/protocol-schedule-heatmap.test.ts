import { describe, expect, it } from "vitest";
import { findDefaultDayIndex } from "@/components/nutrition/studio/ProtocolScheduleHeatmap";
import type { DayDraft } from "@/lib/nutrition/types";

describe("findDefaultDayIndex", () => {
  it("maps training and rest days from carb cycle roles when labels are Jour haut / Jour bas", () => {
    const days: DayDraft[] = [
      {
        localId: "high",
        name: "Jour haut",
        calories: "2300",
        protein_g: "180",
        carbs_g: "250",
        fat_g: "60",
        hydration_ml: "3000",
        role: "training",
        carb_cycle_type: "high",
        cycle_sync_phase: "",
        recommendations: "",
        meal_plan: [],
      },
      {
        localId: "low",
        name: "Jour bas",
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

    expect(findDefaultDayIndex(days, "training")).toBe(0);
    expect(findDefaultDayIndex(days, "rest")).toBe(1);
    expect(findDefaultDayIndex(days, "rest_with_activity")).toBe(1);
  });

  it("falls back to calorie density when no explicit labels or carb cycle roles exist", () => {
    const days: DayDraft[] = [
      {
        localId: "a",
        name: "Jour A",
        calories: "2100",
        protein_g: "170",
        carbs_g: "190",
        fat_g: "65",
        hydration_ml: "2800",
        role: "neutral",
        carb_cycle_type: "",
        cycle_sync_phase: "",
        recommendations: "",
        meal_plan: [],
      },
      {
        localId: "b",
        name: "Jour B",
        calories: "1750",
        protein_g: "170",
        carbs_g: "110",
        fat_g: "70",
        hydration_ml: "2800",
        role: "neutral",
        carb_cycle_type: "",
        cycle_sync_phase: "",
        recommendations: "",
        meal_plan: [],
      },
    ];

    expect(findDefaultDayIndex(days, "training")).toBe(0);
    expect(findDefaultDayIndex(days, "rest")).toBe(1);
  });
});
