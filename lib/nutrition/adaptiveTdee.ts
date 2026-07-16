export interface WeightSample {
  date: string       // ISO date 'YYYY-MM-DD'
  weight_kg: number
}

export interface AdaptiveTdeeInput {
  weightSamples: WeightSample[]
  avgIntakeKcal: number
  caloriesSource: 'logs' | 'protocol'
  windowDays: number
  trackedDays?: number
  excludedCurrentDay?: boolean
  // v2 signals
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null
  cyclePhases?: string[]        // cycle_phase per day in window (for female clients)
  cycleConfidence?: 'estimated' | 'learning' | 'calibrated' | null
  anchoredToProtocol?: boolean  // window starts at protocol share date
}

export interface AdaptiveTdeeResult {
  tdeeAdaptive: number
  weightDeltaKg: number
  slopeKgPerDay: number
  confidence: 'high' | 'medium' | 'low'
  confidenceScore: number
  confidenceReasons: string[]
  // v2
  appliedLutealCorrection: boolean
  smoothedWeightUsed: boolean
  weightSamplesUsed: number
  outlierCount: number
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

export function filterWeightOutliers(samples: WeightSample[]) {
  if (samples.length < 5) return { samples, outlierCount: 0 }

  const center = median(samples.map((sample) => sample.weight_kg))
  const deviations = samples.map((sample) => Math.abs(sample.weight_kg - center))
  const mad = median(deviations)
  const threshold = Math.max(0.5, mad * 4)
  const filtered = samples.filter((sample) => Math.abs(sample.weight_kg - center) <= threshold)

  return filtered.length >= 4
    ? { samples: filtered, outlierCount: samples.length - filtered.length }
    : { samples, outlierCount: 0 }
}

export function linearRegression(samples: WeightSample[]): { slope: number; intercept: number } {
  const sorted = [...samples].sort((a, b) => a.date.localeCompare(b.date))
  const origin = new Date(sorted[0].date).getTime()
  const points = sorted.map(s => ({
    x: (new Date(s.date).getTime() - origin) / 86400000,
    y: s.weight_kg,
  }))
  const n = points.length
  const sumX = points.reduce((acc, p) => acc + p.x, 0)
  const sumY = points.reduce((acc, p) => acc + p.y, 0)
  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0)
  const sumX2 = points.reduce((acc, p) => acc + p.x * p.x, 0)
  const denom = n * sumX2 - sumX * sumX
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

/**
 * Apply 3-day centered moving average to smooth daily weight fluctuations.
 * Reduces noise from water retention, glycogen, meal timing.
 * Edge points use 2-day average (no center available).
 */
export function smoothWeightSamples(samples: WeightSample[]): WeightSample[] {
  if (samples.length < 3) return samples
  const sorted = [...samples].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((s, i) => {
    const prev = i > 0 ? sorted[i - 1].weight_kg : null
    const next = i < sorted.length - 1 ? sorted[i + 1].weight_kg : null
    const vals = [prev, s.weight_kg, next].filter((v): v is number => v !== null)
    return { date: s.date, weight_kg: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)) }
  })
}

/**
 * Detect if the majority of the window is in luteal phase.
 * Luteal phase raises BMR ~5% via progesterone and causes 0.5–2 kg water retention.
 * Reference: Davidsen et al. 2007, Oosthuyse & Bosch 2010.
 */
export function detectLutealMajority(cyclePhases: string[]): boolean {
  if (cyclePhases.length === 0) return false
  const lutealCount = cyclePhases.filter(p => p === 'luteal').length
  return lutealCount / cyclePhases.length > 0.5
}

