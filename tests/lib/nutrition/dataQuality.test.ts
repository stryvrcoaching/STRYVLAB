import { describe, expect, it } from "vitest";
import { buildNutritionDataQualitySummary } from "@/lib/nutrition/dataQuality";
import {
  buildNutritionDataQualityHeadline,
  getNutritionDataConfidenceLabel,
  getNutritionDataQualityIssues,
} from "@/lib/nutrition/dataQualityPresentation";
import type { NutritionClientData } from "@/lib/nutrition/types";
import { calculateMacros } from "@/lib/formulas/macros";

const baseClient: NutritionClientData = {
  id: "c1",
  name: "Test Client",
  gender: "male",
  age: 30,
  height_cm: 180,
  weight_kg: 80,
  body_fat_pct: 15,
  muscle_mass_kg: 60,
  lean_mass_kg: 68,
  bmr_kcal_measured: 1760,
  visceral_fat_level: 7,
  weekly_frequency: 4,
  training_goal: "fat_loss",
  sport_practice: null,
  session_duration_min: 75,
  training_calories_weekly: 2400,
  cardio_frequency: 1,
  cardio_duration_min: 30,
  daily_steps: 9500,
  stress_level: 4,
  sleep_duration_h: 7.5,
  sleep_quality: 4,
  energy_level: 7,
  caffeine_daily_mg: 180,
  alcohol_weekly: 1,
  work_hours_per_week: 40,
  menstrual_cycle: null,
  occupation: null,
  occupation_multiplier: 1,
};

describe("nutrition data quality", () => {
  it("scores a strong realtime payload as high confidence", () => {
    const summary = buildNutritionDataQualitySummary({
      clientData: baseClient,
      dataMode: "realtime",
      dataSource: {
        weight_kg: "selected",
        bmr_kcal_measured: "selected",
        daily_steps: "selected",
        sleep_duration_h: "selected",
        stress_level: "selected",
      },
    });

    expect(summary).not.toBeNull();
    expect(summary?.confidence).toBe("high");
    expect(summary?.score).toBeGreaterThanOrEqual(75);
  });

  it("penalizes fallback-heavy data and tempers recommendations", () => {
    const summary = buildNutritionDataQualitySummary({
      clientData: {
        ...baseClient,
        body_fat_pct: null,
        lean_mass_kg: null,
        muscle_mass_kg: null,
        daily_steps: null,
      },
      dataMode: "bilan",
      dataSource: {
        weight_kg: "fallback",
        body_fat_pct: "fallback",
        daily_steps: "fallback",
      },
    });

    expect(summary).not.toBeNull();
    expect(summary?.confidence).toBe("low");

    const result = calculateMacros({
      weight: 80,
      height: 180,
      age: 30,
      gender: "male",
      goal: "deficit",
      steps: 0,
      workouts: 4,
      sleepDurationH: 6,
      stressLevel: 8,
      dataQuality: summary,
    });

    expect(result.dataQuality?.confidence).toBe("low");
    expect(result.smartProtocol[0]?.id).toBe("data_quality_low");
    expect(result.contextFlags.some((flag) => flag.key === "data_quality_low")).toBe(true);
  });

  it("turns weak signals into actionable french guidance", () => {
    const summary = buildNutritionDataQualitySummary({
      clientData: {
        ...baseClient,
        body_fat_pct: null,
        daily_steps: null,
      },
      dataMode: "realtime",
      dataSource: {
        height_cm: "fallback",
      },
    });

    const issues = getNutritionDataQualityIssues(summary, "realtime");
    const headline = buildNutritionDataQualityHeadline(summary, "realtime");

    expect(getNutritionDataConfidenceLabel(summary?.confidence)).toBe("moyenne");
    expect(issues.some((issue) => issue.label === "nombre de pas")).toBe(true);
    expect(issues.some((issue) => issue.action.includes("check-in du soir"))).toBe(true);
    expect(headline).toContain("à consolider en priorité");
  });

  it("falls back to a day estimate when structural body data is omitted", () => {
    const result = calculateMacros({
      weight: 79.3,
      height: 180,
      age: 30,
      gender: "male",
      goal: "maintenance",
      steps: 9000,
      workouts: 4,
      sessionDurationMin: 75,
      stressLevel: 2,
      sleepDurationH: 7.1,
    });

    expect(result.dataProvenance.bmrSource).toBe("mifflin");
  });
});
