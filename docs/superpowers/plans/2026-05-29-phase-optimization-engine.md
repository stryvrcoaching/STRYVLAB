# Phase Optimization Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `computeOptimalPhase` + `TransformationPhaseWidget` with a full physiological steering engine (2-axis: energetic direction × adaptive state) and an animated 2D quadrant widget.

**Architecture:** `lib/coach/phaseEngine/` contains 4 pure modules: `types.ts` (contracts), `copy.ts` (all FR strings), `signals.ts` (raw data → DerivedSignals with reliability scoring), `engine.ts` (DerivedSignals → PhaseOptimizationResult with vectorial scoring). A new GET route feeds the new `PhaseOptimizationWidget` which replaces `TransformationPhaseWidget` on the coach profil page.

**Tech Stack:** TypeScript strict, Next.js App Router, Supabase service role, Vitest, Framer Motion, SVG

**Spec:** `docs/superpowers/specs/2026-05-29-phase-optimization-engine-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `lib/coach/phaseEngine/types.ts` | All types, no logic |
| Create | `lib/coach/phaseEngine/copy.ts` | All FR strings — REASON_MAP, MICRO_COPY_MAP |
| Create | `lib/coach/phaseEngine/signals.ts` | Raw → DerivedSignals, pure functions |
| Create | `lib/coach/phaseEngine/engine.ts` | DerivedSignals → PhaseOptimizationResult |
| Create | `tests/lib/phaseEngine/signals.test.ts` | Unit tests for signals |
| Create | `tests/lib/phaseEngine/engine.test.ts` | Unit tests for engine |
| Create | `app/api/clients/[clientId]/phase-optimization/route.ts` | GET route |
| Create | `components/coach/PhaseOptimizationWidget.tsx` | 2D quadrant widget |
| Modify | `lib/coach/transformationScore.ts` | Remove computeOptimalPhase, PhaseRecommendation, GOAL_TO_PHASE, mapGoalToPhase, TransformationPhase, phaseRecommendation field |
| Modify | `tests/lib/transformationScore.test.ts` | Remove computeOptimalPhase + GOAL_TO_PHASE tests |
| Modify | `app/coach/clients/[clientId]/profil/page.tsx` | Swap TransformationPhaseWidget → PhaseOptimizationWidget |
| Delete | `components/coach/TransformationPhaseWidget.tsx` | Replaced |

---

## Task 1: Types

**Files:**
- Create: `lib/coach/phaseEngine/types.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// lib/coach/phaseEngine/types.ts

export type EnergeticDirection =
  | 'aggressive_deficit' | 'controlled_deficit'
  | 'maintenance'
  | 'controlled_surplus' | 'aggressive_surplus'

export type AdaptiveState =
  | 'recovery_crash'
  | 'systemic_fatigue'
  | 'high_fatigue'
  | 'stable'
  | 'recovered'
  | 'supercompensated'

export type OpportunityState =
  | 'anabolic_window'
  | 'peak_readiness'
  | 'diet_break_candidate'

export type ConstraintFlag =
  | 'low_energy_availability'
  | 'poor_adherence'
  | 'high_stress_load'
  | 'recovery_bottleneck'
  | 'possible_muscle_loss'
  | 'catabolic_risk'

export type RecommendationHorizon =
  | 'acute'
  | 'short_term'
  | 'mesocycle'

export type DataQuality = 'minimal' | 'limited' | 'good' | 'high'

export interface SignalValue {
  value: number
  observed: boolean
  confidence: number
  sourceReliability?: number
}

export interface RawSignalInput {
  weightSeries:   { date: string; value: number; source?: 'manual' | 'wearable'; capturedAt?: string }[]
  bodyFatSeries:  { date: string; value: number; source?: 'dexa' | 'bioimpedance' | 'manual'; capturedAt?: string }[]
  leanMassSeries: { date: string; value: number; capturedAt?: string }[]
  waistSeries:    { date: string; value: number; capturedAt?: string }[]
  checkin: {
    energy?: number | null
    sleep_quality?: number | null
    sleep_duration?: number | null
    stress?: number | null
    muscle_soreness?: number | null
    hunger?: number | null
    steps?: number | null
  }
  checkinResponseRate: number
  performance: {
    exercises: {
      completion_rate: number
      avg_rir: number | null
      overloads_last_4_weeks: number
      stagnation: boolean
      overreaching: boolean
    }[]
    global_overreaching: boolean
    sessionsCount: number
    weeklyFrequency: number
  }
  latestBodyFat: number | null
  gender: 'male' | 'female' | null
  windowDays: number
}

export interface DerivedSignals {
  weightTrend: SignalValue
  waistTrend: SignalValue | null
  performanceTrend: SignalValue
  recoveryTrend: SignalValue
  probableMuscleGain: SignalValue
  probableFatGain: SignalValue
  catabolicRisk: SignalValue
  anabolicPotential: SignalValue
  fatigueIndex: SignalValue
  recoveryCapacity: SignalValue
  physiologicalStressScore: number
  dataCoverage: number
  dataReliability: number
  dataQuality: DataQuality
}

export interface CoachPhasePreferences {
  prioritizePerformance: boolean
  aggressiveCutTolerance: number
  preferredBulkAggressiveness: number
}

export interface PhaseAlert {
  flag: ConstraintFlag
  message: string
  severity: 'low' | 'medium' | 'high'
}

export interface PhaseOptimizationResult {
  currentState: {
    direction: EnergeticDirection
    adaptiveState: AdaptiveState
    opportunityStates: OpportunityState[]
    directionScore: number
    adaptiveScore: number
    directionConfidence: number
    adaptiveConfidence: number
  }
  recommendedAdjustment: {
    direction: EnergeticDirection
    adaptiveState: AdaptiveState
    directionScore: number
    adaptiveScore: number
    urgency: 'low' | 'medium' | 'high'
    horizon: RecommendationHorizon
    recommendationConfidence: number
  }
  confidence: number
  constraintFlags: ConstraintFlag[]
  reasons: string[]
  microCopy: string
  alerts: PhaseAlert[]
  decisionTrace: {
    positiveFactors: string[]
    negativeFactors: string[]
    ignoredSignals: string[]
    conflictingSignals: string[]
    conflictSeverity: number
  }
  dataQuality: DataQuality
  insufficientData: boolean
  manualOverride?: {
    active: boolean
    direction?: EnergeticDirection
    adaptiveState?: AdaptiveState
    reason?: string
  }
  engineMetadata: {
    engineVersion: string
    evaluatedAt: string
  }
}
```

- [ ] **Step 2: Run tsc to verify types compile**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors (new file introduces no errors)

- [ ] **Step 3: Commit**

```bash
git add lib/coach/phaseEngine/types.ts
git commit -m "feat(phase-engine): add PhaseOptimizationEngine types"
```

---

## Task 2: Copy (FR strings)

**Files:**
- Create: `lib/coach/phaseEngine/copy.ts`

- [ ] **Step 1: Create copy.ts**

```typescript
// lib/coach/phaseEngine/copy.ts
import type { ConstraintFlag, EnergeticDirection, AdaptiveState, RecommendationHorizon } from './types'

export const REASON_MAP: Record<ConstraintFlag, string> = {
  recovery_bottleneck:      'Récupération insuffisante — réduire le déficit avant relance',
  catabolic_risk:           'Risque catabolique détecté — préserver la masse maigre en priorité',
  poor_adherence:           'Adhérence instable — consolider avant changement de phase',
  high_stress_load:         'Charge de stress élevée — maintenir la direction actuelle',
  possible_muscle_loss:     'Signal de perte musculaire — augmenter l\'apport protéique',
  low_energy_availability:  'Disponibilité énergétique insuffisante — risque hormonal',
}

export const URGENCY_LABELS: Record<'low' | 'medium' | 'high', string> = {
  low:    'Aucune urgence',
  medium: 'Ajustement recommandé',
  high:   'Action requise',
}

export const HORIZON_LABELS: Record<RecommendationHorizon, string> = {
  acute:      '1–3 jours',
  short_term: '1–2 semaines',
  mesocycle:  '4–8 semaines',
}

export const DIRECTION_LABELS: Record<EnergeticDirection, string> = {
  aggressive_deficit:  'Déficit agressif',
  controlled_deficit:  'Déficit contrôlé',
  maintenance:         'Maintenance',
  controlled_surplus:  'Surplus contrôlé',
  aggressive_surplus:  'Surplus agressif',
}

export const ADAPTIVE_STATE_LABELS: Record<AdaptiveState, string> = {
  recovery_crash:   'Surmenage critique',
  systemic_fatigue: 'Fatigue systémique',
  high_fatigue:     'Fatigue élevée',
  stable:           'Stable',
  recovered:        'Récupéré',
  supercompensated: 'Supercompensé',
}

export const DATA_QUALITY_LABELS: Record<string, string> = {
  minimal: 'Données minimales',
  limited: 'Données limitées',
  good:    'Données suffisantes',
  high:    'Données complètes',
}

// Builds 2–3 reason bullets from constraint flags + fallback signals
export function buildReasons(
  flags: ConstraintFlag[],
  directionScore: number,
  adaptiveScore: number,
): string[] {
  const reasons: string[] = flags.slice(0, 2).map(f => REASON_MAP[f])

  if (reasons.length === 0) {
    if (adaptiveScore < -0.4) {
      reasons.push('Fatigue accumulée détectée — surveiller les signaux de récupération')
    } else if (adaptiveScore > 0.3) {
      reasons.push('État de récupération optimal — fenêtre favorable pour progression')
    }
    if (directionScore < -0.3) {
      reasons.push('Direction déficitaire maintenue — adhérence et masse maigre à surveiller')
    } else if (directionScore > 0.3) {
      reasons.push('Direction de surplus maintenue — surveiller la qualité du gain')
    }
  }

  if (reasons.length === 0) {
    reasons.push('Profil stable — continuer la direction actuelle')
  }

  return reasons.slice(0, 3)
}

