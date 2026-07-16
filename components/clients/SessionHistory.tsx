"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dumbbell,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  filterSessionsByStatus,
  isCompletedSession,
  type SessionStatusFilter,
} from "@/lib/training/sessionLogUtils";
import { resolveCanonicalExerciseName } from "@/lib/training/exerciseHistoryKey";

interface SessionLog {
  id: string;
  session_name: string;
  logged_at: string;
  completed_at: string | null;
  duration_min: number | null;
  notes: string | null;
  session_kind?: "planned" | "flex" | null;
  flex_session_id?: string | null;
  relation_to_planned_workout?: "replace" | "bonus" | "unknown" | null;
  client_set_logs: {
    id: string;
    exercise_name: string;
    set_number: number;
    actual_reps: number | null;
    actual_weight_kg: number | null;
    completed: boolean;
    rpe: number | null;
    notes: string | null;
  }[];
}

interface Props {
  clientId: string;
  focusedSessionDate?: string | null;
  focusVersion?: number;
  onSessionsChanged?: () => void;
}

const STATUS_LABELS: Record<SessionStatusFilter, string> = {
  all: "Toutes",
  completed: "Complétées",
  incomplete: "Brouillons",
};

function resolveFlexLabel(log: SessionLog) {
  if (log.relation_to_planned_workout === "replace") return "Remplacement";
  if (log.relation_to_planned_workout === "bonus") return "Bonus";
  return "Séance libre";
}

