export const PHOTO_LOG_ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const PHOTO_LOG_SERVER_MAX_FILE_BYTES = 10 * 1024 * 1024
export const PHOTO_LOG_CLIENT_TARGET_FILE_BYTES = 5 * 1024 * 1024
export const PHOTO_LOG_MAX_PHOTOS = 16
export const PHOTO_LOG_INLINE_UPLOAD_MAX_FILE_BYTES = 4 * 1024 * 1024
export const PHOTO_LOG_MAX_IMAGE_SIDE = 2800
export const PHOTO_LOG_MAX_BYPASS_IMAGE_SIDE = 2200
export const PHOTO_LOG_COMPRESSION_QUALITIES = [0.96, 0.92, 0.88, 0.82, 0.76] as const
export const PHOTO_LOG_DOWNSCALE_STEPS = [1, 0.94, 0.88, 0.8, 0.72] as const

export function isDirectPhotoUploadType(fileType: string) {
  return PHOTO_LOG_ALLOWED_UPLOAD_TYPES.includes(fileType as (typeof PHOTO_LOG_ALLOWED_UPLOAD_TYPES)[number])
}

export function shouldBypassClientCompression(fileSize: number, fileType: string, longestSide: number | null = null) {
  return (
    fileType === "image/jpeg" &&
    fileSize <= PHOTO_LOG_CLIENT_TARGET_FILE_BYTES &&
    isDirectPhotoUploadType(fileType) &&
    (longestSide == null || longestSide <= PHOTO_LOG_MAX_BYPASS_IMAGE_SIDE)
  )
}
