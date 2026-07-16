import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { validateImageUpload } from '@/lib/security/image-upload'
import { checkDistributedRateLimit, rateLimitResponse } from '@/lib/security/public-rate-limit'

const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: client } = await service
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const rateLimit = await checkDistributedRateLimit({
    db: service,
    req,
    scope: 'client_profile_photo_upload',
    subject: String(client.id),
    maxRequests: 20,
    windowSeconds: 10 * 60,
  })
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit)

  const declaredLength = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROFILE_PHOTO_BYTES + 128_000) {
    return NextResponse.json({ error: 'Fichier trop volumineux' }, { status: 413 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const validation = validateImageUpload({
    file,
    buffer: arrayBuffer,
    maxBytes: MAX_PROFILE_PHOTO_BYTES,
  })

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const path = `${client.id}/avatar`
  const buffer = Buffer.from(arrayBuffer)

  // Upsert — overwrite existing avatar
  const { error: uploadError } = await service.storage
    .from('profile-photos')
    .upload(path, buffer, {
      contentType: validation.image.mime,
      upsert: true,
    })

  if (uploadError) return NextResponse.json({ error: 'Upload impossible' }, { status: 500 })

  const protectedUrl = `/api/clients/${client.id}/profile-photo`
  const { error: profileError } = await service
    .from('coach_clients')
    .update({ profile_photo_url: protectedUrl, updated_at: new Date().toISOString() })
    .eq('id', client.id)

  if (profileError) return NextResponse.json({ error: 'Profil impossible à mettre à jour' }, { status: 500 })

  return NextResponse.json({ url: protectedUrl }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: client } = await service
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Remove all avatar variants
  const { data: files } = await service.storage
    .from('profile-photos')
    .list(client.id)

  if (files && files.length > 0) {
    await service.storage
      .from('profile-photos')
      .remove(files.map((f) => `${client.id}/${f.name}`))
  }

  const { error: profileError } = await service
    .from('coach_clients')
    .update({ profile_photo_url: null, updated_at: new Date().toISOString() })
    .eq('id', client.id)

  if (profileError) return NextResponse.json({ error: 'Profil impossible à mettre à jour' }, { status: 500 })

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
