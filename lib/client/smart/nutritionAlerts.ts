export type NutritionAlertCode =
  | 'protein_low'
  | 'carbs_limit'
  | 'hydration_low'
  | 'lunch_missing'

export type NutritionAlertSeverity = 'info' | 'warning' | 'critical'

export type NutritionAlert = {
  code: NutritionAlertCode
  severity: NutritionAlertSeverity
  title: string
  body?: string
  delta?: number
}

export type NutritionConsumed = {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  water_ml: number
}

export type NutritionInput = {
  consumed: NutritionConsumed
  target: NutritionConsumed
  currentHour: number
  hasLunchLog: boolean
}

export function computeNutritionAlerts(input: NutritionInput): NutritionAlert[] {
  const alerts: NutritionAlert[] = []
  const { consumed, target, currentHour, hasLunchLog } = input

  // Rule 1: protein_low (warning) — after 14h, behind schedule
  if (currentHour >= 14) {
    const expected = target.protein_g * (currentHour / 22)
    const threshold = expected * 0.8
    if (consumed.protein_g < threshold) {
      const delta = Math.round(target.protein_g - consumed.protein_g)
      alerts.push({
        code: 'protein_low',
        severity: 'warning',
        title: 'PROTÉINES EN RETARD',
        body: `il te reste ${delta}g pour atteindre ${target.protein_g}g`,
        delta,
      })
    }
  }

  // Rule 2: carbs_limit (critical) — over target
  if (consumed.carbs_g > target.carbs_g) {
    const delta = Math.round(consumed.carbs_g - target.carbs_g)
    alerts.push({
      code: 'carbs_limit',
      severity: 'critical',
      title: 'LIMITE GLUCIDES ATTEINTE',
      body: `-${delta}g sur ta cible`,
      delta,
    })
  }

  // Rule 3: hydration_low (warning) — after 14h, <50% of target
  if (currentHour >= 14) {
    const ratio = target.water_ml > 0 ? consumed.water_ml / target.water_ml : 1
    if (ratio < 0.5) {
      const deltaMl = target.water_ml - consumed.water_ml
      const deltaL = (deltaMl / 1000).toFixed(1)
      alerts.push({
        code: 'hydration_low',
        severity: 'warning',
        title: 'HYDRATATION FAIBLE',
        body: `il manque ${deltaL}L`,
        delta: deltaMl,
      })
    }
  }

  // Rule 4: lunch_missing (info) — between 13-14h, no lunch log
  if (currentHour >= 13 && currentHour < 15 && !hasLunchLog) {
    alerts.push({
      code: 'lunch_missing',
      severity: 'info',
      title: 'PAS DE DÉJEUNER LOGUÉ',
    })
  }

  return alerts
}
