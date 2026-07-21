"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  RefreshCw,
  Edit3,
  X,
  Loader2,
  Camera,
  ExternalLink,
  AlertCircle,
  RotateCcw,
  Lock,
  Unlock,
} from "lucide-react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import { Skeleton } from "@/components/ui/skeleton";
import AssessmentForm from "@/components/assessments/form/AssessmentForm";
import {
  BlockConfig,
  AssessmentResponse,
  SubmissionStatus,
  type AssessmentResponseValue,
  type ResponseMap,
} from "@/types/assessment";
import HeaderIconButton from "@/components/layout/HeaderIconButton";
import { extractTemplateBlocks } from "@/lib/assessments/templateSnapshot";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubmissionDetail {
  id: string;
  status: SubmissionStatus;
  filled_by: string;
  bilan_date: string | null;
  created_at: string;
  submitted_at: string | null;
  template_snapshot: BlockConfig[] | { name?: string | null; blocks?: BlockConfig[] | null };
  token?: string;
  client: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
  };
  template: { id: string; name: string } | null;
  responses: AssessmentResponse[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildResponseMap(responses: AssessmentResponse[]): ResponseMap {
  const map: ResponseMap = {};
  for (const r of responses) {
    if (!map[r.block_id]) map[r.block_id] = {};
    const val: AssessmentResponseValue | null =
      r.value_number !== undefined && r.value_number !== null
        ? r.value_number
        : r.value_json !== undefined && r.value_json !== null
          ? (r.value_json as Record<string, unknown> | string[] | boolean)
          : r.storage_path && r.storage_path.length > 0
            ? r.storage_path
            : r.value_text ?? null;
    if (val !== null) {
      map[r.block_id][r.field_key] = val;
    }
  }
  return map;
}

function formatValue(val: AssessmentResponseValue | null | undefined, inputType: string): string {
  if (val === undefined || val === null || val === "") return "—";
  if (Array.isArray(val)) return val.join(", ");
  if (typeof val === "boolean") return val ? "Oui" : "Non";
  if (val === "true") return "Oui";
  if (val === "false") return "Non";
  if (inputType === "photo_upload") return "__photo__";
  if (inputType === "food_preferences" && typeof val === "object") {
    const profile = val as Record<string, unknown>;
    const allergies = Array.isArray(profile.allergies) ? profile.allergies.length : 0;
    const preferences = Array.isArray(profile.preferences) ? profile.preferences.length : 0;
    return `${allergies} allergie(s) · ${preferences} préférence(s)`;
  }
  if (typeof val === "object") return "Donnée structurée";
  return String(val);
}

// ─── Photo viewer modal ────────────────────────────────────────────────────────

async function fetchSignedUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch("/api/assessments/photos/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.signedUrl ?? null;
  } catch {
    return null;
  }
}

