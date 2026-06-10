import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ initial: null, avatarUrl: null })

  const db = service()
  const cc = await resolveClientFromUser(user.id, user.email, db, 'id, coach_id')
  if (!cc) return NextResponse.json({ initial: null, avatarUrl: null })

  const coachId = (cc as any)?.coach_id ?? null
  if (!coachId) return NextResponse.json({ initial: null, avatarUrl: null })

  const { data: profile } = await db
    .from('coach_profiles')
    .select('full_name, logo_url')
    .eq('coach_id', coachId)
    .maybeSingle()

  const fullName: string | null = (profile as any)?.full_name ?? null
  const initial: string | null = fullName
    ? (() => {
        const parts = fullName.trim().split(/\s+/).filter(Boolean)
        if (parts.length === 0) return null
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
      })()
    : null

  // Try stored URL first (10-year TTL), then regenerate from storage
  let avatarUrl: string | null = (profile as any)?.logo_url ?? null

  if (!avatarUrl) {
    const { data: files } = await db.storage
      .from('coach-assets')
      .list(coachId, { limit: 10 })

    const logoFile = (files ?? []).find((f: any) => f.name.startsWith('logo'))
    if (logoFile) {
      const { data: signed } = await db.storage
        .from('coach-assets')
        .createSignedUrl(`${coachId}/${logoFile.name}`, 3600)
      avatarUrl = signed?.signedUrl ?? null
    }
  }

  return NextResponse.json(
    { initial, avatarUrl },
    { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=3600' } }
  )
}
