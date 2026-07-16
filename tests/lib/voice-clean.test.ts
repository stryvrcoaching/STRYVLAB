import { describe, expect, it } from "vitest"
import { cleanTranscript } from "@/lib/nutrition/voice"

describe("cleanTranscript", () => {
  it("normalizes common nutrition homophones and units in french", () => {
    const cleaned = cleanTranscript(
      "250 millilitres de lait demi ecreme et 40 grammes de sept poudres de proteines pour ce cheker",
      "fr",
    )

    expect(cleaned).toContain("250 ml")
    expect(cleaned).toContain("40 g")
    expect(cleaned).toContain("lait demi-écrémé")
    expect(cleaned).toContain("cette poudre")
    expect(cleaned).toContain("shaker")
  })
})
