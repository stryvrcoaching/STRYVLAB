"use client";

import { useState, useEffect } from "react";
import { Plus, X, Loader2, Utensils, ChevronDown } from "lucide-react";
import { MealEntry, MealType } from "@/types/assessment";

const MEAL_TYPES: MealType[] = [
  "Petit déjeuner",
  "Collation matin",
  "Déjeuner",
  "Collation après-midi",
  "Dîner",
  "Collation soir",
  "Post-entraînement",
  "Autre",
];

const MAX_MEALS = 8;

interface Props {
  value: string | undefined;
  onChange: (value: string) => void;
  submissionToken?: string;
  submissionId?: string;
}

function emptyMeal(): MealEntry {
  return {
    id: crypto.randomUUID(),
    type: "Petit déjeuner",
    time: "",
    description: "",
  };
}

export default function MealJournalField({
  value,
  onChange,
  submissionToken,
  submissionId,
}: Props) {
  const [meals, setMeals] = useState<MealEntry[]>(() => {
    if (!value) return [];
    try {
      return JSON.parse(value) as MealEntry[];
    } catch {
      return [];
    }
  });

  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [analyzeError, setAnalyzeError] = useState<Record<string, string>>({});

  // Sync meals → parent on every change
  useEffect(() => {
    if (meals.length === 0) {
      onChange("");
    } else {
      onChange(JSON.stringify(meals));
    }
  }, [meals]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateMeal(id: string, patch: Partial<MealEntry>) {
    setMeals((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        // If description changed, clear stale analysis
        if ("description" in patch && patch.description !== m.description) {
          return { ...m, ...patch, kcal: undefined, protein_g: undefined, carbs_g: undefined, fat_g: undefined };
        }
        return { ...m, ...patch };
      })
    );
  }

  function removeMeal(id: string) {
    setMeals((prev) => prev.filter((m) => m.id !== id));
    setAnalyzeError((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function addMeal() {
    if (meals.length >= MAX_MEALS) return;
    setMeals((prev) => [...prev, emptyMeal()]);
  }

  async function analyzeMeal(meal: MealEntry) {
    if (!meal.description.trim()) return;
    setAnalyzing((prev) => ({ ...prev, [meal.id]: true }));
    setAnalyzeError((prev) => {
      const next = { ...prev };
      delete next[meal.id];
      return next;
    });

    try {
      const res = await fetch("/api/assessments/meal-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: meal.description,
          ...(submissionToken ? { submissionToken } : {}),
          ...(submissionId ? { submissionId } : {}),
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Erreur réseau");
      }

      const { kcal, protein_g, carbs_g, fat_g } = await res.json();
      setMeals((prev) =>
        prev.map((m) =>
          m.id === meal.id ? { ...m, kcal, protein_g, carbs_g, fat_g } : m
        )
      );
    } catch (err) {
      setAnalyzeError((prev) => ({
        ...prev,
        [meal.id]: err instanceof Error ? err.message : "Analyse impossible — réessayez",
      }));
    } finally {
      setAnalyzing((prev) => ({ ...prev, [meal.id]: false }));
    }
  }

  const hasAnalysis = (m: MealEntry) => m.kcal !== undefined;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Utensils size={14} className="text-white/40 shrink-0" />
          <span className="text-[12px] font-semibold text-white">
            Journée alimentaire type
          </span>
        </div>
        {meals.length < MAX_MEALS && (
          <button
            type="button"
            onClick={addMeal}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-[11px] font-semibold text-white/70 hover:text-white transition-colors"
          >
            <Plus size={12} />
            Ajouter
          </button>
        )}
      </div>

      {/* Empty state */}
      {meals.length === 0 && (
        <button
          type="button"
          onClick={addMeal}
          className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.08] hover:bg-white/[0.04] transition-colors"
        >
          <Plus size={18} className="text-white/30" />
          <span className="text-[12px] text-white/40">Ajouter ton premier repas</span>
        </button>
      )}

      {/* Meal cards */}
      {meals.map((meal) => (
        <div
          key={meal.id}
          className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
        >
          {/* Card header */}
          <div className="flex items-center gap-2 px-3 pt-3 pb-2">
            {/* Type selector */}
            <div className="relative flex-1">
              <select
                value={meal.type}
                onChange={(e) => updateMeal(meal.id, { type: e.target.value as MealType })}
                className="w-full appearance-none bg-[#0a0a0a] rounded-lg pl-3 pr-7 py-2 text-[12px] font-semibold text-white outline-none focus:ring-2 focus:ring-[#1f8a65]/20 cursor-pointer"
              >
                {MEAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            </div>

            {/* Time */}
            <input
              type="time"
              value={meal.time}
              onChange={(e) => updateMeal(meal.id, { time: e.target.value })}
              className="w-[90px] shrink-0 bg-[#0a0a0a] rounded-lg px-3 py-2 text-[12px] font-mono text-white outline-none focus:ring-2 focus:ring-[#1f8a65]/20"
            />

            {/* Remove */}
            <button
              type="button"
              onClick={() => removeMeal(meal.id)}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.03] hover:bg-white/[0.07] text-white/40 hover:text-white/70 transition-colors"
            >
              <X size={13} />
            </button>
          </div>

          {/* Description */}
          <div className="px-3 pb-2">
            <textarea
              rows={2}
              value={meal.description}
              onChange={(e) => updateMeal(meal.id, { description: e.target.value })}
              placeholder="Ex : 3 œufs brouillés, 80g d'avoine, 1 banane, café noir…"
              className="w-full bg-[#0a0a0a] rounded-lg px-3 py-2 text-[12px] text-white placeholder-white/25 outline-none focus:ring-2 focus:ring-[#1f8a65]/20 resize-none"
            />
          </div>

          {/* Analyze row */}
          <div className="px-3 pb-3 flex items-center gap-3">
            <button
              type="button"
              disabled={!meal.description.trim() || analyzing[meal.id]}
              onClick={() => analyzeMeal(meal)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-semibold text-white/70 hover:text-white transition-colors"
            >
              {analyzing[meal.id] ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <span className="text-[10px]">✦</span>
              )}
              {analyzing[meal.id] ? "Analyse…" : "Estimer les kcal"}
            </button>

            {/* Analysis result */}
            {hasAnalysis(meal) && !analyzing[meal.id] && (
              <div className="flex items-center gap-2 text-[11px] text-white/60">
                <span className="font-semibold text-white/80">~{meal.kcal} kcal</span>
                <span className="text-white/30">·</span>
                <span>P {meal.protein_g}g</span>
                <span className="text-white/30">·</span>
                <span>G {meal.carbs_g}g</span>
                <span className="text-white/30">·</span>
                <span>L {meal.fat_g}g</span>
              </div>
            )}

            {/* Error */}
            {analyzeError[meal.id] && !analyzing[meal.id] && (
              <span className="text-[11px] text-red-400">{analyzeError[meal.id]}</span>
            )}
          </div>
        </div>
      ))}

      {/* Totals row — shown when ≥2 meals analyzed */}
      {(() => {
        const analyzed = meals.filter(hasAnalysis);
        if (analyzed.length < 2) return null;
        const totalKcal = analyzed.reduce((s, m) => s + (m.kcal ?? 0), 0);
        const totalP = analyzed.reduce((s, m) => s + (m.protein_g ?? 0), 0);
        const totalC = analyzed.reduce((s, m) => s + (m.carbs_g ?? 0), 0);
        const totalF = analyzed.reduce((s, m) => s + (m.fat_g ?? 0), 0);
        const allAnalyzed = analyzed.length === meals.length;
        return (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <span className="text-[11px] text-white/40 shrink-0">
              {allAnalyzed ? "Total journée" : `Total (${analyzed.length}/${meals.length} repas)`}
            </span>
            <span className="text-white/20 text-[10px]">·</span>
            <span className="text-[12px] font-semibold text-white/80">{totalKcal} kcal</span>
            <span className="text-white/20 text-[10px]">·</span>
            <span className="text-[11px] text-white/60">P {totalP}g</span>
            <span className="text-white/20 text-[10px]">·</span>
            <span className="text-[11px] text-white/60">G {totalC}g</span>
            <span className="text-white/20 text-[10px]">·</span>
            <span className="text-[11px] text-white/60">L {totalF}g</span>
          </div>
        );
      })()}
    </div>
  );
}
