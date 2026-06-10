import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  console.log('[auth/confirm] url:', request.url)
  console.log('[auth/confirm] code:', code ? 'present' : 'MISSING')
  console.log('[auth/confirm] next:', next)

  if (code) {
    // Build the redirect response first so we can attach cookies to it
    const redirectUrl = `${origin}${next}`
    const response = NextResponse.redirect(redirectUrl)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Write cookies onto both the request and the redirect response
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('[auth/confirm] exchangeCodeForSession error:', error?.message ?? 'none')
    if (!error) {
      console.log('[auth/confirm] redirecting to:', redirectUrl)
      return response
    }
    console.log('[auth/confirm] exchange failed — redirecting to error page')
  }

  // Confirmation failed or link expired
  return NextResponse.redirect(`${origin}/auth/login?error=confirmation_failed`)
}
