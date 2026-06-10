import { describe, expect, it } from "vitest";
import {
  buildTrainingWeekSchedule,
  sessionDaysOfWeek,
  suggestNutritionDayName,
} from "@/lib/nutrition/training-week-schedule";

describe("sessionDaysOfWeek", () => {
  it("prefers days_of_week array over legacy day_of_week", () => {
    expect(
      sessionDaysOfWeek({
        name: "Push",
        day_of_week: 1,
        days_of_week: [1, 3, 5],
        exercises: [],
      }),
    ).toEqual([1, 3, 5]);
  });
});

describe("buildTrainingWeekSchedule", () => {
  it("marks training days when sessions have exercises", () => {
    const schedule = buildTrainingWeekSchedule({
      id: "p1",
      name: "Force",
      session_mode: "day",
      program_sessions: [
        {
          name: "Push",
          days_of_week: [1, 4],
          exercises: [{ name: "Bench" }],
        },
        {
          name: "Repos actif",
          days_of_week: [3],
          exercises: [],
        },
      ],
    });

    expect(schedule.days[0].kind).toBe("training");
    expect(schedule.days[2].kind).toBe("rest_with_activity");
    expect(schedule.days[1].kind).toBe("rest");
    expect(schedule.days[0].sessionNames).toContain("Push");
  });

  it("returns undefined kinds when no programme is linked", () => {
    const schedule = buildTrainingWeekSchedule(null);
    expect(schedule.programId).toBeNull();
    expect(schedule.days.every((d) => d.kind === "undefined")).toBe(true);
  });

  it("returns undefined for cycle mode programmes", () => {
    const schedule = buildTrainingWeekSchedule({
      id: "p2",
      name: "Cycle",
      session_mode: "cycle",
      program_sessions: [
        {
          name: "S1",
          days_of_week: [],
          exercises: [{ name: "Squat" }],
        },
      ],
    });
    expect(schedule.sessionMode).toBe("cycle");
    expect(schedule.days.every((d) => d.kind === "undefined")).toBe(true);
  });
});

describe("suggestNutritionDayName", () => {
  it("suggests matching protocol day names", () => {
    expect(
      suggestNutritionDayName("training", [
        "Jour entraînement",
        "Jour repos",
      ]),
    ).toBe("Jour entraînement");
    expect(
      suggestNutritionDayName("rest", ["Jour entraînement", "Jour repos"]),
    ).toBe("Jour repos");
  });
});
