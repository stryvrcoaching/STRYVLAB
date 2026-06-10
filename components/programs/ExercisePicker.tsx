"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Image from "next/image";
import { Search, X, SlidersHorizontal, Check, Plus, ChevronDown } from "lucide-react";
import exerciseCatalog from "@/data/exercise-catalog.json";
import CustomExerciseModal from "@/components/programs/CustomExerciseModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CatalogEntry {
  id: string;
  name: string;
  slug: string;
  gifUrl: string;
  muscleGroup: string;
  exerciseType: "exercise" | "pedagogique";
  pattern: string[];
  movementPattern: string | null;
  equipment: string[];
  isCompound: boolean;
  muscles: string[];
  source?: 'catalog' | 'custom';
  // Biomech fields (from enriched catalog or custom exercises)
  plane?: string | null;
  mechanic?: string | null;
  unilateral?: boolean;
  primaryMuscle?: string | null;
  primaryActivation?: number | null;
  secondaryMuscles?: string[];
  secondaryActivations?: number[];
  stabilizers?: string[];
  jointStressSpine?: number | null;
  jointStressKnee?: number | null;
  jointStressShoulder?: number | null;
  globalInstability?: number | null;
  coordinationDemand?: number | null;
  constraintProfile?: string | null;
}

interface Props {
  onSelect: (exercise: {
    name: string;
    gifUrl: string;
    movementPattern: string | null;
    equipment: string[];
    isCompound: boolean;
    primaryMuscles: string[];
    secondaryMuscles: string[];
    // Biomech fields from enriched catalog
    plane: string | null;
    mechanic: string | null;
    unilateral: boolean;
    primaryMuscle: string | null;
    primaryActivation: number | null;
    secondaryMusclesDetail: string[];
    secondaryActivations: number[];
    stabilizers: string[];
    jointStressSpine: number | null;
    jointStressKnee: number | null;
    jointStressShoulder: number | null;
    globalInstability: number | null;
    coordinationDemand: number | null;
    constraintProfile: string | null;
  }) => void;
  onClose: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MUSCLE_LABELS: Record<string, string> = {
  abdos: "Abdos",
  biceps: "Biceps",
  dos: "Dos",
  epaules: "Épaules",
  fessiers: "Fessiers",
  "ischio-jambiers": "Ischio-jambiers",
  mollets: "Mollets",
  pectoraux: "Pectoraux",
  quadriceps: "Quadriceps",
  triceps: "Triceps",
  lombaires: "Lombaires",
  "avant-bras": "Avant-bras",
  adducteurs: "Adducteurs",
  abducteurs: "Abducteurs",
};

const PATTERN_LABELS: Record<string, string> = {
  // Full movement pattern slugs
  horizontal_push: "Poussée horiz.",
  vertical_push: "Poussée vert.",
  horizontal_pull: "Tirage horiz.",
  vertical_pull: "Tirage vert.",
  squat_pattern: "Squat",
  hip_hinge: "Charnière hanche",
  knee_flexion: "Flexion genou",
  knee_extension: "Extension genou",
  calf_raise: "Mollets",
  elbow_flexion: "Biceps",
  elbow_extension: "Triceps",
  lateral_raise: "Élévation lat.",
  carry: "Porté",
  core_anti_flex: "Gainage",
  core_flex: "Core flex",
  core_rotation: "Rotation core",
  scapular_elevation: "Élév. scapulaire",
  hip_abduction: "Abduction hanche",
  hip_adduction: "Adduction hanche",
  shoulder_rotation: "Rotation épaule",
  scapular_retraction: "Rétraction scap.",
  scapular_protraction: "Protraction scap.",
};

// Faisceaux anatomiquement liés à chaque groupe musculaire (map statique, indépendante du catalogue)
const FIBERS_BY_GROUP: Record<string, string[]> = {
  fessiers:          ['gluteus_maximus', 'gluteus_medius', 'gluteus_minimus'],
  epaules:           ['anterior_deltoid', 'medial_deltoid', 'posterior_deltoid', 'rotator_cuff', 'subscapularis'],
  pectoraux:         ['pectoralis_major', 'pectoralis_major_upper', 'pectoralis_major_lower', 'pectoralis_minor'],
  dos:               ['latissimus_dorsi', 'lats', 'upper_back', 'rhomboids', 'trapezius', 'trapezius_upper', 'trapezius_middle', 'trapezius_lower', 'traps', 'upper_traps', 'spine_erectors'],
  biceps:            ['biceps_brachii', 'brachialis'],
  triceps:           ['triceps_brachii'],
  quadriceps:        ['quadriceps', 'rectus_femoris', 'vastus_lateralis', 'vastus_medialis'],
  'ischio-jambiers': ['hamstrings', 'biceps_femoris', 'semimembranosus', 'semitendinosus'],
  mollets:           ['gastrocnemius', 'soleus'],
  abdos:             ['rectus_abdominis', 'lower_abs', 'obliques', 'transverse_abdominis', 'core', 'core_global'],
  lombaires:         ['spine_erectors'],
  'avant-bras':        ['brachioradialis', 'extensor_carpi_radialis', 'extensor_carpi_ulnaris', 'flexor_carpi_radialis', 'flexor_carpi_ulnaris', 'palmaris_longus', 'pronator_teres', 'supinator', 'wrist_flexors', 'wrist_extensors', 'finger_flexors', 'grip_flexors', 'pronators_supinators', 'forearm_flexors', 'forearm_stabilizers', 'wrist_stabilizers'],
  adducteurs:        ['adductors'],
  abducteurs:        ['abductors'],
}

// Faisceau précis EN → label FR (même mapping que BIOMECH_TO_FR + FIBER_LABEL_FR côté scoring)
const FIBER_LABELS: Record<string, string> = {
  // Fessiers
  gluteus_maximus: 'Grand fessier', gluteus_medius: 'Moyen fessier', gluteus_minimus: 'Petit fessier', glutes: 'Fessiers',
  // Ischio-jambiers
  hamstrings: 'Ischio-jambiers', biceps_femoris: 'Biceps fémoral', semimembranosus: 'Semi-membraneux', semitendinosus: 'Semi-tendineux',
  // Quadriceps
  quadriceps: 'Quadriceps', rectus_femoris: 'Droit fémoral', vastus_lateralis: 'Vaste latéral', vastus_medialis: 'Vaste médial',
  // Dos
  latissimus_dorsi: 'Grand dorsal', lats: 'Grand dorsal', upper_back: 'Dos sup.', rhomboids: 'Rhomboïdes',
  trapezius: 'Trapèze', trapezius_upper: 'Trapèze sup.', trapezius_middle: 'Trapèze moy.', trapezius_lower: 'Trapèze inf.',
  traps: 'Trapèze', upper_traps: 'Trapèze sup.', spine_erectors: 'Érecteurs rachis',
  // Pectoraux
  pectoralis_major: 'Grand pectoral', pectoralis_major_upper: 'Grand pect. sup.', pectoralis_major_lower: 'Grand pect. inf.', pectoralis_minor: 'Petit pectoral',
  // Épaules
  deltoid_anterior: 'Deltoïde ant.', deltoid_lateral: 'Deltoïde lat.', deltoid_posterior: 'Deltoïde post.',
  anterior_deltoid: 'Deltoïde ant.', medial_deltoid: 'Deltoïde lat.', posterior_deltoid: 'Deltoïde post.',
  rotator_cuff: 'Coiffe rotateurs', subscapularis: 'Subscapulaire',
  // Bras
  biceps_brachii: 'Biceps', brachialis: 'Brachial ant.', triceps_brachii: 'Triceps',
  // Avant-bras
  brachioradialis: 'Brachio-radial', extensor_carpi_radialis: 'Ext. carpi rad.', extensor_carpi_ulnaris: 'Ext. carpi uln.',
  flexor_carpi_radialis: 'Fléch. carpi rad.', flexor_carpi_ulnaris: 'Fléch. carpi uln.',
  palmaris_longus: 'Palmaire long', pronator_teres: 'Rond pronateur', supinator: 'Supinateur',
  wrist_flexors: 'Fléch. poignet', wrist_extensors: 'Ext. poignet',
  finger_flexors: 'Fléch. doigts', grip_flexors: 'Fléch. grip',
  pronators_supinators: 'Pronateurs/Supinateurs', forearm_flexors: 'Fléch. avant-bras',
  forearm_stabilizers: 'Stab. avant-bras', wrist_stabilizers: 'Stab. poignet',
  // Mollets
  gastrocnemius: 'Gastrocnémien', soleus: 'Soléaire',
  // Core
  rectus_abdominis: 'Droit abdominal', lower_abs: 'Abdominaux inf.', obliques: 'Obliques',
  transverse_abdominis: 'Transverse', core: 'Sangle abdominale', core_global: 'Sangle abdominale',
  // Autres stabilisateurs
  hip_flexors: 'Fléch. hanche', adductors: 'Adducteurs', abductors: 'Abducteurs',
  knee: 'Genou', ankle: 'Cheville', calves: 'Mollets',
}

// Termes de recherche FR → slugs EN du catalogue (pour la recherche textuelle par muscle)
const SEARCH_MUSCLE_ALIASES: Array<{ terms: string[]; slugs: string[] }> = [
  { terms: ['grand fessier', 'fessier max', 'gluteus max', 'grand fess'], slugs: ['gluteus_maximus'] },
  { terms: ['moyen fessier', 'gluteus med', 'fessier med', 'moyen fess'], slugs: ['gluteus_medius'] },
  { terms: ['petit fessier', 'gluteus min', 'fessier min', 'petit fess'], slugs: ['gluteus_minimus'] },
  { terms: ['fessier', 'fesse', 'glute', 'boule'], slugs: ['gluteus_maximus', 'gluteus_medius', 'gluteus_minimus', 'glutes'] },
  { terms: ['ischio', 'ischios', 'biceps femoral', 'hamstring', 'ischio-jamb', 'ischios jamb'], slugs: ['hamstrings', 'biceps_femoris', 'semimembranosus', 'semitendinosus'] },
  { terms: ['quadriceps', 'quad', 'droit femoral', 'vaste'], slugs: ['quadriceps', 'rectus_femoris', 'vastus_lateralis', 'vastus_medialis'] },
  { terms: ['grand dorsal', 'dorsal', 'lat', 'lats', 'latissimus', 'dos large'], slugs: ['latissimus_dorsi', 'lats'] },
  { terms: ['lombaire', 'lombaires', 'erecteurs', 'erect', 'bas du dos'], slugs: ['spine_erectors'] },
  { terms: ['trapeze', 'trap', 'rhomboid', 'rhombo', 'dos superieur', 'haut du dos', 'upper back', 'interscapulaire'], slugs: ['trapezius', 'trapezius_upper', 'trapezius_middle', 'trapezius_lower', 'traps', 'upper_traps', 'rhomboids', 'upper_back'] },
  { terms: ['grand pectoral', 'pectoral', 'pecto', 'pecs', 'poitrine'], slugs: ['pectoralis_major', 'pectoralis_major_upper', 'pectoralis_major_lower', 'pectoralis_minor'] },
  { terms: ['deltoide anterieur', 'deltoide ant', 'epaule avant', 'epaule anterieure', 'deltoid ant', 'anterior delt'], slugs: ['deltoid_anterior', 'anterior_deltoid'] },
  { terms: ['deltoide lateral', 'deltoide lat', 'epaule lateral', 'lateral delt', 'medial delt', 'epaule milieu'], slugs: ['deltoid_lateral', 'medial_deltoid'] },
  { terms: ['deltoide posterieur', 'deltoide post', 'epaule arriere', 'rear delt', 'posterior delt'], slugs: ['deltoid_posterior', 'posterior_deltoid'] },
  { terms: ['deltoide', 'epaule', 'epaules', 'shoulder', 'coiffe'], slugs: ['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior', 'anterior_deltoid', 'medial_deltoid', 'posterior_deltoid', 'rotator_cuff', 'subscapularis'] },
  { terms: ['biceps brachii', 'biceps', 'bras avant'], slugs: ['biceps_brachii', 'brachialis', 'brachioradialis'] },
  { terms: ['triceps', 'bras arriere'], slugs: ['triceps_brachii'] },
  { terms: ['avant bras', 'avant-bras', 'forearm', 'brachio', 'poignet', 'wrist', 'pronation', 'supination', 'extenseur poignet', 'flechisseur poignet'], slugs: ['brachioradialis', 'extensor_carpi_radialis', 'extensor_carpi_ulnaris', 'flexor_carpi_radialis', 'flexor_carpi_ulnaris', 'palmaris_longus', 'pronator_teres', 'supinator', 'wrist_flexors', 'wrist_extensors'] },
  { terms: ['mollet', 'mollets', 'calf', 'calves', 'gastro', 'soleus', 'soleaire'], slugs: ['gastrocnemius', 'soleus'] },
  { terms: ['abdominaux', 'abdo', 'abdos', 'core', 'gainage', 'sangle', 'transverse', 'oblique', 'droit abdominal'], slugs: ['rectus_abdominis', 'lower_abs', 'obliques', 'transverse_abdominis', 'core', 'core_global'] },
  { terms: ['adducteur', 'adducteurs', 'interieur cuisse', 'intérieur cuisse'], slugs: ['adductors'] },
  { terms: ['abducteur', 'abducteurs', 'exterieur cuisse', 'extérieur cuisse'], slugs: ['abductors'] },
  { terms: ['flechisseur', 'flechisseurs hanche', 'psoas', 'hip flexor'], slugs: ['hip_flexors'] },
]

const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Barre",
  dumbbell: "Haltères",
  machine: "Machine",
  cable: "Poulie",
  bodyweight: "Poids du corps",
  kettlebell: "Kettlebell",
  band: "Élastique",
  smith: "Smith Machine",
  landmine: "Landmine",
  trx: "Sangles/TRX",
  medicine_ball: "Médecine-ball",
  swiss_ball: "Swiss Ball",
  trap_bar: "Trap Bar",
  ez_bar: "Barre EZ",
  rings: "Anneaux",
  sled: "Traîneau",
  sandbag: "Sandbag",
};

