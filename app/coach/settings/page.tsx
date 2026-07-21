"use client";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { PLAN_LIMITS, type BillingStatus, type CoachPlan } from "@/lib/billing/plans";
import {
  User,
  Building2,
  Bell,
  ShieldAlert,
  Upload,
  Trash2,
  Loader2,
  X,
  ChevronDown,
  AlertTriangle,
  Mail,
  KeyRound,
  Brain,
  LogOut,
  Gift,
  CreditCard,
  Download,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import ImageCropModal from "@/components/ui/ImageCropModal";
import ActionFeedbackBadge from "@/components/ui/ActionFeedbackBadge";
import useTimedActionFeedback from "@/components/ui/useTimedActionFeedback";
import CoachRewardsSection from "@/components/coach/settings/CoachRewardsSection";
import CoachPaymentSettingsSection from "@/components/coach/settings/CoachPaymentSettingsSection";
import PlanComparisonModal from "@/components/coach/settings/PlanComparisonModal";
import AvailabilitySettings from "@/components/appointments/AvailabilitySettings";
import { Calendar } from "lucide-react";
import {
  DEFAULT_COACH_INBOX_PREFERENCES,
  type CoachInboxPreferenceKey,
} from "@/lib/notifications/coach-inbox-preferences";
import { PhoneCountryField } from "@/components/ui/PhoneCountryField";
import WhatsappAgentSettings from "@/components/coach/settings/WhatsappAgentSettings";

// ─── Types ────────────────────────────────────────────────────────────────────

type CoachProfile = {
  full_name: string | null;
  brand_name: string | null;
  pro_email: string | null;
  phone: string | null;
  logo_url: string | null;
  company_name: string | null;
  billing_country: string | null;
  business_registration_number: string | null;
  siret: string | null;
  address: string | null;
  vat_number: string | null;
  notif_payment_reminder: boolean;
  notif_payment_reminder_days: number;
  notif_bilan_completed: boolean;
  notif_onboarding_emails: boolean;
  notif_inbox_assessments: boolean;
  notif_inbox_training: boolean;
  notif_inbox_messages: boolean;
  notif_inbox_checkins: boolean;
  notif_inbox_nutrition: boolean;
  notif_inbox_health_progress: boolean;
  notif_inbox_administrative: boolean;
  plan: CoachPlan;
  billing_status: BillingStatus;
  client_limit: number | null;
  team_seats: number | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_current_period_end?: string | null;
  trial_ends_at?: string | null;
  trial_consumed_at?: string | null;
  data_export_available_until?: string | null;
  // IA Coach
  has_ai_llm: boolean;
  ai_tone: 'strict' | 'bienveillant' | 'motivant' | 'neutre' | null;
  ai_notif_email: boolean;
  ai_notif_sms: boolean;
  ai_escalation_threshold: number | null;
};

type SettingsSaveScope = "profile" | "billing" | "notifications" | "ai" | "all";
type SettingsSectionId =
  | "profile"
  | "availabilities"
  | "billing"
  | "client-payments"
  | "plan"
  | "notifications"
  | "ai"
  | "rewards"
  | "account";

const PERSISTED_PROFILE_KEYS: Array<keyof CoachProfile> = [
  "full_name",
  "brand_name",
  "pro_email",
  "phone",
  "logo_url",
  "company_name",
  "billing_country",
  "business_registration_number",
  "siret",
  "address",
  "vat_number",
  "notif_payment_reminder",
  "notif_payment_reminder_days",
  "notif_bilan_completed",
  "notif_onboarding_emails",
  "notif_inbox_assessments",
  "notif_inbox_training",
  "notif_inbox_messages",
  "notif_inbox_checkins",
  "notif_inbox_nutrition",
  "notif_inbox_health_progress",
  "notif_inbox_administrative",
  "has_ai_llm",
  "ai_tone",
  "ai_notif_email",
  "ai_notif_sms",
  "ai_escalation_threshold",
];

const DEFAULT_PROFILE: CoachProfile = {
  full_name: null,
  brand_name: null,
  pro_email: null,
  phone: null,
  logo_url: null,
  company_name: null,
  billing_country: null,
  business_registration_number: null,
  siret: null,
  address: null,
  vat_number: null,
  notif_payment_reminder: true,
  notif_payment_reminder_days: 3,
  notif_bilan_completed: true,
  notif_onboarding_emails: true,
  ...DEFAULT_COACH_INBOX_PREFERENCES,
  plan: "solo",
  billing_status: "inactive",
  client_limit: PLAN_LIMITS.solo.clientLimit,
  team_seats: PLAN_LIMITS.solo.teamSeats,
  has_ai_llm: false,
  ai_tone: null,
  ai_notif_email: true,
  ai_notif_sms: false,
  ai_escalation_threshold: null,
};

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputCls =
  "w-full h-11 px-4 bg-[#0a0a0a] border-input rounded-xl text-sm text-white outline-none placeholder:text-white/20 transition-colors";
const labelCls =
  "block text-[10px] font-bold uppercase tracking-[0.16em] text-white/40 mb-1.5";

const BILLING_COUNTRIES = [
  ["BE", "Belgique"], ["FR", "France"], ["CH", "Suisse"], ["LU", "Luxembourg"],
  ["CA", "Canada"], ["DE", "Allemagne"], ["ES", "Espagne"], ["IT", "Italie"],
  ["NL", "Pays-Bas"], ["GB", "Royaume-Uni"], ["US", "États-Unis"],
] as const;

const BUSINESS_NUMBER_COPY: Record<string, { label: string; placeholder: string; vatLabel: string; vatPlaceholder: string }> = {
  BE: { label: "N° d'entreprise (BCE/KBO)", placeholder: "0123.456.789", vatLabel: "N° de TVA", vatPlaceholder: "BE0123456789" },
  FR: { label: "N° SIRET", placeholder: "123 456 789 00012", vatLabel: "N° TVA intracommunautaire", vatPlaceholder: "FR12345678901" },
  CH: { label: "N° IDE", placeholder: "CHE-123.456.789", vatLabel: "N° TVA", vatPlaceholder: "CHE-123.456.789 TVA" },
  LU: { label: "N° RCS", placeholder: "B123456", vatLabel: "N° TVA", vatPlaceholder: "LU12345678" },
  CA: { label: "N° d'entreprise", placeholder: "123456789RC0001", vatLabel: "N° TPS/TVH", vatPlaceholder: "123456789RT0001" },
  DE: { label: "N° d'immatriculation", placeholder: "HRB 12345", vatLabel: "N° TVA", vatPlaceholder: "DE123456789" },
  ES: { label: "NIF / CIF", placeholder: "B12345678", vatLabel: "N° TVA", vatPlaceholder: "ESB12345678" },
  IT: { label: "Codice fiscale / P. IVA", placeholder: "12345678901", vatLabel: "Partita IVA", vatPlaceholder: "IT12345678901" },
  NL: { label: "N° KvK", placeholder: "12345678", vatLabel: "N° TVA", vatPlaceholder: "NL123456789B01" },
  GB: { label: "Company number", placeholder: "12345678", vatLabel: "VAT number", vatPlaceholder: "GB123456789" },
  US: { label: "Business registration number", placeholder: "12-3456789", vatLabel: "Tax ID", vatPlaceholder: "12-3456789" },
};

const DEFAULT_BUSINESS_NUMBER_COPY = { label: "N° d'immatriculation de l'entreprise", placeholder: "Selon votre pays", vatLabel: "N° de TVA", vatPlaceholder: "Selon votre pays" };

const IN_APP_NOTIFICATION_GROUPS: Array<{
  key: CoachInboxPreferenceKey;
  title: string;
  description: string;
}> = [
  {
    key: "notif_inbox_assessments",
    title: "Bilans et questionnaires",
    description: "Bilans complétés et réponses à analyser.",
  },
  {
    key: "notif_inbox_training",
    title: "Entraînement",
    description: "Séances réalisées, manquées et signaux de programme.",
  },
  {
    key: "notif_inbox_messages",
    title: "Conversations client",
    description: "Réponses aux messages, retours et réactions clients.",
  },
  {
    key: "notif_inbox_checkins",
    title: "Check-ins et engagement",
    description: "Check-ins quotidiens et signaux d'engagement à suivre.",
  },
  {
    key: "notif_inbox_nutrition",
    title: "Nutrition",
    description: "Repas validés, tendances nutritionnelles et TDEE.",
  },
  {
    key: "notif_inbox_health_progress",
    title: "Santé et évolution",
    description: "Récupération, fréquence cardiaque et trajectoire de poids.",
  },
  {
    key: "notif_inbox_administrative",
    title: "Administratif",
    description: "Paiements reçus et demandes de récompense.",
  },
];

const PLAN_COPY: Record<
  CoachPlan,
  {
    label: string;
    summary: string;
    access: string;
    highlights: string[];
    monthlyPrice: string;
  }
> = {
  solo: {
    label: "Solo",
    summary: "Plateforme coach avec livraison PDF et pilotage direct.",
    access: "Sans app client STRYVR",
    highlights: ["Programmes et nutrition", "Bilans et exports PDF"],
    monthlyPrice: "29 € / mois",
  },
  pro: {
    label: "Pro",
    summary: "Inclut l'app client STRYVR et le suivi actif côté client.",
    access: "App client STRYVR incluse",
    highlights: ["Check-ins et routines client", "Suivi et signaux de progression"],
    monthlyPrice: "79 € / mois",
  },
  studio: {
    label: "Studio",
    summary: "Pour accompagner un portefeuille étendu avec STRYVR.",
    access: "App client STRYVR · capacité étendue",
    highlights: ["Capacité client sans limite prédéfinie", "Fonctions équipe bientôt disponibles"],
    monthlyPrice: "129 € / mois",
  },
};

const BILLING_STATUS_COPY: Record<BillingStatus, string> = {
  inactive: "Inactif",
  trialing: "Essai",
  active: "Actif",
  past_due: "Impayé",
  canceled: "Résilié",
};

function formatBillingDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  id,
  icon: Icon,
  title,
  description,
  children,
  open,
  onToggle,
}: {
  id: SettingsSectionId;
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  const triggerId = `${id}-trigger`;
  const panelId = `${id}-panel`;

  return (
    <div className="bg-white/[0.02] border-subtle rounded-2xl overflow-hidden">
      <button
        id={triggerId}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/[0.02] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#dbe4df]"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
            <Icon size={15} className="text-white/50" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white">{title}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{description}</p>
          </div>
        </div>
        <ChevronDown
          size={15}
          className={`text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <>
          <div className="h-px bg-white/[0.05]" />
          <div id={panelId} role="region" aria-labelledby={triggerId} className="px-6 py-5">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      aria-label={label}
      className={`relative h-6 w-10 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dbe4df] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212] ${value ? "bg-[#1f8a65]" : "bg-white/[0.10]"}`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${value ? "left-5" : "left-1"}`}
      />
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [profile, setProfile] = useState<CoachProfile>(DEFAULT_PROFILE);
  const [persistedProfile, setPersistedProfile] = useState<CoachProfile>(DEFAULT_PROFILE);
  const [openSection, setOpenSection] = useState<SettingsSectionId | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [billingLoading, setBillingLoading] = useState<CoachPlan | "portal" | null>(null);
  const [planComparisonOpen, setPlanComparisonOpen] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDeleting, setLogoDeleting] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const { feedback: toast, pushFeedback: pushToast } = useTimedActionFeedback<null>(3500);
  const { feedback: saveFeedback, pushFeedback: pushSaveFeedback } =
    useTimedActionFeedback<SettingsSaveScope>(3500);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    pushToast(null, type, msg);
  }

  // Change email states
  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [confirmNewEmail, setConfirmNewEmail] = useState("");
  const [emailChanging, setEmailChanging] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Delete account states
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const REQUIRED_DELETE_TEXT = "SUPPRIMER MON COMPTE";

  const topBarLeft = useMemo(
    () => (
      <p className="text-[13px] font-semibold text-white leading-none">
        Mon compte
      </p>
    ),
    [],
  );

  useSetTopBar(topBarLeft);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/coach/profile");
    if (res.ok) {
      const { profile: p } = await res.json();
      if (p) {
        const nextProfile = { ...DEFAULT_PROFILE, ...p };
        setProfile(nextProfile);
        setPersistedProfile(nextProfile);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Deep link: /coach/settings?section=plan|profile|notifications|rewards|client-payments
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const section = params.get("section") as SettingsSectionId | null;
    const valid: SettingsSectionId[] = [
      "profile",
      "availabilities",
      "billing",
      "client-payments",
      "plan",
      "notifications",
      "ai",
      "rewards",
      "account",
    ];
    if (section && valid.includes(section)) {
      setOpenSection(section);
      // Scroll after paint
      requestAnimationFrame(() => {
        document.getElementById(section)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, []);

  function renderSaveFeedback(scope: SettingsSaveScope) {
    if (!saveFeedback || saveFeedback.scope !== scope) return null;

    return (
      <ActionFeedbackBadge
        tone={saveFeedback.tone}
        message={saveFeedback.message}
        size="md"
      />
    );
  }

  const hasUnsavedChanges = PERSISTED_PROFILE_KEYS.some(
    (key) => profile[key] !== persistedProfile[key],
  );
  const showGlobalSave = hasUnsavedChanges || saveFeedback?.scope === "all";
  const hasConsumedTrial = Boolean(profile.trial_consumed_at ?? profile.trial_ends_at);

  function toggleSection(section: SettingsSectionId) {
    setOpenSection((current) => (current === section ? null : section));
  }

  async function handleSave(
    updates: Partial<CoachProfile> = profile,
    scope: SettingsSaveScope = "all",
    successMessage = "Modifications enregistrées",
  ) {
    setSaving(true);
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setSaving(false);
    if (res.ok) {
      const { profile: updatedProfile } = await res.json();
      setProfile((currentProfile) => ({ ...currentProfile, ...updatedProfile }));
      setPersistedProfile((currentProfile) => ({ ...currentProfile, ...updatedProfile }));
      pushSaveFeedback(scope, "success", successMessage);
    } else {
      const response = await res.json().catch(() => null);
      const detail = typeof response?.error === "string" ? response.error : null;
      console.error("[coach settings] save failed", { status: res.status, response });
      pushSaveFeedback(
        scope,
        "error",
        detail ? `Impossible d’enregistrer : ${detail}` : "La sauvegarde a échoué. Réessayez.",
      );
    }
  }

  async function handlePlanCheckout(plan: CoachPlan) {
    setBillingLoading(plan);
    try {
      const res = await fetch("/api/stripe/coach-platform/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 409 && data?.portalUrl) {
        window.location.href = data.portalUrl;
        return;
      }

      if (!res.ok || !data?.url) {
        pushToast(null, "error", data?.error || "Erreur lors de la création du paiement");
        return;
      }

      window.location.href = data.url;
    } catch {
      pushToast(null, "error", "La demande de paiement a échoué. Réessayez dans quelques instants.");
    } finally {
      setBillingLoading(null);
    }
  }

  async function handleOpenBillingPortal() {
    setBillingLoading("portal");
    const res = await fetch("/api/stripe/coach-platform/portal", {
      method: "POST",
    });
    const data = await res.json().catch(() => null);
    setBillingLoading(null);

    if (!res.ok || !data?.url) {
      pushToast(null, "error", data?.error || "Erreur lors de l'ouverture du portail Stripe");
      return;
    }

    window.location.href = data.url;
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      showToast("Fichier trop lourd (max 30 Mo)", "error");
      return;
    }
    setCropFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCropConfirm(blob: Blob, filename: string) {
    setCropFile(null);
    setLogoUploading(true);
    const form = new FormData();
    form.append("logo", new File([blob], filename, { type: "image/jpeg" }));
    const res = await fetch("/api/coach/profile/logo", {
      method: "POST",
      body: form,
    });
    setLogoUploading(false);
    if (res.ok) {
      const { logoUrl } = await res.json();
      setProfile((p) => ({ ...p, logo_url: logoUrl }));
      setPersistedProfile((p) => ({ ...p, logo_url: logoUrl }));
      showToast("Identité visuelle mise à jour");
    } else {
      showToast("Erreur upload", "error");
    }
  }

  async function handleLogoDelete() {
    setLogoDeleting(true);
    const res = await fetch("/api/coach/profile/logo", { method: "DELETE" });
    setLogoDeleting(false);
    if (res.ok) {
      setProfile((p) => ({ ...p, logo_url: null }));
      setPersistedProfile((p) => ({ ...p, logo_url: null }));
      showToast("Logo supprimé");
    } else {
      showToast("Erreur suppression logo", "error");
    }
  }

  async function handleResetPassword() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return;
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${siteUrl}/auth/reset-password`,
    });
    showToast("Email de réinitialisation envoyé");
  }

  async function handleChangeEmail() {
    if (newEmail.toLowerCase() !== confirmNewEmail.toLowerCase()) {
      showToast("Les adresses e-mail ne correspondent pas", "error");
      return;
    }
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      showToast("Adresse e-mail invalide", "error");
      return;
    }
    setEmailChanging(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailChanging(false);
    if (error) {
      showToast(error.message || "Erreur lors du changement d'email", "error");
    } else {
      showToast("Lien de confirmation envoyé à votre nouvelle adresse");
      setEmailChangeOpen(false);
      setNewEmail("");
      setConfirmNewEmail("");
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const response = await fetch("/api/privacy/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestType: "erasure" }),
    });
    const payload = await response.json().catch(() => null);
    setDeleting(false);

    if (!response.ok) {
      showToast(payload?.error || "Demande impossible", "error");
      return;
    }

    const reference = String(payload?.request?.id ?? "").slice(0, 8).toUpperCase();
    showToast(reference ? `Demande enregistrée — ${reference}` : "Demande enregistrée");
    setDeleteStep(0);
    setDeleteConfirmText("");
  }

  async function handleDataExport() {
    setExporting(true);
    const response = await fetch("/api/privacy/export", { cache: "no-store" });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      showToast(payload?.error || "Export impossible", "error");
      setExporting(false);
      return;
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "stryv-export.json";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExporting(false);
    showToast("Export sécurisé généré");
  }

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function set<K extends keyof CoachProfile>(key: K, value: CoachProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#121212] px-6 py-8 max-w-2xl mx-auto space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white/[0.02] border-subtle rounded-2xl p-6 space-y-3"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </div>
        ))}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#121212] px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-3">
        {/* ── Header ── */}
        <div className="mb-6">
          <h1 className="text-xl font-black text-white tracking-tight">
            Mon compte
          </h1>
          <p className="text-[13px] text-white/40 mt-1">
            Gérez votre profil, facturation et préférences
          </p>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION 1 — PROFIL
        ════════════════════════════════════════════════════════════ */}
        <Section
          id="profile"
          icon={User}
          title="Profil pro"
          description="Identité, marque et coordonnées professionnelles"
          open={openSection === "profile"}
          onToggle={() => toggleSection("profile")}
        >
          {/* Identité visuelle */}
          <div className="mb-6">
            <p className={labelCls}>Identité visuelle</p>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white/[0.04] flex items-center justify-center overflow-hidden shrink-0">
                {logoUploading ? (
                  <Loader2 size={20} className="text-white/30 animate-spin" />
                ) : profile.logo_url ? (
                  <Image
                    src={profile.logo_url}
                    alt="Identité visuelle"
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 size={28} className="text-white/20" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border-button hover:bg-white/[0.10] text-xs font-semibold text-white/70 hover:text-white transition-colors disabled:opacity-40"
                >
                  {logoUploading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Upload size={13} />
                  )}
                  {logoUploading
                    ? "Upload…"
                    : profile.logo_url
                      ? "Changer"
                      : "Choisir une image"}
                </button>
                {profile.logo_url && (
                  <button
                    type="button"
                    onClick={handleLogoDelete}
                    disabled={logoDeleting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border-button text-xs font-semibold text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-40"
                  >
                    {logoDeleting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    Supprimer
                  </button>
                )}
                <p className="text-[10px] text-white/25">
                  JPG, PNG, WebP, SVG — max 30 Mo
                </p>
                <p className="text-[10px] text-white/20">
                  Recadrage carré automatique avant upload
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nom complet</label>
              <input
                className={inputCls}
                value={profile.full_name ?? ""}
                onChange={(e) => set("full_name", e.target.value || null)}
                placeholder="Jean Dupont"
              />
            </div>
            <div>
              <label className={labelCls}>Nom de marque</label>
              <input
                className={inputCls}
                value={profile.brand_name ?? ""}
                onChange={(e) => set("brand_name", e.target.value || null)}
                placeholder="JD Coaching"
              />
            </div>
            <div>
              <label className={labelCls}>Email pro</label>
              <input
                type="email"
                className={inputCls}
                value={profile.pro_email ?? ""}
                onChange={(e) => set("pro_email", e.target.value || null)}
                placeholder="contact@moncoaching.fr"
              />
            </div>
            <PhoneCountryField
              variant="coach"
              label="Téléphone"
              value={profile.phone}
              defaultCountryIso="BE"
              placeholder="470 12 34 56"
              onChange={(e164) => set("phone", e164)}
            />
          </div>
          <div className="mt-5 flex flex-col items-end gap-2 border-t border-white/[0.05] pt-4">
            <button
              type="button"
              onClick={() => handleSave({
                full_name: profile.full_name,
                brand_name: profile.brand_name,
                pro_email: profile.pro_email,
                phone: profile.phone,
              }, "profile", "Profil professionnel enregistré")}
              disabled={saving}
              className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1f8a65] px-4 text-xs font-bold text-white transition-colors hover:bg-[#217356] disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Enregistrer le profil
            </button>

            {renderSaveFeedback("profile")}
          </div>
        </Section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 1.5 — DISPONIBILITES & CALENDRIERS
        ════════════════════════════════════════════════════════════ */}
        <Section
          id="availabilities"
          icon={Calendar}
          title="Disponibilités & Calendriers"
          description="Gérez votre grille de travail hebdomadaire et liez vos agendas externes (Google Meet, Teams)"
          open={openSection === "availabilities"}
          onToggle={() => toggleSection("availabilities")}
        >
          <AvailabilitySettings />
        </Section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 2 — FACTURATION
        ════════════════════════════════════════════════════════════ */}
        <Section
          id="billing"
          icon={Building2}
          title="Facturation"
          description="Informations légales pour vos factures"
          open={openSection === "billing"}
          onToggle={() => toggleSection("billing")}
        >
          <div className="space-y-4">
            {(() => {
              const countryCopy = profile.billing_country
                ? BUSINESS_NUMBER_COPY[profile.billing_country] ?? DEFAULT_BUSINESS_NUMBER_COPY
                : DEFAULT_BUSINESS_NUMBER_COPY;

              return (
                <>
            <div>
              <label className={labelCls}>Nom légal de l'entreprise</label>
              <input
                className={inputCls}
                value={profile.company_name ?? ""}
                onChange={(e) => set("company_name", e.target.value || null)}
                placeholder="Ex. STRYV Coaching SRL"
                autoComplete="organization"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Pays de facturation</label>
                <select
                  className={inputCls}
                  value={profile.billing_country ?? ""}
                  onChange={(e) => set("billing_country", e.target.value || null)}
                  autoComplete="country"
                >
                  <option value="">Sélectionner un pays</option>
                  {BILLING_COUNTRIES.map(([code, country]) => (
                    <option key={code} value={code} className="bg-[#0a0a0a]">{country}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{countryCopy.label}</label>
                <input
                  className={inputCls}
                  value={profile.business_registration_number ?? ""}
                  onChange={(e) => set("business_registration_number", e.target.value || null)}
                  placeholder={countryCopy.placeholder}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>{countryCopy.vatLabel}</label>
              <input
                className={inputCls}
                value={profile.vat_number ?? ""}
                onChange={(e) => set("vat_number", e.target.value || null)}
                placeholder={countryCopy.vatPlaceholder}
              />
            </div>
            <div>
              <label className={labelCls}>Adresse de facturation</label>
              <textarea
                className="w-full px-4 py-3 bg-[#0a0a0a] border-input rounded-xl text-sm text-white outline-none placeholder:text-white/20 resize-none"
                rows={3}
                value={profile.address ?? ""}
                onChange={(e) => set("address", e.target.value || null)}
                placeholder={profile.billing_country === "BE" ? "Rue Exemple 12\n1000 Bruxelles\nBelgique" : "12 rue de la Paix\n75001 Paris\nFrance"}
                autoComplete="street-address"
              />
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-white/[0.05] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-white/35 leading-relaxed">
                Ces informations figurent sur vos reçus PDF et seront reprises dans les futures factures légales.
              </p>
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() => handleSave({
                    company_name: profile.company_name,
                    billing_country: profile.billing_country,
                    business_registration_number: profile.business_registration_number,
                    vat_number: profile.vat_number,
                    address: profile.address,
                  }, "billing", "Informations de facturation enregistrées")}
                  disabled={saving}
                  className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1f8a65] px-4 text-xs font-bold text-white transition-colors hover:bg-[#217356] disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Enregistrer la facturation
                </button>
                {renderSaveFeedback("billing")}
              </div>
            </div>
                </>
              );
            })()}
          </div>
        </Section>

        <Section
          id="client-payments"
          icon={CreditCard}
          title="Encaissements de mes clients"
          description="Connectez Stripe et automatisez vos paiements clients"
          open={openSection === "client-payments"}
          onToggle={() => toggleSection("client-payments")}
        >
          <CoachPaymentSettingsSection />
        </Section>

        <Section
          id="plan"
          icon={Building2}
          title="Plan"
          description="Accès produit, statut et limites actives"
          open={openSection === "plan"}
          onToggle={() => toggleSection("plan")}
        >
          <div className="space-y-7">
            <div className="overflow-hidden rounded-2xl border border-[#1f8a65]/30 bg-[#1f8a65]/[0.06]">
              <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#69d0ac]">
                    Votre accès actuel
                  </p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-2xl font-black tracking-tight text-white">
                      {PLAN_COPY[profile.plan].label}
                    </h3>
                    <p className="text-[13px] text-white/50">{PLAN_COPY[profile.plan].access}</p>
                  </div>
                  <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/55">
                    {PLAN_COPY[profile.plan].summary}
                  </p>
                  {profile.billing_status === "trialing" && profile.trial_ends_at ? (
                    <p className="mt-3 text-[12px] font-medium text-[#8ef0c7]">
                      Essai en cours jusqu&apos;au {formatBillingDate(profile.trial_ends_at)}
                    </p>
                  ) : null}
                </div>
                <span className="w-fit rounded-full border border-[#69d0ac]/20 bg-[#1f8a65]/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8ef0c7]">
                  {BILLING_STATUS_COPY[profile.billing_status]}
                </span>
              </div>

              <div className="border-t border-[#69d0ac]/15 bg-black/10 px-5 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">
                      Capacité clients
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {profile.client_limit == null ? "Clients sans limite" : `Jusqu’à ${profile.client_limit} clients`}
                    </p>
                  </div>
                  <div className="border-t border-white/[0.06] pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">
                      {profile.billing_status === "trialing" ? "Premier prélèvement" : "Renouvellement"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {profile.billing_status === "trialing"
                        ? formatBillingDate(profile.trial_ends_at)
                        : formatBillingDate(profile.stripe_current_period_end) ?? "Aucune échéance"}
                    </p>
                    {(profile.billing_status === "trialing" || profile.billing_status === "active") ? (
                      <p className="mt-1 text-[11px] text-white/45">
                        {profile.billing_status === "trialing" ? "Puis " : ""}{PLAN_COPY[profile.plan].monthlyPrice}
                      </p>
                    ) : null}
                  </div>
                </div>

                {profile.stripe_customer_id ? (
                  <button
                    type="button"
                    onClick={handleOpenBillingPortal}
                    disabled={billingLoading !== null}
                    className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.06] px-3.5 text-xs font-bold text-white transition-colors hover:bg-white/[0.10] disabled:opacity-40"
                  >
                    {billingLoading === "portal" ? <Loader2 size={14} className="animate-spin" /> : null}
                    Gérer l&apos;abonnement
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className={labelCls}>Changer d&apos;accès</p>
                  <p className="text-[12px] leading-relaxed text-white/45">
                    Comparez les espaces de travail disponibles pour votre activité.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPlanComparisonOpen(true)}
                  className="mt-2 w-fit text-[11px] font-bold text-white/70 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f8a65] sm:mt-0"
                >
                  Comparer toutes les fonctionnalités
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {(["solo", "pro", "studio"] as const).map((plan) => {
                  const isCurrentPlan = profile.plan === plan;
                  const isCurrentPaidPlan = isCurrentPlan && profile.billing_status !== "inactive";
                  const copy = PLAN_COPY[plan];

                  return (
                    <div
                      key={plan}
                      className={`flex min-h-[250px] flex-col rounded-2xl border p-4 transition-colors ${
                        isCurrentPlan
                          ? "border-[#1f8a65]/45 bg-[#1f8a65]/[0.08]"
                          : "border-white/[0.07] bg-white/[0.025] hover:border-white/[0.14] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-black text-white">{copy.label}</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-white/50">{copy.summary}</p>
                        </div>
                        {isCurrentPlan ? (
                          <span className="shrink-0 rounded-full bg-[#1f8a65] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.13em] text-white">
                            Actuel
                          </span>
                        ) : null}
                      </div>

                      <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-white/58">
                        {copy.highlights.map((highlight) => (
                          <li key={highlight} className="flex gap-2">
                            <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-white/45" />
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-auto pt-5">
                        {isCurrentPaidPlan ? (
                          <div className="flex h-10 items-center rounded-xl border border-[#69d0ac]/20 bg-[#1f8a65]/10 px-3 text-[11px] font-semibold text-[#8ef0c7]">
                            Plan actuellement actif
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePlanCheckout(plan)}
                            disabled={billingLoading !== null}
                            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-[#111111] transition-colors hover:bg-white/90 disabled:opacity-40"
                          >
                            {billingLoading === plan ? <Loader2 size={14} className="animate-spin" /> : null}
                            {isCurrentPlan ? `Activer ${copy.label}` : `Choisir ${copy.label}`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 3 — NOTIFICATIONS
        ════════════════════════════════════════════════════════════ */}
        <Section
          id="notifications"
          icon={Bell}
          title="Notifications"
          description="Choisissez les signaux visibles et les emails automatiques"
          open={openSection === "notifications"}
          onToggle={() => toggleSection("notifications")}
        >
          <div className="space-y-5">
            <div>
              <p className={labelCls}>Dans l&apos;application</p>
              <p className="mb-3 text-[11px] leading-relaxed text-white/40">
                Ces réglages s&apos;appliquent à la cloche, à la boîte de réception et aux signaux à traiter dans vos listes clients.
              </p>
              <div className="divide-y divide-white/[0.05] rounded-2xl border border-white/[0.06] bg-black/20 px-4">
                {IN_APP_NOTIFICATION_GROUPS.map(({ key, title, description }) => (
                  <div key={key} className="flex items-start justify-between gap-4 py-3.5">
                    <div>
                      <p className="text-sm font-semibold text-white">{title}</p>
                      <p className="mt-0.5 text-[11px] text-white/40">{description}</p>
                    </div>
                    <Toggle
                      value={profile[key]}
                      onChange={(value) => set(key, value)}
                      label={`${profile[key] ? "Masquer" : "Afficher"} les notifications : ${title}`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3 py-2.5 text-[11px] leading-relaxed text-amber-100/70">
                <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-300" />
                <p>Les alertes critiques de sécurité et les demandes d&apos;intervention restent toujours visibles.</p>
              </div>
            </div>

            <div className="h-px bg-white/[0.05]" />

            <div>
              <p className={labelCls}>Emails automatiques</p>
              <p className="mb-1 text-[11px] text-white/40">Recevez les événements importants également par email.</p>
            </div>

            {/* Rappels paiement */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  Rappels paiement
                </p>
                <p className="text-[11px] text-white/40 mt-0.5">
                  E-mail + app client avant l’échéance (J-N), le jour J, et en
                  retard si jamais relancé. Les échéances partent des
                  abonnements actifs (génération auto quotidienne + bouton
                  Comptabilité).
                </p>
              </div>
              <Toggle
                value={profile.notif_payment_reminder}
                onChange={(v) => set("notif_payment_reminder", v)}
                label="Activer les rappels de paiement par email"
              />
            </div>

            {profile.notif_payment_reminder && (
              <div>
                <p className={labelCls}>Délai avant échéance</p>
                <div className="flex gap-2">
                  {[1, 3, 7].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => set("notif_payment_reminder_days", days)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                        profile.notif_payment_reminder_days === days
                          ? "bg-[#1f8a65]/10 text-[#1f8a65]"
                          : "bg-white/[0.04] text-white/40 hover:bg-white/[0.07] hover:text-white/60"
                      }`}
                    >
                      J-{days}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="h-px bg-white/[0.05]" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  Conseils de prise en main
                </p>
                <p className="text-[11px] text-white/40 mt-0.5">
                  Des repères utiles pendant les 14 premiers jours, adaptés à votre avancement.
                </p>
              </div>
              <Toggle
                value={profile.notif_onboarding_emails}
                onChange={(v) => set("notif_onboarding_emails", v)}
                label="Activer les conseils de prise en main par email"
              />
            </div>

            <div className="h-px bg-white/[0.05]" />

            {/* Bilan complété */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  Bilan complété
                </p>
                <p className="text-[11px] text-white/40 mt-0.5">
                  Notifie par email quand un client soumet un bilan
                </p>
              </div>
              <Toggle
                value={profile.notif_bilan_completed}
                onChange={(v) => set("notif_bilan_completed", v)}
                label="Activer les emails de bilan complété"
              />
            </div>

            <div className="flex flex-col items-end gap-2 border-t border-white/[0.05] pt-4">
              <button
                type="button"
                onClick={() => handleSave({
                  notif_payment_reminder: profile.notif_payment_reminder,
                  notif_payment_reminder_days: profile.notif_payment_reminder_days,
                  notif_bilan_completed: profile.notif_bilan_completed,
                  notif_onboarding_emails: profile.notif_onboarding_emails,
                  notif_inbox_assessments: profile.notif_inbox_assessments,
                  notif_inbox_training: profile.notif_inbox_training,
                  notif_inbox_messages: profile.notif_inbox_messages,
                  notif_inbox_checkins: profile.notif_inbox_checkins,
                  notif_inbox_nutrition: profile.notif_inbox_nutrition,
                  notif_inbox_health_progress: profile.notif_inbox_health_progress,
                  notif_inbox_administrative: profile.notif_inbox_administrative,
                }, "notifications", "Préférences de notification enregistrées")}
                disabled={saving}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1f8a65] px-4 text-xs font-bold text-white transition-colors hover:bg-[#217356] disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Enregistrer les notifications
              </button>
              {renderSaveFeedback("notifications")}
            </div>
          </div>
        </Section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 4 — IA COACH
        ════════════════════════════════════════════════════════════ */}
        <Section
          id="ai"
          icon={Brain}
          title="IA Coach"
          description="Configuration du coach IA pour vos clients"
          open={openSection === "ai"}
          onToggle={() => toggleSection("ai")}
        >
          <div className="space-y-5">
            {/* Activation globale */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Activer l&apos;IA LLM</p>
                <p className="text-[11px] text-white/40 mt-0.5">
                  Permet d&apos;activer le coach IA pour vos clients (individuellement)
                </p>
              </div>
              <Toggle
                value={profile.has_ai_llm}
                onChange={(v) => set("has_ai_llm", v)}
              />
            </div>

            {profile.has_ai_llm && (
              <>
                <div className="h-px bg-white/[0.05]" />

                {/* Ton du coach IA */}
                <div>
                  <p className={labelCls}>Ton du coach IA</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ['strict',       'Strict'],
                      ['bienveillant', 'Bienveillant'],
                      ['motivant',     'Motivant'],
                      ['neutre',       'Neutre'],
                    ] as const).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => set('ai_tone', val)}
                        className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                          (profile.ai_tone ?? 'bienveillant') === val
                            ? 'bg-[#1f8a65]/10 text-[#1f8a65]'
                            : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.07] hover:text-white/60'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-white/[0.05]" />

                {/* Alertes email safety */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Alertes email urgences</p>
                    <p className="text-[11px] text-white/40 mt-0.5">
                      Email immédiat si un client envoie un message de type &laquo; safety &raquo;
                    </p>
                  </div>
                  <Toggle
                    value={profile.ai_notif_email}
                    onChange={(v) => set('ai_notif_email', v)}
                  />
                </div>

                <WhatsappAgentSettings />
              </>
            )}

            {!profile.has_ai_llm && (
              <div className="px-4 py-3 rounded-xl bg-white/[0.03] border-subtle text-[11px] text-white/35 leading-relaxed">
                L&apos;IA est désactivée par défaut. Activez-la globalement ici,
                puis individuellement dans le profil de chaque client.
              </div>
            )}
            <div className="flex flex-col items-end gap-2 border-t border-white/[0.05] pt-4">
              <button
                type="button"
                onClick={() => handleSave({
                  has_ai_llm: profile.has_ai_llm,
                  ai_tone: profile.ai_tone,
                  ai_notif_email: profile.ai_notif_email,
                  ai_notif_sms: profile.ai_notif_sms,
                  ai_escalation_threshold: profile.ai_escalation_threshold,
                }, "ai", "Préférences IA enregistrées")}
                disabled={saving}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1f8a65] px-4 text-xs font-bold text-white transition-colors hover:bg-[#217356] disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Enregistrer l&apos;IA Coach
              </button>
              {renderSaveFeedback("ai")}
            </div>
          </div>
        </Section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 5 — RÉCOMPENSES
        ════════════════════════════════════════════════════════════ */}
        {/* Rewards require client app (Pro+) — section still visible with plan context in child */}
        <Section
          id="rewards"
          icon={Gift}
          title="Boutique de Récompenses"
          description="Gérez les cadeaux et leurs coûts pour vos clients (app STRYVR · Pro+)"
          open={openSection === "rewards"}
          onToggle={() => toggleSection("rewards")}
        >
          <CoachRewardsSection />
        </Section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 6 — COMPTE
        ════════════════════════════════════════════════════════════ */}
        <Section
          id="account"
          icon={ShieldAlert}
          title="Compte"
          description="Email, mot de passe et suppression"
          open={openSection === "account"}
          onToggle={() => toggleSection("account")}
        >
          <div className="space-y-3">
            {/* Changer email */}
            {!emailChangeOpen ? (
              <button
                type="button"
                onClick={() => setEmailChangeOpen(true)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-white/[0.04] border-subtle hover:bg-white/[0.07] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Mail
                    size={15}
                    className="text-white/40 group-hover:text-white/60 transition-colors"
                  />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white">
                      Changer d&apos;email
                    </p>
                    <p className="text-[11px] text-white/35">
                      Un lien de confirmation sera envoyé à la nouvelle adresse
                    </p>
                  </div>
                </div>
                <ChevronDown size={13} className="text-white/20 -rotate-90" />
              </button>
            ) : (
              <div className="rounded-xl bg-white/[0.04] border-subtle p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Mail size={14} className="text-white/40" />
                  <p className="text-sm font-semibold text-white">Changer d&apos;email</p>
                </div>
                <p className="text-[11px] text-white/40 leading-relaxed">
                  Saisissez votre nouvelle adresse deux fois. Un lien de confirmation vous sera envoyé à cette adresse — votre email ne changera qu&apos;après validation.
                </p>
                <div>
                  <label className={labelCls}>Nouvelle adresse e-mail</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="nouvelle@email.com"
                    autoComplete="off"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Confirmer la nouvelle adresse</label>
                  <input
                    type="email"
                    value={confirmNewEmail}
                    onChange={(e) => setConfirmNewEmail(e.target.value)}
                    placeholder="nouvelle@email.com"
                    autoComplete="off"
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setEmailChangeOpen(false); setNewEmail(""); setConfirmNewEmail(""); }}
                    className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[13px] text-white/55 hover:text-white/80 transition-colors font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleChangeEmail}
                    disabled={emailChanging || !newEmail || !confirmNewEmail}
                    className="flex-1 py-2.5 rounded-xl bg-[#1f8a65] text-white text-[13px] font-bold hover:bg-[#217356] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                  >
                    {emailChanging ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : null}
                    {emailChanging ? "Envoi…" : "Envoyer le lien"}
                  </button>
                </div>
              </div>
            )}

            {/* Changer MDP */}
            <button
              type="button"
              onClick={handleResetPassword}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-white/[0.04] border-subtle hover:bg-white/[0.07] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <KeyRound
                  size={15}
                  className="text-white/40 group-hover:text-white/60 transition-colors"
                />
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">
                    Changer le mot de passe
                  </p>
                  <p className="text-[11px] text-white/35">
                    Reçevez un lien de réinitialisation par email
                  </p>
                </div>
              </div>
              <ChevronDown size={13} className="text-white/20 -rotate-90" />
            </button>

            <button
              type="button"
              onClick={handleDataExport}
              disabled={exporting}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-white/[0.04] border-subtle hover:bg-white/[0.07] disabled:opacity-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                {exporting ? (
                  <Loader2 size={15} className="animate-spin text-white/50" />
                ) : (
                  <Download size={15} className="text-white/40 group-hover:text-white/60 transition-colors" />
                )}
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Exporter mes données</p>
                  <p className="text-[11px] text-white/35">Archive JSON structurée, générée à la demande</p>
                </div>
              </div>
              <ChevronDown size={13} className="text-white/20 -rotate-90" />
            </button>

            <div className="pt-1">
              <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/28">
                Session
              </p>

              {!logoutOpen ? (
                <button
                  type="button"
                  onClick={() => setLogoutOpen(true)}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-[#101010] border border-white/[0.06] hover:bg-white/[0.05] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.05]">
                      <LogOut
                        size={15}
                        className="text-white/45 group-hover:text-white/70 transition-colors"
                      />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-white">
                        Se déconnecter
                      </p>
                      <p className="text-[11px] text-white/35">
                        Fermer la session active sur cet appareil
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={13} className="text-white/20 -rotate-90" />
                </button>
              ) : (
                <div className="rounded-xl border border-white/[0.06] bg-[#101010] p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <LogOut size={14} className="text-white/45" />
                    <p className="text-sm font-semibold text-white">Se déconnecter</p>
                  </div>
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    Vous serez immédiatement déconnecté de l&apos;espace coach et redirigé vers l&apos;accueil.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setLogoutOpen(false)}
                      className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[13px] text-white/55 hover:text-white/80 transition-colors font-medium"
                      disabled={loggingOut}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="flex-1 py-2.5 rounded-xl bg-white text-[#111111] text-[13px] font-bold hover:bg-white/90 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                    >
                      {loggingOut ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <LogOut size={13} />
                      )}
                      {loggingOut ? "Déconnexion…" : "Déconnecter"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-white/[0.05] my-2" />

            {/* Delete account */}
            {deleteStep === 0 && (
              <button
                type="button"
                onClick={() => setDeleteStep(1)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-red-500/5 border-subtle hover:bg-red-500/10 transition-colors text-left"
              >
                <Trash2 size={15} className="text-red-400/60 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-400/80">
                    Demander la suppression
                  </p>
                  <p className="text-[11px] text-red-400/40">
                    Demande RGPD suivie et vérifiée
                  </p>
                </div>
              </button>
            )}

            {/* Step 1 — Avertissement */}
            {deleteStep === 1 && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 border-subtle p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    size={18}
                    className="text-red-400 shrink-0 mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-bold text-red-400">
                      Vous êtes sur le point de demander la suppression
                    </p>
                    <p className="text-[12px] text-white/50 mt-1.5 leading-relaxed">
                      La suppression n&apos;est pas instantanée. La demande sera
                      vérifiée, tracée et traitée avec les éventuelles obligations
                      légales de conservation. Elle concerne notamment :
                    </p>
                  </div>
                </div>
                <ul className="space-y-1.5 pl-2">
                  {[
                    "Tous vos clients et leurs données",
                    "Tous vos programmes et templates",
                    "Tous les bilans et historiques de séances",
                    "Vos formules et données de gestion non soumises à conservation légale",
                    "Votre profil et vos paramètres",
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 text-[12px] text-white/50"
                    >
                      <X size={10} className="text-red-400/60 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-[12px] text-white/40 leading-relaxed">
                  Nous répondons en principe dans un délai d&apos;un mois. Votre
                  compte reste accessible pendant l&apos;instruction de la demande.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteStep(0)}
                    className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-sm font-semibold text-white/60 hover:text-white transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(2)}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-sm font-bold text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    Continuer vers la demande →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 — Confirmation saisie texte */}
            {deleteStep === 2 && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 border-subtle p-5 space-y-4">
                <p className="text-sm font-bold text-red-400">
                  Confirmation finale
                </p>
                <p className="text-[12px] text-white/50 leading-relaxed">
                  Pour confirmer, tapez exactement le texte suivant dans le
                  champ ci-dessous :
                </p>
                <div className="px-3 py-2 rounded-lg bg-black/30 font-mono text-sm text-white/80 text-center tracking-wide select-all">
                  {REQUIRED_DELETE_TEXT}
                </div>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Tapez le texte ci-dessus..."
                  className="w-full h-11 px-4 bg-[#0a0a0a] border-input rounded-xl text-sm text-white outline-none placeholder:text-white/20 font-mono"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteStep(0);
                      setDeleteConfirmText("");
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-white/[0.06] text-sm font-semibold text-white/60 hover:text-white transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={
                      deleteConfirmText !== REQUIRED_DELETE_TEXT || deleting
                    }
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {deleting ? (
                      <Loader2 size={15} className="animate-spin mx-auto" />
                    ) : (
                    "Envoyer la demande"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ── Global safety save ── */}
        {showGlobalSave && (
          <div className="sticky bottom-[148px] z-20 flex flex-col gap-3 rounded-2xl border border-[#1f8a65]/25 bg-[#161b18] p-3 shadow-2xl shadow-black/40 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
            <p className="px-1 text-xs text-white/60">
              {hasUnsavedChanges ? "Modifications non enregistrées" : "Tous les paramètres sont enregistrés"}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {renderSaveFeedback("all")}
              {hasUnsavedChanges && (
                <button
                  type="button"
                  onClick={() => handleSave(profile, "all", "Tous les paramètres ont été enregistrés")}
                  disabled={saving}
                  className="flex h-10 items-center gap-2 rounded-xl bg-[#1f8a65] px-4 text-xs font-bold text-white transition-colors hover:bg-[#217356] disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Enregistrer tout
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Crop modal ── */}
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          onConfirm={handleCropConfirm}
          onClose={() => setCropFile(null)}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <ActionFeedbackBadge
            tone={toast.tone}
            message={toast.message}
            className="px-4 py-3 text-xs font-bold shadow-2xl backdrop-blur-md"
          />
        </div>
      )}

      <PlanComparisonModal
        open={planComparisonOpen}
        currentPlan={profile.plan}
        billingStatus={profile.billing_status}
        hasConsumedTrial={hasConsumedTrial}
        choosingPlan={billingLoading === "solo" || billingLoading === "pro" || billingLoading === "studio" ? billingLoading : null}
        onClose={() => setPlanComparisonOpen(false)}
        onChoose={(plan) => {
          setPlanComparisonOpen(false);
          void handlePlanCheckout(plan);
        }}
      />
    </main>
  );
}
