import type { CoachPhasePreferences } from './types'

/** Derive phase prefs from client training goal until dedicated coach prefs exist in DB. */
export function deriveCoachPhasePreferences(trainingGoal: string | null | undefined): CoachPhasePreferences {
  const goal = trainingGoal ?? 'recomp'
  const performanceGoals = new Set(['strength', 'hypertrophy', 'athletic', 'endurance'])

  return {
    prioritizePerformance: performanceGoals.has(goal),
    aggressiveCutTolerance:
      goal === 'fat_loss' ? 0.7
      : goal === 'maintenance' ? 0.3
      : 0.5,
    preferredBulkAggressiveness:
      goal === 'hypertrophy' ? 0.75
      : goal === 'fat_loss' ? 0.25
      : 0.5,
  }
}
