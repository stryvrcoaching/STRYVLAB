export type NutritionDataMode = "bilan" | "realtime";

export type NutritionSignalCategory =
  | "structural"
  | "dynamic"
  | "hybrid";

export type NutritionSignalSource =
  | "assessment"
  | "checkin"
  | "manual_override"
  | "profile"
  | "derived";

export type NutritionSignalKey =
  | "weight_kg"
  | "height_cm"
  | "body_fat_pct"
  | "lean_mass_kg"
  | "muscle_mass_kg"
  | "visceral_fat_level"
  | "bmr_kcal_measured"
  | "weekly_frequency"
  | "session_duration_min"
  | "training_calories_weekly"
  | "daily_steps"
  | "cardio_frequency"
  | "cardio_duration_min"
  | "sleep_duration_h"
  | "sleep_quality"
  | "stress_level"
  | "energy_level"
  | "caffeine_daily_mg"
  | "alcohol_weekly"
  | "work_hours_per_week"
  | "occupation_multiplier";

export type NutritionSignalGovernance = {
  category: NutritionSignalCategory;
  calculationRole: string;
  defaultSource: NutritionSignalSource;
  fallbackSources: NutritionSignalSource[];
  realtime: {
    enabled: boolean;
    windowDays: number | null;
  };
  bilan: {
    useSelectedBilan: boolean;
    allowAnchoredRealtimeOverlay: boolean;
    overlayWindowDays: number | null;
  };
};

export const DEFAULT_REALTIME_WINDOW_DAYS = 7;

export const NUTRITION_SIGNAL_GOVERNANCE: Record<
  NutritionSignalKey,
  NutritionSignalGovernance
