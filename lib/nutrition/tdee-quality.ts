export type TdeeEstimationStatus = 'collecting' | 'observing' | 'actionable'

export interface TdeeDataQuality {
  score: number
  status: TdeeEstimationStatus
  reasons: string[]
}

export function assessTdeeDataQuality(input: {
  windowDays: number
  weightSamples: number
  trackedDays: number
  caloriesSource: 'logs' | 'protocol'
  outlierCount?: number
}): TdeeDataQuality {
  const windowScore = Math.min(20, Math.round((input.windowDays / 14) * 20))
  const weightScore = Math.min(35, Math.round((input.weightSamples / 10) * 35))
  const intakeScore = input.caloriesSource === 'logs'
    ? Math.min(35, Math.round((input.trackedDays / 12) * 35))
    : 0
  const sourceScore = input.caloriesSource === 'logs' ? 10 : 0
  const outlierPenalty = Math.min(10, (input.outlierCount ?? 0) * 5)
  const score = Math.max(0, Math.min(100, windowScore + weightScore + intakeScore + sourceScore - outlierPenalty))
  const reasons: string[] = []

  if (input.windowDays < 14) {
    reasons.push(`Fenêtre de ${input.windowDays} jours — 14 jours requis pour une observation fiable`)
  }

  if (input.weightSamples < 8) {
    reasons.push(`${input.weightSamples} pesée(s) exploitable(s) — viser au moins 8 pesées sur 14 jours`)
  } else {
    reasons.push(`${input.weightSamples} pesées exploitables sur la fenêtre`)
  }

  if ((input.outlierCount ?? 0) > 0) {
    reasons.push(`${input.outlierCount} pesée(s) aberrante(s) exclue(s) de la tendance`)
  }

  if (input.caloriesSource !== 'logs') {
    reasons.push('Apports issus du protocole : estimation proxy, pas une observation client')
  } else if (input.trackedDays < 10) {
    reasons.push(`${input.trackedDays} journée(s) nutritionnelle(s) exploitables — viser au moins 10 jours`)
  } else {
    reasons.push(`${input.trackedDays} journées nutritionnelles exploitables`)
  }

  const status: TdeeEstimationStatus =
    input.windowDays >= 14 &&
    input.weightSamples >= 8 &&
    input.trackedDays >= 10 &&
    input.caloriesSource === 'logs'
      ? 'actionable'
      : input.windowDays >= 14 &&
          input.weightSamples >= 4 &&
          input.trackedDays >= 5 &&
          input.caloriesSource === 'logs'
        ? 'observing'
        : 'collecting'

  return { score, status, reasons }
}
