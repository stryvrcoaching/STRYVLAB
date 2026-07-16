import { createHash, randomBytes } from "crypto";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export type CoachConnectStatus =
  | "not_connected"
  | "pending"
  | "ready"
  | "restricted"
  | "disabled";

export type CoachConnectAccount = {
  accountId: string | null;
  status: CoachConnectStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
  disabledReason: string | null;
};

type CapabilityStatus = "active" | "pending" | "restricted" | "unsupported" | null | undefined;

type StripeV2Account = {
  id: string;
  configuration?: {
    merchant?: {
      capabilities?: {
        card_payments?: { status?: CapabilityStatus } | null;
        stripe_balance?: {
          payouts?: { status?: CapabilityStatus } | null;
        } | null;
      } | null;
    } | null;
  } | null;
  requirements?: {
    entries?: Array<{
      description?: string | null;
      minimum_deadline?: { status?: "currently_due" | "eventually_due" | "past_due" | null } | null;
    }> | null;
    summary?: {
      minimum_deadline?: { status?: "currently_due" | "eventually_due" | "past_due" | null } | null;
    } | null;
  } | null;
};

type StripeV2AccountLink = {
  url: string;
};

type StripeV2Error = {
  error?: {
    message?: string;
    code?: string;
  };
};

const STRIPE_V2_API_VERSION = "2026-06-24.dahlia";
const STRIPE_V2_API_URL = "https://api.stripe.com/v2/core";
const ONBOARDING_STATE_TTL_MS = 15 * 60 * 1000;

function db() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stripeSecretKey() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("La clé secrète Stripe est absente.");
  return secretKey;
}

export async function stripeV2Request<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; idempotencyKey?: string } = {},
) {
  const response = await fetch(`${STRIPE_V2_API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${stripeSecretKey()}`,
      "Content-Type": "application/json",
      "Stripe-Version": STRIPE_V2_API_VERSION,
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as T | StripeV2Error | null;
  if (!response.ok) {
    const error = payload as StripeV2Error | null;
    const detail = error?.error?.message ?? "Stripe n’a pas pu traiter la demande.";
    throw new Error(detail);
  }

  return payload as T;
}

export function getPublicAppUrl() {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SITE_URL est requis pour connecter Stripe.");
  }

  return url.replace(/\/$/, "");
}

export function getConnectAccountStatus(account: StripeV2Account): CoachConnectAccount {
  const cardPayments = account.configuration?.merchant?.capabilities?.card_payments?.status;
  const payoutStatus = account.configuration?.merchant?.capabilities?.stripe_balance?.payouts?.status;
  const requirements = account.requirements?.entries ?? [];
  const requirementsDue = requirements
    .filter((requirement) => {
      const status = requirement.minimum_deadline?.status;
      return status === "currently_due" || status === "past_due";
    })
    .map((requirement) => requirement.description ?? "Information Stripe requise")
    .filter((value, index, values) => values.indexOf(value) === index);
  const hasOutstandingRequirements = requirementsDue.length > 0
    || account.requirements?.summary?.minimum_deadline?.status === "currently_due"
    || account.requirements?.summary?.minimum_deadline?.status === "past_due";
  const chargesEnabled = cardPayments === "active";
  const payoutsEnabled = payoutStatus === "active";
  const detailsSubmitted = !hasOutstandingRequirements;

  let status: CoachConnectStatus = "pending";
  if (cardPayments === "unsupported") status = "disabled";
  else if (chargesEnabled) status = "ready";
  else if (hasOutstandingRequirements || cardPayments === "restricted") status = "restricted";

  return {
    accountId: account.id,
    status,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    requirementsDue,
    disabledReason: cardPayments === "unsupported" ? "Les paiements par carte ne sont pas disponibles pour ce compte Stripe." : null,
  };
}

export async function getCoachConnectAccount(coachId: string) {
  const { data, error } = await db()
    .from("coach_payment_settings")
    .select(
      "stripe_account_id, stripe_account_status, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted",
    )
    .eq("coach_id", coachId)
    .maybeSingle();

  if (error) throw new Error("Impossible de lire la configuration d’encaissement.");

  return {
    accountId: data?.stripe_account_id ?? null,
    status: (data?.stripe_account_status ?? "not_connected") as CoachConnectStatus,
    chargesEnabled: data?.stripe_charges_enabled ?? false,
    payoutsEnabled: data?.stripe_payouts_enabled ?? false,
    detailsSubmitted: data?.stripe_details_submitted ?? false,
  };
}

export async function retrieveStripeV2Account(accountId: string) {
  const query = new URLSearchParams();
  query.append("include", "configuration.merchant");
  query.append("include", "requirements");
  return stripeV2Request<StripeV2Account>(`/accounts/${accountId}?${query.toString()}`);
}

