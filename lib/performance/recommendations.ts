/**
 * Performance Recommendations — Phase 3 Feedback Loops
 *
 * Logique pure — aucune dépendance Supabase/DB.
 * Génère des recommandations d'ajustement programme depuis l'analyse de performance.
 */

import type { ExercisePerformanceSummary, PerformanceAnalysis } from './analyzer'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PerformanceRecommendation {
  exercise_id: string | null   // null pour les recommandations globales (add_rest_day)
  exercise_name: string
  type: 'increase_volume' | 'decrease_volume' | 'increase_weight' | 'swap_exercise' | 'add_rest_day'
  reason: string
  proposed_value: Record<string, unknown>   // { sets: 4 } ou { weight_increment: 'next' }
  current_value: Record<string, unknown>    // { sets: 3 }
  priority: 'high' | 'medium' | 'low'
}

type ProgramExercise = {
  id: string
  name: string
  sets: number
  current_weight_kg: number | null
}

// ─── Priorité helper ──────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<PerformanceRecommendation['priority'], number> = {
  high: 3,
  medium: 2,
  low: 1,
}

// ─── Fonction principale ──────────────────────────────────────────────────────

/**
 * Génère des recommandations d'ajustement programme depuis une analyse de performance.
 * Max 1 recommandation par exercice (la plus prioritaire).
 * Recommandation globale add_rest_day si global_overreaching.
 */
export function generateRecommendations(
  analysis: PerformanceAnalysis,
  currentProgram: { exercises: ProgramExercise[] }
): PerformanceRecommendation[] {
  const recommendations: PerformanceRecommendation[] = []

  // Recommandation globale : jour de repos
  if (analysis.global_overreaching) {
    recommendations.push({
      exercise_id: null,
      exercise_name: 'Programme global',
      type: 'add_rest_day',
      reason: `Au moins 2 exercices montrent des signes de surcharge (taux de complétion < 80% sur les 2 dernières séances). Un jour de récupération supplémentaire est recommandé.`,
      proposed_value: { rest_days: 'add_one' },
      current_value: {},
      priority: 'high',
    })
  }

  // Map des exercices du programme pour accès rapide
  const programMap = new Map<string, ProgramExercise>()
  for (const ex of currentProgram.exercises) {
    programMap.set(ex.id, ex)
  }

  // Recommandations par exercice
  for (const summary of analysis.exercises) {
    const programEx = programMap.get(summary.exercise_id)
    const candidateRecs: PerformanceRecommendation[] = []

    // --- decrease_volume : overreaching (priority high) ---
    if (summary.overreaching) {
      const currentSets = programEx?.sets ?? 3
      candidateRecs.push({
        exercise_id: summary.exercise_id,
        exercise_name: summary.exercise_name,
        type: 'decrease_volume',
        reason: `Taux de complétion < 80% sur les 2 dernières séances consécutives (${(summary.completion_rate * 100).toFixed(0)}% en moyenne). Réduire le volume permet la récupération.`,
        proposed_value: { sets: Math.max(currentSets - 1, 1) },
        current_value: { sets: currentSets },
        priority: 'high',
      })
    }

    // --- increase_weight : completion > 95% + rir_trend improving (priority medium) ---
    if (
      !summary.overreaching &&
      summary.completion_rate > 0.95 &&
      summary.rir_trend === 'improving'
    ) {
      const currentWeight = programEx?.current_weight_kg ?? null
      candidateRecs.push({
        exercise_id: summary.exercise_id,
        exercise_name: summary.exercise_name,
        type: 'increase_weight',
        reason: `Taux de complétion > 95% et RIR en hausse (exercice perçu comme plus facile). Augmenter la charge pour maintenir la stimulation.`,
        proposed_value: { weight_increment: 'next' },
        current_value: { current_weight_kg: currentWeight },
        priority: 'medium',
      })
    }

    // --- increase_volume : avg_rir > 3 + completion > 95% + pas stagnation (priority medium) ---
    if (
      !summary.overreaching &&
      summary.avg_rir !== null &&
      summary.avg_rir > 3 &&
      summary.completion_rate > 0.95 &&
      !summary.stagnation
    ) {
      const currentSets = programEx?.sets ?? 3
      // Ne pas proposer increase_volume si on a déjà une increase_weight pour cet exercice
      const hasIncreaseWeight = candidateRecs.some(r => r.type === 'increase_weight')
      if (!hasIncreaseWeight) {
        candidateRecs.push({
          exercise_id: summary.exercise_id,
          exercise_name: summary.exercise_name,
          type: 'increase_volume',
          reason: `RIR moyen de ${summary.avg_rir.toFixed(1)} (élevé) avec un taux de complétion > 95%. L'exercice est bien en dessous du seuil d'effort optimal — ajouter 1 série.`,
          proposed_value: { sets: currentSets + 1 },
          current_value: { sets: currentSets },
          priority: 'medium',
        })
      }
    }

    // --- swap_exercise : stagnation > 3 semaines + completion > 80% (priority low) ---
    if (
      !summary.overreaching &&
      summary.stagnation &&
      summary.completion_rate > 0.8 &&
      summary.overloads_last_4_weeks === 0
    ) {
      candidateRecs.push({
        exercise_id: summary.exercise_id,
        exercise_name: summary.exercise_name,
        type: 'swap_exercise',
        reason: `Aucune surcharge progressive sur les 3 dernières semaines malgré un taux de complétion > 80%. L'exercice est bien toléré mais ne stimule plus l'adaptation — envisager une variante.`,
        proposed_value: { action: 'find_alternative' },
        current_value: { exercise_name: summary.exercise_name },
        priority: 'low',
      })
    }

    // Garder uniquement la recommandation la plus prioritaire par exercice
    if (candidateRecs.length > 0) {
      const best = candidateRecs.sort(
        (a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]
      )[0]
      // Double sécurité : ne pas émettre increase_volume ET decrease_volume pour le même exercice
      recommendations.push(best)
    }
  }

  return recommendations
}
