"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Trash2,
  Copy,
  RotateCcw,
  Pencil,
  Mail,
} from "lucide-react";
import { SubmissionWithClient } from "@/types/assessment";

interface Props {
  submissions: SubmissionWithClient[];
  clientId: string;
  templates: { id: string; name: string }[];
  onSend: (
    templateId: string,
    bilanDate: string,
    sendEmail: boolean,
  ) => Promise<void>;
  onDelete?: (submissionId: string) => void;
  onRenew?: (submission: SubmissionWithClient) => void;
  clientEmail?: string;
  sendModalOpen?: boolean;
  onSendModalClose?: () => void;
}

const STATUS_CONFIG = {
  pending: {
    label: "En attente",
    icon: Clock,
    color: "text-amber-600 bg-amber-600/10",
  },
  in_progress: {
    label: "En cours",
    icon: RefreshCw,
    color: "text-blue-400 bg-blue-400/10",
  },
  completed: {
    label: "Complété",
    icon: CheckCircle2,
    color: "text-[#1f8a65] bg-[#1f8a65]/10",
  },
  expired: {
    label: "Expiré",
    icon: AlertCircle,
    color: "text-white/40 bg-white/[0.03]",
  },
};

export default function SubmissionsList({
  submissions,
  clientId,
  templates,
  onSend,
  onDelete,
  onRenew,
  clientEmail,
  sendModalOpen,
  onSendModalClose,
}: Props) {
  const router = useRouter();
  const [localSendModal, setLocalSendModal] = useState(false);

  // Use controlled state from parent if provided, otherwise internal state
  const sendModal = sendModalOpen ?? localSendModal;
  function closeSendModal() {
    setLocalSendModal(false);
    onSendModalClose?.();
  }
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [bilanDate, setBilanDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [sendEmail, setSendEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SubmissionWithClient | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editingDateValue, setEditingDateValue] = useState("");
  const [localDates, setLocalDates] = useState<Record<string, string>>({});
  const [emailSentId, setEmailSentId] = useState<string | null>(null);

  async function handleSend() {
    if (!selectedTemplate) return;
    setSending(true);
    await onSend(selectedTemplate, bilanDate, sendEmail);
    setSending(false);
    closeSendModal();
    setSelectedTemplate("");
    setBilanDate(new Date().toISOString().slice(0, 10));
    setSendEmail(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/assessments/submissions/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onDelete?.(deleteTarget.id);
    }
    setDeleting(false);
    setDeleteTarget(null);
  }

  async function handleRenew(s: SubmissionWithClient) {
    setActionLoading(s.id);
    const res = await fetch(`/api/assessments/submissions/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ renew_token: true }),
    });
    const d = await res.json();
    if (d.submission) {
      onRenew?.(d.submission);
      if (d.bilan_url) {
        navigator.clipboard.writeText(d.bilan_url).catch(() => {});
        alert(`Nouveau lien copié :\n${d.bilan_url}`);
      }
    }
    setActionLoading(null);
  }

  async function saveDate(submissionId: string) {
    if (!editingDateValue) {
      setEditingDateId(null);
      return;
    }
    await fetch(`/api/assessments/submissions/${submissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bilan_date: editingDateValue }),
    });
    setLocalDates((prev) => ({ ...prev, [submissionId]: editingDateValue }));
    setEditingDateId(null);
  }

  async function handleSendEmail(s: SubmissionWithClient) {
    if (!clientEmail) return;
    setActionLoading(s.id);
    await fetch(`/api/assessments/submissions/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ send_email: true }),
    });
    setEmailSentId(s.id);
    setTimeout(() => setEmailSentId(null), 2500);
    setActionLoading(null);
  }

  function handleCopyLink(s: SubmissionWithClient & { token?: string }) {
    const token = s.token;
    if (!token) return;
    const url = `${window.location.origin}/bilan/${token}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Bilans envoyés</h3>
        {/* Button shown inline only when parent doesn't control via TopBar */}
        {!onSendModalClose && (
          <button
            onClick={() => {
              setLocalSendModal(true);
              setBilanDate(new Date().toISOString().slice(0, 10));
              setSendEmail(false);
            }}
            className="flex items-center gap-2 bg-[#1f8a65] text-white text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-2 rounded-lg hover:bg-[#217356] transition-colors active:scale-[0.99]"
          >
            <Send size={13} />
            Envoyer
          </button>
        )}
      </div>

      {submissions.length === 0 ? (
        <p className="text-[12px] text-white/60 text-center py-8">
          Aucun bilan envoyé
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {submissions.map((s) => {
            const config =
              STATUS_CONFIG[s.status as keyof typeof STATUS_CONFIG] ??
              STATUS_CONFIG.pending;
            const Icon = config.icon;
            const isExpired = s.status === "expired";
            const hasLink =
              s.status === "pending" || s.status === "in_progress";
            const isLoadingAction = actionLoading === s.id;
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.05] rounded-lg px-4 py-3 transition-colors"
              >
                <div
                  className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${config.color}`}
                >
                  <Icon size={12} />
                  {config.label}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-white truncate">
                    {s.template?.name ?? "Template supprimé"}
                  </p>
                  {editingDateId === s.id ? (
                    <input
                      type="date"
                      value={editingDateValue}
                      onChange={(e) => setEditingDateValue(e.target.value)}
                      onBlur={() => saveDate(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveDate(s.id);
                        if (e.key === "Escape") setEditingDateId(null);
                      }}
                      autoFocus
                      className="text-[11px] bg-[#0a0a0a] rounded-lg px-1.5 py-0.5 outline-none text-white"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditingDateId(s.id);
                        setEditingDateValue(
                          localDates[s.id] ??
                            s.bilan_date ??
                            s.created_at.slice(0, 10),
                        );
                      }}
                      className="flex items-center gap-1 text-[11px] text-white/60 hover:text-[#1f8a65] transition-colors group"
                      title="Modifier la date du bilan"
                    >
                      {new Date(
                        localDates[s.id] ?? s.bilan_date ?? s.created_at,
                      ).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      <Pencil
                        size={10}
                        className="opacity-0 group-hover:opacity-60 transition-opacity"
                      />
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {s.status === "completed" && (
                    <button
                      onClick={() =>
                        router.push(`/coach/clients/${clientId}/bilans/${s.id}`)
                      }
                      className="flex items-center gap-1 text-xs text-white/45 hover:text-accent transition-colors font-medium px-2 py-1 rounded"
                      title="Voir le bilan"
                    >
                      <Eye size={13} />
                      <span className="hidden sm:inline">Voir</span>
                    </button>
                  )}

                  {hasLink && (
                    <button
                      onClick={() =>
                        handleCopyLink(
                          s as SubmissionWithClient & { token?: string },
                        )
                      }
                      className="flex items-center gap-1 text-xs text-white/45 hover:text-accent transition-colors font-medium px-2 py-1 rounded"
                      title="Copier le lien"
                    >
                      <Copy size={13} />
                      <span className="hidden sm:inline">
                        {copiedId === s.id ? "Copié !" : "Lien"}
                      </span>
                    </button>
                  )}
                  {hasLink && clientEmail && (
                    <button
                      onClick={() => handleSendEmail(s)}
                      disabled={isLoadingAction}
                      className="flex items-center gap-1 text-xs text-white/45 hover:text-accent transition-colors font-medium px-2 py-1 rounded disabled:opacity-50"
                      title={`Envoyer par email à ${clientEmail}`}
                    >
                      <Mail size={13} />
                      <span className="hidden sm:inline">
                        {emailSentId === s.id ? "Envoyé !" : "Email"}
                      </span>
                    </button>
                  )}

                  {isExpired && (
                    <button
                      onClick={() => handleRenew(s)}
                      disabled={isLoadingAction}
                      className="flex items-center gap-1 text-xs text-white/45 hover:text-accent transition-colors font-medium px-2 py-1 rounded disabled:opacity-50"
                      title="Renvoyer (nouveau lien)"
                    >
                      <RotateCcw
                        size={13}
                        className={isLoadingAction ? "animate-spin" : ""}
                      />
                      <span className="hidden sm:inline">Renvoyer</span>
                    </button>
                  )}

                  <button
                    onClick={() => setDeleteTarget(s)}
                    className="flex items-center gap-1 text-xs text-white/45 hover:text-red-500 transition-colors font-medium px-2 py-1 rounded"
                    title="Supprimer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Send modal */}
      {sendModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-white mb-4">Envoyer un bilan</h3>
            {templates.length === 0 ? (
              <p className="text-sm text-white/45 mb-4 opacity-70">
                Aucun template disponible. Créez-en un d'abord.
              </p>
            ) : (
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full bg-white/[0.04] rounded-lg px-4 py-3 text-sm text-white mb-4 outline-none"
              >
                <option value="">Sélectionner un template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex flex-col gap-1 mb-4">
              <label className="text-xs font-bold text-white/45 uppercase tracking-widest">
                Date du bilan
              </label>
              <input
                type="date"
                value={bilanDate}
                onChange={(e) => setBilanDate(e.target.value)}
                className="w-full bg-white/[0.04] rounded-lg px-4 py-3 text-sm text-white outline-none"
              />
            </div>
            {clientEmail && (
              <label className="flex items-center gap-3 py-2 cursor-pointer group">
                <div
                  className={`w-10 h-6 rounded-full transition-colors relative ${sendEmail ? "bg-accent" : "bg-white/[0.04]"}`}
                  onClick={() => setSendEmail((v) => !v)}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${sendEmail ? "translate-x-5" : "translate-x-1"}`}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    Envoyer par email
                  </p>
                  <p className="text-xs text-white/45">{clientEmail}</p>
                </div>
              </label>
            )}
            {!clientEmail && (
              <p className="text-xs text-white/45 italic">
                Aucun email renseigné pour ce client — envoi par email
                indisponible.
              </p>
            )}
            <div className="flex gap-3 mt-2">
              <button
                onClick={closeSendModal}
                className="flex-1 py-2.5 rounded-lg bg-white/[0.04] text-sm text-white/45 hover:text-white transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleSend}
                disabled={!selectedTemplate || sending}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {sending
                  ? "Envoi…"
                  : sendEmail
                    ? "Envoyer + email"
                    : "Créer le lien"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] rounded-xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-white mb-2">Supprimer le bilan ?</h3>
            <p className="text-sm text-white/45 mb-5">
              Le bilan{" "}
              <span className="font-medium text-white">
                "{deleteTarget.template?.name ?? "sans nom"}"
              </span>{" "}
              sera supprimé définitivement, ainsi que toutes ses réponses.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-lg bg-white/[0.04] text-sm text-white/45 hover:text-white transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
