import {
  resolveExerciseCoeff,
  normalizeMuscleSlug,
  muscleConflictsWithRestriction,
  getPrimaryMuscleFromCatalog,
} from "./catalog-utils";
import {
  MUSCLE_TO_VOLUME_GROUP,
  getMuscleVolumeGroup,
  getVolumeTargets,
} from "./volume-targets";
import type {
  BuilderSession,
  BuilderExercise,
  TemplateMeta,
  IntelligenceAlert,
  IntelligenceResult,
  MuscleDistribution,
  PatternDistribution,
  SRAPoint,
  RedundantPair,
  IntelligenceProfile,
  ProgramStats,
  SessionStats,
  SRAHeatmapWeek,
} from "./types";

// ─── Normalisation slugs biomech précis → slugs FR affichables ───────────────
// Utilisé dans fiberVolumes pour éviter les doublons (hamstrings + ischio-jambiers,
// glutes + fessiers, etc.) quand primaryMuscle vient du catalogue EN.
// Uniquement pour les slugs EN du catalogue biomech — jamais les slugs FR grossiers
// Les slugs FR (fessiers, quadriceps, dos…) restent tels quels dans le fallback
const BIOMECH_TO_FR: Record<string, string> = {
  // Fessiers EN → FR précis
  gluteus_maximus: "grand_fessier",
  gluteus_medius: "moyen_fessier",
  gluteus_minimus: "petit_fessier",
  glutes: "fessiers",
  // Ischio-jambiers EN + variante avec tiret → underscore
  hamstrings: "ischio_jambiers",
  "ischio-jambiers": "ischio_jambiers",
  biceps_femoris: "biceps_femoral",
  semimembranosus: "semi_membraneux",
  semitendinosus: "semi_tendineux",
  // Quadriceps EN précis + générique catalogue
  quadriceps: "quadriceps",
  rectus_femoris: "droit_femoral",
  vastus_lateralis: "vaste_lateral",
  vastus_medialis: "vaste_medial",
  // Dos EN précis + génériques catalogue
  latissimus_dorsi: "grand_dorsal",
  lats: "grand_dorsal",
  upper_back: "dos_superieur",
  rhomboids: "rhomboides",
  trapezius: "trapeze",
  trapezius_upper: "trapeze_superieur",
  trapezius_middle: "trapeze_moyen",
  trapezius_lower: "trapeze_inferieur",
  traps: "trapeze",
  upper_traps: "trapeze_superieur",
  spine_erectors: "erecteurs_rachis",
  // Pectoraux EN précis + variantes catalogue
  pectoralis_major: "grand_pectoral",
  pectoralis_major_upper: "grand_pectoral_sup",
  pectoralis_major_lower: "grand_pectoral_inf",
  pectoralis_minor: "petit_pectoral",
  // Épaules EN précis + variantes catalogue
  deltoid_anterior: "deltoide_anterieur",
  deltoid_lateral: "deltoide_lateral",
  deltoid_posterior: "deltoide_posterieur",
  anterior_deltoid: "deltoide_anterieur",
  medial_deltoid: "deltoide_lateral",
  posterior_deltoid: "deltoide_posterieur",
  rotator_cuff: "coiffe_rotateurs",
  subscapularis: "subscapulaire",
  // Bras EN
  biceps_brachii: "biceps",
  brachialis: "brachial_anterieur",
  brachioradialis: "brachio_radial",
  triceps_brachii: "triceps",
  // Mollets EN
  gastrocnemius: "gastrocnemien",
  soleus: "soleaire",
  // Core EN précis + variantes catalogue
  rectus_abdominis: "droit_abdominal",
  lower_abs: "droit_abdominal_inf",
  obliques: "obliques",
  transverse_abdominis: "transverse",
  core: "sangle_abdominale",
  core_global: "sangle_abdominale",
};

function normalizeFiberSlug(slug: string): string {
  // First try direct map lookup
  if (BIOMECH_TO_FR[slug]) return BIOMECH_TO_FR[slug];
  // Normalize dashes to underscores for consistency (e.g. 'ischio-jambiers' → 'ischio_jambiers')
  return slug.replace(/-/g, "_");
}

// Maps a biomech primaryMuscle EN slug → radar muscle group key (FR slug used in RADAR_MUSCLES)
const BIOMECH_TO_GROUP: Record<string, string> = {
  gluteus_maximus: "fessiers",
  gluteus_medius: "fessiers",
  gluteus_minimus: "fessiers",
  glutes: "fessiers",
  hamstrings: "ischio-jambiers",
  biceps_femoris: "ischio-jambiers",
  semimembranosus: "ischio-jambiers",
  semitendinosus: "ischio-jambiers",
  quadriceps: "quadriceps",
  rectus_femoris: "quadriceps",
  vastus_lateralis: "quadriceps",
  vastus_medialis: "quadriceps",
  latissimus_dorsi: "dos",
  lats: "dos",
  upper_back: "dos",
  rhomboids: "dos",
  trapezius: "dos",
  trapezius_upper: "dos",
  trapezius_middle: "dos",
  trapezius_lower: "dos",
  traps: "dos",
  upper_traps: "dos",
  spine_erectors: "dos",
  pectoralis_major: "pectoraux",
  pectoralis_major_upper: "pectoraux",
  pectoralis_major_lower: "pectoraux",
  pectoralis_minor: "pectoraux",
  deltoid_anterior: "epaules",
  deltoid_lateral: "epaules",
  deltoid_posterior: "epaules",
  anterior_deltoid: "epaules",
  medial_deltoid: "epaules",
  posterior_deltoid: "epaules",
  rotator_cuff: "epaules",
  subscapularis: "epaules",
  biceps_brachii: "biceps",
  brachialis: "biceps",
  brachioradialis: "biceps",
  triceps_brachii: "triceps",
  gastrocnemius: "mollets",
  soleus: "mollets",
  calves: "mollets",
  rectus_abdominis: "abdos",
  lower_abs: "abdos",
  obliques: "abdos",
  transverse_abdominis: "abdos",
  core: "abdos",
  core_global: "abdos",
  hip_flexors: "abdos",
  adductors: "adducteurs",
  abductors: "abducteurs",
};

// ─── Constantes ───────────────────────────────────────────────────────────────

// Fenêtres SRA en heures par groupe musculaire (niveau intermédiaire)
// Sources : Schoenfeld 2010, Colquhoun 2018 (fréquence optimale)
const SRA_WINDOWS: Record<string, number> = {
  quadriceps: 48,
  fessiers: 48,
  "ischio-jambiers": 48,
  dos: 48,
  pectoraux: 48,
  epaules: 36,
  biceps: 36,
  triceps: 36,
  mollets: 24,
  abdos: 24,
};
const SRA_WINDOW_DEFAULT = 48;

// Modulation de la fenêtre SRA par niveau
const SRA_LEVEL_MULTIPLIER: Record<string, number> = {
  beginner: 1.25,
  intermediate: 1.0,
  advanced: 0.9,
  elite: 0.85,
};

// Groupes "push" et "pull" pour le calcul de balance
const PUSH_PATTERNS = new Set([
  "horizontal_push",
  "vertical_push",
  "elbow_extension",
]);
const PULL_PATTERNS = new Set([
  "horizontal_pull",
  "vertical_pull",
  "elbow_flexion",
  "scapular_elevation",
  "scapular_retraction",
]);
const LEGS_PATTERNS = new Set([
  "squat_pattern",
  "hip_hinge",
  "knee_flexion",
  "knee_extension",
  "calf_raise",
  "hip_abduction",
  "hip_adduction",
]);
const CORE_PATTERNS = new Set(["core_flex", "core_anti_flex", "core_rotation"]);

// Seuils ratio push/pull par goal
const BALANCE_THRESHOLDS: Record<
  string,
  { warn: [number, number]; critical: [number, number] }
> = {
  athletic: { warn: [0.8, 1.2], critical: [0.5, 2.0] },
  strength: { warn: [0.6, 1.6], critical: [0.4, 2.5] },
  default: { warn: [0.7, 1.4], critical: [0.5, 2.0] },
};

