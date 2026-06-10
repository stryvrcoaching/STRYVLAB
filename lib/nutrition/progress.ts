export type NutritionProgressState = 'under' | 'in_target' | 'near_limit' | 'over'

export type NutritionProgressMeta = {
  ratio: number
  clampedPercent: number
  overflowPercent: number
  state: NutritionProgressState
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10
}

export function getNutritionProgressMeta(consumed: number, target: number): NutritionProgressMeta {
  if (target <= 0) {
    return {
      ratio: 0,
      clampedPercent: 0,
      overflowPercent: 0,
      state: 'under',
    }
  }

  const ratio = consumed / target
  const clampedPercent = roundToOneDecimal(Math.max(0, Math.min(100, ratio * 100)))
  const overflowPercent = roundToOneDecimal(Math.max(0, Math.min(100, (ratio - 1) * 100)))

  let state: NutritionProgressState = 'under'
  if (ratio > 1) {
    state = 'over'
  } else if (ratio >= 0.9) {
    state = 'near_limit'
  } else if (ratio >= 0.75) {
    state = 'in_target'
  }

  return {
    ratio,
    clampedPercent,
    overflowPercent,
    state,
  }
}