export async function syncCoachConnectAccount(coachId: string, accountId: string) {
  const account = await retrieveStripeV2Account(accountId);
  const state = getConnectAccountStatus(account);
  const { error } = await db().from("coach_payment_settings").upsert(
    {
      coach_id: coachId,
      stripe_account_id: accountId,
      stripe_account_status: state.status,
      stripe_charges_enabled: state.chargesEnabled,
      stripe_payouts_enabled: state.payoutsEnabled,
      stripe_details_submitted: state.detailsSubmitted,
    },
    { onConflict: "coach_id" },
  );

  if (error) throw new Error("Impossible d’enregistrer le statut Stripe.");

  return state;
}

export async function createConnectOnboardingState(coachId: string) {
  const state = randomBytes(32).toString("base64url");
  const { error } = await db().from("stripe_connect_oauth_states").insert({
    coach_id: coachId,
    state_hash: hash(state),
    expires_at: new Date(Date.now() + ONBOARDING_STATE_TTL_MS).toISOString(),
  });

  if (error) throw new Error("Impossible de préparer l’inscription Stripe.");
  return state;
}

export async function consumeConnectOnboardingState(state: string) {
  const { data, error } = await db()
    .from("stripe_connect_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("state_hash", hash(state))
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("coach_id")
    .maybeSingle();

  if (error || !data?.coach_id) return null;
  return data.coach_id as string;
}

async function createHostedOnboardingLink(accountId: string, coachId: string) {
  const appUrl = getPublicAppUrl();
  const state = await createConnectOnboardingState(coachId);
  const query = new URLSearchParams({ state });

  return stripeV2Request<StripeV2AccountLink>("/account_links", {
    method: "POST",
    body: {
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["merchant"],
          collection_options: {
            fields: "eventually_due",
            future_requirements: "include",
          },
          refresh_url: `${appUrl}/api/stripe/connect/refresh?${query.toString()}`,
          return_url: `${appUrl}/api/stripe/connect/callback?${query.toString()}`,
        },
      },
    },
  });
}

/**
 * Creates an Accounts v2 connected merchant account for a coach, or resumes
 * its Stripe-hosted onboarding. The coach remains merchant of record and uses
 * their own full Stripe Dashboard for client payments.
 */
export async function createCoachConnectOnboardingUrl(coachId: string) {
  const current = await getCoachConnectAccount(coachId);
  if (current.accountId) {
    const link = await createHostedOnboardingLink(current.accountId, coachId);
    return link.url;
  }

  const service = db();
  const [{ data: profile }, auth] = await Promise.all([
    service
      .from("coach_profiles")
      .select("pro_email, billing_country")
      .eq("coach_id", coachId)
      .maybeSingle(),
    service.auth.admin.getUserById(coachId),
  ]);

  const email = profile?.pro_email ?? auth.data.user?.email ?? undefined;
  const country = profile?.billing_country?.toLowerCase();
  if (!country) {
    throw new Error("Renseignez votre pays de facturation avant de connecter Stripe.");
  }

  const account = await stripeV2Request<StripeV2Account>("/accounts", {
    method: "POST",
    idempotencyKey: `stryvlab-connect-account-${coachId}`,
    body: {
      ...(email ? { contact_email: email } : {}),
      dashboard: "full",
      identity: {
        country,
      },
      configuration: {
        merchant: {
          capabilities: {
            card_payments: { requested: true },
          },
        },
      },
      defaults: {
        locales: ["fr"],
        profile: {
          product_description: "Services de coaching sportif et accompagnement personnalisé.",
        },
        responsibilities: {
          fees_collector: "stripe",
          losses_collector: "stripe",
        },
      },
      metadata: {
        stryvlab_coach_id: coachId,
        stryvlab_connect_flow: "accounts_v2",
      },
      include: ["configuration.merchant", "requirements"],
    },
  });

  await syncCoachConnectAccount(coachId, account.id);
  const link = await createHostedOnboardingLink(account.id, coachId);
  return link.url;
}

export async function resumeCoachConnectOnboarding(state: string) {
  const coachId = await consumeConnectOnboardingState(state);
  if (!coachId) throw new Error("Lien d’inscription expiré.");

  const current = await getCoachConnectAccount(coachId);
  if (!current.accountId) throw new Error("Compte Stripe introuvable.");

  return createHostedOnboardingLink(current.accountId, coachId);
}

export async function completeCoachConnectOnboarding(state: string) {
  const coachId = await consumeConnectOnboardingState(state);
  if (!coachId) throw new Error("Lien d’inscription expiré.");

  const current = await getCoachConnectAccount(coachId);
  if (!current.accountId) throw new Error("Compte Stripe introuvable.");
  return syncCoachConnectAccount(coachId, current.accountId);
}