export default function SessionHistory({
  clientId,
  focusedSessionDate,
  focusVersion = 0,
  onSessionsChanged,
}: Props) {
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<SessionStatusFilter>("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    ids: string[];
    label: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/session-logs?client_id=${clientId}&scope=manage&status=all`,
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Erreur de chargement");
      setLogs(d.logs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!focusedSessionDate || logs.length === 0) return;
    const target = logs.find((log) => log.logged_at.startsWith(focusedSessionDate));
    if (!target) return;

    setStatusFilter("all");
    setExpanded(target.id);

    window.setTimeout(() => {
      document
        .getElementById(`session-log-${target.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }, [focusedSessionDate, focusVersion, logs]);

  const filteredLogs = useMemo(
    () => filterSessionsByStatus(logs, statusFilter),
    [logs, statusFilter],
  );

  const filteredIds = useMemo(
    () => filteredLogs.map((l) => l.id),
    [filteredLogs],
  );

  const selectedInView = filteredIds.filter((id) => selectedIds.has(id));

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredIds));
  };

  const runDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/session-logs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, session_log_ids: ids }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof body.error === "string" ? body.error : "Suppression impossible",
        );
      }
      setConfirmDelete(null);
      exitSelectMode();
      await loadLogs();
      onSessionsChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible");
    } finally {
      setDeleting(false);
    }
  };

  const requestDeleteSelection = () => {
    if (selectedInView.length === 0) return;
    const hasCompleted = filteredLogs.some(
      (l) => selectedIds.has(l.id) && isCompletedSession(l),
    );
    setConfirmDelete({
      ids: selectedInView,
      label: hasCompleted
        ? `${selectedInView.length} séance(s), dont des séances complétées, seront supprimées définitivement.`
        : `${selectedInView.length} séance(s) seront supprimées définitivement.`,
    });
  };

  const deleteAllFiltered = () => {
    if (statusFilter !== "incomplete" || filteredIds.length === 0) return;
    void runDelete(filteredIds);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-[#181818] rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Filter size={14} className="text-white/45" />
            Historique des séances
          </h2>
          <span className="text-xs text-white/45">
            {filteredLogs.length} affichée{filteredLogs.length > 1 ? "s" : ""}
            {statusFilter !== "all" ? ` · ${logs.length} au total` : ""}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-white/[0.04] rounded-lg p-1 gap-1">
            {(["all", "completed", "incomplete"] as SessionStatusFilter[]).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setStatusFilter(s);
                    setSelectedIds(new Set());
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                    statusFilter === s
                      ? "bg-accent text-white shadow"
                      : "text-white/45 hover:text-white"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ),
            )}
          </div>

          {!selectMode ? (
            <button
              type="button"
              onClick={() => setSelectMode(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.1] transition-colors flex items-center gap-1.5"
            >
              <CheckSquare size={14} />
              Sélectionner
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={selectAllFiltered}
                disabled={filteredIds.length === 0}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/[0.06] text-white/70 hover:text-white disabled:opacity-40 transition-colors"
              >
                Tout sélectionner
              </button>
              <button
                type="button"
                onClick={requestDeleteSelection}
                disabled={selectedInView.length === 0 || deleting}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                Supprimer ({selectedInView.length})
              </button>
              {statusFilter === "incomplete" && filteredIds.length > 0 && (
                <button
                  type="button"
                  onClick={deleteAllFiltered}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600/80 text-white hover:bg-red-600 disabled:opacity-40 transition-colors"
                >
                  Supprimer tout ({filteredIds.length})
                </button>
              )}
              <button
                type="button"
                onClick={exitSelectMode}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/45 hover:text-white transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {filteredLogs.length === 0 ? (
        <div className="bg-[#181818] border-subtle rounded-xl p-10 text-center">
          <Dumbbell size={36} className="text-white/45 mx-auto mb-3 opacity-30" />
          <p className="text-sm text-white/45">
            {statusFilter === "incomplete"
              ? "Aucun brouillon sur cette période."
              : statusFilter === "completed"
                ? "Aucune séance complétée."
                : "Aucune séance enregistrée."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredLogs.map((log) => {
            const sets = log.client_set_logs ?? [];
            const effectiveSets = sets.filter(
              (s) => s.completed || s.actual_reps != null,
            );
            const completedSets = effectiveSets.length;
            const isOpen = expanded === log.id;
            const isSelected = selectedIds.has(log.id);
            const date = new Date(log.logged_at).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            });

            const byExercise: Record<string, typeof sets> = {};
            for (const s of sets) {
              const exerciseName = resolveCanonicalExerciseName(s.exercise_name);
              if (!byExercise[exerciseName]) byExercise[exerciseName] = [];
              byExercise[exerciseName].push(s);
            }

            return (
              <div
                id={`session-log-${log.id}`}
                key={log.id}
                className={`bg-[#181818] border-subtle rounded-xl overflow-hidden transition-colors ${
                  isSelected
                    ? "ring-1 ring-accent/60"
                    : focusedSessionDate && log.logged_at.startsWith(focusedSessionDate)
                      ? "ring-1 ring-accent/40"
                      : ""
                }`}
              >
                <div className="flex items-stretch">
                  {selectMode && (
                    <button
                      type="button"
                      onClick={() => toggleSelect(log.id)}
                      className="px-3 flex items-center justify-center text-accent shrink-0 border-r border-white/[0.06]"
                      aria-label={isSelected ? "Désélectionner" : "Sélectionner"}
                    >
                      {isSelected ? (
                        <CheckSquare size={18} />
                      ) : (
                        <Square size={18} className="text-white/30" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      selectMode
                        ? toggleSelect(log.id)
                        : setExpanded(isOpen ? null : log.id)
                    }
                    className="flex-1 flex items-center justify-between p-4 text-left min-w-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
                        <Dumbbell size={16} className="text-accent" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white text-sm truncate">
                          {log.session_name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <p className="text-xs text-white/45 capitalize">{date}</p>
                          {log.session_kind === "flex" && (
                            <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-white/60">
                              {resolveFlexLabel(log)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-bold text-white">
                          {completedSets}/{effectiveSets.length || sets.length}{" "}
                          sets
                        </p>
                        {log.duration_min != null && (
                          <p className="text-[10px] text-white/45 flex items-center gap-1 justify-end">
                            <Clock size={9} />
                            {log.duration_min} min
                          </p>
                        )}
                      </div>
                      {log.completed_at ? (
                        <CheckCircle2
                          size={16}
                          className="text-green-500 shrink-0"
                        />
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-500/90 shrink-0">
                          Brouillon
                        </span>
                      )}
                      {!selectMode &&
                        (isOpen ? (
                          <ChevronUp size={14} className="text-white/45" />
                        ) : (
                          <ChevronDown size={14} className="text-white/45" />
                        ))}
                    </div>
                  </button>
                </div>

                {isOpen && !selectMode && (
                  <div className="border-t border-white/[0.06] p-4 flex flex-col gap-4">
                    {Object.entries(byExercise).map(([exName, exSets]) => {
                      const doneSets = exSets.filter(
                        (s) => s.completed || s.actual_reps != null,
                      );
                      if (doneSets.length === 0) return null;
                      const maxWeight = Math.max(
                        ...doneSets
                          .filter((s) => s.actual_weight_kg)
                          .map((s) => Number(s.actual_weight_kg)),
                        0,
                      );
                      return (
                        <div key={exName}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-white">
                              {exName}
                            </p>
                            {maxWeight > 0 && (
                              <span className="text-[10px] text-accent font-bold font-mono">
                                {maxWeight} kg max
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col">
                            {doneSets
                              .sort((a, b) => a.set_number - b.set_number)
                              .map((s, i, arr) => (
                                <div
                                  key={s.id}
                                  className={`flex items-center gap-3 py-2 text-xs ${i < arr.length - 1 ? "border-b border-white/[0.04]" : ""}`}
                                >
                                  <span className="font-mono text-white/25 w-4 shrink-0 text-[10px]">
                                    {s.set_number}
                                  </span>
                                  <span className="font-mono font-bold text-white tabular-nums">
                                    {s.actual_reps}{" "}
                                    <span className="text-white/35 font-normal">
                                      reps
                                    </span>
                                  </span>
                                  {s.actual_weight_kg != null && (
                                    <span className="font-mono text-white/55 tabular-nums">
                                      × {s.actual_weight_kg}{" "}
                                      <span className="text-white/30">kg</span>
                                    </span>
                                  )}
                                  {s.rpe != null && (
                                    <span className="ml-auto text-[10px] text-white/30 font-mono">
                                      RPE {s.rpe}
                                    </span>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      );
                    })}
                    {effectiveSets.length === 0 && (
                      <p className="text-xs text-white/45 italic">
                        Aucune donnée saisie — brouillon vide.
                      </p>
                    )}
                    {log.notes && (
                      <p className="text-xs text-white/45 italic border-t border-white/[0.06] pt-3">
                        {log.notes}
                      </p>
                    )}
                    {log.session_kind === "flex" && (
                      <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between gap-3">
                        <p className="text-[11px] text-white/30">
                          Détail complet disponible.
                        </p>
                        {log.flex_session_id && (
                          <Link
                            href={`/coach/clients/${clientId}/data/performances/flex-workouts/${log.flex_session_id}`}
                            className="shrink-0 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white/75 transition-colors hover:bg-white/[0.1] hover:text-white"
                          >
                            Ouvrir
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] rounded-2xl p-6 w-full max-w-sm border border-white/[0.08]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} className="text-red-400" />
              </div>
              <h3 className="font-bold text-white text-[15px]">
                Supprimer les séances ?
              </h3>
            </div>
            <p className="text-[13px] text-white/55 mb-5 leading-relaxed">
              {confirmDelete.label} Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.04] text-[13px] text-white/55 hover:text-white/80 transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void runDelete(confirmDelete.ids)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500/80 text-white text-[13px] font-bold hover:bg-red-500 transition-colors disabled:opacity-50"
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
