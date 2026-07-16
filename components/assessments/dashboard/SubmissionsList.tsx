"use client";

import { useEffect, useState } from "react";
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
  CalendarClock,
  Pause,
  Play,
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

type AssessmentAutomation = {
  id: string;
  template_id: string;
  status: "active" | "paused";
  day_of_week: number;
  send_time: string;
  timezone: string;
  next_run_at: string;
  template?: { id: string; name: string };
};

const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

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
  const [automations, setAutomations] = useState<AssessmentAutomation[]>([]);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [automationDay, setAutomationDay] = useState(1);
  const [automationTime, setAutomationTime] = useState("09:00");
  const [automationSaving, setAutomationSaving] = useState(false);

  async function loadAutomations() {
    const res = await fetch(`/api/assessments/automations?client_id=${clientId}`);
    if (res.ok) setAutomations((await res.json()).automations ?? []);
  }

  useEffect(() => {
    void loadAutomations();
  }, [clientId]);

  async function handleSend() {
    if (!selectedTemplate) return;
    setSending(true);
    await onSend(selectedTemplate, bilanDate, sendEmail);
    if (automationEnabled) {
      setAutomationSaving(true);
      const res = await fetch("/api/assessments/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          template_id: selectedTemplate,
          day_of_week: automationDay,
          send_time: automationTime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          starts_on: bilanDate,
        }),
      });
      if (res.ok) await loadAutomations();
      setAutomationSaving(false);
    }
    setSending(false);
    closeSendModal();
    setSelectedTemplate("");
    setBilanDate(new Date().toISOString().slice(0, 10));
    setSendEmail(false);
    setAutomationEnabled(false);
  }

  async function updateAutomation(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/assessments/automations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) await loadAutomations();
  }

  async function deleteAutomation(id: string) {
    const res = await fetch(`/api/assessments/automations/${id}`, { method: "DELETE" });
    if (res.ok) setAutomations((prev) => prev.filter((automation) => automation.id !== id));
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
                  {automations.some((automation) => automation.template_id === s.template_id) && (
                    <button
                      onClick={() => document.getElementById("assessment-automations")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      className="flex items-center gap-1 text-[10px] text-[#1f8a65] px-2 py-1"
                      title="Une automatisation est configurée pour ce template"
                    >
                      <CalendarClock size={13} />
                      <span className="hidden lg:inline">Gérer</span>
                    </button>
                  )}
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

      {automations.length > 0 && (
        <div id="assessment-automations" className="mt-5 rounded-xl border-subtle bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-[12px] font-semibold text-white">Automatisations</h4>
              <p className="text-[11px] text-white/40">Bilans récurrents pour ce client</p>
            </div>
            <CalendarClock size={16} className="text-[#1f8a65]" />
          </div>
          <div className="flex flex-col gap-2">
            {automations.map((automation) => (
              <div key={automation.id} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-white truncate">{automation.template?.name ?? "Bilan"}</p>
                  <p className="text-[11px] text-white/45">
                    Chaque semaine, {WEEKDAYS[automation.day_of_week]} à {automation.send_time.slice(0, 5)} · prochaine échéance {new Date(automation.next_run_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold ${automation.status === "active" ? "text-[#1f8a65]" : "text-amber-500"}`}>
                  {automation.status === "active" ? "Active" : "En pause"}
                </span>
                <button
                  onClick={() => updateAutomation(automation.id, { status: automation.status === "active" ? "paused" : "active" })}
                  className="w-7 h-7 rounded-md text-white/45 hover:text-white flex items-center justify-center"
                  title={automation.status === "active" ? "Mettre en pause" : "Réactiver"}
                >
                  {automation.status === "active" ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <button onClick={() => deleteAutomation(automation.id)} className="text-[11px] text-white/40 hover:text-red-400 px-1" title="Supprimer">Supprimer</button>
              </div>
            ))}
          </div>
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
            <p className="text-xs text-white/45 mb-3">
              L’envoi dans l’application client est automatique. L’email est optionnel.
            </p>
            <div className="rounded-xl border-subtle bg-white/[0.02] p-3 mb-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={automationEnabled}
                  onChange={(e) => setAutomationEnabled(e.target.checked)}
                  className="accent-[#1f8a65]"
                />
                <div>
                  <p className="text-sm font-medium text-white">Automatiser les prochains bilans</p>
                  <p className="text-xs text-white/45">Créer un bilan chaque semaine pour ce client</p>
                </div>
              </label>
              {automationEnabled && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <select value={automationDay} onChange={(e) => setAutomationDay(Number(e.target.value))} className="bg-white/[0.04] rounded-lg px-3 py-2 text-xs text-white outline-none">
                    {WEEKDAYS.slice(1).concat(WEEKDAYS[0]).map((label, index) => {
                      const day = index === 6 ? 0 : index + 1;
                      return <option key={day} value={day}>{label}</option>;
                    })}
                  </select>
                  <input type="time" value={automationTime} onChange={(e) => setAutomationTime(e.target.value)} className="bg-white/[0.04] rounded-lg px-3 py-2 text-xs text-white outline-none" />
                </div>
              )}
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
                Aucun email renseigné pour ce client — l’envoi par email est indisponible,
                mais le bilan sera bien envoyé dans l’application.
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
                disabled={!selectedTemplate || sending || automationSaving}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {sending
                  ? "Envoi…"
                  : sendEmail
                    ? "Envoyer app + email"
                    : "Envoyer dans l’app"}
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
