import catalogData from '@/data/exercise-catalog.json'
import type { InjuryRestriction, BiomechData } from './types'
import type { CanonicalMuscle } from './muscle-normalization'
import { deriveFiberTargets } from './exercise-fibers'

// ─── Muscle Volume Grouping ──────────────────────────────────────────────────
// Authoritative mapping from canonical muscles to volume tracking groups
// Used by scoring engine + volume distribution charts

export const MUSCLE_TO_VOLUME_GROUP: Record<CanonicalMuscle, string> = {
  // Poitrine
  grand_pectoral: 'Pectoraux - Grand',
  grand_pectoral_superieur: 'Pectoraux - Haut',
  grand_pectoral_inferieur: 'Pectoraux - Bas',
  petit_pectoral: 'Pectoraux - Petit',

  // Dos
  grand_dorsal: 'Dos - Grand dorsal',
  trapeze_superieur: 'Dos - Trapèzes',
  trapeze_moyen: 'Dos - Trapèzes',
  trapeze_inferieur: 'Dos - Trapèzes',
  rhomboides: 'Dos - Rhomboïdes',
  lombaires: 'Dos - Lombaires',
  erecteurs_spinaux: 'Dos - Érecteurs',

  // Épaules
  deltoide_anterieur: 'Épaules - Antérieur',
  deltoide_lateral: 'Épaules - Latéral',
  deltoide_posterieur: 'Épaules - Postérieur',

  // Bras
  biceps: 'Bras - Biceps',
  biceps_brachial: 'Bras - Biceps',
  brachial: 'Bras - Brachial',
  triceps: 'Bras - Triceps',
  triceps_lateral: 'Bras - Triceps',
  triceps_medial: 'Bras - Triceps',
  triceps_long: 'Bras - Triceps',

  // Avant-bras
  flechisseurs_avant_bras: 'Avant-bras',
  extenseurs_avant_bras: 'Avant-bras',

  // Jambes (haut)
  quadriceps: 'Jambes - Quadriceps',
  rectus_femoris: 'Jambes - Quadriceps',
  vaste_lateral: 'Jambes - Quadriceps',
  vaste_medial: 'Jambes - Quadriceps',
  vaste_intermediaire: 'Jambes - Quadriceps',

  // Jambes (arrière)
  ischio_jambiers: 'Jambes - Ischio-jambiers',
  biceps_femoral: 'Jambes - Ischio-jambiers',
  semi_tendineux: 'Jambes - Ischio-jambiers',
  semi_membraneux: 'Jambes - Ischio-jambiers',

  // Fessiers
  grand_fessier: 'Fessiers - Grand',
  moyen_fessier: 'Fessiers - Moyen',
  petit_fessier: 'Fessiers - Petit',

  // Adducteurs/Abducteurs
  adducteurs: 'Jambes - Adducteurs',
  abducteurs: 'Jambes - Abducteurs',

  // Mollets
  mollet: 'Jambes - Mollet',
  solea: 'Jambes - Mollet',
  gastrocnemien: 'Jambes - Mollet',
  tibial_anterieur: 'Jambes - Tibial antérieur',

  // Core
  abdos: 'Core - Abdominaux',
  obliques_externes: 'Core - Obliques',
  obliques_internes: 'Core - Obliques',
  transverse_abdominal: 'Core - Transverse',

  // Internal catch-all (should not appear in normalized data)
  dos_large: 'Dos - Général',
  cardio: 'Cardio',
}

/**
 * Get volume group for a muscle.
 * Used by scoring to aggregate volume by muscle group.
 */
