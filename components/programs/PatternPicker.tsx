"use client";

import { useState, useEffect } from "react";
import { Search, X, Layers, Plus } from "lucide-react";
import SavePatternModal from "./SavePatternModal";

interface Pattern {
  id: string;
  name: string;
  type: string;
  exercises: any[];
  created_at: string;
}

interface Props {
  onSelect: (pattern: Pattern) => void;
  onClose: () => void;
}

export default function PatternPicker({ onSelect, onClose }: Props) {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Pattern | null>(null);
  const [editing, setEditing] = useState<Pattern | null>(null);

  useEffect(() => {
    fetch("/api/coach/patterns")
      .then((r) => r.json())
      .then((data) => {
        setPatterns(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = patterns.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.type.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-[#181818] rounded-3xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh] border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-white/10 shrink-0">
          <div className="flex-1 relative">
            <Search
              size={14}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un pattern..."
              className="w-full pl-11 pr-3 py-3 rounded-2xl bg-[#0a0a0a] text-sm text-white outline-none focus:ring-1 focus:ring-accent/40"
              autoFocus
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-11 rounded-2xl bg-white/5 text-white/70 hover:text-white transition-colors flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-white/40 text-sm">
              Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-[#0a0a0a] py-12 text-center text-white/40 text-sm">
              Aucun pattern trouvé.
            </div>
          ) : (
            filtered.map((pattern) => (
              <button
                key={pattern.id}
                type="button"
                onClick={() => setSelected(pattern)}
                className="group flex items-center gap-4 rounded-3xl border border-white/10 bg-[#0f0f0f] p-4 text-left transition-colors hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="w-11 h-11 rounded-2xl bg-[#1f8a65]/10 text-[#1f8a65] flex items-center justify-center shrink-0">
                  <Layers size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">
                    {pattern.name}
                  </h3>
                  <p className="mt-1 text-xs text-white/40">
                    {pattern.type === "circuit" ? "Circuit" : "Pattern"} ·{" "}
                    {pattern.exercises.length} exercice(s)
                  </p>
                </div>
                <div className="rounded-full bg-white/[0.06] p-2 text-white/70 opacity-0 transition-opacity group-hover:opacity-100">
                  <Plus size={14} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      {selected && (
        <PatternPreview
          pattern={selected}
          onClose={() => setSelected(null)}
          onAdd={(p) => {
            onSelect(p);
            setSelected(null);
            onClose();
          }}
          onEditLocal={(p) => {
            setEditing(p);
            setSelected(null);
          }}
          onDeleted={(id) =>
            setPatterns((prev) => prev.filter((p) => p.id !== id))
          }
        />
      )}
      {editing && (
        <SavePatternModal
          exercises={editing.exercises}
          pattern={editing}
          onSaved={(updated) => {
            setPatterns((prev) =>
              prev.map((pt) => (pt.id === updated.id ? updated : pt)),
            );
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// Selected pattern preview/modal
function PatternPreview({
  pattern,
  onClose,
  onAdd,
  onEditLocal,
  onDeleted,
}: {
  pattern: Pattern;
  onClose: () => void;
  onAdd: (p: Pattern) => void;
  onEditLocal: (p: Pattern) => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localExercises, setLocalExercises] = useState(() =>
    (pattern.exercises || []).map((ex: any) => ({ ...ex })),
  );

  function updateExercise(i: number, patch: Partial<any>) {
    setLocalExercises((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    );
  }

  function removeExercise(i: number) {
    setLocalExercises((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/coach/patterns/${pattern.id}`, {
        method: "DELETE",
      });
      const response = await res.json().catch(() => null);
      if (!res.ok || !response?.success) {
        throw new Error(response?.error || "Erreur suppression");
      }
      onDeleted(pattern.id);
      onClose();
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      alert(e?.message || "Impossible de supprimer le pattern");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div
          className="bg-[#181818] rounded-3xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[86vh] border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.55)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-white/10">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/40 mb-2">
                Aperçu du pattern
              </p>
              <h3 className="text-lg font-semibold text-white leading-tight truncate">
                {pattern.name}
              </h3>
              <p className="mt-1 text-sm text-white/50">
                {pattern.type === "circuit" ? "Circuit" : "Pattern"} ·{" "}
                {localExercises.length} exercice(s)
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-11 w-11 rounded-2xl bg-white/5 text-white/70 hover:text-white transition-colors flex items-center justify-center"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-4">
            {localExercises.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-[#0a0a0a] p-5 text-sm text-white/40">
                Aucun exercice.
              </div>
            ) : (
              <ul className="space-y-3">
                {localExercises.map((ex, i) => (
                  <li
                    key={i}
                    className="rounded-3xl border border-white/10 bg-[#0f0f0f] p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <input
                        value={ex.name ?? ""}
                        onChange={(e) =>
                          updateExercise(i, { name: e.target.value })
                        }
                        placeholder="Nom de l'exercice"
                        className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeExercise(i)}
                        className="rounded-2xl bg-red-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 transition-colors"
                      >
                        Suppr
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={ex.sets ?? ""}
                        onChange={(e) =>
                          updateExercise(i, { sets: e.target.value })
                        }
                        placeholder="Séries"
                        className="w-full rounded-2xl bg-[#0a0a0a] px-3 py-2 text-xs text-white/70 outline-none"
                      />
                      <input
                        value={ex.reps ?? ""}
                        onChange={(e) =>
                          updateExercise(i, { reps: e.target.value })
                        }
                        placeholder="Répétitions"
                        className="w-full rounded-2xl bg-[#0a0a0a] px-3 py-2 text-xs text-white/70 outline-none"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-white/10 bg-[#111111]/80 px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/40">
              Vous pouvez modifier les exercices avant d'ajouter le pattern.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => onAdd({ ...pattern, exercises: localExercises })}
                className="w-full sm:w-auto rounded-2xl bg-[#1f8a65] px-5 py-3 text-sm font-semibold text-white hover:bg-[#239670] transition-colors"
              >
                Ajouter
              </button>
              <button
                type="button"
                onClick={() => onEditLocal(pattern)}
                className="w-full sm:w-auto rounded-2xl bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Modifier
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className="w-full sm:w-auto rounded-2xl bg-red-600/80 px-5 py-3 text-sm font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-60"
              >
                {deleting ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#181818] border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.55)] overflow-hidden">
            <div className="px-6 py-5">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">
                Confirmer la suppression
              </p>
              <h4 className="mt-3 text-lg font-semibold text-white">
                Supprimer le pattern ?
              </h4>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Cette action est définitive. Le pattern « {pattern.name} » sera
                retiré de votre bibliothèque.
              </p>
            </div>
            <div className="px-6 pb-6 pt-3 space-y-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-60"
              >
                {deleting ? "Suppression..." : "Oui, supprimer"}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// integrate selected/editing states in default export
// (rendered after main component return)
// We'll render preview and edit modals via portal-like conditionals
export function PatternPickerWrapper(props: Props) {
  // wrapper kept for compatibility; default export remains PatternPicker
  return <PatternPicker {...props} />;
}
