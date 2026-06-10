// Maps EN anatomical slugs (from catalog primaryMuscle / secondaryMuscles)
// to display sub-groups used in volume gauges.
export const MUSCLE_TO_VOLUME_GROUP: Record<string, string> = {
  // Jambes — Quadriceps
  rectus_femoris: "quadriceps",
  vastus_lateralis: "quadriceps",
  vastus_medialis: "quadriceps",
  vastus_intermedius: "quadriceps",
  quadriceps: "quadriceps",
  droit_femoral: "quadriceps",
  vaste_lateral: "quadriceps",
  vaste_medial: "quadriceps",
  // Jambes — Ischio-jambiers
  biceps_femoris: "ischio",
  semimembranosus: "ischio",
  semitendinosus: "ischio",
  hamstrings: "ischio",
  ischio_jambiers: "ischio",
  biceps_femoral: "ischio",
  semi_membraneux: "ischio",
  semi_tendineux: "ischio",
  // Jambes — Grand fessier
  gluteus_maximus: "fessiers_grand",
  glutes: "fessiers_grand",
  grand_fessier: "fessiers_grand",
  fessiers: "fessiers_grand",
  // Jambes — Moyen fessier
  gluteus_medius: "fessiers_moyen",
  moyen_fessier: "fessiers_moyen",
  // Jambes — Petit fessier
  gluteus_minimus: "fessiers_petit",
  petit_fessier: "fessiers_petit",
  // Jambes — Mollets
  gastrocnemius: "mollets",
  soleus: "mollets",
  calves: "mollets",
  gastrocnemien: "mollets",
  soleaire: "mollets",
  // Haut push — Pectoraux haut
  pectoralis_major_upper: "pectoraux_haut",
  pectoralis_major_clavicular: "pectoraux_haut",
  grand_pectoral_sup: "pectoraux_haut",
  upper_chest: "pectoraux_haut",
  // Haut push — Pectoraux bas
  pectoralis_major: "pectoraux_bas",
  pectoralis_major_lower: "pectoraux_bas",
  pectoralis_major_sternal: "pectoraux_bas",
  pectoralis_minor: "pectoraux_bas",
  grand_pectoral: "pectoraux_bas",
  grand_pectoral_inf: "pectoraux_bas",
  petit_pectoral: "pectoraux_bas",
  pec_major: "pectoraux_bas",
  // Haut push — Épaules antérieur
  anterior_deltoid: "epaules_ant",
  deltoid_anterior: "epaules_ant",
  deltoide_anterieur: "epaules_ant",
  // Haut push — Épaules latéral
  lateral_deltoid: "epaules_lat",
  medial_deltoid: "epaules_lat",
  deltoid_lateral: "epaules_lat",
  deltoide_lateral: "epaules_lat",
  // Épaule générique → latéral comme catch-all
  shoulders: "epaules_lat",
  deltoids: "epaules_lat",
  shoulder_complex: "epaules_lat",
  // Haut push — Épaules postérieur
  posterior_deltoid: "epaules_post",
  deltoid_posterior: "epaules_post",
  deltoide_posterieur: "epaules_post",
  rear_delts: "epaules_post",
  external_rotators: "epaules_post",
  rotator_cuff: "epaules_post",
  subscapularis: "epaules_post",
  supraspinatus: "epaules_post",
  // Haut push — Triceps
  triceps_brachii: "triceps",
  triceps: "triceps",
  // Haut pull — Grand dorsal
  latissimus_dorsi: "dos_grand_dorsal",
  lats: "dos_grand_dorsal",
  teres_major: "dos_grand_dorsal",
  grand_dorsal: "dos_grand_dorsal",
  teres_minor: "dos_grand_dorsal",
  // Haut pull — Trapèzes / Rhomboïdes
  rhomboids: "dos_trapezes",
  trapezius: "dos_trapezes",
  trapezius_upper: "dos_trapezes",
  trapezius_middle: "dos_trapezes",
  trapezius_lower: "dos_trapezes",
  traps: "dos_trapezes",
  upper_traps: "dos_trapezes",
  rhomboides: "dos_trapezes",
  trapeze: "dos_trapezes",
  trapeze_superieur: "dos_trapezes",
  trapeze_moyen: "dos_trapezes",
  trapeze_inferieur: "dos_trapezes",
  upper_back: "dos_trapezes",
  scapula: "dos_trapezes",
  levator_scapulae: "dos_trapezes",
  // Haut pull — Lombaires
  spine_erectors: "dos_lombaires",
  erector_spinae: "dos_lombaires",
  lower_back: "dos_lombaires",
  erecteurs_rachis: "dos_lombaires",
  // Haut pull — Biceps
  biceps_brachii: "biceps",
  brachialis: "biceps",
  biceps: "biceps",
  brachial_anterieur: "biceps",
  // Avant-bras (dissocié des biceps)
  brachioradialis: "avant_bras",
  brachio_radial: "avant_bras",
  forearms: "avant_bras",
  flexor_carpi_radialis: "avant_bras",
  flexor_carpi_ulnaris: "avant_bras",
  extensor_carpi_radialis: "avant_bras",
  extensor_carpi_ulnaris: "avant_bras",
  extensor_digitorum: "avant_bras",
  palmaris_longus: "avant_bras",
  grip: "avant_bras",
  flechisseurs_avant_bras: "avant_bras",
  extenseurs_avant_bras: "avant_bras",
  wrist_flexors: "avant_bras",
  wrist_extensors: "avant_bras",
  finger_flexors: "avant_bras",
  grip_flexors: "avant_bras",
  pronators_supinators: "avant_bras",
  forearm_flexors: "avant_bras",
  forearm_stabilizers: "avant_bras",
  wrist_stabilizers: "avant_bras",
  // Core — Abdos
  rectus_abdominis: "abdos",
  obliques: "abdos",
  transverse_abdominis: "abdos",
  core: "abdos",
  droit_abdominal: "abdos",
  droit_abdominal_inf: "abdos",
  transverse: "abdos",
  sangle_abdominale: "abdos",
};

