import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const PAYMENT_METHODS = [
  "card",
  "apple_pay",
  "google_pay",
  "sepa_debit",
  "stripe_bank_transfer",
  "direct_bank_transfer",
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const DEFAULT_SETTINGS = {
  stripe_account_id: null,
  stripe_account_status: "not_connected",
  stripe_charges_enabled: false,
  stripe_payouts_enabled: false,
  stripe_details_submitted: false,
  enabled_payment_methods: ["card"] as PaymentMethod[],
  direct_bank_transfer_enabled: false,
  bank_iban_last4: null,
  invoices_auto_send: true,
  receipts_auto_send: true,
  confirmations_auto_send: true,
  reminder_before_due_days: [3],
  reminder_after_due_days: [1, 7],
};

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && PAYMENT_METHODS.includes(value as PaymentMethod);
}

export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { data, error } = await supabase
    .from("coach_payment_settings")
    .select(`
      stripe_account_id, stripe_account_status, stripe_charges_enabled,
      stripe_payouts_enabled, stripe_details_submitted, enabled_payment_methods,
      direct_bank_transfer_enabled, bank_iban_last4, invoices_auto_send,
      receipts_auto_send, confirmations_auto_send, reminder_before_due_days,
      reminder_after_due_days
    `)
    .eq("coach_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Configuration d’encaissement indisponible." }, { status: 500 });
  return NextResponse.json({ settings: { ...DEFAULT_SETTINGS, ...data } });
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Réglages invalides." }, { status: 400 });
  }

  const enabledPaymentMethods = Array.isArray(body.enabled_payment_methods)
    ? body.enabled_payment_methods.filter(isPaymentMethod)
    : undefined;

  if (enabledPaymentMethods && enabledPaymentMethods.length === 0) {
    return NextResponse.json({ error: "Choisissez au moins un moyen de paiement." }, { status: 400 });
  }

  const updates = {
    ...(enabledPaymentMethods ? { enabled_payment_methods: enabledPaymentMethods } : {}),
    ...(typeof body.invoices_auto_send === "boolean" ? { invoices_auto_send: body.invoices_auto_send } : {}),
    ...(typeof body.receipts_auto_send === "boolean" ? { receipts_auto_send: body.receipts_auto_send } : {}),
    ...(typeof body.confirmations_auto_send === "boolean" ? { confirmations_auto_send: body.confirmations_auto_send } : {}),
  };

  const { data, error } = await supabase
    .from("coach_payment_settings")
    .upsert({ coach_id: user.id, ...updates }, { onConflict: "coach_id" })
    .select(`
      stripe_account_id, stripe_account_status, stripe_charges_enabled,
      stripe_payouts_enabled, stripe_details_submitted, enabled_payment_methods,
      direct_bank_transfer_enabled, bank_iban_last4, invoices_auto_send,
      receipts_auto_send, confirmations_auto_send, reminder_before_due_days,
      reminder_after_due_days
    `)
    .single();

  if (error) return NextResponse.json({ error: "Impossible d’enregistrer les réglages." }, { status: 500 });
  return NextResponse.json({ settings: { ...DEFAULT_SETTINGS, ...data } });
}
