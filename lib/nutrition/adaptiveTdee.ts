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

  // v2 — smooth weights before regression to reduce daily noise
  const smoothed = smoothWeightSamples(input.weightSamples)
  const smoothedWeightUsed = smoothed.some((s, i) => s.weight_kg !== input.weightSamples[i]?.weight_kg)

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
  if (input.weightSamples.length < 4) {
    confidenceScore -= 50
    confidenceReasons.push(`Seulement ${input.weightSamples.length} pesée(s) — minimum 4 recommandées`)
  } else if (input.weightSamples.length < 6) {
    confidenceScore -= 10
    confidenceReasons.push(`${input.weightSamples.length} pesées — couverture partielle`)
  } else {
    confidenceReasons.push(`${input.weightSamples.length} pesées — couverture solide`)
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

  // v2 — window anchoring bonus
  if (input.anchoredToProtocol) {
    confidenceScore += 5
    confidenceReasons.push("Fenêtre ancrée sur le début du protocole — données homogènes")
  } else {
    confidenceReasons.push("Fenêtre non ancrée — peut inclure des données pré-protocole")
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
  }
}
