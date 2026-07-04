import { describe, expect, it } from "vitest"
import {
  PHOTO_LOG_CLIENT_TARGET_FILE_BYTES,
  PHOTO_LOG_MAX_BYPASS_IMAGE_SIDE,
  PHOTO_LOG_SERVER_MAX_FILE_BYTES,
  isDirectPhotoUploadType,
  shouldBypassClientCompression,
} from "@/lib/nutrition/photo-log-upload"

describe("photo-log-upload helpers", () => {
  it("accepts direct upload only for supported web formats", () => {
    expect(isDirectPhotoUploadType("image/jpeg")).toBe(true)
    expect(isDirectPhotoUploadType("image/png")).toBe(true)
    expect(isDirectPhotoUploadType("image/webp")).toBe(true)
    expect(isDirectPhotoUploadType("image/heic")).toBe(false)
  })

  it("forces client compression for large files or unsupported formats", () => {
    expect(shouldBypassClientCompression(PHOTO_LOG_CLIENT_TARGET_FILE_BYTES - 1, "image/jpeg", PHOTO_LOG_MAX_BYPASS_IMAGE_SIDE)).toBe(true)
    expect(shouldBypassClientCompression(PHOTO_LOG_CLIENT_TARGET_FILE_BYTES + 1, "image/jpeg", PHOTO_LOG_MAX_BYPASS_IMAGE_SIDE)).toBe(false)
    expect(shouldBypassClientCompression(1024, "image/png", PHOTO_LOG_MAX_BYPASS_IMAGE_SIDE)).toBe(false)
    expect(shouldBypassClientCompression(1024, "image/heic", PHOTO_LOG_MAX_BYPASS_IMAGE_SIDE)).toBe(false)
    expect(shouldBypassClientCompression(1024, "image/jpeg", PHOTO_LOG_MAX_BYPASS_IMAGE_SIDE + 1)).toBe(false)
  })

  it("keeps a safe margin between client target and server hard limit", () => {
    expect(PHOTO_LOG_CLIENT_TARGET_FILE_BYTES).toBeLessThan(PHOTO_LOG_SERVER_MAX_FILE_BYTES)
  })
})
