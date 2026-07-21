import { describe, expect, it } from "vitest"
import {
  buildRecommendedAssessmentBlocks,
  RECOMMENDED_ASSESSMENT_SYSTEM_KEY,
  RECOMMENDED_ASSESSMENT_VERSION,
} from "@/lib/assessments/recommended-template"

describe("recommended assessment template", () => {
  it("has a stable identity and every ecosystem module", () => {
    const blocks = buildRecommendedAssessmentBlocks()
    expect(RECOMMENDED_ASSESSMENT_SYSTEM_KEY).toBe("stryv_onboarding")
    expect(RECOMMENDED_ASSESSMENT_VERSION).toBe(1)
    expect(blocks.map((block) => block.module)).toEqual(
      expect.arrayContaining([
        "general",
        "goals",
        "psychology",
        "lifestyle",
        "wellness",
        "cardio",
        "nutrition",
        "food_preferences",
        "medical",
        "training",
        "performance",
        "biometrics",
        "measurements",
        "photos",
      ]),
    )
    expect(new Set(blocks.map((block) => block.id)).size).toBe(blocks.length)
  })

  it("requires the structured food profile but not progression photos", () => {
    const fields = buildRecommendedAssessmentBlocks().flatMap((block) => block.fields)
    expect(fields.find((field) => field.key === "food_preferences_profile")).toMatchObject({
      input_type: "food_preferences",
      required: true,
      visible: true,
      stage: "activation",
    })
    for (const key of ["photo_front", "photo_back", "photo_side_right", "photo_side_left"]) {
      expect(fields.find((field) => field.key === key)?.required).toBe(false)
    }
  })

  it("keeps advanced measurements visible without blocking activation", () => {
    const fields = buildRecommendedAssessmentBlocks().flatMap((block) => block.fields)
    for (const key of ["waist_cm", "hips_cm", "neck_cm"]) {
      expect(fields.find((field) => field.key === key)).toMatchObject({
        visible: true,
        required: false,
        stage: "advanced",
      })
    }
  })
})
