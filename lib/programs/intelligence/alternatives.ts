import catalogData from '@/data/exercise-catalog.json'
import {
  normalizeMuscleSlug,
  getStimulusCoeff,
  expandMusclesForScoring,
  getCatalogEntryByName,
} from './catalog-utils'
import type { BuilderExercise } from './types'

interface CatalogEntry {
  id: string
  name: string
  slug: string
  gifUrl: string
  muscleGroup: string
  exerciseType: string
  pattern: string[]
  movementPattern: string
  equipment: string[]
  isCompound: boolean
  muscles: string[]
  stimulus_coefficient: number
  plane?: string | null
  mechanic?: string | null
  unilateral?: boolean
  primaryMuscle?: string | null
  primaryActivation?: number | null
  secondaryMuscles?: string[]
  secondaryActivations?: number[]
  stabilizers?: string[]
  constraintProfile?: string | null
}

const catalog = (catalogData as CatalogEntry[]).filter(e => e.exerciseType === 'exercise')

export interface AlternativeScore {
  entry: CatalogEntry
  score: number
  label: string // 'Remplace mécaniquement' | 'Angle complémentaire' | 'Alternative équipement'
}

interface AlternativesContext {
  equipmentArchetype: string
  goal: string
  level: string
  sessionExercises: BuilderExercise[]
}

// Équipements disponibles par archétype
const ARCHETYPE_EQUIPMENT: Record<string, string[]> = {
  bodyweight:      ['bodyweight', 'band'],
  home_dumbbells:  ['bodyweight', 'dumbbell', 'band', 'kettlebell'],
  home_full:       ['bodyweight', 'dumbbell', 'barbell', 'band', 'kettlebell', 'ez_bar'],
  home_rack:       ['bodyweight', 'dumbbell', 'barbell', 'band', 'kettlebell', 'ez_bar', 'smith'],
  functional_box:  ['bodyweight', 'dumbbell', 'kettlebell', 'band', 'cable', 'trx', 'medicine_ball', 'sled'],
  commercial_gym:  ['bodyweight', 'dumbbell', 'barbell', 'kettlebell', 'band', 'cable', 'machine', 'smith', 'ez_bar', 'trap_bar', 'landmine', 'trx', 'rings', 'sled'],
}

/** Maps constraint profiles to a functional pattern when catalog movementPattern is too generic. */
const CONSTRAINT_PATTERN: Record<string, string> = {
  side_flexion: 'core_lateral_flexion',
  loaded_side_bend: 'core_lateral_flexion',
  cable_tension: 'core_lateral_flexion',
  short_range: 'core_lateral_flexion',
  side_stability: 'core_lateral_flexion',
  rotational_load: 'core_rotation',
  cable_rotation: 'core_rotation',
  cable_control: 'core_rotation',
  loaded_rotation: 'core_rotation',
  dynamic_rotation: 'core_rotation',
  anti_rotation: 'core_anti_rotation',
  anti_rotation_control: 'core_anti_rotation',
  spine_flexion_control: 'core_flexion',
  controlled_flexion: 'core_flexion',
  hip_flexor_bias: 'core_flexion',
  lumbar_control: 'core_anti_extension',
  lumbar_stability: 'core_anti_extension',
  lumbar_load: 'core_anti_extension',
  extended_range: 'core_anti_extension',
  isometric_hold: 'core_anti_extension',
  posterior_chain_engagement: 'core_anti_extension',
}

const GENERIC_CORE_PATTERNS = new Set(['core_anti_flex', 'core', ''])

/** Broad muscle families — used to penalize glute/oblique/abs mismatches. */
const PRIMARY_MUSCLE_FAMILY: Record<string, string> = {
  obliques: 'obliques',
  rectus_abdominis: 'abs',
  lower_abs: 'abs',
  transverse_abdominis: 'core_stability',
  gluteus_maximus: 'glutes',
  glutes: 'glutes',
  hamstrings: 'posterior_chain',
  quadriceps: 'quads',
  lats: 'back',
  grand_dorsal: 'back',
  biceps_brachii: 'arms',
  triceps: 'arms',
}

