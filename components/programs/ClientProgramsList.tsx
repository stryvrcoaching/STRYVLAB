"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BookmarkPlus,
  Calendar,
  ChevronRight,
  Clock3,
  Dumbbell,
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  Sparkles,
  Timer,
  Trash2,
} from "lucide-react";
import SaveAsTemplateModal from "@/components/programs/SaveAsTemplateModal";
import { Skeleton } from "@/components/ui/skeleton";

interface ProgramAnalytics {
  planned_sessions: number;
  planned_exercises: number;
  planned_sets: number;
  completed_sessions: number;
  avg_duration_min: number | null;
  estimated_avg_duration_min?: number | null;
  total_logged_volume_kg: number;
  overload_count: number;
  last_completed_at: string | null;
  recent_volume_trend: number[];
  recent_reps_trend: number[];
  volume_delta_pct: number | null;
}

interface Program {
  id: string;
  name: string;
  description: string | null;
  weeks: number;
  status: "active" | "archived";
  is_client_visible: boolean;
  created_at: string;
  goal?: string | null;
  level?: string | null;
  frequency?: number | null;
  muscle_tags?: string[] | null;
  equipment_archetype?: string | null;
  session_mode?: string | null;
  program_sessions?: any[];
  analytics?: ProgramAnalytics;
}

interface Props {
  clientId: string;
  onSelectProgram: (program: Program) => void;
  onCreateProgram?: () => void;
  onRequestAlign?: (program: Program) => void;
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatVolume(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} t`;
  return `${Math.round(value)} kg`;
}

function prettifyGoal(goal?: string | null) {
  if (!goal) return null;
  const labels: Record<string, string> = {
    hypertrophy: "Hypertrophie",
    strength: "Force",
    fat_loss: "Perte de gras",
    recomp: "Recomp",
    maintenance: "Maintenance",
    endurance: "Endurance",
    athletic: "Athletic",
  };
  return labels[goal] ?? goal;
}

function prettifyLevel(level?: string | null) {
  if (!level) return null;
  const labels: Record<string, string> = {
    beginner: "Débutant",
    intermediate: "Intermédiaire",
    advanced: "Avancé",
    elite: "Elite",
  };
  return labels[level] ?? level;
}

function TrendSparkline({
  values,
  stroke,
  fill,
}: {
  values: number[];
  stroke: string;
  fill: string;
}) {
  if (values.length === 0) {
    return (
      <div className="flex h-16 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.02] text-[10px] text-white/25">
        Pas assez de données
      </div>
    );
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const width = 220;
  const height = 64;

  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full">
      <polyline
        points={areaPoints}
        fill={fill}
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProgramMetric({
  icon,
  label,
  value,
  accent = "text-white",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-white/28">
        {icon}
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] leading-tight">{label}</span>
      </div>
      <p className={`text-[13px] font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function describeTrend(values: number[]) {
  if (values.length < 2) {
    return { label: "À construire", tone: "text-white/35" };
  }

  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const delta = last - first;
  if (delta > 0) return { label: "Hausse", tone: "text-[#86efac]" };
  if (delta < 0) return { label: "Baisse", tone: "text-[#fca5a5]" };
  return { label: "Stable", tone: "text-[#fcd34d]" };
}

export default function ClientProgramsList({ clientId, onSelectProgram, onRequestAlign }: Props) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Program | null>(null);
  const [saveAsTemplateTarget, setSaveAsTemplateTarget] = useState<Program | null>(null);

