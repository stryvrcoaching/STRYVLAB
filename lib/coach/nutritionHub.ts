export type NutritionHubDayKind = "training" | "off" | "unknown";
export type NutritionHubCompleteness = "complete" | "partial" | "missing";
export type NutritionHubAgendaStatus =
  | "on_target"
  | "under"
  | "over"
  | "partial"
  | "missing"
  | "no_target";

export type NutritionHubDayInput = {
  dayKind: NutritionHubDayKind;
  completeness: NutritionHubCompleteness;
  consumed: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    hydration_ml: number;
  };
  target: {
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    hydration_ml: number | null;
  };
};

export type NutritionHubInsightInput = {
  dayKind: NutritionHubDayKind;
  completeness: NutritionHubCompleteness;
  adherence: {
    protein: number | null;
    carbs: number | null;
    hydration: number | null;
  };
  deltaPct: {
    calories: number | null;
  };
};

export type NutritionHubInsight = {
  id: string;
  severity: "good" | "watch" | "alert";
  title: string;
  message: string;
};

export function deriveNutritionHeroStatus(input: {
  nutritionScore: number | null;
  partialDays: number;
  validDays: number;
  insights: Array<{
    severity: "good" | "watch" | "alert";
    title: string;
    message: string;
  }>;
}) {
  const partialRatio = input.validDays > 0 ? input.partialDays / input.validDays : 0;
  const hasAlert = input.insights.some((item) => item.severity === "alert");

  if (partialRatio >= 0.35) {
    return {
      label: "Lecture fragile",
      tone: "amber" as const,
      detail: "Plusieurs journées restent incomplètes sur la fenêtre active.",
    };
  }

  if ((input.nutritionScore ?? 1) < 0.7 || hasAlert) {
    return {
      label: "À corriger",
      tone: "amber" as const,
      detail: "Un ou plusieurs signaux nutritionnels demandent un ajustement.",
    };
  }

  return {
    label: "Sous contrôle",
    tone: "green" as const,
    detail: "L'exécution nutritionnelle reste globalement cohérente.",
  };
}