// Builds 1-sentence micro-copy for display under quadrant
export function buildMicroCopy(
  currentDirection: EnergeticDirection,
  recommendedDirection: EnergeticDirection,
  adaptiveState: AdaptiveState,
): string {
  if (adaptiveState === 'recovery_crash') {
    return 'Semaine de décharge recommandée avant de reprendre le déficit.'
  }
  if (adaptiveState === 'systemic_fatigue') {
    return 'Fatigue systémique — réduire l\'intensité avant tout changement de phase.'
  }
  if (currentDirection !== recommendedDirection) {
    const target = DIRECTION_LABELS[recommendedDirection].toLowerCase()
    return `Le système recommande un déplacement progressif vers ${target}.`
  }
  if (adaptiveState === 'supercompensated') {
    return 'Conditions optimales — fenêtre idéale pour initier une progression.'
  }
  if (adaptiveState === 'recovered') {
    return 'Récupération optimale — continuer sur la lancée actuelle.'
  }
  return 'Le moteur surveille l\'évolution — aucun ajustement urgent.'
}
```

- [ ] **Step 2: Run tsc**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add lib/coach/phaseEngine/copy.ts
git commit -m "feat(phase-engine): add copy.ts — all FR strings isolated"
```

---

## Task 3: signals.ts — body composition + behavior normalizers

**Files:**
- Create: `lib/coach/phaseEngine/signals.ts` (partial — body + behavior)
- Create: `tests/lib/phaseEngine/signals.test.ts` (partial)

- [ ] **Step 1: Write failing tests for body composition normalization**

```typescript
// tests/lib/phaseEngine/signals.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeBodyCompositionSignals, normalizeBehaviorSignals } from '@/lib/coach/phaseEngine/signals'
import type { RawSignalInput } from '@/lib/coach/phaseEngine/types'

const baseInput: RawSignalInput = {
  weightSeries: [],
  bodyFatSeries: [],
  leanMassSeries: [],
  waistSeries: [],
  checkin: {},
  checkinResponseRate: 0,
  performance: {
    exercises: [],
    global_overreaching: false,
    sessionsCount: 0,
    weeklyFrequency: 3,
  },
  latestBodyFat: null,
  gender: null,
  windowDays: 30,
}

describe('normalizeBodyCompositionSignals', () => {
  it('returns low confidence with < 2 weight points', () => {
    const result = normalizeBodyCompositionSignals({
      ...baseInput,
      weightSeries: [{ date: '2026-05-01', value: 80 }],
    })
    expect(result.weightTrend.confidence).toBeLessThan(0.4)
  })

  it('detects weight loss trend with sufficient points', () => {
    const result = normalizeBodyCompositionSignals({
      ...baseInput,
      weightSeries: [
        { date: '2026-04-01', value: 82 },
        { date: '2026-04-15', value: 81 },
        { date: '2026-05-01', value: 80 },
        { date: '2026-05-15', value: 79 },
      ],
    })
    expect(result.weightTrend.value).toBeLessThan(0)  // losing weight
    expect(result.weightTrend.confidence).toBeGreaterThan(0.5)
  })

  it('returns null waistTrend when no waist data', () => {
    const result = normalizeBodyCompositionSignals(baseInput)
    expect(result.waistTrend).toBeNull()
  })
})

describe('normalizeBehaviorSignals', () => {
  it('returns zero adherence with no data', () => {
    const result = normalizeBehaviorSignals(baseInput)
    expect(result.adherenceScore).toBe(0)
  })

  it('returns full adherence with 100% response rate and full sessions', () => {
    const result = normalizeBehaviorSignals({
      ...baseInput,
      checkinResponseRate: 100,
      performance: { ...baseInput.performance, sessionsCount: 12, weeklyFrequency: 3 },
    })
    expect(result.adherenceScore).toBeGreaterThan(0.85)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (functions not defined)**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run tests/lib/phaseEngine/signals.test.ts 2>&1 | tail -10
```

Expected: FAIL — `normalizeBodyCompositionSignals is not a function` or similar

- [ ] **Step 3: Implement normalizeBodyCompositionSignals + normalizeBehaviorSignals**

```typescript
// lib/coach/phaseEngine/signals.ts
import type { RawSignalInput, SignalValue, DerivedSignals, DataQuality } from './types'

const MIN_VIABLE_CONFIDENCE = 0.2
const SIGNAL_DECAY_HALF_LIFE_DAYS = 30

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v))
}

function daysSince(dateStr: string, now = new Date()): number {
  const d = new Date(dateStr)
  return Math.max(0, (now.getTime() - d.getTime()) / 86400000)
}

// Exponential decay weight: 1.0 at age=0, 0.5 at age=HALF_LIFE
function decayWeight(dateStr: string): number {
  const age = daysSince(dateStr)
  return Math.pow(0.5, age / SIGNAL_DECAY_HALF_LIFE_DAYS)
}

// Simple linear regression slope (y per unit x)
// Returns slope in units/day
function linearSlope(points: { x: number; y: number }[]): number {
  if (points.length < 2) return 0
  const n = points.length
  const mx = points.reduce((s, p) => s + p.x, 0) / n
  const my = points.reduce((s, p) => s + p.y, 0) / n
  const num = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0)
  const den = points.reduce((s, p) => s + (p.x - mx) ** 2, 0)
  return den === 0 ? 0 : num / den
}

// Coefficient of variation
function coeffOfVariation(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  if (mean === 0) return 0
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance) / Math.abs(mean)
}

// Remove outliers beyond 2.5 standard deviations
function removeOutliers(series: { date: string; value: number }[]): typeof series {
  if (series.length < 4) return series
  const vals = series.map(s => s.value)
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
  return series.filter(s => Math.abs(s.value - mean) <= 2.5 * std)
}

// Source reliability weights
const SOURCE_RELIABILITY: Record<string, number> = {
  dexa: 1.0,
  bioimpedance: 0.55,
  manual: 0.40,
  wearable: 0.45,
}

// ── Body Composition ─────────────────────────────────────────────────────────

export interface BodyCompNorm {
  weightTrend: SignalValue    // kg/week (negative = loss)
  waistTrend: SignalValue | null
  leanMassTrend: SignalValue  // kg/week
  bodyFatTrend: SignalValue   // % per week
}

export function normalizeBodyCompositionSignals(input: RawSignalInput): BodyCompNorm {
  const computeTrend = (
    rawSeries: { date: string; value: number; source?: string; capturedAt?: string }[],
    sourceKey?: string,
  ): SignalValue => {
    const series = removeOutliers(rawSeries)
    const n = series.length

    if (n < 2) {
      return { value: 0, observed: n > 0, confidence: n === 0 ? 0 : 0.2, sourceReliability: 0.4 }
    }

    const now = new Date()
    const t0 = new Date(series[0].date).getTime()
    const points = series.map(s => ({
      x: (new Date(s.date).getTime() - t0) / 86400000,
      y: s.value,
    }))

    const slopeDailyKg = linearSlope(points)
    const slopeWeekly = slopeDailyKg * 7

    // Confidence based on n, CoV, freshness
    const cov = coeffOfVariation(series.map(s => s.value))
    const freshness = Math.max(0, 1 - daysSince(series[series.length - 1].date) / 14)
    const nScore = clamp(n / 5)
    const covPenalty = cov > 0.2 ? 0.2 : 0
    const confidence = clamp(nScore * 0.5 + freshness * 0.3 + 0.2 - covPenalty)

    // Source reliability
    const sources = rawSeries.map(s => (s as any).source).filter(Boolean)
    const sourceRel = sources.length > 0
      ? sources.reduce((s: number, src: string) => s + (SOURCE_RELIABILITY[src] ?? 0.4), 0) / sources.length
      : 0.4

    return {
      value: slopeWeekly,
      observed: true,
      confidence,
      sourceReliability: sourceRel,
    }
  }

  return {
    weightTrend: computeTrend(input.weightSeries),
    waistTrend: input.waistSeries.length > 0 ? computeTrend(input.waistSeries) : null,
    leanMassTrend: computeTrend(input.leanMassSeries),
    bodyFatTrend: computeTrend(input.bodyFatSeries, 'source'),
  }
}

// ── Behavior ─────────────────────────────────────────────────────────────────

export interface BehaviorNorm {
  adherenceScore: number  // 0–1
  sessionCompletionRate: number  // 0–1
}

export function normalizeBehaviorSignals(input: RawSignalInput): BehaviorNorm {
  const checkinAdherence = clamp(input.checkinResponseRate / 100)
  const sessionRate = input.performance.weeklyFrequency > 0
    ? clamp(input.performance.sessionsCount / (input.performance.weeklyFrequency * (input.windowDays / 7)))
    : 0
  const adherenceScore = (checkinAdherence * 0.5 + sessionRate * 0.5)
  return { adherenceScore, sessionCompletionRate: sessionRate }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run tests/lib/phaseEngine/signals.test.ts 2>&1 | tail -15
```

Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/coach/phaseEngine/signals.ts tests/lib/phaseEngine/signals.test.ts
git commit -m "feat(phase-engine): signals body-comp + behavior normalizers + tests"
```

---

## Task 4: signals.ts — performance + recovery normalizers + buildDerivedSignals

**Files:**
- Modify: `lib/coach/phaseEngine/signals.ts` (add functions)
- Modify: `tests/lib/phaseEngine/signals.test.ts` (add tests)

- [ ] **Step 1: Write failing tests for performance + recovery + buildDerivedSignals**

Add to `tests/lib/phaseEngine/signals.test.ts`:

```typescript
import { normalizePerformanceSignals, normalizeRecoverySignals, buildDerivedSignals } from '@/lib/coach/phaseEngine/signals'

describe('normalizePerformanceSignals', () => {
  it('returns low performance with stagnating exercises', () => {
    const result = normalizePerformanceSignals({
      ...baseInput,
      performance: {
        ...baseInput.performance,
        sessionsCount: 4,
        exercises: [
          { completion_rate: 0.9, avg_rir: 3, overloads_last_4_weeks: 0, stagnation: true, overreaching: false },
          { completion_rate: 0.85, avg_rir: 3, overloads_last_4_weeks: 0, stagnation: true, overreaching: false },
        ],
      },
    })
    expect(result.performanceTrend.value).toBeLessThan(0)
  })

  it('returns high performance with progressive overload', () => {
    const result = normalizePerformanceSignals({
      ...baseInput,
      performance: {
        ...baseInput.performance,
        sessionsCount: 8,
        exercises: [
          { completion_rate: 0.95, avg_rir: 2, overloads_last_4_weeks: 3, stagnation: false, overreaching: false },
          { completion_rate: 0.90, avg_rir: 2, overloads_last_4_weeks: 2, stagnation: false, overreaching: false },
        ],
      },
    })
    expect(result.performanceTrend.value).toBeGreaterThan(0)
  })
})

