// Single source of truth for all muscle slugs
// Format: FR anatomical names (lowercase_underscore)
// This is the ONLY place where slug definitions live

export const CANONICAL_MUSCLES = {
  // Poitrine
  grand_pectoral: true,
  grand_pectoral_superieur: true,
  grand_pectoral_inferieur: true,
  petit_pectoral: true,

  // Dos
  grand_dorsal: true,
  trapeze_superieur: true,
  trapeze_moyen: true,
  trapeze_inferieur: true,
  rhomboides: true,
  lombaires: true,
  erecteurs_spinaux: true,

  // Épaules
  deltoide_anterieur: true,
  deltoide_lateral: true,
  deltoide_posterieur: true,

  // Bras
  biceps: true,
  biceps_brachial: true,
  brachial: true,
  triceps: true,
  triceps_lateral: true,
  triceps_medial: true,
  triceps_long: true,

  // Avant-bras
  flechisseurs_avant_bras: true,
  extenseurs_avant_bras: true,

  // Jambes
  quadriceps: true,
  rectus_femoris: true,
  vaste_lateral: true,
  vaste_medial: true,
  vaste_intermediaire: true,

  ischio_jambiers: true,
  biceps_femoral: true,
  semi_tendineux: true,
  semi_membraneux: true,

  grand_fessier: true,
  moyen_fessier: true,
  petit_fessier: true,

  adducteurs: true,
  abducteurs: true,

  mollet: true,
  solea: true,
  gastrocnemien: true,
  tibial_anterieur: true,

  // Core
  abdos: true,
  obliques_externes: true,
  obliques_internes: true,
  transverse_abdominal: true,

  // Legacy/catch-all (maps to specific muscles)
  dos_large: true, // Internal use only for grouping
  cardio: true,
} as const;

export type CanonicalMuscle = keyof typeof CANONICAL_MUSCLES;

// Map old slugs → canonical (backward compat for import/legacy data)
export const LEGACY_TO_CANONICAL: Record<string, CanonicalMuscle> = {
  // ── Poitrine ──
  chest: "grand_pectoral",
  pectoraux: "grand_pectoral",
  pectoralis_major: "grand_pectoral",
  pec_major: "grand_pectoral",
  pectoraux_haut: "grand_pectoral_superieur",
  pectoralis_major_upper: "grand_pectoral_superieur",
  pectoraux_bas: "grand_pectoral_inferieur",
  pectoralis_major_lower: "grand_pectoral_inferieur",

  // ── Dos ──
  back: "grand_dorsal",
  dos: "grand_dorsal",
  lats: "grand_dorsal",
  upper_back: "rhomboides",
  rhomboids: "rhomboides",
  spine_erectors: "erecteurs_spinaux",
  erector_spinae: "erecteurs_spinaux",

  // ── Trapèzes ──
  traps: "trapeze_superieur",
  upper_traps: "trapeze_superieur",
  trapezius: "trapeze_superieur",
  trapezius_upper: "trapeze_superieur",
  trapezius_middle: "trapeze_moyen",
  trapezius_lower: "trapeze_inferieur",

  // ── Épaules ──
  shoulders: "deltoide_anterieur",
  deltoids: "deltoide_anterieur",
  anterior_deltoid: "deltoide_anterieur",
  epaules: "deltoide_lateral",
  epaules_ant: "deltoide_anterieur",
  epaules_lat: "deltoide_lateral",
  epaules_post: "deltoide_posterieur",
  medial_deltoid: "deltoide_lateral",
  lateral_deltoid: "deltoide_lateral",
  deltoid_anterior: "deltoide_anterieur",
  deltoid_lateral: "deltoide_lateral",
  deltoid_medial: "deltoide_lateral",
  deltoid_posterior: "deltoide_posterieur",
  posterior_deltoid: "deltoide_posterieur",
  rotator_cuff: "deltoide_posterieur",
  subscapularis: "deltoide_posterieur",

  // ── Bras ──
  biceps_brachii: "biceps",
  brachialis: "brachial",
  brachioradialis: "flechisseurs_avant_bras",
  avant_bras: "flechisseurs_avant_bras",
  triceps_brachii: "triceps",
  triceps_brachii_lateral: "triceps_lateral",
  triceps_longhead: "triceps_long",
  anconeus: "triceps_lateral",
  extensor_carpi_radialis: "extenseurs_avant_bras",
  extensor_carpi_ulnaris: "extenseurs_avant_bras",
  extensor_digitorum: "extenseurs_avant_bras",
  flexor_carpi_radialis: "flechisseurs_avant_bras",
  flexor_carpi_ulnaris: "flechisseurs_avant_bras",
  palmaris_longus: "flechisseurs_avant_bras",
  wrist_flexors: "flechisseurs_avant_bras",
  wrist_extensors: "extenseurs_avant_bras",
  finger_flexors: "flechisseurs_avant_bras",
  grip_flexors: "flechisseurs_avant_bras",
  pronators_supinators: "flechisseurs_avant_bras",
  forearm_flexors: "flechisseurs_avant_bras",
  forearm_extensors: "extenseurs_avant_bras",
  forearm_stabilizers: "flechisseurs_avant_bras",
  wrist_stabilizers: "flechisseurs_avant_bras",

  // ── Jambes ──
  quads: "quadriceps",
  hamstrings: "ischio_jambiers",
  // catalog FR avec tiret → géré par tryNormalizeMuscle ([\s-]+ → _)
  // mais on ajoute aussi la version underscore ici pour sécurité
  ischio_jambiers: "ischio_jambiers",
  adductors: "adducteurs",
  abductors: "abducteurs",
  hip_flexors: "quadriceps", // approximation — pas de canonical hip_flexors

  // ── Fessiers (catalog utilise 'fessiers' pluriel) ──
  fessiers: "grand_fessier",
  glutes: "grand_fessier",
  gluteus_maximus: "grand_fessier",
  glutes_med: "moyen_fessier",
  gluteus_medius: "moyen_fessier",
  gluteus_minimus: "petit_fessier",

  // ── Mollets ──
  calves: "mollet",
  gastrocnemius: "gastrocnemien",
  soleus: "solea",
  mollets: "mollet",

  // ── Core ──
  abs: "abdos",
  core: "abdos",
  core_global: "abdos",
  rectus_abdominis: "abdos",
  lower_abs: "abdos",
  obliques: "obliques_externes",
  transverse_abdominis: "transverse_abdominal",
  quadratus_lumborum: "lombaires",
  levator_scapulae: "trapeze_superieur",
  external_rotators: "deltoide_posterieur",

  // ── Déjà canonique (identity map) ──
  grand_dorsal: "grand_dorsal",
  trapeze_superieur: "trapeze_superieur",
  trapeze_moyen: "trapeze_moyen",
  trapeze_inferieur: "trapeze_inferieur",
  rhomboides: "rhomboides",
  lombaires: "lombaires",
  erecteurs_spinaux: "erecteurs_spinaux",
  deltoide_anterieur: "deltoide_anterieur",
  deltoide_lateral: "deltoide_lateral",
  deltoide_posterieur: "deltoide_posterieur",
  biceps: "biceps",
  triceps: "triceps",
  quadriceps: "quadriceps",
  grand_fessier: "grand_fessier",
  moyen_fessier: "moyen_fessier",
  petit_fessier: "petit_fessier",
  mollet: "mollet",
  abdos: "abdos",
  dos_large: "dos_large",
  cardio: "cardio",
};

