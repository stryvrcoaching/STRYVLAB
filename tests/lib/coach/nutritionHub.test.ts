import { describe, expect, it } from "vitest";
import {
  buildNutritionHubInsights,
  buildNutritionHubSummary,
  classifyNutritionAgendaDay,
} from "@/lib/coach/nutritionHub";

describe("nutritionHub", () => {
  it("caps adherence at 1 for score computation", () => {
    const result = buildNutritionHubSummary([
      {
        dayKind: "training",
        completeness: "complete",
        consumed: {
          calories: 2200,
          protein_g: 180,
          carbs_g: 210,
          fat_g: 70,
          hydration_ml: 3200,
        },
        target: {
          calories: 2000,
          protein_g: 160,
          carbs_g: 200,
          fat_g: 70,
          hydration_ml: 3000,
        },
      },
    ]);

    expect(result.adherenceCalories).toBe(1);
    expect(result.adherenceProtein).toBe(1);
    expect(result.achievedCalories).toBe(1.1);
    expect(result.achievedProtein).toBe(1.13);
    expect(result.nutritionScore).toBeGreaterThan(0.9);
  });

  it("flags repeated low protein adherence", () => {
    const insights = buildNutritionHubInsights([
      {
        dayKind: "training",
        completeness: "complete",
        adherence: { protein: 0.72, carbs: 0.95, hydration: 0.9 },
        deltaPct: { calories: -0.06 },
      },
      {
        dayKind: "training",
        completeness: "complete",
        adherence: { protein: 0.8, carbs: 0.92, hydration: 0.88 },
        deltaPct: { calories: -0.03 },
      },
      {
        dayKind: "off",
        completeness: "complete",
        adherence: { protein: 0.74, carbs: 0.86, hydration: 0.8 },
        deltaPct: { calories: 0.02 },
      },
      {
        dayKind: "training",
        completeness: "complete",
        adherence: { protein: 0.79, carbs: 0.78, hydration: 0.72 },
        deltaPct: { calories: 0.01 },
      },
    ]);

    expect(insights.some((item) => item.title.match(/protéines/i))).toBe(true);
  });

  it("classifies partial days before under/over target", () => {
    expect(
      classifyNutritionAgendaDay({
        completeness: "partial",
        consumed: { calories: 1200 },
        target: { calories: 2200 },
      }),
    ).toBe("partial");
  });

  it("returns no_target when no calorie target exists", () => {
    expect(
      classifyNutritionAgendaDay({
        completeness: "complete",
        consumed: { calories: 1700 },
        target: { calories: null },
      }),
    ).toBe("no_target");
  });
});
