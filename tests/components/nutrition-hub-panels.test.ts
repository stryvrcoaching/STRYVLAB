// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import NutritionKpiStrip from "@/components/clients/nutrition-hub/NutritionKpiStrip";
import NutritionTrendPanel from "@/components/clients/nutrition-hub/NutritionTrendPanel";

function renderIntoBody(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return container;
}

describe("nutrition hub panels", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders KPI percentages as whole-number percent labels", () => {
    const container = renderIntoBody(
      React.createElement(NutritionKpiStrip, {
        summary: {
          adherenceCalories: 0.92,
          adherenceProtein: 0.81,
          adherenceCarbs: 0.76,
          adherenceFat: 0.88,
          adherenceHydration: 0.72,
          achievedCalories: 0.92,
          achievedProtein: 0.81,
          achievedCarbs: 0.76,
          achievedFat: 0.88,
          achievedHydration: 0.72,
          nutritionScore: 0.83,
          validDays: 7,
        },
      }),
    );

    expect(container.textContent).toMatch(/92%/);
    expect(container.textContent).toMatch(/score global nutrition/i);
  });

  it("renders all window toggles", () => {
    const container = renderIntoBody(
      React.createElement(NutritionTrendPanel, {
        activeWindow: 7,
        points: [],
        onWindowChange: () => {},
      }),
    );

    expect(container.textContent).toMatch(/3 j/);
    expect(container.textContent).toMatch(/30 j/);
  });
});
