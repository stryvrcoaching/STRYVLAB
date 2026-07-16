import {
  stripeV2Request,
  createConnectOnboardingState,
  getPublicAppUrl,
  retrieveStripeV2Account
} from "@/lib/stripe/connect";
import type { SupabaseClient } from "@supabase/supabase-js";

export function getPartnerConnectAccountStatus(account: any) {
  const transfers = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  const requirements = account.requirements?.entries ?? [];
  const requirementsDue = requirements
    .filter((req: any) => {
      const status = req.minimum_deadline?.status;
      return status === "currently_due" || status === "past_due";
    })
    .map((req: any) => req.description ?? "Information Stripe requise");

  const hasOutstandingRequirements = requirementsDue.length > 0;
  const transfersEnabled = transfers === "active";

  let status = "pending";
  if (transfers === "unsupported") status = "disabled";
  else if (transfersEnabled) status = "ready";
  else if (hasOutstandingRequirements || transfers === "restricted") status = "restricted";

  return {
    status,
    transfersEnabled,
    requirementsDue,
  };
}

export async function syncPartnerConnectAccount(partnerId: string, accountId: string, db: SupabaseClient) {
  const account = await retrieveStripeV2Account(accountId);
  const state = getPartnerConnectAccountStatus(account);

  const { error } = await db
    .from("sales_partners")
    .update({
      stripe_account_id: accountId,
      stripe_account_status: state.status,
    })
    .eq("id", partnerId);

  if (error) throw new Error("Impossible d’enregistrer la synchronisation Stripe.");
  return state;
}

export async function createPartnerConnectOnboardingUrl(partnerId: string, userId: string, db: SupabaseClient) {
  const { data: partner, error: partnerError } = await db
    .from("sales_partners")
    .select("stripe_account_id, stripe_account_status, email, full_name")
    .eq("id", partnerId)
    .maybeSingle();

  if (partnerError || !partner) {
    throw new Error("Partenaire commercial introuvable.");
  }

  if (partner.stripe_account_id) {
    const link = await createPartnerHostedOnboardingLink(partner.stripe_account_id, userId);
    return link.url;
  }

  const account = await stripeV2Request<any>("/accounts", {
    method: "POST",
    idempotencyKey: `stryvlab-partner-connect-account-${partnerId}`,
    body: {
      contact_email: partner.email,
      dashboard: "express",
      identity: {
        country: "BE",
      },
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: { requested: true },
            },
          },
        },
      },
      defaults: {
        locales: ["fr"],
        profile: {
          product_description: "Prestations d'apport d'affaires et recommandation commerciale STRYV.",
        },
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
      },
      metadata: {
        stryvlab_partner_id: partnerId,
        stryvlab_connect_flow: "partner_payouts",
      },
      include: ["configuration.recipient", "requirements"],
    },
  });

  await db
    .from("sales_partners")
    .update({
      stripe_account_id: account.id,
      stripe_account_status: "pending",
    })
    .eq("id", partnerId);

  const link = await createPartnerHostedOnboardingLink(account.id, userId);
  return link.url;
}

async function createPartnerHostedOnboardingLink(accountId: string, userId: string) {
  const appUrl = getPublicAppUrl();
  const state = await createConnectOnboardingState(userId);
  const query = new URLSearchParams({ state });

  return stripeV2Request<any>("/account_links", {
    method: "POST",
    body: {
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          collection_options: {
            fields: "eventually_due",
            future_requirements: "include",
          },
          refresh_url: `${appUrl}/api/sales/connect/refresh?${query.toString()}`,
          return_url: `${appUrl}/api/sales/connect/callback?${query.toString()}`,
        },
      },
    },
  });
}
