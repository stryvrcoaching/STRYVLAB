import type { DerivedSignals, PhaseCoachDecision, RawSignalInput } from './types'
import type { PhaseEngineLocale } from './localeCopy'

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v))
}

function pct(v: number): number {
  return Math.round(clamp(v) * 100)
}

function daysSince(dateStr: string, anchorDate: string): number | null {
  const date = new Date(`${dateStr}T12:00:00.000Z`).getTime()
  const anchor = new Date(`${anchorDate}T12:00:00.000Z`).getTime()
  if (Number.isNaN(date) || Number.isNaN(anchor)) return null
  return Math.max(0, (anchor - date) / 86400000)
}

function latestFreshness(
  series: { date: string }[],
  anchorDate: string,
  maxAgeDays: number,
): number {
  const latest = series.at(-1)
  if (!latest) return 0
  const age = daysSince(latest.date, anchorDate)
  if (age == null) return 0
  return clamp(1 - age / maxAgeDays)
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function sourceReliability(input: RawSignalInput): number {
  const explicit = [
    ...input.weightSeries,
    ...input.bodyFatSeries,
  ]
    .map((point) => point.source)
    .filter(Boolean)

  if (explicit.length === 0) return 0.45

  const scores = explicit.map((source) => {
    if (source === 'dexa') return 1
    if (source === 'bioimpedance') return 0.55
    if (source === 'wearable') return 0.45
    return 0.4
  })

  return average(scores)
}

function signalCoherence(signals: DerivedSignals): number {
  let penalty = 0

  if (
    signals.anabolicPotential.confidence > 0.35 &&
    signals.catabolicRisk.confidence > 0.35 &&
    signals.anabolicPotential.value > 0.55 &&
    signals.catabolicRisk.value > 0.55
  ) {
    penalty += 0.28
  }

  if (
    signals.performanceTrend.confidence > 0.35 &&
    signals.recoveryCapacity.confidence > 0.35 &&
    signals.performanceTrend.value > 0.35 &&
    signals.recoveryCapacity.value < 0.35
  ) {
    penalty += 0.18
  }

  if (
    signals.rhrDelta?.isCnsOverloaded &&
    signals.recoveryCapacity.confidence > 0.35 &&
    signals.recoveryCapacity.value > 0.7
  ) {
    penalty += 0.22
  }

  return clamp(1 - penalty)
}

export function buildPhaseConfidenceModel(
  signals: DerivedSignals,
  raw: RawSignalInput,
  locale: PhaseEngineLocale = 'fr',
): PhaseCoachDecision['confidenceModel'] {
  const anchorDate = raw.anchorDate ?? new Date().toISOString().slice(0, 10)
  const bodyFreshness = Math.max(
    latestFreshness(raw.weightSeries, anchorDate, 14),
    latestFreshness(raw.bodyFatSeries, anchorDate, 30),
    latestFreshness(raw.waistSeries, anchorDate, 30),
  )
  const checkinFreshness = raw.checkinResponseRate > 0 ? 1 : 0
  const rhrFreshness = latestFreshness(raw.rhrSeries, anchorDate, 7)
  const nutritionFreshness =
    raw.nutrition && raw.nutrition.adherence.loggedDays > 0 ? 1 : 0
  const freshness = average([bodyFreshness, checkinFreshness, rhrFreshness, nutritionFreshness])
  const rhrBaseline = clamp(raw.rhrSeries.length / 21)
  const adherence = clamp(raw.checkinResponseRate / 100)
  const nutritionCoverage =
    raw.nutrition && raw.nutrition.adherence.expectedDays > 0
      ? clamp(raw.nutrition.adherence.loggedDays / raw.nutrition.adherence.expectedDays)
      : 0
  const reliability = sourceReliability(raw)
  const coherence = signalCoherence(signals)

  const weightedScore =
    signals.dataCoverage * 0.20 +
    signals.dataReliability * 0.18 +
    freshness * 0.16 +
    reliability * 0.12 +
    coherence * 0.17 +
    adherence * 0.08 +
    rhrBaseline * 0.05 +
    nutritionCoverage * 0.04

  const scorePct = pct(weightedScore)
  const level: PhaseCoachDecision['confidenceModel']['level'] =
    scorePct >= 75 ? 'high' : scorePct >= 50 ? 'moderate' : 'low'

  const strengths = [
    signals.dataCoverage >= 0.75
      ? locale === 'en' ? 'Strong signal coverage' : 'Couverture de signaux solide'
      : null,
    coherence >= 0.8
      ? locale === 'en' ? 'Signals are coherent' : 'Signaux cohérents entre eux'
      : null,
    rhrBaseline >= 1
      ? locale === 'en' ? 'RHR baseline is mature' : 'Baseline RHR exploitable'
      : null,
    adherence >= 0.75
      ? locale === 'en' ? 'Check-in adherence is strong' : 'Adhérence check-in élevée'
      : null,
    nutritionCoverage >= 0.7
      ? locale === 'en' ? 'Nutrition logging is strong' : 'Logs nutrition solides'
      : null,
  ].filter((v): v is string => Boolean(v)).slice(0, 3)

  const limitations = [
    rhrBaseline < 1
      ? locale === 'en' ? 'RHR baseline still building' : 'Baseline RHR encore en construction'
      : null,
    signals.dataCoverage < 0.5
      ? locale === 'en' ? 'Limited signal coverage' : 'Couverture de signaux limitée'
      : null,
    freshness < 0.5
      ? locale === 'en' ? 'Some inputs are stale' : 'Certaines données manquent de fraîcheur'
      : null,
    reliability < 0.55
      ? locale === 'en' ? 'Body-composition source remains approximate' : 'Source composition corporelle approximative'
      : null,
    coherence < 0.75
      ? locale === 'en' ? 'Some signals conflict' : 'Certains signaux se contredisent'
      : null,
    raw.nutrition && nutritionCoverage < 0.4
      ? locale === 'en' ? 'Nutrition coverage remains partial' : 'Couverture nutrition encore partielle'
      : null,
  ].filter((v): v is string => Boolean(v)).slice(0, 3)

  return {
    scorePct,
    level,
    factors: {
      coveragePct: pct(signals.dataCoverage),
      freshnessPct: pct(freshness),
      sourceReliabilityPct: pct(reliability),
      coherencePct: pct(coherence),
      adherencePct: pct(adherence),
      rhrBaselinePct: pct(rhrBaseline),
    },
    strengths,
    limitations,
  }
}
