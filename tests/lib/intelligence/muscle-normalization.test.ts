import { describe, it, expect } from "vitest";
import {
  normalizeMuscleSlug,
  validateMuscleArray,
  CANONICAL_MUSCLES,
} from "@/lib/programs/intelligence/muscle-normalization";

describe("Muscle Normalization", () => {
  it("accepts canonical slug as-is", () => {
    expect(normalizeMuscleSlug("grand_pectoral")).toBe("grand_pectoral");
  });

  it("normalizes legacy English slug", () => {
    expect(normalizeMuscleSlug("chest")).toBe("grand_pectoral");
    expect(normalizeMuscleSlug("quads")).toBe("quadriceps");
  });

  it("normalizes legacy French slug", () => {
    expect(normalizeMuscleSlug("pectoraux")).toBe("grand_pectoral");
    expect(normalizeMuscleSlug("pectoraux_haut")).toBe(
      "grand_pectoral_superieur",
    );
  });

  it("case-insensitive", () => {
    expect(normalizeMuscleSlug("GRAND_PECTORAL")).toBe("grand_pectoral");
    expect(normalizeMuscleSlug("Grand Dorsal")).toBe("grand_dorsal");
  });

  it("normalizes hyphenated slugs", () => {
    expect(normalizeMuscleSlug("ischio-jambiers")).toBe("ischio_jambiers");
  });

  it("throws on unknown slug", () => {
    expect(() => normalizeMuscleSlug("fake_muscle")).toThrow(
      "Unknown muscle slug",
    );
  });

  it("trims whitespace", () => {
    expect(normalizeMuscleSlug("  grand_pectoral  ")).toBe("grand_pectoral");
  });

  it("validateMuscleArray dedupes", () => {
    const result = validateMuscleArray([
      "grand_pectoral",
      "GRAND_PECTORAL",
      "chest",
    ]);
    expect(result).toEqual(["grand_pectoral"]);
  });

  it("validateMuscleArray preserves order", () => {
    const result = validateMuscleArray([
      "grand_pectoral",
      "triceps",
      "quadriceps",
    ]);
    expect(result).toEqual(["grand_pectoral", "triceps", "quadriceps"]);
  });

  it("validateMuscleArray silently ignores non-string entries", () => {
    const result = validateMuscleArray(["grand_pectoral", 123 as any]);
    expect(result).toEqual(["grand_pectoral"]);
  });

  it("validateMuscleArray throws on non-array input", () => {
    expect(() => validateMuscleArray("not_array" as any)).toThrow(
      "must be an array",
    );
  });

  it("all canonical muscles are identity-mapped", () => {
    for (const muscle of Object.keys(CANONICAL_MUSCLES)) {
      expect(normalizeMuscleSlug(muscle)).toBe(muscle);
    }
  });
});
