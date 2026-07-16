"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Download, Loader2, Mail, Send, Share2, User, Users, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type RecipientOption = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
};

interface Props {
  mode: "program" | "template" | "nutrition-protocol";
  entityId: string;
  title: string;
  programClient?: {
    firstName: string;
    lastName: string;
    email?: string | null;
  } | null;
  onClose: () => void;
}

export default function ProgramPdfModal({
  mode,
  entityId,
  title,
  programClient,
  onClose,
}: Props) {
  const [view, setView] = useState<"preview" | "share">("preview");
  const [clients, setClients] = useState<RecipientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [includeTracking, setIncludeTracking] = useState(false);

  const basePath = mode === "program"
    ? `/api/programs/${entityId}/pdf`
    : mode === "template"
      ? `/api/program-templates/${entityId}/pdf`
      : `/api/clients/nutrition-protocols/${entityId}/pdf`;
  const pdfParams = new URLSearchParams({
    t: entityId,
    ...(includeTracking ? { tracking: "1" } : {}),
  });
  const downloadParams = new URLSearchParams({
    download: "1",
    t: entityId,
    ...(includeTracking ? { tracking: "1" } : {}),
  });
  const previewUrl = `${basePath}?${pdfParams.toString()}`;
  const downloadUrl = `${basePath}?${downloadParams.toString()}`;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewBlobUrl(null);

    fetch(previewUrl, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/pdf",
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Impossible de générer le PDF");
        }

        const blob = await res.blob();
        if (!blob.size || !blob.type.includes("pdf")) {
          throw new Error("Le fichier PDF généré est invalide");
        }

        objectUrl = URL.createObjectURL(blob);
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        setPreviewBlobUrl(objectUrl);
      })
      .catch((err: any) => {
        if (!active) return;
        setPreviewError(err.message ?? "Impossible de charger la prévisualisation");
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (view !== "share" || mode !== "template" || clients.length > 0) return;

    let active = true;
    setClientsLoading(true);
    setError(null);

    fetch("/api/clients")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!active) return;
        if (!ok) throw new Error(data.error ?? "Impossible de charger les clients");
        setClients(data.clients ?? []);
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err.message ?? "Impossible de charger les clients");
      })
      .finally(() => {
        if (active) setClientsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [view, mode, clients.length]);

  const validTemplateClients = useMemo(
    () => clients.filter((client) => client.email),
    [clients],
  );

  const canShareProgram = (mode === "program" || mode === "nutrition-protocol") && !!programClient?.email;
  const canShareTemplate = mode === "template" && selectedClientIds.length > 0;
  const canSend = mode === "template" ? canShareTemplate : canShareProgram;

  function toggleClient(id: string) {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  }

  async function handleShare() {
    if (!canSend) return;

    setSharing(true);
    setError(null);
    setFeedback(null);

    try {
      const payload =
        mode === "program" || mode === "nutrition-protocol"
          ? { message, includeTracking }
          : { message, clientIds: selectedClientIds, includeTracking };

      const res = await fetch(`${basePath}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.error ?? "Envoi impossible");

      if (mode === "program" || mode === "nutrition-protocol") {
        setFeedback("PDF envoyé au client.");
      } else if (data.partial) {
        setFeedback(`${data.sent} envoi(s) réussi(s), ${data.failed} échec(s).`);
      } else {
        setFeedback(`PDF envoyé à ${data.sent} client(s).`);
      }
    } catch (err: any) {
      setError(err.message ?? "Envoi impossible");
    } finally {
      setSharing(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    setError(null);

    try {
      const res = await fetch(downloadUrl, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/pdf",
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Téléchargement impossible");
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${title || "programme"}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      setError(err.message ?? "Téléchargement impossible");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="flex h-[88vh] w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#111111] shadow-2xl">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                Export PDF
              </p>
              <h2 className="mt-1 text-[15px] font-semibold text-white">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 bg-[#0d0d0d] p-4">
            <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#f5f5f5]">
              {previewBlobUrl ? (
                <iframe
                  key={previewUrl}
                  title={`Prévisualisation PDF ${title}`}
                  src={`${previewBlobUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                  className="h-full w-full bg-[#f5f5f5]"
                />
              ) : null}

              {previewLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white text-[#111111]">
                  <Loader2 size={24} className="animate-spin" />
                  <p className="text-sm font-medium">Génération de la prévisualisation PDF…</p>
                </div>
              ) : null}

              {!previewLoading && previewError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white px-6 text-center text-[#111111]">
                  <p className="text-sm font-semibold">Prévisualisation indisponible</p>
                  <p className="max-w-md text-sm text-black/65">{previewError}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="text-xs text-white/45">
                {view === "preview"
                  ? "Prévisualisation du rendu final du PDF."
                  : "Préparez l’envoi e-mail avec pièce jointe PDF."}
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white/70 transition-colors hover:bg-white/[0.05]">
                <input
                  type="checkbox"
                  checked={includeTracking}
                  onChange={(event) => setIncludeTracking(event.target.checked)}
                  className="h-4 w-4 accent-[#1f8a65]"
                />
                <ClipboardList size={14} />
                Inclure carnet de suivi
              </label>
            </div>
            <div className="flex items-center gap-2">
              {view === "share" ? (
                <button
                  onClick={() => setView("preview")}
                  className="rounded-xl bg-white/[0.04] px-4 py-2 text-[12px] font-semibold text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                >
                  Retour
                </button>
              ) : null}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-white/[0.1]"
              >
                {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Télécharger
              </button>
              <button
                onClick={() => {
                  setView("share");
                  setFeedback(null);
                  setError(null);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1f8a65] px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#217356]"
              >
                <Share2 size={14} />
                Partager
              </button>
            </div>
          </div>
        </div>

        {view === "share" ? (
          <aside className="flex w-[360px] shrink-0 flex-col border-l border-white/[0.06] bg-[#151515]">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                Partage e-mail
              </p>
              <h3 className="mt-1 text-sm font-semibold text-white">
                {mode === "program" ? "Destinataire direct" : "Sélection des clients"}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {mode === "program" ? (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="mb-2 flex items-center gap-2 text-white">
                    <User size={14} />
                    <span className="text-sm font-semibold">
                      {`${programClient?.firstName ?? ""} ${programClient?.lastName ?? ""}`.trim() || "Client"}
                    </span>
                  </div>
                  <p className="text-xs text-white/55">{programClient?.email ?? "Aucun email renseigné"}</p>
                  {!programClient?.email ? (
                    <p className="mt-3 text-xs text-[#fca5a5]">
                      Impossible d’envoyer le PDF tant que l’adresse email du client n’est pas renseignée.
                    </p>
                  ) : null}
                </div>
              ) : clientsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((index) => (
                    <Skeleton key={index} className="h-16 w-full rounded-2xl" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {validTemplateClients.length === 0 ? (
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/55">
                      Aucun client avec email valide n’est disponible.
                    </div>
                  ) : (
                    validTemplateClients.map((client) => {
                      const checked = selectedClientIds.includes(client.id);
                      return (
                        <button
                          key={client.id}
                          onClick={() => toggleClient(client.id)}
                          className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors ${
                            checked
                              ? "border-[#1f8a65]/60 bg-[#1f8a65]/10"
                              : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]"
                          }`}
                        >
                          <div
                            className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border text-[10px] font-bold ${
                              checked
                                ? "border-[#7fe2bf] bg-[#1f8a65] text-white"
                                : "border-white/[0.12] text-white/45"
                            }`}
                          >
                            {checked ? "✓" : ""}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {client.first_name} {client.last_name}
                            </p>
                            <p className="truncate text-xs text-white/50">{client.email}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              <div className="mt-5">
                <label className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                  <Mail size={12} />
                  Message personnalisé
                </label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Ajoutez un message avant l’envoi…"
                  className="min-h-[140px] w-full rounded-2xl border border-white/[0.08] bg-[#0f0f0f] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#1f8a65]/50"
                />
              </div>

              {feedback ? <p className="mt-4 text-sm text-[#7fe2bf]">{feedback}</p> : null}
              {error ? <p className="mt-4 text-sm text-[#fca5a5]">{error}</p> : null}
            </div>

            <div className="border-t border-white/[0.06] px-5 py-4">
              <button
                onClick={handleShare}
                disabled={!canSend || sharing}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f8a65] px-4 py-3 text-[12px] font-bold text-white transition-colors hover:bg-[#217356] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sharing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {mode === "program"
                  ? "Envoyer le PDF"
                  : `Envoyer à ${selectedClientIds.length || 0} client(s)`}
              </button>
              {mode === "template" ? (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/35">
                  <Users size={11} />
                  Envoi individuel avec pièce jointe PDF.
                </p>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
