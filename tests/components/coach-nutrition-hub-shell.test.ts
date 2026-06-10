// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import NutritionHub from "@/components/clients/NutritionHub";

describe("NutritionHub", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("renders nutrition skeleton first then the nutrition hub shell", async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

    let resolveFetch: ((value: any) => void) | null = null;
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    ) as any;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(React.createElement(NutritionHub, { clientId: "client-1" }));
    });

    expect(container.textContent).not.toMatch(/chargement/i);
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);

    await act(async () => {
      resolveFetch?.({
        ok: true,
        json: async () => ({
          summary: {
            adherenceCalories: 0.92,
            adherenceProtein: 0.81,
            adherenceCarbs: 0.76,
            adherenceFat: 0.88,
            adherenceHydration: 0.72,
            nutritionScore: 0.83,
            validDays: 7,
          },
          trend: {
            window: 7,
            points: [
              {
                date: "2026-06-01",
                consumed: {
                  calories: 1900,
                  protein_g: 140,
                  carbs_g: 180,
                  fat_g: 65,
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
            ],
          },
          insights: [
            {
              id: "protein-low",
              severity: "watch",
              title: "Protéines sous cible",
              message: "Le client reste sous la cible protéique sur plusieurs journées.",
            },
          ],
          agenda: [
            {
              date: "2026-06-01",
              dayKind: "training",
              status: "under",
              mealCount: 3,
              consumed: {
                calories: 1900,
                protein_g: 140,
                carbs_g: 180,
                fat_g: 65,
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
          ],
          dataQuality: {
            validDays: 7,
            partialDays: 0,
            missingMealDays: 0,
            missingHydrationDays: 1,
          },
        }),
      });
      await Promise.resolve();
    });

    expect(container.textContent).toMatch(/vue coach temps réel/i);
    expect(container.textContent).toMatch(/synthèse/i);
    expect(container.textContent).toMatch(/journée à auditer/i);
  });
});
