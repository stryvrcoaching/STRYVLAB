import { ct, type ClientLang } from '@/lib/i18n/clientTranslations'

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
  caffeine_mg?: number
}

export type NutritionInput = {
  consumed: NutritionConsumed
  target: NutritionConsumed
  currentHour: number
  hasLunchLog: boolean
  lang?: ClientLang
}

export function computeNutritionAlerts(input: NutritionInput): NutritionAlert[] {
  const alerts: NutritionAlert[] = []
  const { consumed, target, currentHour, hasLunchLog, lang = 'fr' } = input

  // Rule 1: protein_low (warning) — after 14h, behind schedule
  if (currentHour >= 14) {
    const expected = target.protein_g * (currentHour / 22)
    const threshold = expected * 0.8
    if (consumed.protein_g < threshold) {
      const delta = Math.round(target.protein_g - consumed.protein_g)
      alerts.push({
        code: 'protein_low',
        severity: 'warning',
        title: ct(lang, 'smart.nutrition.alert.proteinLow'),
        body: ct(lang, 'smart.nutrition.alert.proteinLow.body', { delta, target: target.protein_g }),
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
      title: ct(lang, 'smart.nutrition.alert.carbsLimit'),
      body: ct(lang, 'smart.nutrition.alert.carbsLimit.body', { delta }),
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
        title: ct(lang, 'smart.nutrition.alert.hydrationLow'),
        body: ct(lang, 'smart.nutrition.alert.hydrationLow.body', { delta: deltaL }),
        delta: deltaMl,
      })
    }
  }

  // Rule 4: lunch_missing (info) — between 13-14h, no lunch log
  if (currentHour >= 13 && currentHour < 15 && !hasLunchLog) {
    alerts.push({
      code: 'lunch_missing',
      severity: 'info',
      title: ct(lang, 'smart.nutrition.alert.lunchMissing'),
    })
  }

  return alerts
}
