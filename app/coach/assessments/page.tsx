"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileText,
  Star,
  Edit3,
  Trash2,
  Send,
  Copy,
  X,
  Search,
  Check,
} from "lucide-react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { Skeleton } from "@/components/ui/skeleton";
import { AssessmentTemplate } from "@/types/assessment";
import HeaderIconButton from "@/components/layout/HeaderIconButton";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  status: string;
}

export default function AssessmentsPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  // Modal envoyer
  const [sendModal, setSendModal] = useState<AssessmentTemplate | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [sendEmail, setSendEmail] = useState(true);
  const [bilanDate, setBilanDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [sending, setSending] = useState(false);
  const [sentUrl, setSentUrl] = useState<string | null>(null);

  const topBarLeft = useMemo(
    () => (
      <div>
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">
          Espace Coach
        </p>
        <p className="text-[13px] font-semibold text-white leading-none">
          Bilans & Templates
        </p>
      </div>
    ),
    [],
  );

  const topBarRight = useMemo(
    () => (
      <HeaderIconButton
        onClick={() => router.push("/coach/assessments/templates/new")}
        icon={<Plus size={13} />}
        label="Nouveau template de bilan"
        variant="accent"
      />
    ),
    [router],
  );

  useSetTopBar(topBarLeft, topBarRight);

  useEffect(() => {
    fetch("/api/assessments/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id);
    setDeleteTarget(null);
    await fetch(`/api/assessments/templates/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    setDeleting(null);
  }

  async function handleDuplicate(id: string) {
    setDuplicating(id);
    const res = await fetch(`/api/assessments/templates/${id}`, {
      method: "POST",
    });
    if (res.ok) {
      const d = await res.json();
      setTemplates((prev) => [d.template, ...prev]);
    }
    setDuplicating(null);
  }

  async function openSendModal(template: AssessmentTemplate) {
    setSendModal(template);
    setSentUrl(null);
    setSelectedClientId(null);
    setClientSearch("");
    setSendEmail(true);
    setBilanDate(new Date().toISOString().slice(0, 10));
    if (clients.length === 0) {
      setClientsLoading(true);
      const res = await fetch("/api/clients");
      const d = await res.json();
      setClients(
        (d.clients ?? []).filter((c: Client) => c.status === "active"),
      );
      setClientsLoading(false);
    }
  }

  async function handleSend() {
    if (!sendModal || !selectedClientId) return;
    setSending(true);
    const res = await fetch("/api/assessments/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: selectedClientId,
        template_id: sendModal.id,
        filled_by: "client",
        send_email: sendEmail,
        bilan_date: bilanDate,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      setSentUrl(d.bilan_url);
    }
    setSending(false);
  }

  const filteredClients = clients.filter((c) =>
    `${c.first_name} ${c.last_name}`
      .toLowerCase()
      .includes(clientSearch.toLowerCase()),
  );

  return (
    <main className="min-h-screen bg-[#121212] font-sans">
      <div className="p-8 max-w-3xl mx-auto">
        {loading ? (
          <div className="min-h-screen bg-[#121212] -mx-8 -my-8 px-8 py-8">
            <div className="max-w-3xl mx-auto flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-[#181818] border-subtle rounded-xl px-5 py-4 flex items-center gap-4"
                >
                  <Skeleton className="w-5 h-5 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-2xl p-16 text-center">
            <FileText size={40} className="text-white/20 mx-auto mb-4" />
            <p className="font-bold text-white mb-1">Aucun template créé</p>
            <p className="text-sm text-white/60 mb-6">
              Créez votre premier modèle de bilan client
            </p>
            <button
              onClick={() => router.push("/coach/assessments/templates/new")}
              className="bg-[#1f8a65] text-white text-[12px] font-bold uppercase tracking-[0.12em] px-5 py-2.5 rounded-xl hover:bg-[#217356] transition-colors active:scale-[0.99]"
            >
              Créer un template
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className="bg-white/[0.02] border-subtle rounded-xl px-5 py-4 flex items-center gap-4 hover:bg-white/[0.03] transition-colors"
              >
                <FileText size={20} className="text-white/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white truncate">
                      {t.name}
                    </span>
                    {t.is_default && (
                      <Star
                        size={13}
                        className="text-[#1f8a65] fill-[#1f8a65] shrink-0"
                      />
                    )}
                    {t.system_key && (
                      <span className="rounded-full bg-[#1f8a65]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#1f8a65]">
                        Recommandé par STRYV
                      </span>
                    )}
                    <span className="text-[10px] bg-white/[0.04] rounded-full px-2 py-0.5 text-white/60">
                      {t.template_type}
                    </span>
                  </div>
                  {t.description && (
                    <p className="text-sm text-white/60 truncate mt-0.5">
                      {t.description}
                    </p>
                  )}
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {t.blocks?.length ?? 0} bloc(s)
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openSendModal(t)}
                    className="w-9 h-9 rounded-lg bg-white/[0.03] border-button flex items-center justify-center text-white/55 hover:text-[#1f8a65] transition-colors"
                    title="Envoyer à un client"
                  >
                    <Send size={14} />
                  </button>
                  <button
                    onClick={() => handleDuplicate(t.id)}
                    disabled={duplicating === t.id}
                    className="w-9 h-9 rounded-lg bg-white/[0.03] border-button flex items-center justify-center text-white/55 hover:text-white transition-colors disabled:opacity-40"
                    title="Dupliquer"
                  >
                    <Copy size={14} />
                  </button>
                  {!t.system_key && (
                    <>
                      <button
                        onClick={() =>
                          router.push(`/coach/assessments/templates/${t.id}/edit`)
                        }
                        className="w-9 h-9 rounded-lg bg-white/[0.03] border-button flex items-center justify-center text-white/55 hover:text-[#1f8a65] transition-colors"
                        title="Modifier"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: t.id, name: t.name })}
                        disabled={deleting === t.id}
                        className="w-9 h-9 rounded-lg bg-white/[0.03] border-button flex items-center justify-center text-white/55 hover:text-red-500 transition-colors disabled:opacity-40"
                        title="Supprimer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal — Envoyer à un client */}
      {sendModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#181818] border-subtle rounded-2xl w-full max-w-md flex flex-col max-h-[85vh]">
            {/* Header modal */}
            <div className="flex items-center justify-between px-5 py-4 shrink-0">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  Envoyer le bilan
                </p>
                <p className="font-semibold text-white truncate">
                  {sendModal.name}
                </p>
              </div>
              <button
                onClick={() => setSendModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/55 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {sentUrl ? (
              /* État post-envoi */
              <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-[#1f4637] flex items-center justify-center">
                  <Check size={22} className="text-[#1f8a65]" />
                </div>
                <p className="font-semibold text-white">Bilan envoyé !</p>
                <p className="text-[11px] text-white/60">
                  Lien de remplissage :
                </p>
                <div className="w-full bg-[#0a0a0a] rounded-xl px-3 py-2 text-[11px] text-[#1f8a65] font-mono break-all select-all">
                  {sentUrl}
                </div>
                <div className="flex gap-2 w-full mt-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(sentUrl)}
                    className="flex-1 text-[12px] font-bold bg-white/[0.03] rounded-lg px-4 py-2 text-white/60 hover:text-white transition-colors"
                  >
                    Copier le lien
                  </button>
                  <button
                    onClick={() => setSendModal(null)}
                    className="flex-1 text-[12px] font-bold bg-[#1f8a65] text-white rounded-lg px-4 py-2 hover:bg-[#217356] transition-colors active:scale-[0.99]"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Recherche clients */}
                <div className="px-5 pt-4 pb-2 shrink-0">
                  <div className="flex items-center gap-2 bg-[#0a0a0a] border-input rounded-xl px-3 py-2">
                    <Search size={14} className="text-white/40 shrink-0" />
                    <input
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Rechercher un client…"
                      className="flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/20"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Liste clients */}
                <div className="flex-1 overflow-y-auto px-5 pb-2">
                  {clientsLoading ? (
                    <p className="text-[12px] text-white/60 text-center py-8">
                      Chargement…
                    </p>
                  ) : filteredClients.length === 0 ? (
                    <p className="text-[12px] text-white/60 text-center py-8">
                      Aucun client actif trouvé
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5 py-1">
                      {filteredClients.map((c) => (
                        <button
                          key={c.id}
                          onClick={() =>
                            setSelectedClientId(
                              c.id === selectedClientId ? null : c.id,
                            )
                          }
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            selectedClientId === c.id
                              ? "bg-[#1f4637] border-subtle"
                              : "bg-white/[0.03] border-subtle hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="w-7 h-7 rounded-full bg-[#1f8a65]/20 flex items-center justify-center text-[9px] font-bold text-[#1f8a65] shrink-0">
                            {c.first_name[0]}
                            {c.last_name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-white truncate">
                              {c.first_name} {c.last_name}
                            </p>
                            {c.email && (
                              <p className="text-[10px] text-white/40 truncate">
                                {c.email}
                              </p>
                            )}
                          </div>
                          {selectedClientId === c.id && (
                            <Check
                              size={14}
                              className="text-[#1f8a65] shrink-0"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Options + action */}
                <div className="px-5 py-4 shrink-0 flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-white/55 uppercase tracking-[0.12em]">
                      Date du bilan
                    </label>
                    <input
                      type="date"
                      value={bilanDate}
                      onChange={(e) => setBilanDate(e.target.value)}
                      className="bg-[#0a0a0a] border-input rounded-lg px-3 py-2 text-[13px] text-white outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-white/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="accent-[#1f8a65]"
                    />
                    Envoyer un email au client
                  </label>
                  <button
                    onClick={handleSend}
                    disabled={!selectedClientId || sending}
                    className="w-full flex items-center justify-center gap-2 bg-[#1f8a65] text-white font-bold text-[12px] uppercase tracking-[0.12em] px-4 py-2.5 rounded-lg hover:bg-[#217356] transition-colors disabled:opacity-40 active:scale-[0.99]"
                  >
                    <Send size={14} />
                    {sending ? "Envoi…" : "Envoyer"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-[#181818] border-subtle rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-white mb-2">
              Supprimer ce template ?
            </h3>
            <p className="text-[13px] text-white/60 mb-5">
              Le template{" "}
              <span className="font-medium text-white">
                "{deleteTarget.name}"
              </span>{" "}
              sera définitivement supprimé.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-lg bg-white/[0.03] text-[12px] text-white/60 hover:text-white transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={!!deleting}
                className="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-[12px] font-bold hover:bg-red-600 disabled:opacity-50 transition-colors active:scale-[0.99]"
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