function PhotoViewer({
  path,
  label,
  onClose,
}: {
  path: string;
  label: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchSignedUrl(path).then((u) => { if (u) setUrl(u); });
  }, [path]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full bg-[#181818] rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <span className="text-[13px] font-medium text-white">{label}</span>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 flex items-center justify-center min-h-[300px]">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={label} className="max-h-[70vh] rounded-xl object-contain" />
          ) : (
            <Loader2 size={24} className="animate-spin text-white/40" />
          )}
        </div>
        {url && (
          <div className="px-5 pb-4">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-[11px] text-white/40 hover:text-white/70 transition-colors"
            >
              <ExternalLink size={12} />
              Ouvrir en plein écran
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Photo thumbnail ──────────────────────────────────────────────────────────

function PhotoThumb({ path, label }: { path: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [viewer, setViewer] = useState(false);

  useEffect(() => {
    fetchSignedUrl(path).then((u) => { if (u) setUrl(u); });
  }, [path]);

  return (
    <>
      <button
        onClick={() => setViewer(true)}
        className="group flex flex-col items-center gap-2"
        title={`Voir : ${label}`}
      >
        <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-white/[0.04] relative">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={label} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Camera size={20} className="text-white/20" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
            <ExternalLink size={16} className="text-white" />
          </div>
        </div>
        <span className="text-[10px] text-white/50 text-center leading-tight">{label}</span>
      </button>
      {viewer && <PhotoViewer path={path} label={label} onClose={() => setViewer(false)} />}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoachBilanViewPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const submissionId = params.submissionId as string;

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);

  // TopBar
  const topBarLeft = useMemo(
    () => (
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => router.push(`/coach/clients/${clientId}`)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white/70 transition-all"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="min-w-0">
          <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.18em]">
            Bilan client
          </p>
          <p className="text-[13px] font-semibold text-white leading-none">
            {submission
              ? `${submission.client.first_name} ${submission.client.last_name}`
              : "…"}
          </p>
        </div>
      </div>
    ),
    [submission, clientId, router],
  );

  const topBarRight = useMemo(() => {
    if (!submission || submission.status !== "completed") return null;
    return (
      <div className="flex items-center gap-2">
        <HeaderIconButton
          onClick={() => setConfirmReopen(true)}
          icon={<Unlock size={13} />}
          label="Réouvrir le bilan"
        />
        <HeaderIconButton
          onClick={() => setEditMode(true)}
          icon={<Edit3 size={13} />}
          label="Modifier le bilan"
          variant="accent"
        />
      </div>
    );
  }, [submission]);

  useSetTopBar(topBarLeft, topBarRight);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/assessments/submissions/${submissionId}`);
    if (!res.ok) {
      setError("Bilan introuvable ou accès non autorisé");
      setLoading(false);
      return;
    }
    const d = await res.json();
    setSubmission(d.submission);
    setLoading(false);
  }, [submissionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReopen() {
    setReopening(true);
    const res = await fetch(`/api/assessments/submissions/${submissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress", renew_token: true }),
    });
    if (res.ok) {
      const d = await res.json();
      setSubmission((prev) =>
        prev ? { ...prev, status: "in_progress", token: d.submission?.token } : prev,
      );
    }
    setReopening(false);
    setConfirmReopen(false);
  }

  // ── Chargement ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen bg-[#121212] font-sans p-8">
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          <Skeleton className="h-6 w-48" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/[0.02] rounded-xl p-5 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#121212] font-sans flex items-center justify-center p-8">
        <div className="bg-white/[0.02] rounded-2xl p-10 text-center max-w-sm w-full">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
          <h2 className="font-bold text-white mb-2">Bilan introuvable</h2>
          <p className="text-[13px] text-white/60 mb-6">{error}</p>
          <button
            onClick={() => router.push(`/coach/clients/${clientId}`)}
            className="flex items-center gap-2 mx-auto text-[12px] text-white/60 hover:text-white transition-colors"
          >
            <ChevronLeft size={15} />
            Retour au profil
          </button>
        </div>
      </main>
    );
  }

  if (!submission) return null;

  // ── Mode édition (AssessmentForm coach) ─────────────────────────────────────
  if (editMode) {
    return (
      <div className="min-h-screen bg-[#121212] font-sans">
        {/* Barre de contexte édition */}
        <div className="sticky top-0 z-50 bg-[#181818] border-b border-white/[0.06] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditMode(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white bg-white/[0.04] transition-colors"
            >
              <X size={16} />
            </button>
            <span className="text-[13px] font-semibold text-white">
              Mode édition — {submission.client.first_name} {submission.client.last_name}
            </span>
          </div>
          <span className="text-[11px] text-amber-500 font-medium">
            Les modifications seront sauvegardées automatiquement
          </span>
        </div>
        <AssessmentForm
          submissionId={submissionId}
          blocks={extractTemplateBlocks(submission.template_snapshot)}
          token=""
          clientName={`${submission.client.first_name} ${submission.client.last_name}`}
          isCoach={true}
          initialResponses={buildResponseMap(submission.responses)}
          onSaved={() => {
            setEditMode(false);
            load();
          }}
        />
      </div>
    );
  }

  // ── Vue lecture ──────────────────────────────────────────────────────────────
  const responseMap = buildResponseMap(submission.responses);
  const blocks = extractTemplateBlocks(submission.template_snapshot);
  const templateName = submission.template?.name ?? "Bilan";
  const bilanDate = submission.bilan_date ?? submission.created_at;
  const dateFormatted = new Date(bilanDate).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const STATUS_CONFIG = {
    pending: { label: "En attente", icon: Clock, color: "text-amber-500 bg-amber-500/10" },
    in_progress: { label: "En cours", icon: RefreshCw, color: "text-blue-400 bg-blue-400/10" },
    completed: { label: "Complété", icon: CheckCircle2, color: "text-[#1f8a65] bg-[#1f8a65]/10" },
    expired: { label: "Expiré", icon: AlertCircle, color: "text-white/40 bg-white/[0.04]" },
  };
  const statusCfg = STATUS_CONFIG[submission.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  return (
    <main className="min-h-screen bg-[#121212] font-sans">
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Header info */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[18px] font-bold text-white leading-none mb-1">{templateName}</h1>
            <p className="text-[13px] text-white/50">{dateFormatted}</p>
          </div>
          <div className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full shrink-0 ${statusCfg.color}`}>
            <StatusIcon size={12} />
            {statusCfg.label}
          </div>
        </div>

        {/* Status non complété */}
        {submission.status !== "completed" && (
          <div className="bg-amber-500/10 border-[0.3px] border-amber-500/20 rounded-xl px-5 py-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-amber-500 mb-0.5">
                Bilan non complété
              </p>
              <p className="text-[12px] text-white/60">
                Ce bilan est en statut "{statusCfg.label}". Les données affichées sont partielles.
              </p>
              {submission.token && submission.status !== "expired" && (
                <a
                  href={`/bilan/${submission.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-[11px] text-amber-500 hover:text-amber-400 transition-colors font-medium"
                >
                  <ExternalLink size={12} />
                  Ouvrir le lien client
                </a>
              )}
            </div>
          </div>
        )}

        {/* Blocs de réponses */}
        {blocks.map((block) => {
          const blockResponses = responseMap[block.id] ?? {};
          const visibleFields = block.fields.filter((f) => f.visible);
          const filledFields = visibleFields.filter(
            (f) => blockResponses[f.key] !== undefined,
          );

          if (filledFields.length === 0) return null;

          // Séparer photos des autres champs
          const photoFields = filledFields.filter((f) => f.input_type === "photo_upload");
          const regularFields = filledFields.filter((f) => f.input_type !== "photo_upload");

          return (
            <div
              key={block.id}
              className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl overflow-hidden"
            >
              {/* Entête bloc */}
              <div className="px-5 py-3 border-b border-white/[0.04]">
                <h2 className="text-[13px] font-semibold text-white">{block.label}</h2>
                <p className="text-[11px] text-white/40 mt-0.5">
                  {filledFields.length} / {visibleFields.length} champ
                  {visibleFields.length > 1 ? "s" : ""} renseigné
                  {filledFields.length > 1 ? "s" : ""}
                </p>
              </div>

              {/* Photos */}
              {photoFields.length > 0 && (
                <div className="px-5 py-4 border-b border-white/[0.04]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30 mb-3">
                    Photos
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {photoFields.map((f) => {
                      const val = blockResponses[f.key];
                      if (typeof val !== "string" || !val) return null;
                      return <PhotoThumb key={f.key} path={val} label={f.label} />;
                    })}
                  </div>
                </div>
              )}

              {/* Champs texte/numériques */}
              {regularFields.length > 0 && (
                <div className="divide-y divide-white/[0.03]">
                  {regularFields.map((field) => {
                    const val = blockResponses[field.key];
                    const display = formatValue(
                      val as string | number | string[] | boolean | undefined,
                      field.input_type,
                    );

                    return (
                      <div
                        key={field.key}
                        className="flex items-baseline justify-between gap-4 px-5 py-3"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-[12px] text-white/60">{field.label}</span>
                          {field.unit && (
                            <span className="text-[11px] text-white/30 ml-1">({field.unit})</span>
                          )}
                        </div>
                        <span className="text-[13px] font-medium text-white text-right max-w-[55%] break-words">
                          {display}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Aucune réponse */}
        {blocks.every((b) => {
          const br = responseMap[b.id] ?? {};
          return b.fields.filter((f) => f.visible && br[f.key] !== undefined).length === 0;
        }) && (
          <div className="bg-white/[0.02] rounded-2xl p-10 text-center">
            <p className="text-[13px] text-white/50">Aucune réponse enregistrée pour ce bilan.</p>
          </div>
        )}
      </div>

      {/* Modal confirmation réouverture */}
      {confirmReopen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-[#181818] border-[0.3px] border-white/[0.06] rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Unlock size={16} className="text-amber-500" />
              </div>
              <h3 className="font-bold text-white">Réouvrir ce bilan ?</h3>
            </div>
            <p className="text-[13px] text-white/60 mb-5 leading-relaxed">
              Le bilan sera rouvert et un nouveau lien sera généré. Le client pourra à nouveau
              modifier ses réponses.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReopen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[12px] text-white/60 hover:text-white transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleReopen}
                disabled={reopening}
                className="flex-1 py-2.5 rounded-xl bg-amber-500/80 text-white text-[12px] font-bold hover:bg-amber-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {reopening ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RotateCcw size={14} />
                )}
                {reopening ? "Réouverture…" : "Réouvrir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
