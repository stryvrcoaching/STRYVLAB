/**
 * STRYVR — Template Matching Engine v2
 *
 * Algorithme en 3 phases :
 *   Phase 1 — Filtre Univers (hard stop équipement)
 *   Phase 2 — Scoring strict (fréquence exacte, niveau ±1 max, objectif, tags)
 *   Phase 3 — Substitution zéro tolérance (movement_pattern × équipement client)
 *
 * Aucune logique UI ici — fonctions pures, testables unitairement.
 */

import exerciseCatalog from '@/data/exercise-catalog.json'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EquipmentCategory =
  | 'bodyweight'
  | 'home_dumbbells'
  | 'home_full'
  | 'commercial_gym'
  | 'functional_box'
  | 'home_rack'

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite'
export type TrainingGoal =
  | 'hypertrophy' | 'strength' | 'fat_loss' | 'endurance'
  | 'recomp' | 'maintenance' | 'athletic'

export interface ClientProfile {
  equipment_category: EquipmentCategory | null
  fitness_level: FitnessLevel | null
  training_goal: TrainingGoal | null
  weekly_frequency: number | null   // 1–7
  sport_practice?: string | null
}

export interface TemplateExercise {
  id: string
  name: string
  position: number
  movement_pattern: string | null   // sous-pattern biomécanique
  equipment_required: string[]      // équipement requis pour CET exercice
}

export interface TemplateSession {
  id: string
  position: number
  exercises: TemplateExercise[]
}

export interface Template {
  id: string
  name: string
  goal: TrainingGoal
  level: FitnessLevel
  frequency: number
  weeks: number
  muscle_tags: string[]
  equipment_archetype: EquipmentCategory | null
  coach_program_template_sessions: TemplateSession[]
}

export interface MatchResult {
  templateId: string
  score: number               // 0–100, 0 = hard stop
  hardStop: boolean           // true si éliminé en Phase 1 ou 2
  hardStopReason?: string     // raison lisible du hard stop
  warning?: string            // avertissement non bloquant (ex: fréquence ±1)
  breakdown: {
    goal: number              // 0 ou 45
    level: number             // 30 | 15 | 5 | 0
    frequency: number         // 20 (exact) | 8 (±1)
    muscleTags: number        // 0–5
    bonus: number             // sport_practice + weeks
  }
  substitutions: SubstitutionResult[]  // exercices substitués (Phase 3)
  substituable: boolean       // false = hard stop Phase 3
}

export interface SubstitutionResult {
  originalExercise: string
  originalPattern: string
  substitute: { name: string; gifUrl: string; movementPattern: string } | null
  isMainLift: boolean         // position 0 ou 1 dans la séance = polyarticulaire principal
}

// ─── Phase 1 — Filtre Univers ─────────────────────────────────────────────────

/**
 * Table de déverrouillage :
 * equipment_category client → archétypes de templates accessibles
 *
 * Règle : un client ne peut accéder qu'aux templates dont l'archétype
 * est COUVERT par sa catégorie d'équipement.
 */
const EQUIPMENT_UNLOCK: Record<EquipmentCategory, EquipmentCategory[]> = {
  bodyweight:       ['bodyweight'],
  home_dumbbells:   ['bodyweight', 'home_dumbbells'],
  home_full:        ['bodyweight', 'home_dumbbells', 'home_full'],
  home_rack:        ['bodyweight', 'home_dumbbells', 'home_full', 'home_rack'],
  functional_box:   ['bodyweight', 'functional_box'],
  commercial_gym:   ['bodyweight', 'home_dumbbells', 'home_full', 'home_rack', 'functional_box', 'commercial_gym'],
}

/**
 * Équipement physique disponible par catégorie.
 * Utilisé pour la Phase 3 (substitution par exercice du catalogue).
 */
