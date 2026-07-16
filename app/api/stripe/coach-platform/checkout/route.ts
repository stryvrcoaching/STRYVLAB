import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe/client'
import { getStripePriceIdForPlan } from '@/lib/billing/stripeCoachPlatform'
import { z } from 'zod'

function db() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const bodySchema = z.object({
  plan: z.enum(['solo', 'pro', 'studio']),
})

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const { plan } = parsed.data
    const stripePriceId = getStripePriceIdForPlan(plan)
    if (!stripePriceId) {
      return NextResponse.json(
        { error: `Aucun prix Stripe configuré pour le plan ${plan}.` },
        { status: 422 },
      )
    }

    const service = db()
    const { data: profile, error: profileError } = await service
    .from('coach_profiles')
    .select(
      'coach_id, full_name, pro_email, stripe_customer_id, stripe_subscription_id, billing_status, trial_ends_at, trial_consumed_at',
    )
    .eq('coach_id', user.id)
    .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    let stripeCustomerId = profile?.stripe_customer_id ?? null
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
      email: profile?.pro_email ?? user.email ?? undefined,
      name: profile?.full_name ?? undefined,
      metadata: {
        coach_id: user.id,
        scope: 'coach_platform',
      },
    })
      stripeCustomerId = customer.id

      await service
      .from('coach_profiles')
      .upsert(
        {
          coach_id: user.id,
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'coach_id' },
      )
    }

    if (profile?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(profile.billing_status ?? '')) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/coach/settings`,
    })

      return NextResponse.json(
      {
        error: 'Un abonnement Stripe existe déjà pour ce coach.',
        portalUrl: portal.url,
      },
      { status: 409 },
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    // An expired or cancelled trial must stay consumed. We only offer it on the
    // first completed subscription, and let Stripe collect a payment method now.
    const hasUsedTrial = Boolean(profile?.trial_consumed_at ?? profile?.trial_ends_at)
    const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: stripePriceId, quantity: 1 }],
    payment_method_collection: 'always',
    allow_promotion_codes: true,
    success_url: `${baseUrl}/coach/settings?stripe=success`,
    cancel_url: `${baseUrl}/coach/settings?stripe=cancelled`,
    metadata: {
      type: 'coach_platform',
      coach_id: user.id,
      plan,
    },
    subscription_data: {
      metadata: {
        type: 'coach_platform',
        coach_id: user.id,
        plan,
      },
      ...(hasUsedTrial
        ? {}
        : {
            trial_period_days: 14,
            trial_settings: {
              end_behavior: { missing_payment_method: 'cancel' },
            },
          }),
    },
  })

    await service
    .from('coach_profiles')
    .upsert(
      {
        coach_id: user.id,
        stripe_customer_id: stripeCustomerId,
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'coach_id' },
    )

    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Stripe error'
    console.error('Coach platform checkout failed:', message)
    return NextResponse.json(
      {
        error:
          "Impossible de créer le paiement. Vérifiez que la clé Stripe et le tarif configuré appartiennent au même environnement Stripe.",
      },
      { status: 500 },
    )
  }
}
