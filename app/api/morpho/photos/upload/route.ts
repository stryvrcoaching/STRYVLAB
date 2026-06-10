// app/api/morpho/photos/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const maxDuration = 30

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

  const formData = await req.formData()
  const clientId = formData.get('clientId') as string
  const position = formData.get('position') as string
  const takenAt = formData.get('takenAt') as string
  const notes = formData.get('notes') as string | null
  const file = formData.get('file') as File | null

  if (!clientId || !position || !takenAt || !file) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  const db = service()

  // Vérifier ownership
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!clientRow) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Valider MIME type
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Format non supporté (jpeg/png/webp)' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const storagePath = `${clientId}/${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await db.storage
    .from('morpho-photos')
    .upload(storagePath, arrayBuffer, { contentType: file.type })

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
    return NextResponse.json({ error: insertError.message }, { status: 500 })
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