export function deriveNutritionHeroSummary(input: {
  adherenceCalories: number | null;
  adherenceProtein: number | null;
  adherenceCarbs: number | null;
  adherenceFat: number | null;
  adherenceHydration: number | null;
  partialDays: number;
}) {
  const dimensions = [
    { key: "protéines", value: input.adherenceProtein },
    { key: "hydratation", value: input.adherenceHydration },
    { key: "glucides", value: input.adherenceCarbs },
    { key: "calories", value: input.adherenceCalories },
    { key: "lipides", value: input.adherenceFat },
  ].filter((item): item is { key: string; value: number } => item.value != null);

  dimensions.sort((a, b) => a.value - b.value);
  const weakest = dimensions.slice(0, 2).map((item) => item.key);

  if (input.partialDays > 0) {
    return "Lecture utile mais à nuancer : plusieurs journées restent incomplètes.";
  }

  if (weakest.length === 0) {
    return "Les données nutritionnelles restent encore trop faibles pour conclure.";
  }

  if (weakest.length === 1) {
    return `Le signal principal à surveiller concerne ${weakest[0]}.`;
  }

  return `Les écarts se concentrent surtout sur ${weakest[0]} et ${weakest[1]}.`;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function computeNutritionAdherence(
  consumed: number,
  target: number | null,
): number | null {
  if (target == null || target <= 0) return null;
  return round2(clamp01(consumed / target));
}

export function computeNutritionAchievement(
  consumed: number,
  target: number | null,
): number | null {
  if (target == null || target <= 0) return null;
  return round2(consumed / target);
}

export function computeNutritionDeltaPct(
  consumed: number,
  target: number | null,
): number | null {
  if (target == null || target <= 0) return null;
  return round2((consumed - target) / target);
}

export function classifyNutritionAgendaDay(input: {
  completeness: NutritionHubCompleteness;
  consumed: { calories: number };
  target: { calories: number | null };
}): NutritionHubAgendaStatus {
  if (input.completeness === "missing") return "missing";
  if (input.completeness === "partial") return "partial";
  if (input.target.calories == null) return "no_target";

  const deltaPct = computeNutritionDeltaPct(
    input.consumed.calories,
    input.target.calories,
  );

  if (deltaPct == null) return "no_target";
  if (Math.abs(deltaPct) <= 0.1) return "on_target";
  return deltaPct > 0 ? "over" : "under";
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value != null);
  if (valid.length === 0) return null;
  return round2(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

export function buildNutritionHubSummary(days: NutritionHubDayInput[]) {
  const validDays = days.filter(
    (day) => day.completeness === "complete" && day.target.calories != null,
  );

  const adherenceCalories = average(
    validDays.map((day) =>
      computeNutritionAdherence(day.consumed.calories, day.target.calories),
    ),
  );
  const adherenceProtein = average(
    validDays.map((day) =>
      computeNutritionAdherence(day.consumed.protein_g, day.target.protein_g),
    ),
  );
  const adherenceCarbs = average(
    validDays.map((day) =>
      computeNutritionAdherence(day.consumed.carbs_g, day.target.carbs_g),
    ),
  );
  const adherenceFat = average(
    validDays.map((day) =>
      computeNutritionAdherence(day.consumed.fat_g, day.target.fat_g),
    ),
  );
  const adherenceHydration = average(
    validDays.map((day) =>
      computeNutritionAdherence(
        day.consumed.hydration_ml,
        day.target.hydration_ml,
      ),
    ),
  );

  const achievedCalories = average(
    validDays.map((day) =>
      computeNutritionAchievement(day.consumed.calories, day.target.calories),
    ),
  );
  const achievedProtein = average(
    validDays.map((day) =>
      computeNutritionAchievement(day.consumed.protein_g, day.target.protein_g),
    ),
  );
  const achievedCarbs = average(
    validDays.map((day) =>
      computeNutritionAchievement(day.consumed.carbs_g, day.target.carbs_g),
    ),
  );
  const achievedFat = average(
    validDays.map((day) =>
      computeNutritionAchievement(day.consumed.fat_g, day.target.fat_g),
    ),
  );
  const achievedHydration = average(
    validDays.map((day) =>
      computeNutritionAchievement(
        day.consumed.hydration_ml,
        day.target.hydration_ml,
      ),
    ),
  );

  const weightedDimensions: Array<[number | null, number]> = [
    [adherenceCalories, 0.25],
    [adherenceProtein, 0.3],
    [adherenceCarbs, 0.15],
    [adherenceFat, 0.1],
    [adherenceHydration, 0.2],
  ];

  const usableDimensions = weightedDimensions.filter(
    (dimension): dimension is [number, number] => dimension[0] != null,
  );

  return {
    adherenceCalories,
    adherenceProtein,
    adherenceCarbs,
    adherenceFat,
    adherenceHydration,
    achievedCalories,
    achievedProtein,
    achievedCarbs,
    achievedFat,
    achievedHydration,
    nutritionScore:
      usableDimensions.length > 0
        ? round2(
            usableDimensions.reduce(
              (sum, [value, weight]) => sum + value * weight,
              0,
            ),
          )
        : null,
    validDays: validDays.length,
  };
}

export function buildNutritionHubInsights(
  days: NutritionHubInsightInput[],
): NutritionHubInsight[] {
  const insights: NutritionHubInsight[] = [];

  const completeDays = days.filter((day) => day.completeness === "complete");

  const lowProteinDays = completeDays.filter(
    (day) => (day.adherence.protein ?? 1) < 0.85,
  ).length;
  if (lowProteinDays >= 4) {
    insights.push({
      id: "protein-low",
      severity: "alert",
      title: "Protéines insuffisantes",
      message: `Protéines sous cible ${lowProteinDays} jours sur la fenêtre observée.`,
    });
  }

  const lowHydrationDays = completeDays.filter(
    (day) => (day.adherence.hydration ?? 1) < 0.75,
  ).length;
  if (lowHydrationDays >= 3) {
    insights.push({
      id: "hydration-low",
      severity: "watch",
      title: "Hydratation instable",
      message: `Hydratation insuffisante sur ${lowHydrationDays} journées complètes.`,
    });
  }

  const lowTrainingCarbs = completeDays.filter(
    (day) =>
      day.dayKind === "training" && (day.adherence.carbs ?? 1) < 0.8,
  ).length;
  if (lowTrainingCarbs >= 3) {
    insights.push({
      id: "carbs-training-low",
      severity: "watch",
      title: "Glucides trop bas à l'entraînement",
      message: `Apport glucidique sous cible sur ${lowTrainingCarbs} jours d'entraînement.`,
    });
  }

  const offDayOverages = completeDays.filter(
    (day) => day.dayKind === "off" && (day.deltaPct.calories ?? 0) > 0.1,
  ).length;
  if (offDayOverages >= 2) {
    insights.push({
      id: "off-day-over",
      severity: "watch",
      title: "Dépassement les jours off",
      message: `Surconsommation repérée sur ${offDayOverages} jours off.`,
    });
  }

  const partialDays = days.filter((day) => day.completeness === "partial").length;
  if (days.length > 0 && partialDays / days.length >= 0.3) {
    insights.push({
      id: "partial-data",
      severity: "watch",
      title: "Données incomplètes",
      message: "Plusieurs journées sont incomplètes, l'analyse doit être nuancée.",
    });
  }

  return insights.slice(0, 5);
}
