import type { OverlaySeriesPoint } from './types'

export type EventImpactDirection = 'up' | 'down' | 'stable' | 'insufficient'
export type EventImpactReliability = 'insufficient' | 'low' | 'medium' | 'high'

export interface EventImpactSeriesInput {
  key: string
  points: OverlaySeriesPoint[]
}

export interface EventImpactResult {
  key: string
  beforeCount: number
  afterCount: number
  beforeAverage: number | null
  afterAverage: number | null
  absoluteDelta: number | null
  relativeDelta: number | null
  balance: number
  direction: EventImpactDirection
  reliability: EventImpactReliability
  limitations: string[]
}

const DAY_MS = 86_400_000
const MIN_COMPARABLE_POINTS = 2

function parseDate(date: string) {
  const timestamp = Date.parse(`${date.slice(0, 10)}T00:00:00.000Z`)
  return Number.isFinite(timestamp) ? timestamp : null
}

function mean(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function reliabilityFor(beforeCount: number, afterCount: number): EventImpactReliability {
  const comparableCount = Math.min(beforeCount, afterCount)
  if (comparableCount < MIN_COMPARABLE_POINTS) return 'insufficient'
  if (comparableCount >= 7) return 'high'
  if (comparableCount >= 4) return 'medium'
  return 'low'
}

/**
 * Descriptive comparison around a dated event. The event day is deliberately
 * excluded so a same-day measurement cannot be attributed to either period.
 */
export function analyzeEventImpact(
  inputs: EventImpactSeriesInput[],
  eventDate: string,
  windowDays: 7 | 14 | 28,
): EventImpactResult[] {
  const eventTimestamp = parseDate(eventDate)
  if (eventTimestamp == null) return []

  const beforeStart = eventTimestamp - windowDays * DAY_MS
  const afterEnd = eventTimestamp + windowDays * DAY_MS

  return inputs.map((input) => {
    const byDate = new Map<string, { timestamp: number; value: number }>()
    for (const point of input.points) {
      const timestamp = parseDate(point.date)
      if (timestamp == null || !Number.isFinite(point.value)) continue
      byDate.set(point.date.slice(0, 10), { timestamp, value: point.value })
    }

    const beforeValues: number[] = []
    const afterValues: number[] = []
    for (const point of byDate.values()) {
      if (point.timestamp >= beforeStart && point.timestamp < eventTimestamp) {
        beforeValues.push(point.value)
      }
      if (point.timestamp > eventTimestamp && point.timestamp <= afterEnd) {
        afterValues.push(point.value)
      }
    }

    const beforeAverage = mean(beforeValues)
    const afterAverage = mean(afterValues)
    const reliability = reliabilityFor(beforeValues.length, afterValues.length)
    const balance = Math.min(beforeValues.length, afterValues.length) /
      Math.max(1, beforeValues.length, afterValues.length)
    const absoluteDelta = beforeAverage != null && afterAverage != null
      ? afterAverage - beforeAverage
      : null
    const relativeDelta = absoluteDelta != null && beforeAverage != null && Math.abs(beforeAverage) > 0.000001
      ? absoluteDelta / Math.abs(beforeAverage)
      : null

    let direction: EventImpactDirection = 'insufficient'
    if (reliability !== 'insufficient' && absoluteDelta != null) {
      const isStable = relativeDelta != null
        ? Math.abs(relativeDelta) < 0.02
        : Math.abs(absoluteDelta) < 0.000001
      direction = isStable ? 'stable' : absoluteDelta > 0 ? 'up' : 'down'
    }

    const limitations: string[] = []
    if (reliability === 'insufficient') {
      limitations.push('Au moins 2 mesures sont nécessaires avant et après l’événement.')
    }
    if (balance < 0.6 && reliability !== 'insufficient') {
      limitations.push('Le nombre de mesures diffère nettement entre les deux périodes.')
    }
    if (reliability === 'low') {
      limitations.push('Échantillon limité : 2 à 3 mesures comparables de chaque côté.')
    }

    return {
      key: input.key,
      beforeCount: beforeValues.length,
      afterCount: afterValues.length,
      beforeAverage,
      afterAverage,
      absoluteDelta,
      relativeDelta,
      balance,
      direction,
      reliability,
      limitations,
    }
  })
}
