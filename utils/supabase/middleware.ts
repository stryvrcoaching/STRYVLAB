import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasCapability, type BillingStatus, type CoachPlan } from '@/lib/billing/plans'
import { isClientAppEnabledForPlanState } from '@/lib/billing/assertClientAppEnabled'
import { getCoachDataAccessMode } from '@/lib/privacy/retention'
import { resolveInternalProductFeedbackAccess } from '@/lib/auth/internal-product-feedback-access'

const INTERNAL_DASHBOARD_PATHS = new Set([
  '/dashboard/overview',
  '/dashboard/business',
  '/dashboard/product-feedback',
  '/dashboard/stryv-connect',
  '/dashboard/security',
  '/dashboard/ai-nutrition-ops',
])

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
  const isInternalDashboardRoute = INTERNAL_DASHBOARD_PATHS.has(pathname)

  // Routes protégées coach (nécessitent une session coach)
  const isCoachProtected =
    pathname.startsWith('/dashboard') ||
    pathname === '/coach' ||
    pathname.startsWith('/coach/') ||
    pathname.startsWith('/app')

  // Routes protégées client (nécessitent une session client)
  const isClientProtected =
    pathname.startsWith('/client') &&
    !pathname.startsWith('/client/login') &&
    !pathname.startsWith('/client/auth') &&
    !pathname.startsWith('/client/access') &&
    !pathname.startsWith('/client/onboarding') &&
    !pathname.startsWith('/client/acces-suspendu')

  // API client — same entitlement as STRYVR pages (plan + live billing)
  const isClientApi =
    pathname === '/api/client' || pathname.startsWith('/api/client/')

  const isClientLogin = pathname.startsWith('/client/login')

  // Routes publiques API (pas d'auth requise)
  const isPublicApi =
    pathname.startsWith('/api/assessments/public') ||
    pathname.startsWith('/bilan/')

  const isApiMutation =
    pathname.startsWith('/api/') &&
    !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
  const isCancellationMutationExempt =
    pathname.startsWith('/api/privacy/') ||
    pathname === '/api/stripe/coach-platform/checkout' ||
    pathname === '/api/stripe/coach-platform/portal'

  if (isApiMutation && !isCancellationMutationExempt && user) {
    const serviceSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll() { return [] }, setAll() {} } },
    )
    const { data: coachProfile } = await serviceSupabase
      .from('coach_profiles')
      .select('billing_status, data_export_available_until')
      .eq('coach_id', user.id)
      .maybeSingle()

    const accessMode = getCoachDataAccessMode(
      coachProfile?.billing_status,
      coachProfile?.data_export_available_until,
    )

    if (accessMode !== 'active') {
      return NextResponse.json(
        {
          error: accessMode === 'expired'
            ? 'La fenêtre d’accès après résiliation est terminée.'
            : 'Le compte est en lecture seule après résiliation.',
          mode: accessMode,
          exportAvailableUntil: coachProfile?.data_export_available_until ?? null,
        },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      )
    }
  }

  if (isClientProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/client/login'
    return NextResponse.redirect(url)
  }

  if (isClientApi && !user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // Shared client record + coach entitlement for pages AND /api/client/*
  if ((isClientProtected || isClientApi) && user) {
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
      .select('status, coach_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (isClientProtected && clientRecord?.status === 'suspended') {
      const url = request.nextUrl.clone()
      url.pathname = '/client/acces-suspendu'
      return NextResponse.redirect(url)
    }

    if (isClientApi && clientRecord?.status === 'suspended') {
      return NextResponse.json(
        { error: 'Accès suspendu', code: 'CLIENT_SUSPENDED' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    if (clientRecord?.coach_id) {
      const { data: coachProfile } = await serviceSupabase
        .from('coach_profiles')
        .select('plan, billing_status, client_limit, team_seats')
        .eq('coach_id', clientRecord.coach_id)
        .maybeSingle()

      const coachPlan: CoachPlan =
        coachProfile?.plan === 'pro' || coachProfile?.plan === 'studio'
          ? coachProfile.plan
          : 'solo'
      const rawBilling = coachProfile?.billing_status
      const billingStatus: BillingStatus =
        rawBilling === 'trialing' ||
        rawBilling === 'active' ||
        rawBilling === 'past_due' ||
        rawBilling === 'canceled'
          ? rawBilling
          : 'inactive'

      // Full entitlement: plan capability AND live billing (trialing|active)
      const appEnabled = isClientAppEnabledForPlanState({
        plan: coachPlan,
        billingStatus,
        clientLimit: coachProfile?.client_limit ?? null,
        teamSeats: coachProfile?.team_seats ?? null,
        capabilities: new Set(
          hasCapability(coachPlan, 'client_app_access') ? ['client_app_access'] : [],
        ),
      })

      if (!appEnabled) {
        if (isClientApi) {
          return NextResponse.json(
            {
              error: 'L’application client n’est pas active pour ce coach.',
              code: 'CLIENT_APP_DISABLED',
            },
            { status: 403, headers: { 'Cache-Control': 'no-store' } },
          )
        }
        const url = request.nextUrl.clone()
        url.pathname = '/client/access/non-active'
        return NextResponse.redirect(url)
      }
    } else if (isClientApi) {
      // Authenticated user without a linked client row
      return NextResponse.json(
        { error: 'Client not found', code: 'CLIENT_NOT_FOUND' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      )
    }
  }

  if (isClientLogin && user) {
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

    if (clientRecord) {
      const url = request.nextUrl.clone()
      url.pathname = '/client'
      return NextResponse.redirect(url)
    }

    const { data: coachProfile } = await serviceSupabase
      .from('coach_profiles')
      .select('id')
      .eq('coach_id', user.id)
      .maybeSingle()

    if (coachProfile) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  if (isCoachProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = isInternalDashboardRoute ? '/auth/login' : '/'
    if (isInternalDashboardRoute) {
      url.searchParams.set('next', pathname)
    }
    return NextResponse.redirect(url)
  }

  // This is a privileged operating console, not an extension of the coach
  // workspace. Authentication alone never grants access to these pages.
  if (isInternalDashboardRoute && user) {
    const access = resolveInternalProductFeedbackAccess({
      userId: user.id,
      email: user.email,
    })

    if (!access.allowed) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // Un user authentifié sur la home ou les routes /auth :
  // - si c'est un client (profil dans coach_clients) → /client
  // - si c'est un coach → /dashboard
  // Ne jamais envoyer un client vers /dashboard
  if ((isAuthRoute || isHomePage) && user) {
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
