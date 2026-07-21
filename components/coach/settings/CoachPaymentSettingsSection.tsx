"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Bell,
  Building2,
  CreditCard,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

type PaymentMethod =
  | "card"
  | "apple_pay"
  | "google_pay"
  | "sepa_debit"
  | "stripe_bank_transfer"
  | "direct_bank_transfer";

type PaymentSettings = {
  stripe_account_id: string | null;
  stripe_account_status: "not_connected" | "pending" | "ready" | "restricted" | "disabled";
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_details_submitted: boolean;
  enabled_payment_methods: PaymentMethod[];
  direct_bank_transfer_enabled: boolean;
  bank_iban_last4: string | null;
  invoices_auto_send: boolean;
  receipts_auto_send: boolean;
  confirmations_auto_send: boolean;
};

const DEFAULT_SETTINGS: PaymentSettings = {
  stripe_account_id: null,
  stripe_account_status: "not_connected",
  stripe_charges_enabled: false,
  stripe_payouts_enabled: false,
  stripe_details_submitted: false,
  enabled_payment_methods: ["card"],
  direct_bank_transfer_enabled: false,
  bank_iban_last4: null,
  invoices_auto_send: true,
  receipts_auto_send: true,
  confirmations_auto_send: true,
};

const METHOD_COPY: Array<{
  id: PaymentMethod;
  label: string;
  description: string;
  icon: typeof CreditCard;
  requiresStripe?: boolean;
}> = [
  { id: "card", label: "Carte", description: "Paiement immédiat et sécurisé", icon: CreditCard, requiresStripe: true },
  { id: "apple_pay", label: "Apple Pay", description: "Paiement rapide sur appareil compatible", icon: Smartphone, requiresStripe: true },
  { id: "google_pay", label: "Google Pay", description: "Paiement rapide sur appareil compatible", icon: Smartphone, requiresStripe: true },
  { id: "sepa_debit", label: "Prélèvement SEPA", description: "Pour les échéances récurrentes", icon: Building2, requiresStripe: true },
  { id: "stripe_bank_transfer", label: "Virement suivi", description: "Instructions et rapprochement par Stripe", icon: Building2, requiresStripe: true },
  { id: "direct_bank_transfer", label: "Virement direct", description: "Confirmation manuelle par le coach", icon: Building2 },
];

const STATUS_COPY: Record<PaymentSettings["stripe_account_status"], { label: string; tone: string; detail: string }> = {
  not_connected: { label: "À connecter", tone: "text-white/60 bg-white/[0.08]", detail: "Connectez votre compte Stripe pour encaisser directement." },
  pending: { label: "Informations à compléter", tone: "text-white/70 bg-white/[0.08]", detail: "Stripe attend encore quelques informations avant l’activation." },
  ready: { label: "Prêt à encaisser", tone: "text-[#69d0ac] bg-[#1f8a65]/15", detail: "Les paiements sont versés sur votre compte Stripe." },
  restricted: { label: "Action requise", tone: "text-white/70 bg-white/[0.08]", detail: "Complétez vos informations Stripe pour débloquer l’encaissement." },
  disabled: { label: "Indisponible", tone: "text-red-300 bg-red-400/10", detail: "Stripe a temporairement limité ce compte. Ouvrez Stripe pour en savoir plus." },
};

function Toggle({ enabled, onChange, disabled = false }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-10 rounded-full transition-colors ${enabled ? "bg-[#1f8a65]" : "bg-white/[0.12]"} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <span className={`absolute top-1 size-4 rounded-full bg-white transition-all ${enabled ? "left-5" : "left-1"}`} />
    </button>
  );
}

