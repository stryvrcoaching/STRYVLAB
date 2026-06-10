"use client";

import { AlertCircle } from "lucide-react";
import type { NutritionClientData } from "@/lib/nutrition/types";
import type { NutritionDataMode } from "./useNutritionStudio";

type MissingDataKey = "bmr" | "weight" | "height" | "bf" | "steps" | "lean_mass" | "muscle_mass";

interface Props {
  clientData: NutritionClientData | null;
  macroResult: {
    breakdown: { bmr: number };
  } | null;
  dataMode?: NutritionDataMode;
  dataSource?: Record<string, 'selected' | 'fallback' | 'manual'>;
  onDataClick?: (key: MissingDataKey) => void;
}

// Volatile fields = change between bilans, need alert if fallback
const VOLATILE_FIELDS: MissingDataKey[] = ["bmr", "weight", "bf", "steps", "lean_mass", "muscle_mass"];

// Stable fields = don't change, silent fallback OK
const STABLE_FIELDS: MissingDataKey[] = ["height"];

export default function MissingDataAlerts({
  clientData,
  macroResult,
  dataMode = "bilan",
  dataSource = {},
  onDataClick,
}: Props) {
  if (!clientData) return null;

  const missing: { label: string; metric: MissingDataKey; reason: string }[] = [];

  if (!clientData.weight_kg) {
    missing.push({
      label: "Poids",
      metric: "weight",
      reason:
        dataMode === "realtime"
          ? "Le calcul du jour manque d'une mesure de poids récente."
          : "Le bilan sélectionné ne contient pas de poids.",
    });
  } else if (dataSource["weight_kg"] === "fallback") {
    missing.push({
      label: "Poids",
      metric: "weight",
      reason: "Le poids affiché vient d'une source plus ancienne que le bilan sélectionné.",
    });
  }

  if (!clientData.daily_steps) {
    missing.push({
      label: "Nombre de pas",
      metric: "steps",
      reason:
        dataMode === "realtime"
          ? "Pas assez de données récentes pour estimer l'activité quotidienne."
          : "Le bilan sélectionné n'a pas de base récente sur l'activité quotidienne.",
    });
  } else if (dataSource["daily_steps"] === "fallback") {
    missing.push({
      label: "Nombre de pas",
      metric: "steps",
      reason: "Le niveau d'activité affiché vient d'une source plus ancienne.",
    });
  }

  if (dataMode === "bilan") {
    if (!clientData.bmr_kcal_measured && !macroResult?.breakdown.bmr) {
      missing.push({
        label: "Métabolisme de base",
        metric: "bmr",
        reason: "Le bilan sélectionné ne permet pas d'estimer correctement le métabolisme.",
      });
    } else if (dataSource["bmr_kcal_measured"] === "fallback") {
      missing.push({
        label: "Métabolisme de base",
        metric: "bmr",
        reason: "La base métabolique affichée vient d'un bilan plus ancien.",
      });
    }

    if (!clientData.body_fat_pct) {
      missing.push({
        label: "Masse grasse",
        metric: "bf",
        reason: "Le bilan sélectionné ne contient pas de masse grasse.",
      });
    } else if (dataSource["body_fat_pct"] === "fallback") {
      missing.push({
        label: "Masse grasse",
        metric: "bf",
        reason: "La masse grasse affichée vient d'un bilan plus ancien.",
      });
    }
  }

  // STABLE fields — only alert if NEVER entered (not from fallback)
  if (!clientData.height_cm && !dataSource["height_cm"]) {
    missing.push({
      label: "Taille",
      metric: "height",
      reason: "La taille n'a jamais été renseignée.",
    });
  }

  if (missing.length === 0) return null;

  return (
    <div className="space-y-2 pb-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-400/70">
        Données à vérifier
      </p>
      {missing.map((item) => (
        <button
          key={item.metric}
          onClick={() => onDataClick?.(item.metric)}
          className="w-full flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border-[0.3px] border-amber-500/20 hover:bg-amber-500/15 hover:border-amber-500/30 transition-all text-left cursor-pointer active:scale-[0.98]"
        >
          <AlertCircle size={12} className="text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-amber-300/80 font-medium">{item.label}</p>
            <p className="text-[9px] text-amber-300/60">{item.reason}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
