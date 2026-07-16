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
    console.error('[outlook-callback] OAuth error from Microsoft:', error)
    return NextResponse.redirect(new URL('/coach/settings?error=oauth_failed', req.url))
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  try {
    const redirectUri = `${new URL(req.url).origin}/api/coach/integrations/outlook/callback`

    // Échange le code d'autorisation Microsoft v2.0
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID || '',
        client_secret: process.env.OUTLOOK_CLIENT_SECRET || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        scope: 'offline_access Calendars.ReadWrite',
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Outlook token exchange failed: ${errText}`)
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
        provider: 'outlook',
        access_token,
        refresh_token: refresh_token || undefined,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'coach_id,provider'
      })

    if (upsertErr) {
      throw upsertErr
    }

    return NextResponse.redirect(new URL('/coach/settings?success=outlook_calendar_connected', req.url))
  } catch (err) {
    console.error('[outlook-callback] Exchange error:', err)
    return NextResponse.redirect(new URL('/coach/settings?error=oauth_failed', req.url))
  }
}
