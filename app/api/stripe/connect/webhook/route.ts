import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { syncCoachConnectAccount } from "@/lib/stripe/connect";
import {
  beginStripeWebhookProcessing,
  finishStripeWebhookProcessing,
} from "@/lib/security/stripe-webhook-idempotency";

export const runtime = "nodejs";

type StripeV2Event = {
  id: string;
  type: string;
  related_object?: {
    id?: string;
    type?: string;
  } | null;
};

function db() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * Receives Accounts v2 requirement and capability changes. Stripe remains the
 * requirements collector, while STRYV only mirrors the current readiness in
 * the coach settings screen.
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook Connect non configuré." }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature absente." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Signature Stripe invalide." }, { status: 400 });
  }

  const service = db();
  const shouldProcess = await beginStripeWebhookProcessing(service, event);
  if (!shouldProcess) return NextResponse.json({ received: true });

  try {
    const v2Event = event as unknown as StripeV2Event;
    const isAccountReadinessEvent = [
      "v2.core.account[requirements].updated",
      "v2.core.account[configuration.merchant].capability_status_updated",
    ].includes(v2Event.type);

    if (isAccountReadinessEvent && v2Event.related_object?.type === "v2.core.account") {
      const accountId = v2Event.related_object.id;

      if (accountId) {
        const { data: settings, error } = await service
          .from("coach_payment_settings")
          .select("coach_id")
          .eq("stripe_account_id", accountId)
          .maybeSingle();

        if (error) throw error;
        if (settings?.coach_id) {
          await syncCoachConnectAccount(settings.coach_id, accountId);
        }
      }
    }

    await finishStripeWebhookProcessing({ db: service, eventId: event.id, status: "processed" });
  } catch (error) {
    console.error("Unable to sync Accounts v2 status:", error);
    await finishStripeWebhookProcessing({
      db: service,
      eventId: event.id,
      status: "failed",
      processingError: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Sync error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
