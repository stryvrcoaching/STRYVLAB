import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe/client'
import { sendPaymentReceiptEmail } from '@/lib/email/mailer'
import Stripe from 'stripe'

// Disable body parsing — Stripe requires raw body for signature verification
export const runtime = 'nodejs'

function db() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const WEBHOOK_SECRET = process.env.STRIPE_COACHING_WEBHOOK_SECRET
  ?? process.env.STRIPE_WEBHOOK_SECRET!

/**
 * POST /api/stripe/coaching/webhook
 *
 * Gère les événements Stripe pour les abonnements coaching :
 *
 * checkout.session.completed
 *   → active l'abonnement client + crée stripe_subscription_id
 *
 * invoice.payment_succeeded
 *   → enregistre un subscription_payment + envoie reçu email client
 *
 * invoice.payment_failed
 *   → marque le paiement en échec + notifie
 *
 * customer.subscription.deleted / customer.subscription.updated
 *   → sync statut abonnement (cancelled / paused / active)
 */
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('⚠️ Coaching webhook signature failed:', msg)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const service = db()

  try {
    switch (event.type) {

      // ── 1. Checkout complété ────────────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.type !== 'coaching') break

        const { client_id, formula_id, subscription_id, coach_id } = session.metadata

        // Récupère le stripe_subscription_id si mode subscription
        const stripeSubId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id ?? null

        if (subscription_id) {
          // Met à jour l'abonnement existant
          await service
            .from('client_subscriptions')
            .update({
              status: 'active',
              stripe_subscription_id: stripeSubId,
              stripe_checkout_session_id: session.id,
            })
            .eq('id', subscription_id)
        } else {
          // Crée l'abonnement s'il n'existait pas encore (cas one-time ou flow sans pre-creation)
          await service
            .from('client_subscriptions')
            .insert({
              coach_id,
              client_id,
              formula_id,
              status: 'active',
              start_date: new Date().toISOString().split('T')[0],
              stripe_subscription_id: stripeSubId,
              stripe_checkout_session_id: session.id,
            })
        }

        // Enregistre le paiement initial (mode payment one-time)
        if (session.mode === 'payment' && session.amount_total) {
          await recordPayment(service, {
            coachId: coach_id,
            clientId: client_id,
            subscriptionId: subscription_id ?? null,
            amountEur: session.amount_total / 100,
            stripePaymentIntentId: typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
            description: 'Paiement Stripe',
            method: 'stripe',
          })
        }
        break
      }

      // ── 2. Facture payée (abonnement récurrent) ─────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        // Uniquement les factures d'abonnement coaching (pas les IPT etc.)
        const stripeSubId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id ?? null
        if (!stripeSubId) break

        // Retrouve l'abonnement dans notre DB
        const { data: sub } = await service
          .from('client_subscriptions')
          .select('id, coach_id, client_id, formula_id')
          .eq('stripe_subscription_id', stripeSubId)
          .single()

        if (!sub) break

        const amountEur = (invoice.amount_paid ?? 0) / 100
        const paymentRow = await recordPayment(service, {
          coachId:     sub.coach_id,
          clientId:    sub.client_id,
          subscriptionId: sub.id,
          amountEur,
          stripePaymentIntentId: typeof invoice.payment_intent === 'string'
            ? invoice.payment_intent
            : invoice.payment_intent?.id ?? null,
          description: invoice.description ?? `Abonnement — ${invoice.number ?? ''}`.trim(),
          method: 'stripe',
        })

        // Envoie reçu email au client
        const { data: client } = await service
          .from('coach_clients')
          .select('first_name, last_name, email')
          .eq('id', sub.client_id)
          .single()

        if (client?.email) {
          sendPaymentReceiptEmail({
            to: client.email,
            clientFirstName: client.first_name,
            coachName: null,
            amount: amountEur,
            description: invoice.description ?? null,
            paymentDate: new Date().toISOString().split('T')[0],
            reference: invoice.number ?? null,
            method: 'stripe',
          }).catch(e => console.error('Receipt email failed:', e))
        }
        break
      }

      // ── 3. Facture échouée ──────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const stripeSubId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id ?? null
        if (!stripeSubId) break

        const { data: sub } = await service
          .from('client_subscriptions')
          .select('id, coach_id, client_id')
          .eq('stripe_subscription_id', stripeSubId)
          .single()

        if (!sub) break

        // Enregistre tentative échouée
        await recordPayment(service, {
          coachId:     sub.coach_id,
          clientId:    sub.client_id,
          subscriptionId: sub.id,
          amountEur:   (invoice.amount_due ?? 0) / 100,
          stripePaymentIntentId: null,
          description: `Paiement échoué — ${invoice.number ?? ''}`.trim(),
          method: 'stripe',
          status: 'failed',
        })
        break
      }

      // ── 4. Abonnement annulé ────────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await service
          .from('client_subscriptions')
          .update({ status: 'cancelled' })
          .eq('stripe_subscription_id', sub.id)
        break
      }

      // ── 5. Abonnement mis à jour (pause, reprise, etc.) ─────────────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const statusMap: Record<string, string> = {
          active:   'active',
          past_due: 'active',  // on garde active, facture en échec gérée séparément
          paused:   'paused',
          canceled: 'cancelled',
          unpaid:   'paused',
          trialing: 'trial',
        }
        const newStatus = statusMap[sub.status] ?? 'active'
        await service
          .from('client_subscriptions')
          .update({ status: newStatus })
          .eq('stripe_subscription_id', sub.id)
        break
      }

      default:
        // Événement non géré — on acknowledge quand même
        break
    }
  } catch (err) {
    console.error('Coaching webhook processing error:', err)
    return NextResponse.json({ error: 'Processing error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function recordPayment(
  service: ReturnType<typeof createServiceClient>,
  opts: {
    coachId: string
    clientId: string
    subscriptionId: string | null
    amountEur: number
    stripePaymentIntentId: string | null
    description: string
    method: string
    status?: string
  }
) {
  const { data } = await service
    .from('subscription_payments')
    .insert({
      coach_id:                  opts.coachId,
      client_id:                 opts.clientId,
      subscription_id:           opts.subscriptionId,
      amount_eur:                opts.amountEur,
      status:                    opts.status ?? 'paid',
      payment_method:            opts.method,
      payment_date:              new Date().toISOString().split('T')[0],
      description:               opts.description || null,
      stripe_payment_intent_id:  opts.stripePaymentIntentId,
    })
    .select()
    .single()

  return data
}