// Patterns attendus par goal (pour scoreCompleteness)
const REQUIRED_PATTERNS: Record<string, string[]> = {
  hypertrophy: [
    "horizontal_push",
    "horizontal_pull",
    "vertical_pull",
    "squat_pattern",
    "hip_hinge",
    "elbow_flexion",
    "elbow_extension",
    "lateral_raise",
  ],
  strength: [
    "horizontal_push",
    "vertical_push",
    "squat_pattern",
    "hip_hinge",
    "horizontal_pull",
  ],
  fat_loss: [
    "squat_pattern",
    "hip_hinge",
    "horizontal_push",
    "horizontal_pull",
    "carry",
  ],
  athletic: [
    "horizontal_push",
    "vertical_push",
    "horizontal_pull",
    "vertical_pull",
    "squat_pattern",
    "hip_hinge",
    "carry",
  ],
  recomp: ["squat_pattern", "hip_hinge", "horizontal_push", "horizontal_pull"],
  endurance: ["squat_pattern", "hip_hinge", "horizontal_pull", "carry"],
  maintenance: [
    "horizontal_push",
    "horizontal_pull",
    "squat_pattern",
    "hip_hinge",
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCoeff(ex: BuilderExercise): number {
  return resolveExerciseCoeff({
    name: ex.name,
    movement_pattern: ex.movement_pattern,
    primary_muscles: ex.primary_muscles,
    is_compound: ex.is_compound,
    primaryActivation: ex.primaryActivation ?? null,
  });
}

function getPattern(ex: BuilderExercise): string {
  return ex.movement_pattern ?? "unknown";
}

function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function inferHorizontalPushBias(ex: BuilderExercise): "incline" | "flat" | "decline" | "unknown" {
  const primary = (ex.primaryMuscle ?? "").toLowerCase()
  const constraint = (ex.constraintProfile ?? "").toLowerCase()
  const name = normalizeExerciseName(ex.name)

  if (
    primary.includes("upper") ||
    constraint.includes("upper_bias") ||
    /inclin|guillotine|clavic/.test(name)
  ) {
    return "incline"
  }

  if (primary.includes("infer") || /declin/.test(name)) {
    return "decline"
  }

  if (
    primary === "pectoralis_major" ||
    /couche|couche|bench|flat|plat/.test(name)
  ) {
    return "flat"
  }

  return "unknown"
}

// Calcule le volume pondéré d'un exercice : sets × stimCoeff
function weightedVolume(ex: BuilderExercise): number {
  return ex.sets * getCoeff(ex);
}

// Norme un score 0–100 depuis un ratio
function clampScore(v: number): number {
  return Math.round(Math.max(0, Math.min(100, v)));
}

// Heures entre deux jours de semaine (1=Lundi…7=Dimanche), cycliques
function hoursBetween(dayA: number | null, dayB: number | null): number | null {
  if (dayA === null || dayB === null) return null;
  const diff = (dayB - dayA + 7) % 7 || 7;
  return diff * 24;
}

// ─── 1. Balance push / pull / legs / core ────────────────────────────────────

export function scoreBalance(
  sessions: BuilderSession[],
  meta: TemplateMeta,
): { score: number; alerts: IntelligenceAlert[] } {
  const alerts: IntelligenceAlert[] = [];

  let pushVol = 0,
    pullVol = 0;
  let pushSets = 0,
    pullSets = 0;
  for (const session of sessions) {
    for (const ex of session.exercises) {
      const p = getPattern(ex);
      const vol = weightedVolume(ex);
      if (PUSH_PATTERNS.has(p)) {
        pushVol += vol;
        pushSets += ex.sets;
      }
      if (PULL_PATTERNS.has(p)) {
        pullVol += vol;
        pullSets += ex.sets;
      }
    }
  }

  // Aucun push ni pull → pas de déséquilibre mesurable
  if (pushVol === 0 && pullVol === 0) return { score: 100, alerts };

  // Évite division par zéro si un côté est absent
  const ratio = pullVol === 0 ? 999 : pushVol === 0 ? 0.001 : pushVol / pullVol;
  const thresholds =
    BALANCE_THRESHOLDS[meta.goal] ?? BALANCE_THRESHOLDS.default;

  const deviation = Math.abs(ratio - 1.0);
  let score = clampScore(100 - deviation * 60);

  if (ratio < thresholds.critical[0] || ratio > thresholds.critical[1]) {
    score = Math.min(score, 30);
    alerts.push({
      severity: "critical",
      code: "PUSH_PULL_IMBALANCE",
      title: "Déséquilibre push/pull sévère",
      explanation: `Ratio push/pull : ${ratio.toFixed(2)} (${pushSets} sets push / ${pullSets} sets pull). Un déséquilibre sévère augmente le risque de dysfonction gléno-humérale et d'inhibition réciproque.`,
      suggestion:
        ratio > 1
          ? `Ajoutez ~${Math.round((pushSets - pullSets) / 2)} sets de tirage (rowing, tractions) pour rééquilibrer.`
          : `Ajoutez ~${Math.round((pullSets - pushSets) / 2)} sets de poussée (développé, OHP) pour rééquilibrer.`,
    });
  } else if (ratio < thresholds.warn[0] || ratio > thresholds.warn[1]) {
    score = Math.min(score, 65);
    alerts.push({
      severity: "warning",
      code: "PUSH_PULL_IMBALANCE",
      title: "Déséquilibre push/pull",
      explanation: `Ratio push/pull : ${ratio.toFixed(2)} (${pushSets} sets push / ${pullSets} sets pull). Optimal pour "${meta.goal}" : ${thresholds.warn[0]}–${thresholds.warn[1]}.`,
      suggestion:
        ratio > 1
          ? "Envisagez d'ajouter 1–2 exercices de tirage pour équilibrer."
          : "Envisagez d'ajouter 1–2 exercices de poussée pour équilibrer.",
    });
  }

  return { score, alerts };
}

// ─── 2. Modèle SRA (Stimulus → Récupération → Adaptation) ────────────────────

export function scoreSRA(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
): {
  score: number;
  alerts: IntelligenceAlert[];
  sraMap: SRAPoint[];
  sraHeatmap: SRAHeatmapWeek[];
} {
  const alerts: IntelligenceAlert[] = [];
  const sraMap: SRAPoint[] = [];
  const effectiveLevel = profile?.fitnessLevel ?? meta.level;
  const levelMult = SRA_LEVEL_MULTIPLIER[effectiveLevel] ?? 1.0;

  // Collapse grouped exercises into combined slots before building the muscle map.
  // For each session, exercises sharing a group_id are merged into one virtual exercise
  // that holds the union of their primary muscles. Standalone exercises pass through unchanged.
  function collapseGroups(exercises: BuilderExercise[]): BuilderExercise[] {
    const seen = new Map<string, BuilderExercise>();
    const out: BuilderExercise[] = [];
    for (const ex of exercises) {
      if (!ex.group_id) {
        out.push(ex);
        continue;
      }
      if (seen.has(ex.group_id)) {
        const existing = seen.get(ex.group_id)!;
        existing.primary_muscles = Array.from(
          new Set([...existing.primary_muscles, ...ex.primary_muscles]),
        );
        existing.secondary_muscles = Array.from(
          new Set([...existing.secondary_muscles, ...ex.secondary_muscles]),
        );
      } else {
        const slot: BuilderExercise = {
          ...ex,
          primary_muscles: [...ex.primary_muscles],
          secondary_muscles: [...ex.secondary_muscles],
        };
        seen.set(ex.group_id, slot);
        out.push(slot);
      }
    }
    return out;
  }

  // Construit une map muscle → [{sessionIndex, dayOfWeek}]
  const muscleSessionMap: Record<
    string,
    { sessionIndex: number; day: number | null }[]
  > = {};

  sessions.forEach((session, si) => {
    const collapsed = collapseGroups(session.exercises);
    const muscles = new Set<string>();
    for (const ex of collapsed) {
      ex.primary_muscles
        .map(normalizeMuscleSlug)
        .forEach((m) => muscles.add(m));
    }
    muscles.forEach((muscle) => {
      if (!muscleSessionMap[muscle]) muscleSessionMap[muscle] = [];
      muscleSessionMap[muscle].push({
        sessionIndex: si,
        day: session.days_of_week?.[0] ?? session.day_of_week,
      });
    });
  });

  let violations = 0;
  let totalChecks = 0;

  for (const [muscle, occurrences] of Object.entries(muscleSessionMap)) {
    const window = (SRA_WINDOWS[muscle] ?? SRA_WINDOW_DEFAULT) * levelMult;

    for (let i = 1; i < occurrences.length; i++) {
      const prev = occurrences[i - 1];
      const curr = occurrences[i];
      const hours = hoursBetween(prev.day, curr.day);
      totalChecks++;

      const point: SRAPoint = {
        muscleGroup: muscle,
        sessionIndex: curr.sessionIndex,
        hoursFromPrevious: hours,
        windowRequired: Math.round(window),
        violation: false,
      };

      if (hours !== null) {
        const muscleName = muscle.charAt(0).toUpperCase() + muscle.slice(1);
        if (hours <= window * 0.5) {
          point.violation = true;
          violations++;
          alerts.push({
            severity: "critical",
            code: "SRA_VIOLATION",
            title: `Récupération insuffisante — ${muscleName}`,
            explanation: `${muscleName} sollicité ${hours}h après la séance précédente (minimum requis : ${Math.round(window)}h pour niveau ${effectiveLevel}).`,
            suggestion: `Espacez cette séance d'au moins ${Math.round(window - hours)}h supplémentaires — ou réduisez le volume ${muscleName} dans l'une des deux séances.`,
            sessionIndex: curr.sessionIndex,
          });
        } else if (hours <= window * 0.8) {
          violations += 0.5;
          alerts.push({
            severity: "warning",
            code: "SRA_VIOLATION",
            title: `Récupération courte — ${muscleName}`,
            explanation: `${muscleName} sollicité ${hours}h après la séance précédente. Idéal : ${Math.round(window)}h. Manque : ${Math.round(window - hours)}h.`,
            suggestion: `Décalez cette séance ou réduisez l'intensité (sets ou charge) des exercices ciblant ${muscleName}.`,
            sessionIndex: curr.sessionIndex,
          });
        }
      }

      sraMap.push(point);
    }
  }

  const score =
    totalChecks === 0
      ? 100
      : clampScore(100 - (violations / totalChecks) * 100);

  // ─── SRA Heatmap (4 semaines) ─────────────────────────────────────────────
  // The weekly program repeats over 4 weeks.
  // For each week (identical, same program), fatigue per muscle =
  // total weightedVolume for that muscle / (sraWindow_hours × 0.003) → clamped 0–100.
  // Factor 0.003 is empirical: ~1 set compound = ~3‰ of the SRA window in fatigue.
  const muscleNames = Object.keys(muscleSessionMap);
  const sraHeatmap: SRAHeatmapWeek[] = [1, 2, 3, 4].map((week) => {
    const muscles = muscleNames
      .map((muscle) => {
        const window = (SRA_WINDOWS[muscle] ?? SRA_WINDOW_DEFAULT) * levelMult;
        let totalVolume = 0;
        for (const session of sessions) {
          for (const ex of session.exercises) {
            if (ex.primary_muscles.map(normalizeMuscleSlug).includes(muscle)) {
              totalVolume += weightedVolume(ex);
            }
          }
        }
        const fatigue = Math.round(
          Math.min(100, totalVolume / (window * 0.003)),
        );
        return { name: muscle, fatigue };
      })
      .filter((m) => m.fatigue > 0);
    return { week, muscles };
  });

  return { score, alerts, sraMap, sraHeatmap };
}

// ─── 2b. Superset imbalance detection ─────────────────────────────────────────

export function scoreSuperset(sessions: BuilderSession[]): {
  score: number;
  alerts: IntelligenceAlert[];
} {
  const alerts: IntelligenceAlert[] = [];

  sessions.forEach((session, si) => {
    const groupMap = new Map<string, BuilderExercise[]>();
    for (const ex of session.exercises) {
      if (ex.group_id) {
        if (!groupMap.has(ex.group_id)) groupMap.set(ex.group_id, []);
        groupMap.get(ex.group_id)!.push(ex);
      }
    }

    groupMap.forEach((exs, groupId) => {
      if (exs.length < 2) return;

      // Check if any two exercises in the group share primary muscles (agonist-agonist)
      for (let a = 0; a < exs.length; a++) {
        for (let b = a + 1; b < exs.length; b++) {
          const musclesA = new Set(
            exs[a].primary_muscles.map(normalizeMuscleSlug),
          );
          const musclesB = new Set(
            exs[b].primary_muscles.map(normalizeMuscleSlug),
          );
          const overlap = Array.from(musclesA).filter((m) => musclesB.has(m));

          if (overlap.length > 0) {
            alerts.push({
              severity: "warning",
              code: "SUPERSET_IMBALANCE",
              title: `Superset agoniste — ${exs[a].name} + ${exs[b].name}`,
              explanation: `Deux exercices du même superset ciblent les mêmes muscles (${overlap.join(", ")}). Pas d'antagoniste pour la récupération.`,
              suggestion: `Envisagez un partenaire antagoniste (ex: pressing + tirage) pour une meilleure récupération.`,
              sessionIndex: si,
            });
            return; // One alert per group
          }
        }
      }
    });
  });

  return { score: 100, alerts };
}

// ─── 3. Redondance mécanique ──────────────────────────────────────────────────

const UNILATERAL_REGEX = /unilatéral|unilateral|single|1 bras|1 jambe/i;

function isUnilateral(ex: BuilderExercise): boolean {
  return (
    (ex.movement_pattern?.startsWith("unilateral_") ?? false) ||
    UNILATERAL_REGEX.test(ex.name)
  );
}

export function scoreRedundancy(
  sessions: BuilderSession[],
  morphoStimulusAdjustments?: Record<string, number>,
): {
  score: number;
  alerts: IntelligenceAlert[];
  redundantPairs: RedundantPair[];
} {
  const alerts: IntelligenceAlert[] = [];
  const redundantPairs: RedundantPair[] = [];

  sessions.forEach((session, si) => {
    const exs = session.exercises;
    for (let a = 0; a < exs.length; a++) {
      for (let b = a + 1; b < exs.length; b++) {
        const exA = exs[a],
          exB = exs[b];
        const pA = getPattern(exA),
          pB = getPattern(exB);

        // Patterns identiques
        if (pA !== pB || pA === "unknown") continue;

        // Les deux composés (composé + isolation = complémentaire, pas redondant)
        const isCompA =
          resolveExerciseCoeff({
            name: exA.name,
            movement_pattern: pA,
            primary_muscles: exA.primary_muscles,
            is_compound: exA.is_compound,
          }) > 0.65;
        const isCompB =
          resolveExerciseCoeff({
            name: exB.name,
            movement_pattern: pB,
            primary_muscles: exB.primary_muscles,
            is_compound: exB.is_compound,
          }) > 0.65;
        if (!isCompA || !isCompB) continue;

        // Muscle primaire commun
        const musA = new Set(exA.primary_muscles.map(normalizeMuscleSlug));
        const musB = new Set(exB.primary_muscles.map(normalizeMuscleSlug));
        const overlap = Array.from(musA).filter((m) => musB.has(m));
        if (overlap.length === 0) continue;

        // Même pattern ne veut pas forcément dire même angle utile :
        // couché plat vs incliné/guillotine restent complémentaires sur le faisceau claviculaire.
        if (pA === "horizontal_push") {
          const angleA = inferHorizontalPushBias(exA);
          const angleB = inferHorizontalPushBias(exB);
          const chestLike = overlap.some((m) =>
            ["pectoraux", "chest", "grand_pectoral", "grand_pectoral_superieur"].includes(m),
          );
          if (
            chestLike &&
            angleA !== "unknown" &&
            angleB !== "unknown" &&
            angleA !== angleB
          ) {
            continue;
          }
        }

        // Coefficients proches (même registre d'intensité)
        const coeffA = getCoeff(exA),
          coeffB = getCoeff(exB);
        if (Math.abs(coeffA - coeffB) >= 0.2) continue;

        // Si morpho a un boost unilatéral pour ce pattern et exactement un des deux est unilatéral,
        // c'est du travail asymétrique ciblé — pas de la redondance
        if (morphoStimulusAdjustments) {
          // pA is e.g. "horizontal_push" or "vertical_pull" — extract the directional suffix
          // to map to morpho keys like "unilateral_push" / "unilateral_pull"
          const directionMatch = pA.match(
            /_(push|pull|press|row|hinge|squat|lunge|fly)$/,
          );
          const direction = directionMatch ? directionMatch[1] : pA;
          const unilateralPatternKey = `unilateral_${direction}`;
          const hasUnilateralBoost =
            (morphoStimulusAdjustments[unilateralPatternKey] ?? 1.0) > 1.0;
          if (hasUnilateralBoost && isUnilateral(exA) !== isUnilateral(exB))
            continue;
        }

        const combinedSets = exA.sets + exB.sets;
        redundantPairs.push({
          sessionIndex: si,
          exerciseIndexA: a,
          exerciseIndexB: b,
          reason: `Même pattern (${pA}), muscles communs : ${overlap.join(", ")}`,
        });
        alerts.push({
          severity: "warning",
          code: "REDUNDANT_EXERCISES",
          title: `Redondance mécanique : ${exA.name} + ${exB.name}`,
          explanation: `Ces deux exercices ciblent les mêmes muscles (${overlap.join(", ")}) avec le même pattern (${pA}) et une intensité similaire (${exA.sets} + ${exB.sets} = ${combinedSets} sets). Le gain marginal du second est faible.`,
          suggestion:
            "Remplacez l'un par un exercice sous un angle différent ou avec un pattern complémentaire.",
          sessionIndex: si,
          exerciseIndex: b,
        });
      }
    }
  });

  const totalExercises = sessions.reduce(
    (acc, s) => acc + s.exercises.length,
    0,
  );
  const score =
    totalExercises === 0
      ? 100
      : clampScore(100 - (redundantPairs.length / totalExercises) * 80);

  return { score, alerts, redundantPairs };
}

// ─── 4. Progression RIR / intensité ──────────────────────────────────────────

export function scoreProgression(
  sessions: BuilderSession[],
  meta: TemplateMeta,
): { score: number; alerts: IntelligenceAlert[] } {
  const alerts: IntelligenceAlert[] = [];

  // Si durée ≤ 1 semaine : pas de progression évaluable
  if (meta.weeks <= 1) return { score: 100, alerts };

  const allExercises = sessions.flatMap((s) => s.exercises);

  // Alerte critique si RIR = 0 dès semaine 1 (aucune marge de progression)
  const rirZeroW1 = allExercises.filter((ex) => ex.rir === 0);
  if (rirZeroW1.length > 0) {
    alerts.push({
      severity: "critical",
      code: "RIR_TOO_LOW_WEEK1",
      title: "RIR 0 en semaine 1 — aucune marge de progression",
      explanation: `${rirZeroW1.length} exercice(s) démarrent avec RIR = 0. La progression linéaire (−0.5 RIR/semaine) est impossible sans recommencer à charge réduite.`,
      suggestion: `Démarrez à RIR 3–4 pour un programme de ${meta.weeks} semaines et descendez progressivement.`,
    });
    return { score: 20, alerts };
  }

  // Alerte info si RIR trop élevé pour le nombre de semaines (sous-utilisation)
  const avgRir =
    allExercises.reduce((acc, ex) => acc + (ex.rir ?? 2), 0) /
    (allExercises.length || 1);
  const recommendedStartRir = Math.min(4, Math.ceil(meta.weeks * 0.5));
  if (avgRir > recommendedStartRir + 1) {
    alerts.push({
      severity: "info",
      code: "RIR_TOO_HIGH",
      title: "Intensité initiale faible",
      explanation: `RIR moyen de ${avgRir.toFixed(1)} pour un programme de ${meta.weeks} semaines. La fenêtre de progression est sous-utilisée.`,
      suggestion: `Pour ${meta.weeks} semaines, un RIR initial de ${recommendedStartRir}–${recommendedStartRir + 1} est optimal.`,
    });
  }

  const score = alerts.some((a) => a.severity === "critical")
    ? 20
    : alerts.some((a) => a.severity === "warning")
      ? 60
      : 90;

  return { score, alerts };
}

// ─── 5. Spécificité goal ──────────────────────────────────────────────────────

// Score de spécificité 0–1 par exercice selon le goal
function exerciseSpecificityScore(ex: BuilderExercise, goal: string): number {
  const pattern = getPattern(ex);
  const repsStr = ex.reps ?? "";
  const repsLow = parseInt(repsStr.split("-")[0] ?? "0") || 0;
  const rir = ex.rir ?? 2;
  const restSec = ex.rest_sec ?? 90;
  const coeff = getCoeff(ex);

  switch (goal) {
    case "hypertrophy": {
      let s = 0.5;
      if (repsLow >= 6 && repsLow <= 15) s += 0.2;
      if (rir >= 1 && rir <= 3) s += 0.15;
      if (restSec <= 180) s += 0.15;
      if (coeff < 0.45) s -= 0.15; // isolation pure pénalisée légèrement
      return Math.min(1, Math.max(0, s));
    }
    case "strength": {
      let s = 0.5;
      if (repsLow >= 1 && repsLow <= 6) s += 0.25;
      if (rir <= 2) s += 0.15;
      if (
        [
          "squat_pattern",
          "hip_hinge",
          "horizontal_push",
          "vertical_push",
          "horizontal_pull",
          "vertical_pull",
        ].includes(pattern)
      )
        s += 0.1;
      if (coeff > 0.8) s += 0.1;
      if (rir > 2) s -= 0.2; // confort excessif pénalisé
      return Math.min(1, Math.max(0, s));
    }
    case "fat_loss": {
      let s = 0.5;
      if (restSec <= 60) s += 0.2;
      if (ex.sets >= 3) s += 0.1;
      if (["squat_pattern", "hip_hinge", "carry"].includes(pattern)) s += 0.2;
      if (restSec > 120) s -= 0.2;
      return Math.min(1, Math.max(0, s));
    }
    case "endurance": {
      let s = 0.5;
      if (repsLow >= 15) s += 0.25;
      if (restSec <= 45) s += 0.15;
      if (coeff > 0.8) s -= 0.1;
      return Math.min(1, Math.max(0, s));
    }
    default:
      return 0.65; // score neutre pour recomp / maintenance / athletic
  }
}

export function scoreSpecificity(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
  morphoStimulusAdjustments?: Record<string, number>,
): { score: number; alerts: IntelligenceAlert[] } {
  const alerts: IntelligenceAlert[] = [];
  const allExercises = sessions.flatMap((s) => s.exercises);

  if (allExercises.length === 0) return { score: 100, alerts };

  // Injury conflict alerts (per exercise)
  if (profile && profile.injuries.length > 0) {
    const SEVERITY_ORDER: Record<string, number> = {
      avoid: 3,
      limit: 2,
      monitor: 1,
    };
    allExercises.forEach((ex) => {
      const si = sessions.findIndex((s) => s.exercises.includes(ex));
      const ei = sessions[si]?.exercises.indexOf(ex) ?? -1;
      const allMuscles = [...ex.primary_muscles, ...ex.secondary_muscles];

      let worstConflict: {
        conflicts: true;
        severity: "avoid" | "limit" | "monitor";
      } | null = null;
      for (const muscle of allMuscles) {
        const conflict = muscleConflictsWithRestriction(
          muscle,
          profile.injuries,
        );
        if (conflict) {
          if (
            !worstConflict ||
            SEVERITY_ORDER[conflict.severity] >
              SEVERITY_ORDER[worstConflict.severity]
          ) {
            worstConflict = conflict;
          }
        }
      }

      if (worstConflict) {
        const severityLabel =
          worstConflict.severity === "avoid"
            ? "évitée"
            : worstConflict.severity === "limit"
              ? "limitée"
              : "surveillée";
        alerts.push({
          severity:
            worstConflict.severity === "avoid"
              ? "critical"
              : worstConflict.severity === "limit"
                ? "warning"
                : "info",
          code: "INJURY_CONFLICT",
          title: `Conflit blessure — ${ex.name}`,
          explanation: `Cet exercice sollicite une zone ${severityLabel} selon le profil client.`,
          suggestion:
            "Voir les alternatives pour éviter cette zone musculaire.",
          sessionIndex: si >= 0 ? si : undefined,
          exerciseIndex: ei >= 0 ? ei : undefined,
        });
      }
    });
  }

  // Moyenne pondérée par stimCoeff (avec ajustement morpho si disponible)
  let totalWeight = 0,
    weightedSum = 0;
  allExercises.forEach((ex) => {
    const baseCoeff = getCoeff(ex);
    const morphoAdj =
      morphoStimulusAdjustments?.[ex.movement_pattern ?? ""] ?? 1.0;
    const coeff = Math.max(0.4, Math.min(1.2, baseCoeff * morphoAdj));
    const specificity = exerciseSpecificityScore(ex, meta.goal);
    weightedSum += specificity * coeff;
    totalWeight += coeff;

    if (specificity < 0.5) {
      const si = sessions.findIndex((s) => s.exercises.includes(ex));
      alerts.push({
        severity: "warning",
        code: "GOAL_MISMATCH",
        title: `${ex.name} — peu adapté à l'objectif "${meta.goal}"`,
        explanation: `Cet exercice (${ex.movement_pattern ?? "pattern inconnu"}, RIR ${ex.rir}, ${ex.reps} reps) est peu aligné avec l'objectif "${meta.goal}".`,
        suggestion:
          "Ajustez les paramètres (reps, RIR, repos) ou remplacez par un exercice plus spécifique.",
        sessionIndex: si,
        exerciseIndex: sessions[si]?.exercises.indexOf(ex),
      });
    }
  });

  const avgSpecificity = totalWeight === 0 ? 0.65 : weightedSum / totalWeight;
  const avoidConflicts = alerts.filter(
    (a) => a.code === "INJURY_CONFLICT" && a.severity === "critical",
  ).length;
  const limitConflicts = alerts.filter(
    (a) => a.code === "INJURY_CONFLICT" && a.severity === "warning",
  ).length;
  const injuryPenalty = Math.min(40, avoidConflicts * 30 + limitConflicts * 15);
  return { score: clampScore(avgSpecificity * 100 - injuryPenalty), alerts };
}

// ─── 6. Patterns manquants ────────────────────────────────────────────────────

// Catalog stores equipment in EN slugs; client profile stores FR slugs. Normalize before comparison.
// 'cable' normalizes to 'poulie' because RestrictionsWidget stores 'poulie' (not 'cables') in DB.
const CATALOG_TO_PROFILE_EQUIPMENT: Record<string, string> = {
  barbell: "barre",
  dumbbell: "halteres",
  cable: "poulie",
  machine: "machine",
  kettlebell: "kettlebell",
  smith: "smith",
  trx: "trx",
  band: "elastiques",
  ez_bar: "barre",
  landmine: "barre",
  trap_bar: "barre",
  bodyweight: "bodyweight",
  medicine_ball: "halteres",
  rings: "trx",
  sandbag: "halteres",
  sled: "machine",
  swiss_ball: "halteres",
};

// Profile equipment aliases — both 'poulie' and 'cables' refer to the same equipment type.
// Expand profile equipment to cover both forms before comparison.
const PROFILE_EQUIPMENT_ALIASES: Record<string, string[]> = {
  poulie: ["cables"],
  cables: ["poulie"],
};

function expandProfileEquipment(profileEquipment: string[]): Set<string> {
  const expanded = new Set(profileEquipment);
  for (const eq of profileEquipment) {
    for (const alias of PROFILE_EQUIPMENT_ALIASES[eq] ?? []) {
      expanded.add(alias);
    }
  }
  return expanded;
}

function normalizeEquipment(slug: string): string {
  return CATALOG_TO_PROFILE_EQUIPMENT[slug] ?? slug;
}

// Equipment slugs that support each movement pattern (for equipment-aware completeness)
const PATTERN_EQUIPMENT_REQUIREMENTS: Record<string, string[]> = {
  horizontal_push: ["barre", "halteres", "machine", "cables", "smith"],
  vertical_push: ["barre", "halteres", "machine", "smith"],
  horizontal_pull: ["barre", "halteres", "machine", "cables", "trx"],
  vertical_pull: ["barre", "halteres", "machine", "cables", "trx", "poulie"],
  squat_pattern: ["barre", "halteres", "machine", "smith", "kettlebell"],
  hip_hinge: ["barre", "halteres", "machine", "kettlebell"],
  elbow_flexion: ["barre", "halteres", "machine", "cables", "elastiques"],
  elbow_extension: ["barre", "halteres", "machine", "cables", "elastiques"],
  lateral_raise: ["halteres", "machine", "cables"],
  carry: ["halteres", "kettlebell", "barre"],
  knee_flexion: ["machine", "cables"],
  calf_raise: ["machine", "barre", "halteres"],
  hip_abduction: ["machine", "elastiques", "cables"],
  hip_adduction: ["machine", "elastiques", "cables"],
  shoulder_rotation: ["halteres", "machine", "cables", "elastiques"],
  scapular_retraction: ["machine", "cables", "elastiques", "halteres"],
  scapular_protraction: ["machine", "cables", "elastiques"],
};

export function scoreCompleteness(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
): { score: number; alerts: IntelligenceAlert[]; missingPatterns: string[] } {
  const alerts: IntelligenceAlert[] = [];
  const required =
    REQUIRED_PATTERNS[meta.goal] ?? REQUIRED_PATTERNS.maintenance;
  const presentPatterns = new Set(
    sessions.flatMap((s) =>
      s.exercises.map((ex) => ex.movement_pattern).filter(Boolean),
    ),
  );

  // Expand profile equipment to cover both 'poulie' and 'cables' aliases
  // bodyweight is always available — no equipment required, everyone has it
  const profileEquipmentSet = profile
    ? expandProfileEquipment([...profile.equipment, "bodyweight"])
    : new Set<string>();

  // Filter out patterns that can't be done with available equipment
  const effectiveRequired =
    profile && profile.equipment.length > 0
      ? required.filter((pattern) => {
          const needed = PATTERN_EQUIPMENT_REQUIREMENTS[pattern];
          if (!needed) return true;
          return needed.some((eq) => profileEquipmentSet.has(eq));
        })
      : required;

  const missing = effectiveRequired.filter((p) => !presentPatterns.has(p));

  // Equipment mismatch alerts: exercises in program that need unavailable equipment
  if (profile && profile.equipment.length > 0) {
    sessions.forEach((session, si) => {
      session.exercises.forEach((ex, ei) => {
        if (ex.equipment_required.length === 0) return;
        const normalizedRequired =
          ex.equipment_required.map(normalizeEquipment);
        const hasEquipment = normalizedRequired.some((eq) =>
          profileEquipmentSet.has(eq),
        );
        if (!hasEquipment) {
          alerts.push({
            severity: "warning",
            code: "EQUIPMENT_MISMATCH",
            title: `Équipement manquant — ${ex.name}`,
            explanation: `Cet exercice nécessite : ${normalizedRequired.join(", ")}. Équipement disponible : ${profile.equipment.join(", ")}.`,
            suggestion:
              "Voir les alternatives compatibles avec l'équipement disponible.",
            sessionIndex: si,
            exerciseIndex: ei,
          });
        }
      });
    });
  }

  // Exemple d'exercice suggéré par pattern manquant
  const PATTERN_EXAMPLES: Record<string, string> = {
    horizontal_push: "Développé couché",
    vertical_push: "Développé militaire",
    horizontal_pull: "Rowing barre",
    vertical_pull: "Tractions",
    squat_pattern: "Squat barre",
    hip_hinge: "Soulevé de terre",
    elbow_flexion: "Curl haltères",
    elbow_extension: "Extension triceps overhead",
    lateral_raise: "Élévation latérale",
    carry: "Marche du fermier",
    knee_flexion: "Leg curl",
    calf_raise: "Extension mollets",
    hip_abduction: "Abducteur machine",
    hip_adduction: "Adducteur machine",
    shoulder_rotation: "Rotation externe épaule",
    scapular_retraction: "Face pull",
    scapular_protraction: "Protraction scapulaire",
  };

  // Labels FR pour les patterns dans les alertes
  const PATTERN_LABEL_FR: Record<string, string> = {
    horizontal_push: "Poussée horizontale",
    vertical_push: "Poussée verticale",
    horizontal_pull: "Tirage horizontal",
    vertical_pull: "Tirage vertical",
    squat_pattern: "Squat / Fentes",
    hip_hinge: "Charnière hanche",
    elbow_flexion: "Flexion coude (Biceps)",
    elbow_extension: "Extension coude (Triceps)",
    lateral_raise: "Élévation latérale",
    knee_flexion: "Flexion genou",
    knee_extension: "Extension genou",
    calf_raise: "Extension mollets",
    carry: "Porté (Carry)",
    core_flex: "Flexion core",
    core_anti_flex: "Gainage anti-flexion",
    core_rotation: "Rotation core",
    scapular_elevation: "Élévation scapulaire",
    hip_abduction: "Abduction hanche",
    hip_adduction: "Adduction hanche",
    shoulder_rotation: "Rotation épaule",
    scapular_retraction: "Rétraction scapulaire",
    scapular_protraction: "Protraction scapulaire",
  };

  // Si le programme est spécialisé, les patterns manquants sont informatifs.
  // Spécialisé = 1-2 séances OU fréquence ≤ 2 OU tous les patterns présents
  // appartiennent à un seul groupe (legs-only, push-only, pull-only…)
  const LEGS_PATTERNS = new Set([
    "squat_pattern",
    "hip_hinge",
    "knee_flexion",
    "knee_extension",
    "calf_raise",
    "hip_abduction",
    "hip_adduction",
  ]);
  const PUSH_PATTERNS = new Set(["horizontal_push", "vertical_push"]);
  const PULL_PATTERNS = new Set([
    "horizontal_pull",
    "vertical_pull",
    "scapular_retraction",
    "scapular_elevation",
  ]);
  const allPresent = Array.from(presentPatterns).filter(
    (p): p is string => p !== null,
  );
  const isLegsOnly =
    allPresent.length > 0 && allPresent.every((p) => LEGS_PATTERNS.has(p));
  const isPushOnly =
    allPresent.length > 0 && allPresent.every((p) => PUSH_PATTERNS.has(p));
  const isPullOnly =
    allPresent.length > 0 && allPresent.every((p) => PULL_PATTERNS.has(p));
  const isSpecialized =
    sessions.length <= 2 ||
    meta.frequency <= 2 ||
    isLegsOnly ||
    isPushOnly ||
    isPullOnly;
  const missingSeverity = isSpecialized ? "info" : "warning";

  missing.forEach((pattern) => {
    const label = PATTERN_LABEL_FR[pattern] ?? pattern.replace(/_/g, " ");
    alerts.push({
      severity: missingSeverity,
      code: "MISSING_PATTERN",
      title: `Pattern manquant — ${label}`,
      explanation: isSpecialized
        ? `Programme spécialisé : "${label}" non couvert. Normal pour une séance ciblée.`
        : `L'objectif "${meta.goal}" recommande des exercices de type "${label}".`,
      suggestion: `Exemple : ${PATTERN_EXAMPLES[pattern] ?? "exercice de ce pattern"}.`,
    });
  });

  // Pénalité réduite pour les programmes spécialisés (1-2 séances)
  const coverageRatio =
    effectiveRequired.length === 0
      ? 1
      : (effectiveRequired.length - missing.length) / effectiveRequired.length;
  const score =
    effectiveRequired.length === 0
      ? 100
      : clampScore(
          isSpecialized
            ? Math.max(50, coverageRatio * 100) // plancher à 50 pour programme spécialisé
            : coverageRatio * 100,
        );

  return { score, alerts, missingPatterns: missing };
}

// ─── 7. Joint Load ────────────────────────────────────────────────────────────

const BODY_PART_TO_JOINT: Record<string, "spine" | "knee" | "shoulder"> = {
  lower_back: "spine",
  upper_back: "spine",
  lumbar: "spine",
  spine: "spine",
  knee_left: "knee",
  knee_right: "knee",
  knee: "knee",
  shoulder_left: "shoulder",
  shoulder_right: "shoulder",
  shoulder: "shoulder",
  rotator_cuff: "shoulder",
};

function scoreJointLoad(
  sessions: BuilderSession[],
  profile?: IntelligenceProfile,
): { score: number; alerts: IntelligenceAlert[] } {
  const alerts: IntelligenceAlert[] = [];

  if (!profile || profile.injuries.length === 0) return { score: 80, alerts };

  const injuredJoints = profile.injuries
    .map((inj) => ({
      joint: BODY_PART_TO_JOINT[inj.bodyPart],
      severity: inj.severity,
    }))
    .filter(
      (
        x,
      ): x is {
        joint: "spine" | "knee" | "shoulder";
        severity: "avoid" | "limit" | "monitor";
      } => !!x.joint,
    );

  if (injuredJoints.length === 0) return { score: 80, alerts };

  let scoreDeduction = 0;
  const allExercises = sessions.flatMap((s) => s.exercises);
  const totalSets = allExercises.reduce((sum, e) => sum + e.sets, 0);
  if (totalSets === 0) return { score: 80, alerts };

  for (const { joint, severity } of injuredJoints) {
    const stressField =
      joint === "spine"
        ? "jointStressSpine"
        : joint === "knee"
          ? "jointStressKnee"
          : "jointStressShoulder";

    const withData = allExercises.filter(
      (e) => e[stressField as keyof typeof e] != null,
    );
    if (withData.length === 0) continue;

    const weightedSum = withData.reduce((sum, e) => {
      const stress = e[stressField as keyof typeof e] as number;
      return sum + stress * e.sets;
    }, 0);
    const weightedSets = withData.reduce((sum, e) => sum + e.sets, 0);
    const weightedAvg = weightedSum / weightedSets;

    const criticalThreshold = severity === "avoid" ? 5 : 6;
    const warningThreshold = severity === "avoid" ? 3 : 4;
    const jointLabel =
      joint === "spine" ? "rachis" : joint === "knee" ? "genou" : "épaule";

    if (weightedAvg >= criticalThreshold) {
      alerts.push({
        severity: "critical",
        code: "JOINT_OVERLOAD",
        title: `Surcharge articulaire — ${jointLabel}`,
        explanation: `Stress moyen pondéré sur le ${jointLabel} : ${weightedAvg.toFixed(1)}/8. Niveau de restriction : ${severity}.`,
        suggestion: `Remplacez les exercices à fort stress ${jointLabel} par des variantes machine ou avec câble.`,
      });
      scoreDeduction += severity === "avoid" ? 30 : 20;
    } else if (weightedAvg >= warningThreshold) {
      alerts.push({
        severity: "warning",
        code: "JOINT_OVERLOAD",
        title: `Charge articulaire élevée — ${jointLabel}`,
        explanation: `Stress moyen pondéré sur le ${jointLabel} : ${weightedAvg.toFixed(1)}/8.`,
        suggestion: `Surveillez la récupération articulaire et envisagez de réduire le volume sur cette zone.`,
      });
      scoreDeduction += 10;
    }
  }

  return { score: Math.max(0, 100 - scoreDeduction), alerts };
}

// ─── 8. Coordination demand ───────────────────────────────────────────────────

function scoreCoordination(
  sessions: BuilderSession[],
  meta: TemplateMeta,
): { score: number; alerts: IntelligenceAlert[] } {
  const alerts: IntelligenceAlert[] = [];

  if (meta.level !== "beginner") return { score: 100, alerts };

  const allExercises = sessions.flatMap((s) => s.exercises);
  const withData = allExercises.filter(
    (e) => e.coordinationDemand != null || e.globalInstability != null,
  );

  if (withData.length === 0) return { score: 100, alerts };

  const avg =
    withData.reduce((sum, e) => {
      const coord = e.coordinationDemand ?? 5;
      const instab = e.globalInstability ?? 5;
      return sum + (coord + instab) / 2;
    }, 0) / withData.length;

  if (avg > 7.5) {
    alerts.push({
      severity: "critical",
      code: "COORDINATION_MISMATCH",
      title: "Exercices trop complexes pour débutant",
      explanation: `Score moyen coordination/instabilité : ${avg.toFixed(1)}/9. Ces exercices nécessitent un apprentissage moteur avancé.`,
      suggestion: `Remplacez par des exercices guidés (machine, câble) avec coordination ≤ 5 pour commencer.`,
    });
    return { score: 40, alerts };
  }

  if (avg > 6) {
    alerts.push({
      severity: "warning",
      code: "COORDINATION_MISMATCH",
      title: "Complexité élevée pour niveau débutant",
      explanation: `Score moyen coordination : ${avg.toFixed(1)}/9.`,
      suggestion: `Privilégiez des exercices plus guidés en début de programme.`,
    });
    return { score: 70, alerts };
  }

  return { score: 100, alerts };
}

// ─── Agrégation finale ────────────────────────────────────────────────────────

// ─── 9. Volume Coverage (MEV/MAV/MRV) ────────────────────────────────────────

export function scoreVolumeCoverage(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
): {
  score: number;
  alerts: IntelligenceAlert[];
  volumeByMuscle: Record<string, number>;
} {
  const alerts: IntelligenceAlert[] = [];
  const volumeByMuscle: Record<string, number> = {};

  const goal = profile?.goal ?? meta.goal;
  const level = profile?.fitnessLevel ?? meta.level;

  // ── Accumulate weighted volume per sub-group ──────────────────────────────
  // Also track RIR per group to detect low-intensity double-problem (under MEV + high RIR)
  const rirByGroup: Record<string, { totalSets: number; weightedRir: number }> =
    {};

  function trackRir(group: string, sets: number, rir: number | null) {
    if (rir == null) return;
    if (!rirByGroup[group])
      rirByGroup[group] = { totalSets: 0, weightedRir: 0 };
    rirByGroup[group].totalSets += sets;
    rirByGroup[group].weightedRir += sets * rir;
  }

  for (const session of sessions) {
    for (const ex of session.exercises) {
      if (!ex.primaryMuscle || ex.primaryActivation == null) continue;

      const primaryGroup = getMuscleVolumeGroup(ex.primaryMuscle);
      if (primaryGroup) {
        volumeByMuscle[primaryGroup] =
          (volumeByMuscle[primaryGroup] ?? 0) + ex.sets * ex.primaryActivation;
        trackRir(primaryGroup, ex.sets, ex.rir);
      }

      if (ex.secondaryMusclesDetail && ex.secondaryActivations) {
        ex.secondaryMusclesDetail.forEach((muscle, i) => {
          const activation = ex.secondaryActivations?.[i];
          if (activation == null) return;
          const group = getMuscleVolumeGroup(muscle);
          if (group) {
            volumeByMuscle[group] =
              (volumeByMuscle[group] ?? 0) + ex.sets * activation;
            trackRir(group, ex.sets, ex.rir);
          }
        });
      }
    }
  }

  // ── Score and emit alerts ─────────────────────────────────────────────────
  const trackedGroups = Object.keys(volumeByMuscle);
  if (trackedGroups.length === 0) return { score: 100, alerts, volumeByMuscle };

  let totalPenalty = 0;

  for (const group of trackedGroups) {
    const volume = volumeByMuscle[group];
    const [mev, mav, mrv] = getVolumeTargets(group, goal, level);
    const label = group.replace(/_/g, " ");

    if (volume > mrv) {
      totalPenalty += 20;
      alerts.push({
        severity: "critical",
        code: "OVER_MRV",
        title: `Volume excessif : ${label}`,
        explanation: `${Math.round(volume)} sets équivalents/sem — dépasse le volume récupérable (MRV = ${mrv}). Risque de surentraînement.`,
        suggestion: `Réduisez le volume sur ce groupe à moins de ${mrv} sets équivalents/sem.`,
      });
    } else if (volume > mav) {
      totalPenalty += 5;
      alerts.push({
        severity: "info",
        code: "OVER_MAV",
        title: `Volume surplus : ${label}`,
        explanation: `${Math.round(volume)} sets équivalents/sem — au-delà du volume adaptatif optimal (MAV = ${mav}). Gains marginaux décroissants.`,
        suggestion: `Réduisez légèrement le volume ou déplacez des séries vers un groupe sous-entraîné.`,
      });
    } else if (volume < mev) {
      totalPenalty += 15;
      alerts.push({
        severity: "warning",
        code: "UNDER_MEV",
        title: `Volume insuffisant : ${label}`,
        explanation: `${Math.round(volume)} sets équivalents/sem — sous le minimum efficace (MEV = ${mev}). Stimulus insuffisant pour progresser.`,
        suggestion: `Ajoutez ${mev - Math.round(volume)} sets équivalents/sem sur ce groupe musculaire.`,
      });

      // Double-problem: under MEV + RIR too high → sets don't count as effective
      const rirData = rirByGroup[group];
      if (rirData && rirData.totalSets > 0) {
        const avgRir = rirData.weightedRir / rirData.totalSets;
        if (avgRir > 3) {
          alerts.push({
            severity: "warning",
            code: "LOW_INTENSITY",
            title: `Intensité insuffisante : ${label}`,
            explanation: `RIR moyen ${avgRir.toFixed(1)} — à cette intensité, les séries ne génèrent pas de stimulus adaptatif suffisant (seuil RP : RIR ≤ 3). Couplé au volume sous-MEV, aucune progression n'est attendue.`,
            suggestion: `Rapprochez les séries de l'échec (RIR 1–3) pour que le volume compte. Un set à RIR 5 vaut mécaniquement moins qu'un set à RIR 2.`,
          });
        }
      }
    }
  }

  // Penalty is proportional: each under-MEV group reduces score by (penalty / total groups),
  // but the base deduction is amplified by under-MEV ratio so a fully under-MEV program drops hard.
  const underMevGroups = alerts.filter((a) => a.code === "UNDER_MEV").length;
  const underMevRatio =
    trackedGroups.length > 0 ? underMevGroups / trackedGroups.length : 0;
  const penaltyReduced = totalPenalty / trackedGroups.length;
  const amplification = 1 + underMevRatio * 2; // up to 3× if all groups under MEV
  const score = clampScore(100 - penaltyReduced * amplification);
  return { score, alerts, volumeByMuscle };
}

// Poids des subscores dans le globalScore
const SUBSCORE_WEIGHTS = {
  balance: 0.15,
  recovery: 0.15,
  specificity: 0.15,
  progression: 0.1,
  completeness: 0.1,
  redundancy: 0.08,
  jointLoad: 0.05,
  coordination: 0.02,
  volumeCoverage: 0.2,
};

const ALERT_CODE_PRIORITY: Record<string, number> = {
  INJURY_CONFLICT: 0,
  SRA_VIOLATION: 1,
  OVER_MRV: 2,
  UNDER_MEV: 3,
  MISSING_PATTERN: 4,
  EQUIPMENT_MISMATCH: 5,
  REDUNDANT_EXERCISES: 6,
  PUSH_PULL_IMBALANCE: 7,
  GOAL_MISMATCH: 8,
  RIR_TOO_LOW_WEEK1: 9,
  RIR_TOO_HIGH: 10,
}

function buildNarrative(
  subscores: IntelligenceResult["subscores"],
  alerts: IntelligenceAlert[],
): string {
  const criticals = alerts.filter((a) => a.severity === "critical");
  if (criticals.length > 0) {
    return `Point critique : ${criticals[0].title.toLowerCase()}.`;
  }

  const sorted = Object.entries(subscores).sort(([, a], [, b]) => b - a);
  const [bestKey, bestVal] = sorted[0];
  const [worstKey, worstVal] = sorted[sorted.length - 1];
  const topWarning = alerts.find((a) => a.severity === "warning");

  const labels: Record<string, string> = {
    balance: "équilibre push/pull",
    recovery: "récupération inter-séances",
    specificity: "cohérence avec l'objectif",
    progression: "progression d'intensité",
    completeness: "couverture des patterns",
    redundancy: "diversité des exercices",
    jointLoad: "tolérance articulaire",
    coordination: "complexité motrice",
    volumeCoverage: "couverture du volume hebdomadaire",
  };

  if (topWarning && worstVal < 70) {
    return `Programme exploitable, mais priorité à ${labels[worstKey]} (${worstVal}/100). Alerte principale : ${topWarning.title.toLowerCase()}.`;
  }

  if (worstVal < 60) {
    return `Point fort : ${labels[bestKey]} (${bestVal}/100). À améliorer : ${labels[worstKey]} (${worstVal}/100).`;
  }
  return `Programme équilibré. Meilleur score : ${labels[bestKey]} (${bestVal}/100).`;
}

// Expand sessions by days_of_week: a session scheduled on 2 days = 2 occurrences for volume/balance/SRA
// Each copy gets the specific day assigned so SRA can compute inter-session gap correctly
function expandSessionsByDays(sessions: BuilderSession[]): BuilderSession[] {
  try {
    const expanded: BuilderSession[] = [];
    for (const session of sessions) {
      const days: (number | null)[] = session.days_of_week?.length
        ? session.days_of_week
        : session.day_of_week
          ? [session.day_of_week]
          : [null];
      for (const day of days) {
        expanded.push({
          ...session,
          day_of_week: day,
          days_of_week: day ? [day] : [],
        });
      }
    }
    return expanded;
  } catch {
    return sessions;
  }
}

export function buildIntelligenceResult(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
  morphoStimulusAdjustments?: Record<string, number>,
): IntelligenceResult {
  // Filtrer les exercices sans nom — les placeholders vides ne doivent pas influencer le scoring
  const filteredSessions = sessions.map((s) => ({
    ...s,
    exercises: s.exercises.filter((e) => e.name.trim() !== ""),
  }));
  // Expand multi-day sessions so volume/balance/SRA counts each scheduled day
  const expandedSessions = expandSessionsByDays(filteredSessions);

  const emptyProgramStats: ProgramStats = {
    totalSets: 0,
    totalEstimatedReps: 0,
    totalExercises: 0,
    avgExercisesPerSession: 0,
    sessionsStats: [],
  };

  const hasExercises = filteredSessions.some((s) => s.exercises.length > 0);
  if (!hasExercises) {
    return {
      globalScore: 0,
      globalNarrative: "Ajoutez des exercices pour voir l'analyse.",
      subscores: {
        balance: 0,
        recovery: 0,
        specificity: 0,
        progression: 0,
        completeness: 0,
        redundancy: 0,
        jointLoad: 100,
        coordination: 100,
        volumeCoverage: 100,
      },
      alerts: [],
      distribution: {},
      patternDistribution: { push: 0, pull: 0, legs: 0, core: 0 },
      missingPatterns: [],
      redundantPairs: [],
      sraMap: [],
      sraHeatmap: [],
      programStats: emptyProgramStats,
      volumeByMuscle: {},
    };
  }

  const balanceResult = scoreBalance(expandedSessions, meta);
  const sraResult = scoreSRA(expandedSessions, meta, profile);
  const redundancyResult = scoreRedundancy(
    expandedSessions,
    morphoStimulusAdjustments,
  );
  const progressionResult = scoreProgression(filteredSessions, meta);
  const specificityResult = scoreSpecificity(
    expandedSessions,
    meta,
    profile,
    morphoStimulusAdjustments,
  );
  const completenessResult = scoreCompleteness(expandedSessions, meta, profile);
  const jointLoadResult = scoreJointLoad(expandedSessions, profile);
  const coordinationResult = scoreCoordination(expandedSessions, meta);
  const volumeResult = scoreVolumeCoverage(expandedSessions, meta);

  const subscores = {
    balance: balanceResult.score,
    recovery: sraResult.score,
    specificity: specificityResult.score,
    progression: progressionResult.score,
    completeness: completenessResult.score,
    redundancy: redundancyResult.score,
    jointLoad: jointLoadResult.score,
    coordination: coordinationResult.score,
    volumeCoverage: volumeResult.score,
  };

  const globalScore = clampScore(
    Object.entries(subscores).reduce((acc, [key, val]) => {
      return acc + val * SUBSCORE_WEIGHTS[key as keyof typeof SUBSCORE_WEIGHTS];
    }, 0),
  );

  const allAlerts = [
    ...balanceResult.alerts,
    ...sraResult.alerts,
    ...redundancyResult.alerts,
    ...progressionResult.alerts,
    ...specificityResult.alerts,
    ...completenessResult.alerts,
    ...jointLoadResult.alerts,
    ...coordinationResult.alerts,
    ...volumeResult.alerts,
  ].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    const severityDelta = order[a.severity] - order[b.severity];
    if (severityDelta !== 0) return severityDelta;
    const priorityDelta =
      (ALERT_CODE_PRIORITY[a.code] ?? 99) - (ALERT_CODE_PRIORITY[b.code] ?? 99);
    if (priorityDelta !== 0) return priorityDelta;
    const scopedA = a.exerciseIndex != null ? 0 : a.sessionIndex != null ? 1 : 2;
    const scopedB = b.exerciseIndex != null ? 0 : b.sessionIndex != null ? 1 : 2;
    return scopedA - scopedB;
  });

  // Distribution musculaire (volume pondéré par groupe) — sur sessions expandées (multi-day × occurrences)
  const distribution: MuscleDistribution = {};
  for (const session of expandedSessions) {
    for (const ex of session.exercises) {
      const vol = weightedVolume(ex);
      if (ex.primary_muscles.length > 0) {
        ex.primary_muscles.forEach((m) => {
          const norm = normalizeMuscleSlug(m);
          distribution[norm] = (distribution[norm] ?? 0) + vol;
        });
      } else if (ex.primaryMuscle) {
        const group = BIOMECH_TO_GROUP[ex.primaryMuscle];
        if (group) distribution[group] = (distribution[group] ?? 0) + vol;
      }
    }
  }

  // Distribution patterns (volume brut) — sur sessions expandées
  const patternDistribution: PatternDistribution = {
    push: 0,
    pull: 0,
    legs: 0,
    core: 0,
  };
  for (const session of expandedSessions) {
    for (const ex of session.exercises) {
      const p = getPattern(ex);
      const vol = ex.sets;
      if (PUSH_PATTERNS.has(p)) patternDistribution.push += vol;
      else if (PULL_PATTERNS.has(p)) patternDistribution.pull += vol;
      else if (LEGS_PATTERNS.has(p)) patternDistribution.legs += vol;
      else if (CORE_PATTERNS.has(p)) patternDistribution.core += vol;
    }
  }

  // ─── Stats programme ──────────────────────────────────────────────────────────
  function parseRepsLow(reps: string): number {
    return parseInt(reps.split("-")[0] ?? "0") || 0;
  }

  const sessionsStats: SessionStats[] = filteredSessions.map((session) => {
    const exs = session.exercises;
    const totalSets = exs.reduce((acc, e) => acc + e.sets, 0);
    const estimatedReps = exs.reduce(
      (acc, e) => acc + e.sets * parseRepsLow(e.reps),
      0,
    );
    const patterns = Array.from(
      new Set(
        exs.map((e) => e.movement_pattern).filter((p): p is string => !!p),
      ),
    );

    const muscleVolumes: Record<string, number> = {};
    const fiberVolumes: Record<string, number> = {};
    for (const ex of exs) {
      const vol = weightedVolume(ex);
      ex.primary_muscles.forEach((m) => {
        const norm = normalizeMuscleSlug(m);
        muscleVolumes[norm] = (muscleVolumes[norm] ?? 0) + vol;
      });
      // Faisceau précis biomech normalisé (gluteus_medius → moyen_fessier, etc.)
      const resolvedPrimaryMuscle =
        ex.primaryMuscle ?? getPrimaryMuscleFromCatalog(ex.name);
      if (resolvedPrimaryMuscle) {
        const fiberKey = normalizeFiberSlug(resolvedPrimaryMuscle);
        fiberVolumes[fiberKey] = (fiberVolumes[fiberKey] ?? 0) + vol;
      } else {
        // Fallback: slug FR grossier normalisé (ischio-jambiers → ischio_jambiers)
        ex.primary_muscles.forEach((m) => {
          const fiberKey = normalizeFiberSlug(normalizeMuscleSlug(m));
          fiberVolumes[fiberKey] = (fiberVolumes[fiberKey] ?? 0) + vol;
        });
      }
    }

    const topMuscles = Object.entries(muscleVolumes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([m]) => m);

    return {
      name: session.name,
      exerciseCount: exs.length,
      totalSets,
      estimatedReps,
      patterns,
      topMuscles,
      muscleVolumes,
      fiberVolumes,
    };
  });

  const totalSets = sessionsStats.reduce((acc, s) => acc + s.totalSets, 0);
  const totalEstimatedReps = sessionsStats.reduce(
    (acc, s) => acc + s.estimatedReps,
    0,
  );
  const totalExercises = new Set(
    filteredSessions.flatMap((s) => s.exercises.map((e) => e.name)),
  ).size;
  const avgExercisesPerSession =
    filteredSessions.length > 0
      ? Math.round(
          filteredSessions.reduce((acc, s) => acc + s.exercises.length, 0) /
            filteredSessions.length,
        )
      : 0;

  const programStats: ProgramStats = {
    totalSets,
    totalEstimatedReps,
    totalExercises,
    avgExercisesPerSession,
    sessionsStats,
  };

  return {
    globalScore,
    globalNarrative: buildNarrative(subscores, allAlerts),
    subscores,
    alerts: allAlerts,
    distribution,
    patternDistribution,
    missingPatterns: completenessResult.missingPatterns,
    redundantPairs: redundancyResult.redundantPairs,
    sraMap: sraResult.sraMap,
    sraHeatmap: sraResult.sraHeatmap,
    programStats,
    volumeByMuscle: volumeResult.volumeByMuscle,
  };
}
