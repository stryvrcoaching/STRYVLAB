// lib/nutrition/engine/cycleSync.ts
// Cycle-phase macro adjustments — Davidsen 2007, Oosthuyse & Bosch 2010
// Only applies when client gender === 'female'. Additive layer on top of base macros.

import type { StryvrmMacros } from './types'

export type CyclePhase = 'follicular' | 'ovulatory' | 'luteal' | 'menstrual'

export interface CycleSyncAdjustment {
  caloriesDelta: number       // kcal/day vs base
  proteinDelta: number        // g/day
  carbsDelta: number          // g/day
  fatDelta: number            // g/day
  hydrationDeltaMl: number    // ml/day
  notes: string[]             // coach-facing guidance
  optimalForDeficit: boolean  // true = favorable phase for caloric restriction
}

const ADJUSTMENTS: Record<CyclePhase, CycleSyncAdjustment> = {
  follicular: {
    caloriesDelta: 0,
    proteinDelta: 0,
    carbsDelta: 0,
    fatDelta: 0,
    hydrationDeltaMl: 0,
    notes: [
      "Phase optimale pour le déficit calorique — sensibilité à l'insuline élevée.",
      "Glucides bien tolérés — privilégier les séances d'intensité haute.",
      "Récupération rapide — idéal pour augmenter la fréquence d'entraînement.",
    ],
    optimalForDeficit: true,
  },
  ovulatory: {
    caloriesDelta: 0,
    proteinDelta: 0,
    carbsDelta: 0,
    fatDelta: 0,
    hydrationDeltaMl: 0,
    notes: [
      "Pic de performance — force et endurance maximales.",
      "Maintenir les calories cibles sans restriction supplémentaire.",
      "Attention à la laxité ligamentaire accrue (oestrogène élevé).",
    ],
    optimalForDeficit: true,
  },
  luteal: {
    // Progesterone increases BMR ~5% = +100 kcal sur base 2000 kcal
    // Protein catabolism increases — +10g protein protective
    // Serotonin drops → carb cravings — +20g carbs reduces cravings
    caloriesDelta: 100,
    proteinDelta: 10,
    carbsDelta: 20,
    fatDelta: 0,
    hydrationDeltaMl: 250,   // rétention hydrique — compenser
    notes: [
      "Métabolisme augmenté (~5%) — ajouter 100 kcal pour soutenir la récupération.",
      "Protéines supplémentaires anti-cataboliques (progestérone élève le turnover protéique).",
      "Glucides complexes recommandés — soutiennent la sérotonine et réduisent les fringales.",
      "Hydratation augmentée — compenser la rétention hydrique prémenstruelle.",
      "Magnésium (400 mg/j) et oméga-3 — réduisent crampes et inflammation.",
    ],
    optimalForDeficit: false,
  },
  menstrual: {
    caloriesDelta: 0,
    proteinDelta: 5,         // soutien musculaire en période de perte de fer
    carbsDelta: 0,
    fatDelta: 5,             // oméga-3 anti-inflammatoires
    hydrationDeltaMl: 250,
    notes: [
      "Maintenir les calories — ne pas couper en phase menstruelle.",
      "Protéines et fer en priorité — aliments riches en fer hémique (viande rouge, légumineuses).",
      "Lipides anti-inflammatoires (oméga-3) — réduisent dysménorrhée.",
      "Hydratation augmentée — pertes physiologiques élevées.",
      "Volume d'entraînement réduit si énergie basse — ne pas forcer.",
    ],
    optimalForDeficit: false,
  },
}

export function getCycleSyncAdjustment(phase: CyclePhase): CycleSyncAdjustment {
  return ADJUSTMENTS[phase]
}

export function adjustMacrosForPhase(
  base: StryvrmMacros,
  phase: CyclePhase,
): StryvrmMacros & { hydrationDeltaMl: number } {
  const adj = ADJUSTMENTS[phase]
  const protein_g = Math.max(0, Math.round(base.protein_g + adj.proteinDelta))
  const carbs_g = Math.max(0, Math.round(base.carbs_g + adj.carbsDelta))
  const fat_g = Math.max(0, Math.round(base.fat_g + adj.fatDelta))
  const calories = protein_g * 4 + carbs_g * 4 + fat_g * 9
  return { protein_g, carbs_g, fat_g, calories, hydrationDeltaMl: adj.hydrationDeltaMl }
}

// Standard 28-day cycle phase boundaries (Davidsen et al.)
// Day 1-5: menstrual, 6-13: follicular, 14-16: ovulatory, 17-28: luteal
export function detectCurrentPhase(cycleDay: number): CyclePhase {
  const day = ((cycleDay - 1) % 28) + 1  // normalize to 1-28
  if (day <= 5) return 'menstrual'
  if (day <= 13) return 'follicular'
  if (day <= 16) return 'ovulatory'
  return 'luteal'
}
