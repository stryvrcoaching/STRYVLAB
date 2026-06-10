import { describe, expect, it } from "vitest";
import {
  DEFAULT_REALTIME_WINDOW_DAYS,
  canUseRealtimeSignal,
  getNutritionSignalGovernance,
  getNutritionSignalLabel,
  getNutritionSignalSourceLabel,
  getNutritionSignalWindowDays,
} from "@/lib/nutrition/dataGovernance";

describe("nutrition data governance", () => {
  it("marks structural body-composition fields as non realtime", () => {
    const bodyFat = getNutritionSignalGovernance("body_fat_pct");
    expect(bodyFat.category).toBe("structural");
    expect(canUseRealtimeSignal("body_fat_pct", "realtime")).toBe(false);
    expect(getNutritionSignalWindowDays("body_fat_pct", "realtime")).toBeNull();
  });

  it("allows rolling realtime signals for dynamic recovery fields", () => {
    expect(canUseRealtimeSignal("daily_steps", "realtime")).toBe(true);
    expect(canUseRealtimeSignal("daily_steps", "bilan")).toBe(false);
    expect(canUseRealtimeSignal("sleep_duration_h", "bilan")).toBe(true);
    expect(getNutritionSignalWindowDays("daily_steps", "realtime")).toBe(
      DEFAULT_REALTIME_WINDOW_DAYS,
    );
    expect(getNutritionSignalWindowDays("daily_steps", "bilan")).toBeNull();
    expect(getNutritionSignalWindowDays("stress_level", "bilan")).toBe(
      DEFAULT_REALTIME_WINDOW_DAYS,
    );
  });

  it("keeps training structure fields anchored to bilan/profile data", () => {
    const weeklyFrequency = getNutritionSignalGovernance("weekly_frequency");
    expect(weeklyFrequency.category).toBe("hybrid");
    expect(canUseRealtimeSignal("weekly_frequency", "realtime")).toBe(false);
    expect(weeklyFrequency.bilan.allowAnchoredRealtimeOverlay).toBe(false);
  });

  it("returns human-readable labels and source badges", () => {
    expect(getNutritionSignalLabel("visceral_fat_level")).toBe(
      "graisse viscérale",
    );
    expect(
      getNutritionSignalSourceLabel("daily_steps", "realtime", "selected"),
    ).toBe("moyenne récente");
    expect(
      getNutritionSignalSourceLabel("body_fat_pct", "realtime", "fallback"),
    ).toBe("dernier bilan");
  });
});
