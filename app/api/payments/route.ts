import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendPaymentReceiptEmail } from "@/lib/email/mailer";
import { z } from "zod";
import { coachOwnsClient } from "@/lib/security/client-resource-access";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const paymentSchema = z.object({
  client_id: z.string().uuid(),
  subscription_id: z.string().uuid().nullable().optional(),
  amount_eur: z.coerce.number().positive().max(1_000_000),
  status: z.enum(["paid", "pending", "failed", "refunded"]).optional(),
  payment_method: z.enum(["manual", "bank_transfer", "card", "cash", "stripe", "other"]).optional(),
  payment_date: z.string().date().optional(),
  due_date: z.string().date().nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  reference: z.string().trim().max(200).nullable().optional(),
  formula_name: z.string().trim().max(200).optional(),
});

// GET /api/payments — all payments for the coach (with filters)
// Query params: status, client_id, month (YYYY-MM), year (YYYY)
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("client_id");
  const month = searchParams.get("month"); // YYYY-MM
  const year = searchParams.get("year"); // YYYY

  let query = serviceClient()
    .from("subscription_payments")
    .select(
      "*, client:coach_clients(id, first_name, last_name, email), subscription:client_subscriptions(id, formula:coach_formulas(name, price_eur))",
    )
    .eq("coach_id", user.id)
    .order("payment_date", { ascending: false });

  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);
  if (month) {
    // month = YYYY-MM
    const start = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const end = new Date(y, m, 0).toISOString().split("T")[0]; // last day
    query = query.gte("payment_date", start).lte("payment_date", end);
  } else if (year) {
    query = query
      .gte("payment_date", `${year}-01-01`)
      .lte("payment_date", `${year}-12-31`);
  }

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data });
}

// POST /api/payments — enregistrer un paiement standalone (sans subscription)
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = paymentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Paiement invalide" }, { status: 400 });

  const body = parsed.data;
  const {
    client_id,
    subscription_id,
    amount_eur,
    status,
    payment_method,
    payment_date,
    due_date,
    description,
    reference,
  } = body;
  const db = serviceClient();

  if (!(await coachOwnsClient({ db, coachUserId: user.id, clientId: client_id }))) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  if (subscription_id) {
    const { data: subscription } = await db
      .from("client_subscriptions")
      .select("id")
      .eq("id", subscription_id)
      .eq("coach_id", user.id)
      .eq("client_id", client_id)
      .maybeSingle();
    if (!subscription) return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });
  }

  const { data, error } = await db
    .from("subscription_payments")
    .insert({
      coach_id: user.id,
      client_id,
      subscription_id: subscription_id ?? null,
      amount_eur: Number(amount_eur),
      status: status ?? "paid",
      payment_method: payment_method ?? "manual",
      payment_date: payment_date ?? new Date().toISOString().split("T")[0],
      due_date: due_date ?? null,
      description: description ?? null,
      reference: reference ?? null,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // Envoyer reçu email au client si paiement confirmé et client a un email
  const resolvedStatus = status ?? "paid";
  if (resolvedStatus === "paid") {
    try {
      const { data: client } = await db
        .from("coach_clients")
        .select("first_name, last_name, email")
        .eq("id", client_id)
        .eq("coach_id", user.id)
        .single();

      if (client?.email) {
        const coachMeta = (await createServerClient().auth.getUser()).data.user
          ?.user_metadata;
        const coachName = coachMeta?.full_name ?? coachMeta?.first_name ?? null;
        await sendPaymentReceiptEmail({
          to: client.email,
          clientFirstName: client.first_name,
          coachName,
          amount: Number(amount_eur),
          description: description ?? null,
          paymentDate: payment_date ?? new Date().toISOString().split("T")[0],
          reference: reference ?? null,
          method: payment_method ?? "manual",
        });
      }
    } catch (emailError) {
      console.error("Payment receipt email failed (non-blocking):", emailError);
    }
  }

  // Notification coach explicite (nom client, montant, formule/description)
  try {
    const { data: client } = await db
      .from("coach_clients")
      .select("first_name, last_name")
      .eq("id", client_id)
      .eq("coach_id", user.id)
      .single();

    const formulaName = body.formula_name ?? description ?? "Coaching";
    const clientName = client
      ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
      : "Le client";
    const amountLabel = new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount_eur));
    const notifMessage = `${clientName} a effectué un paiement de ${amountLabel} € pour "${formulaName}".`;

    await db.from("coach_notifications").insert({
      coach_id: user.id,
      client_id,
      category: "admin",
      subcategory: "payment_received",
      priority: 3,
      status: "pending",
      email_sent: false,
      title: "Paiement reçu",
      body: notifMessage,
      payload: {
        payment_id: data.id,
        amount_eur: Number(amount_eur),
        formula_name: formulaName,
        action_url: `/coach/paiements/${data.id}`,
      },
    });
  } catch (notifError) {
    console.error(
      "Notification paiement coach échouée (non-bloquant):",
      notifError,
    );
  }

  return NextResponse.json({ payment: data }, { status: 201 });
}
