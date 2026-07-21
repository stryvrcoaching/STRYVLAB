import { ct, type ClientLang } from '@/lib/i18n/clientTranslations'

export type NutritionAlertCode =
  | 'protein_low'
  | 'carbs_limit'
  | 'macro_target_alert'
  | 'daily_energy_deficit'
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

  // Rule 3: macro target nearly consumed too early — lets the client rebalance
  // the remaining meals before the evening instead of discovering an overage.
  if (currentHour >= 14 && currentHour < 18) {
    const macro = [
      { key: 'protein', label: ct(lang, 'smart.nutrition.protein'), consumed: consumed.protein_g, target: target.protein_g },
      { key: 'carbs', label: ct(lang, 'smart.nutrition.carbs'), consumed: consumed.carbs_g, target: target.carbs_g },
      { key: 'fat', label: ct(lang, 'smart.nutrition.fat'), consumed: consumed.fat_g, target: target.fat_g },
    ]
      .map((item) => ({ ...item, ratio: item.target > 0 ? item.consumed / item.target : 0 }))
      .filter((item) => item.ratio >= 0.9 && item.ratio <= 1)
      .sort((left, right) => right.ratio - left.ratio)[0]

    if (macro) {
      const percent = Math.round(macro.ratio * 100)
      alerts.push({
        code: 'macro_target_alert',
        severity: 'warning',
        title: ct(lang, 'smart.nutrition.alert.macroTarget'),
        body: ct(lang, 'smart.nutrition.alert.macroTarget.body', {
          macro: macro.label.toLocaleLowerCase(),
          percent,
        }),
        delta: percent,
      })
    }
  }

  // Rule 4: an unusually low intake late in the day merits a visible prompt.
  // It is intentionally phrased as an observation, not as a prescription.
  if (currentHour >= 18 && target.kcal > 0 && consumed.kcal / target.kcal < 0.4) {
    const percent = Math.round((consumed.kcal / target.kcal) * 100)
    alerts.push({
      code: 'daily_energy_deficit',
      severity: 'warning',
      title: ct(lang, 'smart.nutrition.alert.energyDeficit'),
      body: ct(lang, 'smart.nutrition.alert.energyDeficit.body', { percent }),
      delta: Math.round(target.kcal - consumed.kcal),
    })
  }

  // Rule 5: hydration_low (warning) — after 14h, <50% of target
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

  // Rule 6: lunch_missing (info) — between 13-14h, no lunch log
  if (currentHour >= 13 && currentHour < 15 && !hasLunchLog) {
    alerts.push({
      code: 'lunch_missing',
      severity: 'info',
      title: ct(lang, 'smart.nutrition.alert.lunchMissing'),
    })
  }

  return alerts
}