> = {
  weight_kg: {
    category: "hybrid",
    calculationRole: "BMR, macros, NEAT, hydration",
    defaultSource: "assessment",
    fallbackSources: ["checkin", "manual_override"],
    realtime: { enabled: true, windowDays: DEFAULT_REALTIME_WINDOW_DAYS },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: true,
      overlayWindowDays: DEFAULT_REALTIME_WINDOW_DAYS,
    },
  },
  height_cm: {
    category: "structural",
    calculationRole: "BMR fallback",
    defaultSource: "assessment",
    fallbackSources: ["manual_override"],
    realtime: { enabled: false, windowDays: null },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
  body_fat_pct: {
    category: "structural",
    calculationRole: "LBM, deficit stratification",
    defaultSource: "assessment",
    fallbackSources: ["manual_override", "derived"],
    realtime: { enabled: false, windowDays: null },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
  lean_mass_kg: {
    category: "structural",
    calculationRole: "Protein ratios",
    defaultSource: "assessment",
    fallbackSources: ["manual_override", "derived"],
    realtime: { enabled: false, windowDays: null },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
  muscle_mass_kg: {
    category: "structural",
    calculationRole: "LBM priority signal",
    defaultSource: "assessment",
    fallbackSources: ["manual_override", "derived"],
    realtime: { enabled: false, windowDays: null },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
  visceral_fat_level: {
    category: "structural",
    calculationRole: "Risk and deficit modulation",
    defaultSource: "assessment",
    fallbackSources: ["manual_override"],
    realtime: { enabled: false, windowDays: null },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
  bmr_kcal_measured: {
    category: "structural",
    calculationRole: "Measured BMR override",
    defaultSource: "assessment",
    fallbackSources: ["manual_override"],
    realtime: { enabled: false, windowDays: null },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
  weekly_frequency: {
    category: "hybrid",
    calculationRole: "EAT frequency",
    defaultSource: "assessment",
    fallbackSources: ["profile", "manual_override"],
    realtime: { enabled: false, windowDays: null },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
  session_duration_min: {
    category: "hybrid",
    calculationRole: "EAT duration",
    defaultSource: "assessment",
    fallbackSources: ["manual_override"],
    realtime: { enabled: false, windowDays: null },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
  training_calories_weekly: {
    category: "hybrid",
    calculationRole: "EAT tracker override",
    defaultSource: "assessment",
    fallbackSources: ["manual_override"],
    realtime: { enabled: false, windowDays: null },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
  daily_steps: {
    category: "dynamic",
    calculationRole: "NEAT",
    defaultSource: "checkin",
    fallbackSources: ["assessment", "manual_override"],
    realtime: { enabled: true, windowDays: DEFAULT_REALTIME_WINDOW_DAYS },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
  cardio_frequency: {
    category: "hybrid",
    calculationRole: "Cardio EAT frequency",
    defaultSource: "assessment",
    fallbackSources: ["manual_override"],
    realtime: { enabled: false, windowDays: null },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
  cardio_duration_min: {
    category: "hybrid",
    calculationRole: "Cardio EAT duration",
    defaultSource: "assessment",
    fallbackSources: ["manual_override"],
    realtime: { enabled: false, windowDays: null },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
  sleep_duration_h: {
    category: "dynamic",
    calculationRole: "Recovery modulation",
    defaultSource: "checkin",
    fallbackSources: ["assessment"],
    realtime: { enabled: true, windowDays: DEFAULT_REALTIME_WINDOW_DAYS },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: true,
      overlayWindowDays: DEFAULT_REALTIME_WINDOW_DAYS,
    },
  },
  sleep_quality: {
    category: "dynamic",
    calculationRole: "Recovery modulation",
    defaultSource: "checkin",
    fallbackSources: ["assessment"],
    realtime: { enabled: true, windowDays: DEFAULT_REALTIME_WINDOW_DAYS },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: true,
      overlayWindowDays: DEFAULT_REALTIME_WINDOW_DAYS,
    },
  },
  stress_level: {
    category: "dynamic",
    calculationRole: "Recovery modulation",
    defaultSource: "checkin",
    fallbackSources: ["assessment"],
    realtime: { enabled: true, windowDays: DEFAULT_REALTIME_WINDOW_DAYS },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: true,
      overlayWindowDays: DEFAULT_REALTIME_WINDOW_DAYS,
    },
  },
  energy_level: {
    category: "dynamic",
    calculationRole: "Recovery and coaching context",
    defaultSource: "checkin",
    fallbackSources: ["assessment"],
    realtime: { enabled: true, windowDays: DEFAULT_REALTIME_WINDOW_DAYS },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: true,
      overlayWindowDays: DEFAULT_REALTIME_WINDOW_DAYS,
    },
  },
  caffeine_daily_mg: {
    category: "hybrid",
    calculationRole: "BMR correction",
    defaultSource: "assessment",
    fallbackSources: ["manual_override"],
    realtime: { enabled: false, windowDays: null },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
  alcohol_weekly: {
    category: "hybrid",
    calculationRole: "TDEE correction",
    defaultSource: "assessment",
    fallbackSources: ["manual_override"],
    realtime: { enabled: false, windowDays: null },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
  work_hours_per_week: {
    category: "hybrid",
    calculationRole: "NEAT correction",
    defaultSource: "assessment",
    fallbackSources: ["manual_override"],
    realtime: { enabled: false, windowDays: null },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
  occupation_multiplier: {
    category: "hybrid",
    calculationRole: "NEAT multiplier",
    defaultSource: "assessment",
    fallbackSources: ["profile", "derived"],
    realtime: { enabled: false, windowDays: null },
    bilan: {
      useSelectedBilan: true,
      allowAnchoredRealtimeOverlay: false,
      overlayWindowDays: null,
    },
  },
};

export function getNutritionSignalGovernance(key: NutritionSignalKey) {
  return NUTRITION_SIGNAL_GOVERNANCE[key];
}

export function getNutritionSignalWindowDays(
  key: NutritionSignalKey,
  mode: NutritionDataMode,
): number | null {
  const governance = getNutritionSignalGovernance(key);
  return mode === "realtime"
    ? governance.realtime.windowDays
    : governance.bilan.overlayWindowDays;
}

export function canUseRealtimeSignal(
  key: NutritionSignalKey,
  mode: NutritionDataMode,
): boolean {
  const governance = getNutritionSignalGovernance(key);
  return mode === "realtime"
    ? governance.realtime.enabled
    : governance.bilan.allowAnchoredRealtimeOverlay;
}

export function getNutritionSignalSourceLabel(
  key: NutritionSignalKey,
  mode: NutritionDataMode,
  dataSource?: "selected" | "fallback" | "manual",
): string {
  if (dataSource === "manual") {
    return "saisie manuelle";
  }
  if (dataSource === "fallback") {
    return mode === "realtime" ? "dernier bilan" : "valeur héritée";
  }
  if (mode === "realtime") {
    if (key === "weight_kg") return "mesure récente";
    if (
      key === "daily_steps" ||
      key === "sleep_duration_h" ||
      key === "sleep_quality" ||
      key === "stress_level" ||
      key === "energy_level"
    ) {
      return "moyenne récente";
    }
    if (key === "bmr_kcal_measured") return "mesure ancienne";
    return canUseRealtimeSignal(key, mode) ? "temps réel" : "base stable";
  }
  return "bilan";
}

export function getNutritionSignalLabel(key: NutritionSignalKey): string {
  const labels: Record<NutritionSignalKey, string> = {
    weight_kg: "poids",
    height_cm: "taille",
    body_fat_pct: "masse grasse",
    lean_mass_kg: "masse maigre",
    muscle_mass_kg: "masse musculaire",
    visceral_fat_level: "graisse viscérale",
    bmr_kcal_measured: "métabolisme de base",
    weekly_frequency: "fréquence d'entraînement",
    session_duration_min: "durée des séances",
    training_calories_weekly: "calories d'entraînement",
    daily_steps: "nombre de pas",
    cardio_frequency: "fréquence cardio",
    cardio_duration_min: "durée cardio",
    sleep_duration_h: "durée de sommeil",
    sleep_quality: "qualité du sommeil",
    stress_level: "niveau de stress",
    energy_level: "niveau d'énergie",
    caffeine_daily_mg: "caféine",
    alcohol_weekly: "alcool",
    work_hours_per_week: "temps de travail",
    occupation_multiplier: "activité quotidienne",
  };

  return labels[key];
}
