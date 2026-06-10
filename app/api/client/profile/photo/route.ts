import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

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

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${client.id}/avatar.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Upsert — overwrite existing avatar
  const { error: uploadError } = await service.storage
    .from('profile-photos')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  // Get signed URL (valid 10 years — effectively permanent for profile photos)
  const { data: signed } = await service.storage
    .from('profile-photos')
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10)

  if (!signed?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate signed URL' }, { status: 500 })
  }

  // Save URL to coach_clients
  await service
    .from('coach_clients')
    .update({ profile_photo_url: signed.signedUrl, updated_at: new Date().toISOString() })
    .eq('id', client.id)

  return NextResponse.json({ url: signed.signedUrl })
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

  await service
    .from('coach_clients')
    .update({ profile_photo_url: null, updated_at: new Date().toISOString() })
    .eq('id', client.id)

  return NextResponse.json({ ok: true })
}
