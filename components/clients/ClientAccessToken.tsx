"use client";

import { useState, useEffect } from "react";
import {
  UserCheck, UserX, Mail, Loader2, CheckCircle2,
  ShieldOff, RefreshCw, ClipboardList, ArrowRight,
  Plus, X,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  clientId: string;
  clientStatus: string;
  clientEmail: string | null;
  /** Notifies the parent when access status changes (keeps top-bar CTA / border in sync). */
  onStatusChange?: (status: string) => void;
}

type Template = { id: string; name: string };

export default function ClientAccessToken({ clientId, clientStatus, clientEmail, onStatusChange }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(clientStatus);

  function updateStatus(next: string) {
    setStatus(next);
    onStatusChange?.(next);
  }
  const [inviting, setInviting] = useState(false);
  const [invited, setInvited] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function sendInvitation() {
    setInviting(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/invite`, { method: "POST" });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? "Erreur lors de l'envoi.");
    } else {
      setInvited(true);
      updateStatus("active");
      setTimeout(() => setInvited(false), 4000);
    }
    setInviting(false);
  }

  async function revokeAccess() {
    setRevoking(true);
    setError(null);
    const res = await fetch(`/api/clients/${clientId}/access`, { method: "DELETE" });
    if (res.ok) {
      updateStatus("suspended");
    } else {
      const d = await res.json();
      setError(d.error ?? "Erreur lors de la révocation.");
    }
    setRevoking(false);
    setShowRevokeConfirm(false);
  }

  async function assignBilan(templateId: string) {
    setSendingBilan(templateId);
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
    if (res.ok) {
      setBilanSent(templateId);
      setTimeout(() => { setShowBilanModal(false); setBilanSent(null); }, 2000);
    }
    setSendingBilan(null);
  }

  const isActive = status === "active";
  const isSuspended = status === "suspended";

  return (
    <>
      <div className="bg-[#181818] border-[0.3px] border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserCheck size={15} className="text-[#1f8a65]" />
          <h3 className="font-semibold text-white text-sm">Accès client</h3>
          <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isActive
              ? "bg-[#1f8a65]/15 text-[#1f8a65]"
              : isSuspended
              ? "bg-amber-500/15 text-amber-400"
              : "bg-white/[0.06] text-white/40"
          }`}>
            {isActive ? "Actif" : isSuspended ? "Suspendu" : "Inactif"}
          </span>
        </div>

        {!clientEmail ? (
          <p className="text-xs text-white/40">
            Ce client n&apos;a pas d&apos;adresse email. Ajoutez-en une pour l&apos;inviter.
          </p>
        ) : isActive ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-white/45">
              Le client a accès à son espace STRYV. Il peut se connecter avec son email et son mot de passe.
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
                {inviting ? "Envoi…" : invited ? "Invitation envoyée !" : "Renvoyer l'invitation"}
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
                ? "L'accès de ce client a été suspendu. Vous pouvez le réactiver à tout moment."
                : "Ce client n'a pas encore accès à son espace. Envoyez-lui une invitation pour qu'il crée son mot de passe."}
            </p>
            <button
              onClick={() => void sendInvitation()}
              disabled={inviting || invited}
              className="group flex h-[46px] w-full items-center justify-between rounded-xl bg-[#1f8a65] pl-4 pr-1.5 transition-all hover:bg-[#217356] active:scale-[0.99] disabled:opacity-60"
            >
              <span className="text-[12px] font-bold uppercase tracking-[0.10em] text-white">
                {inviting ? "Envoi en cours…" : invited
                  ? (isSuspended ? "Accès restauré !" : "Invitation envoyée !")
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

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </div>

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
