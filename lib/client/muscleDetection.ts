import { resolveExerciseMuscleCoverage } from "@/lib/programs/intelligence/exercise-resolver";
import { CanonicalMuscle, CANONICAL_MUSCLES, LEGACY_TO_CANONICAL } from "@/lib/programs/intelligence/muscle-normalization";

// Normalise un slug sans throw — retourne null si inconnu
// Gère tirets ET espaces → underscore (ex: "ischio-jambiers" → "ischio_jambiers")
function tryNormalizeMuscle(slug: string): CanonicalMuscle | null {
  const clean = slug.toLowerCase().trim().replace(/[\s-]+/g, '_')
  if (CANONICAL_MUSCLES[clean as CanonicalMuscle]) return clean as CanonicalMuscle
  const canonical = LEGACY_TO_CANONICAL[clean]
  return canonical ?? null
}

export type MuscleGroup =
  | "chest"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "back_upper"
  | "back_lower"
  | "traps";

export interface MuscleActivation {
  primary: Set<MuscleGroup>;
  secondary: Set<MuscleGroup>;
  stabilizers: Set<MuscleGroup>;
}

// Map canonical FR muscles to BodyMap MuscleGroups
const CANONICAL_TO_BODYMAP: Record<CanonicalMuscle, MuscleGroup | null> = {
  // Poitrine
  grand_pectoral: "chest",
  grand_pectoral_superieur: "chest",
  grand_pectoral_inferieur: "chest",
  petit_pectoral: "chest",

  // Dos
  grand_dorsal: "back_upper",
  trapeze_superieur: "traps",
  trapeze_moyen: "traps",
  trapeze_inferieur: "traps",
  rhomboides: "back_upper",
  lombaires: "back_lower",
  erecteurs_spinaux: "back_lower",

  // Épaules
  deltoide_anterieur: "shoulders",
  deltoide_lateral: "shoulders",
  deltoide_posterieur: "shoulders",

  // Bras
  biceps: "biceps",
  biceps_brachial: "biceps",
  brachial: "biceps",
  triceps: "triceps",
  triceps_lateral: "triceps",
  triceps_medial: "triceps",
  triceps_long: "triceps",

  // Avant-bras
  flechisseurs_avant_bras: "forearms",
  extenseurs_avant_bras: "forearms",

  // Jambes
  quadriceps: "quads",
  rectus_femoris: "quads",
  vaste_lateral: "quads",
  vaste_medial: "quads",
  vaste_intermediaire: "quads",

  ischio_jambiers: "hamstrings",
  biceps_femoral: "hamstrings",
  semi_tendineux: "hamstrings",
  semi_membraneux: "hamstrings",

  grand_fessier: "glutes",
  moyen_fessier: "glutes",
  petit_fessier: "glutes",

  adducteurs: "quads",
  abducteurs: "glutes",

  mollet: "calves",
  solea: "calves",
  gastrocnemien: "calves",
  tibial_anterieur: "quads",

  // Core
  abdos: "abs",
  obliques_externes: "abs",
  obliques_internes: "abs",
  transverse_abdominal: "abs",

  // Internal (should not appear in real data)
  dos_large: "back_upper",
};

/**
 * Get muscle activation from exercise.
 * STRICTLY from DB normalized columns, no regex fallback.
 * Throws if exercise data is incomplete.
 */
export function getMuscleActivation(exercise: {
  id: string;
  name: string;
  primary_muscles?: string[];
  secondary_muscles?: string[];
  movement_pattern?: string | null;
  is_compound?: boolean | null;
}): MuscleActivation {
  // Resolve with strict validation
  const resolved = resolveExerciseMuscleCoverage({
    id: exercise.id,
    name: exercise.name,
    primary_muscles: exercise.primary_muscles ?? [],
    secondary_muscles: exercise.secondary_muscles ?? [],
    movement_pattern: exercise.movement_pattern,
    is_compound: exercise.is_compound,
  });

  // Map canonical muscles to BodyMap groups
  const primary = new Set<MuscleGroup>();
  const secondary = new Set<MuscleGroup>();

  for (const muscle of resolved.primary_muscles) {
    const group = CANONICAL_TO_BODYMAP[muscle];
    if (group) primary.add(group);
  }

  for (const muscle of resolved.secondary_muscles) {
    const group = CANONICAL_TO_BODYMAP[muscle];
    if (group && !primary.has(group)) {
      secondary.add(group);
    }
  }

  return { primary, secondary, stabilizers: new Set() };
}

/**
 * Get all muscles (primary + secondary) as a single set.
 */
