"use client";

import { useState, useEffect } from "react";
import {
  UserCheck, UserX, Mail, Loader2, CheckCircle2,
  ShieldOff, RefreshCw, ClipboardList, ArrowRight,
  Plus, X, BookOpen, Smartphone, KeyRound, Dumbbell, Utensils, ChartNoAxesCombined,
} from "lucide-react";
import { useRouter } from "next/navigation";
import ActionFeedbackBadge from "@/components/ui/ActionFeedbackBadge";
import useTimedActionFeedback from "@/components/ui/useTimedActionFeedback";
import useActionRequest from "@/components/ui/useActionRequest";
import { useCoachEntitlements } from "@/components/coach/useCoachEntitlements";
import PlanUpgradeCard from "@/components/coach/PlanUpgradeCard";

interface Props {
  clientId: string;
  clientStatus: string;
  clientEmail: string | null;
  /** Notifies the parent when access status changes (keeps top-bar CTA / border in sync). */
  onStatusChange?: (status: string) => void;
}

type Template = { id: string; name: string };

function GuideStep({
  icon: Icon,
  step,
  title,
  children,
}: {
  icon: typeof Mail;
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-white/55">
          <Icon size={15} />
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">{step}</p>
          <h3 className="mt-0.5 text-[12px] font-semibold text-white/80">{title}</h3>
        </div>
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-white/48">{children}</p>
    </div>
  );
}

