import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    console.error('[google-callback] OAuth error from Google:', error)
    return NextResponse.redirect(new URL('/coach/settings?error=oauth_failed', req.url))
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  try {
    // Échange le code d'autorisation Google
    const redirectUri = `${new URL(req.url).origin}/api/coach/integrations/google/callback`

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Google token exchange failed: ${errText}`)
    }

    const data = await res.json()
    const { access_token, refresh_token, expires_in } = data

    const db = service()
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()

    // Enregistre ou met à jour le token
    const { error: upsertErr } = await db
      .from('coach_calendar_tokens')
      .upsert({
        coach_id: user.id,
        provider: 'google',
        access_token,
        refresh_token: refresh_token || undefined, // Google ne renvoie le refresh_token que la première fois
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'coach_id,provider'
      })

    if (upsertErr) {
      throw upsertErr
    }

    // Redirige vers le profil du coach avec un message de succès
    return NextResponse.redirect(new URL('/coach/settings?success=google_calendar_connected', req.url))
  } catch (err) {
    console.error('[google-callback] Exchange error:', err)
    return NextResponse.redirect(new URL('/coach/settings?error=oauth_failed', req.url))
  }
}
