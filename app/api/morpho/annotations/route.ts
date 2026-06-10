// app/api/morpho/annotations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const bodySchema = z.object({
  photoId: z.string().uuid(),
  canvasData: z.record(z.string(), z.unknown()),
  thumbnailBase64: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: body.error.message }, { status: 400 })
  }

  const db = service()
  const { photoId, canvasData, thumbnailBase64 } = body.data

  // Vérifier que la photo appartient à un client du coach
  const { data: photo } = await db
    .from('morpho_photos')
    .select('id, client_id')
    .eq('id', photoId)
    .single()

  if (!photo) {
    return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })
  }

  const { data: access } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', (photo as { id: string; client_id: string }).client_id)
    .eq('coach_id', user.id)
    .single()

  if (!access) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  let thumbnailPath: string | null = null

  // Upload thumbnail si fourni
  if (thumbnailBase64) {
    const base64Data = thumbnailBase64.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const path = `thumbnails/${photoId}_${user.id}.png`
    const { error: thumbError } = await db.storage
      .from('morpho-photos')
      .upload(path, buffer, { contentType: 'image/png', upsert: true })

    if (!thumbError) thumbnailPath = path
  }

  const { data: annotation, error: upsertError } = await db
    .from('morpho_annotations')
    .upsert(
      {
        photo_id: photoId,
        coach_id: user.id,
        canvas_data: canvasData,
        ...(thumbnailPath ? { thumbnail_path: thumbnailPath } : {}),
      },
      { onConflict: 'photo_id,coach_id' }
    )
    .select('id')
    .single()

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ annotation_id: (annotation as { id: string }).id })
}
