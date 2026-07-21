import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Stay under Vercel serverless body limit (~4.5 MB).
 * Client compresses large camera photos before upload (see upload-image.ts).
 */
const MAX_SIZE = 4.2 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

function resolveMime(file: File): string | null {
  if (file.type && ALLOWED_TYPES.has(file.type)) return file.type
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  const fromExt = EXT_MIME[ext]
  if (fromExt) return fromExt
  // iPhone HEIC etc.
  if (ext === 'heic' || ext === 'heif' || file.type === 'image/heic' || file.type === 'image/heif') {
    return null
  }
  return file.type && file.type.startsWith('image/') ? file.type : null
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file')
    const field = (formData.get('field') as string | null) || 'general'

    if (!(file instanceof File) && !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
    }

    const blob = file as File
    if (!blob.size) {
      return NextResponse.json({ error: 'Fichier vide' }, { status: 400 })
    }
    if (blob.size > MAX_SIZE) {
      return NextResponse.json(
        {
          error: `Fichier trop lourd (${(blob.size / 1024 / 1024).toFixed(1)} Mo). Réessaie : l’app compresse normalement les photos jusqu’à 25 Mo d’origine.`,
        },
        { status: 400 },
      )
    }

    const mime = resolveMime(blob as File)
    if (!mime || !ALLOWED_TYPES.has(mime)) {
      return NextResponse.json(
        {
          error:
            'Format non supporté. Utilise JPG, PNG ou WebP (les photos iPhone HEIC doivent être converties).',
        },
        { status: 400 },
      )
    }

    const db = serviceClient()
    const rawName = 'name' in blob && typeof blob.name === 'string' ? blob.name : 'photo.jpg'
    const ext =
      EXT_MIME[
        (rawName.split('.').pop() ?? '').toLowerCase() as keyof typeof EXT_MIME
      ]
        ? (rawName.split('.').pop() ?? 'jpg').toLowerCase()
        : mime === 'image/png'
          ? 'png'
          : mime === 'image/webp'
            ? 'webp'
            : mime === 'image/gif'
              ? 'gif'
              : 'jpg'

    const safeField = field.replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'general'
    const path = `${user.id}/page/${safeField}-${Date.now()}.${ext}`

    const arrayBuffer = await blob.arrayBuffer()
    const { error: uploadError } = await db.storage.from('coach-assets').upload(path, arrayBuffer, {
      contentType: mime,
      upsert: true,
    })

    if (uploadError) {
      console.error('[coach-page upload]', uploadError)
      return NextResponse.json(
        {
          error:
            uploadError.message?.includes('mime') || uploadError.message?.includes('type')
              ? 'Format refusé par le stockage. Utilise JPG ou PNG.'
              : `Échec de l’upload : ${uploadError.message}`,
        },
        { status: 500 },
      )
    }

    const { data: signed, error: signError } = await db.storage
      .from('coach-assets')
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10)

    if (signError || !signed?.signedUrl) {
      console.error('[coach-page upload sign]', signError)
      return NextResponse.json(
        { error: 'Image envoyée mais lien inaccessible. Réessaie.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ url: signed.signedUrl, path })
  } catch (err: unknown) {
    console.error('[coach-page upload catch]', err)
    const message = err instanceof Error ? err.message : 'Erreur interne'
    // Common when body exceeds platform limit
    if (/body|entity|too large|413/i.test(message)) {
      return NextResponse.json(
        { error: 'Fichier trop lourd pour le serveur (max ~4 Mo).' },
        { status: 413 },
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
