/**
 * Deload Detection Library
 *
 * Analyzes 4 weeks of training data to detect signs of fatigue, overtraining,
 * or stagnation that warrant a deload week (reduced volume, same intensity).
 */

export type DeloadSignalType =
  | 'performance_decline'
  | 'rir_inflation'
  | 'completion_drop'
  | 'volume_stagnation'

export type SignalSeverity = 'warning' | 'critical'

export interface DeloadSignal {
  type: DeloadSignalType
  severity: SignalSeverity
  title: string
  body: string
  recommendation: string
}

export interface WeeklyData {
  week: number // 1 = most recent, 4 = oldest
  avgRir: number | null
  completionRate: number // 0-1
  totalVolume: number // kg × reps
  oneRMEstimate: number | null
}

/**
 * Detect signals that suggest a deload is needed.
 *
 * Signals:
 * 1. RIR inflation: RIR increasing over 3 weeks (getting easier = plateau)
 * 2. Completion drop: Sets completed dropped <75% this week
 * 3. 1RM decline: 1RM dropped >5% over 3 weeks
 * 4. Volume stagnation: Volume unchanged >3 weeks despite good completion
 *
 * @param weeklyData - 4 weeks of aggregated data (week 1 = most recent)
 * @returns Array of deload signals detected
 */
export function detectDeloadSignals(weeklyData: WeeklyData[]): DeloadSignal[] {
  if (weeklyData.length < 3) return []

  const signals: DeloadSignal[] = []
  const [w1, w2, w3] = weeklyData // most recent first

  // ────────────────────────────────────────────────────────────
  // Signal 1: RIR inflation (getting easier = no progression)
  // ────────────────────────────────────────────────────────────
  if (w1.avgRir !== null && w2.avgRir !== null && w3.avgRir !== null) {
    if (
      w1.avgRir > w2.avgRir &&
      w2.avgRir > w3.avgRir &&
      w1.avgRir > 4
    ) {
      signals.push({
        type: 'rir_inflation',
        severity: 'warning',
        title: 'Poids trop léger',
        body: `RIR moyen en hausse depuis 3 semaines (${w3.avgRir.toFixed(1)} → ${w2.avgRir.toFixed(1)} → ${w1.avgRir.toFixed(1)}). Les exercices deviennent trop faciles.`,
        recommendation:
          'Augmente les charges de 2.5-5kg sur tes exercices principaux.',
      })
    }
  }

  // ────────────────────────────────────────────────────────────
  // Signal 2: Completion rate drop
  // ────────────────────────────────────────────────────────────
  if (w1.completionRate < 0.75 && w2.completionRate >= 0.85) {
    const severity = w1.completionRate < 0.6 ? 'critical' : 'warning'
    signals.push({
      type: 'completion_drop',
      severity,
      title: 'Taux de complétion en chute',
      body: `Seulement ${Math.round(w1.completionRate * 100)}% des séries complétées cette semaine (${Math.round(w2.completionRate * 100)}% la semaine passée).`,
      recommendation:
        'Signe possible de surentraînement. Envisage une semaine de déload : -40% volume, même intensité.',
    })
  }

  // ────────────────────────────────────────────────────────────
  // Signal 3: 1RM decline (performance loss)
  // ────────────────────────────────────────────────────────────
  if (
    w1.oneRMEstimate !== null &&
    w3.oneRMEstimate !== null &&
    w3.oneRMEstimate > 0
  ) {
    const declinePercent = (1 - w1.oneRMEstimate / w3.oneRMEstimate) * 100
    if (w1.oneRMEstimate < w3.oneRMEstimate * 0.95) {
      signals.push({
        type: 'performance_decline',
        severity: 'critical',
        title: 'Baisse de performance détectée',
        body: `Force estimée (1RM) en baisse de ${Math.round(declinePercent)}% sur 3 semaines (${w3.oneRMEstimate.toFixed(1)}kg → ${w1.oneRMEstimate.toFixed(1)}kg).`,
        recommendation:
          'Déload recommandé immédiatement : réduis le volume de 40%, maintiens l\'intensité.',
      })
    }
  }

  // ────────────────────────────────────────────────────────────
  // Signal 4: Volume stagnation (no progress despite good completion)
  // ────────────────────────────────────────────────────────────
  if (weeklyData.length >= 3 && w1.totalVolume > 0 && w3.totalVolume > 0) {
    const volChange = w1.totalVolume / w3.totalVolume
    // < 1.02 = less than 2% increase over 3 weeks; not progressing
    if (volChange < 1.02 && w1.completionRate > 0.85) {
      signals.push({
        type: 'volume_stagnation',
        severity: 'warning',
        title: 'Volume stagnant',
        body: `Volume total inchangé depuis 3 semaines (${Math.round(w3.totalVolume)}kg → ${Math.round(w1.totalVolume)}kg) malgré une bonne complétion (${Math.round(w1.completionRate * 100)}%).`,
        recommendation:
          'Ajoute 1 série par exercice composé, ou augmente les charges de 2.5kg.',
      })
    }
  }

  return signals
}

/**
 * Compute weekly aggregates from raw session logs.
 * Used to feed into detectDeloadSignals.
 *
 * @param weeklyDataRaw - Raw data with sessions, sets, 1RM estimates per week
 * @returns Aggregated WeeklyData for use in deload detection
 */
export function aggregateWeeklyData(
  weeklyDataRaw: Array<{
    week: number
    sessions: Array<{
      totalSetsCompleted: number
      totalSetsPrescribed: number
      setLogs: Array<{
        actual_reps: number | null
        rir_actual: number | null
      }>
    }>
    oneRMEstimate: number | null
  }>
): WeeklyData[] {
  return weeklyDataRaw.map(week => {
    let totalRirs: number[] = []
    let totalSetsCompleted = 0
    let totalSetsPrescribed = 0
    let totalVolume = 0

    for (const session of week.sessions) {
      totalSetsCompleted += session.totalSetsCompleted
      totalSetsPrescribed += session.totalSetsPrescribed

      for (const set of session.setLogs) {
        if (set.rir_actual != null) {
          totalRirs.push(set.rir_actual)
        }
        // Volume is accumulated from set logs (reps × weight) — simplified here
        // In practice, you'd sum actual_reps * actual_weight_kg from each set
        totalVolume += set.actual_reps ?? 0 // placeholder; actual implementation needs weights
      }
    }

    const avgRir =
      totalRirs.length > 0
        ? Math.round(totalRirs.reduce((a, b) => a + b, 0) / totalRirs.length * 10) / 10
        : null

    const completionRate =
      totalSetsPrescribed > 0
        ? Math.round((totalSetsCompleted / totalSetsPrescribed) * 100) / 100
        : 0

    return {
      week: week.week,
      avgRir,
      completionRate,
      totalVolume,
      oneRMEstimate: week.oneRMEstimate,
    }
  })
}