function primaryMuscleFamily(slug: string | null | undefined): string | null {
  if (!slug) return null
  return PRIMARY_MUSCLE_FAMILY[slug] ?? slug
}

function resolveScoringPattern(
  movementPattern: string | null | undefined,
  constraintProfile: string | null | undefined,
  primaryMuscle: string | null | undefined,
  plane: string | null | undefined,
): string {
  if (constraintProfile && CONSTRAINT_PATTERN[constraintProfile]) {
    return CONSTRAINT_PATTERN[constraintProfile]
  }

  const mp = movementPattern ?? ''
  if (!GENERIC_CORE_PATTERNS.has(mp)) return mp || 'unknown'

  if (primaryMuscle === 'obliques' && plane === 'frontal') return 'core_lateral_flexion'
  if (primaryMuscle === 'obliques' && plane === 'transverse') return 'core_rotation'
  if (primaryMuscle === 'rectus_abdominis' || primaryMuscle === 'lower_abs') return 'core_flexion'
  if (primaryMuscle === 'transverse_abdominis') return 'core_anti_extension'

  return mp || 'unknown'
}

function catalogMusclesForScoring(entry: CatalogEntry): string[] {
  const muscles: string[] = []
  if (entry.primaryMuscle) muscles.push(entry.primaryMuscle)
  if (entry.secondaryMuscles?.length) muscles.push(...entry.secondaryMuscles)
  if (muscles.length === 0 && entry.muscles?.length) muscles.push(...entry.muscles)
  return muscles
}

function enrichOriginalFromCatalog(original: BuilderExercise): {
  pattern: string
  musclesExpanded: Set<string>
  primaryMuscle: string | null
  constraintProfile: string | null
  coeff: number
} {
  const catalogEntry = getCatalogEntryByName(original.name)
  const primaryMuscle =
    original.primaryMuscle ??
    catalogEntry?.primaryMuscle ??
    (original.primary_muscles[0] ?? null)

  const constraintProfile =
    original.constraintProfile ?? catalogEntry?.constraintProfile ?? null

  const pattern = resolveScoringPattern(
    original.movement_pattern ?? catalogEntry?.movementPattern,
    constraintProfile,
    primaryMuscle,
    catalogEntry?.plane,
  )

  const baseMuscles =
    original.primary_muscles.length > 0
      ? original.primary_muscles
      : catalogEntry
        ? [
            ...(catalogEntry.primaryMuscle ? [catalogEntry.primaryMuscle] : []),
            ...catalogEntry.secondaryMuscles,
            ...(catalogEntry.muscles.length ? catalogEntry.muscles : []),
          ]
        : []

  const musclesExpanded = new Set(
    expandMusclesForScoring(
      baseMuscles,
      pattern,
      catalogEntry?.secondaryMuscles,
    ),
  )

  const coeff = getStimulusCoeff(
    original.name.toLowerCase().replace(/\s+/g, '-'),
    pattern,
    original.is_compound ?? original.primary_muscles.length >= 2,
  )

  return { pattern, musclesExpanded, primaryMuscle, constraintProfile, coeff }
}

