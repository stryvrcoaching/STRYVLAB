import type { NutritionClientData } from "@/lib/nutrition/types";
import {
  canUseRealtimeSignal,
  getNutritionSignalGovernance,
  type NutritionDataMode,
  type NutritionSignalKey,
} from "@/lib/nutrition/dataGovernance";

export type NutritionDataQualitySignal = {
  key: NutritionSignalKey;
  score: number;
  reason: string;
};

export type NutritionDataQualitySummary = {
  score: number;
  confidence: "high" | "medium" | "low";
  signals: NutritionDataQualitySignal[];
  notes: string[];
};

const QUALITY_KEYS: NutritionSignalKey[] = [
  "weight_kg",
  "height_cm",
  "body_fat_pct",
  "lean_mass_kg",
  "muscle_mass_kg",
  "bmr_kcal_measured",
  "daily_steps",
  "sleep_duration_h",
  "stress_level",
];

function readClientValue(clientData: NutritionClientData, key: NutritionSignalKey) {
  return clientData[key as keyof NutritionClientData];
}

function scoreSignal(
  key: NutritionSignalKey,
  mode: NutritionDataMode,
  value: unknown,
  dataSource?: "selected" | "fallback" | "manual" | "estimated",
): NutritionDataQualitySignal {
  const governance = getNutritionSignalGovernance(key);
  const isRealtimeCompositionSignal =
    mode === "realtime" &&
    (key === "body_fat_pct" || key === "lean_mass_kg" || key === "muscle_mass_kg");

  if (value == null) {
    if (isRealtimeCompositionSignal) {
      return { key, score: 0.55, reason: "optional_realtime_missing" };
    }
    return { key, score: 0, reason: "absent" };
  }

  if (dataSource === "estimated") {
    return {
      key,
      score: isRealtimeCompositionSignal ? 0.72 : 0.78,
      reason: "estimated",
    };
  }

  if (dataSource === "fallback") {
    return { key, score: 0.45, reason: "fallback" };
  }

  if (mode === "realtime" && governance.category === "structural") {
    return { key, score: 0.65, reason: "base_structurelle" };
  }

  if (mode === "realtime" && canUseRealtimeSignal(key, mode)) {
    return { key, score: 1, reason: "live" };
  }

  if (mode === "bilan" && canUseRealtimeSignal(key, mode)) {
    return { key, score: 0.9, reason: "ancre_bilan" };
  }

  return { key, score: 0.85, reason: "selection_principale" };
}

export function buildNutritionDataQualitySummary(params: {
  clientData: NutritionClientData | null;
  dataMode: NutritionDataMode;
  dataSource: Record<string, "selected" | "fallback" | "manual" | "estimated">;
}): NutritionDataQualitySummary | null {
  const { clientData, dataMode, dataSource } = params;
  if (!clientData) return null;

  const signals = QUALITY_KEYS.map((key) =>
    scoreSignal(key, dataMode, readClientValue(clientData, key), dataSource[key]),
  );

  const weights = signals.map((signal) => {
    const governance = getNutritionSignalGovernance(signal.key);
    if (governance.category === "structural") return 1.2;
    if (governance.category === "dynamic") return 1;
    return 1.1;
  });

  const weightedTotal = signals.reduce(
    (acc, signal, index) => acc + signal.score * weights[index],
    0,
  );
  const weightSum = weights.reduce((acc, value) => acc + value, 0);
  const score = Math.round((weightedTotal / Math.max(weightSum, 1)) * 100);

  const notes = signals
    .filter((signal) => signal.score < 0.7)
    .map((signal) => `${signal.key}:${signal.reason}`);

  const confidence =
    score >= 75 ? "high" : score >= 55 ? "medium" : "low";

  return {
    score,
    confidence,
    signals,
    notes,
  };
}
