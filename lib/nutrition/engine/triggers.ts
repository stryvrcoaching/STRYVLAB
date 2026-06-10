import type { TriggerRecommendation } from './types'

export interface TriggerInput {
  avgSleepH: number | null
  avgEnergyLevel: number | null
  avgStressLevel: number | null
  avgHungerLevel: number | null
  avgMuscleSoreness: number | null
  isLowCarbDay: boolean
  rpeLastSession: number | null
  performanceTrend: 'improving' | 'stable' | 'declining' | null
}

export function computeTriggers(input: TriggerInput): TriggerRecommendation[] {
  const results: TriggerRecommendation[] = []

  // Fatigue trigger — any single signal is enough (unlike guardrail which needs 3+ days)
  const poorSleep = input.avgSleepH !== null && input.avgSleepH < 6
  const lowEnergy = input.avgEnergyLevel !== null && input.avgEnergyLevel <= 2
  const highStress = input.avgStressLevel !== null && input.avgStressLevel >= 4

  if (poorSleep || lowEnergy || highStress) {
    results.push({
      trigger: 'fatigue',
      severity: 'warning',
      title: 'Fatigue détectée',
      action:
        "Maintien du volume alimentaire. Prioriser récupération : sommeil, gestion du stress, réduction du volume d'entraînement si nécessaire.",
      doNotCutCalories: true,
    })
  }

  // Stagnation trigger — requires all 3 signals
  const highRpe = input.rpeLastSession !== null && input.rpeLastSession >= 9
  const perfDeclining = input.performanceTrend === 'declining'
  const highSoreness = input.avgMuscleSoreness !== null && input.avgMuscleSoreness >= 3

  if (highRpe && perfDeclining && highSoreness) {
    results.push({
      trigger: 'stagnation',
      severity: 'warning',
      title: 'Stagnation / surentraînement',
      action:
        "Décharge recommandée : réduire le volume d'entraînement de 40% cette semaine. Ne pas couper les calories.",
      doNotCutCalories: true,
    })
  }

  // Hunger trigger — only meaningful on low-carb days
  const highHunger = input.avgHungerLevel !== null && input.avgHungerLevel >= 3

  if (highHunger && input.isLowCarbDay) {
    results.push({
      trigger: 'hunger',
      severity: 'info',
      title: 'Faim excessive en jour bas',
      action:
        "Augmenter le volume alimentaire via fibres et légumes. Conserver les macros protéines et lipides, pas de réduction calorique.",
      doNotCutCalories: true,
    })
  }

  return results
}