export const EQUIPMENT_BY_CATEGORY: Record<EquipmentCategory, string[]> = {
  bodyweight:     ['bodyweight', 'band'],
  home_dumbbells: ['bodyweight', 'band', 'dumbbell'],
  home_full:      ['bodyweight', 'band', 'dumbbell', 'barbell', 'kettlebell'],
  home_rack:      ['bodyweight', 'band', 'dumbbell', 'barbell', 'kettlebell', 'cable', 'ez_bar'],
  functional_box: ['bodyweight', 'band', 'barbell', 'kettlebell', 'trx', 'rings', 'sled', 'landmine'],
  commercial_gym: ['bodyweight', 'band', 'dumbbell', 'barbell', 'kettlebell', 'machine', 'cable',
                   'smith', 'trx', 'ez_bar', 'trap_bar', 'landmine', 'medicine_ball', 'swiss_ball', 'rings'],
}

export function phase1EquipmentFilter(
  template: Template,
  client: ClientProfile
): { pass: boolean; reason?: string; warning?: string } {
  if (!client.equipment_category) {
    // Soft warning: not a hard stop, but user should review
    return { pass: true, warning: 'Catégorie d\'équipement client non renseignée — vérifiez la compatibilité' }
  }
  if (!template.equipment_archetype) {
    // Template sans archétype déclaré → accessible à tous (legacy)
    return { pass: true }
  }
  const unlocked = EQUIPMENT_UNLOCK[client.equipment_category]
  if (!unlocked.includes(template.equipment_archetype)) {
    return {
      pass: false,
      reason: `Template requiert "${template.equipment_archetype}" — client a "${client.equipment_category}"`,
    }
  }
  return { pass: true }
}

// ─── Phase 2 — Scoring strict ─────────────────────────────────────────────────

const LEVEL_ORDER: Record<FitnessLevel, number> = {
  beginner: 0, intermediate: 1, advanced: 2, elite: 3,
}

export function phase2Score(
  template: Template,
  client: ClientProfile
): { pass: boolean; warnings?: string[]; breakdown: MatchResult['breakdown'] } {
  const breakdown: MatchResult['breakdown'] = {
    goal: 0, level: 0, frequency: 0, muscleTags: 0, bonus: 0,
  }
  const warnings: string[] = []

  // ── Fréquence — soft warning si écart > 1 (pas de hard stop) ──
  if (client.weekly_frequency != null) {
    const freqDiff = Math.abs(template.frequency - client.weekly_frequency)
    if (freqDiff > 1) {
      warnings.push(`Fréquence écart ${freqDiff}j : client=${client.weekly_frequency}j, template=${template.frequency}j`)
      breakdown.frequency = 0  // Pas de points si incompatible
    } else {
      breakdown.frequency = freqDiff === 0 ? 20 : 8  // 20 si exact, 8 si ±1
    }
  }

  // ── Niveau — soft warning si écart > 1 (pas de hard stop) ──
  if (client.fitness_level && template.level) {
    const cr = LEVEL_ORDER[client.fitness_level]
    const tr = LEVEL_ORDER[template.level]
    const diff = Math.abs(cr - tr)
    if (diff > 1) {
      warnings.push(`Niveau écart : client=${client.fitness_level}, template=${template.level}`)
      breakdown.level = 0  // Pas de points si incompatible
    } else {
      breakdown.level = diff === 0 ? 30 : 15
    }
  }

  // ── Objectif — 45 pts si exact ──
  if (client.training_goal && client.training_goal === template.goal) {
    breakdown.goal = 45
  }

  // ── Muscle tags — jusqu'à 5 pts ──
  // (bonus léger — pas éliminatoire)
  breakdown.muscleTags = Math.min(5, template.muscle_tags.length > 0 ? 3 : 0)

  // ── Bonus sport_practice + durée ──
  if (client.sport_practice) {
    const isActive = client.sport_practice === 'active' || client.sport_practice === 'athlete'
    const isSedentary = client.sport_practice === 'sedentary' || client.sport_practice === 'light'
    if (isActive && template.weeks >= 8) breakdown.bonus = 5
    else if (isSedentary && template.weeks <= 6) breakdown.bonus = 5
    else breakdown.bonus = 2
  }

  return { pass: true, warnings: warnings.length > 0 ? warnings : undefined, breakdown }
}

// ─── Phase 3 — Substitution zéro tolérance ────────────────────────────────────

