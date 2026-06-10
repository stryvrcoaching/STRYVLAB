import { describe, expect, it } from "vitest";
import {
  clampWindowRows,
  computeRollingAverage,
  getLatestValueInWindow,
} from "@/lib/client/checkin/rollingSignals";

describe("rollingSignals", () => {
  const rows = [
    { date: "2026-05-30", value: 9000 },
    { date: "2026-05-29", value: 8000 },
    { date: "2026-05-28", value: null },
    { date: "2026-05-27", value: 7000 },
    { date: "2026-05-20", value: 4000 },
  ];

  it("keeps only rows inside the anchored window", () => {
    expect(clampWindowRows(rows, "2026-05-30", 4)).toEqual([
      { date: "2026-05-30", value: 9000 },
      { date: "2026-05-29", value: 8000 },
      { date: "2026-05-28", value: null },
      { date: "2026-05-27", value: 7000 },
    ]);
  });

  it("computes an average from observed values only", () => {
    expect(computeRollingAverage(rows, "2026-05-30", 4)).toBe(8000);
  });

  it("returns the latest observed value inside the window", () => {
    expect(getLatestValueInWindow(rows, "2026-05-30", 4)).toBe(9000);
    expect(
      getLatestValueInWindow(
        [
          { date: "2026-05-30", value: null },
          { date: "2026-05-29", value: 76.4 },
        ],
        "2026-05-30",
        2,
      ),
    ).toBe(76.4);
  });

  it("returns null when no observed value exists in the window", () => {
    expect(
      computeRollingAverage(
        [{ date: "2026-05-30", value: null }],
        "2026-05-30",
        7,
      ),
    ).toBeNull();
    expect(
      getLatestValueInWindow(
        [{ date: "2026-05-30", value: null }],
        "2026-05-30",
        7,
      ),
    ).toBeNull();
  });
});
