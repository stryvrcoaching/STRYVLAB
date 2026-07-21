import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8")
}

describe("QuickWaterModal", () => {
  it("shows only pure-water logs", () => {
    const modal = source("components/client/QuickWaterModal.tsx")

    expect(modal).toContain("new URLSearchParams({ kind: 'water' })")
    expect(modal).toContain("WATER_SHEET_EXCLUDED_TYPES")
    expect(modal).toContain("setLogs(rows.filter(isPureWaterLog))")
  })
})
