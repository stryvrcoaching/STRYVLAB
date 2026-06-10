// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import NutritionAgendaPremium from "@/components/clients/nutrition-hub/NutritionAgendaPremium";

describe("NutritionAgendaPremium", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders agenda rows without an interactive detail drawer", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        React.createElement(NutritionAgendaPremium, {
          rows: [
            {
              date: "2026-06-01",
              dayKind: "training",
              status: "under",
              mealCount: 3,
              consumed: {
                calories: 1800,
                protein_g: 110,
                carbs_g: 130,
                fat_g: 55,
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
          ],
        }),
      );
    });

    expect(container.textContent).toMatch(/journées observées/i);
    expect(container.textContent).not.toMatch(/détail journée/i);
    expect(container.querySelector("button")).toBeNull();
  });
});
