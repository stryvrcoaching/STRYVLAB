import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
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
 * POST /api/stripe/coaching/checkout
 *
 * Coach-side: create a Stripe Checkout Session for a client payment / formula.
 * Prefer sending clients to /client/paiement (fresh session) rather than a
 * pre-baked Checkout URL that expires.
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
  const {
    client_id,
    subscription_id,
    formula_id,
    payment_id,
    source,
  } = body as {
    client_id?: string
    subscription_id?: string
    formula_id?: string
    payment_id?: string
    source?: string
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const isClientSource = source === "client" || !!payment_id

  const successUrl = isClientSource
    ? `${baseUrl}/client/paiement?stripe=success${payment_id ? `&payment_id=${payment_id}` : ""}`
    : formula_id
      ? `${baseUrl}/coach/clients/${client_id}?tab=formules&stripe=success`
      : `${baseUrl}/coach/comptabilite?stripe=success`

  const cancelUrl = isClientSource
    ? `${baseUrl}/client/paiement?stripe=cancelled${payment_id ? `&payment_id=${payment_id}` : ""}`
    : formula_id
      ? `${baseUrl}/coach/clients/${client_id}?tab=formules&stripe=cancelled`
      : `${baseUrl}/coach/comptabilite?stripe=cancelled`

  try {
    const result = await createCoachingCheckoutSession({
      db: db(),
      coachUserId: user.id,
      clientId: client_id ?? "",
      formulaId: formula_id,
      subscriptionId: subscription_id,
      paymentId: payment_id,
      successUrl,
      cancelUrl,
    })

    return NextResponse.json({
      url: result.url,
      session_id: result.sessionId,
    })
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[coaching/checkout]", error)
    return NextResponse.json(
      { error: "Impossible de créer la session de paiement" },
      { status: 500 },
    )
  }
}
