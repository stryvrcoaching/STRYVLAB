const EXERCISE_LIBRARY_PREFIX = '/bibliotheque_exercices/'
const EXERCISE_PDF_THUMBS_PREFIX = '/bibliotheque_exercices/_pdf_thumbs/'
const SUPPORTED_PDF_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function stripSearchAndHash(value: string) {
  return value.split('#')[0]?.split('?')[0] ?? value
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function resolveSiteOrigin() {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.SITE_URL

  if (explicit) {
    return explicit.replace(/\/$/, '')
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '')
  }

  return 'https://www.stryvlab.com'
}

function toAbsolutePublicUrl(assetPath: string) {
  const normalized = stripSearchAndHash(assetPath)
  if (!normalized.startsWith('/')) return null
  return `${resolveSiteOrigin()}${normalized}`
}

function libraryThumbPathFromGif(assetPath: string) {
  if (!assetPath.startsWith(EXERCISE_LIBRARY_PREFIX)) return null

  const relativePath = assetPath
    .slice(EXERCISE_LIBRARY_PREFIX.length)
    .replace(/\.gif$/i, '.png')

  return `${EXERCISE_PDF_THUMBS_PREFIX}${relativePath}`
}

export function resolvePdfImageSource(imageUrl: string | null | undefined) {
  if (!imageUrl) return null

  const normalized = stripSearchAndHash(imageUrl)

  if (normalized.startsWith(EXERCISE_LIBRARY_PREFIX) && normalized.toLowerCase().endsWith('.gif')) {
    const thumbPath = libraryThumbPathFromGif(normalized)
    return thumbPath ? toAbsolutePublicUrl(thumbPath) : null
  }

  if (normalized.startsWith('/')) {
    const extension = normalized.split('.').pop()?.toLowerCase()
    if (extension && SUPPORTED_PDF_IMAGE_EXTENSIONS.has(`.${extension}`)) {
      return toAbsolutePublicUrl(normalized)
    }

    return null
  }

  if (isHttpUrl(normalized) && !normalized.toLowerCase().endsWith('.gif')) {
    return normalized
  }

  return null
}

