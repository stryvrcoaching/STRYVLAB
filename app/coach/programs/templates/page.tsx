"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Dumbbell,
  Copy,
  Edit2,
  Trash2,
  Search,
  Filter,
  Target,
  Users,
  Calendar,
  Zap,
  ChevronRight,
  Tag,
  Eye,
  Lock,
  BarChart2,
} from "lucide-react";
import { useSetTopBar } from "@/components/layout/useSetTopBar";

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
const GOAL_COLORS: Record<string, string> = {
  hypertrophy: "bg-white/[0.04] text-white/70",
  strength: "bg-white/[0.04] text-white/70",
  endurance: "bg-white/[0.04] text-white/70",
  fat_loss: "bg-white/[0.04] text-white/70",
  recomp: "bg-white/[0.04] text-white/70",
  maintenance: "bg-white/[0.04] text-white/70",
  athletic: "bg-white/[0.04] text-white/70",
};
const LEVEL_COLORS: Record<string, string> = {
  beginner: "bg-white/[0.04] text-white/70",
  intermediate: "bg-white/[0.04] text-white/70",
  advanced: "bg-white/[0.04] text-white/70",
  elite: "bg-white/[0.04] text-white/70",
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
      <button
        onClick={() => router.push("/coach/programs/templates/new")}
        className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#1f8a65] text-white text-[12px] font-bold uppercase tracking-[0.1em] hover:bg-[#217356] transition-all active:scale-[0.98]"
      >
        <Plus size={12} />
        Nouveau template
      </button>
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

      <main className="max-w-5xl mx-auto px-8 py-6 flex flex-col gap-5">
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
                      {f}j/sem.
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-[#181818] p-5 space-y-3">
                <div className="h-3 w-24 rounded-full bg-white/[0.06]" />
                <div className="h-5 w-3/4 rounded-full bg-white/[0.06]" />
                <div className="h-3 w-full rounded-full bg-white/[0.06]" />
                <div className="h-3 w-5/6 rounded-full bg-white/[0.06]" />
                <div className="h-10 w-full rounded-2xl bg-white/[0.04]" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((t) => {
              const sessionCount = (t.coach_program_template_sessions ?? [])
                .length;
              const totalSets = (t.coach_program_template_sessions ?? [])
                .flatMap((s: any) => s.coach_program_template_exercises ?? [])
                .reduce((acc: number, e: any) => acc + (e.sets ?? 0), 0);
              const isSystem = t.is_system === true;

              return (
                <div
                  key={t.id}
                  className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl flex flex-col overflow-hidden transition-all duration-150 hover:bg-white/[0.03]"
                >
                  <div className="p-5 flex flex-col gap-3 flex-1">
                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {isSystem && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1f8a65]/10 text-[#1f8a65]">
                          <Lock size={8} />
                          Système
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${GOAL_COLORS[t.goal]}`}
                      >
                        {GOALS[t.goal]}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${LEVEL_COLORS[t.level]}`}
                      >
                        {LEVELS[t.level]}
                      </span>
                      {t.equipment_archetype && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.04] text-white/70">
                          {ARCHETYPES[t.equipment_archetype] ??
                            t.equipment_archetype}
                        </span>
                      )}
                    </div>

                    {/* Name */}
                    <div>
                      <h3 className="font-bold text-white leading-snug">
                        {t.name}
                      </h3>
                      {t.description && (
                        <p className="text-xs text-white/70 mt-1 line-clamp-2">
                          {t.description}
                        </p>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-white/70">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {t.frequency}j/sem.
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap size={11} />
                        {t.weeks} sem.
                      </span>
                      <span className="flex items-center gap-1">
                        <Dumbbell size={11} />
                        {sessionCount} séances
                      </span>
                      {totalSets > 0 && (
                        <span className="flex items-center gap-1">
                          <BarChart2 size={11} />
                          {totalSets} séries
                        </span>
                      )}
                    </div>

                    {/* Muscle tags */}
                    {t.muscle_tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {t.muscle_tags.map((tag: string) => (
                          <span
                            key={tag}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#0a0a0a] text-white/70"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  {isSystem ? (
                    /* ── Template STRYVR — modèle à dupliquer ── */
                    <div className="border-t-[0.3px] border-white/[0.06] px-5 py-3 flex flex-col gap-2">
                      <p className="text-[9px] text-white/60 text-center italic">
                        Modèle STRYVR — dupliquer pour personnaliser
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDuplicate(t.id)}
                          disabled={duplicating === t.id}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-[#1f8a65] text-white text-xs font-bold py-2 rounded-xl hover:bg-[#217356] transition-colors disabled:opacity-50"
                        >
                          {duplicating === t.id ? (
                            <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Copy size={12} />
                          )}
                          Dupliquer & personnaliser
                        </button>
                        <Link
                          href={`/coach/programs/templates/${t.id}/view`}
                          className="p-2 text-white/50 hover:text-white/80 bg-white/[0.04] hover:bg-white/[0.07] rounded-lg transition-all"
                          title="Visualiser"
                        >
                          <Eye size={14} />
                        </Link>
                      </div>
                    </div>
                  ) : (
                    /* ── Template coach ── */
                    <div className="border-t-[0.3px] border-white/[0.06] px-5 py-3 flex items-center gap-2">
                      <Link
                        href={`/coach/programs/templates/${t.id}/assign`}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#1f8a65] text-white text-xs font-bold py-2 rounded-xl hover:bg-[#217356] transition-colors"
                      >
                        <Users size={12} />
                        Assigner
                      </Link>
                      <Link
                        href={`/coach/programs/templates/${t.id}/view`}
                        className="p-2 text-white/50 hover:text-white/80 bg-white/[0.04] hover:bg-white/[0.07] rounded-lg transition-all"
                        title="Visualiser"
                      >
                        <Eye size={14} />
                      </Link>
                      <Link
                        href={`/coach/programs/templates/${t.id}/edit`}
                        className="p-2 text-white/50 hover:text-white/80 bg-white/[0.04] hover:bg-white/[0.07] rounded-lg transition-all"
                        title="Modifier"
                      >
                        <Edit2 size={14} />
                      </Link>
                      <button
                        onClick={() => handleDuplicate(t.id)}
                        disabled={duplicating === t.id}
                        className="p-2 text-white/50 hover:text-white/80 bg-white/[0.04] hover:bg-white/[0.07] rounded-lg transition-all"
                        title="Dupliquer"
                      >
                        {duplicating === t.id ? (
                          <div className="w-3.5 h-3.5 border border-[#1f8a65] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setDeleteTarget({ id: t.id, name: t.name })
                        }
                        className="p-2 text-white/70 hover:text-red-400 bg-[#0a0a0a] border-button rounded-xl transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