export default function ClientAccessToken({ clientId, clientStatus, clientEmail, onStatusChange }: Props) {
  const router = useRouter();
  const { entitlements, loading: entitlementsLoading } = useCoachEntitlements();
  const [status, setStatus] = useState(clientStatus);

  function updateStatus(next: string) {
    setStatus(next);
    onStatusChange?.(next);
  }
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState(false);
  const [inviteMode, setInviteMode] = useState<"invited" | "access_link" | "reactivated" | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { feedback, pushFeedback } = useTimedActionFeedback<string>();
  const { runAction } = useActionRequest<string>({
    setLoadingKey: () => null,
    pushFeedback,
  });

  // Bilan modal
  const [showBilanModal, setShowBilanModal] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [sendingBilan, setSendingBilan] = useState<string | null>(null);
  const [bilanSent, setBilanSent] = useState<string | null>(null);

  useEffect(() => {
    if (!showBilanModal || templates.length > 0) return;
    setTemplatesLoading(true);
    fetch("/api/assessments/templates")
      .then(r => r.ok ? r.json() : { templates: [] })
      .then(d => setTemplates(d.templates ?? []))
      .finally(() => setTemplatesLoading(false));
  }, [showBilanModal, templates.length]);

  useEffect(() => {
    if (!showGuide) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowGuide(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showGuide]);

  async function sendInvitation() {
    setError(null);
    setInviting(true);
    await runAction({
      scope: "invite",
      loadingKey: "invite",
      loadingMessage: "Envoi en cours...",
      successMessage: "Lien envoyé",
      request: async () => {
        const res = await fetch(`/api/clients/${clientId}/invite`, { method: "POST" });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Erreur lors de l'envoi.");
        return d;
      },
      onSuccess: async (data) => {
        setInviteMode(data.mode ?? null);
        setInvited(true);
        updateStatus("active");
        setTimeout(() => {
          setInvited(false);
          setInviteMode(null);
        }, 4000);
      },
      getErrorMessage: (err) =>
        err instanceof Error ? err.message : "Erreur lors de l'envoi.",
    });
    setInviting(false);
  }

  async function revokeAccess() {
    setError(null);
    setRevoking(true);
    await runAction({
      scope: "revoke",
      loadingKey: "revoke",
      loadingMessage: "Suspension en cours...",
      successMessage: "Accès coupé",
      request: async () => {
        const res = await fetch(`/api/clients/${clientId}/access`, { method: "DELETE" });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Erreur lors de la révocation.");
        }
        return true;
      },
      onSuccess: async () => {
        updateStatus("suspended");
        setShowRevokeConfirm(false);
      },
      getErrorMessage: (err) =>
        err instanceof Error ? err.message : "Erreur lors de la révocation.",
    });
    setRevoking(false);
  }

  async function assignBilan(templateId: string) {
    setSendingBilan(templateId);
    await runAction({
      scope: `bilan-${templateId}`,
      loadingKey: `bilan-${templateId}`,
      loadingMessage: "Envoi du bilan...",
      successMessage: "Bilan envoyé",
      request: async () => {
        const res = await fetch("/api/assessments/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            template_id: templateId,
            filled_by: "client",
            send_email: true,
            bilan_date: new Date().toISOString().split("T")[0],
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          throw new Error(d?.error ?? "Envoi du bilan impossible.");
        }
        return true;
      },
      onSuccess: async () => {
        setBilanSent(templateId);
        setTimeout(() => { setShowBilanModal(false); setBilanSent(null); }, 2000);
      },
      getErrorMessage: (err) =>
        err instanceof Error ? err.message : "Envoi du bilan impossible.",
    });
    setSendingBilan(null);
  }

  const isActive = status === "active";
  const isSuspended = status === "suspended";
  const appEnabled = entitlements?.clientAppEnabled === true;
  const blockedReason =
    entitlements?.clientAppBlockedReason ??
    "Disponible à partir du plan Pro — active l’app client STRYVR pour vos athlètes.";

  if (!entitlementsLoading && !appEnabled) {
    return (
      <PlanUpgradeCard
        title="Accès application STRYVR"
        reason={blockedReason}
        ctaLabel={
          entitlements?.hasClientAppCapability
            ? "Réactiver mon abonnement"
            : "Passer en Pro"
        }
      />
    );
  }

  return (
    <>
      <div className="bg-[#181818] border-[0.3px] border-white/[0.06] rounded-xl p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <UserCheck size={15} className="text-[#1f8a65]" />
          <h3 className="font-semibold text-white text-sm">Accès à l&apos;application STRYVR</h3>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-haspopup="dialog"
              aria-label="Ouvrir le guide coach sur l'application STRYVR"
            >
              <BookOpen size={12} />
              Guide coach
            </button>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isActive
                ? "bg-[#1f8a65]/15 text-[#1f8a65]"
                : isSuspended
                ? "bg-amber-500/15 text-amber-400"
                : "bg-white/[0.06] text-white/40"
            }`}>
              {isActive ? "Actif" : isSuspended ? "Suspendu" : "Inactif"}
            </span>
          </div>
        </div>

        {!clientEmail ? (
          <p className="text-xs text-white/40">
            Ce client n&apos;a pas d&apos;adresse email. Ajoutez-en une pour l&apos;inviter.
          </p>
        ) : isActive ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-white/45">
              Le client a déjà accès à son espace STRYVR. Vous pouvez lui renvoyer un lien sécurisé de connexion à tout moment.
            </p>

            {/* Étape suivante — envoyer un bilan */}
            <button
              onClick={() => setShowBilanModal(true)}
              className="group flex h-[46px] w-full items-center justify-between rounded-xl bg-white/[0.04] hover:bg-white/[0.07] pl-4 pr-1.5 transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-2.5">
                <ClipboardList size={14} className="text-[#1f8a65]" />
                <span className="text-[12px] font-bold uppercase tracking-[0.10em] text-white/70 group-hover:text-white transition-colors">
                  Envoyer un bilan
                </span>
              </div>
              <div className="flex h-[36px] w-[36px] items-center justify-center rounded-lg bg-white/[0.04]">
                <ArrowRight size={14} className="text-white/40 group-hover:text-white/70 transition-colors" />
              </div>
            </button>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => void sendInvitation()}
                disabled={inviting}
                className="flex items-center gap-1.5 text-xs font-semibold text-white/55 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {inviting ? <Loader2 size={12} className="animate-spin" /> : invited ? <CheckCircle2 size={12} /> : <Mail size={12} />}
                {inviting ? "Envoi…" : invited ? "Lien envoyé !" : "Envoyer un lien de connexion"}
              </button>
              <button
                onClick={() => setShowRevokeConfirm(true)}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-white/[0.04] hover:bg-white/[0.08] px-4 py-2 rounded-lg transition-colors ml-auto"
              >
                <ShieldOff size={12} />
                Couper l&apos;accès
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-white/45">
              {isSuspended
                ? "L'accès de ce client a été suspendu. Vous pouvez le restaurer et lui renvoyer un accès immédiatement."
                : "Ce client n'a pas encore activé son espace STRYVR. Envoyez-lui l'email de premier accès pour qu'il crée son mot de passe."}
            </p>
            <button
              onClick={() => void sendInvitation()}
              disabled={inviting || invited}
              className="group flex h-[46px] w-full items-center justify-between rounded-xl bg-[#1f8a65] pl-4 pr-1.5 transition-all hover:bg-[#217356] active:scale-[0.99] disabled:opacity-60"
            >
              <span className="text-[12px] font-bold uppercase tracking-[0.10em] text-white">
                {inviting ? "Envoi en cours…" : invited
                  ? (inviteMode === "reactivated" ? "Accès restauré !" : inviteMode === "access_link" ? "Lien envoyé !" : "Invitation envoyée !")
                  : isSuspended ? "Restaurer l'accès" : "Envoyer l'invitation"}
              </span>
              <div className="flex h-[36px] w-[36px] items-center justify-center rounded-lg bg-black/[0.15]">
                {inviting ? <Loader2 size={15} className="text-white animate-spin" />
                  : invited ? <CheckCircle2 size={15} className="text-white" />
                  : isSuspended ? <RefreshCw size={15} className="text-white" />
                  : <Mail size={15} className="text-white" />}
              </div>
            </button>
          </div>
        )}

        {feedback ? (
          <div className="mt-3">
            <ActionFeedbackBadge tone={feedback.tone} message={feedback.message} />
          </div>
        ) : null}
        {!feedback && error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}
      </div>

      {showGuide && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stryvr-guide-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowGuide(false);
          }}
        >
          <div className="max-h-[min(720px,calc(100dvh-2rem))] w-full max-w-2xl overflow-y-auto rounded-2xl border-[0.3px] border-white/[0.08] bg-[#181818] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-barlow-condensed text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  Guide coach · STRYVR
                </p>
                <h2 id="stryvr-guide-title" className="mt-1 text-lg font-semibold text-white">
                  Préparer votre client à son espace
                </h2>
                <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-white/50">
                  Un repère simple pour expliquer le parcours à votre client et l&apos;aider à démarrer sereinement.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg p-1.5 text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                aria-label="Fermer le guide coach"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <GuideStep icon={Mail} step="01" title="Réception de l&apos;invitation">
                Le client reçoit un email d&apos;accès sécurisé. Il ouvre le lien depuis l&apos;adresse email renseignée sur sa fiche.
              </GuideStep>
              <GuideStep icon={KeyRound} step="02" title="Création de son accès">
                Il choisit sa langue, crée son mot de passe, puis découvre en quelques écrans le fonctionnement de l&apos;application.
              </GuideStep>
              <GuideStep icon={Smartphone} step="03" title="Installation et rappels">
                Si les check-ins sont activés, STRYVR lui propose d&apos;installer l&apos;app et de choisir ses horaires de rappels.
              </GuideStep>
              <GuideStep icon={Dumbbell} step="04" title="Programme et exécution">
                Il retrouve ses séances, suit les exercices prescrits et enregistre ses séries, charges et ressentis.
              </GuideStep>
              <GuideStep icon={Utensils} step="05" title="Nutrition au quotidien">
                Il consulte ses objectifs du jour et peut enregistrer ses repas lorsque vous avez prévu un suivi nutritionnel.
              </GuideStep>
              <GuideStep icon={ChartNoAxesCombined} step="06" title="Suivi partagé">
                Check-ins, bilans, métriques et échanges alimentent le suivi ; vous gardez le contexte pour ajuster la suite.
              </GuideStep>
            </div>

            <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">À dire au client</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-white/65">
                « Ouvre l&apos;invitation, crée ton accès et prends quelques minutes pour parcourir l&apos;application. Commence ensuite par ce que nous avons mis en place pour toi : séance, nutrition ou check-in. »
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg bg-white/[0.08] px-3 py-2 text-[11px] font-semibold text-white/75 transition-colors hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                J&apos;ai compris
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal bilan ── */}
      {showBilanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border-[0.3px] border-white/[0.06] rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Envoyer un bilan</h3>
              <button onClick={() => setShowBilanModal(false)} className="text-white/30 hover:text-white/60 transition-colors">
                <X size={16} />
              </button>
            </div>

            {templatesLoading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-11 rounded-xl bg-white/[0.03] animate-pulse" />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-[12px] text-white/45">
                  Vous n&apos;avez pas encore créé de modèle de bilan.
                </p>
                <button
                  onClick={() => { setShowBilanModal(false); router.push("/coach/assessments"); }}
                  className="group flex h-[46px] w-full items-center justify-between rounded-xl bg-[#1f8a65] pl-4 pr-1.5 transition-all hover:bg-[#217356] active:scale-[0.99]"
                >
                  <span className="text-[12px] font-bold uppercase tracking-[0.10em] text-white">Créer un bilan</span>
                  <div className="flex h-[36px] w-[36px] items-center justify-center rounded-lg bg-black/[0.15]">
                    <Plus size={15} className="text-white" />
                  </div>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-white/35 uppercase tracking-[0.14em] font-semibold">Choisir un modèle</p>
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => void assignBilan(t.id)}
                    disabled={!!sendingBilan || !!bilanSent}
                    className="group flex h-11 w-full items-center justify-between rounded-xl bg-white/[0.03] hover:bg-white/[0.07] px-3 transition-colors disabled:opacity-50"
                  >
                    <span className="text-[13px] text-white/80 group-hover:text-white font-medium transition-colors">{t.name}</span>
                    <span className="shrink-0">
                      {sendingBilan === t.id
                        ? <Loader2 size={14} className="text-white/40 animate-spin" />
                        : bilanSent === t.id
                        ? <CheckCircle2 size={14} className="text-[#1f8a65]" />
                        : <ArrowRight size={14} className="text-white/20 group-hover:text-white/50 transition-colors" />}
                    </span>
                  </button>
                ))}
                <div className="h-px bg-white/[0.05] my-1" />
                <button
                  onClick={() => { setShowBilanModal(false); router.push("/coach/assessments"); }}
                  className="flex items-center gap-2 text-[11px] text-white/35 hover:text-white/60 transition-colors py-1"
                >
                  <Plus size={12} />
                  Créer un nouveau modèle
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal révocation ── */}
      {showRevokeConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border-[0.3px] border-white/[0.06] rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-3">
              <UserX size={18} className="text-red-400" />
              <h3 className="font-bold text-white">Couper l&apos;accès client ?</h3>
            </div>
            <p className="text-sm text-white/50 mb-5">
              Le client sera déconnecté et ne pourra plus accéder à son espace. Vous pourrez le réactiver à tout moment.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRevokeConfirm(false)}
                className="flex-1 py-2.5 rounded-lg bg-white/[0.04] text-sm text-white/50 hover:text-white transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={() => void revokeAccess()}
                disabled={revoking}
                className="flex-1 py-2.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-50 transition-colors"
              >
                {revoking ? "Suspension…" : "Couper l'accès"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
