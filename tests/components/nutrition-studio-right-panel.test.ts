// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import NutritionStudioRightPanel from "@/components/nutrition/studio/NutritionStudioRightPanel";

describe("NutritionStudioRightPanel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the analysis tab when selected", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        React.createElement(NutritionStudioRightPanel, {
          activeTab: "analysis",
          onTabChange: () => {},
          analysis: {
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
                    calories: 1980,
                    protein_g: 149,
                    carbs_g: 176,
                    fat_g: 63,
                    hydration_ml: 2250,
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
              topInsights: [],
              recentDays: [],
              availableWindows: [3, 7],
            },
          },
          protocol: {
            loading: false,
            protocolName: "Plan nutrition",
            onProtocolNameChange: () => {},
            days: [],
            activeDayIndex: 0,
            onActiveDayChange: () => {},
            onUpdateDay: () => {},
            onAddDay: () => {},
            onRemoveDay: () => {},
            onInjectMacros: () => {},
            onInjectHydration: () => {},
            onInjectAll: () => {},
            hasMacroResult: false,
            hasHydration: false,
            coherenceScore: {
              score: 0,
              breakdown: {
                kcal: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
                hydration: 0,
              },
              warnings: [],
            },
            shareIssues: [],
            trainingWeekSchedule: null,
            selectedScheduleDow: null,
            onSelectScheduleDow: () => {},
            scheduleSlots: [],
            onScheduleSlotsChange: () => {},
          },
        }),
      );
    });

    expect(container.textContent).toMatch(/analyse nutritionnelle/i);
    expect(container.textContent).toMatch(/score global nutrition/i);
    expect(container.textContent).toMatch(/smart nutrition/i);
  });
});
