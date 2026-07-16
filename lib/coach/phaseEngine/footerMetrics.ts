import { ENGINE_THRESHOLDS } from './engine'
import type { PhaseEngineLocale } from './localeCopy'
import type { DerivedSignals, RawSignalInput, SignalValue } from './types'

export type FooterMetricZone = 'poor' | 'average' | 'optimal'

export interface FooterMetricCardPayload {
  value: string
  unit?: string
  zone: FooterMetricZone | null
  /** Remplace Faible/Moyen/Optimal quand le tag doit refléter un autre signal moteur. */
  zoneLabel?: string
  subtitle?: string
}

export interface PhaseFooterMetricCards {
  weight: FooterMetricCardPayload
  bodyFat: FooterMetricCardPayload
  sleep: FooterMetricCardPayload
  performance: FooterMetricCardPayload
  rhr: FooterMetricCardPayload
  windowDays: number
}

const SIGNAL_DECAY_HALF_LIFE_DAYS = 30

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v))
}

function daysSince(dateStr: string, now = new Date()): number {
  const d = new Date(dateStr)
  return Math.max(0, (now.getTime() - d.getTime()) / 86400000)
}

function decayWeight(dateStr: string, now = new Date()): number {
  const age = daysSince(dateStr, now)
  return Math.pow(0.5, age / SIGNAL_DECAY_HALF_LIFE_DAYS)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Moyenne pondérée (demi-vie 30j) — même principe que les tendances du moteur. */
export function computeDecayWeightedMean(
  series: { date: string; value: number }[],
  windowDays: number,
  now = new Date(),
): number | null {
  const windowStart = new Date(now.getTime() - windowDays * 86400000)
  const inWindow = series.filter(s => new Date(s.date) >= windowStart)
  if (inWindow.length === 0) return null

  let sumW = 0
  let sumV = 0
  for (const p of inWindow) {
    const w = decayWeight(p.date, now)
    sumW += w
    sumV += p.value * w
  }
  if (sumW === 0) return null
  return round1(sumV / sumW)
}

function signalViable(signal: SignalValue): boolean {
  return signal.observed && signal.confidence >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE
}

/** Signaux unipolaires 0–1 (recoveryCapacity, etc.). */
export function unipolarSignalToZone(signal: SignalValue): FooterMetricZone | null {
  if (!signalViable(signal)) return null
  const v = clamp(signal.value)
  if (v >= 0.65) return 'optimal'
  if (v >= 0.40) return 'average'
  return 'poor'
}

/** Signaux bipolaires −1…1 (performanceTrend, recoveryTrend). */
export function bipolarSignalToZone(signal: SignalValue): FooterMetricZone | null {
  if (!signalViable(signal)) return null
  return unipolarSignalToZone({ ...signal, value: clamp((signal.value + 1) / 2) })
}

/** Pente hebdo (kg/sem.) — alignée sur weightLossTooFast du moteur. */
export function weightTrendToZone(signal: SignalValue): FooterMetricZone | null {
  if (!signalViable(signal)) return null
  const slope = signal.value
  if (slope < -1) return 'poor'
  if (Math.abs(slope) <= 0.25) return 'optimal'
  if (slope > 0.5) return 'average'
  return 'average'
}

/** Pente hebdo BF% — tendance favorable si baisse modérée. */
export function bodyFatTrendToZone(signal: SignalValue): FooterMetricZone | null {
  if (!signalViable(signal)) return null
  const slope = signal.value
  if (slope <= -0.1) return 'optimal'
  if (slope >= 0.1) return 'poor'
  return 'average'
}

function smoothedTrendSubtitle(locale: PhaseEngineLocale, windowDays: number): string {
  if (locale === 'en') return `(Smoothed ${windowDays}d trend)`
  return `(Tendance lissée ${windowDays}j)`
}

function missingMetricSubtitle(
  locale: PhaseEngineLocale,
  metric: 'weight' | 'bodyFat',
  windowDays: number,
): string {
  if (locale === 'en') {
    return metric === 'weight'
      ? `No weight logged in the last ${windowDays} days`
      : `No body-fat measurement in the last ${windowDays} days`
  }
  return metric === 'weight'
    ? `Aucun poids saisi sur les ${windowDays} derniers jours`
    : `Aucune mesure BF sur les ${windowDays} derniers jours`
}

function defaultZoneLabel(zone: FooterMetricZone | null, locale: PhaseEngineLocale): string | undefined {
  if (!zone) return undefined
  const labels =
    locale === 'en'
      ? { poor: 'Low', average: 'Average', optimal: 'OPTIMAL' }
      : { poor: 'Faible', average: 'Moyen', optimal: 'Optimal' }
  return labels[zone]
}

function checkinImpliedZone(pct: number): FooterMetricZone {
  if (pct > 80) return 'optimal'
  if (pct >= 50) return 'average'
  return 'poor'
}

function emptyCard(): FooterMetricCardPayload {
  return { value: '—', zone: null }
}

export function buildPhaseFooterMetricCards(
  signals: DerivedSignals,
  raw: Pick<RawSignalInput, 'weightSeries' | 'bodyFatSeries' | 'windowDays'>,
  locale: PhaseEngineLocale,
  recoverySleepScore: number | null,
  now = new Date(),
): PhaseFooterMetricCards {
  const { windowDays } = raw
  const subtitle = smoothedTrendSubtitle(locale, windowDays)

  const smoothedWeight = computeDecayWeightedMean(raw.weightSeries, windowDays, now)
  const smoothedBodyFat = computeDecayWeightedMean(raw.bodyFatSeries, windowDays, now)

  const perfDisplay =
    signals.performanceTrend.observed && signals.performanceTrend.confidence > 0
      ? Math.round(clamp((signals.performanceTrend.value + 1) / 2) * 100)
      : null

  const sleepFromRecovery =
    signals.recoveryCapacity.observed && signals.recoveryCapacity.confidence > 0
      ? Math.round(clamp(signals.recoveryCapacity.value) * 100)
      : null

  let sleepZone =
    unipolarSignalToZone(signals.recoveryCapacity) ??
    (signals.recoveryCapacity.confidence >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE
      ? unipolarSignalToZone({ ...signals.recoveryCapacity, observed: true })
      : null)

  let sleepValue: string | null = null
  let sleepZoneLabel: string | undefined

  if (recoverySleepScore != null) {
    sleepValue = String(Math.round(recoverySleepScore))
    if (sleepZone == null) {
      sleepZone = checkinImpliedZone(recoverySleepScore)
    } else {
      const checkinZone = checkinImpliedZone(recoverySleepScore)
      const zoneRank = { poor: 0, average: 1, optimal: 2 }
      if (zoneRank[checkinZone] > zoneRank[sleepZone]) {
        sleepZoneLabel =
          locale === 'en' ? 'Insufficient recovery' : 'Récupération insuffisante'
      }
    }
  } else if (sleepFromRecovery != null) {
    sleepValue = String(sleepFromRecovery)
    if (sleepZone == null) {
      sleepZone = checkinImpliedZone(sleepFromRecovery)
    }
  }

  const perfZone = bipolarSignalToZone(signals.performanceTrend)

  const delta = signals.rhrDelta
  let rhrCard: FooterMetricCardPayload = emptyCard()
  if (delta && delta.currentRhr !== null) {
    const deviationVal = delta.deviationPercentage
    const devSign = deviationVal !== null && deviationVal > 0 ? '+' : ''
    const devStr = deviationVal !== null ? `${devSign}${deviationVal}%` : '—'
    const baseStr = delta.baselineRhr !== null ? `${delta.baselineRhr}` : '—'
    const rhrSubtitle = `Δ: ${devStr}`

    const zone: FooterMetricZone = delta.isCnsOverloaded ? 'poor' : 'optimal'
    const zoneLabel = delta.isCnsOverloaded
      ? (locale === 'en' ? 'Overload' : 'Surcharge')
      : (locale === 'en' ? 'Normal' : 'Normal')

    rhrCard = {
      value: String(delta.currentRhr),
      unit: 'bpm',
      zone,
      zoneLabel,
      subtitle: rhrSubtitle,
    }
  }

  return {
    windowDays,
    weight: smoothedWeight != null
      ? {
          value: smoothedWeight.toFixed(1),
          unit: 'kg',
          zone: weightTrendToZone(signals.weightTrend),
          zoneLabel: defaultZoneLabel(weightTrendToZone(signals.weightTrend), locale),
          subtitle,
        }
      : { ...emptyCard(), subtitle: missingMetricSubtitle(locale, 'weight', windowDays) },
    bodyFat: smoothedBodyFat != null
      ? {
          value: smoothedBodyFat.toFixed(1),
          unit: '%',
          zone: bodyFatTrendToZone(signals.bodyFatTrend),
          zoneLabel: defaultZoneLabel(bodyFatTrendToZone(signals.bodyFatTrend), locale),
          subtitle,
        }
      : { ...emptyCard(), subtitle: missingMetricSubtitle(locale, 'bodyFat', windowDays) },
    sleep: sleepValue != null
      ? {
          value: sleepValue,
          unit: '/100',
          zone: sleepZone,
          zoneLabel: zoneLabelPrefix(sleepZoneLabel, defaultZoneLabel(sleepZone, locale)),
        }
      : emptyCard(),
    performance: perfDisplay != null
      ? {
          value: String(perfDisplay),
          unit: '%',
          zone: perfZone,
          zoneLabel: defaultZoneLabel(perfZone, locale),
        }
      : emptyCard(),
    rhr: rhrCard,
  }
}

function zoneLabelPrefix(label1: string | undefined, label2: string | undefined): string | undefined {
  return label1 ?? label2
}
