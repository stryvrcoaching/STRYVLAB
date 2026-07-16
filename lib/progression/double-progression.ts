/**
 * Double Progression + Auto-régulation RIR
 *
 * Logique pure — aucune dépendance Supabase/DB.
 * Testable isolément.
 *
 * Règle fondamentale :
 *   - Plage cible : rep_min → rep_max (ex: 8–12)
 *   - RIR cible   : target_rir (ex: 2 = "2 reps en réserve")
 *   - Trigger overload : TOUTES les séries atteignent rep_max ET rir_actual <= target_rir
 *   - Sinon maintien  : même charge, chercher plus de reps la prochaine fois
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SetResult {
  set_number: number
  actual_reps: number
  rir_actual: number | null  // null = non renseigné par le client
  completed: boolean
  set_type?: 'warmup' | 'working' | 'cooldown' | 'dropset' | string | null
  target_rir?: number | null
  rep_max?: number | null
}

export interface ExerciseProgressionInput {
  exercise_id: string
  exercise_name: string

  // Prescription
  rep_min: number
  rep_max: number
  target_rir: number          // RIR demandé par le coach
  sets_prescribed: number     // nombre de séries prescrites

  // Charge actuelle (null = semaine 1, pas de référence)
  current_weight_kg: number | null

  // Incrément configuré par le coach
  weight_increment_kg: number  // défaut 2.5kg

  // Résultats du client cette séance
  sets: SetResult[]
}

export type ProgressionTrigger = 'overload' | 'maintain' | 'insufficient_data'

export interface ExerciseProgressionResult {
  exercise_id: string
  exercise_name: string
  trigger: ProgressionTrigger

  // Charge
  previous_weight_kg: number | null
  new_weight_kg: number | null     // null si maintain ou insufficient_data
  increment_applied: number | null

  // Métriques de la séance
  sets_evaluated: number
  reps_per_set: number[]
  rir_values: (number | null)[]
  all_sets_at_rep_max: boolean
  all_sets_rir_compliant: boolean

  // Message lisible pour l'UI client
  feedback_message: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Vérifie si toutes les séries complétées atteignent rep_max.
 */
function isProgressionEligibleSet(set: SetResult): boolean {
  return set.set_type == null || set.set_type === 'working'
}

function allSetsAtRepMax(sets: SetResult[], rep_max: number): boolean {
  const completed = sets.filter(s => s.completed)
  if (completed.length === 0) return false
  return completed.every(s => s.actual_reps >= (s.rep_max ?? rep_max))
}

/**
 * Vérifie si toutes les séries respectent le RIR cible.
 * RIR null (non renseigné) = ignoré (ni conforme ni bloquant) — ne pénalise pas
 * la progression si le client a oublié de saisir. Au moins 1 RIR saisi requis.
 * rir_actual <= target_rir = conforme (effort suffisant).
 */
function allSetsRirCompliant(sets: SetResult[], target_rir: number): boolean {
  const completed = sets.filter(s => s.completed)
  if (completed.length === 0) return false
  const withRir = completed.filter(s => s.rir_actual !== null)
  // Si aucun RIR saisi → non-conforme (on ne peut pas évaluer)
  if (withRir.length === 0) return false
  // Tous les RIR saisis doivent être conformes
  return withRir.every(s => (s.rir_actual as number) <= (s.target_rir ?? target_rir))
}

/**
 * Construit le message feedback pour le client.
 */
function buildFeedbackMessage(
  trigger: ProgressionTrigger,
  input: ExerciseProgressionInput,
  new_weight_kg: number | null
): string {
  if (trigger === 'overload') {
    const prev = input.current_weight_kg ?? 0
    const next = new_weight_kg ?? prev
    return `Objectif atteint sur ${input.exercise_name} — charge augmentée à ${next}kg la prochaine fois.`
  }

  if (trigger === 'maintain') {
    const completedSets = input.sets.filter(s => s.completed)
    const avgReps = completedSets.length > 0
      ? Math.round(completedSets.reduce((sum, s) => sum + s.actual_reps, 0) / completedSets.length)
      : 0
    const remaining = input.rep_max - avgReps
    if (remaining > 0) {
      return `Continue sur ${input.exercise_name} — cherche ${remaining} rep${remaining > 1 ? 's' : ''} de plus pour déclencher la surcharge.`
    }
    return `Bonne séance sur ${input.exercise_name} — reps atteintes, vérifie ton RIR la prochaine fois.`
  }

  // insufficient_data
  return `Données insuffisantes sur ${input.exercise_name} — renseigne tes reps et RIR pour activer la progression automatique.`
}