interface CatalogEntry {
  name: string
  gifUrl: string
  movementPattern: string
  equipment: string[]
  exerciseType: string
  isCompound: boolean
}

const catalog = exerciseCatalog as unknown as CatalogEntry[]

/**
 * Trouve le meilleur substitut dans la bibliothèque pour un pattern donné
 * avec l'équipement disponible.
 *
 * Priorité : même movementPattern + équipement disponible + isCompound si exercice principal
 */
export function findSubstitute(
  movementPattern: string,
  availableEquipment: string[],
  preferCompound: boolean
): CatalogEntry | null {
  const candidates = catalog.filter(e =>
    e.exerciseType === 'exercise' &&
    e.movementPattern === movementPattern &&
    e.equipment.some(eq => availableEquipment.includes(eq))
  )
  if (candidates.length === 0) return null

  // Si on préfère un compound, trier en conséquence
  const sorted = [...candidates].sort((a, b) => {
    if (preferCompound) {
      if (a.isCompound && !b.isCompound) return -1
      if (!a.isCompound && b.isCompound) return 1
    }
    return 0
  })
  return sorted[0]
}

/**
 * Phase 3 — Analyse tous les exercices du template.
 *
 * Règle d'élimination stricte :
 * Si un exercice principal (position 0 ou 1 dans la séance = polyarticulaire)
 * n'a AUCUN substitut pour le mouvement_pattern + équipement client → hard stop.
 *
 * Les exercices secondaires (position ≥ 2) peuvent être substitués sans hard stop.
 */
export function phase3Substitution(
  template: Template,
  client: ClientProfile
): { pass: boolean; reason?: string; substitutions: SubstitutionResult[] } {
  if (!client.equipment_category) {
    return { pass: true, substitutions: [] }
  }

  const availableEquipment = EQUIPMENT_BY_CATEGORY[client.equipment_category]
  const substitutions: SubstitutionResult[] = []

  for (const session of template.coach_program_template_sessions) {
    const exercises = (session as any).coach_program_template_exercises ?? session.exercises ?? []
    for (const exercise of exercises) {
      if (!exercise.movement_pattern || !exercise.equipment_required?.length) continue

      // Vérifie si l'exercice est réalisable avec l'équipement client
      const isDoable = (exercise.equipment_required as string[]).some((eq: string) => availableEquipment.includes(eq))
      if (isDoable) continue

      // Exercice non réalisable — cherche un substitut
      const isMainLift = exercise.position <= 1
      const sub = findSubstitute(exercise.movement_pattern, availableEquipment, isMainLift)

      substitutions.push({
        originalExercise: exercise.name,
        originalPattern: exercise.movement_pattern,
        substitute: sub ? { name: sub.name, gifUrl: sub.gifUrl, movementPattern: sub.movementPattern } : null,
        isMainLift,
      })

      // Hard stop : exercice principal sans substitut
      if (isMainLift && !sub) {
        return {
          pass: false,
          reason: `Aucun substitut pour "${exercise.name}" (${exercise.movement_pattern}) avec l'équipement disponible`,
          substitutions,
        }
      }
    }
  }

  return { pass: true, substitutions }
}

// ─── Orchestrateur ────────────────────────────────────────────────────────────

export function matchTemplate(template: Template, client: ClientProfile): MatchResult {
  const emptyBreakdown: MatchResult['breakdown'] = {
    goal: 0, level: 0, frequency: 0, muscleTags: 0, bonus: 0,
  }

  // Phase 1 — Filtre univers (équipement)
  const p1 = phase1EquipmentFilter(template, client)
  if (!p1.pass) {
    return {
      templateId: template.id,
      score: 0,
      hardStop: true,
      hardStopReason: p1.reason,
      breakdown: emptyBreakdown,
      substitutions: [],
      substituable: false,
    }
  }

  // Phase 2 — Scoring strict (toujours pass, peut avoir warnings)
  const p2 = phase2Score(template, client)

  // Phase 3 — Substitution
  const p3 = phase3Substitution(template, client)
  if (!p3.pass) {
    return {
      templateId: template.id,
      score: 0,
      hardStop: true,
      hardStopReason: p3.reason,
      breakdown: p2.breakdown,
      substitutions: p3.substitutions,
      substituable: false,
    }
  }

  const { breakdown } = p2

  // Collect warnings from all phases
  const warnings: string[] = []
  if (p1.warning) warnings.push(p1.warning)
  if (p2.warnings) warnings.push(...p2.warnings)

  const score = breakdown.goal + breakdown.level + breakdown.frequency +
                breakdown.muscleTags + breakdown.bonus

  return {
    templateId: template.id,
    score,
    hardStop: false,
    warning: warnings.length > 0 ? warnings.join(' · ') : undefined,
    breakdown,
    substitutions: p3.substitutions,
    substituable: true,
  }
}

