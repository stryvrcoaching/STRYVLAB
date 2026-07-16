// app/api/morpho/photos/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { validateImageUpload } from '@/lib/security/image-upload'
import { checkDistributedRateLimit, rateLimitResponse } from '@/lib/security/public-rate-limit'
import { coachOwnsClient } from '@/lib/security/client-resource-access'

export const maxDuration = 30

const MAX_MORPHO_PHOTO_BYTES = 10 * 1024 * 1024
const metadataSchema = z.object({
  clientId: z.string().uuid(),
  position: z.enum([
    'front',
    'back',
    'left',
    'right',
    'three_quarter_front_left',
    'three_quarter_front_right',
    'relaxed',
    'contracted',
  ]),
  takenAt: z.string().date(),
  notes: z.string().trim().max(2_000).nullable(),
})

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = service()
  const rateLimit = await checkDistributedRateLimit({
    db,
    req,
    scope: 'coach_morpho_photo_upload',
    subject: user.id,
    maxRequests: 20,
    windowSeconds: 10 * 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  const declaredLength = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MORPHO_PHOTO_BYTES + 128_000) {
    return NextResponse.json({ error: 'Fichier trop volumineux' }, { status: 413 })
  }

  const formData = await req.formData()
  const metadata = metadataSchema.safeParse({
    clientId: formData.get('clientId'),
    position: formData.get('position'),
    takenAt: formData.get('takenAt'),
    notes: formData.get('notes') || null,
  })
  const file = formData.get('file') as File | null

  if (!metadata.success || !file) {
    return NextResponse.json({ error: 'Données de photo invalides' }, { status: 400 })
  }

  const { clientId, position, takenAt, notes } = metadata.data

  // Vérifier ownership
  if (!(await coachOwnsClient({ db, coachUserId: user.id, clientId }))) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const validation = validateImageUpload({
    file,
    buffer: arrayBuffer,
    maxBytes: MAX_MORPHO_PHOTO_BYTES,
  })
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const storagePath = `${clientId}/${randomUUID()}.${validation.image.extension}`

  const { error: uploadError } = await db.storage
    .from('morpho-photos')
    .upload(storagePath, arrayBuffer, { contentType: validation.image.mime })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: photo, error: insertError } = await db
    .from('morpho_photos')
    .insert({
      client_id: clientId,
      coach_id: user.id,
      storage_path: storagePath,
      position,
      taken_at: takenAt,
      source: 'coach_upload',
      notes: notes || null,
    })
    .select('id, storage_path')
    .single()

  if (insertError) {
    await db.storage.from('morpho-photos').remove([storagePath])
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 })
  }

  const { data: signedUrlData } = await db.storage
    .from('morpho-photos')
    .createSignedUrl(storagePath, 3600)

  return NextResponse.json({
    photo_id: (photo as { id: string; storage_path: string }).id,
    storage_path: storagePath,
    signed_url: signedUrlData?.signedUrl ?? null,
  })
}
