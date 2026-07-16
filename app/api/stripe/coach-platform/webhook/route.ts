import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe/client'
import {
  getPlanDefaults,
  mapStripeSubscriptionStatusToBillingStatus,
  resolvePlanFromStripePriceId,
} from '@/lib/billing/stripeCoachPlatform'
import { sendCoachPlatformTrialEmail } from '@/lib/email/coach-platform'
import { registerPaidCoachInvoice } from '@/lib/sales/commission-service'
import {
  beginStripeWebhookProcessing,
  finishStripeWebhookProcessing,
} from '@/lib/security/stripe-webhook-idempotency'
import { createPostCancellationWindow } from '@/lib/privacy/retention'

export const runtime = 'nodejs'

function db() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_COACH_PLATFORM_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook non configuré' }, { status: 503 })
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Signature absente' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('⚠️ Coach platform webhook signature failed:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const service = db()
  const shouldProcess = await beginStripeWebhookProcessing(service, event)

  if (!shouldProcess) {
    return NextResponse.json({ received: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.type !== 'coach_platform') break

        const coachId = session.metadata.coach_id
        if (!coachId) break

        await service
          .from('coach_profiles')
          .upsert(
            {
              coach_id: coachId,
              stripe_customer_id:
                typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
              stripe_subscription_id:
                typeof session.subscription === 'string'
                  ? session.subscription
                  : session.subscription?.id ?? null,
              stripe_checkout_session_id: session.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'coach_id' },
          )

        await sendTrialConfirmationEmail(session)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await syncSubscriptionToCoachProfile(service, subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id ?? null
        const coachId = subscription.metadata?.coach_id ?? null

        const endedAtSeconds = subscription.ended_at ?? subscription.current_period_end ?? event.created
        const retentionWindow = createPostCancellationWindow(new Date(endedAtSeconds * 1000))
        const updatePayload = {
          plan: 'solo',
          billing_status: 'canceled',
          client_limit: getPlanDefaults('solo').clientLimit,
          team_seats: getPlanDefaults('solo').teamSeats,
          stripe_subscription_id: null,
          stripe_price_id: null,
          stripe_current_period_end: null,
          billing_ended_at: retentionWindow.billingEndedAt,
          data_export_available_until: retentionWindow.exportAvailableUntil,
          data_deletion_scheduled_at: retentionWindow.deletionScheduledAt,
          updated_at: new Date().toISOString(),
        }

        await updateCoachProfileByStripeIdentity(service, {
          customerId,
          subscriptionId: subscription.id,
          coachId,
          payload: updatePayload,
        })
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await registerSalesCommissionForInvoice(service, invoice)
        break
      }

      default:
        break
    }
    await finishStripeWebhookProcessing({ db: service, eventId: event.id, status: 'processed' })
  } catch (error) {
    console.error('Coach platform webhook processing error:', error)
    await finishStripeWebhookProcessing({
      db: service,
      eventId: event.id,
      status: 'failed',
      processingError: error instanceof Error ? error.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Processing error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function sendTrialConfirmationEmail(session: Stripe.Checkout.Session) {
  if (session.metadata?.type !== 'coach_platform') return

  const email = session.customer_details?.email ?? session.customer_email
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null

  if (!email || !subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  if (!subscription.trial_end) return

  const price = subscription.items.data[0]?.price
  const plan =
    resolvePlanFromStripePriceId(price?.id) ??
    (session.metadata.plan === 'solo' || session.metadata.plan === 'pro' || session.metadata.plan === 'studio'
      ? session.metadata.plan
      : null)
  const planLabel = plan ? { solo: 'Solo', pro: 'Pro', studio: 'Studio' }[plan] : null
  const monthlyPrice = formatMonthlyPrice(price)

  if (!planLabel || !monthlyPrice) return

  await sendCoachPlatformTrialEmail({
    to: email,
    coachName: session.customer_details?.name,
    planLabel,
    monthlyPrice,
    trialEndsAt: new Date(subscription.trial_end * 1000),
  })
}

function formatMonthlyPrice(price?: Stripe.Price) {
  if (!price || price.unit_amount === null || price.recurring?.interval !== 'month') return null

  const amount = price.unit_amount / 100
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: price.currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)

  return `${formatted} / mois`
}

async function syncSubscriptionToCoachProfile(
  service: ReturnType<typeof createServiceClient>,
  subscription: Stripe.Subscription,
) {
  const coachId = subscription.metadata?.coach_id ?? null
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? null

  const stripePriceId = subscription.items.data[0]?.price?.id ?? null
  const derivedPlan =
    resolvePlanFromStripePriceId(stripePriceId) ??
    (subscription.metadata?.plan === 'pro' || subscription.metadata?.plan === 'studio'
      ? subscription.metadata.plan
      : 'solo')

  const defaults = getPlanDefaults(derivedPlan)
  const billingStatus = mapStripeSubscriptionStatusToBillingStatus(subscription.status)
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null
  const trialStartedAt = subscription.trial_start
    ? new Date(subscription.trial_start * 1000).toISOString()
    : null
  const trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null

  const payload = {
    plan: derivedPlan,
    billing_status: billingStatus,
    client_limit: defaults.clientLimit,
    team_seats: defaults.teamSeats,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: stripePriceId,
    stripe_current_period_end: currentPeriodEnd,
    billing_ended_at: null,
    data_export_available_until: null,
    data_deletion_scheduled_at: null,
    ...(trialEndsAt
      ? {
          trial_started_at: trialStartedAt,
          trial_consumed_at: trialStartedAt ?? new Date().toISOString(),
          trial_ends_at: trialEndsAt,
        }
      : {}),
    updated_at: new Date().toISOString(),
  }

  await updateCoachProfileByStripeIdentity(service, {
    customerId,
    subscriptionId: subscription.id,
    coachId,
    payload,
  })
}

async function updateCoachProfileByStripeIdentity(
  service: ReturnType<typeof createServiceClient>,
  opts: {
    customerId: string | null
    subscriptionId: string | null
    coachId: string | null
    payload: Record<string, unknown>
  },
) {
  if (opts.customerId) {
    const customerUpdate = await service
      .from('coach_profiles')
      .update(opts.payload)
      .eq('stripe_customer_id', opts.customerId)
      .select('coach_id')

    if (!customerUpdate.error && (customerUpdate.data?.length ?? 0) > 0) return
  }

  if (opts.subscriptionId) {
    const subscriptionUpdate = await service
      .from('coach_profiles')
      .update(opts.payload)
      .eq('stripe_subscription_id', opts.subscriptionId)
      .select('coach_id')

    if (!subscriptionUpdate.error && (subscriptionUpdate.data?.length ?? 0) > 0) return
  }

  if (opts.coachId) {
    await service
      .from('coach_profiles')
      .upsert(
        {
          coach_id: opts.coachId,
          ...opts.payload,
        },
        { onConflict: 'coach_id' },
      )
  }
}

async function registerSalesCommissionForInvoice(
  service: ReturnType<typeof createServiceClient>,
  invoice: Stripe.Invoice,
) {
  const subscriptionId = getInvoiceSubscriptionId(invoice)
  if (!subscriptionId) return

  const { data: profile, error } = await service
    .from('coach_profiles')
    .select('coach_id, plan')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle()

  if (error) throw error
  if (!profile?.coach_id) return

  const { data: authUser, error: authError } = await service.auth.admin.getUserById(profile.coach_id)
  if (authError || !authUser.user?.email) {
    if (authError) console.error('[sales/commission] coach email unavailable', authError)
    return
  }

  await registerPaidCoachInvoice(service, {
    invoiceId: invoice.id,
    subscriptionId,
    coachId: profile.coach_id,
    coachEmail: authUser.user.email,
    plan: profile.plan,
    amountPaidEur: invoice.amount_paid / 100,
    paidAt: new Date().toISOString(),
  })
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const rawInvoice = invoice as Stripe.Invoice & {
    subscription?: string | { id?: string } | null
    parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null
  }
  const subscription = rawInvoice.subscription ?? rawInvoice.parent?.subscription_details?.subscription ?? null

  if (typeof subscription === 'string') return subscription
  return subscription?.id ?? null
}
