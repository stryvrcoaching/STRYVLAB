import type {
  NutritionDataQualitySignal,
  NutritionDataQualitySummary,
} from "@/lib/nutrition/dataQuality";
import {
  getNutritionSignalLabel,
  type NutritionDataMode,
} from "@/lib/nutrition/dataGovernance";

export type NutritionDataQualityIssue = {
  key: NutritionDataQualitySignal["key"];
  label: string;
  reason: NutritionDataQualitySignal["reason"];
  summary: string;
  action: string;
};

export function getNutritionDataConfidenceLabel(
  confidence?: "high" | "medium" | "low",
): string {
  if (confidence === "high") return "élevée";
  if (confidence === "medium") return "moyenne";
  return "faible";
}

function describeSignalIssue(
  signal: NutritionDataQualitySignal,
  mode: NutritionDataMode,
): NutritionDataQualityIssue {
  const label = getNutritionSignalLabel(signal.key);

  if (signal.reason === "absent") {
    const action =
      signal.key === "daily_steps"
        ? "Active les pas dans le check-in du soir, ou renseigne une moyenne de pas dans le bilan."
        : signal.key === "weight_kg"
          ? "Ajoute un poids récent via le check-in ou via le bilan."
          : signal.key === "body_fat_pct"
            ? "Ajoute une masse grasse dans un bilan complet si tu veux fiabiliser la composition corporelle."
            : signal.key === "bmr_kcal_measured"
              ? "Le moteur peut estimer le BMR du jour, mais un bilan récent donnera une base plus précise."
              : `Complète ${label} dans le bilan ou dans les données client.`;

    return {
      key: signal.key,
      label,
      reason: signal.reason,
      summary: `${capitalize(label)} absente.`,
      action,
    };
  }

  if (signal.reason === "fallback") {
    return {
      key: signal.key,
      label,
      reason: signal.reason,
      summary: `${capitalize(label)} héritée d'une donnée plus ancienne.`,
      action:
        signal.key === "daily_steps"
          ? "Si le coach ne suit pas les pas en check-in, confirme la moyenne hebdomadaire dans le bilan."
          : `Reconfirme ${label} avec une mesure plus récente avant d'ajuster agressivement.`,
    };
  }

  if (signal.reason === "estimated") {
    return {
      key: signal.key,
      label,
      reason: signal.reason,
      summary: `${capitalize(label)} estimée.`,
      action:
        signal.key === "body_fat_pct"
          ? "Le calcul peut avancer avec cette estimation, mais confirme-la par mesure directe si tu veux augmenter la fiabilité."
          : `Garde cette estimation comme base de travail, puis confirme ${label} lors d'un bilan plus complet.`,
    };
  }

  if (signal.reason === "optional_realtime_missing" && mode === "realtime") {
    return {
      key: signal.key,
      label,
      reason: signal.reason,
      summary: `${capitalize(label)} absente, mais secondaire en temps réel.`,
      action: "Tu peux continuer avec les signaux récents du jour. Mets à jour la composition corporelle si tu veux raffiner la base structurelle.",
    };
  }

  if (signal.reason === "base_structurelle" && mode === "realtime") {
    return {
      key: signal.key,
      label,
      reason: signal.reason,
      summary: `${capitalize(label)} conservée comme base ancienne, surtout informative en temps réel.`,
      action:
        signal.key === "bmr_kcal_measured"
          ? "Le calcul du jour repose déjà sur une estimation. Mets à jour le bilan si tu veux réutiliser un BMR mesuré."
          : `Mets à jour ${label} dans un bilan récent si cette donnée doit redevenir structurante.`,
    };
  }

  if (signal.reason === "ancre_bilan") {
    return {
      key: signal.key,
      label,
      reason: signal.reason,
      summary: `${capitalize(label)} recalée autour du bilan sélectionné.`,
      action: "Vérifie que la fenêtre choisie correspond bien à la période analysée.",
    };
  }

  return {
    key: signal.key,
    label,
    reason: signal.reason,
    summary: `${capitalize(label)} disponible.`,
    action: "Aucune action prioritaire.",
  };
}

export function getNutritionDataQualityIssues(
  summary: NutritionDataQualitySummary | null | undefined,
  mode: NutritionDataMode,
): NutritionDataQualityIssue[] {
  if (!summary) return [];

  return summary.signals
    .filter((signal) => signal.score < 0.7)
    .sort((a, b) => a.score - b.score)
    .map((signal) => describeSignalIssue(signal, mode));
}

export function buildNutritionDataQualityHeadline(
  summary: NutritionDataQualitySummary | null | undefined,
  mode: NutritionDataMode,
): string | null {
  if (!summary) return null;

  const issues = getNutritionDataQualityIssues(summary, mode);
  if (issues.length === 0) {
    return `Base ${getNutritionDataConfidenceLabel(summary.confidence)} : les signaux utiles au calcul sont cohérents.`;
  }

  const topIssues = issues
    .slice(0, 3)
    .map((issue) => issue.label.toLowerCase())
    .join(", ");

  return `Base ${getNutritionDataConfidenceLabel(summary.confidence)} : à consolider en priorité — ${topIssues}.`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
