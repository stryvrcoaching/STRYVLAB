// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import NutritionAnalysisPanel from "@/components/nutrition/studio/NutritionAnalysisPanel";

describe("NutritionAnalysisPanel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders title, score, window toggles, and hub CTA", () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        React.createElement(NutritionAnalysisPanel, {
          loading: false,
          error: null,
          activeWindow: 7,
          onWindowChange: () => {},
          onOpenHub: () => {},
          view: {
            summary: {
              adherenceCalories: 0.92,
              adherenceProtein: 0.81,
              adherenceCarbs: 0.76,
              adherenceFat: 0.88,
              adherenceHydration: 0.72,
              achievedCalories: 0.98,
              achievedProtein: 0.91,
              achievedCarbs: 0.84,
              achievedFat: 1.12,
              achievedHydration: 0.73,
              nutritionScore: 0.83,
              validDays: 7,
            },
            trendPoints: [
              {
                date: "2026-05-31",
                consumed: {
                  calories: 2150,
                  protein_g: 150,
                  carbs_g: 210,
                  fat_g: 68,
                  hydration_ml: 2600,
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
                consumed: {
                  calories: 2050,
                  protein_g: 152,
                  carbs_g: 190,
                  fat_g: 72,
                  hydration_ml: 2400,
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
            ],
            topInsights: [
              {
                id: "1",
                severity: "alert",
                title: "Protéines insuffisantes",
                message: "...",
              },
            ],
            recentDays: [
              {
                date: "2026-06-02",
                dayKind: "training",
                status: "under",
                mealCount: 3,
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
            ],
            availableWindows: [3, 7],
          },
        }),
      );
    });

    expect(container.textContent).toMatch(/analyse nutritionnelle/i);
    expect(container.textContent).toMatch(/83%/);
    expect(container.textContent).toMatch(/ouvrir le hub/i);
    expect(container.textContent).toMatch(/3j/i);
    expect(container.textContent).toMatch(/7j/i);
    expect(container.textContent).toMatch(/consommé vs réel/i);
    expect(container.textContent).toMatch(/hydratation/i);
  });

  it("renders a compact empty state when no reality view is available", () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        React.createElement(NutritionAnalysisPanel, {
          loading: false,
          error: null,
          activeWindow: 7,
          onWindowChange: () => {},
          onOpenHub: () => {},
          view: null,
        }),
      );
    });

    expect(container.textContent).toMatch(/pas encore assez de données/i);
  });
});