const catalog = exerciseCatalog as CatalogEntry[];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ExercisePicker({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [filterMuscle, setFilterMuscle] = useState<string>("");
  const [filterPattern, setFilterPattern] = useState<string>("");
  const [filterEquipment, setFilterEquipment] = useState<string>("");
  const [filterCompound, setFilterCompound] = useState<
    "all" | "compound" | "isolation"
  >("all");
  const [filterType, setFilterType] = useState<
    "all" | "exercise" | "pedagogique"
  >("all");
  const [showFilters, setShowFilters] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const [sourceFilter, setSourceFilter] = useState<'all' | 'stryvr' | 'custom'>('all')
  const [filterFiber, setFilterFiber] = useState<string>('')
  const [customExercises, setCustomExercises] = useState<CatalogEntry[]>([])
  const [showCustomModal, setShowCustomModal] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    fetch('/api/exercises/custom')
      .then(r => r.ok ? r.json() : [])
      .then((data: Array<{
        id: string; name: string; slug: string;
        muscle_group: string | null; movement_pattern: string | null;
        equipment: string[]; is_compound: boolean; muscles: string[];
        media_url: string | null;
        plane: string | null; mechanic: string | null; unilateral: boolean;
        primary_muscle: string | null; primary_activation: number | null;
        secondary_muscles_detail: string[]; secondary_activations: number[];
        stabilizers: string[];
        joint_stress_spine: number | null; joint_stress_knee: number | null;
        joint_stress_shoulder: number | null; global_instability: number | null;
        coordination_demand: number | null; constraint_profile: string | null;
      }>) => {
        setCustomExercises(data.map(e => ({
          id: e.id,
          name: e.name,
          slug: e.slug,
          gifUrl: e.media_url ?? '',
          muscleGroup: e.muscle_group ?? 'custom',
          exerciseType: 'exercise' as const,
          pattern: e.movement_pattern ? [e.movement_pattern] : [],
          movementPattern: e.movement_pattern,
          equipment: e.equipment,
          isCompound: e.is_compound,
          muscles: e.muscles,
          source: 'custom' as const,
          plane: e.plane,
          mechanic: e.mechanic,
          unilateral: e.unilateral,
          primaryMuscle: e.primary_muscle,
          primaryActivation: e.primary_activation,
          secondaryMuscles: e.secondary_muscles_detail,
          secondaryActivations: e.secondary_activations,
          stabilizers: e.stabilizers,
          jointStressSpine: e.joint_stress_spine,
          jointStressKnee: e.joint_stress_knee,
          jointStressShoulder: e.joint_stress_shoulder,
          globalInstability: e.global_instability,
          coordinationDemand: e.coordination_demand,
          constraintProfile: e.constraint_profile,
        })))
      })
      .catch(() => {})
  }, [])

  const allExercises = useMemo<CatalogEntry[]>(() => [
    ...catalog.map(e => ({ ...e, source: 'catalog' as const })),
    ...customExercises,
  ], [customExercises])

  // All unique values for filter dropdowns
  const allPatterns = useMemo(() => {
    const s = new Set<string>();
    allExercises.forEach((e) => e.pattern.forEach((p) => s.add(p)));
    return Array.from(s).sort();
  }, [allExercises]);

  const allEquipment = useMemo(() => {
    const s = new Set<string>();
    allExercises.forEach((e) => e.equipment.forEach((eq) => s.add(eq)));
    return Array.from(s).sort();
  }, [allExercises]);

  // Only show muscle pills for groups that actually have exercises
  const availableMuscleGroups = useMemo(() => {
    const s = new Set<string>();
    allExercises.forEach((e) => { if (e.muscleGroup) s.add(e.muscleGroup) });
    // Keep MUSCLE_LABELS order, only include groups present in catalog/custom
    return Object.keys(MUSCLE_LABELS).filter(k => s.has(k));
  }, [allExercises]);

  const filtered = useMemo(() => {
    let results = allExercises;

    if (sourceFilter === 'custom') {
      results = results.filter(e => e.source === 'custom')
    } else if (sourceFilter === 'stryvr') {
      results = results.filter(e => e.source !== 'custom')
    }

    if (search.trim()) {
      const normalize = (s: string) =>
        s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const q = normalize(search)
      const matchedSlugs = new Set<string>()
      for (const { terms, slugs } of SEARCH_MUSCLE_ALIASES) {
        if (terms.some(t => normalize(t).includes(q) || q.includes(normalize(t)))) {
          slugs.forEach(s => matchedSlugs.add(s))
        }
      }
      results = results.filter((e) => {
        const name = normalize(e.name)
        const slug = e.slug.replace(/-/g, ' ')
        const group = normalize(e.muscleGroup ?? '')
        const muscles = (e.muscles ?? []).map(normalize)
        const pattern = (e.pattern ?? []).map((p: string) => normalize(PATTERN_LABELS[p] ?? p)).join(' ')
        const equip = (e.equipment ?? []).map(eq => normalize(EQUIPMENT_LABELS[eq] ?? eq))
        const pm = e.primaryMuscle ?? ''
        const secondaries = e.secondaryMuscles ?? []
        const stabilizers = e.stabilizers ?? []
        const allBiomechSlugs = [pm, ...secondaries, ...stabilizers].filter(Boolean)
        const allFiberLabels = allBiomechSlugs.map(s => normalize(FIBER_LABELS[s] ?? s))
        const textMatch =
          name.includes(q) || slug.includes(q) || group.includes(q) ||
          muscles.some(m => m.includes(q)) || pattern.includes(q) ||
          equip.some(eq => eq.includes(q)) ||
          allFiberLabels.some(l => l.includes(q))
        const aliasMatch = matchedSlugs.size > 0 &&
          allBiomechSlugs.some(s => matchedSlugs.has(s))
        return textMatch || aliasMatch
      })
    }

    if (filterMuscle) {
      results = results.filter((e) => e.muscleGroup === filterMuscle);
    }

    if (filterFiber) {
      results = results.filter((e) => {
        const allSlugs = [
          e.primaryMuscle ?? '',
          ...(e.secondaryMuscles ?? []),
          ...(e.stabilizers ?? []),
        ].filter(Boolean)
        return allSlugs.includes(filterFiber)
      })
    }

    if (filterPattern) {
      results = results.filter((e) => e.pattern.includes(filterPattern));
    }

    if (filterEquipment) {
      results = results.filter((e) => e.equipment.includes(filterEquipment));
    }

    if (filterCompound === "compound") {
      results = results.filter((e) => e.isCompound);
    } else if (filterCompound === "isolation") {
      results = results.filter((e) => !e.isCompound);
    }

    // Par défaut ('all') = exercices uniquement. 'pedagogique' = démos uniquement.
    if (filterType === "pedagogique") {
      results = results.filter((e) => e.exerciseType === "pedagogique");
    } else {
      results = results.filter((e) => e.exerciseType === "exercise");
    }

    return results;
  }, [
    search,
    sourceFilter,
    filterMuscle,
    filterFiber,
    filterPattern,
    filterEquipment,
    filterCompound,
    filterType,
    allExercises,
  ]);

  const activeFiltersCount = [
    filterMuscle,
    filterFiber,
    filterPattern,
    filterEquipment,
    filterCompound !== "all",
    filterType !== "all",
    sourceFilter !== "all",
  ].filter(Boolean).length;

  const availableFibers = useMemo(() => {
    const counts: Record<string, number> = {}
    allExercises.forEach((e) => {
      const allSlugs = [
        e.primaryMuscle ?? '',
        ...(e.secondaryMuscles ?? []),
        ...(e.stabilizers ?? []),
      ].filter(Boolean)
      allSlugs.forEach(s => { counts[s] = (counts[s] ?? 0) + 1 })
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([slug]) => slug)
      .filter(s => FIBER_LABELS[s])
  }, [allExercises])

  // Faisceaux affichés dans le filtre : map statique si groupe sélectionné, sinon tous les slugs connus
  const adaptedFibers = useMemo(() => {
    if (filterMuscle && FIBERS_BY_GROUP[filterMuscle]) {
      return FIBERS_BY_GROUP[filterMuscle].filter(s => FIBER_LABELS[s])
    }
    // Pas de groupe sélectionné : tous les faisceaux du catalogue triés par fréquence
    return availableFibers
  }, [filterMuscle, availableFibers])

  // Adaptive: patterns limited to those present in exercises matching current muscleGroup + fiber filters
  const adaptedPatterns = useMemo(() => {
    let base = allExercises
    if (filterMuscle) base = base.filter(e => e.muscleGroup === filterMuscle)
    if (filterFiber) base = base.filter(e => {
      const allSlugs = [e.primaryMuscle ?? '', ...(e.secondaryMuscles ?? []), ...(e.stabilizers ?? [])].filter(Boolean)
      return allSlugs.includes(filterFiber)
    })
    const seen = new Set<string>()
    base.forEach(e => e.pattern.forEach((p: string) => seen.add(p)))
    return allPatterns.filter(p => seen.has(p))
  }, [allExercises, filterMuscle, filterFiber, allPatterns])

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="bg-[#181818] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl flex flex-col"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-white/20 shrink-0">
          <div className="flex-1 relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un exercice…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0a0a0a] border-input text-sm text-white outline-none focus:ring-2 focus:ring-[#1f8a65]/40 placeholder:text-white/25 h-10"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((f) => !f)}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              showFilters || activeFiltersCount > 0
                ? "bg-[#1f8a65] text-white"
                : "bg-white/[0.03] text-white/70 hover:text-white"
            }`}
          >
            <SlidersHorizontal size={13} />
            Filtres
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1f8a65] text-white text-[9px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="px-4 py-3 border-b border-[0.3px] border-white/[0.06] shrink-0 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {/* Groupe musculaire */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/30 uppercase tracking-[0.12em]">Groupe musculaire</label>
                <div className="relative">
                  <select
                    value={filterMuscle}
                    onChange={(e) => { setFilterMuscle(e.target.value); setFilterFiber(""); setFilterPattern(""); }}
                    className={`w-full appearance-none pl-3 pr-7 h-8 rounded-lg text-[12px] outline-none focus:ring-1 focus:ring-[#1f8a65]/40 cursor-pointer transition-colors ${filterMuscle ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.04] text-white/80'}`}
                  >
                    <option value="">Tous</option>
                    {availableMuscleGroups.map((v) => (
                      <option key={v} value={v}>{MUSCLE_LABELS[v]}</option>
                    ))}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
              </div>

              {/* Faisceau musculaire — adaptatif selon groupe */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/30 uppercase tracking-[0.12em]">
                  {filterMuscle ? `Faisceau — ${MUSCLE_LABELS[filterMuscle]}` : 'Faisceau musculaire'}
                </label>
                <div className="relative">
                  <select
                    value={filterFiber}
                    onChange={(e) => { setFilterFiber(e.target.value); setFilterPattern(""); }}
                    className={`w-full appearance-none pl-3 pr-7 h-8 rounded-lg text-[12px] outline-none focus:ring-1 focus:ring-[#1f8a65]/40 cursor-pointer transition-colors ${filterFiber ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.04] text-white/80'}`}
                  >
                    <option value="">Tous</option>
                    {adaptedFibers.map((s) => (
                      <option key={s} value={s}>{FIBER_LABELS[s]}</option>
                    ))}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
              </div>

              {/* Mouvement — adaptatif selon groupe + faisceau */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/30 uppercase tracking-[0.12em]">Mouvement</label>
                <div className="relative">
                  <select
                    value={filterPattern}
                    onChange={(e) => setFilterPattern(e.target.value)}
                    className={`w-full appearance-none pl-3 pr-7 h-8 rounded-lg text-[12px] outline-none focus:ring-1 focus:ring-[#1f8a65]/40 cursor-pointer transition-colors ${filterPattern ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.04] text-white/80'}`}
                  >
                    <option value="">Tous</option>
                    {adaptedPatterns.map((p) => (
                      <option key={p} value={p}>{PATTERN_LABELS[p] ?? p}</option>
                    ))}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
              </div>

              {/* Matériel */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/30 uppercase tracking-[0.12em]">Matériel</label>
                <div className="relative">
                  <select
                    value={filterEquipment}
                    onChange={(e) => setFilterEquipment(e.target.value)}
                    className={`w-full appearance-none pl-3 pr-7 h-8 rounded-lg text-[12px] outline-none focus:ring-1 focus:ring-[#1f8a65]/40 cursor-pointer transition-colors ${filterEquipment ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.04] text-white/80'}`}
                  >
                    <option value="">Tous</option>
                    {allEquipment.map((eq) => (
                      <option key={eq} value={eq}>{EQUIPMENT_LABELS[eq] ?? eq}</option>
                    ))}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
              </div>

              {/* Articulations */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/30 uppercase tracking-[0.12em]">Articulations</label>
                <div className="relative">
                  <select
                    value={filterCompound}
                    onChange={(e) => setFilterCompound(e.target.value as "all" | "compound" | "isolation")}
                    className={`w-full appearance-none pl-3 pr-7 h-8 rounded-lg text-[12px] outline-none focus:ring-1 focus:ring-[#1f8a65]/40 cursor-pointer transition-colors ${filterCompound !== 'all' ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.04] text-white/80'}`}
                  >
                    <option value="all">Tous</option>
                    <option value="compound">Polyarticulaire</option>
                    <option value="isolation">Isolation</option>
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
              </div>

              {/* Contenu */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/30 uppercase tracking-[0.12em]">Contenu</label>
                <div className="relative">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as "all" | "pedagogique")}
                    className={`w-full appearance-none pl-3 pr-7 h-8 rounded-lg text-[12px] outline-none focus:ring-1 focus:ring-[#1f8a65]/40 cursor-pointer transition-colors ${filterType !== 'all' ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.04] text-white/80'}`}
                  >
                    <option value="all">Exercices</option>
                    <option value="pedagogique">Démos pédagogiques</option>
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Reset */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => { setFilterMuscle(""); setFilterFiber(""); setFilterPattern(""); setFilterEquipment(""); setFilterCompound("all"); setFilterType("all"); }}
                className="text-[11px] text-white/40 hover:text-white/70 transition-colors"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}

        {/* Source filter pills + Create button */}
        <div className="px-4 pt-2 pb-1 flex items-center gap-2 shrink-0">
          {(
            [
              { value: 'all', label: 'Tous' },
              { value: 'stryvr', label: 'Catalogue STRYVR' },
              { value: 'custom', label: 'Mes exercices' },
            ] as const
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSourceFilter(value)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                sourceFilter === value
                  ? 'bg-[#1f8a65]/10 text-[#1f8a65]'
                  : 'bg-white/[0.02] text-white/35 hover:bg-white/[0.05] hover:text-white/60'
              }`}
            >
              {label}
            </button>
          ))}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setShowCustomModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-white/[0.04] text-white/50 hover:bg-white/[0.07] hover:text-white/80 transition-all"
          >
            <Plus size={11} />
            Créer un exercice
          </button>
        </div>

        {/* Results count */}
        <div className="px-4 py-1 shrink-0">
          <p className="text-[10px] text-white/70 font-medium">
            {filtered.length} exercice{filtered.length !== 1 ? "s" : ""}
            {search || activeFiltersCount > 0 ? " trouvés" : " disponibles"}
          </p>
        </div>

        {/* Custom Exercise Modal */}
        {showCustomModal && (
          <CustomExerciseModal
            onClose={() => setShowCustomModal(false)}
            onCreated={(ex) => {
              const newEntry: CatalogEntry = {
                id: `custom-${Date.now()}`,
                name: ex.name,
                slug: ex.name.toLowerCase().replace(/\s+/g, '-'),
                gifUrl: ex.mediaUrl,
                muscleGroup: ex.muscleGroup || 'custom',
                exerciseType: 'exercise',
                pattern: ex.movementPattern ? [ex.movementPattern] : [],
                movementPattern: ex.movementPattern || null,
                equipment: ex.equipment,
                isCompound: ex.isCompound,
                muscles: ex.primaryMuscle ? [ex.primaryMuscle] : [],
                source: 'custom',
                primaryMuscle: ex.primaryMuscle,
                primaryActivation: ex.primaryActivation,
                jointStressSpine: ex.jointStressSpine,
                jointStressKnee: ex.jointStressKnee,
                jointStressShoulder: ex.jointStressShoulder,
                globalInstability: ex.globalInstability,
                coordinationDemand: ex.coordinationDemand,
                constraintProfile: ex.constraintProfile,
              }
              setCustomExercises(prev => [...prev, newEntry])
              // Clear any active filters that could hide the new exercise
              setFilterMuscle('')
              setFilterPattern('')
              setFilterEquipment('')
              setFilterCompound('all')
              setSearch('')
              setSourceFilter('custom')
              setShowCustomModal(false)
            }}
          />
        )}

        {/* Grid */}
        <div className="overflow-y-auto flex-1 px-3 pb-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/60 gap-2">
              <Search size={28} className="opacity-30" />
              <p className="text-sm">Aucun exercice trouvé</p>
              <p className="text-xs opacity-60">
                Modifie ta recherche ou tes filtres
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => {
                    onSelect({
                      name: exercise.name,
                      gifUrl: exercise.gifUrl,
                      movementPattern: exercise.movementPattern ?? null,
                      equipment: exercise.equipment ?? [],
                      isCompound: exercise.isCompound ?? false,
                      // Priorité : primaryMuscle anatomique précis (ex: 'traps') > muscles[] générique (ex: 'dos')
                      primaryMuscles: exercise.primaryMuscle
                        ? [exercise.primaryMuscle]
                        : exercise.muscles ?? [],
                      secondaryMuscles: exercise.secondaryMuscles ?? [],
                      plane: exercise.plane ?? null,
                      mechanic: exercise.mechanic ?? null,
                      unilateral: exercise.unilateral ?? false,
                      primaryMuscle: exercise.primaryMuscle ?? null,
                      primaryActivation: exercise.primaryActivation ?? null,
                      secondaryMusclesDetail: exercise.secondaryMuscles ?? [],
                      secondaryActivations: exercise.secondaryActivations ?? [],
                      stabilizers: exercise.stabilizers ?? [],
                      jointStressSpine: exercise.jointStressSpine ?? null,
                      jointStressKnee: exercise.jointStressKnee ?? null,
                      jointStressShoulder: exercise.jointStressShoulder ?? null,
                      globalInstability: exercise.globalInstability ?? null,
                      coordinationDemand: exercise.coordinationDemand ?? null,
                      constraintProfile: exercise.constraintProfile ?? null,
                    })
                  }}
                  onMouseEnter={() => setHoveredId(exercise.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="group relative flex flex-col bg-[#0a0a0a] rounded-2xl overflow-hidden hover:bg-white/[0.04] active:scale-[0.98] transition-all text-left"
                >
                  {/* GIF */}
                  <div className="relative w-full aspect-square bg-black/5 overflow-hidden">
                    {exercise.gifUrl ? (
                      <Image
                        src={exercise.gifUrl}
                        alt={exercise.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a]">
                        <span className="text-[9px] font-semibold text-white/20 text-center px-2 leading-tight">
                          {exercise.name}
                        </span>
                      </div>
                    )}
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-[#1f8a65]/0 group-hover:bg-[#1f8a65]/10 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-[#1f8a65] text-white rounded-full p-1.5">
                        <Check size={14} />
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-2 flex flex-col gap-1">
                    <div className="flex items-start gap-1">
                      <p className="text-[11px] font-semibold text-white leading-tight line-clamp-2 flex-1">
                        {exercise.name}
                      </p>
                      {exercise.source === 'custom' && (
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#1f8a65]/15 text-[#1f8a65]">
                          Perso
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {exercise.exerciseType === "pedagogique" ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.04] text-white/80">
                          🎓 Pédagogique
                        </span>
                      ) : (
                        <>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#1f8a65]/10 text-[#1f8a65]">
                            {MUSCLE_LABELS[exercise.muscleGroup] ??
                              exercise.muscleGroup}
                          </span>
                          {exercise.isCompound ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.04] text-white/80">
                              Poly
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.04] text-white/80">
                              Iso
                            </span>
                          )}
                          {exercise.pattern.slice(0, 1).map((p) => (
                            <span
                              key={p}
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#0a0a0a] text-white/70"
                            >
                              {PATTERN_LABELS[p] ?? p}
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