export function scoreAlternatives(
  original: BuilderExercise,
  context: AlternativesContext,
): AlternativeScore[] {
  const availableEquipment = ARCHETYPE_EQUIPMENT[context.equipmentArchetype] ?? ARCHETYPE_EQUIPMENT.commercial_gym

  const {
    pattern: originalPattern,
    musclesExpanded: originalMusclesExpanded,
    primaryMuscle: originalPrimaryMuscle,
    constraintProfile: originalConstraint,
    coeff: originalCoeff,
  } = enrichOriginalFromCatalog(original)

  const originalFamily = primaryMuscleFamily(originalPrimaryMuscle)

  const sessionPatterns = context.sessionExercises
    .filter(e => e !== original)
    .map(e => {
      const cat = getCatalogEntryByName(e.name)
      return resolveScoringPattern(
        e.movement_pattern ?? cat?.movementPattern,
        e.constraintProfile ?? cat?.constraintProfile,
        e.primaryMuscle ?? cat?.primaryMuscle ?? e.primary_muscles[0],
        cat?.plane,
      )
    })

  const scored: AlternativeScore[] = []

  for (const candidate of catalog) {
    if (candidate.name.toLowerCase() === original.name.toLowerCase()) continue

    const hasEquipment = candidate.equipment.some(eq => availableEquipment.includes(eq))
    if (!hasEquipment) continue

    const candidatePattern = resolveScoringPattern(
      candidate.movementPattern,
      candidate.constraintProfile,
      candidate.primaryMuscle,
      candidate.plane,
    )

    const candidateMusclesExpanded = new Set(
      expandMusclesForScoring(
        catalogMusclesForScoring(candidate),
        candidatePattern,
        candidate.secondaryMuscles,
      ),
    )

    const overlap = Array.from(originalMusclesExpanded).filter(m => candidateMusclesExpanded.has(m))
    const hasOnlyDosLarge = overlap.length > 0 && overlap.every(m => m === 'dos_large')

    let score = 0

    // Functional pattern match
    if (candidatePattern === originalPattern && originalPattern !== 'unknown') score += 35

    // Primary muscle target (catalog primaryMuscle — most reliable for core)
    if (
      originalPrimaryMuscle &&
      candidate.primaryMuscle &&
      originalPrimaryMuscle === candidate.primaryMuscle
    ) {
      score += 40
    }

    // Muscle overlap (sub-groups + secondaries)
    if (overlap.length > 0) {
      score += hasOnlyDosLarge ? 8 : Math.min(25, overlap.length * 12)
    }

    // Constraint profile (side flexion vs anti-rotation etc.)
    if (
      originalConstraint &&
      candidate.constraintProfile &&
      originalConstraint === candidate.constraintProfile
    ) {
      score += 25
    }

    // Plane + mechanic similarity
    const origCat = getCatalogEntryByName(original.name)
    if (
      origCat?.plane &&
      candidate.plane &&
      origCat.plane === candidate.plane &&
      origCat.mechanic &&
      candidate.mechanic &&
      origCat.mechanic === candidate.mechanic
    ) {
      score += 12
    }

    const sameEquip = original.equipment_required.some(eq => candidate.equipment.includes(eq))
    if (sameEquip) score += 12

    if (!sessionPatterns.includes(candidatePattern)) score += 8

    if (candidate.stimulus_coefficient < originalCoeff - 0.15) score -= 12

    // Penalize wrong primary muscle family (e.g. obliques → glutes)
    const candidateFamily = primaryMuscleFamily(candidate.primaryMuscle)
    if (
      originalFamily &&
      candidateFamily &&
      originalFamily !== candidateFamily &&
      overlap.length === 0
    ) {
      score -= 35
    }

    const origActivation = original.primaryActivation
    const candActivation = candidate.primaryActivation
    if (origActivation != null && candActivation != null) {
      const delta = Math.abs(origActivation - candActivation)
      if (delta > 0.25) score -= Math.round(delta * 50)
    }

    if (score < 20) continue

    let label = 'Alternative'
    const hasRealOverlap = overlap.length > 0 && !hasOnlyDosLarge
    if (candidatePattern === originalPattern && hasRealOverlap) label = 'Remplace mécaniquement'
    else if (candidatePattern !== originalPattern && hasRealOverlap) label = 'Angle complémentaire'
    else if (!sameEquip && hasEquipment) label = 'Alternative équipement'

    scored.push({ entry: candidate, score, label })
  }

  const sorted = scored.sort((a, b) => b.score - a.score)
  const seenPrefixes = new Set<string>()
  const deduped: AlternativeScore[] = []
  for (const alt of sorted) {
    const prefix = alt.entry.name.toLowerCase().split(/\s+/).slice(0, 3).join(' ')
    if (!seenPrefixes.has(prefix)) {
      seenPrefixes.add(prefix)
      deduped.push(alt)
    }
    if (deduped.length >= 6) break
  }
  return deduped
}
