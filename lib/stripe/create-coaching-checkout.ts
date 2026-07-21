import type { SupabaseClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import { stripe, BILLING_TO_STRIPE } from "@/lib/stripe/client"
import {
  getCoachConnectAccount,
  syncCoachConnectAccount,
} from "@/lib/stripe/connect"

export type CreateCoachingCheckoutInput = {
  db: SupabaseClient
  /** Coach auth user id (owner of the connected Stripe account). */
  coachUserId: string
  clientId: string
  formulaId?: string | null
  subscriptionId?: string | null
  paymentId?: string | null
  /** Where Stripe redirects after success/cancel (absolute or site-relative). */
  successUrl?: string
  cancelUrl?: string
}

export type CreateCoachingCheckoutResult = {
  url: string
  sessionId: string
}

/**
 * Creates a Stripe Checkout Session on the coach's Connect account.
 * Shared by coach CRM and the client PWA so the client can mint a fresh
 * session at click time (sessions expire; pre-generated links break in-app).
 */
export async function createCoachingCheckoutSession(
  input: CreateCoachingCheckoutInput,
): Promise<CreateCoachingCheckoutResult> {
  const {
    db,
    coachUserId,
    clientId: bodyClientId,
    formulaId: bodyFormulaId,
    subscriptionId: bodySubscriptionId,
    paymentId,
    successUrl: successUrlOverride,
    cancelUrl: cancelUrlOverride,
  } = input

  let clientId = bodyClientId
  let formulaId = bodyFormulaId ?? null
  let subscriptionId = bodySubscriptionId ?? null
  let amountEur: number | null = null
  let paymentDescription: string | null = null

  if (paymentId) {
    const { data: payment, error: pErr } = await db
      .from("subscription_payments")
      .select("*, subscription:client_subscriptions(id, formula_id)")
      .eq("id", paymentId)
      .eq("coach_id", coachUserId)
      .single()

    if (pErr || !payment) {
      throw new CheckoutError("Paiement introuvable", 404)
    }

    if (payment.status === "paid") {
      throw new CheckoutError("Ce paiement a déjà été réglé", 409)
    }

    clientId = payment.client_id
    amountEur = Number(payment.amount_eur)
    paymentDescription = payment.description
    if (payment.subscription) {
      subscriptionId = payment.subscription.id
      formulaId = payment.subscription.formula_id
    }
  }

  if (!clientId) {
    throw new CheckoutError("client_id requis", 400)
  }

  let connectedAccountId: string
  try {
    const connectAccount = await getCoachConnectAccount(coachUserId)
    if (!connectAccount.accountId) {
      throw new CheckoutError(
        "Le coach n’a pas encore connecté son compte Stripe.",
        409,
      )
    }

    const status = await syncCoachConnectAccount(
      coachUserId,
      connectAccount.accountId,
    )
    if (!status.chargesEnabled) {
      throw new CheckoutError(
        "Le compte Stripe du coach doit être finalisé avant d’encaisser.",
        409,
      )
    }

    connectedAccountId = connectAccount.accountId
  } catch (error) {
    if (error instanceof CheckoutError) throw error
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de vérifier le compte Stripe."
    throw new CheckoutError(message, 503)
  }

  let stripeProductId: string | null = null
  let stripePriceId: string | null = null
  let formula: any = null

  if (formulaId) {
    const { data: fData, error: fErr } = await db
      .from("coach_formulas")
      .select("*")
      .eq("id", formulaId)
      .eq("coach_id", coachUserId)
      .single()

    if (fErr || !fData) {
      throw new CheckoutError("Formule introuvable", 404)
    }

    formula = fData
    stripeProductId =
      formula.stripe_connected_account_id === connectedAccountId
        ? formula.stripe_product_id
        : null
    stripePriceId =
      formula.stripe_connected_account_id === connectedAccountId
        ? formula.stripe_price_id
        : null

    if (!stripeProductId || !stripePriceId) {
      const product = await stripe.products.create(
        {
          name: formula.name,
          description: formula.description ?? undefined,
          metadata: {
            formula_id: formula.id,
            coach_id: coachUserId,
          },
        },
        { stripeAccount: connectedAccountId },
      )
      stripeProductId = product.id

      const isOneTime = formula.billing_cycle === "one_time"
      const priceAmount = Math.round(formula.price_eur * 100)

      const priceParams: Parameters<typeof stripe.prices.create>[0] = {
        product: stripeProductId,
        currency: "eur",
        unit_amount: priceAmount,
        metadata: { formula_id: formula.id },
      }

      if (!isOneTime) {
        const recurring = BILLING_TO_STRIPE[formula.billing_cycle]
        if (recurring) {
          priceParams.recurring = recurring
        }
      }

      const price = await stripe.prices.create(priceParams, {
        stripeAccount: connectedAccountId,
      })
      stripePriceId = price.id

      await db
        .from("coach_formulas")
        .update({
          stripe_product_id: stripeProductId,
          stripe_price_id: stripePriceId,
          stripe_connected_account_id: connectedAccountId,
        })
        .eq("id", formula.id)
    }
  } else {
    if (!amountEur) {
      throw new CheckoutError("Montant requis pour un paiement standalone", 400)
    }

    const product = await stripe.products.create(
      {
        name: paymentDescription || "Prestation de coaching",
        metadata: {
          payment_id: paymentId ?? "",
          coach_id: coachUserId,
        },
      },
      { stripeAccount: connectedAccountId },
    )
    stripeProductId = product.id

    const price = await stripe.prices.create(
      {
        product: stripeProductId,
        currency: "eur",
        unit_amount: Math.round(amountEur * 100),
        metadata: { payment_id: paymentId ?? "" },
      },
      { stripeAccount: connectedAccountId },
    )
    stripePriceId = price.id
  }

  const { data: client, error: cErr } = await db
    .from("coach_clients")
    .select(
      "id, first_name, last_name, email, stripe_customer_id, stripe_connected_account_id",
    )
    .eq("id", clientId)
    .eq("coach_id", coachUserId)
    .single()

  if (cErr || !client) {
    throw new CheckoutError("Client introuvable", 404)
  }
  if (!client.email) {
    throw new CheckoutError(
      "Ce client n'a pas d'email — requis pour Stripe",
      422,
    )
  }

  let stripeCustomerId =
    client.stripe_connected_account_id === connectedAccountId
      ? client.stripe_customer_id
      : null

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create(
      {
        email: client.email,
        name: `${client.first_name} ${client.last_name}`,
        metadata: {
          client_id: client.id,
          coach_id: coachUserId,
        },
      },
      { stripeAccount: connectedAccountId },
    )
    stripeCustomerId = customer.id

    await db
      .from("coach_clients")
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_connected_account_id: connectedAccountId,
      })
      .eq("id", client.id)
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const isOneTime = formula ? formula.billing_cycle === "one_time" : true

  const successUrl =
    successUrlOverride ??
    `${baseUrl}/client/paiement?stripe=success${paymentId ? `&payment_id=${paymentId}` : ""}`
  const cancelUrl =
    cancelUrlOverride ??
    `${baseUrl}/client/paiement?stripe=cancelled${paymentId ? `&payment_id=${paymentId}` : ""}`

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    line_items: [{ price: stripePriceId!, quantity: 1 }],
    mode: isOneTime ? "payment" : "subscription",
    customer: stripeCustomerId,
    success_url: successUrl.startsWith("http")
      ? successUrl
      : `${baseUrl}${successUrl}`,
    cancel_url: cancelUrl.startsWith("http")
      ? cancelUrl
      : `${baseUrl}${cancelUrl}`,
    metadata: {
      client_id: clientId,
      formula_id: formulaId ?? "",
      subscription_id: subscriptionId ?? "",
      payment_id: paymentId ?? "",
      coach_id: coachUserId,
      type: "coaching",
    },
    custom_text: {
      submit: { message: `Vous serez facturé par votre coach.` },
    },
  }

  if (formula && !isOneTime && formula.duration_months) {
    ;(sessionParams as Record<string, unknown>).subscription_data = {
      metadata: {
        client_id: clientId,
        formula_id: formulaId,
        coach_id: coachUserId,
      },
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams, {
    stripeAccount: connectedAccountId,
  })

  if (!session.url) {
    throw new CheckoutError("Stripe n’a pas renvoyé d’URL de paiement", 502)
  }

  if (subscriptionId) {
    await db
      .from("client_subscriptions")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", subscriptionId)
      .eq("coach_id", coachUserId)
  }

  if (paymentId) {
    await db
      .from("subscription_payments")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", paymentId)
      .eq("coach_id", coachUserId)
  }

  return { url: session.url, sessionId: session.id }
}

export class CheckoutError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "CheckoutError"
    this.status = status
  }
}
