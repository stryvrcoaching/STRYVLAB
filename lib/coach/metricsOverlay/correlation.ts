import type { OverlayMetricFamily, OverlaySeriesPoint } from './types'

export type CorrelationDirection = 'positive' | 'inverse' | 'neutral'
export type CorrelationReliability = 'low' | 'medium' | 'high'

export interface CorrelationSeriesInput {
  key: string
  family: OverlayMetricFamily
  points: OverlaySeriesPoint[]
}

export interface OverlayCorrelationResult {
  key: string
  leftKey: string
  rightKey: string
  coefficient: number
  direction: CorrelationDirection
  strength: number
  overlapCount: number
  coverage: number
  regularity: number
  reliability: CorrelationReliability
  reliabilityScore: number
  bestLagDays: number
  leadingKey: string | null
  followingKey: string | null
  crossFamily: boolean
  limitations: string[]
}

export interface CorrelationAnalysisOptions {
  maxLagDays?: number
  smoothingWindowDays?: number
  minOverlap?: number
}

interface PreparedPoint extends OverlaySeriesPoint {
  timestamp: number
}

interface Candidate {
  coefficient: number
  overlapCount: number
  coverage: number
  regularity: number
  reliabilityScore: number
  lagDays: number
  leadingKey: string | null
  followingKey: string | null
}

const DAY_MS = 86_400_000
const DEFAULT_OPTIONS: Required<CorrelationAnalysisOptions> = {
  maxLagDays: 7,
  smoothingWindowDays: 7,
  minOverlap: 5,
}

function parseDate(date: string) {
  const timestamp = Date.parse(`${date.slice(0, 10)}T00:00:00.000Z`)
  return Number.isFinite(timestamp) ? timestamp : null
}

function preparePoints(points: OverlaySeriesPoint[]) {
  const byDate = new Map<string, PreparedPoint>()

  for (const point of points) {
    const timestamp = parseDate(point.date)
    if (timestamp == null || !Number.isFinite(point.value)) continue
    const date = point.date.slice(0, 10)
    byDate.set(date, { date, value: point.value, timestamp })
  }

  return [...byDate.values()].sort((a, b) => a.timestamp - b.timestamp)
}

function pearson(left: number[], right: number[]) {
  if (left.length !== right.length || left.length < 3) return null

  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length
  let numerator = 0
  let leftVariance = 0
  let rightVariance = 0

  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean
    const rightDelta = right[index] - rightMean
    numerator += leftDelta * rightDelta
    leftVariance += leftDelta * leftDelta
    rightVariance += rightDelta * rightDelta
  }

  const denominator = Math.sqrt(leftVariance * rightVariance)
  if (denominator === 0) return null
  return Math.max(-1, Math.min(1, numerator / denominator))
}

function rollingMeanAt(
  points: PreparedPoint[],
  targetTimestamp: number,
  windowDays: number,
) {
  const earliestTimestamp = targetTimestamp - (windowDays - 1) * DAY_MS
  let sum = 0
  let count = 0

  for (const point of points) {
    if (point.timestamp > targetTimestamp) break
    if (point.timestamp < earliestTimestamp) continue
    sum += point.value
    count += 1
  }

  return count > 0 ? sum / count : null
}

function cadenceProfile(points: PreparedPoint[]) {
  if (points.length < 4) return { regularity: 0.35, coverage: 0.35 }

  const intervals = points.slice(1).map((point, index) =>
    Math.max(1, (point.timestamp - points[index].timestamp) / DAY_MS),
  )
  const sorted = [...intervals].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const median = sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
  const deviations = intervals.map((interval) => Math.abs(interval - median))
  const meanDeviation = deviations.reduce((sum, value) => sum + value, 0) / deviations.length

  const regularity = Math.max(0, Math.min(1, 1 - meanDeviation / Math.max(1, median * 1.5)))
  const spanDays = Math.max(0, (points[points.length - 1].timestamp - points[0].timestamp) / DAY_MS)
  const expectedPoints = Math.floor(spanDays / Math.max(1, median)) + 1
  const coverage = Math.max(0, Math.min(1, points.length / expectedPoints))

  return { regularity, coverage }
}

function reliabilityScore(overlapCount: number, coverage: number, regularity: number) {
  return Math.min(1, overlapCount / 20) * 0.5 + coverage * 0.3 + regularity * 0.2
}

function reliabilityLevel(score: number, overlapCount: number): CorrelationReliability {
  if (overlapCount >= 20 && score >= 0.8) return 'high'
  if (overlapCount >= 10 && score >= 0.58) return 'medium'
  return 'low'
}

