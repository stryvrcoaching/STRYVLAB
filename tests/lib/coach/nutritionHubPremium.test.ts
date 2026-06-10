import { describe, expect, it } from "vitest";
import {
  deriveNutritionHeroStatus,
  deriveNutritionHeroSummary,
} from "@/lib/coach/nutritionHub";

describe("nutrition hub premium hero helpers", () => {
  it("returns intervention tone when score is low and insights are severe", () => {
    const result = deriveNutritionHeroStatus({
      nutritionScore: 0.61,
      partialDays: 1,
      validDays: 7,
      insights: [
        { severity: "alert", title: "Protéines insuffisantes", message: "..." },
      ],
    });

    expect(result.label).toBe("À corriger");
    expect(result.tone).toBe("amber");
  });

  it("returns fragile reading tone when data quality is weak", () => {
    const result = deriveNutritionHeroStatus({
      nutritionScore: 0.83,
      partialDays: 4,
      validDays: 7,
      insights: [],
    });

    expect(result.label).toBe("Lecture fragile");
    expect(result.tone).toBe("amber");
  });

  it("builds a concise summary from the weakest observed dimensions", () => {
    const result = deriveNutritionHeroSummary({
      adherenceCalories: 0.91,
      adherenceProtein: 0.72,
      adherenceCarbs: 0.87,
      adherenceFat: 0.88,
      adherenceHydration: 0.69,
      partialDays: 0,
    });

    expect(result).toMatch(/protéines/i);
    expect(result).toMatch(/hydratation/i);
  });
});
