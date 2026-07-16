"use client";

import { useState, useEffect } from "react";
import { X, Save, Loader2 } from "lucide-react";

interface Props {
  exercises: any[];
  onSaved: (pattern: any) => void;
  onClose: () => void;
  pattern?: {
    id?: string;
    name?: string;
    type?: "pattern" | "circuit";
    exercises?: any[];
  };
}

export default function SavePatternModal({
  exercises,
  onSaved,
  onClose,
  pattern,
}: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"pattern" | "circuit">("pattern");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!name.trim()) {
      setError("Veuillez entrer un nom.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const url = pattern?.id
        ? `/api/coach/patterns/${pattern.id}`
        : "/api/coach/patterns";
      const method = pattern?.id ? "PATCH" : "POST";

      // Ensure we send a pure-JSON payload (remove functions, prototypes,
      // and avoid circular refs). Fallback to a minimal projection when
      // JSON serialization fails.
      let safeExercises: any = [];
      try {
        safeExercises = JSON.parse(JSON.stringify(exercises)).filter((e: any) => e !== null && e !== undefined);
      } catch (err) {
        safeExercises = (exercises || [])
          .filter((e: any) => e !== null && e !== undefined)
          .map((e: any) => ({
            name: e?.name,
            sets: e?.sets,
            reps: e?.reps,
            dbId: e?.dbId ?? e?.id ?? null,
          }));
      }

      const payload = { name: name.trim(), type, exercises: safeExercises };
      // Debug log to capture the exact payload being sent when debugging
      // issues reported by coaches (can be removed after verification).
      // eslint-disable-next-line no-console
      console.log("SAVE_PATTERN payload", payload);

      // Prevent saving empty patterns client-side
      if (!Array.isArray(safeExercises) || safeExercises.length === 0) {
        setError(
          "Veuillez sélectionner au moins un exercice avant de sauvegarder.",
        );
        setSaving(false);
        return;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Erreur lors de la sauvegarde.");

      onSaved(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Prefill when editing
  useEffect(() => {
    if (pattern) {
      setName(pattern.name ?? "");
      setType(pattern.type ?? "pattern");
    }
  }, [pattern]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div
        className="bg-[#181818] rounded-2xl w-full max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">
            Sauvegarder la sélection
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/50 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <p className="text-xs text-white/60">
            Vous vous apprêtez à sauvegarder {exercises.length} exercice(s) avec
            leur configuration complète (séries, répétitions, etc.).
          </p>

          <div>
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1">
              Nom du pattern
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Échauffement Haut du Corps"
              className="w-full bg-[#0a0a0a] rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-accent/40"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1">
              Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("pattern")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${type === "pattern" ? "bg-[#1f8a65]/20 text-[#1f8a65] ring-1 ring-[#1f8a65]/50" : "bg-[#0a0a0a] text-white/60 hover:text-white"}`}
              >
                Pattern régulier
              </button>
              <button
                type="button"
                onClick={() => setType("circuit")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${type === "circuit" ? "bg-[#1f8a65]/20 text-[#1f8a65] ring-1 ring-[#1f8a65]/50" : "bg-[#0a0a0a] text-white/60 hover:text-white"}`}
              >
                Circuit
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 p-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white/60 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1f8a65] text-white text-xs font-bold rounded-lg hover:bg-[#1f8a65]/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Save size={12} />
              )}
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
