// lib/morpho/evolution.ts
// Longitudinal comparison between two MorphoPro v2 analyses

import type {
  MorphoAnalysisResultV2,
  PosturalSyndrome,
  PatternVerdict,
  BiomechMovementPattern,
  Confidence,
} from './types'

// ─── Types publics ────────────────────────────────────────────────────────────

export type EvolutionTrend =
  | 'improved'
  | 'stable'
  | 'worsened'
  | 'new'
  | 'resolved'
  | 'inconclusive'

export type EvolutionSignificance = 'minor' | 'notable' | 'major'

export type EvolutionDelta = {
  metric: string
  zone: string
  previous: number | string | null
  current: number | string | null
  delta: number | null
  trend: EvolutionTrend
  significance: EvolutionSignificance
  note: string
}

export type EvolutionReport = {
  client_id: string
  previous_analysis_id: string
  current_analysis_id: string
  span_days: number
  overall_trend: 'improving' | 'stable' | 'worsening' | 'mixed'
  score_delta: number
  deltas: EvolutionDelta[]
  highlights: {
    biggest_improvement: EvolutionDelta | null
    biggest_regression: EvolutionDelta | null
    resolved_flags: string[]
    new_flags: string[]
  }
  pattern_verdict_changes: Array<{
    pattern: BiomechMovementPattern
    from: PatternVerdict['verdict']
    to: PatternVerdict['verdict']
  }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityToOrdinal(severity: PosturalSyndrome['severity']): number {
  if (severity === 'marked') return 3
  if (severity === 'moderate') return 2
  if (severity === 'mild') return 1
  return 0
}

function asymmetrySignificance(delta: number): EvolutionSignificance {
  const abs = Math.abs(delta)
  if (abs > 1.5) return 'major'
  if (abs >= 0.5) return 'notable'
  return 'minor'
}

function scoreSignificance(delta: number): EvolutionSignificance {
  const abs = Math.abs(delta)
  if (abs > 8) return 'major'
  if (abs >= 3) return 'notable'
  return 'minor'
}

function syndromeSignificance(prevOrd: number, currOrd: number): EvolutionSignificance {
  const diff = Math.abs(currOrd - prevOrd)
  if (diff >= 2 || (prevOrd > 0 && currOrd === 0) || (prevOrd === 0 && currOrd > 0)) return 'major'
  if (diff === 1) return 'notable'
  return 'minor'
}

// Returns null if either confidence is 'low' (inconclusive)
function confidenceGate(prevConf: Confidence | undefined, currConf: Confidence | undefined): boolean {
  return prevConf !== 'low' && currConf !== 'low'
}

function numericDelta(
  metric: string,
  zone: string,
  prev: number | null,
  curr: number | null,
  prevConf: Confidence | undefined,
  currConf: Confidence | undefined,
  higherIsBetter: boolean,
  sigFn: (d: number) => EvolutionSignificance,
  note: string,
  stableThreshold = 0.5
): EvolutionDelta {
  if (prev === null && curr === null) {
    return { metric, zone, previous: null, current: null, delta: null, trend: 'inconclusive', significance: 'minor', note }
  }

  if (!confidenceGate(prevConf, currConf)) {
    return { metric, zone, previous: prev, current: curr, delta: curr !== null && prev !== null ? curr - prev : null, trend: 'inconclusive', significance: 'minor', note: note + ' (confiance faible)' }
  }

  if (prev === null && curr !== null) {
    return { metric, zone, previous: null, current: curr, delta: null, trend: 'new', significance: 'notable', note }
  }
  if (prev !== null && curr === null) {
    return { metric, zone, previous: prev, current: null, delta: null, trend: 'resolved', significance: 'notable', note }
  }

  const d = curr! - prev!
  const sig = sigFn(d)
  let trend: EvolutionTrend

  if (Math.abs(d) < stableThreshold) {
    trend = 'stable'
  } else if ((d < 0) === higherIsBetter) {
    // d < 0 and higher is better → worsened; d > 0 and higher is better → improved
    trend = 'worsened'
  } else {
    trend = 'improved'
  }

  return { metric, zone, previous: prev, current: curr!, delta: d, trend, significance: sig, note }
}

// ─── Main compute function ────────────────────────────────────────────────────

export function computeEvolutionReport(
  clientId: string,
  previousId: string,
  currentId: string,
  previous: MorphoAnalysisResultV2,
  current: MorphoAnalysisResultV2
): EvolutionReport {
  const spanDays = Math.round(
    (new Date(current.meta.analyzed_at).getTime() - new Date(previous.meta.analyzed_at).getTime())
    / (1000 * 60 * 60 * 24)
  )

  const deltas: EvolutionDelta[] = []

  // ── Score global ──
  const scoreDelta = current.score - previous.score
  deltas.push({
    metric: 'score',
    zone: 'global',
    previous: previous.score,
    current: current.score,
    delta: scoreDelta,
    trend: Math.abs(scoreDelta) < 3 ? 'stable' : scoreDelta > 0 ? 'improved' : 'worsened',
    significance: scoreSignificance(scoreDelta),
    note: 'Score postural global (0-100)',
  })

  // ── Asymétries ──
  const asymFields: Array<{
    key: keyof typeof previous.asymmetries & keyof typeof current.asymmetries
    zone: string
    note: string
    lowerIsBetter: boolean
  }> = [
    { key: 'shoulder_imbalance_cm', zone: 'shoulders', note: 'Décalage épaules en cm', lowerIsBetter: true },
    { key: 'hip_imbalance_cm',      zone: 'pelvis',    note: 'Décalage hanches en cm', lowerIsBetter: true },
    { key: 'arm_diff_cm',           zone: 'arms',      note: 'Différence longueur bras en cm', lowerIsBetter: true },
    { key: 'leg_length_diff_cm',    zone: 'legs',      note: 'Différence longueur jambes en cm', lowerIsBetter: true },
    { key: 'pelvic_rotation_deg',   zone: 'pelvis',    note: 'Rotation pelvienne en degrés', lowerIsBetter: true },
  ]

  for (const { key, zone, note, lowerIsBetter } of asymFields) {
    const prev = previous.asymmetries[key] as number | null
    const curr = current.asymmetries[key] as number | null
    deltas.push(
      numericDelta(
        key, zone, prev, curr,
        previous.meta.overall_confidence,
        current.meta.overall_confidence,
        !lowerIsBetter,
        asymmetrySignificance,
        note
      )
    )
  }

  // ── Syndromes posturaux ──
  const syndromeNames: PosturalSyndrome['name'][] = ['upper_crossed', 'lower_crossed', 'layered']
  for (const name of syndromeNames) {
    const prevS = previous.biomech.postural_syndromes.find(s => s.name === name)
    const currS = current.biomech.postural_syndromes.find(s => s.name === name)
    const prevOrd = prevS?.present ? severityToOrdinal(prevS.severity) : 0
    const currOrd = currS?.present ? severityToOrdinal(currS.severity) : 0

    const notConfident = !confidenceGate(prevS?.confidence, currS?.confidence)
    const diff = currOrd - prevOrd

    let trend: EvolutionTrend = 'stable'
    if (notConfident) {
      trend = 'inconclusive'
    } else if (prevOrd > 0 && currOrd === 0) {
      trend = 'resolved'
    } else if (prevOrd === 0 && currOrd > 0) {
      trend = 'new'
    } else if (Math.abs(diff) < 1) {
      trend = 'stable'
    } else {
      trend = diff < 0 ? 'improved' : 'worsened'
    }

    deltas.push({
      metric: `${name}_severity`,
      zone: name === 'lower_crossed' ? 'pelvis' : 'shoulders',
      previous: prevOrd,
      current: currOrd,
      delta: diff,
      trend,
      significance: syndromeSignificance(prevOrd, currOrd),
      note: `Syndrome ${name.replace('_', ' ')} — 0=absent, 1=mild, 2=moderate, 3=marked`,
    })
  }

  // ── Segments (trunk_to_femur + arm_to_torso ratios) ──
  const ratioFields: Array<{
    key: keyof typeof previous.biomech.segments & keyof typeof current.biomech.segments
    note: string
    higherIsBetter: boolean
  }> = [
    { key: 'trunk_to_femur_ratio', note: 'Ratio tronc/fémur (>1 favorable squat)', higherIsBetter: true },
    { key: 'arm_to_torso_ratio',   note: 'Ratio bras/tronc (>1 favorable deadlift)', higherIsBetter: true },
  ]

  for (const { key, note, higherIsBetter } of ratioFields) {
    const prev = previous.biomech.segments[key] as number | null
    const curr = current.biomech.segments[key] as number | null
    deltas.push(
      numericDelta(
        key, 'segments', prev, curr,
        previous.meta.overall_confidence,
        current.meta.overall_confidence,
        higherIsBetter,
        d => Math.abs(d) > 0.08 ? 'notable' : 'minor',
        note,
        0.02  // ratios change by 0.02-0.10 between analyses; 0.5 would always show stable
      )
    )
  }

  // ── Pattern verdict changes ──
  const patternVerdictChanges: EvolutionReport['pattern_verdict_changes'] = []
  for (const currVerdict of current.biomech.pattern_verdicts) {
    const prevVerdict = previous.biomech.pattern_verdicts.find(pv => pv.pattern === currVerdict.pattern)
    if (prevVerdict && prevVerdict.verdict !== currVerdict.verdict) {
      patternVerdictChanges.push({
        pattern: currVerdict.pattern,
        from: prevVerdict.verdict,
        to: currVerdict.verdict,
      })
    }
  }

  // ── Flags resolved / appeared ──
  const prevFlagLabels = new Set(previous.flags.map(f => `${f.zone}:${f.severity}:${f.label}`))
  const currFlagLabels = new Set(current.flags.map(f => `${f.zone}:${f.severity}:${f.label}`))
  const resolvedFlags = Array.from(prevFlagLabels).filter(l => !currFlagLabels.has(l))
  const newFlags = Array.from(currFlagLabels).filter(l => !prevFlagLabels.has(l))

  // ── Overall trend ──
  const improved = deltas.filter(d => d.trend === 'improved' || d.trend === 'resolved').length
  const worsened = deltas.filter(d => d.trend === 'worsened' || d.trend === 'new').length
  const total = improved + worsened
  let overallTrend: EvolutionReport['overall_trend'] = 'stable'
  if (total > 0) {
    const ratio = improved / total
    if (ratio >= 0.7) overallTrend = 'improving'
    else if (ratio <= 0.3) overallTrend = 'worsening'
    else overallTrend = 'mixed'
  }

  // ── Highlights ──
  const significanceWeight = (d: EvolutionDelta) =>
    d.significance === 'major' ? 3 : d.significance === 'notable' ? 2 : 1

  const improvements = deltas
    .filter(d => d.trend === 'improved' || d.trend === 'resolved')
    .sort((a, b) => significanceWeight(b) - significanceWeight(a))

  const regressions = deltas
    .filter(d => d.trend === 'worsened' || d.trend === 'new')
    .sort((a, b) => significanceWeight(b) - significanceWeight(a))

  return {
    client_id: clientId,
    previous_analysis_id: previousId,
    current_analysis_id: currentId,
    span_days: spanDays,
    overall_trend: overallTrend,
    score_delta: scoreDelta,
    deltas,
    highlights: {
      biggest_improvement: improvements[0] ?? null,
      biggest_regression: regressions[0] ?? null,
      resolved_flags: resolvedFlags,
      new_flags: newFlags,
    },
    pattern_verdict_changes: patternVerdictChanges,
  }
}
