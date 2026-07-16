"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Dumbbell,
  Copy,
  Download,
  Edit2,
  Trash2,
  Search,
  Filter,
  Target,
  Users,
  Eye,
  Lock,
  BarChart2,
  MoreHorizontal,
} from "lucide-react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";
import ProgramPdfModal from "@/components/programs/ProgramPdfModal";
import HeaderIconButton from "@/components/layout/HeaderIconButton";

const GOALS: Record<string, string> = {
  hypertrophy: "Hypertrophie",
  strength: "Force",
  endurance: "Endurance",
  fat_loss: "Perte de gras",
  recomp: "Recomposition",
  maintenance: "Maintenance",
  athletic: "Athletic",
};
const LEVELS: Record<string, string> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
  elite: "Élite",
};
const MUSCLES = [
  "Full Body",
  "Jambes",
  "Fessiers",
  "Ischio-jambiers",
  "Quadriceps",
  "Pectoraux",
  "Dos",
  "Épaules",
  "Biceps",
  "Triceps",
  "Abdos",
  "Mollets",
  "Lombaires",
  "Posture",
];
const ARCHETYPES: Record<string, string> = {
  bodyweight: "Poids du corps",
  home_dumbbells: "Domicile — Haltères",
  home_full: "Domicile — Complet",
  home_rack: "Rack à domicile",
  functional_box: "Box / Fonctionnel",
  commercial_gym: "Salle de sport",
};

type TemplateCardProps = {
  template: any;
  duplicating: string | null;
  onDuplicate: (id: string) => void;
  onDelete: (template: { id: string; name: string }) => void;
  onExport: (template: { id: string; name: string }) => void;
};