/**
 * Normalize any muscle slug to canonical form.
 * Throws if slug is unrecognized.
 */
export function normalizeMuscleSlug(slug: string): CanonicalMuscle {
  const clean = slug
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");

  // Already canonical?
  if (CANONICAL_MUSCLES[clean as CanonicalMuscle]) {
    return clean as CanonicalMuscle;
  }

  // Legacy mapping?
  const canonical = LEGACY_TO_CANONICAL[clean];
  if (canonical) {
    return canonical;
  }

  throw new Error(
    `Unknown muscle slug: "${slug}". ` +
      `Valid slugs: ${Object.keys(CANONICAL_MUSCLES).join(", ")}`,
  );
}

/**
 * Validate array of muscle slugs. Normalizes + dedupes.
 * Throws if any slug is invalid.
 */
export function validateMuscleArray(slugs: unknown[]): CanonicalMuscle[] {
  if (!Array.isArray(slugs)) {
    throw new Error("Muscles must be an array");
  }

  const normalized: CanonicalMuscle[] = []
  for (const s of slugs) {
    if (typeof s !== "string") continue
    try {
      normalized.push(normalizeMuscleSlug(s))
    } catch {
      // Unknown slug from DB catalog — skip silently rather than crashing the page
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[muscle-normalization] Unknown slug skipped: "${s}"`)
      }
    }
  }

  // Dedupe while preserving order
  return Array.from(new Set(normalized));
}

// ─── Zod Schema ──────────────────────────────────────────────────────────────
import { z } from "zod";

export const CanonicalMuscleSchema = z.enum([
  "grand_pectoral",
  "grand_pectoral_superieur",
  "grand_pectoral_inferieur",
  "petit_pectoral",
  "grand_dorsal",
  "trapeze_superieur",
  "trapeze_moyen",
  "trapeze_inferieur",
  "rhomboides",
  "lombaires",
  "erecteurs_spinaux",
  "deltoide_anterieur",
  "deltoide_lateral",
  "deltoide_posterieur",
  "biceps",
  "biceps_brachial",
  "brachial",
  "triceps",
  "triceps_lateral",
  "triceps_medial",
  "triceps_long",
  "flechisseurs_avant_bras",
  "extenseurs_avant_bras",
  "quadriceps",
  "rectus_femoris",
  "vaste_lateral",
  "vaste_medial",
  "vaste_intermediaire",
  "ischio_jambiers",
  "biceps_femoral",
  "semi_tendineux",
  "semi_membraneux",
  "grand_fessier",
  "moyen_fessier",
  "petit_fessier",
  "adducteurs",
  "abducteurs",
  "mollet",
  "solea",
  "gastrocnemien",
  "tibial_anterieur",
  "abdos",
  "obliques_externes",
  "obliques_internes",
  "transverse_abdominal",
  "dos_large",
  "cardio",
] as const);

export const MuscleArraySchema = z
  .string()
  .array()
  .transform((arr) => validateMuscleArray(arr))
  .pipe(z.array(CanonicalMuscleSchema));

export const ExerciseMusclePatchSchema = z.object({
  primary_muscles_normalized: MuscleArraySchema,
  secondary_muscles_normalized: MuscleArraySchema.optional(),
});
