import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { resolveClientFromUser } from "@/lib/client/resolve-client"

function db() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * GET /api/client/payments/pending?payment_id=...
 * Details for the client payment screen.
 */
export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const paymentId = req.nextUrl.searchParams.get("payment_id")
  const subscriptionId = req.nextUrl.searchParams.get("subscription_id")
  const formulaId = req.nextUrl.searchParams.get("formula_id")

  const service = db()
  const client = await resolveClientFromUser(
    user.id,
    user.email,
    service,
    "id, coach_id, first_name",
  )
  if (!client?.id || !client.coach_id) {
    return NextResponse.json({ error: "Profil client introuvable" }, { status: 404 })
  }

  const clientId = client.id as string
  const coachId = client.coach_id as string

  const { data: coachProfile } = await service
    .from("coach_profiles")
    .select("full_name, logo_url")
    .eq("coach_id", coachId)
    .maybeSingle()

  if (paymentId) {
    const { data: payment } = await service
      .from("subscription_payments")
      .select(
        "id, amount_eur, status, description, due_date, payment_date, subscription:client_subscriptions(id, formula:coach_formulas(id, name, price_eur))",
      )
      .eq("id", paymentId)
      .eq("client_id", clientId)
      .eq("coach_id", coachId)
      .maybeSingle()

    if (!payment) {
      return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 })
    }

    const sub = payment.subscription as any
    return NextResponse.json({
      payment: {
        id: payment.id,
        amount_eur: Number(payment.amount_eur),
        status: payment.status,
        description:
          payment.description ??
          sub?.formula?.name ??
          "Prestation de coaching",
        formula_name: sub?.formula?.name ?? null,
        due_date: payment.due_date ?? payment.payment_date,
        subscription_id: sub?.id ?? null,
        formula_id: sub?.formula?.id ?? null,
      },
      coach: {
        fullName: coachProfile?.full_name ?? null,
        avatarUrl: coachProfile?.logo_url ?? null,
      },
    })
  }

  // Subscription / formula request without a pre-created payment row
  if (subscriptionId || formulaId) {
    let formula: { id: string; name: string; price_eur: number } | null = null
    let resolvedSubscriptionId = subscriptionId

    if (subscriptionId) {
      const { data: sub } = await service
        .from("client_subscriptions")
        .select(
          "id, formula_id, price_override_eur, formula:coach_formulas(id, name, price_eur)",
        )
        .eq("id", subscriptionId)
        .eq("client_id", clientId)
        .eq("coach_id", coachId)
        .maybeSingle()

      if (!sub) {
        return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 })
      }

      const f = sub.formula as any
      formula = f
        ? {
            id: f.id,
            name: f.name,
            price_eur: Number(sub.price_override_eur ?? f.price_eur),
          }
        : null
    } else if (formulaId) {
      const { data: f } = await service
        .from("coach_formulas")
        .select("id, name, price_eur")
        .eq("id", formulaId)
        .eq("coach_id", coachId)
        .maybeSingle()

      if (!f) {
        return NextResponse.json({ error: "Formule introuvable" }, { status: 404 })
      }
      formula = {
        id: f.id,
        name: f.name,
        price_eur: Number(f.price_eur),
      }
    }

    return NextResponse.json({
      payment: {
        id: null,
        amount_eur: formula?.price_eur ?? 0,
        status: "pending",
        description: formula?.name ?? "Prestation de coaching",
        formula_name: formula?.name ?? null,
        due_date: null,
        subscription_id: resolvedSubscriptionId,
        formula_id: formula?.id ?? formulaId,
      },
      coach: {
        fullName: coachProfile?.full_name ?? null,
        avatarUrl: coachProfile?.logo_url ?? null,
      },
    })
  }

  // Fallback: latest pending payment for this client
  const { data: latest } = await service
    .from("subscription_payments")
    .select(
      "id, amount_eur, status, description, due_date, payment_date, subscription:client_subscriptions(id, formula:coach_formulas(id, name, price_eur))",
    )
    .eq("client_id", clientId)
    .eq("coach_id", coachId)
    .eq("status", "pending")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!latest) {
    return NextResponse.json({ payment: null, coach: {
      fullName: coachProfile?.full_name ?? null,
      avatarUrl: coachProfile?.logo_url ?? null,
    } })
  }

  const sub = latest.subscription as any
  return NextResponse.json({
    payment: {
      id: latest.id,
      amount_eur: Number(latest.amount_eur),
      status: latest.status,
      description:
        latest.description ?? sub?.formula?.name ?? "Prestation de coaching",
      formula_name: sub?.formula?.name ?? null,
      due_date: latest.due_date ?? latest.payment_date,
      subscription_id: sub?.id ?? null,
      formula_id: sub?.formula?.id ?? null,
    },
    coach: {
      fullName: coachProfile?.full_name ?? null,
      avatarUrl: coachProfile?.logo_url ?? null,
    },
  })
}
