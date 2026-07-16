import { normalizeMuscleSlug } from "./muscle-normalization";

export interface FiberCatalogEntry {
  id?: string;
  name?: string;
  slug: string;
  muscleGroup?: string | null;
  primaryMuscle?: string | null;
  secondaryMuscles?: string[];
}

export const FIBERS_BY_GROUP: Record<string, string[]> = {
  fessiers: ["grand_fessier", "moyen_fessier", "petit_fessier"],
  epaules: ["deltoide_anterieur", "deltoide_lateral", "deltoide_posterieur"],
  pectoraux: ["grand_pectoral_superieur", "grand_pectoral", "grand_pectoral_inferieur"],
  dos: ["grand_dorsal", "rhomboides", "trapeze_superieur", "trapeze_moyen", "trapeze_inferieur", "erecteurs_spinaux"],
  biceps: ["biceps", "brachial", "flechisseurs_avant_bras"],
  triceps: ["triceps_long", "triceps_lateral", "triceps_medial"],
  quadriceps: ["rectus_femoris", "vaste_lateral", "vaste_medial", "vaste_intermediaire"],
  "ischio-jambiers": ["biceps_femoral", "semi_tendineux", "semi_membraneux"],
  mollets: ["gastrocnemien", "solea", "tibial_anterieur"],
  abdos: ["abdos", "obliques_externes", "transverse_abdominal"],
  lombaires: ["lombaires", "erecteurs_spinaux"],
  "avant-bras": ["brachioradialis", "flechisseurs_avant_bras", "extenseurs_avant_bras", "pronators_supinators"],
  adducteurs: ["adducteurs"],
  abducteurs: ["abducteurs"],
};

export const FIBER_LABELS: Record<string, string> = {
  grand_fessier: "Grand fessier",
  moyen_fessier: "Moyen fessier",
  petit_fessier: "Petit fessier",
  deltoide_anterieur: "Deltoïde antérieur",
  deltoide_lateral: "Deltoïde latéral",
  deltoide_posterieur: "Deltoïde postérieur",
  grand_pectoral_superieur: "Grand pectoral sup.",
  grand_pectoral: "Grand pectoral",
  grand_pectoral_inferieur: "Grand pectoral inf.",
  grand_dorsal: "Grand dorsal",
  rhomboides: "Rhomboïdes",
  trapeze_superieur: "Trapèze sup.",
  trapeze_moyen: "Trapèze moy.",
  trapeze_inferieur: "Trapèze inf.",
  erecteurs_spinaux: "Érecteurs rachis",
  lombaires: "Lombaires",
  biceps: "Biceps",
  brachial: "Brachial ant.",
  triceps_long: "Longue portion",
  triceps_lateral: "Faisceau latéral",
  triceps_medial: "Faisceau médial",
  rectus_femoris: "Droit fémoral",
  vaste_lateral: "Vaste latéral",
  vaste_medial: "Vaste médial",
  vaste_intermediaire: "Vaste intermédiaire",
  biceps_femoral: "Biceps fémoral",
  semi_tendineux: "Semi-tendineux",
  semi_membraneux: "Semi-membraneux",
  gastrocnemien: "Gastrocnémien",
  solea: "Soléaire",
  tibial_anterieur: "Tibial antérieur",
  abdos: "Droit abdominal",
  obliques_externes: "Obliques",
  transverse_abdominal: "Transverse",
  brachioradialis: "Brachio-radial",
  flechisseurs_avant_bras: "Fléchisseurs avant-bras",
  extenseurs_avant_bras: "Extenseurs avant-bras",
  pronators_supinators: "Pronateurs/Supinateurs",
  adducteurs: "Adducteurs",
  abducteurs: "Abducteurs",
};

const FOREARM_EXTENSOR_RAW = new Set([
  "extensor_carpi_radialis",
  "extensor_carpi_ulnaris",
  "extensor_digitorum",
  "forearm_extensors",
  "wrist_extensors",
]);

const FOREARM_FLEXOR_RAW = new Set([
  "flexor_carpi_radialis",
  "flexor_carpi_ulnaris",
  "palmaris_longus",
  "wrist_flexors",
  "finger_flexors",
  "grip_flexors",
  "forearm_flexors",
  "forearm_stabilizers",
  "wrist_stabilizers",
]);

const FOREARM_ROTATION_RAW = new Set([
  "pronator_teres",
  "supinator",
  "pronators_supinators",
]);

export function normalizeCatalogMuscle(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const raw = slug.toLowerCase().trim();
  if (raw === "brachioradialis" || raw === "pronators_supinators") return raw;
  try {
    return normalizeMuscleSlug(raw);
  } catch {
    return null;
  }
}

