export type TransformationPhase =
  | "cut"
  | "aggressive_cut"
  | "maintenance"
  | "recomp"
  | "lean_bulk"
  | "mass_gain"
  | "diet_break"
  | "peak_week";

export type TransformationPhaseFamily = "cut" | "bulk" | "maintenance" | "recomp";
export type TransformationMacroGoal = "deficit" | "maintenance" | "surplus";
export type TransformationTrainingGoalProfile =
  | "fat_loss"
  | "hypertrophy"
  | "recomp"
  | "maintenance";

export const TRANSFORMATION_PHASE_OPTIONS: Array<{
  value: TransformationPhase;
  label: string;
  shortLabel: string;
  family: TransformationPhaseFamily;
  macroGoal: TransformationMacroGoal;
  description: string;
}> = [
  {
    value: "cut",
    label: "Cut",
    shortLabel: "Cut",
    family: "cut",
    macroGoal: "deficit",
    description: "Sèche structurée avec déficit contrôlé.",
  },
  {
    value: "aggressive_cut",
    label: "Cut strict",
    shortLabel: "Cut strict",
    family: "cut",
    macroGoal: "deficit",
    description: "Déficit plus agressif, souvent orienté compétition ou timeline courte.",
  },
  {
    value: "maintenance",
    label: "Maintenance",
    shortLabel: "Maintenance",
    family: "maintenance",
    macroGoal: "maintenance",
    description: "Stabilisation du poids, de la récupération et de l'exécution.",
  },
  {
    value: "recomp",
    label: "Recomposition",
    shortLabel: "Recomp",
    family: "recomp",
    macroGoal: "maintenance",
    description: "Amélioration corporelle progressive à apport proche du maintien.",
  },
  {
    value: "lean_bulk",
    label: "Lean bulk",
    shortLabel: "Lean bulk",
    family: "bulk",
    macroGoal: "surplus",
    description: "Prise de muscle maîtrisée avec surplus léger.",
  },
  {
    value: "mass_gain",
    label: "Prise de masse",
    shortLabel: "Masse",
    family: "bulk",
    macroGoal: "surplus",
    description: "Phase de gain pondéral plus offensive.",
  },
  {
    value: "diet_break",
    label: "Recharge",
    shortLabel: "Recharge",
    family: "maintenance",
    macroGoal: "maintenance",
    description: "Pause stratégique pour restaurer l'adhérence et la récupération.",
  },
  {
    value: "peak_week",
    label: "Peak week",
    shortLabel: "Peak week",
    family: "cut",
    macroGoal: "maintenance",
    description: "Semaine de préparation finale avec réglages fins.",
  },
];

const TRANSFORMATION_PHASE_SET = new Set(
  TRANSFORMATION_PHASE_OPTIONS.map((option) => option.value),
);

export function isTransformationPhase(value: string | null | undefined): value is TransformationPhase {
  return typeof value === "string" && TRANSFORMATION_PHASE_SET.has(value as TransformationPhase);
}

export function getTransformationPhaseMeta(phase: TransformationPhase) {
  return TRANSFORMATION_PHASE_OPTIONS.find((option) => option.value === phase)!;
}

export function getTransformationPhaseLabel(
  phase: string | null | undefined,
): string | null {
  if (!phase || !isTransformationPhase(phase)) return null;
  return getTransformationPhaseMeta(phase).label;
}

export function getTransformationPhaseShortLabel(
  phase: string | null | undefined,
): string | null {
  if (!phase || !isTransformationPhase(phase)) return null;
  return getTransformationPhaseMeta(phase).shortLabel;
}

export function transformationPhaseToMacroGoal(
  phase: TransformationPhase | null | undefined,
): TransformationMacroGoal {
  if (!phase || !isTransformationPhase(phase)) return "maintenance";
  return getTransformationPhaseMeta(phase).macroGoal;
}

export function transformationPhaseToFamily(
  phase: TransformationPhase | null | undefined,
): TransformationPhaseFamily {
  if (!phase || !isTransformationPhase(phase)) return "recomp";
  return getTransformationPhaseMeta(phase).family;
}

export function transformationPhaseToTrainingGoalProfile(
  phase: TransformationPhase | null | undefined,
): TransformationTrainingGoalProfile {
  const family = transformationPhaseToFamily(phase);
  if (phase === "diet_break") return "maintenance";
  if (phase === "peak_week") return "fat_loss";
  if (family === "cut") return "fat_loss";
  if (family === "bulk") return "hypertrophy";
  if (family === "recomp") return "recomp";
  return "maintenance";
}

export function inferTransformationPhaseFromTrainingGoal(
  trainingGoal: string | null | undefined,
): TransformationPhase {
  const g = (trainingGoal ?? "").toLowerCase().trim();
  if (g === "fat_loss" || g === "weight_loss" || g === "cut") return "cut";
  if (g === "hypertrophy" || g === "muscle_gain" || g === "bulk") return "lean_bulk";
  if (g === "maintenance") return "maintenance";
  if (g === "recomp") return "recomp";
  if (g === "strength" || g === "endurance" || g === "athletic") return "recomp";
  return "maintenance";
}

export function resolveTransformationPhase(input: {
  transformationPhase?: string | null;
  trainingGoal?: string | null;
}): TransformationPhase {
  if (isTransformationPhase(input.transformationPhase)) {
    return input.transformationPhase;
  }
  return inferTransformationPhaseFromTrainingGoal(input.trainingGoal);
}

export function computePhaseDrivenCalorieAdjustPct(input: {
  phase: TransformationPhase | null | undefined;
  bodyFat: number | null;
  weeklyFrequency: number;
  basePreset: (goal: TransformationMacroGoal, bodyFat: number | null, weeklyFrequency: number) => number;
}): number {
  const resolvedPhase = resolveTransformationPhase({
    transformationPhase: input.phase,
  });
  const macroGoal = transformationPhaseToMacroGoal(resolvedPhase);
  const base = input.basePreset(macroGoal, input.bodyFat, input.weeklyFrequency);

  switch (resolvedPhase) {
    case "aggressive_cut":
      return Math.max(-35, base - 5);
    case "recomp":
      return Math.min(0, Math.max(-6, base));
    case "lean_bulk":
      return Math.min(6, base);
    case "mass_gain":
      return Math.min(12, base + 3);
    case "diet_break":
    case "peak_week":
    case "maintenance":
      return 0;
    case "cut":
    default:
      return base;
  }
}
