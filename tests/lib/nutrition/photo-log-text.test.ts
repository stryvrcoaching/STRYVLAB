import { describe, expect, it } from "vitest"
import { buildTextOnlyPhotoLogDraft } from "@/lib/nutrition/photo-log-text"

describe("buildTextOnlyPhotoLogDraft", () => {
  it("builds a loggable draft from text-only parsed items", () => {
    const { analysis, result } = buildTextOnlyPhotoLogDraft({
      transcript: "150 g de poulet et 200 g de riz cuit",
      mealType: "lunch",
      items: [
        {
          name: "Poulet cuit",
          quantity_g: 150,
          kcal: 248,
          protein_g: 46.5,
          carbs_g: 0,
          fat_g: 5.4,
          fiber_g: 0,
          category_l1: "proteins",
        },
        {
          name: "Riz cuit",
          quantity_g: 200,
          kcal: 260,
          protein_g: 5,
          carbs_g: 56,
          fat_g: 0.6,
          fiber_g: 0.8,
          category_l1: "carbs",
        },
      ],
    })

    expect(analysis.source_context).toBe("text_note_v1")
    expect(result.source_context).toBe("text_note_v1")
    expect(result.components).toHaveLength(2)
    expect(result.components[0].quantity_source).toBe("user_note")
    expect(result.ready_to_log).toBe(true)
    expect(result.validation_issues).toHaveLength(0)
  })
})
