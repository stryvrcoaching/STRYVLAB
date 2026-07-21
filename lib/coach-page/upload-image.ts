/** Client-side coach-page image upload (hero, about, gallery). */

/** Accept large camera photos; we compress before the network request. */
export const COACH_PAGE_MAX_SOURCE_BYTES = 25 * 1024 * 1024

/** Payload target after compression (under typical serverless body limits). */
export const COACH_PAGE_MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024

export const COACH_PAGE_IMAGE_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp'

/** @deprecated use COACH_PAGE_MAX_SOURCE_BYTES — kept for older imports */
export const COACH_PAGE_MAX_IMAGE_BYTES = COACH_PAGE_MAX_SOURCE_BYTES

export type CoachPageUploadField =
  | 'profile'
  | 'cover'
  | 'about'
  | 'custom'
  | 'gallery'
  | 'general'

export class CoachPageUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CoachPageUploadError'
  }
}

function clientValidateSource(file: Blob, fileName?: string): void {
  if (!file.size) {
    throw new CoachPageUploadError('Fichier vide')
  }
  if (file.size > COACH_PAGE_MAX_SOURCE_BYTES) {
    throw new CoachPageUploadError(
      `Fichier trop lourd (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum 25 Mo.`,
    )
  }
  const name = (fileName ?? (file instanceof File ? file.name : '')).toLowerCase()
  const type = file.type || ''
  const isHeic =
    type === 'image/heic' ||
    type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  if (isHeic) {
    throw new CoachPageUploadError(
      'Format HEIC (iPhone) non supporté. Exporte en JPG ou PNG avant d’envoyer.',
    )
  }
  const okType =
    !type ||
    type.startsWith('image/') ||
    /\.(jpe?g|png|webp|gif)$/i.test(name)
  if (!okType) {
    throw new CoachPageUploadError('Format non supporté. Utilise JPG, PNG ou WebP.')
  }
}

/**
 * Downscale + JPEG-compress large images so phone photos (8–20 Mo) still upload.
 * GIFs are left as-is (animation). Already-small files are returned unchanged when possible.
 */
export async function prepareCoachPageImage(
  file: Blob,
  fileName = 'photo.jpg',
): Promise<{ blob: Blob; fileName: string }> {
  clientValidateSource(file, fileName)

  const type = file.type || ''
  const lower = fileName.toLowerCase()
  if (type === 'image/gif' || lower.endsWith('.gif')) {
    if (file.size > COACH_PAGE_MAX_UPLOAD_BYTES) {
      throw new CoachPageUploadError(
        'GIF trop lourd (max ~3,5 Mo après envoi). Utilise une image JPG/PNG.',
      )
    }
    return { blob: file, fileName }
  }

  // Small enough already — send as-is
  if (file.size <= COACH_PAGE_MAX_UPLOAD_BYTES && type !== 'image/png') {
    return { blob: file, fileName }
  }

  if (typeof createImageBitmap === 'undefined' && typeof document === 'undefined') {
    // Non-browser fallback: reject if still too large for the API
    if (file.size > COACH_PAGE_MAX_UPLOAD_BYTES) {
      throw new CoachPageUploadError(
        'Image trop lourde pour l’envoi. Compresse-la sous 4 Mo.',
      )
    }
    return { blob: file, fileName }
  }

  const bitmap = await createImageBitmap(file)
  try {
    const maxEdge = 2400
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new CoachPageUploadError('Impossible de préparer l’image')
    }
    ctx.drawImage(bitmap, 0, 0, w, h)

    let quality = 0.88
    let blob: Blob | null = null
    for (let attempt = 0; attempt < 6; attempt++) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
      )
      if (!blob) break
      if (blob.size <= COACH_PAGE_MAX_UPLOAD_BYTES) break
      quality -= 0.12
    }

    if (!blob) {
      throw new CoachPageUploadError('Compression de l’image impossible')
    }
    if (blob.size > COACH_PAGE_MAX_UPLOAD_BYTES) {
      throw new CoachPageUploadError(
        'Image encore trop lourde après compression. Choisis une photo plus légère.',
      )
    }

    const base = fileName.replace(/\.[^.]+$/, '') || 'photo'
    return { blob, fileName: `${base}.jpg` }
  } finally {
    bitmap.close()
  }
}

/**
 * Upload one image to /api/coach-page/upload and return a durable signed URL.
 * Large sources are compressed client-side first.
 */
export async function uploadCoachPageImage(
  file: Blob,
  field: CoachPageUploadField,
  fileName = 'photo.jpg',
): Promise<string> {
  const prepared = await prepareCoachPageImage(file, fileName)

  const form = new FormData()
  const asFile = new File([prepared.blob], prepared.fileName, {
    type: prepared.blob.type || 'image/jpeg',
  })
  form.append('file', asFile)
  form.append('field', field)

  const res = await fetch('/api/coach-page/upload', {
    method: 'POST',
    body: form,
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new CoachPageUploadError(
      data?.error ?? `Échec de l’upload (${res.status})`,
    )
  }
  if (!data?.url || typeof data.url !== 'string') {
    throw new CoachPageUploadError('Image envoyée mais URL manquante. Réessaie.')
  }
  return data.url as string
}
