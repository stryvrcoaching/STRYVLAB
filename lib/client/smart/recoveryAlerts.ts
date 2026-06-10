export type RecoveryAlertType =
  | 'low_energy'
  | 'high_stress'
  | 'poor_sleep'
  | 'sleep_debt'
  | 'recovery_ok'
  | 'optimal'

export type RecoveryAlertSeverity = 'critical' | 'warning' | 'info'

export type RecoveryAlert = {
  id: string
  type: RecoveryAlertType
  severity: RecoveryAlertSeverity
  title: string
  body: string
  recommendation: string
  color: string // hex
}

export type CheckinData = {
  sleep_duration?: number
  sleep_quality?: number
  energy?: number
  stress?: number
  mood?: number
}

export function computeRecoveryAlerts(
  morningCheckin: CheckinData | null,
  plannedSessionToday: boolean,
): RecoveryAlert[] {
  const alerts: RecoveryAlert[] = []

  if (!morningCheckin) {
    return alerts
  }

  const { sleep_duration, sleep_quality, energy, stress } = morningCheckin

  // Very low sleep duration — critical
  if (sleep_duration !== undefined && sleep_duration < 6 && plannedSessionToday) {
    alerts.push({
      id: 'sleep_debt',
      type: 'sleep_debt',
      severity: 'critical',
      title: 'Dette de sommeil',
      body: `${sleep_duration}h de sommeil seulement — récupération musculaire compromise.`,
      recommendation:
        'Envisage une séance légère (déload) ou du repos actif.',
      color: '#ef4444',
    })
  }

  // Poor sleep quality — warning
  if (sleep_quality !== undefined && sleep_quality <= 2 && plannedSessionToday) {
    alerts.push({
      id: 'poor_sleep_session',
      type: 'poor_sleep',
      severity: 'warning',
      title: 'Sommeil faible détecté',
      body: `Qualité de sommeil : ${sleep_quality}/5 — Les performances peuvent être réduites.`,
      recommendation: 'Réduis le volume de 10-15% ou déplace la séance si possible.',
      color: '#f59e0b',
    })
  }

  // High stress — warning
  if (stress !== undefined && stress >= 4 && plannedSessionToday) {
    alerts.push({
      id: 'high_stress',
      type: 'high_stress',
      severity: 'warning',
      title: 'Stress élevé',
      body: `Niveau de stress : ${stress}/5 — le cortisol peut réduire les adaptations.`,
      recommendation:
        'Priorise les exercices composés, évite l\'échec musculaire.',
      color: '#f59e0b',
    })
  }

  // Low energy — warning
  if (energy !== undefined && energy <= 2 && plannedSessionToday) {
    alerts.push({
      id: 'low_energy',
      type: 'low_energy',
      severity: 'warning',
      title: 'Énergie basse',
      body: `Niveau d'énergie : ${energy}/5 — séance potentiellement difficile.`,
      recommendation:
        'Échauffement prolongé, commence conservateur, écoute ton corps.',
      color: '#f59e0b',
    })
  }

  // Good recovery — info
  if (
    alerts.length === 0 &&
    sleep_quality !== undefined &&
    sleep_quality >= 4 &&
    energy !== undefined &&
    energy >= 4 &&
    plannedSessionToday
  ) {
    alerts.push({
      id: 'optimal_recovery',
      type: 'optimal',
      severity: 'info',
      title: 'Récupération optimale',
      body: 'Sommeil et énergie au top — conditions idéales pour performer.',
      recommendation:
        'Tu peux viser une surcharge progressive aujourd\'hui.',
      color: '#10b981',
    })
  }

  return alerts
}