export function getVolumeGroup(muscle: CanonicalMuscle): string {
  return MUSCLE_TO_VOLUME_GROUP[muscle] ?? 'Inconnu'
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface CatalogEntry {
  id: string
  name: string
  slug: string
  gifUrl?: string | null
  movementPattern: string | null
  isCompound: boolean
  stimulus_coefficient: number
  muscles?: string[]
  muscleGroup?: string
  // Biomech fields (present after merge script)
  plane?: string | null
  mechanic?: string | null
  unilateral?: boolean
  primaryMuscle?: string | null
  primaryActivation?: number | null
  secondaryMuscles?: string[]
  fiberTargets?: string[]
  secondaryActivations?: number[]
  stabilizers?: string[]
  jointStressSpine?: number | null
  jointStressKnee?: number | null
  jointStressShoulder?: number | null
  globalInstability?: number | null
  coordinationDemand?: number | null
  constraintProfile?: string | null
}

export const DEFAULT_EXERCISE_MEDIA_URL = '/bibliotheque_exercices/_placeholders/exercice-sans-media.svg'

const catalog = catalogData as CatalogEntry[]
// For duplicate slugs, prefer the most enriched entry (has primaryMuscle > has jointStressSpine > first)
const catalogBySlug = new Map<string, CatalogEntry>()
for (const e of catalog) {
  const existing = catalogBySlug.get(e.slug)
  if (!existing) { catalogBySlug.set(e.slug, e); continue }
  const existingScore = (existing.primaryMuscle ? 2 : 0) + (existing.jointStressSpine != null ? 1 : 0)
  const newScore = (e.primaryMuscle ? 2 : 0) + (e.jointStressSpine != null ? 1 : 0)
  if (newScore > existingScore) catalogBySlug.set(e.slug, e)
}

// ─── toSlug helper ────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ─── Normalisation slugs muscles ─────────────────────────────────────────────
// Le builder stocke les slugs FR (depuis MUSCLE_GROUPS dans ProgramTemplateBuilder).
// Si un ancien exercice ou exercice custom utilise des slugs EN, on les normalise.

const MUSCLE_SLUG_MAP: Record<string, string> = {
  glutes: 'fessiers',
  hamstrings: 'ischio-jambiers',
  back: 'dos',
  back_upper: 'dos',
  back_lower: 'dos',
  shoulders: 'epaules',
  chest: 'pectoraux',
  quads: 'quadriceps',
  calves: 'mollets',
  abs: 'abdos',
  traps: 'dos',
}

export function normalizeMuscleSlug(slug: string): string {
  return MUSCLE_SLUG_MAP[slug] ?? slug
}

// ─── getBiomechData ───────────────────────────────────────────────────────────
// Looks up biomechanical data from the enriched catalog by exercise name.
// Returns null if the exercise is not in the catalog or lacks biomech fields.

// Returns the primaryMuscle EN slug for any catalog exercise, even non-biomech-enriched ones.
export function getPrimaryMuscleFromCatalog(exerciseName: string): string | null {
  const slug = toSlug(exerciseName)
  const entry = catalogBySlug.get(slug) ?? catalog.find(e => toSlug(e.name) === slug)
  if (entry) return entry.primaryMuscle ?? null
  return resolveCatalogEntryByHeuristics(exerciseName)?.primaryMuscle ?? null
}

export function getMusclesFromCatalog(exerciseName: string): string[] {
  const slug = toSlug(exerciseName)
  const entry = catalogBySlug.get(slug) ?? catalog.find(e => toSlug(e.name) === slug)
  return entry?.muscles ?? []
}

export function getSecondaryMusclesFromCatalog(exerciseName: string): string[] {
  const slug = toSlug(exerciseName)
  const entry = catalogBySlug.get(slug) ?? catalog.find(e => toSlug(e.name) === slug)
  return (entry as any)?.secondaryMuscles ?? []
}

export function getFiberTargetsFromCatalog(exerciseName: string): string[] {
  const slug = toSlug(exerciseName)
  const entry = catalogBySlug.get(slug) ?? catalog.find(e => toSlug(e.name) === slug)
  if (!entry) return []
  return entry.fiberTargets?.length ? entry.fiberTargets : deriveFiberTargets(entry)
}

export interface CatalogExerciseLookup {
  name: string
  slug: string
  gifUrl: string | null
  movementPattern: string | null
  equipment: string[]
  isCompound: boolean
  primaryMuscle: string | null
  constraintProfile: string | null
  plane: string | null
  mechanic: string | null
  unilateral: boolean
  muscles: string[]
  secondaryMuscles: string[]
  fiberTargets: string[]
}

export function getCatalogEntryByName(exerciseName: string): CatalogExerciseLookup | null {
  const slug = toSlug(exerciseName)
  const entry = catalogBySlug.get(slug) ?? catalog.find(e => toSlug(e.name) === slug)
  if (!entry) return resolveCatalogEntryByHeuristics(exerciseName)
  return {
    name: entry.name,
    slug: entry.slug,
    gifUrl: entry.gifUrl?.trim() ? entry.gifUrl : DEFAULT_EXERCISE_MEDIA_URL,
    movementPattern: entry.movementPattern ?? null,
    equipment: entry.equipment ?? [],
    isCompound: entry.isCompound ?? false,
    primaryMuscle: entry.primaryMuscle ?? null,
    constraintProfile: entry.constraintProfile ?? null,
    plane: entry.plane ?? null,
    mechanic: entry.mechanic ?? null,
    unilateral: entry.unilateral ?? false,
    muscles: entry.muscles ?? [],
    secondaryMuscles: entry.secondaryMuscles ?? [],
    fiberTargets: entry.fiberTargets?.length ? entry.fiberTargets : deriveFiberTargets(entry),
  }
}

/** When coach label ≠ catalog name, map common FR aliases to a catalog anchor for scoring/media. */
function resolveCatalogEntryByHeuristics(exerciseName: string): CatalogExerciseLookup | null {
  const n = exerciseName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const tryNames = (names: string[]): CatalogExerciseLookup | null => {
    for (const name of names) {
      const slug = toSlug(name)
      const entry = catalogBySlug.get(slug) ?? catalog.find(e => toSlug(e.name) === slug)
      if (entry) {
        return {
          name: entry.name,
          slug: entry.slug,
          gifUrl: entry.gifUrl?.trim() ? entry.gifUrl : DEFAULT_EXERCISE_MEDIA_URL,
          movementPattern: entry.movementPattern ?? null,
          equipment: entry.equipment ?? [],
          isCompound: entry.isCompound ?? false,
          primaryMuscle: entry.primaryMuscle ?? null,
          constraintProfile: entry.constraintProfile ?? null,
          plane: entry.plane ?? null,
          mechanic: entry.mechanic ?? null,
          unilateral: entry.unilateral ?? false,
          muscles: entry.muscles ?? [],
          secondaryMuscles: entry.secondaryMuscles ?? [],
          fiberTargets: entry.fiberTargets?.length ? entry.fiberTargets : deriveFiberTargets(entry),
        }
      }
    }
    return null
  }

  if (/flexion.*laterale|laterale.*flexion|oblique.*banc|banc.*oblique|45.*oblique/.test(n)) {
    return tryNames([
      'Flexions des obliques banc lombaire 45',
      'Flexions latérales haltère',
      'Flexions latérales poulie basse',
    ])
  }

  if (/planche.*laterale|side.*plank/.test(n)) {
    return tryNames(['Planche latérale obliques'])
  }

  if (/guillotine/.test(n) && /developpe|développé/.test(exerciseName.toLowerCase())) {
    return tryNames(['Développé incliné barre'])
  }

  if (/pull?\s*over.*poulie|pullover.*poulie/.test(n)) {
    return tryNames(['Pull over poulie'])
  }

  if (/shrug.*poulie|haussement.*epaules.*poulie/.test(n)) {
    return tryNames(['Shrug poulie haussement épaules'])
  }

  if (/mollet.*assis.*smith|extension.*mollets.*assis.*smith/.test(n)) {
    return tryNames(['Extension mollets assis machine smith'])
  }

  if (/mollet.*smith|extension.*mollets.*smith/.test(n)) {
    return tryNames(['Extension mollets smith machine'])
  }

  if (/developpe.*couche.*haltere|developpe.*couche.*halteres|developpe.*couche.*alter/.test(n)) {
    return tryNames(['Développé couche haltères'])
  }

  // Rear delt fly (haltères) — "élévation latérale arrière", "oiseau", "ecarte arriere"
  if (/elevation.*lat.*arriere|elevation.*arriere.*lat|ecarte.*arriere|oiseau.*assis|oiseau.*banc|reverse.*fly|fly.*arriere/.test(n)) {
    return tryNames(['Oiseau assis sur banc', 'Écarté arriere élastique'])
  }

  // Rear delt fly poulie — "oiseau à la poulie", "élévation latérale inclinée poulie"
  if (/oiseau.*poulie|elevation.*lat.*poulie.*inclin|elevation.*inclin.*poulie/.test(n)) {
    return tryNames(['Oiseau à la poulie à 45'])
  }

  // Pec deck inversé / butterfly inversé
  if (/pec.*deck.*invers|butterfly.*invers|pecfly.*invers|invers.*pec|invers.*butterfly/.test(n)) {
    return tryNames(['Pec deck inversé'])
  }

  // Face pull variantes
  if (/face.*pull|poulie.*faciale|tirage.*visage/.test(n)) {
    return tryNames(['Face pull', 'Face pull couche à la poulie'])
  }

  return null
}

export function getBiomechData(exerciseName: string): BiomechData | null {
  const slug = toSlug(exerciseName)
  let entry = catalogBySlug.get(slug) ?? catalog.find(e => toSlug(e.name) === slug)

  if (!entry) {
    const heuristic = resolveCatalogEntryByHeuristics(exerciseName)
    if (heuristic) {
      entry = catalogBySlug.get(heuristic.slug) ?? catalog.find(e => toSlug(e.name) === heuristic.slug)
    }
  }

  if (!entry || entry.jointStressSpine == null) return null

  return {
    plane: entry.plane ?? null,
    mechanic: entry.mechanic ?? null,
    unilateral: entry.unilateral ?? false,
    primaryMuscle: entry.primaryMuscle ?? null,
    primaryActivation: entry.primaryActivation ?? null,
    secondaryMuscles: entry.secondaryMuscles ?? [],
    secondaryActivations: entry.secondaryActivations ?? [],
    stabilizers: entry.stabilizers ?? [],
    jointStressSpine: entry.jointStressSpine,
    jointStressKnee: entry.jointStressKnee ?? null,
    jointStressShoulder: entry.jointStressShoulder ?? null,
    globalInstability: entry.globalInstability ?? null,
    coordinationDemand: entry.coordinationDemand ?? null,
    constraintProfile: entry.constraintProfile ?? null,
  }
}

// ─── isCompound depuis les muscles primaires ─────────────────────────────────
// Fallback quand le coach n'a pas coché la checkbox.
// Règle : ≥2 groupes musculaires primaires distincts = composé.

export function isCompoundFromMuscles(primaryMuscles: string[]): boolean {
  return primaryMuscles.length >= 2
}

// ─── Stimulus coefficient ─────────────────────────────────────────────────────
// Même logique que scripts/generate-exercise-catalog.ts (source de vérité).
// Utilisée au runtime pour les exercices custom (pas dans le catalogue JSON).

const STRETCH_POSITION_SLUGS = new Set([
  'curl-incline-halteres', 'curl-incline', 'spider-curl', 'curl-concentre', 'drag-curl',
  'extension-triceps-derriere-tete', 'extension-triceps-overhead', 'skull-crusher', 'barre-front',
  'leg-curl-assis', 'leg-curl-assis-machine',
  'souleve-de-terre-roumain', 'souleve-de-terre-roumain-kettlebell',
  'souleve-de-terre-roumain-landmine', 'souleve-de-terre-jambes-tendues',
  'good-morning', 'good-morning-elastique',
  'squat-bulgare-halteres-exercice-musculation', 'fente-avant-barre-femme',
  'fentes-avant-exercice-musculation', 'fentes-avant-kettlebell',
  'pull-over', 'pull-over-barre', 'musculation-pull-over-assis-machine',
])

export function getStimulusCoeff(slug: string, movementPattern: string, isCompound: boolean): number {
  const s = slug.toLowerCase()
  const stretchBonus = STRETCH_POSITION_SLUGS.has(s) ? 0.08 : 0

  let base: number

  switch (movementPattern) {
    case 'squat_pattern': {
      if (isCompound) {
        const isMachine = s.includes('machine') || s.includes('presse-a-cuisse') ||
          s.includes('presse-a-cuisses') || s.includes('presse-cuisse') ||
          s.includes('leg-press') || s.includes('hack-squat-assis') ||
          s.includes('pendulum') || s.includes('belt-squat')
        base = isMachine ? 0.72 : 0.90
      } else {
        base = 0.45
      }
      break
    }
    case 'hip_hinge': {
      if (isCompound) {
        const isHeavy = s.includes('souleve-de-terre') || s.includes('deadlift') ||
          s.includes('rack-pull') || s.includes('reeves-deadlift') ||
          s.includes('zercher-deadlift') || s.includes('good-morning')
        base = isHeavy ? 0.95 : 0.82
      } else {
        base = 0.48
      }
      break
    }
    case 'horizontal_push': {
      if (isCompound) {
        const isMachine = s.includes('machine') || s.includes('smith')
        base = isMachine ? 0.68 : 0.82
      } else {
        base = 0.52
      }
      break
    }
    case 'vertical_push': {
      if (isCompound) {
        const isMachine = s.includes('machine') || s.includes('smith')
        base = isMachine ? 0.65 : 0.80
      } else {
        base = 0.60
      }
      break
    }
    case 'horizontal_pull': {
      if (isCompound) {
        const isHeavy = s.includes('barre') || s.includes('barbell') ||
          s.includes('seal-row') || s.includes('renegade-row')
        base = isHeavy ? 0.88 : 0.75
      } else {
        base = 0.40
      }
      break
    }
    case 'vertical_pull': {
      if (isCompound) {
        const isBodyweight = s.includes('traction') || s.includes('chin-up')
        base = isBodyweight ? 0.92 : 0.74
      } else {
        base = 0.40
      }
      break
    }
    case 'scapular_elevation': base = 0.30; break
    case 'elbow_flexion': base = 0.55; break
    case 'elbow_extension': {
      const isOverhead = s.includes('derriere-tete') || s.includes('overhead') ||
        s.includes('skull-crusher') || s.includes('barre-front')
      base = isOverhead ? 0.52 : 0.42
      break
    }
    case 'lateral_raise': base = 0.35; break
    case 'knee_flexion': base = isCompound ? 0.78 : 0.55; break
    case 'knee_extension': base = 0.45; break
    case 'calf_raise': {
      const isHeavy = s.includes('donkey') || s.includes('debout') || s.includes('standing')
      base = isHeavy ? 0.50 : 0.38
      break
    }
    case 'core_flex': base = 0.32; break
    case 'core_anti_flex': base = 0.30; break
    case 'core_rotation': base = 0.28; break
    case 'carry': base = 0.65; break
    case 'hip_abduction': base = 0.38; break
    case 'hip_adduction': base = 0.36; break
    case 'shoulder_rotation': base = 0.30; break
    case 'scapular_retraction': base = 0.35; break
    case 'scapular_protraction': base = 0.28; break
    case 'cardio': base = 0.00; break
    default: base = 0.50
  }

  return Math.min(1.0, Math.round((base + stretchBonus) * 100) / 100)
}

// ─── Resolve coeff pour un exercice du builder ────────────────────────────────
// Ordre de priorité :
// 1. primaryActivation passé directement ou trouvé dans le catalogue enrichi (plus précis)
// 2. Correspondance exacte par slug dans le catalogue JSON → stimulus_coefficient
// 3. is_compound explicite du coach → getStimulusCoeff(slug_normalisé, pattern, is_compound)
// 4. is_compound déduit depuis primary_muscles.length ≥ 2

interface ExerciseInput {
  name: string
  movement_pattern: string | null
  primary_muscles: string[]
  is_compound: boolean | undefined
  primaryActivation?: number | null
}

export function resolveExerciseCoeff(exercise: ExerciseInput): number {
  // Priority 1: primaryActivation from enriched catalog (most precise)
  if (exercise.primaryActivation != null && exercise.primaryActivation > 0) {
    return exercise.primaryActivation
  }

  // Priority 2: catalog lookup by slug — use stimulus_coefficient (composite score)
  // primaryActivation in catalog is EMG activation ratio (different scale), not used here
  const slug = toSlug(exercise.name)
  const entry = catalogBySlug.get(slug)
  if (entry) {
    return entry.stimulus_coefficient
  }

  // Priority 3: fallback to name match (legacy normalisation)
  const nameNorm = exercise.name.toLowerCase().trim()
  const catalogEntry = catalog.find(e => e.name.toLowerCase().trim() === nameNorm)
  if (catalogEntry) return catalogEntry.stimulus_coefficient

  // Priority 4: derive from is_compound + movement_pattern
  const isComp = exercise.is_compound !== undefined
    ? exercise.is_compound
    : isCompoundFromMuscles(exercise.primary_muscles)

  const pattern = exercise.movement_pattern ?? 'unknown'
  return getStimulusCoeff(slug, pattern, isComp)
}

// ─── Back muscle sub-groups by movement pattern ────────────────────────────────
// The catalog stores 'dos' monolithically. At scoring time, expandMusclesForScoring
// maps 'dos' to richer sub-groups based on movementPattern to improve alternative
// discrimination (e.g. traction vs row vs shrug vs hip-hinge all use 'dos' in catalog).
const DOS_SUBGROUPS_BY_PATTERN: Record<string, string[]> = {
  vertical_pull:      ['grand_dorsal', 'dos_large'],
  horizontal_pull:    ['trapeze_moyen', 'rhomboides', 'dos_large'],
  scapular_elevation: ['trapeze_superieur', 'dos_large'],
  hip_hinge:          ['lombaires', 'erecteurs_spinaux', 'dos_large'],
  core_anti_flex:     ['lombaires', 'erecteurs_spinaux', 'dos_large'],
  carry:              ['trapeze_superieur', 'dos_large'],
}

/**
 * Expands muscle slugs for scoring purposes.
 * When 'dos' is present, replaces it with functional sub-groups derived from movementPattern.
 * Optionally merges precise secondary muscles from the enriched catalog.
 * Other muscles are kept as-is (after normalization).
 */
export function expandMusclesForScoring(
  muscles: string[],
  movementPattern: string | null,
  secondaryMusclesDetail?: string[],
): string[] {
  // Merge precise secondary muscles from enriched catalog
  const baseMap: Record<string, true> = {}
  muscles.map(normalizeMuscleSlug).forEach(m => { baseMap[m] = true })
  if (secondaryMusclesDetail && secondaryMusclesDetail.length > 0) {
    secondaryMusclesDetail.forEach(m => { baseMap[m.toLowerCase()] = true })
  }
  const mergedMuscles = Object.keys(baseMap)

  // Apply existing dos sub-group expansion
  const result: string[] = []
  for (const m of mergedMuscles) {
    const norm = normalizeMuscleSlug(m)
    if (norm === 'dos') {
      const subgroups = DOS_SUBGROUPS_BY_PATTERN[movementPattern ?? ''] ?? ['dos_large']
      result.push(...subgroups)
    } else {
      result.push(norm)
    }
  }
  return result
}

// Maps FR muscle slugs to body_part vocabulary used in restrictions
export const MUSCLE_TO_BODY_PART: Record<string, string[]> = {
  'deltoide_anterieur':  ['shoulder_right', 'shoulder_left'],
  'deltoide_lateral':    ['shoulder_right', 'shoulder_left'],
  'deltoide_posterieur': ['shoulder_right', 'shoulder_left'],
  'coiffe_rotateurs':    ['shoulder_right', 'shoulder_left'],
  'epaules':             ['shoulder_right', 'shoulder_left'],
  'biceps':              ['elbow_right', 'elbow_left'],
  'triceps':             ['elbow_right', 'elbow_left'],
  'avant_bras':          ['elbow_right', 'elbow_left', 'wrist_right', 'wrist_left'],
  'quadriceps':          ['knee_right', 'knee_left'],
  'ischio-jambiers':     ['knee_right', 'knee_left', 'hip_right', 'hip_left'],
  'fessiers':            ['hip_right', 'hip_left'],
  'lombaires':           ['lower_back'],
  'erecteurs_spinaux':   ['lower_back', 'upper_back'],
  'dos':                 ['upper_back', 'lower_back'],
  'trapeze':             ['upper_back', 'neck'],
  'rhomboides':          ['upper_back'],
  'grand_dorsal':        ['upper_back'],
  'pectoraux':           [],
  'abdos':               [],
  'mollets':             ['ankle_right', 'ankle_left'],
  'cardio':              [],
}

const SEVERITY_ORDER: Record<string, number> = { avoid: 3, limit: 2, monitor: 1 }

export function muscleConflictsWithRestriction(
  muscleSlug: string,
  restrictions: InjuryRestriction[],
): { conflicts: true; severity: 'avoid' | 'limit' | 'monitor' } | null {
  if (restrictions.length === 0) return null

  const bodyParts = MUSCLE_TO_BODY_PART[normalizeMuscleSlug(muscleSlug)] ?? []
  if (bodyParts.length === 0) return null

  let highestSeverity: 'avoid' | 'limit' | 'monitor' | null = null

  for (const restriction of restrictions) {
    if (bodyParts.includes(restriction.bodyPart)) {
      if (
        highestSeverity === null ||
        SEVERITY_ORDER[restriction.severity] > SEVERITY_ORDER[highestSeverity]
      ) {
        highestSeverity = restriction.severity
      }
    }
  }

  return highestSeverity ? { conflicts: true, severity: highestSeverity } : null
}