function TemplateCard({
  template,
  duplicating,
  onDuplicate,
  onDelete,
  onExport,
}: TemplateCardProps) {
  const sessions = template.coach_program_template_sessions ?? [];
  const totalSets = sessions
    .flatMap((session: any) => session.coach_program_template_exercises ?? [])
    .reduce((total: number, exercise: any) => total + (exercise.sets ?? 0), 0);
  const visibleSessions = sessions.slice(0, 4);
  const hiddenSessionCount = Math.max(sessions.length - visibleSessions.length, 0);
  const visibleMuscles = (template.muscle_tags ?? []).slice(0, 3);
  const hiddenMuscleCount = Math.max((template.muscle_tags?.length ?? 0) - visibleMuscles.length, 0);
  const isSystem = template.is_system === true;
  const actionClass =
    "flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f8a65]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]";

  return (
    <article className="group relative overflow-visible rounded-[20px] border border-white/[0.07] bg-[#171717] shadow-[0_1px_0_rgba(255,255,255,0.035)_inset,0_14px_30px_rgba(0,0,0,0.18)] transition-all duration-200 hover:border-white/[0.13] hover:bg-[#1a1a1a] hover:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_18px_34px_rgba(0,0,0,0.3)] lg:grid lg:grid-cols-[minmax(190px,0.9fr)_minmax(270px,1.35fr)_minmax(220px,1fr)_164px]">
      <section className="min-w-0 p-5 lg:border-r lg:border-white/[0.06]">
        <div className="flex items-start justify-between gap-3 lg:block">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.035] text-[#7fe2bf]">
              <Target size={14} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                {GOALS[template.goal] ?? "Programme"}
              </p>
              <p className="text-[11px] text-white/55">{LEVELS[template.level] ?? "Niveau à définir"}</p>
            </div>
          </div>
          <div className="mt-0 lg:mt-4">
            {isSystem ? (
              <span className="flex w-fit shrink-0 items-center gap-1 rounded-full border border-[#1f8a65]/20 bg-[#1f8a65]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#7fe2bf]">
                <Lock size={9} aria-hidden="true" /> STRYV
              </span>
            ) : template.equipment_archetype ? (
              <span className="block max-w-[145px] truncate rounded-full border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-[9px] font-semibold text-white/55">
                {ARCHETYPES[template.equipment_archetype] ?? template.equipment_archetype}
              </span>
            ) : null}
          </div>
        </div>
        <Link
          href={`/coach/programs/templates/${template.id}/view`}
          className="mt-4 block w-fit max-w-full rounded-sm text-[17px] font-bold leading-snug text-white transition-colors hover:text-[#b7e8d3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f8a65]/70"
        >
          {template.name}
        </Link>
        {template.description ? (
          <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-white/55">{template.description}</p>
        ) : (
          <p className="mt-2 text-[12px] italic text-white/25">Sans description</p>
        )}
      </section>

      <section className="min-w-0 border-t border-white/[0.06] p-5 lg:border-t-0 lg:border-r">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">Structure du cycle</p>
          <span className="shrink-0 text-[10px] font-medium text-white/45">{sessions.length} séance{sessions.length > 1 ? "s" : ""}</span>
        </div>
        {visibleSessions.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visibleSessions.map((session: any, index: number) => (
              <div key={session.id ?? `${session.name}-${index}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.055] bg-black/[0.14] px-2.5 py-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-[#7fe2bf] ring-1 ring-inset ring-[#1f8a65]/25">
                  {index + 1}
                </span>
                <span className="truncate text-[11px] font-medium text-white/68">{session.name || `Séance ${index + 1}`}</span>
              </div>
            ))}
            {hiddenSessionCount > 0 && (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-white/[0.07] px-2.5 py-2 text-[10px] font-semibold text-white/40">
                +{hiddenSessionCount} séance{hiddenSessionCount > 1 ? "s" : ""}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-[68px] items-center justify-center rounded-xl border border-dashed border-white/[0.07] text-[10px] text-white/35">
            Structure à compléter
          </div>
        )}
      </section>

      <section className="min-w-0 border-t border-white/[0.06] p-5 lg:border-t-0 lg:border-r">
        <dl className="grid grid-cols-3 divide-x divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.02] py-3">
          <div className="min-w-0 px-2.5">
            <dt className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/35">Rythme</dt>
            <dd className="mt-1 truncate text-[11px] font-semibold text-white/80">{template.frequency ?? "—"} / sem.</dd>
          </div>
          <div className="min-w-0 px-2.5">
            <dt className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/35">Durée</dt>
            <dd className="mt-1 truncate text-[11px] font-semibold text-white/80">{template.weeks ? `${template.weeks} sem.` : "Libre"}</dd>
          </div>
          <div className="min-w-0 px-2.5">
            <dt className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/35">Volume</dt>
            <dd className="mt-1 flex items-center gap-1 truncate text-[11px] font-semibold text-white/80"><BarChart2 size={10} aria-hidden="true" />{totalSets || "—"}</dd>
          </div>
        </dl>
        {(visibleMuscles.length > 0 || template.equipment_archetype) && (
          <div className="mt-4">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">Groupes ciblés</p>
            <div className="flex flex-wrap gap-1.5">
              {visibleMuscles.map((muscle: string) => (
                <span key={muscle} className="rounded-full bg-white/[0.04] px-2 py-1 text-[9px] font-semibold text-white/48">{muscle}</span>
              ))}
              {hiddenMuscleCount > 0 && <span className="px-1 py-1 text-[10px] font-semibold text-white/35">+{hiddenMuscleCount}</span>}
            </div>
          </div>
        )}
      </section>

      <footer className="flex items-center gap-2 border-t border-white/[0.06] p-4 lg:flex-col lg:justify-center lg:border-t-0">
        {isSystem ? (
          <button
            onClick={() => onDuplicate(template.id)}
            disabled={duplicating === template.id}
            className={`${actionClass} flex-1 bg-[#1f8a65] px-3 text-white hover:bg-[#217356] disabled:opacity-50 lg:w-full lg:flex-none`}
          >
            {duplicating === template.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent" /> : <Copy size={13} aria-hidden="true" />}
            Dupliquer
          </button>
        ) : (
          <Link href={`/coach/programs/templates/${template.id}/assign`} className={`${actionClass} flex-1 bg-[#1f8a65] px-3 text-white hover:bg-[#217356] lg:w-full lg:flex-none`}>
            <Users size={13} aria-hidden="true" />
            Assigner
          </Link>
        )}
        <Link
          href={`/coach/programs/templates/${template.id}/${isSystem ? "view" : "edit"}`}
          aria-label={`${isSystem ? "Visualiser" : "Modifier"} ${template.name}`}
          className={`${actionClass} shrink-0 border border-white/[0.08] bg-white/[0.035] px-3 text-white/65 hover:bg-white/[0.07] hover:text-white lg:w-full lg:flex-none`}
        >
          {isSystem ? <Eye size={13} aria-hidden="true" /> : <Edit2 size={13} aria-hidden="true" />}
          <span className="hidden sm:inline">{isSystem ? "Voir" : "Modifier"}</span>
        </Link>
        {isSystem ? (
          <button
            onClick={() => onExport({ id: template.id, name: template.name })}
            aria-label={`Exporter ${template.name} en PDF`}
            className={`${actionClass} h-9 w-9 shrink-0 border border-white/[0.08] bg-white/[0.035] text-white/55 hover:bg-white/[0.07] hover:text-white lg:w-full lg:flex-none`}
          >
            <Download size={14} aria-hidden="true" />
          </button>
        ) : (
          <details className="relative shrink-0 lg:w-full">
            <summary className={`${actionClass} h-9 w-9 cursor-pointer list-none border border-white/[0.08] bg-white/[0.035] text-white/55 hover:bg-white/[0.07] hover:text-white [&::-webkit-details-marker]:hidden`} aria-label={`Plus d’actions pour ${template.name}`}>
              <MoreHorizontal size={16} aria-hidden="true" />
            </summary>
            <div className="absolute bottom-11 right-0 z-20 w-48 rounded-xl border border-white/[0.09] bg-[#202020] p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.45)] lg:bottom-auto lg:right-[calc(100%+8px)] lg:top-0">
              <Link href={`/coach/programs/templates/${template.id}/view`} className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white">
                <Eye size={13} aria-hidden="true" /> Visualiser
              </Link>
              <button onClick={() => onDuplicate(template.id)} disabled={duplicating === template.id} className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[11px] font-medium text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-50">
                <Copy size={13} aria-hidden="true" /> Dupliquer
              </button>
              <button onClick={() => onExport({ id: template.id, name: template.name })} className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[11px] font-medium text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white">
                <Download size={13} aria-hidden="true" /> Exporter en PDF
              </button>
              <button onClick={() => onDelete({ id: template.id, name: template.name })} className="mt-1 flex h-9 w-full items-center gap-2 rounded-lg border-t border-white/[0.06] px-2.5 pt-2 text-left text-[11px] font-medium text-red-300/80 transition-colors hover:bg-red-400/[0.08] hover:text-red-200">
                <Trash2 size={13} aria-hidden="true" /> Supprimer
              </button>
            </div>
          </details>
        )}
      </footer>
    </article>
  );
}

export default function ProgramTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterGoal, setFilterGoal] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterFreq, setFilterFreq] = useState("");
  const [filterMuscle, setFilterMuscle] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [pdfTemplate, setPdfTemplate] = useState<{ id: string; name: string } | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterGoal) params.set("goal", filterGoal);
    if (filterLevel) params.set("level", filterLevel);
    if (filterFreq) params.set("frequency", filterFreq);
    if (filterMuscle) params.set("muscle", filterMuscle);
    const res = await fetch(`/api/program-templates?${params}`);
    const d = await res.json();
    setTemplates(d.templates ?? []);
    setLoading(false);
  }, [filterGoal, filterLevel, filterFreq, filterMuscle]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const filtered = templates.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  const templateGroups = [
    {
      id: "coach",
      title: "Mes templates",
      description: "Vos modèles prêts à être adaptés et assignés à vos clients.",
      templates: filtered.filter((template) => template.is_system !== true),
    },
    {
      id: "stryv",
      title: "Bibliothèque STRYV",
      description: "Des bases de travail à dupliquer avant de les personnaliser.",
      templates: filtered.filter((template) => template.is_system === true),
    },
  ].filter((group) => group.templates.length > 0);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/program-templates/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    setDeleting(false);
    setDeleteTarget(null);
  }

  async function handleDuplicate(id: string) {
    setDuplicating(id);
    const res = await fetch(`/api/program-templates/${id}`, { method: "POST" });
    const d = await res.json();
    if (d.template) setTemplates((prev) => [d.template, ...prev]);
    setDuplicating(null);
  }

  const activeFilters = [
    filterGoal,
    filterLevel,
    filterFreq,
    filterMuscle,
  ].filter(Boolean).length;

  const topBarLeft = useMemo(
    () => (
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
          Espace Coach
        </p>
        <p className="text-[13px] font-semibold text-white leading-none">
          Programmes — Templates
        </p>
      </div>
    ),
    [],
  );

  const topBarRight = useMemo(
    () => (
      <HeaderIconButton
        icon={<Plus size={12} />}
        label="Nouveau template"
        variant="accent"
        onClick={() => router.push("/coach/programs/templates/new")}
      />
    ),
    [router],
  );

  useSetTopBar(topBarLeft, topBarRight);

  return (
    <div className="min-h-screen bg-[#121212] font-sans">
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-[#181818] border-subtle rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-white mb-2">
              Supprimer le template ?
            </h3>
            <p className="text-sm text-white/70 mb-5">
              Le template{" "}
              <span className="font-medium text-white">
                "{deleteTarget.name}"
              </span>{" "}
              sera supprimé définitivement.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.03] text-sm text-white/70 hover:text-white transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-[#1f8a65] text-white text-sm font-bold hover:bg-[#217356] disabled:opacity-50 transition-colors"
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 lg:px-8">
        {/* Search + filtres */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un template…"
                className="w-full pl-9 pr-4 h-10 bg-[#0a0a0a] border-input rounded-xl text-sm text-white outline-none placeholder:text-white/25 focus:ring-2 focus:ring-[#1f8a65]/40"
              />
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                showFilters || activeFilters > 0
                  ? "bg-[#1f8a65] text-white"
                  : "bg-white/[0.03] text-white/70 hover:text-white"
              }`}
            >
              <Filter size={14} />
              Filtres{activeFilters > 0 ? ` (${activeFilters})` : ""}
            </button>
          </div>

          {showFilters && (
            <div className="bg-[#181818] border-subtle rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1.5">
                  Objectif
                </label>
                <select
                  value={filterGoal}
                  onChange={(e) => setFilterGoal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0a0a0a] border-input text-xs text-white outline-none focus:ring-1 focus:ring-[#1f8a65]/40"
                >
                  <option value="">Tous</option>
                  {Object.entries(GOALS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1.5">
                  Niveau
                </label>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0a0a0a] border-input text-xs text-white outline-none focus:ring-1 focus:ring-[#1f8a65]/40"
                >
                  <option value="">Tous</option>
                  {Object.entries(LEVELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1.5">
                  Fréquence
                </label>
                <select
                  value={filterFreq}
                  onChange={(e) => setFilterFreq(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0a0a0a] border-input text-xs text-white outline-none focus:ring-1 focus:ring-[#1f8a65]/40"
                >
                  <option value="">Toutes</option>
                  {[2, 3, 4, 5, 6].map((f) => (
                    <option key={f} value={f}>
                      {f} séances/sem.
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider block mb-1.5">
                  Groupe musculaire
                </label>
                <select
                  value={filterMuscle}
                  onChange={(e) => setFilterMuscle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0a0a0a] border-input text-xs text-white outline-none focus:ring-1 focus:ring-[#1f8a65]/40"
                >
                  <option value="">Tous</option>
                  {MUSCLES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              {activeFilters > 0 && (
                <button
                  onClick={() => {
                    setFilterGoal("");
                    setFilterLevel("");
                    setFilterFreq("");
                    setFilterMuscle("");
                  }}
                  className="col-span-2 sm:col-span-4 text-xs text-white/70 hover:text-white transition-colors text-center py-1"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          )}
        </div>

        {/* Templates grid */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="grid animate-pulse rounded-[20px] border border-white/[0.05] bg-[#171717] p-5 lg:grid-cols-[0.9fr_1.35fr_1fr_164px] lg:gap-5">
                <div className="space-y-3 lg:border-r lg:border-white/[0.05] lg:pr-5">
                  <div className="h-3 w-24 rounded-full bg-white/[0.06]" />
                  <div className="h-5 w-3/4 rounded-full bg-white/[0.06]" />
                  <div className="h-3 w-full rounded-full bg-white/[0.04]" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 lg:mt-0 lg:border-r lg:border-white/[0.05] lg:pr-5">
                  <div className="h-10 rounded-xl bg-white/[0.04]" />
                  <div className="h-10 rounded-xl bg-white/[0.04]" />
                  <div className="h-10 rounded-xl bg-white/[0.04]" />
                  <div className="h-10 rounded-xl bg-white/[0.04]" />
                </div>
                <div className="mt-5 h-16 rounded-xl bg-white/[0.04] lg:mt-0 lg:border-r lg:border-white/[0.05] lg:pr-5" />
                <div className="mt-5 h-10 rounded-xl bg-white/[0.04] lg:mt-0" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#181818] border-subtle rounded-2xl p-16 text-center">
            <Dumbbell size={40} className="text-white/30 mx-auto mb-4" />
            <p className="text-sm text-white/70 mb-2">
              {templates.length === 0
                ? "Aucun template créé."
                : "Aucun résultat pour ces filtres."}
            </p>
            {templates.length === 0 && (
              <Link
                href="/coach/programs/templates/new"
                className="text-sm text-[#1f8a65] font-medium hover:text-[#217356] transition-colors"
              >
                Créer mon premier template →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {templateGroups.map((group) => (
              <section key={group.id} aria-labelledby={`${group.id}-templates-title`}>
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 id={`${group.id}-templates-title`} className="text-sm font-bold text-white">
                        {group.title}
                      </h2>
                      <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/50">
                        {group.templates.length}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-white/48">{group.description}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {group.templates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      duplicating={duplicating}
                      onDuplicate={handleDuplicate}
                      onDelete={setDeleteTarget}
                      onExport={setPdfTemplate}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {pdfTemplate && (
        <ProgramPdfModal
          mode="template"
          entityId={pdfTemplate.id}
          title={pdfTemplate.name}
          onClose={() => setPdfTemplate(null)}
        />
      )}
    </div>
  );
}
