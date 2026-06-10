// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import NutritionHeroPanel from "@/components/clients/nutrition-hub/NutritionHeroPanel";

describe("NutritionHeroPanel", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the score, status, and summary", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        React.createElement(NutritionHeroPanel, {
          summary: {
            adherenceCalories: 0.92,
            adherenceProtein: 0.81,
            adherenceCarbs: 0.76,
            adherenceFat: 0.88,
            adherenceHydration: 0.72,
            nutritionScore: 0.83,
            validDays: 7,
          },
          status: {
            label: "Sous contrôle",
            tone: "green",
            detail: "L'exécution nutritionnelle reste globalement cohérente.",
          },
          heroSummary:
            "Les écarts se concentrent surtout sur protéines et hydratation.",
          coachAction: "Remonter l'hydratation des jours les plus instables.",
          latestDayLabel: "lundi 1 juin",
          windowLabel: "7 j",
        }),
      );
    });

    expect(container.textContent).toMatch(/83%/);
    expect(container.textContent).toMatch(/score global nutrition/i);
    expect(container.textContent).toMatch(/protéines/i);
  });
});
