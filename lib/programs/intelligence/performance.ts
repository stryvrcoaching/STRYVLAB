export interface SetObservation {
  actual_reps: number | null
  actual_weight_kg: number | null
  completed: boolean
  rir_actual: number | null
}

export interface SessionObservation {
  completedAt: string
  sets: SetObservation[]
}

export interface PerformanceTrendResult {
  trend: 'progression' | 'stagnation' | 'overtraining' | null
  suggestion: string | null
  sessionCount: number
}

function sessionVolumeKg(session: SessionObservation): number {
  return session.sets
    .filter(s => s.completed)
    .reduce((sum, s) => sum + (s.actual_reps ?? 0) * (s.actual_weight_kg ?? 0), 0)
}

function avgRir(sets: SetObservation[]): number | null {
  const withRir = sets.filter(s => s.rir_actual != null)
  if (withRir.length === 0) return null
  return withRir.reduce((sum, s) => sum + (s.rir_actual ?? 0), 0) / withRir.length
}

function completionRate(sets: SetObservation[]): number {
  if (sets.length === 0) return 1
  return sets.filter(s => s.completed).length / sets.length
}

export function detectPerformanceTrend(
  sessions: SessionObservation[],
): PerformanceTrendResult {
  if (sessions.length < 2) {
    return { trend: null, suggestion: null, sessionCount: sessions.length }
  }

  // Sort oldest → newest
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  )

  const recent2 = sorted.slice(-2)
  const allSetsRecent2 = recent2.flatMap(s => s.sets)

  // Rule 1: Overtraining — avg RIR ≤ 1 in last 2 sessions AND completion < 80%
  const rir2 = avgRir(allSetsRecent2)
  const completion2 = completionRate(allSetsRecent2)
  if (rir2 !== null && rir2 <= 1 && completion2 < 0.8) {
    return {
      trend: 'overtraining',
      suggestion: 'Réduire le volume ou ajouter une séance de récupération active.',
      sessionCount: sessions.length,
    }
  }

  // Volume per session (oldest to newest)
  const volumes = sorted.map(sessionVolumeKg)

  const allSets = sorted.flatMap(s => s.sets)
  const avgRirAll = avgRir(allSets)

  // Rule 2: Progression — volume strictly increasing, avg RIR ≤ 4
  const isIncreasing = volumes.every((v, i) => i === 0 || v > volumes[i - 1])
  if (isIncreasing && (avgRirAll === null || avgRirAll <= 4)) {
    return {
      trend: 'progression',
      suggestion: 'Bonne progression — envisager une surcharge progressive (+2.5kg ou +1 rep).',
      sessionCount: sessions.length,
    }
  }

  // Rule 3: Stagnation — all volume deltas < 3%, avg RIR ≥ 3
  const maxDelta = volumes.reduce((max, v, i) => {
    if (i === 0) return max
    const ref = volumes[i - 1]
    if (ref === 0) return max
    return Math.max(max, Math.abs(v - ref) / ref)
  }, 0)
  const isFlat = maxDelta < 0.03
  if (isFlat && avgRirAll !== null && avgRirAll >= 3) {
    return {
      trend: 'stagnation',
      suggestion: 'Plateau détecté — augmenter la charge ou modifier le schéma de sets/reps.',
      sessionCount: sessions.length,
    }
  }

  return { trend: null, suggestion: null, sessionCount: sessions.length }
}
