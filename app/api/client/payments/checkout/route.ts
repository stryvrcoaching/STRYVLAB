import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { resolveClientFromUser } from "@/lib/client/resolve-client"
import {
  CheckoutError,
  createCoachingCheckoutSession,
} from "@/lib/stripe/create-coaching-checkout"

function db() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * POST /api/client/payments/checkout
 *
 * Client-authenticated: mint a FRESH Stripe Checkout Session for a pending
 * payment (or formula/subscription request). Avoids expired pre-generated links.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const paymentId =
    typeof body.payment_id === "string" ? body.payment_id : null
  const subscriptionId =
    typeof body.subscription_id === "string" ? body.subscription_id : null
  const formulaId =
    typeof body.formula_id === "string" ? body.formula_id : null

  if (!paymentId && !subscriptionId && !formulaId) {
    return NextResponse.json(
      { error: "payment_id, subscription_id ou formula_id requis" },
      { status: 400 },
    )
  }

  const service = db()
  const client = await resolveClientFromUser(
    user.id,
    user.email,
    service,
    "id, coach_id, email, first_name",
  )

  if (!client?.id || !client.coach_id) {
    return NextResponse.json({ error: "Profil client introuvable" }, { status: 404 })
  }

  const coachId = client.coach_id as string
  const clientId = client.id as string

  // Ownership checks
  if (paymentId) {
    const { data: payment } = await service
      .from("subscription_payments")
      .select("id, client_id, coach_id, status")
      .eq("id", paymentId)
      .maybeSingle()

    if (!payment || payment.client_id !== clientId || payment.coach_id !== coachId) {
      return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 })
    }
    if (payment.status === "paid") {
      return NextResponse.json(
        { error: "Ce paiement a déjà été réglé", already_paid: true },
        { status: 409 },
      )
    }
  }

  if (subscriptionId) {
    const { data: sub } = await service
      .from("client_subscriptions")
      .select("id, client_id, coach_id")
      .eq("id", subscriptionId)
      .maybeSingle()

    if (!sub || sub.client_id !== clientId || sub.coach_id !== coachId) {
      return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 })
    }
  }

  try {
    const result = await createCoachingCheckoutSession({
      db: service,
      coachUserId: coachId,
      clientId,
      paymentId,
      subscriptionId,
      formulaId,
    })

    return NextResponse.json({
      url: result.url,
      session_id: result.sessionId,
    })
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[client/payments/checkout]", error)
    return NextResponse.json(
      { error: "Impossible d’ouvrir le paiement sécurisé" },
      { status: 500 },
    )
  }
}
