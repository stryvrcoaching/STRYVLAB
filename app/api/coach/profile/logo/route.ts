import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const MAX_SIZE = 30 * 1024 * 1024 // 30 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

// ─── POST /api/coach/profile/logo ─────────────────────────────────────────────
// Uploads coach logo to Supabase Storage bucket `coach-assets`.
// Returns: { logoUrl: string }
export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('logo') as File | null

  if (!file) return NextResponse.json({ error: 'Fichier requis' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Fichier trop lourd (max 30 Mo)' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Format non supporté (JPG, PNG, WebP, SVG)' }, { status: 400 })
  }

  const db = serviceClient()
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${user.id}/logo.${ext}`

  // Remove old logo if exists
  await db.storage.from('coach-assets').remove([
    `${user.id}/logo.jpg`,
    `${user.id}/logo.jpeg`,
    `${user.id}/logo.png`,
    `${user.id}/logo.webp`,
    `${user.id}/logo.svg`,
  ])

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await db.storage
    .from('coach-assets')
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    console.error('[logo upload]', uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Get signed URL (bucket is private — valid 10 years)
  const { data: signed } = await db.storage
    .from('coach-assets')
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10)

  const logoUrl = signed?.signedUrl ?? ''

  // Persist URL in coach_profiles
  await db
    .from('coach_profiles')
    .upsert(
      { coach_id: user.id, logo_url: logoUrl, updated_at: new Date().toISOString() },
      { onConflict: 'coach_id' }
    )

  return NextResponse.json({ logoUrl })
}

// ─── DELETE /api/coach/profile/logo ──────────────────────────────────────────
export async function DELETE() {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = serviceClient()

  await db.storage.from('coach-assets').remove([
    `${user.id}/logo.jpg`,
    `${user.id}/logo.jpeg`,
    `${user.id}/logo.png`,
    `${user.id}/logo.webp`,
    `${user.id}/logo.svg`,
  ])

  await db
    .from('coach_profiles')
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq('coach_id', user.id)

  return NextResponse.json({ success: true })
}