export function getAllMuscles(
  exercise: Parameters<typeof getMuscleActivation>[0],
): Set<MuscleGroup> {
  const activation = getMuscleActivation(exercise);
  return new Set(Array.from(activation.primary).concat(Array.from(activation.secondary)));
}

/**
 * Check if two exercises target the same primary muscle.
 */
export function sharesPrimaryMuscle(
  ex1: Parameters<typeof getMuscleActivation>[0],
  ex2: Parameters<typeof getMuscleActivation>[0],
): boolean {
  const act1 = getMuscleActivation(ex1);
  const act2 = getMuscleActivation(ex2);

  for (const muscle of Array.from(act1.primary)) {
    if (act2.primary.has(muscle)) {
      return true;
    }
  }

  return false;
}

/**
 * Legacy function for compatibility. Now calls getMuscleActivation.
 */
export function detectMuscleGroups(
  exercises: Parameters<typeof getMuscleActivation>[0][],
): MuscleActivation {
  const primary = new Set<MuscleGroup>();
  const secondary = new Set<MuscleGroup>();
  const stabilizers = new Set<MuscleGroup>();

  for (const ex of exercises) {
    try {
      const activation = getMuscleActivation(ex);
      activation.primary.forEach((m) => primary.add(m));
      activation.secondary.forEach((m) => {
        if (!primary.has(m)) secondary.add(m);
      });
    } catch {
      // Unknown/unrecognized muscles — skip this exercise silently
    }
  }

  return { primary, secondary, stabilizers };
}

/**
 * Compute muscle intensity map from exercises.
 * Returns normalized intensity (0-1) per muscle group based on weighted volume.
 */
export function computeMuscleIntensity(
  exercises: {
    name: string;
    sets: number;
    primary_muscles: string[];
    secondary_muscles: string[];
    primary_muscle?: string | null;
    primary_activation?: number | null;
    secondary_muscles_detail?: string[];
    secondary_activations?: number[];
  }[],
): Map<MuscleGroup, number> {
  const volumeByGroup = new Map<MuscleGroup, number>();
  let totalVolume = 0;

  for (const ex of exercises) {
    const sets = ex.sets ?? 3;

    // Slugs génériques catalog muscles[] — trop imprécis pour le BodyMap
    // (ex: Shrug a muscles=['dos','biceps'] mais primaryMuscle='traps')
    const GENERIC_MUSCLE_SLUGS = new Set(['dos','biceps','triceps','epaules','pectoraux','abdos','quadriceps','fessiers','ischio-jambiers','ischio_jambiers','mollets','avant_bras'])
    const isAllGeneric = ex.primary_muscles.length > 0 && ex.primary_muscles.every(m => GENERIC_MUSCLE_SLUGS.has(m.toLowerCase()))

    // Si primary_muscles[] vide OU uniquement slugs génériques → utiliser primary_muscle singulier (anatomique précis)
    const primarySlugs: string[] = (!ex.primary_muscles.length || isAllGeneric) && ex.primary_muscle
      ? [ex.primary_muscle]
      : ex.primary_muscles.length > 0
        ? ex.primary_muscles
        : []

    for (const rawSlug of primarySlugs) {
      const canonical = tryNormalizeMuscle(rawSlug);
      if (!canonical) continue;
      const group = CANONICAL_TO_BODYMAP[canonical];
      if (group) {
        const activation = ex.primary_activation ?? 0.8;
        const volume = sets * activation;
        volumeByGroup.set(group, (volumeByGroup.get(group) ?? 0) + volume);
        totalVolume += volume;
      }
    }

    // Secondary muscles with reduced activation
    const primaryGroups = new Set(
      primarySlugs
        .map(m => { const c = tryNormalizeMuscle(m); return c ? CANONICAL_TO_BODYMAP[c] : null })
        .filter((g): g is MuscleGroup => g !== null)
    );
    for (let i = 0; i < ex.secondary_muscles.length; i++) {
      const canonical = tryNormalizeMuscle(ex.secondary_muscles[i]);
      if (!canonical) continue;
      const group = CANONICAL_TO_BODYMAP[canonical];
      if (group && !primaryGroups.has(group)) {
        const activation = ex.secondary_activations?.[i] ?? 0.4;
        const volume = sets * activation;
        volumeByGroup.set(group, (volumeByGroup.get(group) ?? 0) + volume);
        totalVolume += volume;
      }
    }
  }

  // Normalize to 0-1 range
  const intensityMap = new Map<MuscleGroup, number>();
  const maxVolume = Math.max(...Array.from(volumeByGroup.values()), 1);

  for (const [group, volume] of Array.from(volumeByGroup.entries())) {
    intensityMap.set(group, Math.min(volume / maxVolume, 1));
  }

  return intensityMap;
}
