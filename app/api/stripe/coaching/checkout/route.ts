import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { stripe, BILLING_TO_STRIPE } from "@/lib/stripe/client";

function db() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * POST /api/stripe/coaching/checkout
 *
 * Crée une Stripe Checkout Session pour facturer un client coach.
 *
 * Body: { client_id, subscription_id, formula_id }
 *   - client_id       : coach_clients.id
 *   - subscription_id : client_subscriptions.id (déjà créé manuellement ou à créer)
 *   - formula_id      : coach_formulas.id (pour récupérer prix + cycle)
 *
 * Flow:
 *  1. Récupère formula + client
 *  2. Crée/récupère Stripe Product + Price pour la formule
 *  3. Crée/récupère Stripe Customer pour le client
 *  4. Crée Stripe Checkout Session (subscription ou payment selon billing_cycle)
 *  5. Stocke stripe_checkout_session_id sur client_subscriptions
 *  6. Retourne { url } pour redirection
 */
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const { client_id, subscription_id, formula_id } = body;

  if (!client_id || !formula_id) {
    return NextResponse.json(
      { error: "client_id et formula_id requis" },
      { status: 400 },
    );
  }

  const service = db();

  // 1. Récupère formula + vérification ownership
  const { data: formula, error: fErr } = await service
    .from("coach_formulas")
    .select("*")
    .eq("id", formula_id)
    .eq("coach_id", user.id)
    .single();

  if (fErr || !formula)
    return NextResponse.json({ error: "Formule introuvable" }, { status: 404 });

  // 2. Récupère client
  const { data: client, error: cErr } = await service
    .from("coach_clients")
    .select("id, first_name, last_name, email, stripe_customer_id")
    .eq("id", client_id)
    .eq("coach_id", user.id)
    .single();

  if (cErr || !client)
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  if (!client.email)
    return NextResponse.json(
      { error: "Ce client n'a pas d'email — requis pour Stripe" },
      { status: 422 },
    );

  // 3. Crée/récupère Stripe Product + Price pour la formule
  let stripeProductId = formula.stripe_product_id;
  let stripePriceId = formula.stripe_price_id;

  if (!stripeProductId || !stripePriceId) {
    // Créer le Product Stripe
    const product = await stripe.products.create({
      name: formula.name,
      description: formula.description ?? undefined,
      metadata: {
        formula_id: formula.id,
        coach_id: user.id,
      },
    });
    stripeProductId = product.id;

    // Créer le Price Stripe
    const isOneTime = formula.billing_cycle === "one_time";
    const priceAmount = Math.round(formula.price_eur * 100); // centimes

    const priceParams: Parameters<typeof stripe.prices.create>[0] = {
      product: stripeProductId,
      currency: "eur",
      unit_amount: priceAmount,
      metadata: { formula_id: formula.id },
    };

    if (!isOneTime) {
      const recurring = BILLING_TO_STRIPE[formula.billing_cycle];
      if (recurring) {
        priceParams.recurring = recurring;
      }
    }

    const price = await stripe.prices.create(priceParams);
    stripePriceId = price.id;

    // Persiste sur la formule
    await service
      .from("coach_formulas")
      .update({
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
      })
      .eq("id", formula.id);
  }

  // 4. Crée/récupère Stripe Customer pour le client
  let stripeCustomerId = client.stripe_customer_id;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: client.email,
      name: `${client.first_name} ${client.last_name}`,
      metadata: {
        client_id: client.id,
        coach_id: user.id,
      },
    });
    stripeCustomerId = customer.id;

    await service
      .from("coach_clients")
      .update({ stripe_customer_id: stripeCustomerId })
      .eq("id", client.id);
  }

  // 5. Crée Stripe Checkout Session
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const isOneTime = formula.billing_cycle === "one_time";

  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    payment_method_types: ["card"],
    line_items: [{ price: stripePriceId!, quantity: 1 }],
    mode: isOneTime ? "payment" : "subscription",
    success_url: `${baseUrl}/coach/clients/${client_id}?tab=formules&stripe=success`,
    cancel_url: `${baseUrl}/coach/clients/${client_id}?tab=formules&stripe=cancelled`,
    metadata: {
      client_id: client_id,
      formula_id: formula_id,
      subscription_id: subscription_id ?? "",
      coach_id: user.id,
      type: "coaching",
    },
    // Affiche le nom du coach dans Stripe Checkout
    custom_text: {
      submit: { message: `Vous serez facturé par votre coach.` },
    },
  };

  // Pour les abonnements avec durée limitée, on laisse Stripe gérer
  if (!isOneTime && formula.duration_months) {
    (sessionParams as Record<string, unknown>).subscription_data = {
      metadata: {
        client_id: client_id,
        formula_id: formula_id,
        coach_id: user.id,
      },
    };
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  // 6. Stocke l'ID de session sur l'abonnement si fourni
  if (subscription_id) {
    await service
      .from("client_subscriptions")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", subscription_id)
      .eq("coach_id", user.id);
  }

  return NextResponse.json({ url: session.url, session_id: session.id });
}