// ─── Fonction principale ───────────────────────────────────────────────────────

/**
 * Évalue si le trigger de double progression est atteint pour un exercice.
 *
 * @param input - Prescription + résultats de la séance
 * @returns ExerciseProgressionResult - décision + nouvelle charge éventuelle
 */
export function evaluateProgression(
  input: ExerciseProgressionInput
): ExerciseProgressionResult {
  const eligibleSets = input.sets.filter(isProgressionEligibleSet)
  const completedSets = eligibleSets.filter(s => s.completed)

  // Données insuffisantes : aucune série complétée ou reps non renseignées
  const hasReps = completedSets.every(s => s.actual_reps > 0)
  if (completedSets.length === 0 || !hasReps) {
    return {
      exercise_id: input.exercise_id,
      exercise_name: input.exercise_name,
      trigger: 'insufficient_data',
      previous_weight_kg: input.current_weight_kg,
      new_weight_kg: null,
      increment_applied: null,
      sets_evaluated: 0,
      reps_per_set: [],
      rir_values: [],
      all_sets_at_rep_max: false,
      all_sets_rir_compliant: false,
      feedback_message: buildFeedbackMessage('insufficient_data', input, null),
    }
  }

  const repsPerSet = completedSets.map(s => s.actual_reps)
  const rirValues = completedSets.map(s => s.rir_actual)

  const atRepMax = allSetsAtRepMax(completedSets, input.rep_max)
  const rirCompliant = allSetsRirCompliant(completedSets, input.target_rir)

  // Trigger overload : rep_max atteint sur toutes les séries ET RIR conforme
  if (atRepMax && rirCompliant) {
    const prev = input.current_weight_kg
    const next = prev !== null
      ? Math.round((prev + input.weight_increment_kg) * 4) / 4  // arrondi 0.25kg
      : null  // semaine 1, pas de charge de référence → ne pas inventer une charge

    return {
      exercise_id: input.exercise_id,
      exercise_name: input.exercise_name,
      trigger: 'overload',
      previous_weight_kg: prev,
      new_weight_kg: next,
      increment_applied: next !== null && prev !== null ? next - prev : null,
      sets_evaluated: completedSets.length,
      reps_per_set: repsPerSet,
      rir_values: rirValues,
      all_sets_at_rep_max: true,
      all_sets_rir_compliant: true,
      feedback_message: buildFeedbackMessage('overload', input, next),
    }
  }

  // Maintain : même charge, chercher plus de reps
  return {
    exercise_id: input.exercise_id,
    exercise_name: input.exercise_name,
    trigger: 'maintain',
    previous_weight_kg: input.current_weight_kg,
    new_weight_kg: null,
    increment_applied: null,
    sets_evaluated: completedSets.length,
    reps_per_set: repsPerSet,
    rir_values: rirValues,
    all_sets_at_rep_max: atRepMax,
    all_sets_rir_compliant: rirCompliant,
    feedback_message: buildFeedbackMessage('maintain', input, null),
  }
}

/**
 * Évalue la double progression pour une liste d'exercices d'une séance.
 * Retourne uniquement les exercices qui ont des données (ignore les absents).
 */
export function evaluateSessionProgression(
  exercises: ExerciseProgressionInput[]
): ExerciseProgressionResult[] {
  return exercises.map(evaluateProgression)
}

// ─── Parser helper ─────────────────────────────────────────────────────────────

/**
 * Parse le champ reps text ("8-12", "10", "AMRAP") pour extraire rep_min/rep_max.
 * Retourne null si le format n'est pas parseable (AMRAP, etc.).
 */
export function parseRepsRange(reps: string): { rep_min: number; rep_max: number } | null {
  const rangeMatch = reps.match(/^(\d+)\s*[-–]\s*(\d+)$/)
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1])
    const max = parseInt(rangeMatch[2])
    if (min > 0 && max >= min) return { rep_min: min, rep_max: max }
  }
  const fixedMatch = reps.match(/^(\d+)$/)
  if (fixedMatch) {
    const n = parseInt(fixedMatch[1])
    return { rep_min: n, rep_max: n }  // plage fixe = trigger quand la rep est atteinte
  }
  return null  // AMRAP, "20-30s", etc. → pas de double progression
}
