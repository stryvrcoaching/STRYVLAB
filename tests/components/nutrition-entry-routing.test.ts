import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8")
}

describe("nutrition entry routing", () => {
  it("uses the same visual header for track and compose", () => {
    expect(source("components/client/smart/MealLogSheet.tsx")).toContain(
      'import NutritionEntryHeader from "@/components/client/nutrition/NutritionEntryHeader"',
    )
    expect(source("app/client/nutrition/compose/ComposeClientPage.tsx")).toContain(
      "import NutritionEntryHeader from '@/components/client/nutrition/NutritionEntryHeader'",
    )
  })

  it("routes meal shortcuts to the canonical track page", () => {
    const quickLog = source("components/client/QuickLogSheet.tsx")
    const voiceFab = source("components/client/smart/VoiceEntryFab.tsx")

    expect(quickLog).toContain('router.push("/client/nutrition/log")')
    expect(quickLog).not.toContain("import(\"@/components/client/smart/MealLogSheet\")")
    expect(voiceFab).toContain("router.push(`/client/nutrition/log${query}`)")
    expect(voiceFab).not.toContain("import(\"@/components/client/smart/MealLogSheet\")")
    expect(voiceFab).toContain('new URLSearchParams({ input: "voice" })')
    expect(voiceFab).not.toContain("VoiceLogSheet")
  })

  it("keeps logged meals on track and planned meals on compose", () => {
    const nutritionPage = source("app/client/nutrition/NutritionClientPage.tsx")
    const legacyVoicePage = source("app/client/nutrition/log/voice/page.tsx")

    expect(nutritionPage).toContain("router.push(`/client/nutrition/log?${params.toString()}`)")
    expect(nutritionPage).not.toContain("router.push(`/client/nutrition/log/voice?")
    expect(nutritionPage).toContain("router.push(`/client/nutrition/compose?date=${prepDate}&prep_id=${prep.id}`)")
    expect(nutritionPage).toContain("router.push(`/client/nutrition/compose?date=${date}`)")
    expect(legacyVoicePage).toContain("redirect(`/client/nutrition/log?${params.toString()}`)")
    expect(legacyVoicePage).not.toContain("VoiceLogSheet")
  })

  it("closes the planner composer back to planning", () => {
    const composerPage = source("app/client/nutrition/compose/ComposeClientPage.tsx")

    expect(composerPage).toContain(
      "router.replace(`/client/nutrition?date=${date}&tab=planning`, { scroll: false })",
    )
    expect(composerPage).not.toContain(
      "router.push(`/client/nutrition?date=${date}&tab=planning`)",
    )
  })
})
