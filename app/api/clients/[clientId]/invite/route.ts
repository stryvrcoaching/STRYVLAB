import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendInvitationEmail, sendReactivationEmail, sendAccessLinkEmail } from '@/lib/email/mailer'
import { getCoachPlan } from '@/lib/billing/getCoachPlan'
import { isClientAppEnabledForPlanState } from '@/lib/billing/assertClientAppEnabled'
import { assertCoachClientCapacity, ClientLimitReachedError } from '@/lib/billing/clientLimits'
import { hasValidMinorAuthorization } from '@/lib/privacy/minor-authorization'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { clientId: string } }

async function findAuthUserByEmail(db: ReturnType<typeof service>, email: string) {
  const { data: userId, error: lookupError } = await db.rpc('find_auth_user_id_by_email', { p_email: email })
  if (lookupError) throw lookupError
  if (!userId) return null
  const { data, error } = await db.auth.admin.getUserById(userId)
  if (error) throw error
  return data.user
}

function hasActivatedClientAccount(
  existingUser: Awaited<ReturnType<typeof findAuthUserByEmail>>,
  passwordSet: boolean,
) {
  if (!existingUser) return false

  const user = existingUser as {
    last_sign_in_at?: string | null
    user_metadata?: Record<string, unknown> | null
  }

  const hasSignedIn = typeof user.last_sign_in_at === 'string' && user.last_sign_in_at.length > 0
  const onboardingCompleted = user.user_metadata?.onboarding_completed === true

  return passwordSet || hasSignedIn || onboardingCompleted
}

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const db = service()
  const planState = await getCoachPlan(db, user.id)

  // Plan Pro/Studio + abonnement trial/active requis (pas seulement le label plan)
  if (!isClientAppEnabledForPlanState(planState)) {
    return NextResponse.json(
      {
        error:
          planState.plan === 'solo'
            ? 'L’accès client STRYVR est disponible à partir du plan Pro.'
            : 'Réactivez votre abonnement Pro pour inviter des clients dans STRYVR.',
      },
      { status: 403 },
    )
  }

  const { data: client } = await db
    .from('coach_clients')
    .select('id, email, first_name, last_name, status, password_set, date_of_birth, minor_authorization_status, minor_guardian_name, minor_guardian_email, minor_authorization_confirmed_at')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  if (!client.email) return NextResponse.json({ error: 'Ce client n\'a pas d\'email' }, { status: 422 })
  if (!hasValidMinorAuthorization(client)) {
    return NextResponse.json(
      { error: 'Confirmez d’abord l’autorisation du représentant légal dans le profil du client.' },
      { status: 422 },
    )
  }

  const requiresActivation = client.status !== 'active'
  if (requiresActivation) {
    try {
      await assertCoachClientCapacity(db, user.id)
    } catch (error) {
      if (error instanceof ClientLimitReachedError) {
        return NextResponse.json(
          { error: 'Limite de clients actifs atteinte pour le plan actuel.' },
          { status: 403 },
        )
      }
      throw error
    }
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin).replace(/\/$/, '')

  const coachFirstName = (user.user_metadata?.first_name as string | undefined) ?? null
  const coachLastName  = (user.user_metadata?.last_name  as string | undefined) ?? null
  const coachName = coachFirstName
    ? `${coachFirstName}${coachLastName ? ' ' + coachLastName : ''}`
    : null

  let existingUser: Awaited<ReturnType<typeof findAuthUserByEmail>>
  try {
    existingUser = await findAuthUserByEmail(db, client.email)
  } catch (error) {
    console.error('Auth user lookup failed:', error)
    return NextResponse.json({ error: 'Impossible de vérifier le compte client' }, { status: 500 })
  }

  if (existingUser) {
    const { data: otherClient, error: linkError } = await db
      .from('coach_clients')
      .select('id')
      .eq('user_id', existingUser.id)
      .neq('id', params.clientId)
      .limit(1)
      .maybeSingle()
    if (linkError) {
      console.error('Client link lookup failed:', linkError)
      return NextResponse.json({ error: 'Impossible de vérifier l’accès client' }, { status: 500 })
    }
    if (otherClient) {
      return NextResponse.json(
        { error: 'Ce compte STRYVR est déjà lié à un autre suivi client.' },
        { status: 409 },
      )
    }
  }

  if (existingUser) {
    const isSuspended = client.status === 'suspended'
    const hasCompletedPassword = client.password_set === true
    const hasActivatedAccount = hasActivatedClientAccount(existingUser, hasCompletedPassword)

    if (isSuspended) {
      // Reactivate only this coach's client relationship.
      const { error: reactivateError } = await db
        .from('coach_clients')
        .update({ status: 'active', user_id: existingUser.id })
        .eq('id', params.clientId)
        .eq('coach_id', user.id)

      if (reactivateError) {
        console.error('Reactivate client error:', reactivateError)
        return NextResponse.json({ error: 'Impossible de réactiver le client' }, { status: 500 })
      }

      try {
        await sendReactivationEmail({
          to: client.email,
          clientFirstName: client.first_name ?? 'vous',
          coachName,
          loginUrl: `${siteUrl}/client/login`,
        })
      } catch (emailError) {
        console.error('Reactivation email failed:', emailError)
        // Non-bloquant — le compte est réactivé même si l'email échoue
      }

      return NextResponse.json({ success: true, mode: 'reactivated' })
    }

    // User exists but is NOT suspended — send reconnection flow only once we have
    // a strong signal that the account was already activated.
    if (hasActivatedAccount) {
      await db
        .from('coach_clients')
        .update({ status: 'active', user_id: existingUser.id })
        .eq('id', params.clientId)

      const { data: magicLinkData, error: magicLinkError } = await db.auth.admin.generateLink({
        type: 'magiclink',
        email: client.email,
        // A magic link needs its own public landing route. Redirecting to /client
        // makes the auth middleware send a token-bearing URL to the generic login
        // page, which is also used for onboarding and password recovery.
        options: { redirectTo: `${siteUrl}/client/access/login` },
      })

      if (magicLinkError || !magicLinkData?.properties?.action_link) {
        console.error('generateLink magiclink error:', magicLinkError)
        return NextResponse.json({ error: 'Impossible de générer le lien de connexion' }, { status: 500 })
      }

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1h
      // Do not put Supabase's one-time action URL directly in the email. Some mail
      // security scanners follow it automatically, which consumes the token before
      // the client can use it. The interstitial only redirects after an explicit POST.
      const accessUrl = `${siteUrl}/client/access/continue?target=${encodeURIComponent(magicLinkData.properties.action_link)}`
      try {
        await sendAccessLinkEmail({
          to: client.email,
          clientFirstName: client.first_name ?? 'vous',
          coachName,
          accessUrl,
          expiresAt,
        })
      } catch (emailError) {
        console.error('Access link email failed:', emailError)
        return NextResponse.json({ error: 'Erreur lors de l\'envoi de l\'email' }, { status: 500 })
      }

      return NextResponse.json({ success: true, mode: 'access_link' })
    }
  }

  // New user OR existing user who never completed onboarding:
  // generate a recovery (set-password) link → /client/onboarding.
  // type 'recovery' works for both new and existing users (no 422 on existing email),
  // and reliably produces a #access_token hash on all browsers including mobile Safari.
  let authUserId: string

  if (!existingUser) {
    const { data: created, error: createError } = await db.auth.admin.createUser({
      email: client.email,
      email_confirm: true,
      password: `Aa1!${crypto.randomUUID()}`, // placeholder — overwritten when client sets their password
    })

    if (createError || !created?.user) {
      console.error('createUser error:', createError)
      return NextResponse.json({ error: 'Impossible de créer le compte' }, { status: 500 })
    }

    authUserId = created.user.id
  } else {
    authUserId = existingUser.id
  }

  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: 'recovery',
    email: client.email,
    options: { redirectTo: `${siteUrl}/client/onboarding` },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('generateLink recovery error:', linkError)
    return NextResponse.json({ error: 'Impossible de générer le lien d\'invitation' }, { status: 500 })
  }

  await db
    .from('coach_clients')
    .update({ status: 'active', user_id: authUserId })
    .eq('id', params.clientId)

  try {
    await sendInvitationEmail({
      to: client.email,
      clientFirstName: client.first_name ?? 'vous',
      coachName,
      setupPasswordUrl: linkData.properties.action_link,
    })
  } catch (emailError) {
    console.error('Invitation email failed:', emailError)
    return NextResponse.json({ error: 'Erreur lors de l\'envoi de l\'email' }, { status: 500 })
  }

  return NextResponse.json({ success: true, mode: 'invited' })
}
