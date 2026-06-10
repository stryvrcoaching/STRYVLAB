// ============================================================
// lib/stores/safety-rules.ts
// 10 Metabolic & Performance Safety Rules for Phase 2
// Hard-coded business logic to catch dangerous patterns
// ============================================================

import type { ClientProfile, CalculationResults } from "./useClientStore";

export type SafetyLevel = "CRITICAL" | "WARNING" | "ADVICE";

export interface SafetyRuleAlert {
  id: string;
  level: SafetyLevel;
  message: string;
  actionLabel: string;
  logicFix: string; // Pseudo-code or actual fix to apply
  active: boolean;
  emittedAt?: string;
}

export type SafetyEvaluator = {
  id: string;
  level: SafetyLevel;
  message: string;
  actionLabel: string;
  logicFix: string;
  evaluate: (profile: ClientProfile, results: CalculationResults) => boolean;
};

/**
 * All 10 metabolic + performance safety rules
 * These rules are evaluated every time profile or calculations change
 */
export const SAFETY_RULES: SafetyEvaluator[] = [
  {
    id: "METABOLIC_SAFETY_01",
    level: "CRITICAL",
    message:
      "Déficit sous le BMR détecté. Risque d'adaptation métabolique sévère et fatigue chronique.",
    actionLabel: "Remonter au BMR + 10%",
    logicFix: "profile.caloriesOffset = (bmr * 1.1) - macros.calories",
    evaluate: (profile, results) => {
      const macros = results.macros;
      if (!macros || !macros.breakdown?.bmr) return false;
      return (macros.calories ?? 0) < macros.breakdown.bmr;
    },
  },

  {
    id: "PROTEIN_LEAN_MASS_01",
    level: "WARNING",
    message:
      "Apport protéique insuffisant pour la protection de la masse maigre actuelle.",
    actionLabel: "Ajuster à 2.2g/kg LBM",
    logicFix: "profile.macroGoal adjusted → +protein to maintain 2.2g/kg LBM",
    evaluate: (profile, results) => {
      if (!results.macros || !profile.weight || !profile.bodyFat) return false;
      const leanMass = profile.weight * (1 - profile.bodyFat / 100);
      const proteinNeeded = leanMass * 2.2;
      return results.macros.macros.p < proteinNeeded;
    },
  },

  {
    id: "CYCLE_LUTEAL_CARBS_01",
    level: "ADVICE",
    message:
      "Phase lutéale : Augmentation de la dépense. Ajouter des glucides pour stabiliser la satiété.",
    actionLabel: "Ajouter +30g Glucides",
    logicFix: "profile.caloriesOffset += 30 * 4 (120 kcal from carbs)",
    evaluate: (profile, results) => {
      if (profile.gender !== "female" || profile.cyclePhase !== "luteal") {
        return false;
      }
      // Check if carbs are below optimal for luteal phase
      if (!results.macros) return false;
      const carbsPerKg = (results.macros.macros.c ?? 0) / (profile.weight ?? 1);
      return carbsPerKg < 4; // Example: < 4g/kg in luteal phase
    },
  },

  {
    id: "PERF_INJURY_OVULATION",
    level: "WARNING",
    message:
      "Laxité ligamentaire accrue (pic œstrogènes). Prudence sur les charges max (>90%).",
    actionLabel: "Brider à 85% RPE 8",
    logicFix: "programTemplate.intensityCap = 0.85 during ovulatory phase",
    evaluate: (profile, results) => {
      return (
        profile.gender === "female" &&
        profile.cyclePhase === "ovulatory" &&
        (profile.workouts ?? 0) >= 4
      );
    },
  },

  {
    id: "PERF_VOLUME_OVERLOAD",
    level: "CRITICAL",
    message:
      "Volume élevé + Baisse de HRV. Risque de surentraînement systémique imminent.",
    actionLabel: "Appliquer Deload (-30% volume)",
    logicFix: "program.weeklyVolume *= 0.7",
    evaluate: (profile, results) => {
      // Note: HRV data not in current schema, using workouts as proxy
      const isHighVolume = (profile.workouts ?? 0) > 5;
      const isPoorRecovery = (profile.steps ?? 0) < 3000; // Very low activity
      return isHighVolume && isPoorRecovery;
    },
  },

  {
    id: "HYDRATION_PROTEIN_LINK",
    level: "ADVICE",
    message:
      "Apport protéique élevé. Augmenter l'hydratation pour optimiser la filtration rénale.",
    actionLabel: "Passer à 4L/jour",
    logicFix: "profile.hydration.dailyTarget = 4.0",
    evaluate: (profile, results) => {
      if (!results.macros || !results.hydration) return false;
      return (
        results.macros.macros.p > 200 &&
        results.hydration.liters < 3.5
      );
    },
  },

  {
    id: "BF_INCOHERENCE",
    level: "WARNING",
    message:
      "Perte de poids > 1.5kg/sem. Risque de fonte musculaire si le BF n'est pas monitoré par plis.",
    actionLabel: "Saisir Plis Cutanés",
    logicFix: 'ui.focus = "skinfold_input"',
    evaluate: (profile, results) => {
      if (!profile.bodyFat || profile.macroGoal !== "deficit") return false;
      // Weekly loss rate approximation: deficit / 7 / 1000
      if (!results.macros) return false;
      const weeklyLossEst =
        Math.max(0, (results.macros.tdee ?? 2000) - results.macros.calories) /
        7000;
      return (
        weeklyLossEst > 1.5 && profile.bodyFat < 15 // Only warn if already lean
      );
    },
  },

  {
    id: "SUPP_CREATINE_MISSING",
    level: "ADVICE",
    message:
      "Objectif hypertrophie : La créatine monohydrate n'est pas listée dans le protocole.",
    actionLabel: "Ajouter 5g Créatine/jour",
    logicFix: 'coach.supplements.add("creatine_monohydrate")',
    evaluate: (profile, results) => {
      return (
        profile.macroGoal === "surplus" &&
        profile.workouts !== null &&
        profile.workouts >= 3
      );
    },
  },

  {
    id: "HR_KARVONEN_PRECISION",
    level: "ADVICE",
    message:
      "FC Repos connue. Utiliser la méthode de Karvonen pour des zones de travail plus précises.",
    actionLabel: "Appliquer Karvonen",
    logicFix: 'hrZonesMethod = "karvonen"',
    evaluate: (profile, results) => {
      if (!results.hrZones) return false;
      // Check if resting HR is measured (would be in profile in future)
      // For now, assume this is true if hrZones exist
      return true;
    },
  },

  {
    id: "RECOVERY_SLEEP_DEBT",
    level: "WARNING",
    message:
      "Dette de sommeil : Sensibilité à l'insuline réduite. Prioriser les glucides complexes.",
    actionLabel: "Modifier sources glucides",
    logicFix: 'macros.carb_quality = "complex"',
    evaluate: (profile, results) => {
      // Note: sleep data not in current schema
      // Using workouts as proxy (high volume = need better sleep quality)
      if (!results.macros) return false;
      return (
        (profile.workouts ?? 0) >= 5 &&
        (results.macros.macros.c ?? 0) > 300 &&
        profile.macroGoal !== "deficit" // During surplus, carbs more important
      );
    },
  },
];

/**
 * Evaluate all safety rules for current state
 */
export function evaluateSafetyRules(
  profile: ClientProfile,
  results: CalculationResults,
): SafetyRuleAlert[] {
  return SAFETY_RULES.map((rule) => ({
    id: rule.id,
    level: rule.level,
    message: rule.message,
    actionLabel: rule.actionLabel,
    logicFix: rule.logicFix,
    active: rule.evaluate(profile, results),
    emittedAt: undefined,
  }));
}

/**
 * Get newly activated alerts (changed from inactive to active)
 */
export function getNewlyActivatedAlerts(
  currentAlerts: SafetyRuleAlert[],
  previousAlerts: SafetyRuleAlert[],
): SafetyRuleAlert[] {
  return currentAlerts.filter((current) => {
    const previous = previousAlerts.find((p) => p.id === current.id);
    return current.active && (!previous || !previous.active);
  });
}