export default function CoachPaymentSettingsSection() {
  const [settings, setSettings] = useState<PaymentSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  async function loadSettings() {
    setLoading(true);
    const response = await fetch("/api/coach/payment-settings");
    const data = await response.json().catch(() => null);
    if (response.ok && data?.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
    else {
      setMessageTone("error");
      setMessage(data?.error ?? "Impossible de charger les réglages d’encaissement.");
    }
    setLoading(false);
  }

  useEffect(() => { void loadSettings(); }, []);

  async function persist(next: PaymentSettings) {
    setSettings(next);
    setSaving(true);
    const response = await fetch("/api/coach/payment-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled_payment_methods: next.enabled_payment_methods,
        invoices_auto_send: next.invoices_auto_send,
        receipts_auto_send: next.receipts_auto_send,
        confirmations_auto_send: next.confirmations_auto_send,
      }),
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.settings) {
      setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      setMessageTone("success");
      setMessage("Réglages d’encaissement enregistrés.");
    } else {
      setMessageTone("error");
      setMessage(data?.error ?? "La sauvegarde a échoué.");
      void loadSettings();
    }
    setSaving(false);
  }

  async function connectStripe() {
    setConnecting(true);
    const response = await fetch("/api/stripe/connect/onboard", { method: "POST" });
    const data = await response.json().catch(() => null);
    setConnecting(false);
    if (response.ok && data?.url) window.location.assign(data.url);
    else {
      setMessageTone("error");
      setMessage(data?.error ?? "Connexion Stripe indisponible.");
    }
  }

  async function refreshStripe() {
    setRefreshing(true);
    const response = await fetch("/api/stripe/connect/refresh", { method: "POST" });
    const data = await response.json().catch(() => null);
    if (response.ok) {
      setSettings((current) => ({ ...current, ...data }));
      setMessageTone("success");
      setMessage("Statut Stripe actualisé.");
    } else {
      setMessageTone("error");
      setMessage(data?.error ?? "Actualisation Stripe indisponible.");
    }
    setRefreshing(false);
  }

  const status = STATUS_COPY[settings.stripe_account_status];
  const stripeReady = settings.stripe_account_status === "ready";
  const needsStripeAction = Boolean(settings.stripe_account_id && !stripeReady);

  if (loading) {
    return <div className="flex items-center gap-2 py-6 text-xs text-white/40"><Loader2 size={14} className="animate-spin" /> Chargement de l’encaissement…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#1f8a65]/15"><ShieldCheck size={17} className="text-[#69d0ac]" /></div>
            <div>
              <p className="text-sm font-bold text-white">Votre compte Stripe</p>
              <p className="mt-1 text-[12px] leading-5 text-white/48">{status.detail}</p>
            </div>
          </div>
          <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] ${status.tone}`}>{status.label}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {!settings.stripe_account_id ? (
            <button type="button" onClick={connectStripe} disabled={connecting} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-[#111] transition hover:bg-white/90 disabled:opacity-50">
              {connecting ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
              {connecting ? "Ouverture de Stripe…" : "Configurer mon compte Stripe"}
            </button>
          ) : (
            <>
              {needsStripeAction ? (
                <button type="button" onClick={connectStripe} disabled={connecting} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-[#111] transition hover:bg-white/90 disabled:opacity-50">
                  {connecting ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                  {connecting ? "Ouverture de Stripe…" : "Reprendre la configuration Stripe"}
                </button>
              ) : null}
              <button type="button" onClick={refreshStripe} disabled={refreshing} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 text-xs font-bold text-white/75 transition hover:bg-white/[0.08] disabled:opacity-50">
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Actualiser le statut
              </button>
            </>
          )}
        </div>
        {message ? (
          <p
            role="alert"
            className={`mt-3 rounded-xl border px-3 py-2 text-[11px] leading-5 ${
              messageTone === "error"
                ? "border-red-400/20 bg-red-400/[0.08] text-red-200"
                : "border-[#1f8a65]/25 bg-[#1f8a65]/10 text-[#7fe2bf]"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>

      <div>
        <div className="flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-white">Moyens proposés à vos clients</p><p className="mt-1 text-[11px] text-white/40">N’activez que les moyens adaptés à votre activité.</p></div>{saving ? <Loader2 size={14} className="animate-spin text-white/40" /> : null}</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {METHOD_COPY.map((method) => {
            const Icon = method.icon;
            const enabled = settings.enabled_payment_methods.includes(method.id);
            const unavailable = Boolean(method.requiresStripe && !stripeReady);
            return <div key={method.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]"><Icon size={15} className="text-white/60" /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white">{method.label}</p><p className="mt-0.5 text-[10px] leading-4 text-white/36">{method.description}</p></div><Toggle enabled={enabled} disabled={unavailable || method.id === "direct_bank_transfer"} onChange={() => void persist({ ...settings, enabled_payment_methods: enabled ? settings.enabled_payment_methods.filter((item) => item !== method.id) : [...settings.enabled_payment_methods, method.id] })} /></div>;
          })}
        </div>
        {!stripeReady ? <p className="mt-2 text-[11px] text-white/48">Stripe ouvre un formulaire sécurisé pour créer votre compte professionnel ou reprendre son inscription.</p> : null}
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
        <div className="flex gap-3"><Building2 size={16} className="mt-0.5 shrink-0 text-white/55" /><div><p className="text-sm font-semibold text-white">Virement direct au coach</p><p className="mt-1 text-[11px] leading-5 text-white/42">Vos coordonnées bancaires ne sont jamais affichées en clair ici. Cette option nécessite l’authentification renforcée avant d’être configurée.</p><p className="mt-2 text-[11px] text-white/48">Configuration sécurisée disponible dans la prochaine étape.</p></div></div>
      </div>

      <div className="space-y-3 border-t border-white/[0.06] pt-5"><div><p className="text-sm font-semibold text-white">Envois automatiques</p><p className="mt-1 text-[11px] text-white/40">Le client reçoit les documents depuis l’application STRYVR et/ou son e-mail selon ses préférences.</p></div>{[["Factures", "Les factures sont envoyées dès leur finalisation.", "invoices_auto_send"], ["Confirmations", "Le client est informé dès qu’un paiement est confirmé.", "confirmations_auto_send"], ["Reçus", "Le reçu est envoyé automatiquement après un paiement.", "receipts_auto_send"] as const].map(([label, detail, key]) => <div key={key} className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-white/85">{label}</p><p className="mt-0.5 text-[11px] text-white/38">{detail}</p></div><Toggle enabled={settings[key]} onChange={() => void persist({ ...settings, [key]: !settings[key] })} /></div>)}</div>

      <details className="group rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><summary className="cursor-pointer list-none text-xs font-semibold text-white"><span className="inline-flex items-center gap-2"><Mail size={14} className="text-[#1f8a65]" /> Comprendre l’encaissement client</span></summary><div className="mt-3 space-y-2 text-[11px] leading-5 text-white/46"><p><strong className="text-white/72">1. Connectez Stripe.</strong> Les fonds restent sur votre compte Stripe et vous restez le vendeur auprès de vos clients.</p><p><strong className="text-white/72">2. Choisissez les moyens de paiement.</strong> Leur disponibilité dépend du pays, de votre compte et de l’appareil du client.</p><p><strong className="text-white/72">3. Laissez le suivi se faire.</strong> Factures, confirmations et reçus partent automatiquement selon vos réglages.</p></div></details>
    </div>
  );
}