  const fetchPrograms = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/programs?client_id=${clientId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Erreur");
      setPrograms(d.programs ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  async function toggleVisibility(program: Program) {
    if (!program.is_client_visible && onRequestAlign) {
      onRequestAlign(program);
      return;
    }
    setTogglingId(program.id);
    try {
      const res = await fetch(`/api/programs/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_client_visible: !program.is_client_visible }),
      });
      if (res.ok) {
        setPrograms((prev) =>
          prev.map((p) =>
            p.id === program.id
              ? { ...p, is_client_visible: !p.is_client_visible }
              : p,
          ),
        );
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmAndDelete() {
    if (!confirmDelete) return;
    const program = confirmDelete;
    setConfirmDelete(null);
    setDeletingId(program.id);
    try {
      const res = await fetch(`/api/programs/${program.id}`, { method: "DELETE" });
      if (res.ok) {
        setPrograms((prev) => prev.filter((p) => p.id !== program.id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  const activePrograms = programs.filter((p) => p.status === "active");
  const archivedPrograms = programs.filter((p) => p.status === "archived");

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/[0.02] rounded-xl p-6 text-center">
        <p className="text-sm text-white/50">{error}</p>
        <button
          onClick={fetchPrograms}
          className="mt-3 text-xs text-[#1f8a65] hover:underline"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <>
      {saveAsTemplateTarget && (
        <SaveAsTemplateModal
          programId={saveAsTemplateTarget.id}
          programName={saveAsTemplateTarget.name}
          onClose={() => setSaveAsTemplateTarget(null)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-[#181818] p-6">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 shrink-0">
                <AlertTriangle size={16} className="text-red-400" />
              </div>
              <h3 className="text-[15px] font-bold text-white">Supprimer le programme ?</h3>
            </div>
            <p className="mb-5 text-[13px] leading-relaxed text-white/55">
              <span className="font-medium text-white">&ldquo;{confirmDelete.name}&rdquo;</span> sera definitivement supprime.
              Cette action est irreversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl bg-white/[0.04] py-2.5 text-[13px] font-medium text-white/55 transition-colors hover:text-white/80"
              >
                Annuler
              </button>
              <button
                onClick={confirmAndDelete}
                className="flex-1 rounded-xl bg-red-500/80 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-red-500"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {activePrograms.length === 0 ? (
          <div className="rounded-2xl border-[0.3px] border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Dumbbell size={28} className="mx-auto mb-3 text-white/20" />
            <p className="mb-1 text-sm text-white/50">Aucun programme assigne</p>
            <p className="text-[11px] text-white/30">
              Créez un programme vide ou assignez un template existant.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {activePrograms.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                togglingId={togglingId}
                deletingId={deletingId}
                onSelect={() => onSelectProgram(program)}
                onToggle={() => toggleVisibility(program)}
                onDelete={() => setConfirmDelete(program)}
                onSaveAsTemplate={() => setSaveAsTemplateTarget(program)}
              />
            ))}
          </div>
        )}

        {archivedPrograms.length > 0 && (
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
              Archives
            </p>
            <div className="grid gap-4 opacity-65 xl:grid-cols-2">
              {archivedPrograms.map((program) => (
                <ProgramCard
                  key={program.id}
                  program={program}
                  togglingId={togglingId}
                  deletingId={deletingId}
                  onSelect={() => onSelectProgram(program)}
                  onToggle={() => toggleVisibility(program)}
                  onDelete={() => setConfirmDelete(program)}
                  onSaveAsTemplate={() => setSaveAsTemplateTarget(program)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function ProgramCard({
  program,
  togglingId,
  deletingId,
  onSelect,
  onToggle,
  onDelete,
  onSaveAsTemplate,
}: {
  program: Program;
  togglingId: string | null;
  deletingId: string | null;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onSaveAsTemplate: () => void;
}) {
  const analytics = program.analytics;
  const isToggling = togglingId === program.id;
  const isDeleting = deletingId === program.id;
  const goalLabel = prettifyGoal(program.goal);
  const levelLabel = prettifyLevel(program.level);
  const volumeDelta = analytics?.volume_delta_pct ?? null;
  const volumeTrend = describeTrend(analytics?.recent_volume_trend ?? []);
  const repsTrend = describeTrend(analytics?.recent_reps_trend ?? []);
  const volumeSampleCount = analytics?.recent_volume_trend?.length ?? 0;
  const repsSampleCount = analytics?.recent_reps_trend?.length ?? 0;
  const durationValue =
    analytics?.avg_duration_min
      ? `${analytics.avg_duration_min} min`
      : analytics?.estimated_avg_duration_min
        ? `~${analytics.estimated_avg_duration_min} min`
        : "À estimer";
  const durationAccent = analytics?.avg_duration_min ? "text-white" : "text-white/60";
  const volumeValue =
    analytics && analytics.completed_sessions > 0 && analytics.total_logged_volume_kg > 0
      ? formatVolume(analytics.total_logged_volume_kg)
      : analytics && analytics.completed_sessions > 0
        ? "Charge non tracée"
        : "Aucune donnée enregistrée";
  const volumeAccent =
    analytics && analytics.completed_sessions > 0 && analytics.total_logged_volume_kg > 0
      ? "text-[#f2f2f2]"
      : "text-white/60";
  const repsDelta =
    repsSampleCount >= 2
      ? (analytics?.recent_reps_trend?.[repsSampleCount - 1] ?? 0) - (analytics?.recent_reps_trend?.[0] ?? 0)
      : null;

  return (
    <div className="rounded-[24px] border-[0.3px] border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.035]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${
                program.is_client_visible
                  ? "bg-[#1f8a65]/12 text-[#7fe2bf]"
                  : "bg-white/[0.05] text-white/38"
              }`}
            >
              {program.is_client_visible ? <Eye size={10} /> : <EyeOff size={10} />}
              {program.is_client_visible ? "Actif app" : "Masque app"}
            </span>
            {goalLabel && (
              <span className="rounded-full border border-white/[0.07] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
                {goalLabel}
              </span>
            )}
            {levelLabel && (
              <span className="rounded-full border border-white/[0.07] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
                {levelLabel}
              </span>
            )}
          </div>

          <button onClick={onSelect} className="block text-left">
            <h3 className="truncate text-[18px] font-semibold text-white">{program.name}</h3>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/35">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={11} />
              Créé le {formatShortDate(program.created_at)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={11} />
              {program.weeks} sem.
            </span>
            {program.frequency ? (
              <span className="inline-flex items-center gap-1.5">
                <Activity size={11} />
                {program.frequency} j/sem
              </span>
            ) : null}
          </div>
          {program.description ? (
            <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-white/45">
              {program.description}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onToggle}
            disabled={isToggling}
            title={program.is_client_visible ? "Visible sur l'app client — cliquer pour masquer" : "Masque sur l'app client — cliquer pour activer"}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-all ${
              program.is_client_visible
                ? "bg-[#1f8a65]/10 text-[#7fe2bf] hover:bg-[#1f8a65]/18"
                : "bg-white/[0.04] text-white/32 hover:bg-white/[0.08] hover:text-white/55"
            }`}
          >
            {isToggling ? <Loader2 size={11} className="animate-spin" /> : program.is_client_visible ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
          <button
            onClick={onSaveAsTemplate}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/28 transition-colors hover:bg-white/[0.08] hover:text-white/60"
            title="Enregistrer comme template"
          >
            <BookmarkPlus size={12} />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
            title="Supprimer le programme"
          >
            {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ProgramMetric
          icon={<Layers3 size={11} />}
          label="Structure"
          value={`${analytics?.planned_sessions ?? program.program_sessions?.length ?? 0} séances`}
        />
        <ProgramMetric
          icon={<Dumbbell size={11} />}
          label="Exercices"
          value={`${analytics?.planned_exercises ?? 0} ex. · ${analytics?.planned_sets ?? 0} sets`}
        />
        <ProgramMetric
          icon={<Sparkles size={11} />}
          label="Volume réel"
          value={volumeValue}
          accent={volumeAccent}
        />
        <ProgramMetric
          icon={<Timer size={11} />}
          label="Durée moyenne"
          value={durationValue}
          accent={durationAccent}
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.05] bg-[#131313] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">Progression volume</p>
              <p className="mt-1 text-[13px] font-semibold text-white">
                {volumeDelta == null ? "Historique partiel" : `${volumeDelta > 0 ? "+" : ""}${volumeDelta}%`}
              </p>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${volumeTrend.tone}`}>
              {volumeTrend.label}
            </span>
          </div>
          <TrendSparkline
            values={analytics?.recent_volume_trend ?? []}
            stroke="#7fe2bf"
            fill="rgba(31,138,101,0.12)"
          />
          <p className="mt-1 text-[10px] text-white/26">
            {volumeSampleCount > 0 ? `${volumeSampleCount} séances suivies` : "Aucune séance suivie"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.05] bg-[#131313] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/28">Répétitions récentes</p>
              <p className="mt-1 text-[13px] font-semibold text-white">
                {analytics?.completed_sessions ?? 0} séances enregistrées
              </p>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${repsTrend.tone}`}>
              {repsDelta == null ? repsTrend.label : `${repsDelta > 0 ? "+" : ""}${repsDelta} reps`}
            </span>
          </div>
          <TrendSparkline
            values={analytics?.recent_reps_trend ?? []}
            stroke="#fcd34d"
            fill="rgba(245, 158, 11, 0.12)"
          />
          <p className="mt-1 text-[10px] text-white/26">
            {analytics?.last_completed_at ? `Dernière séance ${formatShortDate(analytics.last_completed_at)}` : "Aucune séance complétée"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/32">
          {program.session_mode ? (
            <span className="rounded-full border border-white/[0.06] px-2.5 py-1 uppercase tracking-[0.14em]">
              {program.session_mode === "cycle" ? "Cycle" : "Jours"}
            </span>
          ) : null}
          {program.muscle_tags && program.muscle_tags.length > 0 ? (
            <span className="truncate">
              {program.muscle_tags.slice(0, 3).join(" · ")}
            </span>
          ) : null}
        </div>
        <button
          onClick={onSelect}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.05] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/70 transition-colors hover:bg-white/[0.09] hover:text-white"
        >
          Ouvrir
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