/**
 * Lookup muscle volume group by slug (EN or FR).
 * Handles both EN catalog slugs and FR normalized slugs from BIOMECH_TO_FR.
 * Returns null if slug not found in MUSCLE_TO_VOLUME_GROUP.
 */
export function getMuscleVolumeGroup(slug: string | undefined): string | null {
  if (!slug) return null
  return MUSCLE_TO_VOLUME_GROUP[slug] ?? null
}

// Display labels for each sub-group (FR)
export const VOLUME_GROUP_LABELS: Record<string, string> = {
  quadriceps: "Quadriceps",
  ischio: "Ischio-jambiers",
  fessiers_grand: "Grand fessier",
  fessiers_moyen: "Moyen fessier",
  fessiers_petit: "Petit fessier",
  mollets: "Mollets",
  pectoraux_haut: "Pectoraux — Haut",
  pectoraux_bas: "Pectoraux — Bas",
  epaules_ant: "Épaules — Antérieur",
  epaules_lat: "Épaules — Latéral",
  epaules_post: "Épaules — Postérieur",
  triceps: "Triceps",
  dos_grand_dorsal: "Grand dorsal",
  dos_trapezes: "Trapèzes / Rhomboïdes",
  dos_lombaires: "Lombaires",
  biceps: "Biceps",
  avant_bras: "Avant-bras",
  abdos: "Abdos",
};

// Body segment groupings for display (4 segments)
export const VOLUME_SEGMENTS: {
  key: string;
  label: string;
  groups: string[];
}[] = [
  {
    key: "jambes",
    label: "Jambes",
    groups: [
      "quadriceps",
      "ischio",
      "fessiers_grand",
      "fessiers_moyen",
      "fessiers_petit",
      "mollets",
    ],
  },
  {
    key: "push",
    label: "Haut du corps — Push",
    groups: [
      "pectoraux_haut",
      "pectoraux_bas",
      "epaules_ant",
      "epaules_lat",
      "epaules_post",
      "triceps",
    ],
  },
  {
    key: "pull",
    label: "Haut du corps — Pull",
    groups: ["dos_grand_dorsal", "dos_trapezes", "dos_lombaires", "biceps", "avant_bras"],
  },
  {
    key: "core",
    label: "Core",
    groups: ["abdos"],
  },
];

// MEV/MAV/MRV targets per sub-group for intermediate hypertrophy (Israetel/RP Strength base)
// Format: [MEV, MAV, MRV] in sets/week
const BASE_TARGETS: Record<string, [number, number, number]> = {
  quadriceps: [8, 16, 22],
  ischio: [6, 12, 18],
  fessiers_grand: [6, 14, 20],
  fessiers_moyen: [4, 10, 16],
  fessiers_petit: [3, 8, 13],
  mollets: [8, 16, 24],
  pectoraux_haut: [6, 12, 18],
  pectoraux_bas: [6, 14, 20],
  epaules_ant: [4, 10, 16],
  epaules_lat: [6, 14, 20],
  epaules_post: [6, 14, 20],
  triceps: [6, 14, 20],
  dos_grand_dorsal: [8, 16, 22],
  dos_trapezes: [6, 14, 20],
  dos_lombaires: [4, 10, 16],
  biceps: [6, 14, 20],
  avant_bras: [6, 14, 20],
  abdos: [6, 16, 22],
};

// Multipliers by fitness level (applied to all three thresholds)
const LEVEL_MULTIPLIER: Record<string, number> = {
  beginner: 0.65,
  intermediate: 1.0,
  advanced: 1.25,
  elite: 1.5,
};

// Multipliers by goal
const GOAL_MULTIPLIER: Record<string, number> = {
  hypertrophy: 1.0,
  strength: 0.65,
  fat_loss: 0.8,
  endurance: 1.2,
  recomp: 0.9,
  maintenance: 0.75,
  athletic: 0.85,
};

/**
 * Returns [MEV, MAV, MRV] for a given sub-group, goal, and level.
 * Values are rounded to nearest integer.
 */
export function getVolumeTargets(
  group: string,
  goal: string,
  level: string,
): [number, number, number] {
  const base = BASE_TARGETS[group] ?? [6, 12, 18];
  const levelMult = LEVEL_MULTIPLIER[level] ?? 1.0;
  const goalMult = GOAL_MULTIPLIER[goal] ?? 1.0;
  const factor = levelMult * goalMult;
  return [
    Math.round(base[0] * factor),
    Math.round(base[1] * factor),
    Math.round(base[2] * factor),
  ];
}