function getRawFiberSlugs(entry: FiberCatalogEntry): string[] {
  return [entry.primaryMuscle ?? "", ...(entry.secondaryMuscles ?? [])]
    .filter(Boolean)
    .map((slug) => slug.toLowerCase().trim());
}

function inferTricepsFibers(entry: FiberCatalogEntry): string[] {
  const slug = entry.slug.toLowerCase();
  const fibers = new Set<string>();
  const isOverheadOrStretchBiased =
    /(derriere-tete|verticale|banc-incline|incline|decline|couche)/.test(slug);
  const isCompoundPress =
    /(dips|developpe-couche-prise-serree|pompe|handstand)/.test(slug);

  if (isOverheadOrStretchBiased) fibers.add("triceps_long");

  if (isCompoundPress) {
    fibers.add("triceps_long");
    fibers.add("triceps_lateral");
    fibers.add("triceps_medial");
  } else {
    fibers.add("triceps_lateral");
    fibers.add("triceps_medial");
  }

  return [...fibers];
}

function inferPectoralFibers(entry: FiberCatalogEntry): string[] {
  const slug = entry.slug.toLowerCase();

  if (/(incline|landmine|guillotine)/.test(slug)) {
    return ["grand_pectoral_superieur"];
  }

  if (/(decline|dips|vis-a-vis-haute|haute-a-genoux|bas-vers-haut)/.test(slug)) {
    return ["grand_pectoral_inferieur"];
  }

  return ["grand_pectoral"];
}

function inferQuadricepsFibers(entry: FiberCatalogEntry): string[] {
  const slug = entry.slug.toLowerCase();
  const fibers = new Set<string>(["vaste_lateral", "vaste_medial", "vaste_intermediaire"]);

  if (
    /(leg-extension|extension-de-jambe|sissy-squat|fente|split-squat|bulgare|montees-sur-banc|thruster)/.test(slug)
  ) {
    fibers.add("rectus_femoris");
  }

  return [...fibers];
}

function inferHamstringFibers(entry: FiberCatalogEntry): string[] {
  const slug = entry.slug.toLowerCase();
  const fibers = new Set<string>(["biceps_femoral", "semi_tendineux", "semi_membraneux"]);

  if (/(sumo|squat|fente|presse)/.test(slug)) {
    fibers.delete("semi_membraneux");
  }

  return [...fibers];
}

export function deriveFiberTargets(entry: FiberCatalogEntry): string[] {
  const raw = getRawFiberSlugs(entry);
  const fibers = new Set<string>();

  raw.forEach((slug) => {
    const normalized = normalizeCatalogMuscle(slug);
    if (normalized && FIBER_LABELS[normalized]) fibers.add(normalized);
  });

  if (entry.muscleGroup === "triceps") {
    inferTricepsFibers(entry).forEach((fiber) => fibers.add(fiber));
  }

  if (entry.muscleGroup === "pectoraux") {
    inferPectoralFibers(entry).forEach((fiber) => fibers.add(fiber));
  }

  if (entry.muscleGroup === "avant-bras") {
    if (raw.includes("brachioradialis")) fibers.add("brachioradialis");
    if (raw.some((slug) => FOREARM_FLEXOR_RAW.has(slug))) fibers.add("flechisseurs_avant_bras");
    if (raw.some((slug) => FOREARM_EXTENSOR_RAW.has(slug))) fibers.add("extenseurs_avant_bras");
    if (raw.some((slug) => FOREARM_ROTATION_RAW.has(slug))) fibers.add("pronators_supinators");
  }

  if (entry.muscleGroup === "quadriceps") {
    inferQuadricepsFibers(entry).forEach((fiber) => fibers.add(fiber));
  }

  if (entry.muscleGroup === "ischio-jambiers") {
    inferHamstringFibers(entry).forEach((fiber) => fibers.add(fiber));
  }

  const groupFibers = entry.muscleGroup ? FIBERS_BY_GROUP[entry.muscleGroup] : null;
  if (groupFibers?.length) {
    return groupFibers.filter((fiber) => fibers.has(fiber));
  }

  return [...fibers];
}

export function getDisplayFibersForGroup(group: string, fibers: string[]): string[] {
  const ordered = FIBERS_BY_GROUP[group];
  if (!ordered) return fibers.filter((fiber) => FIBER_LABELS[fiber]);
  const available = new Set(fibers);
  return ordered.filter((fiber) => available.has(fiber));
}
