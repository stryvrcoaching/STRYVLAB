type RecommendationInput = {
  remaining: {
    protein_g: number
    carbs_g: number
    fat_g: number
  }
  overflow: {
    protein_g: number
    carbs_g: number
    fat_g: number
  }
  remainingCaloriesNet: number
}

export type NutritionSuggestion = {
  label: string
  macros: string
  rationale: string
}

export function suggestFoodsFromBalance(
  balance: RecommendationInput,
): NutritionSuggestion[] {
  const { remaining, overflow, remainingCaloriesNet } = balance
  const out: NutritionSuggestion[] = []

  const proteinOver = overflow.protein_g > 0
  const fatOver = overflow.fat_g > 0
  const carbsOver = overflow.carbs_g > 0

  if (remaining.carbs_g >= 40 && proteinOver && fatOver) {
    out.push({
      label: 'Fruits + miel + riz',
      macros: '~55G · ~0P · ~0L',
      rationale: 'Priorise les glucides restants sans ajouter de protéines ni de lipides déjà dépassés.',
    })
  }

  if (remaining.protein_g >= 25 && remaining.fat_g <= 10 && !proteinOver) {
    out.push({
      label: 'Skyr 0% + whey isolate',
      macros: '~30P · ~8G · ~1L',
      rationale: 'Comble le déficit protéique avec un impact lipidique minimal.',
    })
  }

  if (remaining.carbs_g >= 50 && !proteinOver && remaining.fat_g <= 12) {
    out.push({
      label: 'Riz + fruits',
      macros: '~60G · ~4P · ~1L',
      rationale: 'Monte les glucides tout en gardant les lipides bas.',
    })
  }

  if (remaining.fat_g >= 15 && !fatOver && remaining.protein_g < 20) {
    out.push({
      label: 'Avocat + huile d’olive',
      macros: '~18L · ~8G · ~2P',
      rationale: 'Complète surtout les lipides quand ils sont réellement en retard.',
    })
  }

  if (
    remainingCaloriesNet >= 450 &&
    !proteinOver &&
    !fatOver &&
    !carbsOver &&
    remaining.protein_g > 15 &&
    remaining.carbs_g > 30
  ) {
    out.push({
      label: 'Repas complet équilibré',
      macros: '~30P · ~50G · ~15L',
      rationale: 'Convient quand aucun macro n’est déjà en excès et qu’il reste un vrai budget énergétique.',
    })
  }

  return out.slice(0, 3)
}
