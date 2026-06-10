import { describe, expect, it } from "vitest";
import {
  computePhaseDrivenCalorieAdjustPct,
  inferTransformationPhaseFromTrainingGoal,
  resolveTransformationPhase,
  transformationPhaseToFamily,
  transformationPhaseToMacroGoal,
} from "@/lib/coach/transformationPhase";

describe("transformationPhase", () => {
  it("falls back from training goal when no explicit transformation phase exists", () => {
    expect(
      resolveTransformationPhase({
        transformationPhase: null,
        trainingGoal: "hypertrophy",
      }),
    ).toBe("lean_bulk");
    expect(
      resolveTransformationPhase({
        transformationPhase: null,
        trainingGoal: "fat_loss",
      }),
    ).toBe("cut");
  });

  it("maps explicit phases to macro goals and phase families", () => {
    expect(transformationPhaseToMacroGoal("aggressive_cut")).toBe("deficit");
    expect(transformationPhaseToMacroGoal("diet_break")).toBe("maintenance");
    expect(transformationPhaseToMacroGoal("mass_gain")).toBe("surplus");
    expect(transformationPhaseToFamily("peak_week")).toBe("cut");
    expect(transformationPhaseToFamily("lean_bulk")).toBe("bulk");
  });

  it("computes phase-driven calorie presets from the macro preset base", () => {
    const basePreset = (goal: "deficit" | "maintenance" | "surplus") => {
      if (goal === "deficit") return -15;
      if (goal === "surplus") return 5;
      return 0;
    };

    expect(
      computePhaseDrivenCalorieAdjustPct({
        phase: "aggressive_cut",
        bodyFat: 18,
        weeklyFrequency: 4,
        basePreset,
      }),
    ).toBe(-20);
    expect(
      computePhaseDrivenCalorieAdjustPct({
        phase: "diet_break",
        bodyFat: 18,
        weeklyFrequency: 4,
        basePreset,
      }),
    ).toBe(0);
    expect(
      computePhaseDrivenCalorieAdjustPct({
        phase: inferTransformationPhaseFromTrainingGoal("hypertrophy"),
        bodyFat: 18,
        weeklyFrequency: 4,
        basePreset,
      }),
    ).toBe(5);
  });
});
