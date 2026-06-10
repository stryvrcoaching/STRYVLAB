import { describe, expect, it } from "vitest";
import { deriveNutritionRealityView } from "@/components/nutrition/studio/useNutritionReality";

describe("deriveNutritionRealityView", () => {
  it("keeps only top 3 insights and latest 3 days", () => {
    const result = deriveNutritionRealityView({
      summary: {
        adherenceCalories: 0.9,
        adherenceProtein: 0.8,
        adherenceCarbs: 0.7,
        adherenceFat: 0.85,
        adherenceHydration: 0.75,
        nutritionScore: 0.82,
        validDays: 7,
      },
      trend: {
        window: 7,
        points: [],
      },
      insights: [
        { id: "1", severity: "alert", title: "A", message: "a" },
        { id: "2", severity: "watch", title: "B", message: "b" },
        { id: "3", severity: "watch", title: "C", message: "c" },
        { id: "4", severity: "good", title: "D", message: "d" },
      ],
      agenda: [
        {
          date: "2026-05-30",
          status: "under",
          mealCount: 3,
          dayKind: "training",
          consumed: {
            calories: 1800,
            protein_g: 120,
            carbs_g: 150,
            fat_g: 60,
            hydration_ml: 1800,
          },
          target: {
            calories: 2200,
            protein_g: 160,
            carbs_g: 220,
            fat_g: 70,
            hydration_ml: 3000,
          },
        },
        {
          date: "2026-05-31",
          status: "over",
          mealCount: 4,
          dayKind: "off",
          consumed: {
            calories: 2400,
            protein_g: 140,
            carbs_g: 210,
            fat_g: 80,
            hydration_ml: 2100,
          },
          target: {
            calories: 2200,
            protein_g: 160,
            carbs_g: 220,
            fat_g: 70,
            hydration_ml: 3000,
          },
        },
        {
          date: "2026-06-01",
          status: "under",
          mealCount: 3,
          dayKind: "training",
          consumed: {
            calories: 1900,
            protein_g: 145,
            carbs_g: 170,
            fat_g: 55,
            hydration_ml: 2200,
          },
          target: {
            calories: 2200,
            protein_g: 160,
            carbs_g: 220,
            fat_g: 70,
            hydration_ml: 3000,
          },
        },
        {
          date: "2026-06-02",
          status: "partial",
          mealCount: 2,
          dayKind: "training",
          consumed: {
            calories: 1300,
            protein_g: 90,
            carbs_g: 110,
            fat_g: 40,
            hydration_ml: 900,
          },
          target: {
            calories: 2200,
            protein_g: 160,
            carbs_g: 220,
            fat_g: 70,
            hydration_ml: 3000,
          },
        },
      ],
      dataQuality: {
        validDays: 7,
        partialDays: 1,
        missingMealDays: 0,
        missingHydrationDays: 1,
      },
      availableWindows: [3, 7, 14, 30],
    });

    expect(result.topInsights).toHaveLength(3);
    expect(result.recentDays).toHaveLength(3);
    expect(result.availableWindows).toEqual([3, 7]);
  });
});