function buildCandidate(
  leading: CorrelationSeriesInput,
  leadingPoints: PreparedPoint[],
  following: CorrelationSeriesInput,
  followingPoints: PreparedPoint[],
  lagDays: number,
  windowDays: number,
  minOverlap: number,
) {
  if (leadingPoints.length === 0 || followingPoints.length === 0) return null

  const leadingValues: number[] = []
  const followingValues: number[] = []
  const leadingStart = leadingPoints[0].timestamp
  const leadingEnd = leadingPoints[leadingPoints.length - 1].timestamp
  let eligibleCount = 0

  for (const anchor of followingPoints) {
    const targetTimestamp = anchor.timestamp - lagDays * DAY_MS
    if (targetTimestamp < leadingStart || targetTimestamp > leadingEnd) continue
    eligibleCount += 1

    const leadingValue = rollingMeanAt(leadingPoints, targetTimestamp, windowDays)
    const followingValue = rollingMeanAt(followingPoints, anchor.timestamp, windowDays)
    if (leadingValue == null || followingValue == null) continue
    leadingValues.push(leadingValue)
    followingValues.push(followingValue)
  }

  if (leadingValues.length < minOverlap || eligibleCount === 0) return null
  const coefficient = pearson(leadingValues, followingValues)
  if (coefficient == null) return null

  const leadingCadence = cadenceProfile(leadingPoints)
  const followingCadence = cadenceProfile(followingPoints)
  const coverage = Math.min(
    leadingValues.length / eligibleCount,
    leadingCadence.coverage,
    followingCadence.coverage,
  )
  const regularity = Math.min(leadingCadence.regularity, followingCadence.regularity)
  const score = reliabilityScore(leadingValues.length, coverage, regularity)

  return {
    coefficient,
    overlapCount: leadingValues.length,
    coverage,
    regularity,
    reliabilityScore: score,
    lagDays,
    leadingKey: lagDays > 0 ? leading.key : null,
    followingKey: lagDays > 0 ? following.key : null,
  } satisfies Candidate
}

function analyzePair(
  left: CorrelationSeriesInput,
  right: CorrelationSeriesInput,
  options: Required<CorrelationAnalysisOptions>,
) {
  const leftPoints = preparePoints(left.points)
  const rightPoints = preparePoints(right.points)
  if (leftPoints.length < options.minOverlap || rightPoints.length < options.minOverlap) {
    return null
  }

  const sparseFirst = leftPoints.length <= rightPoints.length
  const baseline = sparseFirst
    ? buildCandidate(right, rightPoints, left, leftPoints, 0, options.smoothingWindowDays, options.minOverlap)
    : buildCandidate(left, leftPoints, right, rightPoints, 0, options.smoothingWindowDays, options.minOverlap)
  if (!baseline) return null

  let best = baseline
  for (let lagDays = 1; lagDays <= options.maxLagDays; lagDays += 1) {
    const candidates = [
      buildCandidate(left, leftPoints, right, rightPoints, lagDays, options.smoothingWindowDays, options.minOverlap),
      buildCandidate(right, rightPoints, left, leftPoints, lagDays, options.smoothingWindowDays, options.minOverlap),
    ].filter((candidate): candidate is Candidate => candidate != null)

    for (const candidate of candidates) {
      const candidateRank = Math.abs(candidate.coefficient) * (0.65 + candidate.reliabilityScore * 0.35)
      const bestRank = Math.abs(best.coefficient) * (0.65 + best.reliabilityScore * 0.35)
      if (candidateRank >= bestRank + 0.08) best = candidate
    }
  }

  const absCoefficient = Math.abs(best.coefficient)
  const direction: CorrelationDirection = absCoefficient < 0.25
    ? 'neutral'
    : best.coefficient > 0
      ? 'positive'
      : 'inverse'
  const reliability = reliabilityLevel(best.reliabilityScore, best.overlapCount)
  const limitations: string[] = []

  if (best.overlapCount < 10) limitations.push('Échantillon limité : moins de 10 observations comparables.')
  if (best.coverage < 0.6) limitations.push('Couverture partielle sur la période sélectionnée.')
  if (best.regularity < 0.5) limitations.push('Rythme de mesure irrégulier entre les deux métriques.')
  if (best.lagDays > 0) limitations.push('Décalage exploratoire testé entre 0 et 7 jours.')

  return {
    key: `${left.key}:${right.key}`,
    leftKey: left.key,
    rightKey: right.key,
    coefficient: best.coefficient,
    direction,
    strength: Math.round(absCoefficient * 100),
    overlapCount: best.overlapCount,
    coverage: best.coverage,
    regularity: best.regularity,
    reliability,
    reliabilityScore: best.reliabilityScore,
    bestLagDays: best.lagDays,
    leadingKey: best.leadingKey,
    followingKey: best.followingKey,
    crossFamily: left.family !== right.family,
    limitations,
  } satisfies OverlayCorrelationResult
}

export function analyzeOverlayCorrelations(
  series: CorrelationSeriesInput[],
  analysisOptions: CorrelationAnalysisOptions = {},
) {
  const options = { ...DEFAULT_OPTIONS, ...analysisOptions }
  const results: OverlayCorrelationResult[] = []

  for (let leftIndex = 0; leftIndex < series.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < series.length; rightIndex += 1) {
      const result = analyzePair(series[leftIndex], series[rightIndex], options)
      if (result) results.push(result)
    }
  }

  return results.sort((left, right) => {
    if (left.crossFamily !== right.crossFamily) return left.crossFamily ? -1 : 1
    if (left.reliabilityScore !== right.reliabilityScore) {
      return right.reliabilityScore - left.reliabilityScore
    }
    return right.strength - left.strength
  })
}