export function calcAdaptiveTdee(input: AdaptiveTdeeInput): AdaptiveTdeeResult {
  if (input.weightSamples.length < 2) {
    throw new Error('At least 2 weight samples required')
  }

  const filtered = filterWeightOutliers(input.weightSamples)

  // v2 — smooth weights before regression to reduce daily noise
  const smoothed = smoothWeightSamples(filtered.samples)
  const smoothedWeightUsed = smoothed.some((s, i) => s.weight_kg !== filtered.samples[i]?.weight_kg)

  // v2 — luteal correction for female clients
  const isFemale = input.gender === 'female'
  const lutealMajority = isFemale && input.cyclePhases
    ? detectLutealMajority(input.cyclePhases)
    : false
  const appliedLutealCorrection = lutealMajority

  // Adjust smoothed weights: subtract estimated water retention if luteal majority
  // Luteal phase causes avg +0.8 kg water retention (Davidsen 2007)
  const samplesForRegression = appliedLutealCorrection
    ? smoothed.map(s => ({ ...s, weight_kg: s.weight_kg - 0.8 }))
    : smoothed

  const { slope } = linearRegression(samplesForRegression)

  // MacroFactor method: TDEE = intake - (slope × 7700)
  let rawTdee = input.avgIntakeKcal - slope * 7700

  // v2 — luteal BMR correction: progesterone raises BMR ~5% (~+100 kcal on 2000 base)
  // If majority of window is luteal, the avg intake was already elevated → add back
  if (appliedLutealCorrection) {
    rawTdee += 100
  }

  const tdeeAdaptive = Math.round(rawTdee / 10) * 10
  const weightDeltaKg = parseFloat((slope * input.windowDays).toFixed(2))

  // ── Confidence scoring ────────────────────────────────────────────────────
  const confidenceReasons: string[] = []
  let confidenceScore = 100

  // Calorie source
  if (input.caloriesSource === 'protocol') {
    confidenceScore -= 45
    confidenceReasons.push("Apports estimés depuis le protocole (pas les logs) — précision réduite")
  } else {
    confidenceReasons.push("Apports basés sur les repas loggés")
  }

  // Weight sample density
  if (filtered.samples.length < 4) {
    confidenceScore -= 50
    confidenceReasons.push(`Seulement ${filtered.samples.length} pesée(s) exploitable(s) — minimum 4 recommandées`)
  } else if (filtered.samples.length < 6) {
    confidenceScore -= 10
    confidenceReasons.push(`${filtered.samples.length} pesées exploitables — couverture partielle`)
  } else {
    confidenceReasons.push(`${filtered.samples.length} pesées exploitables — couverture solide`)
  }

  if (filtered.outlierCount > 0) {
    confidenceScore -= Math.min(10, filtered.outlierCount * 5)
    confidenceReasons.push(`${filtered.outlierCount} pesée(s) aberrante(s) écartée(s) avant le calcul de tendance`)
  }

  // Nutritional tracking compliance
  if (typeof input.trackedDays === 'number') {
    if (input.trackedDays < Math.max(5, Math.floor(input.windowDays / 2))) {
      confidenceScore -= 20
      confidenceReasons.push(`${input.trackedDays} jours nutritionnels suivis sur ${input.windowDays} — suivi insuffisant`)
    } else {
      confidenceReasons.push(`${input.trackedDays} jours nutritionnels suivis — suivi régulier`)
    }
  }

  if (input.excludedCurrentDay) {
    confidenceReasons.push("Journée en cours exclue jusqu'à clôture pour éviter un biais d'apport partiel")
  }

  // v2 — window anchoring bonus
  if (input.anchoredToProtocol) {
    confidenceScore += 5
    confidenceReasons.push("Fenêtre homogène depuis un changement de contexte nutritionnel")
  } else {
    confidenceReasons.push("Fenêtre glissante client — indépendante du protocole en cours")
  }

  // v2 — cycle signal quality for female clients
  if (isFemale) {
    if (!input.cyclePhases || input.cyclePhases.length === 0) {
      confidenceScore -= 10
      confidenceReasons.push("Pas de données cycle menstruel — correction lutéale impossible")
    } else if (input.cycleConfidence === 'estimated') {
      confidenceScore -= 10
      confidenceReasons.push("Cycle menstruel estimé (pas de logs) — correction approximative")
    } else if (appliedLutealCorrection) {
      confidenceReasons.push("Phase lutéale majoritaire — correction rétention hydrique appliquée (+0.8 kg, +100 kcal)")
    } else {
      confidenceReasons.push("Phase non-lutéale — pas de correction nécessaire")
    }
  }

  // v2 — window length signal
  if (input.windowDays < 10) {
    confidenceScore -= 15
    confidenceReasons.push(`Fenêtre courte (${input.windowDays}j) — tendance moins fiable`)
  } else if (input.windowDays >= 14) {
    confidenceReasons.push(`Fenêtre ${input.windowDays}j — durée optimale`)
  }

  if (input.excludedCurrentDay) {
    confidenceScore = Math.min(confidenceScore, 95)
  }

  const confidence: 'high' | 'medium' | 'low' =
    confidenceScore >= 80 ? 'high' : confidenceScore >= 55 ? 'medium' : 'low'

  return {
    tdeeAdaptive,
    weightDeltaKg,
    slopeKgPerDay: slope,
    confidence,
    confidenceScore: Math.max(0, Math.min(100, confidenceScore)),
    confidenceReasons,
    appliedLutealCorrection,
    smoothedWeightUsed,
    weightSamplesUsed: filtered.samples.length,
    outlierCount: filtered.outlierCount,
  }
}
