import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Redirect removed routes to Smart Agenda home
  if (pathname === '/client/agenda' || pathname.startsWith('/client/agenda/')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/client'
    return NextResponse.redirect(redirectUrl, { status: 301 })
  }
  if (pathname === '/client/progress' || pathname.startsWith('/client/progress/')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/client'
    return NextResponse.redirect(redirectUrl, { status: 301 })
  }

  const isAuthRoute = pathname.startsWith('/auth')
  const isHomePage = pathname === '/'

  // Routes protégées coach (nécessitent une session coach)
  const isCoachProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/coach') ||
    pathname.startsWith('/app')

  // Routes protégées client (nécessitent une session client)
  const isClientProtected =
    pathname.startsWith('/client') &&
    !pathname.startsWith('/client/login') &&
    !pathname.startsWith('/client/auth') &&
    !pathname.startsWith('/client/access') &&
    !pathname.startsWith('/client/onboarding') &&
    !pathname.startsWith('/client/acces-suspendu')

  const isClientLogin = pathname.startsWith('/client/login')

  // Routes publiques API (pas d'auth requise)
  const isPublicApi =
    pathname.startsWith('/api/assessments/public') ||
    pathname.startsWith('/bilan/')

  if (isClientProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/client/login'
    return NextResponse.redirect(url)
  }

  // Vérification du statut client (accès suspendu)
  if (isClientProtected && user) {
    const serviceSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return [] },
          setAll() {},
        },
      }
    )
    const { data: clientRecord } = await serviceSupabase
      .from('coach_clients')
      .select('status')
      .eq('user_id', user.id)
      .single()

    if (clientRecord?.status === 'suspended') {
      const url = request.nextUrl.clone()
      url.pathname = '/client/acces-suspendu'
      return NextResponse.redirect(url)
    }
  }

  if (isClientLogin && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/client'
    return NextResponse.redirect(url)
  }

  if (isCoachProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Un user authentifié sur la home ou les routes /auth :
  // - si c'est un client (profil dans coach_clients) → /client
  // - si c'est un coach → /dashboard
  // Ne jamais envoyer un client vers /dashboard
  if ((isAuthRoute || isHomePage) && user) {
    console.log('[middleware] authenticated user on', pathname, '— user id:', user.id)
    const serviceSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll() { return [] }, setAll() {} } }
    )
    const { data: clientRecord } = await serviceSupabase
      .from('coach_clients')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    console.log('[middleware] clientRecord:', clientRecord ? 'found' : 'not found', '— redirecting to:', clientRecord ? '/client' : '/dashboard')
    const url = request.nextUrl.clone()
    url.pathname = clientRecord ? '/client' : '/dashboard'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
