const IMAGE_TYPES = {
  jpeg: { mime: 'image/jpeg', extension: 'jpg' },
  png: { mime: 'image/png', extension: 'png' },
  webp: { mime: 'image/webp', extension: 'webp' },
} as const

export type ValidatedImage = {
  mime: (typeof IMAGE_TYPES)[keyof typeof IMAGE_TYPES]['mime']
  extension: (typeof IMAGE_TYPES)[keyof typeof IMAGE_TYPES]['extension']
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value)
}

export function detectImageType(buffer: ArrayBuffer): ValidatedImage | null {
  const bytes = new Uint8Array(buffer.slice(0, 12))

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return IMAGE_TYPES.jpeg
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return IMAGE_TYPES.png
  }

  const isWebp =
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50

  return isWebp ? IMAGE_TYPES.webp : null
}

export function validateImageUpload(params: {
  file: File
  buffer: ArrayBuffer
  maxBytes: number
}): { ok: true; image: ValidatedImage } | { ok: false; error: string } {
  return validateImageBytes({
    buffer: params.buffer,
    size: params.file.size,
    declaredMime: params.file.type,
    maxBytes: params.maxBytes,
  })
}

export function validateImageBytes(params: {
  buffer: ArrayBuffer
  size: number
  declaredMime?: string | null
  maxBytes: number
}): { ok: true; image: ValidatedImage } | { ok: false; error: string } {
  if (params.size < 1 || params.size > params.maxBytes) {
    return { ok: false, error: 'Taille de fichier invalide.' }
  }

  const image = detectImageType(params.buffer)
  if (!image) {
    return { ok: false, error: 'Format non supporté. Utilisez JPG, PNG ou WEBP.' }
  }

  if (params.declaredMime && params.declaredMime !== image.mime) {
    return { ok: false, error: 'Le contenu du fichier ne correspond pas à son type déclaré.' }
  }

  return { ok: true, image }
}