/**
 * Classe une liste de templates pour un client donné.
 * Retourne seulement les templates passant les 3 phases, triés par score décroissant.
 * Les templates éliminés ont score=0 et hardStop=true.
 */
export function rankTemplates(
  templates: Template[],
  client: ClientProfile
): MatchResult[] {
  return templates
    .map(t => matchTemplate(t, client))
    .sort((a, b) => {
      // Hard stops toujours en dernier
      if (a.hardStop && !b.hardStop) return 1
      if (!a.hardStop && b.hardStop) return -1
      return b.score - a.score
    })
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

export function scoreLabel(score: number, hardStop: boolean): string {
  if (hardStop) return 'Incompatible'
  if (score >= 85) return 'Excellent'
  if (score >= 65) return 'Bon match'
  if (score >= 45) return 'Partiel'
  return 'Faible'
}

export function scoreBadgeClass(score: number, hardStop: boolean): string {
  if (hardStop) return 'bg-red-100 text-red-600'
  if (score >= 85) return 'bg-green-100 text-green-700'
  if (score >= 65) return 'bg-emerald-100 text-emerald-700'
  if (score >= 45) return 'bg-amber-100 text-amber-700'
  return 'bg-surface-light text-secondary'
}

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  bodyweight:     'Poids du corps',
  home_dumbbells: 'Domicile — Haltères',
  home_full:      'Domicile — Complet',
  home_rack:      'Rack à domicile',
  functional_box: 'Box / Fonctionnel',
  commercial_gym: 'Salle de sport',
}

/**
 * Infer equipment_category from individual equipment items.
 * Maps sets of equipment to the best-fitting category.
 *
 * Rules (by priority):
 * 1. Commercial gym equipment (machines, smith, trap bar) → 'commercial_gym'
 * 2. Full home setup (barbell + dumbbells + kettlebell + cable/machine) → 'home_rack' or 'home_full'
 * 3. Dumbbell + barbell only → 'home_full'
 * 4. Dumbbells only → 'home_dumbbells'
 * 5. Functional/box equipment (rings, TRX, landmine) → 'functional_box'
 * 6. Bodyweight only → 'bodyweight'
 * 7. Default if ambiguous → null (user should configure explicitly)
 */
export function inferEquipmentCategory(equipment: string[]): EquipmentCategory | null {
  if (!equipment || equipment.length === 0) return null

  const has = (keys: string[]) => keys.some(k => equipment.includes(k))
  const all = (keys: string[]) => keys.every(k => equipment.includes(k))

  // Commercial gym setup
  if (has(['machine', 'smith', 'trap_bar'])) return 'commercial_gym'

  // Full home rack setup
  if (has(['barbell', 'cable']) || (has(['barbell', 'dumbbell', 'kettlebell']) && equipment.length >= 3)) {
    return 'home_rack'
  }

  // Home full (barbell + dumbbells)
  if (all(['barbell', 'dumbbell'])) return 'home_full'

  // Dumbbells with kettlebell or bands
  if (has(['dumbbell']) && (has(['kettlebell']) || has(['band']))) return 'home_full'

  // Dumbbells only
  if (all(['dumbbell'])) return 'home_dumbbells'

  // Functional/box equipment
  if (has(['rings', 'trx', 'landmine', 'sled'])) return 'functional_box'

  // Bodyweight + bands OK as bodyweight
  if (all(['bodyweight', 'band']) || all(['bodyweight'])) return 'bodyweight'

  // Ambiguous
  return null
}