describe('normalizeRecoverySignals', () => {
  it('returns poor recovery with high stress and soreness', () => {
    const result = normalizeRecoverySignals({
      ...baseInput,
      checkin: { energy: 1, sleep_quality: 2, sleep_duration: 5, stress: 5, muscle_soreness: 5 },
    })
    expect(result.recoveryScore).toBeLessThan(0.4)
  })

  it('returns good recovery with optimal signals', () => {
    const result = normalizeRecoverySignals({
      ...baseInput,
      checkin: { energy: 5, sleep_quality: 5, sleep_duration: 8, stress: 1, muscle_soreness: 1 },
    })
    expect(result.recoveryScore).toBeGreaterThan(0.75)
  })
})

describe('buildDerivedSignals', () => {
  it('returns minimal dataQuality with no data', () => {
    const result = buildDerivedSignals(baseInput)
    expect(result.dataQuality).toBe('minimal')
    expect(result.insufficientData ?? result.dataCoverage).toBeTruthy()
  })

  it('catabolicRisk increases when weight drops fast + fatigue high', () => {
    const result = buildDerivedSignals({
      ...baseInput,
      weightSeries: [
        { date: '2026-04-01', value: 85 },
        { date: '2026-04-08', value: 83.5 },
        { date: '2026-04-15', value: 82 },
        { date: '2026-04-22', value: 80.5 },
      ],
      checkin: { energy: 1, sleep_quality: 2, stress: 5, muscle_soreness: 5, sleep_duration: 5 },
      checkinResponseRate: 80,
    })
    expect(result.catabolicRisk.value).toBeGreaterThan(0.4)
  })

  it('anabolicPotential increases with good recovery + performance', () => {
    const result = buildDerivedSignals({
      ...baseInput,
      checkin: { energy: 5, sleep_quality: 5, sleep_duration: 8, stress: 1, muscle_soreness: 1 },
      checkinResponseRate: 100,
      performance: {
        exercises: [
          { completion_rate: 0.95, avg_rir: 2, overloads_last_4_weeks: 3, stagnation: false, overreaching: false },
        ],
        global_overreaching: false,
        sessionsCount: 12,
        weeklyFrequency: 3,
      },
    })
    expect(result.anabolicPotential.value).toBeGreaterThan(0.5)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run tests/lib/phaseEngine/signals.test.ts 2>&1 | tail -10
```

- [ ] **Step 3: Add performance + recovery normalizers + buildDerivedSignals to signals.ts**

Append to `lib/coach/phaseEngine/signals.ts`:

```typescript
// ── Performance ───────────────────────────────────────────────────────────────

export interface PerfNorm {
  performanceTrend: SignalValue  // -1 → +1
  overloadDensity: number        // 0–1
  stagnationRatio: number        // 0–1
}

export function normalizePerformanceSignals(input: RawSignalInput): PerfNorm {
  const exs = input.performance.exercises
  if (exs.length === 0) {
    return {
      performanceTrend: { value: 0, observed: false, confidence: 0 },
      overloadDensity: 0,
      stagnationRatio: 0,
    }
  }

  const avgCompletion = exs.reduce((s, e) => s + e.completion_rate, 0) / exs.length
  const avgRir = exs.filter(e => e.avg_rir !== null).map(e => e.avg_rir as number)
  const meanRir = avgRir.length > 0 ? avgRir.reduce((a, b) => a + b, 0) / avgRir.length : 3
  const totalOverloads = exs.reduce((s, e) => s + e.overloads_last_4_weeks, 0)
  const overloadDensity = clamp(totalOverloads / (exs.length * 4))  // 4 = max realistic overloads
  const stagnationRatio = exs.filter(e => e.stagnation).length / exs.length
  const overreachingFlag = input.performance.global_overreaching ? 0.3 : 0

  // Low RIR (1-2) = near failure = high intensity = good performance signal
  const rirScore = clamp(1 - meanRir / 6)

  const rawTrend =
    avgCompletion * 0.35 +
    overloadDensity * 0.30 +
    rirScore * 0.20 -
    stagnationRatio * 0.25 -
    overreachingFlag

  const trendNormalized = clamp(rawTrend * 2 - 1, -1, 1)  // 0–1 → -1→+1

  const n = input.performance.sessionsCount
  const confidence = clamp(n / 8) * 0.7 + 0.3  // min 0.3 confidence if any sessions

  return {
    performanceTrend: { value: trendNormalized, observed: true, confidence: clamp(confidence) },
    overloadDensity,
    stagnationRatio,
  }
}

// ── Recovery ──────────────────────────────────────────────────────────────────

export interface RecoveryNorm {
  recoveryScore: number   // 0–1 (higher = better)
  recoveryTrend: SignalValue
  sleepScore: number      // 0–1
  dataPoints: number
}

export function normalizeRecoverySignals(input: RawSignalInput): RecoveryNorm {
  const c = input.checkin
  let score = 0
  let weights = 0
  let dataPoints = 0

  const add = (raw: number | null | undefined, w: number, invert = false) => {
    if (raw == null) return
    const norm = invert ? clamp(1 - (raw - 1) / 4) : clamp((raw - 1) / 4)
    score += norm * w
    weights += w
    dataPoints++
  }

  add(c.energy, 1.5)
  add(c.stress, 1.2, true)           // high stress = bad recovery
  add(c.muscle_soreness, 0.8, true)  // high soreness = bad recovery
  add(c.sleep_quality, 1.0)
  if (c.sleep_duration != null) {
    const sleepNorm = clamp(c.sleep_duration / 9)
    score += sleepNorm * 1.0
    weights += 1.0
    dataPoints++
  }

  const recoveryScore = weights > 0 ? clamp(score / weights) : 0

  // Sleep score separately for metric card
  const sleepQNorm = c.sleep_quality != null ? clamp((c.sleep_quality - 1) / 4) : null
  const sleepDNorm = c.sleep_duration != null ? clamp(c.sleep_duration / 9) : null
  const sleepScore =
    sleepQNorm != null && sleepDNorm != null ? sleepQNorm * 0.6 + sleepDNorm * 0.4
    : sleepQNorm ?? sleepDNorm ?? 0

  // Trend: single window → use score as proxy (no time series for checkin averages)
  const confidence = clamp(dataPoints / 5)

  return {
    recoveryScore,
    recoveryTrend: { value: recoveryScore * 2 - 1, observed: dataPoints > 0, confidence },
    sleepScore,
    dataPoints,
  }
}

// ── Reliability scoring ───────────────────────────────────────────────────────

function computeSignalReliability(signal: SignalValue, freshnessScore: number): number {
  if (signal.confidence < MIN_VIABLE_CONFIDENCE) return 0
  return clamp(signal.confidence * 0.6 + freshnessScore * 0.2 + (signal.sourceReliability ?? 0.4) * 0.2)
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildDerivedSignals(input: RawSignalInput): DerivedSignals & { insufficientData: boolean } {
  const bodyComp = normalizeBodyCompositionSignals(input)
  const perf = normalizePerformanceSignals(input)
  const recovery = normalizeRecoverySignals(input)
  const behavior = normalizeBehaviorSignals(input)

  // Latest data freshness for body comp
  const latestWeight = input.weightSeries[input.weightSeries.length - 1]
  const weightFreshness = latestWeight ? clamp(1 - daysSince(latestWeight.date) / 14) : 0

  const reliabilityMap: Record<string, number> = {
    weightTrend:    computeSignalReliability(bodyComp.weightTrend, weightFreshness),
    leanMassTrend:  computeSignalReliability(bodyComp.leanMassTrend, weightFreshness),
    bodyFatTrend:   computeSignalReliability(bodyComp.bodyFatTrend, weightFreshness),
    performanceTrend: perf.performanceTrend.confidence,
    recoveryTrend:  recovery.recoveryTrend.confidence,
  }

  const signalValues = Object.values(reliabilityMap)
  const presentSignals = signalValues.filter(v => v > MIN_VIABLE_CONFIDENCE).length
  const dataCoverage = clamp(presentSignals / signalValues.length)
  const dataReliability = signalValues.length > 0
    ? signalValues.reduce((s, v) => s + v, 0) / signalValues.length
    : 0

  const dataQuality: DataQuality =
    dataCoverage < 0.30 ? 'minimal'
    : dataCoverage < 0.50 ? 'limited'
    : dataCoverage < 0.75 ? 'good'
    : 'high'

  // DerivedSignals computation
  const fatigueRaw = clamp(
    (1 - recovery.recoveryScore) * 0.6 +
    (input.performance.global_overreaching ? 1 : 0) * 0.4
  )
  const recoveryCapacityRaw = clamp(
    recovery.recoveryScore * 0.5 +
    behavior.adherenceScore * 0.3 +
    recovery.sleepScore * 0.2
  )

  // Weight loss too fast: > 1 kg/week is aggressive
  const weightLossTooFast = bodyComp.weightTrend.value < -1
    ? clamp(Math.abs(bodyComp.weightTrend.value + 1) / 2)
    : 0

  // Lean mass dropping
  const leanMassDropping = bodyComp.leanMassTrend.value < -0.2 ? 0.8 : 0

  const catabolicRiskRaw = clamp(
    weightLossTooFast * 0.3 +
    leanMassDropping * 0.4 +
    fatigueRaw * 0.3
  )

  const perfTrendNorm = clamp((perf.performanceTrend.value + 1) / 2)  // -1→+1 to 0→1
  const anabolicPotentialRaw = clamp(
    recoveryCapacityRaw * 0.4 +
    perfTrendNorm * 0.3 +
    behavior.adherenceScore * 0.3
  )

  const physiologicalStressScore = clamp(
    fatigueRaw * 0.35 +
    catabolicRiskRaw * 0.35 +
    (1 - recoveryCapacityRaw) * 0.30
  )

  const recoveryConf = recovery.recoveryTrend.confidence
  const perfConf = perf.performanceTrend.confidence
  const bodyConf = Math.max(bodyComp.weightTrend.confidence, bodyComp.leanMassTrend.confidence)

  const insufficientData = dataCoverage < 0.30

  return {
    weightTrend:     bodyComp.weightTrend,
    waistTrend:      bodyComp.waistTrend,
    performanceTrend: perf.performanceTrend,
    recoveryTrend:   recovery.recoveryTrend,

    probableMuscleGain: {
      value: clamp(anabolicPotentialRaw * 0.6 + (bodyComp.leanMassTrend.value > 0 ? 0.4 : 0)),
      observed: false,
      confidence: Math.min(perfConf, bodyConf),
    },
    probableFatGain: {
      value: clamp(bodyComp.bodyFatTrend.value > 0 ? bodyComp.bodyFatTrend.value * 10 : 0),
      observed: false,
      confidence: bodyComp.bodyFatTrend.confidence,
    },
    catabolicRisk: {
      value: catabolicRiskRaw,
      observed: false,
      confidence: Math.min(bodyConf, recoveryConf),
    },
    anabolicPotential: {
      value: anabolicPotentialRaw,
      observed: false,
      confidence: Math.min(recoveryConf, perfConf),
    },
    fatigueIndex: {
      value: fatigueRaw,
      observed: false,
      confidence: recoveryConf,
    },
    recoveryCapacity: {
      value: recoveryCapacityRaw,
      observed: false,
      confidence: recoveryConf,
    },

    physiologicalStressScore,
    dataCoverage,
    dataReliability,
    dataQuality,
    insufficientData,
  }
}
```

- [ ] **Step 4: Run all signals tests — expect PASS**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run tests/lib/phaseEngine/signals.test.ts 2>&1 | tail -15
```

Expected: all 9 tests PASS

- [ ] **Step 5: Run tsc**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/coach/phaseEngine/signals.ts tests/lib/phaseEngine/signals.test.ts
git commit -m "feat(phase-engine): complete signals.ts — all normalizers + buildDerivedSignals"
```

---

## Task 5: engine.ts

**Files:**
- Create: `lib/coach/phaseEngine/engine.ts`
- Create: `tests/lib/phaseEngine/engine.test.ts`

- [ ] **Step 1: Write failing engine tests**

```typescript
// tests/lib/phaseEngine/engine.test.ts
import { describe, it, expect } from 'vitest'
import { computePhaseOptimization } from '@/lib/coach/phaseEngine/engine'
import { buildDerivedSignals } from '@/lib/coach/phaseEngine/signals'
import type { RawSignalInput, DerivedSignals } from '@/lib/coach/phaseEngine/types'

// Minimal signals with no data
function minimalSignals(): DerivedSignals & { insufficientData: boolean } {
  return buildDerivedSignals({
    weightSeries: [], bodyFatSeries: [], leanMassSeries: [], waistSeries: [],
    checkin: {}, checkinResponseRate: 0,
    performance: { exercises: [], global_overreaching: false, sessionsCount: 0, weeklyFrequency: 3 },
    latestBodyFat: null, gender: null, windowDays: 30,
  })
}

// Good recovery, no body fat pressure
function goodRecoverySignals(): DerivedSignals & { insufficientData: boolean } {
  return buildDerivedSignals({
    weightSeries: [], bodyFatSeries: [], leanMassSeries: [], waistSeries: [],
    checkin: { energy: 5, sleep_quality: 5, sleep_duration: 8, stress: 1, muscle_soreness: 1 },
    checkinResponseRate: 100,
    performance: {
      exercises: [{ completion_rate: 0.95, avg_rir: 2, overloads_last_4_weeks: 3, stagnation: false, overreaching: false }],
      global_overreaching: false, sessionsCount: 12, weeklyFrequency: 3,
    },
    latestBodyFat: null, gender: null, windowDays: 30,
  })
}

// Critical fatigue
function crashSignals(): DerivedSignals & { insufficientData: boolean } {
  return buildDerivedSignals({
    weightSeries: [
      { date: '2026-04-01', value: 85 }, { date: '2026-04-08', value: 83 },
      { date: '2026-04-15', value: 81 }, { date: '2026-04-22', value: 79 },
    ],
    bodyFatSeries: [], leanMassSeries: [], waistSeries: [],
    checkin: { energy: 1, sleep_quality: 1, sleep_duration: 4, stress: 5, muscle_soreness: 5 },
    checkinResponseRate: 90,
    performance: {
      exercises: [{ completion_rate: 0.5, avg_rir: 0, overloads_last_4_weeks: 0, stagnation: true, overreaching: true }],
      global_overreaching: true, sessionsCount: 4, weeklyFrequency: 3,
    },
    latestBodyFat: null, gender: null, windowDays: 30,
  })
}

describe('computePhaseOptimization', () => {
  it('returns a valid result with minimal data', () => {
    const result = computePhaseOptimization(minimalSignals())
    expect(result.currentState.direction).toBeDefined()
    expect(result.currentState.adaptiveState).toBeDefined()
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(result.engineMetadata.engineVersion).toBe('v1')
  })

  it('detects recovery_crash with extreme fatigue signals', () => {
    const result = computePhaseOptimization(crashSignals())
    expect(result.currentState.adaptiveState).toBe('recovery_crash')
    expect(result.recommendedAdjustment.urgency).toBe('high')
    expect(result.recommendedAdjustment.horizon).toBe('acute')
  })

  it('detects positive adaptive state with excellent recovery', () => {
    const result = computePhaseOptimization(goodRecoverySignals())
    expect(['stable', 'recovered', 'supercompensated']).toContain(result.currentState.adaptiveState)
  })

  it('safety gate: aggressive_deficit blocked when dataQuality is minimal', () => {
    const signals = minimalSignals()
    // Force direction score toward aggressive deficit
    signals.catabolicRisk = { value: 0, observed: false, confidence: 0.5 }
    signals.anabolicPotential = { value: 0, observed: false, confidence: 0.5 }
    const result = computePhaseOptimization(signals)
    expect(result.recommendedAdjustment.direction).not.toBe('aggressive_deficit')
    expect(result.recommendedAdjustment.direction).not.toBe('aggressive_surplus')
  })

  it('catabolic force maintenance when catabolicRisk > 0.70', () => {
    const signals = goodRecoverySignals()
    signals.catabolicRisk = { value: 0.85, observed: false, confidence: 0.8 }
    const result = computePhaseOptimization(signals)
    const recDir = result.recommendedAdjustment.direction
    expect(['maintenance', 'controlled_deficit'].includes(recDir)).toBe(true)
  })

  it('returns non-empty reasons', () => {
    const result = computePhaseOptimization(goodRecoverySignals())
    expect(result.reasons.length).toBeGreaterThan(0)
    expect(result.microCopy.length).toBeGreaterThan(0)
  })

  it('decisionTrace has ignoredSignals when confidence below threshold', () => {
    const result = computePhaseOptimization(minimalSignals())
    expect(Array.isArray(result.decisionTrace.ignoredSignals)).toBe(true)
  })

  it('opportunityStates is an array', () => {
    const result = computePhaseOptimization(goodRecoverySignals())
    expect(Array.isArray(result.currentState.opportunityStates)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run tests/lib/phaseEngine/engine.test.ts 2>&1 | tail -10
```

- [ ] **Step 3: Implement engine.ts**

```typescript
// lib/coach/phaseEngine/engine.ts
import type {
  DerivedSignals, DataQuality, EnergeticDirection, AdaptiveState,
  OpportunityState, ConstraintFlag, RecommendationHorizon,
  CoachPhasePreferences, PhaseOptimizationResult, PhaseAlert,
} from './types'
import { buildReasons, buildMicroCopy } from './copy'

export const ENGINE_VERSION = 'v1'

export const ENGINE_THRESHOLDS_V1 = {
  MIN_VIABLE_CONFIDENCE: 0.2,
  AGGRESSIVE_DIRECTION_MIN_QUALITY: 'good' as DataQuality,
  RECOVERY_CRASH_STRESS_THRESHOLD: 0.85,
  CATABOLIC_FORCE_MAINTENANCE: 0.70,
  HYSTERESIS_BUFFER: 0.05,
  CONFLICT_SEVERITY_CONFIDENCE_CAP: 0.60,
} as const

export const ENGINE_THRESHOLDS = ENGINE_THRESHOLDS_V1

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v))
}

// ── Direction scoring ─────────────────────────────────────────────────────────

function scoreEnergeticDirection(
  s: DerivedSignals,
  latestBodyFat: number | null,
  gender: 'male' | 'female' | null,
  prefs?: CoachPhasePreferences,
): { score: number; confidence: number } {
  const ap = s.anabolicPotential
  const cr = s.catabolicRisk
  const pt = s.performanceTrend
  const rc = s.recoveryCapacity
  const wt = s.weightTrend

  // Ignore signals below min viable confidence
  const apW  = ap.confidence >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE ? 0.30 : 0
  const ptW  = pt.confidence >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE ? 0.25 : 0
  const crW  = cr.confidence >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE ? 0.20 : 0
  const lmW  = s.probableMuscleGain.confidence >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE ? 0.15 : 0
  const rcW  = rc.confidence >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE ? 0.10 : 0

  const totalW = apW + ptW + crW + lmW + rcW
  if (totalW === 0) return { score: 0, confidence: 0 }

  let score =
    ap.value * apW +
    pt.value * ptW +
    (1 - cr.value) * crW +
    s.probableMuscleGain.value * lmW +
    rc.value * rcW

  score = score / totalW  // normalize to 0–1
  score = score * 2 - 1   // 0–1 → -1→+1

  // Body fat adjustment
  if (latestBodyFat !== null && s.dataReliability > 0.4) {
    const leanCutoff = gender === 'female' ? 12 : 10
    const fatUpper   = gender === 'female' ? 28 : 20
    if (latestBodyFat < leanCutoff) score = clamp(score + 0.3, -1, 1)
    if (latestBodyFat > fatUpper)   score = clamp(score - 0.3, -1, 1)
  }

  // Coach preference adjustments
  if (prefs) {
    if (prefs.prioritizePerformance && pt.value > 0.3) score = clamp(score + 0.1, -1, 1)
    if (score < -0.2) score = clamp(score + (prefs.aggressiveCutTolerance - 0.5) * 0.2, -1, 1)
    if (score > 0.2)  score = clamp(score + (prefs.preferredBulkAggressiveness - 0.5) * 0.2, -1, 1)
  }

  const confidence = clamp(totalW * s.dataReliability)
  return { score, confidence }
}

function directionFromScore(score: number, quality: DataQuality): EnergeticDirection {
  const H = ENGINE_THRESHOLDS.HYSTERESIS_BUFFER
  // Safety gate: aggressive only if dataQuality >= 'good'
  const canAggressive = quality === 'good' || quality === 'high'

  if (score < -(0.60 - H) && canAggressive) return 'aggressive_deficit'
  if (score < -(0.20 - H)) return 'controlled_deficit'
  if (score < +(0.20 + H)) return 'maintenance'
  if (score < +(0.60 + H)) return 'controlled_surplus'
  return canAggressive ? 'aggressive_surplus' : 'controlled_surplus'
}

// ── Adaptive state scoring ────────────────────────────────────────────────────

function scoreAdaptiveState(s: DerivedSignals): { score: number; confidence: number } {
  const fi  = s.fatigueIndex
  const rc  = s.recoveryCapacity
  const pss = s.physiologicalStressScore

  // Safety gate override
  if (pss > ENGINE_THRESHOLDS.RECOVERY_CRASH_STRESS_THRESHOLD) {
    return { score: -1, confidence: 0.9 }
  }

  const fiW  = fi.confidence  >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE ? 0.40 : 0
  const pssW = 0.35
  const rcW  = rc.confidence  >= ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE ? 0.25 : 0

  const totalW = fiW + pssW + rcW
  if (totalW === 0) return { score: 0, confidence: 0 }

  // Score: fatigue/stress push negative, recovery pushes positive, centered on 0
  const score = clamp(
    (-fi.value * fiW - pss * pssW + (rc.value - 0.5) * rcW) / totalW,
    -1, 1
  )

  const confidence = clamp(totalW * s.dataReliability)
  return { score, confidence }
}

function adaptiveStateFromScore(score: number): AdaptiveState {
  const H = ENGINE_THRESHOLDS.HYSTERESIS_BUFFER
  if (score < -(0.75 - H)) return 'recovery_crash'
  if (score < -(0.45 - H)) return 'systemic_fatigue'
  if (score < -(0.15 - H)) return 'high_fatigue'
  if (score < +(0.15 + H)) return 'stable'
  if (score < +(0.45 + H)) return 'recovered'
  return 'supercompensated'
}

// ── Opportunity detection ─────────────────────────────────────────────────────

function detectOpportunities(
  s: DerivedSignals,
  direction: EnergeticDirection,
  adaptiveState: AdaptiveState,
): OpportunityState[] {
  const opportunities: OpportunityState[] = []

  if (
    (direction === 'controlled_surplus' || direction === 'aggressive_surplus') &&
    ['stable', 'recovered', 'supercompensated'].includes(adaptiveState) &&
    s.catabolicRisk.value < 0.2
  ) {
    opportunities.push('anabolic_window')
  }

  if (
    adaptiveState === 'supercompensated' &&
    s.performanceTrend.value > 0.6 &&
    s.fatigueIndex.value < 0.2
  ) {
    opportunities.push('peak_readiness')
  }

  if (
    (direction === 'controlled_deficit' || direction === 'aggressive_deficit') &&
    s.fatigueIndex.value > 0.65
  ) {
    opportunities.push('diet_break_candidate')
  }

  return opportunities
}

// ── Constraint detection ──────────────────────────────────────────────────────

function detectConstraints(s: DerivedSignals): ConstraintFlag[] {
  const flags: ConstraintFlag[] = []

  if (s.catabolicRisk.value > 0.5 && s.catabolicRisk.confidence > ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE)
    flags.push('catabolic_risk')
  if (s.fatigueIndex.value > 0.6 && s.recoveryCapacity.value < 0.4)
    flags.push('recovery_bottleneck')
  if (s.probableMuscleGain.value < 0.2 && s.catabolicRisk.value > 0.4)
    flags.push('possible_muscle_loss')
  // Infer poor adherence from low recoveryCapacity + low anabolicPotential
  if (s.anabolicPotential.value < 0.25 && s.recoveryCapacity.value < 0.3)
    flags.push('poor_adherence')
  if (s.physiologicalStressScore > 0.65)
    flags.push('high_stress_load')
  if (s.fatigueIndex.value > 0.7 && s.weightTrend.value < -1)
    flags.push('low_energy_availability')

  return flags
}

// ── Decision trace ────────────────────────────────────────────────────────────

function buildDecisionTrace(
  s: DerivedSignals,
  dirScore: number,
  adaptScore: number,
): PhaseOptimizationResult['decisionTrace'] {
  const positiveFactors: string[] = []
  const negativeFactors: string[] = []
  const ignoredSignals: string[] = []
  const conflictingSignals: string[] = []

  const signalMap: Array<{ key: string; signal: DerivedSignals[keyof DerivedSignals]; contribution: number }> = [
    { key: 'anabolicPotential', signal: s.anabolicPotential, contribution: (s.anabolicPotential as any).value * 0.30 },
    { key: 'performanceTrend',  signal: s.performanceTrend,  contribution: (s.performanceTrend as any).value * 0.25 },
    { key: 'catabolicRisk',     signal: s.catabolicRisk,     contribution: -(s.catabolicRisk as any).value * 0.20 },
    { key: 'fatigueIndex',      signal: s.fatigueIndex,      contribution: -(s.fatigueIndex as any).value * 0.40 },
    { key: 'recoveryCapacity',  signal: s.recoveryCapacity,  contribution: (s.recoveryCapacity as any).value * 0.25 },
  ]

  for (const { key, signal, contribution } of signalMap) {
    const sv = signal as { confidence?: number }
    if (typeof sv.confidence === 'number' && sv.confidence < ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE) {
      ignoredSignals.push(key)
      continue
    }
    if (contribution > 0.15) positiveFactors.push(key)
    else if (contribution < -0.15) negativeFactors.push(key)
  }

  // Detect conflicts: pairs where one pushes direction + and other pushes direction -
  if (
    s.anabolicPotential.confidence > 0.4 && s.anabolicPotential.value > 0.5 &&
    s.catabolicRisk.confidence > 0.4 && s.catabolicRisk.value > 0.5
  ) {
    conflictingSignals.push('anabolicPotential vs catabolicRisk')
  }

  const conflictSeverity = clamp(conflictingSignals.length / 3)

  return { positiveFactors, negativeFactors, ignoredSignals, conflictingSignals, conflictSeverity }
}

// ── Alerts ────────────────────────────────────────────────────────────────────

function buildAlerts(flags: ConstraintFlag[]): PhaseAlert[] {
  const ALERT_MESSAGES: Record<ConstraintFlag, { message: string; severity: PhaseAlert['severity'] }> = {
    catabolic_risk:           { message: 'Risque catabolique — préserver la masse maigre', severity: 'high' },
    recovery_bottleneck:      { message: 'Récupération insuffisante', severity: 'medium' },
    possible_muscle_loss:     { message: 'Signal de perte musculaire possible', severity: 'medium' },
    poor_adherence:           { message: 'Adhérence instable', severity: 'low' },
    high_stress_load:         { message: 'Charge de stress élevée', severity: 'medium' },
    low_energy_availability:  { message: 'Disponibilité énergétique insuffisante', severity: 'high' },
  }
  return flags.map(f => ({ flag: f, ...ALERT_MESSAGES[f] }))
}

// ── Main export ───────────────────────────────────────────────────────────────

interface ComputeContext {
  latestBodyFat?: number | null
  gender?: 'male' | 'female' | null
  prefs?: CoachPhasePreferences
}

export function computePhaseOptimization(
  signals: DerivedSignals & { insufficientData?: boolean },
  ctx: ComputeContext = {},
): PhaseOptimizationResult {
  const { latestBodyFat = null, gender = null, prefs } = ctx

  const dirResult   = scoreEnergeticDirection(signals, latestBodyFat, gender ?? null, prefs)
  const adaptResult = scoreAdaptiveState(signals)

  const currentDirection    = directionFromScore(dirResult.score, signals.dataQuality)
  const currentAdaptState   = adaptiveStateFromScore(adaptResult.score)
  const opportunities       = detectOpportunities(signals, currentDirection, currentAdaptState)
  const constraints         = detectConstraints(signals)
  const trace               = buildDecisionTrace(signals, dirResult.score, adaptResult.score)

  // Confidence global
  const conflictPenalty = trace.conflictSeverity > 0.5
    ? ENGINE_THRESHOLDS.CONFLICT_SEVERITY_CONFIDENCE_CAP
    : 1
  const confidence = clamp(
    (dirResult.confidence * 0.5 + adaptResult.confidence * 0.5) *
    signals.dataReliability *
    conflictPenalty
  )

  // Recommendation — may differ from current
  let recDirScore  = dirResult.score
  let recAdaptScore = adaptResult.score

  // If catabolicRisk too high → force toward maintenance
  if (signals.catabolicRisk.value > ENGINE_THRESHOLDS.CATABOLIC_FORCE_MAINTENANCE &&
      signals.catabolicRisk.confidence > ENGINE_THRESHOLDS.MIN_VIABLE_CONFIDENCE) {
    recDirScore = Math.max(recDirScore, -0.15)  // at least maintenance
  }

  const recDirection  = directionFromScore(recDirScore, signals.dataQuality)
  const recAdaptState = adaptiveStateFromScore(recAdaptScore)

  // Urgency and horizon
  let urgency: 'low' | 'medium' | 'high' = 'low'
  let horizon: RecommendationHorizon = 'mesocycle'

  if (currentAdaptState === 'recovery_crash') { urgency = 'high'; horizon = 'acute' }
  else if (currentAdaptState === 'systemic_fatigue' || opportunities.includes('diet_break_candidate')) {
    urgency = 'medium'; horizon = 'short_term'
  }
  else if (currentDirection !== recDirection) { urgency = 'medium'; horizon = 'mesocycle' }

  const recommendationConfidence = clamp(confidence * (1 - trace.conflictSeverity * 0.4))

  const reasons  = buildReasons(constraints, dirResult.score, adaptResult.score)
  const microCopy = buildMicroCopy(currentDirection, recDirection, currentAdaptState)

  return {
    currentState: {
      direction:         currentDirection,
      adaptiveState:     currentAdaptState,
      opportunityStates: opportunities,
      directionScore:    dirResult.score,
      adaptiveScore:     adaptResult.score,
      directionConfidence:  dirResult.confidence,
      adaptiveConfidence:   adaptResult.confidence,
    },
    recommendedAdjustment: {
      direction:    recDirection,
      adaptiveState: recAdaptState,
      directionScore:  recDirScore,
      adaptiveScore:   recAdaptScore,
      urgency,
      horizon,
      recommendationConfidence,
    },
    confidence,
    constraintFlags: constraints,
    reasons,
    microCopy,
    alerts: buildAlerts(constraints),
    decisionTrace: trace,
    dataQuality: signals.dataQuality,
    insufficientData: signals.insufficientData ?? signals.dataCoverage < 0.3,
    engineMetadata: {
      engineVersion: ENGINE_VERSION,
      evaluatedAt: new Date().toISOString(),
    },
  }
}
```

- [ ] **Step 4: Run engine tests — expect PASS**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run tests/lib/phaseEngine/engine.test.ts 2>&1 | tail -15
```

Expected: all 8 tests PASS

- [ ] **Step 5: Run tsc**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/coach/phaseEngine/engine.ts tests/lib/phaseEngine/engine.test.ts
git commit -m "feat(phase-engine): engine.ts — vectorial scoring, safety gates, full output"
```

---

## Task 6: API route

**Files:**
- Create: `app/api/clients/[clientId]/phase-optimization/route.ts`

- [ ] **Step 1: Create route**

```typescript
// app/api/clients/[clientId]/phase-optimization/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { buildDerivedSignals } from '@/lib/coach/phaseEngine/signals'
import { computePhaseOptimization } from '@/lib/coach/phaseEngine/engine'
import type { RawSignalInput } from '@/lib/coach/phaseEngine/types'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const querySchema = z.object({
  window: z.coerce.number().min(7).max(90).default(30),
})

type Params = { params: { clientId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  const { data: clientData } = await db
    .from('coach_clients')
    .select('id, training_goal, weekly_frequency, gender')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!clientData) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({ window: url.searchParams.get('window') ?? 30 })
  if (!parsed.success) return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  const windowDays = parsed.data.window

  const periodStart = new Date(Date.now() - windowDays * 86400000).toISOString()
  const periodStartDate = periodStart.slice(0, 10)

  const [checkinRes, sessionRes, progressionRes, metricsRes, configRes] = await Promise.all([
    db.from('client_daily_checkins')
      .select('date, flow_type, sleep_hours, sleep_quality, energy_level, stress_level, muscle_soreness')
      .eq('client_id', params.clientId)
      .gte('date', periodStartDate)
      .order('date', { ascending: true }),

    db.from('client_session_logs')
      .select('id, completed_at, client_set_logs(exercise_id, set_number, actual_reps, completed, rir_actual)')
      .eq('client_id', params.clientId)
      .not('completed_at', 'is', null)
      .gte('completed_at', periodStart),

    db.from('progression_events')
      .select('exercise_id, created_at, trigger_type')
      .eq('client_id', params.clientId)
      .gte('created_at', periodStart),

    db.from('assessment_submissions')
      .select('submitted_at, bilan_date, assessment_responses(field_key, value_number)')
      .eq('client_id', params.clientId)
      .eq('status', 'completed')
      .order('bilan_date', { ascending: true })
      .limit(20),

    db.from('daily_checkin_configs')
      .select('days_of_week')
      .eq('client_id', params.clientId)
      .eq('coach_id', user.id)
      .maybeSingle(),
  ])

  // ── Checkin ──────────────────────────────────────────────────────────────────
  const checkinRows = (checkinRes.data ?? []) as any[]
  const fieldSums: Record<string, { sum: number; count: number }> = {}
  const uniqueDays = new Set<string>()

  for (const r of checkinRows) {
    uniqueDays.add(r.date as string)
    const isMorning = r.flow_type === 'morning'
    const fields: Record<string, number | null> = {
      energy: r.energy_level,
      ...(isMorning
        ? { sleep_duration: r.sleep_hours, sleep_quality: r.sleep_quality }
        : { stress: r.stress_level, muscle_soreness: r.muscle_soreness }),
    }
    for (const [k, v] of Object.entries(fields)) {
      if (v == null) continue
      if (!fieldSums[k]) fieldSums[k] = { sum: 0, count: 0 }
      fieldSums[k].sum += Number(v)
      fieldSums[k].count += 1
    }
  }
  const fieldAverages: Record<string, number> = {}
  for (const [k, { sum, count }] of Object.entries(fieldSums)) {
    fieldAverages[k] = Math.round((sum / count) * 10) / 10
  }

  const daysOfWeek: number[] = configRes.data?.days_of_week ?? []
  let configuredDays = 0
  if (daysOfWeek.length > 0) {
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(Date.now() - i * 86400000)
      const jsDay = d.getDay()
      const day = jsDay === 0 ? 6 : jsDay - 1
      if (daysOfWeek.includes(day)) configuredDays++
    }
  }
  const checkinResponseRate = configuredDays > 0
    ? Math.round((uniqueDays.size / configuredDays) * 100)
    : 0

  // ── Performance ──────────────────────────────────────────────────────────────
  const sessionLogs = (sessionRes.data ?? []) as any[]
  const progressionEvents = (progressionRes.data ?? []) as any[]
  const exerciseMap = new Map<string, { completionRates: number[]; rirValues: number[] }>()

  for (const session of sessionLogs) {
    const sets = (session.client_set_logs ?? []) as any[]
    const exIds = Array.from(new Set<string>(sets.map((s: any) => s.exercise_id as string)))
    for (const exId of exIds) {
      const exSets = sets.filter((s: any) => s.exercise_id === exId)
      const rirValues = exSets.map((s: any) => s.rir_actual).filter((v: any): v is number => typeof v === 'number')
      if (!exerciseMap.has(exId)) exerciseMap.set(exId, { completionRates: [], rirValues: [] })
      const entry = exerciseMap.get(exId)!
      entry.completionRates.push(exSets.length > 0 ? exSets.filter((s: any) => s.completed).length / exSets.length : 0)
      entry.rirValues.push(...rirValues)
    }
  }

  const exercises = Array.from(exerciseMap.entries()).map(([exId, data]) => {
    const avgCompletion = data.completionRates.reduce((s, v) => s + v, 0) / data.completionRates.length
    const avgRir = data.rirValues.length > 0
      ? data.rirValues.reduce((s, v) => s + v, 0) / data.rirValues.length
      : null
    const overloads = progressionEvents.filter((ev: any) => ev.exercise_id === exId && ev.trigger_type === 'overload').length
    return {
      completion_rate: avgCompletion,
      avg_rir: avgRir,
      overloads_last_4_weeks: overloads,
      stagnation: overloads === 0 && data.completionRates.length >= 3,
      overreaching: data.completionRates.filter(r => r < 0.8).length >= 2,
    }
  })

  // ── Body data ─────────────────────────────────────────────────────────────────
  const submissions = (metricsRes.data ?? []) as any[]
  const weightSeries: RawSignalInput['weightSeries'] = []
  const bodyFatSeries: RawSignalInput['bodyFatSeries'] = []
  const leanMassSeries: RawSignalInput['leanMassSeries'] = []
  const waistSeries: RawSignalInput['waistSeries'] = []

  for (const sub of submissions) {
    const rawDate: string = sub.bilan_date ?? sub.submitted_at ?? ''
    const date = rawDate.split('T')[0]
    if (!date) continue
    const responses = (sub.assessment_responses ?? []) as { field_key: string; value_number: number | null }[]
    for (const r of responses) {
      if (r.value_number == null) continue
      if (r.field_key === 'weight_kg')     weightSeries.push({ date, value: r.value_number })
      if (r.field_key === 'body_fat_pct') bodyFatSeries.push({ date, value: r.value_number })
      if (r.field_key === 'lean_mass_kg') leanMassSeries.push({ date, value: r.value_number })
      if (r.field_key === 'waist_cm')     waistSeries.push({ date, value: r.value_number })
    }
  }

  const latestBodyFat = bodyFatSeries.length > 0 ? bodyFatSeries[bodyFatSeries.length - 1].value : null

  // ── Build input + compute ─────────────────────────────────────────────────────
  const rawInput: RawSignalInput = {
    weightSeries,
    bodyFatSeries,
    leanMassSeries,
    waistSeries,
    checkin: {
      energy: fieldAverages.energy ?? null,
      sleep_quality: fieldAverages.sleep_quality ?? null,
      sleep_duration: fieldAverages.sleep_duration ?? null,
      stress: fieldAverages.stress ?? null,
      muscle_soreness: fieldAverages.muscle_soreness ?? null,
    },
    checkinResponseRate,
    performance: {
      exercises,
      global_overreaching: exercises.filter(e => e.overreaching).length >= 2,
      sessionsCount: sessionLogs.length,
      weeklyFrequency: Number(clientData.weekly_frequency ?? 3),
    },
    latestBodyFat,
    gender: (clientData.gender === 'female' || clientData.gender === 'male') ? clientData.gender : null,
    windowDays,
  }

  const signals = buildDerivedSignals(rawInput)
  const result = computePhaseOptimization(signals, { latestBodyFat, gender: rawInput.gender })

  // ── Metric cards ───────────────────────────────────────────────────────────────
  const windowStart = periodStartDate
  const weightInWindow = weightSeries.filter(w => w.date >= windowStart)
  const avgWeight = weightInWindow.length > 0
    ? Math.round((weightInWindow.reduce((s, w) => s + w.value, 0) / weightInWindow.length) * 10) / 10
    : (weightSeries.length > 0 ? weightSeries[weightSeries.length - 1].value : null)

  const avgBodyFat = bodyFatSeries.length > 0
    ? Math.round((bodyFatSeries.reduce((s, b) => s + b.value, 0) / bodyFatSeries.length) * 10) / 10
    : null

  const c = rawInput.checkin
  const sleepQuality = c.sleep_quality
  const sleepDuration = c.sleep_duration
  const sleepScore = sleepQuality != null && sleepDuration != null
    ? Math.round(((sleepQuality / 5) * 0.6 + Math.min(sleepDuration / 8, 1) * 0.4) * 100)
    : sleepQuality != null ? Math.round((sleepQuality / 5) * 100) : null

  const avgPerformance = exercises.length > 0
    ? Math.round(exercises.reduce((s, e) => s + e.completion_rate, 0) / exercises.length * 100)
    : null

  return NextResponse.json({
    ...result,
    metricCards: {
      avgWeight,
      avgBodyFat,
      sleepScore,
      avgPerformance,
      sessionsCount: sessionLogs.length,
    },
  })
}
```

- [ ] **Step 2: Run tsc**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/api/clients/\[clientId\]/phase-optimization/route.ts
git commit -m "feat(phase-engine): GET /phase-optimization route"
```

---

## Task 7: PhaseOptimizationWidget

**Files:**
- Create: `components/coach/PhaseOptimizationWidget.tsx`

- [ ] **Step 1: Create widget**

```tsx
// components/coach/PhaseOptimizationWidget.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { DIRECTION_LABELS, ADAPTIVE_STATE_LABELS, DATA_QUALITY_LABELS, URGENCY_LABELS, HORIZON_LABELS } from '@/lib/coach/phaseEngine/copy'
import type { PhaseOptimizationResult, EnergeticDirection, AdaptiveState } from '@/lib/coach/phaseEngine/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetricCards {
  avgWeight: number | null
  avgBodyFat: number | null
  sleepScore: number | null
  avgPerformance: number | null
  sessionsCount: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const HYSTERESIS_BUFFER = 0.05

const STATE_COLORS: Record<AdaptiveState, string> = {
  recovery_crash:   '#c0392b',
  systemic_fatigue: '#b0650a',
  high_fatigue:     '#8a7a2a',
  stable:           'rgba(255,255,255,0.50)',
  recovered:        '#2a6a4a',
  supercompensated: '#1f8a65',
}

const URGENCY_COLORS: Record<string, string> = {
  low:    'rgba(255,255,255,0.30)',
  medium: '#b0650a',
  high:   '#c0392b',
}

const DATA_QUALITY_COLORS: Record<string, string> = {
  minimal: 'rgba(192,57,43,0.6)',
  limited: '#b0650a',
  good:    'rgba(255,255,255,0.6)',
  high:    '#1f8a65',
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

const SVG_W = 280
const SVG_H = 200
const PAD   = 28

function toSvgX(score: number): number {
  return PAD + ((score + 1) / 2) * (SVG_W - PAD * 2)
}
function toSvgY(score: number): number {
  // score 0 = center, -1 = bottom, +1 = top — but we want center = optimal
  // Invert: score +1 → top of SVG, -1 → bottom; center at SVG_H/2
  return SVG_H / 2 - (score * (SVG_H / 2 - PAD))
}

// ── Confidence dots ───────────────────────────────────────────────────────────

function ConfidenceDots({ confidence }: { confidence: number }) {
  const filled = Math.round(confidence * 5)
  return (
    <div className="flex gap-[3px] items-center">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="w-[5px] h-[5px] rounded-full"
          style={{ backgroundColor: i < filled ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.1)' }}
        />
      ))}
    </div>
  )
}

// ── Quadrant SVG ─────────────────────────────────────────────────────────────

function QuadrantSVG({ result }: { result: PhaseOptimizationResult }) {
  const { currentState: cs, recommendedAdjustment: ra } = result

  // Low-confidence compression: pull points toward center
  const isLowConfidence = result.dataQuality === 'minimal' || result.dataQuality === 'limited'
  const compress = isLowConfidence ? 0.4 : 1

  const cxCurrent = toSvgX(cs.directionScore * compress)
  const cyCurrent = toSvgY(cs.adaptiveScore * compress)
  const cxRec     = toSvgX(ra.directionScore * compress)
  const cyRec     = toSvgY(ra.adaptiveScore * compress)

  const dist = Math.sqrt((cxRec - cxCurrent) ** 2 + (cyRec - cyCurrent) ** 2)
  const showArrow = dist > 20

  // Arrow path: straight line with arrowhead
  const angle = Math.atan2(cyRec - cyCurrent, cxRec - cxCurrent)
  const arrowLen = 8
  const ax1 = cxRec - arrowLen * Math.cos(angle - Math.PI / 7)
  const ay1 = cyRec - arrowLen * Math.sin(angle - Math.PI / 7)
  const ax2 = cxRec - arrowLen * Math.cos(angle + Math.PI / 7)
  const ay2 = cyRec - arrowLen * Math.sin(angle + Math.PI / 7)

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      style={{ maxHeight: '200px' }}
    >
      <defs>
        <radialGradient id="quadOptimal" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <filter id="haloBlur">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      {/* Background gradient — optimal zone center */}
      <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="url(#quadOptimal)" />

      {/* Subtle optimal halo at center */}
      <ellipse
        cx={SVG_W / 2} cy={SVG_H / 2}
        rx={40} ry={28}
        fill="#1f8a65"
        opacity={0.06}
        filter="url(#haloBlur)"
      />

      {/* Axes */}
      <line x1={PAD} y1={SVG_H / 2} x2={SVG_W - PAD} y2={SVG_H / 2}
        stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      <line x1={SVG_W / 2} y1={PAD} x2={SVG_W / 2} y2={SVG_H - PAD}
        stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

      {/* X-axis labels */}
      <text x={PAD} y={SVG_H - 6} fontSize={8} fill="rgba(255,255,255,0.2)" textAnchor="middle">Déficit</text>
      <text x={SVG_W / 2} y={SVG_H - 6} fontSize={8} fill="rgba(255,255,255,0.2)" textAnchor="middle">Maintenance</text>
      <text x={SVG_W - PAD} y={SVG_H - 6} fontSize={8} fill="rgba(255,255,255,0.2)" textAnchor="middle">Surplus</text>

      {/* Y-axis labels */}
      <text x={8} y={PAD + 4} fontSize={8} fill="rgba(255,255,255,0.2)" textAnchor="start">↑ Supercompensé</text>
      <text x={8} y={SVG_H - PAD - 4} fontSize={8} fill="rgba(255,255,255,0.2)" textAnchor="start">↓ Fatigue</text>

      {/* Arrow between points (spring-inertia: slow target spring) */}
      {showArrow && (
        <motion.g
          animate={{ opacity: Math.min(1, dist / 80) }}
          transition={{ type: 'spring', stiffness: 40, damping: 30, mass: 2 }}
        >
          <motion.line
            x1={cxCurrent} y1={cyCurrent}
            animate={{ x2: cxRec, y2: cyRec }}
            transition={{ type: 'spring', stiffness: 40, damping: 30, mass: 2 }}
            stroke={URGENCY_COLORS[ra.urgency]}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.6}
          />
          <motion.path
            animate={{ d: `M ${cxRec} ${cyRec} L ${ax1} ${ay1} M ${cxRec} ${cyRec} L ${ax2} ${ay2}` }}
            transition={{ type: 'spring', stiffness: 40, damping: 30, mass: 2 }}
            stroke={URGENCY_COLORS[ra.urgency]}
            strokeWidth={1}
            fill="none"
            opacity={0.6}
          />
        </motion.g>
      )}

      {/* Recommended target point (slow spring — inertia) */}
      <motion.circle
        animate={{ cx: cxRec, cy: cyRec }}
        transition={{ type: 'spring', stiffness: 40, damping: 30, mass: 2 }}
        r={8}
        fill="none"
        stroke={URGENCY_COLORS[ra.urgency]}
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />

      {/* Current state point (faster spring) */}
      <motion.circle
        animate={{ cx: cxCurrent, cy: cyCurrent }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        r={7}
        fill={STATE_COLORS[cs.adaptiveState]}
      />
    </svg>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, unit }: { label: string; value: string | null; unit?: string }) {
  return (
    <div className="flex-1 rounded-xl bg-white/[0.02] border border-[0.3px] border-white/[0.06] px-3 py-2">
      <div className="text-[9px] text-white/30 uppercase tracking-[0.12em] font-mono mb-1">{label}</div>
      <div className="text-[13px] text-white font-mono tabular-nums">
        {value ?? '—'}
        {value && unit && <span className="text-[9px] text-white/40 ml-0.5">{unit}</span>}
      </div>
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────

export default function PhaseOptimizationWidget({ clientId }: { clientId: string }) {
  const [data, setData] = useState<(PhaseOptimizationResult & { metricCards: MetricCards }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [window, setWindowDays] = useState(30)
  const [traceOpen, setTraceOpen] = useState(false)

  // Hysteresis: stabilize displayed labels
  const dirLabelRef   = useRef<EnergeticDirection | null>(null)
  const adaptLabelRef = useRef<AdaptiveState | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/clients/${clientId}/phase-optimization?window=${window}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [clientId, window])

  // Hysteresis stabilization
  if (data) {
    const { directionScore, adaptiveScore, direction, adaptiveState } = data.currentState
    if (dirLabelRef.current === null ||
        Math.abs(directionScore - 0) > HYSTERESIS_BUFFER) {
      dirLabelRef.current = direction
    }
    if (adaptLabelRef.current === null ||
        Math.abs(adaptiveScore - 0) > HYSTERESIS_BUFFER) {
      adaptLabelRef.current = adaptiveState
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-[0.3px] border-white/[0.06] p-5 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-3 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 flex-1" />
        </div>
      </div>
    )
  }

  if (!data) return null

  const { currentState: cs, recommendedAdjustment: ra, decisionTrace: dt } = data
  const displayDirection   = dirLabelRef.current   ?? cs.direction
  const displayAdaptState  = adaptLabelRef.current ?? cs.adaptiveState
  const mc = data.metricCards

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-[0.3px] border-white/[0.06] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-white/30 uppercase tracking-[0.14em] font-mono">
          Optimisation de phase
        </span>
        <div className="flex items-center gap-2">
          <select
            value={window}
            onChange={e => setWindowDays(Number(e.target.value))}
            className="text-[10px] text-white/40 bg-transparent border border-white/[0.06] rounded-lg px-2 py-0.5 outline-none"
          >
            <option value={7}>7j</option>
            <option value={30}>30j</option>
          </select>
          <div className="flex items-center gap-1">
            <div className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: DATA_QUALITY_COLORS[data.dataQuality] }} />
            <span className="text-[9px]" style={{ color: DATA_QUALITY_COLORS[data.dataQuality] }}>
              {DATA_QUALITY_LABELS[data.dataQuality]}
            </span>
          </div>
        </div>
      </div>

      {/* Direction + adaptive state labels */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[9px] text-white/30 uppercase tracking-[0.10em] mb-1">Direction énergétique</div>
          <div className="text-[13px] text-white">{DIRECTION_LABELS[displayDirection]}</div>
          <ConfidenceDots confidence={cs.directionConfidence} />
        </div>
        <div>
          <div className="text-[9px] text-white/30 uppercase tracking-[0.10em] mb-1">État adaptatif</div>
          <div className="text-[13px]" style={{ color: STATE_COLORS[displayAdaptState] }}>
            {ADAPTIVE_STATE_LABELS[displayAdaptState]}
          </div>
          <ConfidenceDots confidence={cs.adaptiveConfidence} />
        </div>
      </div>

      {/* Quadrant */}
      <QuadrantSVG result={data} />

      {/* Legend */}
      <div className="flex items-center gap-4 text-[9px] text-white/30">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-white/40" /> État actuel
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full border border-white/30" style={{ borderStyle: 'dashed' }} /> Recommandation
        </span>
      </div>

      {/* Micro-copy */}
      <p className="text-[11px] text-white/50 leading-relaxed">{data.microCopy}</p>

      {/* Urgency + horizon badges */}
      <div className="flex items-center gap-2">
        <span
          className="text-[9px] rounded-lg px-2 py-0.5 border border-[0.3px]"
          style={{
            color: URGENCY_COLORS[ra.urgency],
            borderColor: URGENCY_COLORS[ra.urgency] + '40',
            backgroundColor: URGENCY_COLORS[ra.urgency] + '15',
          }}
        >
          {URGENCY_LABELS[ra.urgency]}
        </span>
        <span className="text-[9px] text-white/30 rounded-lg px-2 py-0.5 border border-[0.3px] border-white/[0.06] bg-white/[0.02]">
          {HORIZON_LABELS[ra.horizon]}
        </span>
      </div>

      {/* Constraint pills */}
      {data.constraintFlags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.constraintFlags.slice(0, 3).map(flag => (
            <span
              key={flag}
              className="text-[9px] text-white/50 rounded-lg px-2 py-0.5 bg-white/[0.04] border border-[0.3px] border-white/[0.06]"
            >
              {flag.replace(/_/g, ' ')}
            </span>
          ))}
          {data.constraintFlags.length > 3 && (
            <span className="text-[9px] text-white/30 px-1">+{data.constraintFlags.length - 3}</span>
          )}
        </div>
      )}

      {/* Opportunity badges */}
      <AnimatePresence>
        {cs.opportunityStates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex gap-1.5"
          >
            {cs.opportunityStates.map(op => (
              <span
                key={op}
                className="text-[9px] rounded-lg px-2 py-0.5"
                style={{ color: '#1f8a65', backgroundColor: 'rgba(31,138,101,0.15)', border: '0.3px solid rgba(31,138,101,0.30)' }}
              >
                {op.replace(/_/g, ' ')}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reasons */}
      {data.reasons.length > 0 && (
        <ul className="space-y-1">
          {data.reasons.map((r, i) => (
            <li key={i} className="text-[11px] text-white/40 flex gap-2">
              <span className="text-white/20 mt-0.5">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Decision trace (collapsible) */}
      <button
        onClick={() => setTraceOpen(v => !v)}
        className="flex items-center gap-1 text-[9px] text-white/20 hover:text-white/40 transition-colors"
      >
        {traceOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        Voir le raisonnement
      </button>
      <AnimatePresence>
        {traceOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 text-[10px] pl-2"
          >
            {dt.positiveFactors.length > 0 && (
              <div>
                <span className="text-white/20">Facteurs positifs : </span>
                <span style={{ color: 'rgba(31,138,101,0.7)' }}>{dt.positiveFactors.join(', ')}</span>
              </div>
            )}
            {dt.negativeFactors.length > 0 && (
              <div>
                <span className="text-white/20">Facteurs négatifs : </span>
                <span style={{ color: 'rgba(192,57,43,0.7)' }}>{dt.negativeFactors.join(', ')}</span>
              </div>
            )}
            {dt.ignoredSignals.length > 0 && (
              <div className="text-white/20">
                Signaux ignorés (fiabilité insuffisante) : {dt.ignoredSignals.join(', ')}
              </div>
            )}
            {dt.conflictingSignals.length > 0 && (
              <div className="text-white/20">
                Conflits ({Math.round(dt.conflictSeverity * 100)}%) : {dt.conflictingSignals.join(', ')}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metric cards */}
      <div className="flex gap-2 pt-1">
        <MetricCard label="Poids moy." value={mc.avgWeight?.toString() ?? null} unit="kg" />
        <MetricCard label="BF%" value={mc.avgBodyFat?.toString() ?? null} unit="%" />
        <MetricCard label="Sommeil" value={mc.sleepScore?.toString() ?? null} unit="/100" />
        <MetricCard label="Perf." value={mc.avgPerformance?.toString() ?? null} unit="%" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/coach/PhaseOptimizationWidget.tsx
git commit -m "feat(phase-engine): PhaseOptimizationWidget — 2D quadrant, micro-copy, decision trace"
```

---

## Task 8: Remove computeOptimalPhase from transformationScore.ts

**Files:**
- Modify: `lib/coach/transformationScore.ts`
- Modify: `tests/lib/transformationScore.test.ts`

- [ ] **Step 1: Remove from transformationScore.ts**

Open `lib/coach/transformationScore.ts`. Remove:
- Lines 7–21: `TransformationPhase` type, `PhaseRecommendation` interface
- Lines 370–389: `GOAL_TO_PHASE`, `mapGoalToPhase`
- Lines 386–534: entire `computeOptimalPhase` function
- Line 56: `phaseRecommendation: PhaseRecommendation` from `TransformationScoreResult`
- Lines 593–595: the `computeOptimalPhase(...)` call
- Line 608: `phaseRecommendation,` from the return object

After edits, the return in `computeTransformationScore` should look like:

```typescript
  return {
    score: Math.round(composite),
    label: getScoreLabel(Math.round(composite)),
    window: input.window,
    dimensions,
    alerts: generateAlerts(dimensions, input.checkin),
    weightsSource,
    insufficientData: insufficient.length > 0,
  }
```

- [ ] **Step 2: Run tsc — expect errors only for test file imports**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Fix tests/lib/transformationScore.test.ts**

Remove from the import:

```typescript
import {
  getScoreLabel,
  DEFAULT_WEIGHTS,
  computeTransformationScore,
  // REMOVE: computeOptimalPhase,
  // REMOVE: GOAL_TO_PHASE,
  type ComputeScoreInput,
  type DimensionWeights,
  type TransformationScoreResult,
} from '@/lib/coach/transformationScore'
```

Remove any `describe` blocks testing `computeOptimalPhase` or `GOAL_TO_PHASE`.

- [ ] **Step 4: Run all tests**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run tests/lib/transformationScore.test.ts tests/lib/phaseEngine/signals.test.ts tests/lib/phaseEngine/engine.test.ts 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 5: Run tsc — 0 errors**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit**

```bash
git add lib/coach/transformationScore.ts tests/lib/transformationScore.test.ts
git commit -m "refactor(transformation-score): remove computeOptimalPhase, phaseRecommendation, GOAL_TO_PHASE"
```

---

## Task 9: Wire profil page + delete old widget

**Files:**
- Modify: `app/coach/clients/[clientId]/profil/page.tsx`
- Delete: `components/coach/TransformationPhaseWidget.tsx`

- [ ] **Step 1: Update profil/page.tsx imports**

Replace:

```typescript
import TransformationPhaseWidget from "@/components/coach/TransformationPhaseWidget";
```

With:

```typescript
import PhaseOptimizationWidget from "@/components/coach/PhaseOptimizationWidget";
```

- [ ] **Step 2: Replace usage in JSX**

Find (line ~300):

```tsx
<TransformationPhaseWidget clientId={clientId} />
```

Replace with:

```tsx
<PhaseOptimizationWidget clientId={clientId} />
```

- [ ] **Step 3: Delete old widget**

```bash
rm /Users/user/Desktop/STRYVLAB/components/coach/TransformationPhaseWidget.tsx
```

- [ ] **Step 4: Run tsc — 0 errors**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [ ] **Step 5: Run all tests**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run tests/lib/phaseEngine/ tests/lib/transformationScore.test.ts 2>&1 | tail -20
```

Expected: all pass

- [ ] **Step 6: Final commit**

```bash
git add app/coach/clients/\[clientId\]/profil/page.tsx
git commit -m "feat(phase-engine): wire PhaseOptimizationWidget on profil page, remove TransformationPhaseWidget"
```

---

## Task 10: CHANGELOG + project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Update CHANGELOG.md**

Add under today's date at the top:

```
## 2026-05-29

FEATURE: Phase Optimization Engine — 2-axis physiological steering (energetic direction × adaptive state)
FEATURE: PhaseOptimizationWidget — 2D quadrant SVG, animated points, micro-copy, decision trace
REFACTOR: Remove computeOptimalPhase, GOAL_TO_PHASE, phaseRecommendation from transformationScore.ts
CHORE: Delete TransformationPhaseWidget.tsx
```

- [ ] **Step 2: Update project-state.md**

In the modules table, update:

```
| **Phase Optimization Engine** | ✅ 2-axis vectorial scoring, reliability layers, 2D quadrant widget | 2026-05-29 |
```

Add a new "Dernières avancées" section for 2026-05-29 Phase Optimization Engine covering: `lib/coach/phaseEngine/` (4 files), route, widget, removal of old system.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for Phase Optimization Engine"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| `types.ts` — all types incl. SignalValue.sourceReliability, engineMetadata, manualOverride | Task 1 |
| `copy.ts` — REASON_MAP, MICRO_COPY_MAP, all labels | Task 2 |
| `signals.ts` — all 4 normalizers + reliability + buildDerivedSignals | Tasks 3–4 |
| `engine.ts` — ENGINE_VERSION, thresholds versioned, all scorers, safety gates | Task 5 |
| Route GET — windowDays flexible, waistSeries from bilans | Task 6 |
| Widget — quadrant SVG, halo, slow target spring, low-confidence compression, micro-copy, decision trace, metric cards incl. BF% | Task 7 |
| Remove computeOptimalPhase + phaseRecommendation | Task 8 |
| Wire profil page, delete TransformationPhaseWidget | Task 9 |
| CHANGELOG + project-state | Task 10 |

**Type consistency check:** All tasks use identical type names — `PhaseOptimizationResult`, `DerivedSignals`, `RawSignalInput`, `EnergeticDirection`, `AdaptiveState`, `buildDerivedSignals`, `computePhaseOptimization`. `buildDerivedSignals` returns `DerivedSignals & { insufficientData: boolean }` throughout.

**No placeholders:** All code blocks are complete. All test assertions use real expected values.
