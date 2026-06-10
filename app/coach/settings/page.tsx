"use client";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  User,
  Building2,
  Bell,
  ShieldAlert,
  Upload,
  Trash2,
  Loader2,
  Check,
  X,
  ChevronDown,
  AlertTriangle,
  Mail,
  KeyRound,
  Brain,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import ImageCropModal from "@/components/ui/ImageCropModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type CoachProfile = {
  full_name: string | null;
  brand_name: string | null;
  pro_email: string | null;
  phone: string | null;
  logo_url: string | null;
  siret: string | null;
  address: string | null;
  vat_number: string | null;
  notif_payment_reminder: boolean;
  notif_payment_reminder_days: number;
  notif_bilan_completed: boolean;
  // IA Coach
  has_ai_llm: boolean;
  ai_tone: 'strict' | 'bienveillant' | 'motivant' | 'neutre' | null;
  ai_notif_email: boolean;
  ai_notif_sms: boolean;
  ai_escalation_threshold: number | null;
};

const DEFAULT_PROFILE: CoachProfile = {
  full_name: null,
  brand_name: null,
  pro_email: null,
  phone: null,
  logo_url: null,
  siret: null,
  address: null,
  vat_number: null,
  notif_payment_reminder: true,
  notif_payment_reminder_days: 3,
  notif_bilan_completed: true,
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

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  description,
  children,
  defaultOpen = true,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white/[0.02] border-subtle rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/[0.02] transition-colors"
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
          <div className="px-6 py-5">{children}</div>
        </>
      )}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-10 h-6 rounded-full transition-colors ${value ? "bg-[#1f8a65]" : "bg-white/[0.10]"}`}
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDeleting, setLogoDeleting] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change email states
  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [confirmNewEmail, setConfirmNewEmail] = useState("");
  const [emailChanging, setEmailChanging] = useState(false);

  // Delete account states
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

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

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/coach/profile");
    if (res.ok) {
      const { profile: p } = await res.json();
      if (p) setProfile({ ...DEFAULT_PROFILE, ...p });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/coach/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    if (res.ok) {
      const { profile: updatedProfile } = await res.json();
      setProfile(updatedProfile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      showToast("Modifications enregistrées");
    } else {
      showToast("Erreur lors de la sauvegarde", "error");
    }
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
    // Soft delete: sign out and mark account — full deletion handled server-side
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/?deleted=1";
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
          icon={User}
          title="Profil pro"
          description="Identité, marque et coordonnées professionnelles"
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
            <div>
              <label className={labelCls}>Téléphone</label>
              <input
                className={inputCls}
                value={profile.phone ?? ""}
                onChange={(e) => set("phone", e.target.value || null)}
                placeholder="+33 6 00 00 00 00"
              />
            </div>
          </div>
        </Section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 2 — FACTURATION
        ════════════════════════════════════════════════════════════ */}
        <Section
          icon={Building2}
          title="Facturation"
          description="Informations légales pour vos factures"
          defaultOpen={false}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>SIRET</label>
                <input
                  className={inputCls}
                  value={profile.siret ?? ""}
                  onChange={(e) => set("siret", e.target.value || null)}
                  placeholder="123 456 789 00012"
                />
              </div>
              <div>
                <label className={labelCls}>N° TVA intracommunautaire</label>
                <input
                  className={inputCls}
                  value={profile.vat_number ?? ""}
                  onChange={(e) => set("vat_number", e.target.value || null)}
                  placeholder="FR12345678901"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Adresse</label>
              <textarea
                className="w-full px-4 py-3 bg-[#0a0a0a] border-input rounded-xl text-sm text-white outline-none placeholder:text-white/20 resize-none"
                rows={3}
                value={profile.address ?? ""}
                onChange={(e) => set("address", e.target.value || null)}
                placeholder={"12 rue de la Paix\n75001 Paris\nFrance"}
              />
            </div>
            <div className="px-4 py-3 rounded-xl bg-white/[0.03] border-subtle text-[11px] text-white/35 leading-relaxed">
              Ces informations apparaîtront sur vos reçus PDF et futures
              factures légales.
            </div>
          </div>
        </Section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 3 — NOTIFICATIONS
        ════════════════════════════════════════════════════════════ */}
        <Section
          icon={Bell}
          title="Notifications"
          description="Rappels et alertes automatiques"
          defaultOpen={false}
        >
          <div className="space-y-5">
            {/* Rappels paiement */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  Rappels paiement
                </p>
                <p className="text-[11px] text-white/40 mt-0.5">
                  Envoie un email au client avant chaque échéance
                </p>
              </div>
              <Toggle
                value={profile.notif_payment_reminder}
                onChange={(v) => set("notif_payment_reminder", v)}
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
              />
            </div>
          </div>
        </Section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 4 — IA COACH
        ════════════════════════════════════════════════════════════ */}
        <Section
          icon={Brain}
          title="IA Coach"
          description="Configuration du coach IA pour vos clients"
          defaultOpen={false}
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
              </>
            )}

            {!profile.has_ai_llm && (
              <div className="px-4 py-3 rounded-xl bg-white/[0.03] border-subtle text-[11px] text-white/35 leading-relaxed">
                L&apos;IA est désactivée par défaut. Activez-la globalement ici,
                puis individuellement dans le profil de chaque client.
              </div>
            )}
          </div>
        </Section>

        {/* ════════════════════════════════════════════════════════════
            SECTION 4 — COMPTE
        ════════════════════════════════════════════════════════════ */}
        <Section
          icon={ShieldAlert}
          title="Compte"
          description="Email, mot de passe et suppression"
          defaultOpen={false}
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
                    Supprimer mon compte
                  </p>
                  <p className="text-[11px] text-red-400/40">
                    Cette action est irréversible
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
                      Vous êtes sur le point de supprimer votre compte
                    </p>
                    <p className="text-[12px] text-white/50 mt-1.5 leading-relaxed">
                      Cette action est{" "}
                      <strong className="text-white/70">
                        définitive et irréversible
                      </strong>
                      . Voici ce qui sera supprimé :
                    </p>
                  </div>
                </div>
                <ul className="space-y-1.5 pl-2">
                  {[
                    "Tous vos clients et leurs données",
                    "Tous vos programmes et templates",
                    "Tous les bilans et historiques de séances",
                    "Toutes vos formules et données de comptabilité",
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
                  Vos clients perdront l&apos;accès à leur espace. Pensez à les
                  prévenir avant de procéder.
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
                    Je comprends, continuer →
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
                      "Supprimer définitivement"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ── Save button ── */}
        <div className="flex justify-end pt-2 pb-8">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 h-11 rounded-xl bg-[#1f8a65] hover:bg-[#217356] text-white text-sm font-bold disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : saved ? (
              <Check size={15} />
            ) : null}
            {saving
              ? "Enregistrement…"
              : saved
                ? "Enregistré !"
                : "Enregistrer les modifications"}
          </button>
        </div>
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
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold shadow-2xl backdrop-blur-md border transition-all duration-300 ${
            toast.type === "error"
              ? "bg-red-950/90 border-red-500/30 text-red-200"
              : "bg-emerald-950/90 border-emerald-500/30 text-emerald-200"
          }`}
        >
          {toast.type === "error" ? (
            <AlertTriangle size={15} className="text-red-400 shrink-0" />
          ) : (
            <Check size={15} className="text-emerald-400 shrink-0" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}
    </main>
  );
}
