import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendPaymentRequestEmail } from "@/lib/email/mailer";
import { createClientAppNotification } from "@/lib/notifications/create-client-app-notification";
import { coachOwnsClient } from "@/lib/security/client-resource-access";

function db() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json();
  const {
    client_id,
    payment_url,
    formula_name,
    amount_eur,
    send_email = false,
    send_app = false,
    payment_id,
    subscription_id,
    formula_id,
  } = body;

  if (!client_id || !payment_url || !formula_name || amount_eur === undefined) {
    return NextResponse.json(
      { error: "Paramètres requis manquants : client_id, payment_url, formula_name, amount_eur" },
      { status: 400 },
    );
  }

  const service = db();

  // Vérifie si le coach possède le client
  if (!(await coachOwnsClient({ db: service, coachUserId: user.id, clientId: client_id }))) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  // Récupère les informations du client
  const { data: client, error: clientErr } = await service
    .from("coach_clients")
    .select("first_name, last_name, email")
    .eq("id", client_id)
    .single();

  if (clientErr || !client) {
    return NextResponse.json({ error: "Impossible de récupérer les détails du client" }, { status: 404 });
  }

  // 1. Envoyer par e-mail
  if (send_email) {
    if (!client.email) {
      return NextResponse.json({ error: "Le client n'a pas d'adresse e-mail renseignée" }, { status: 400 });
    }

    const coachMeta = user.user_metadata ?? {};
    const coachName = coachMeta.full_name ?? coachMeta.first_name ?? user.email ?? "Votre coach";

    try {
      await sendPaymentRequestEmail({
        to: client.email,
        clientFirstName: client.first_name ?? "",
        coachName,
        formulaName: formula_name,
        amount: Number(amount_eur),
        paymentUrl: payment_url,
      });
    } catch (emailErr) {
      console.error("Failed to send payment request email:", emailErr);
      return NextResponse.json({ error: "Échec de l'envoi de l'e-mail de demande" }, { status: 500 });
    }
  }

  // 2. Envoyer dans l'application
  // IMPORTANT: never deep-link the PWA to a raw Stripe Checkout URL.
  // Sessions expire and standalone webviews break Checkout. The client page
  // mints a fresh session when the user taps "Payer".
  if (send_app) {
    try {
      const appPayParams = new URLSearchParams()
      if (payment_id) appPayParams.set("payment_id", String(payment_id))
      if (subscription_id) appPayParams.set("subscription_id", String(subscription_id))
      if (formula_id) appPayParams.set("formula_id", String(formula_id))
      const appPayPath = appPayParams.toString()
        ? `/client/paiement?${appPayParams.toString()}`
        : "/client/paiement"

      await createClientAppNotification(service, {
        clientId: client_id,
        coachId: user.id,
        type: "system_reminder", // Conforme aux contraintes SQL existantes
        title: `Demande de règlement`,
        body: `Votre coach vous invite à régler ${Number(amount_eur).toFixed(2)} € pour "${formula_name}" par Stripe.`,
        actionUrl: appPayPath,
        payload: {
          event: "payment_reminder",
          priority: "important",
          payment_id: payment_id ?? null,
          subscription_id: subscription_id ?? null,
          formula_id: formula_id ?? null,
          formula_name,
          amount_eur: Number(amount_eur),
          // Keep the coach-generated URL for diagnostics only — not used in-app.
          legacy_checkout_url: payment_url,
        },
        pushKind: "essential",
        pushTag: payment_id
          ? `payment-request-${payment_id}`
          : `payment-request-${client_id}-${Date.now()}`,
      });
    } catch (appNotifErr) {
      console.error("Failed to create client app notification:", appNotifErr);
      return NextResponse.json({ error: "Échec de l'envoi de la notification in-app" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
