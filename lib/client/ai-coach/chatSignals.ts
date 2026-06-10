export interface DailySignals {
  weightDelta7d: number | null
  caloriesPct: number
  proteinPct: number
  hydrationPct: number
  energyTrend: 'improving' | 'worsening' | 'stable' | 'unknown'
  missingMeals: boolean
  hasCompletedSession: boolean
}

export function computeDailySignals(params: {
  targetKcal: number
  targetProtein: number
  targetWaterMl: number
  totalKcal: number
  totalProtein: number
  totalWaterMl: number
  bilans: any[]
  checkinsPast3Days: any[]
  session: any | null
}): DailySignals {
  const {
    targetKcal,
    targetProtein,
    targetWaterMl,
    totalKcal,
    totalProtein,
    totalWaterMl,
    bilans,
    checkinsPast3Days,
    session
  } = params

  const caloriesPct = targetKcal > 0 ? Math.round((totalKcal / targetKcal) * 100) : 0
  const proteinPct = targetProtein > 0 ? Math.round((totalProtein / targetProtein) * 100) : 0
  const hydrationPct = targetWaterMl > 0 ? Math.round((totalWaterMl / targetWaterMl) * 100) : 0

  let weightDelta7d: number | null = null
  if (bilans && bilans.length >= 2) {
    const latest = bilans[bilans.length - 1]?.assessment_responses?.find((r: any) => r.field_key === 'weight_kg')?.value_number
    // On cherche un bilan il y a ~7j, pour simplifier on prend le premier s'il y a 2 bilans
    // ou le 1er dispo dans la fenetre. Si on a un full history, on prend le plus récent et on compare avec le 1er.
    const first = bilans[0]?.assessment_responses?.find((r: any) => r.field_key === 'weight_kg')?.value_number
    if (latest != null && first != null) {
      weightDelta7d = +(latest - first).toFixed(1)
    }
  }

  let energyTrend: 'improving' | 'worsening' | 'stable' | 'unknown' = 'unknown'
  if (checkinsPast3Days && checkinsPast3Days.length >= 2) {
    // Trier par date
    const sorted = [...checkinsPast3Days].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const firstE = sorted[0]?.energy_level
    const lastE = sorted[sorted.length - 1]?.energy_level
    if (firstE != null && lastE != null) {
      if (lastE > firstE) energyTrend = 'improving'
      else if (lastE < firstE) energyTrend = 'worsening'
      else energyTrend = 'stable'
    }
  }

  return {
    weightDelta7d,
    caloriesPct,
    proteinPct,
    hydrationPct,
    energyTrend,
    missingMeals: totalKcal === 0,
    hasCompletedSession: !!session
  }
}
