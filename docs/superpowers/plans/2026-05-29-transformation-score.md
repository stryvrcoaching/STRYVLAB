# Transformation Score Widget — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-width Transformation Score widget to the top of `/coach/clients/[clientId]/profil` — a composite 0–100 gauge score with alerts, fed by check-in, performance, and body data.

**Architecture:** Pure score calculation lib (`lib/coach/transformationScore.ts`) called by a new API route (`GET /api/clients/[clientId]/transformation-score`), rendered by a client component (`components/coach/TransformationScoreWidget.tsx`) inserted at the top of the profil page.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase service client, Framer Motion (SVG animation), Vitest (unit tests), DS v2.0 (`#121212` bg, `#1f8a65` accent)

**Spec:** `docs/superpowers/specs/2026-05-29-transformation-score-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260529_transformation_score.sql` | Add `score_weights_config JSONB` to `coach_clients` |
| Create | `lib/coach/transformationScore.ts` | Pure score logic — normalization, weighting, alerts, label |
| Create | `tests/lib/transformationScore.test.ts` | Unit tests for all lib functions |
| Create | `app/api/clients/[clientId]/transformation-score/route.ts` | API route — auth, DB queries, call lib, return result |
| Create | `components/coach/TransformationScoreWidget.tsx` | Full widget — gauge + pills + alerts + 7j/30j toggle |
| Modify | `app/coach/clients/[clientId]/profil/page.tsx` | Insert `<TransformationScoreWidget>` above the 2-col grid |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260529_transformation_score.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260529_transformation_score.sql
ALTER TABLE coach_clients
  ADD COLUMN IF NOT EXISTS score_weights_config JSONB DEFAULT NULL;

COMMENT ON COLUMN coach_clients.score_weights_config IS
  'Coach override for transformation score dimension weights. Shape: {"adherence":0.3,"recovery":0.25,"bodyProgress":0.3,"performance":0.15}. NULL = use training_goal defaults.';
```

- [ ] **Step 2: Apply migration manually**

Open Supabase Dashboard → SQL Editor → paste and run the migration. Verify with:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'coach_clients' AND column_name = 'score_weights_config';
```
Expected: one row, `data_type = jsonb`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260529_transformation_score.sql
git commit -m "schema: add score_weights_config JSONB to coach_clients"
```

---

## Task 2: Score Calculation Library (TDD)

**Files:**
- Create: `lib/coach/transformationScore.ts`
- Create: `tests/lib/transformationScore.test.ts`

### Step 1 — Write failing tests first

- [ ] **Write `tests/lib/transformationScore.test.ts`:**

```typescript
import { describe, it, expect } from 'vitest'
import {
  getScoreLabel,
  DEFAULT_WEIGHTS,
  computeTransformationScore,
  type ComputeScoreInput,
  type DimensionWeights,
} from '@/lib/coach/transformationScore'

// ── getScoreLabel ─────────────────────────────────────────────────────────────

describe('getScoreLabel', () => {
  it('returns "En difficulté" for scores 0–24', () => {
    expect(getScoreLabel(0)).toBe('En difficulté')
    expect(getScoreLabel(24)).toBe('En difficulté')
  })
  it('returns "En progression" for 25–49', () => {
    expect(getScoreLabel(25)).toBe('En progression')
    expect(getScoreLabel(49)).toBe('En progression')
  })
  it('returns "Sur la bonne voie" for 50–74', () => {
    expect(getScoreLabel(50)).toBe('Sur la bonne voie')
    expect(getScoreLabel(74)).toBe('Sur la bonne voie')
  })
  it('returns "Haute performance" for 75–89', () => {
    expect(getScoreLabel(75)).toBe('Haute performance')
    expect(getScoreLabel(89)).toBe('Haute performance')
  })
  it('returns "Potentiel maximal" for 90–100', () => {
    expect(getScoreLabel(90)).toBe('Potentiel maximal')
    expect(getScoreLabel(100)).toBe('Potentiel maximal')
  })
})

// ── DEFAULT_WEIGHTS ───────────────────────────────────────────────────────────

describe('DEFAULT_WEIGHTS', () => {
  const goals = ['fat_loss','hypertrophy','strength','recomp','maintenance','endurance','athletic'] as const
  it('every training_goal has weights that sum to 1.0', () => {
    for (const goal of goals) {
      const w = DEFAULT_WEIGHTS[goal]
      const sum = w.adherence + w.recovery + w.bodyProgress + w.performance
      expect(sum).toBeCloseTo(1.0, 5)
    }
  })
  it('covers all 7 training goals', () => {
    expect(goals.every(g => g in DEFAULT_WEIGHTS)).toBe(true)
  })
})

// ── computeTransformationScore — helpers ──────────────────────────────────────

function makeInput(overrides: Partial<ComputeScoreInput> = {}): ComputeScoreInput {
  return {
    trainingGoal: 'hypertrophy',
    window: 7,
    checkin: {
      field_averages: { energy: 4, sleep_quality: 4, sleep_duration: 7.5, stress: 2, muscle_soreness: 2 },
      response_rate: 90,
      configured_days_count: 7,
    },
    performance: {
      analysis: {
        exercises: [
          { completion_rate: 0.95, avg_rir: 1.5, overloads_last_4_weeks: 2, stagnation: false, overreaching: false },
          { completion_rate: 0.90, avg_rir: 2.0, overloads_last_4_weeks: 1, stagnation: false, overreaching: false },
        ],
        global_overreaching: false,
      },
      sessionsCount: 4,
      weeklyFrequency: 4,
    },
    bodyData: {
      weightSeries: [
        { date: '2026-05-01', value: 80 },
        { date: '2026-05-15', value: 80.5 },
        { date: '2026-05-29', value: 81 },
      ],
      bodyFatSeries: [],
      leanMassSeries: [],
      trainingGoal: 'hypertrophy',
    },
    weightsOverride: null,
    ...overrides,
  }
}

// ── computeTransformationScore — main ─────────────────────────────────────────

describe('computeTransformationScore', () => {
  it('returns score in 0–100 range', () => {
    const result = computeTransformationScore(makeInput())
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('returns weightsSource "default" when no override', () => {
    const result = computeTransformationScore(makeInput())
    expect(result.weightsSource).toBe('default')
  })

  it('returns weightsSource "coach_override" when override provided', () => {
    const override: DimensionWeights = { adherence: 0.4, recovery: 0.3, bodyProgress: 0.2, performance: 0.1 }
    const result = computeTransformationScore(makeInput({ weightsOverride: override }))
    expect(result.weightsSource).toBe('coach_override')
  })

  it('returns correct window in result', () => {
    expect(computeTransformationScore(makeInput({ window: 30 })).window).toBe(30)
    expect(computeTransformationScore(makeInput({ window: 7 })).window).toBe(7)
  })

  it('marks insufficientData when no check-ins (recovery dataPoints < 3)', () => {
    const input = makeInput({
      checkin: { field_averages: {}, response_rate: null, configured_days_count: 0 },
    })
    const result = computeTransformationScore(input)
    expect(result.insufficientData).toBe(true)
  })

  it('redistributes weights when a dimension has insufficient data', () => {
    const input = makeInput({
      bodyData: { weightSeries: [], bodyFatSeries: [], leanMassSeries: [], trainingGoal: 'hypertrophy' },
    })
    const result = computeTransformationScore(input)
    // bodyProgress should have weight 0 after redistribution
    expect(result.dimensions.bodyProgress.weight).toBe(0)
    // Remaining weights sum to ~1.0
    const { adherence, recovery, bodyProgress, performance } = result.dimensions
    const sum = adherence.weight + recovery.weight + bodyProgress.weight + performance.weight
    expect(sum).toBeCloseTo(1.0, 4)
  })

  it('fat_loss goal: rising weight trend scores poorly on body progress', () => {
    const input = makeInput({
      trainingGoal: 'fat_loss',
      bodyData: {
        weightSeries: [
          { date: '2026-05-01', value: 80 },
          { date: '2026-05-15', value: 81 },
          { date: '2026-05-29', value: 82 },
        ],
        bodyFatSeries: [],
        leanMassSeries: [],
        trainingGoal: 'fat_loss',
      },
    })
    const result = computeTransformationScore(input)
    expect(result.dimensions.bodyProgress.score).toBeLessThan(50)
  })

  it('fat_loss goal: falling weight trend scores well on body progress', () => {
    const input = makeInput({
      trainingGoal: 'fat_loss',
      bodyData: {
        weightSeries: [
          { date: '2026-05-01', value: 82 },
          { date: '2026-05-15', value: 81 },
          { date: '2026-05-29', value: 80 },
        ],
        bodyFatSeries: [],
        leanMassSeries: [],
        trainingGoal: 'fat_loss',
      },
    })
    const result = computeTransformationScore(input)
    expect(result.dimensions.bodyProgress.score).toBeGreaterThan(50)
  })

  it('generates high-severity alert for very low sleep duration', () => {
    const input = makeInput({
      checkin: {
        field_averages: { energy: 2, sleep_quality: 2, sleep_duration: 5.5, stress: 4, muscle_soreness: 4 },
        response_rate: 80,
        configured_days_count: 7,
      },
    })
    const result = computeTransformationScore(input)
    const recoveryAlert = result.alerts.find(a => a.dimension === 'recovery')
    expect(recoveryAlert).toBeDefined()
    expect(recoveryAlert?.severity).toBe('high')
  })

  it('returns empty alerts array for a perfect client', () => {
    const perfect = makeInput({
      checkin: {
        field_averages: { energy: 5, sleep_quality: 5, sleep_duration: 8, stress: 1, muscle_soreness: 1 },
        response_rate: 100,
        configured_days_count: 7,
      },
      performance: {
        analysis: {
          exercises: [
            { completion_rate: 1.0, avg_rir: 1, overloads_last_4_weeks: 3, stagnation: false, overreaching: false },
          ],
          global_overreaching: false,
        },
        sessionsCount: 4,
        weeklyFrequency: 4,
      },
    })
    const result = computeTransformationScore(perfect)
    expect(result.alerts.filter(a => a.severity === 'high').length).toBe(0)
  })

  it('alerts are sorted high → medium → low', () => {
    const result = computeTransformationScore(makeInput({
      checkin: {
        field_averages: { sleep_duration: 5, stress: 5, energy: 1 },
        response_rate: 20,
        configured_days_count: 7,
      },
      performance: {
        analysis: {
          exercises: [
            { completion_rate: 0.5, avg_rir: 4, overloads_last_4_weeks: 0, stagnation: true, overreaching: true },
          ],
          global_overreaching: true,
        },
        sessionsCount: 1,
        weeklyFrequency: 5,
      },
    }))
    const severityOrder = { high: 0, medium: 1, low: 2 }
    for (let i = 1; i < result.alerts.length; i++) {
      expect(severityOrder[result.alerts[i - 1].severity]).toBeLessThanOrEqual(
        severityOrder[result.alerts[i].severity]
      )
    }
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/lib/transformationScore.test.ts 2>&1 | head -20
```
Expected: `Cannot find module '@/lib/coach/transformationScore'`

### Step 3 — Implement the library

- [ ] **Create `lib/coach/transformationScore.ts`:**

```typescript
// ─── Types ────────────────────────────────────────────────────────────────────

export type TrainingGoal =
  | 'fat_loss' | 'hypertrophy' | 'strength' | 'recomp'
  | 'maintenance' | 'endurance' | 'athletic'

export interface DimensionWeights {
  adherence: number
  recovery: number
  bodyProgress: number
  performance: number
}

export interface DimensionResult {
  score: number       // 0–100
  weight: number      // effective weight after redistribution
  dataPoints: number
}

export interface BodyProgressResult extends DimensionResult {
  confidence: 'high' | 'low' | 'none'
}

export interface TransformationAlert {
  dimension: 'adherence' | 'recovery' | 'bodyProgress' | 'performance'
  message: string
  severity: 'low' | 'medium' | 'high'
}

export interface TransformationScoreResult {
  score: number
  label: string
  window: 7 | 30
  dimensions: {
    adherence: DimensionResult
    recovery: DimensionResult
    bodyProgress: BodyProgressResult
    performance: DimensionResult
  }
  alerts: TransformationAlert[]
  weightsSource: 'default' | 'coach_override'
  insufficientData: boolean
}

export interface CheckinSummaryInput {
  field_averages: {
    energy?: number | null
    sleep_duration?: number | null
    sleep_quality?: number | null
    stress?: number | null
    muscle_soreness?: number | null
  }
  response_rate: number | null  // 0–100
  configured_days_count: number
}

export interface PerformanceSummaryInput {
  analysis: {
    exercises: {
      completion_rate: number
      avg_rir: number | null
      overloads_last_4_weeks: number
      stagnation: boolean
      overreaching: boolean
    }[]
    global_overreaching: boolean
  }
  sessionsCount: number
  weeklyFrequency: number
}

export interface BodyDataInput {
  weightSeries: { date: string; value: number }[]
  bodyFatSeries: { date: string; value: number }[]
  leanMassSeries: { date: string; value: number }[]
  trainingGoal: TrainingGoal
}

export interface ComputeScoreInput {
  trainingGoal: TrainingGoal
  window: 7 | 30
  checkin: CheckinSummaryInput
  performance: PerformanceSummaryInput
  bodyData: BodyDataInput
  weightsOverride: DimensionWeights | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS: Record<TrainingGoal, DimensionWeights> = {
  fat_loss:    { adherence: 0.30, recovery: 0.25, bodyProgress: 0.30, performance: 0.15 },
  hypertrophy: { adherence: 0.25, recovery: 0.30, bodyProgress: 0.20, performance: 0.25 },
  strength:    { adherence: 0.25, recovery: 0.25, bodyProgress: 0.15, performance: 0.35 },
  recomp:      { adherence: 0.30, recovery: 0.25, bodyProgress: 0.25, performance: 0.20 },
  maintenance: { adherence: 0.35, recovery: 0.30, bodyProgress: 0.20, performance: 0.15 },
  endurance:   { adherence: 0.25, recovery: 0.35, bodyProgress: 0.10, performance: 0.30 },
  athletic:    { adherence: 0.25, recovery: 0.30, bodyProgress: 0.15, performance: 0.30 },
}

// ─── Label ────────────────────────────────────────────────────────────────────

export function getScoreLabel(score: number): string {
  if (score < 25) return 'En difficulté'
  if (score < 50) return 'En progression'
  if (score < 75) return 'Sur la bonne voie'
  if (score < 90) return 'Haute performance'
  return 'Potentiel maximal'
}

// ─── Weight redistribution ────────────────────────────────────────────────────

function redistributeWeights(
  weights: DimensionWeights,
  insufficient: (keyof DimensionWeights)[]
): DimensionWeights {
  if (insufficient.length === 0) return weights
  const excl = new Set(insufficient)
  const removedWeight = insufficient.reduce((s, k) => s + weights[k], 0)
  const remaining = 1 - removedWeight
  if (remaining <= 0) {
    // All dimensions insufficient — equal weight to all
    return { adherence: 0.25, recovery: 0.25, bodyProgress: 0.25, performance: 0.25 }
  }
  const result = { ...weights }
  for (const k of insufficient) result[k] = 0
  for (const k of Object.keys(weights) as (keyof DimensionWeights)[]) {
    if (!excl.has(k)) result[k] = weights[k] / remaining
  }
  return result
}

// ─── Recovery normalization ───────────────────────────────────────────────────

function normalizeRecovery(avgs: CheckinSummaryInput['field_averages']): { score: number; dataPoints: number } {
  const scores: number[] = []

  if (avgs.energy != null) scores.push((avgs.energy - 1) / 4)
  if (avgs.sleep_quality != null) scores.push((avgs.sleep_quality - 1) / 4)
  if (avgs.sleep_duration != null) {
    const h = avgs.sleep_duration
    let s: number
    if (h < 5) s = 0.1
    else if (h < 6) s = 0.2 + (h - 5) * 0.15
    else if (h < 7) s = 0.35 + (h - 6) * 0.3
    else if (h <= 9) s = 1.0
    else s = Math.max(0.6, 1.0 - (h - 9) * 0.2)
    scores.push(s)
  }
  if (avgs.stress != null) scores.push((5 - avgs.stress) / 4)
  if (avgs.muscle_soreness != null) scores.push((5 - avgs.muscle_soreness) / 4)

  if (scores.length === 0) return { score: 0, dataPoints: 0 }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return { score: Math.round(avg * 100), dataPoints: scores.length }
}

// ─── Adherence normalization ──────────────────────────────────────────────────

function normalizeAdherence(
  checkin: CheckinSummaryInput,
  sessionsCount: number,
  weeklyFrequency: number,
  windowDays: number
): { score: number; dataPoints: number } {
  const scores: number[] = []

  if (checkin.response_rate != null) {
    scores.push(checkin.response_rate / 100)
  }

  const targetSessions = weeklyFrequency * (windowDays / 7)
  if (targetSessions > 0) {
    scores.push(Math.min(sessionsCount / targetSessions, 1))
  }

  if (scores.length === 0) return { score: 0, dataPoints: 0 }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return { score: Math.round(avg * 100), dataPoints: scores.length }
}

// ─── Body progress normalization ──────────────────────────────────────────────

function linRegSlope(series: { date: string; value: number }[]): number {
  if (series.length < 2) return 0
  const n = series.length
  const ys = series.map(p => p.value)
  const xs = series.map((_, i) => i)
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumX2 = xs.reduce((s, x) => s + x * x, 0)
  const denom = n * sumX2 - sumX * sumX
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
}

type TrendDirection = 'down' | 'up' | 'stable'

const GOAL_WEIGHT_DIRECTION: Record<TrainingGoal, TrendDirection> = {
  fat_loss:    'down',
  hypertrophy: 'up',
  strength:    'up',
  recomp:      'stable',
  maintenance: 'stable',
  endurance:   'stable',
  athletic:    'stable',
}

function slopeToScore(slope: number, direction: TrendDirection): number {
  if (direction === 'down') {
    if (slope <= -0.5) return 1
    if (slope <= -0.2) return 0.8
    if (slope < 0)     return 0.6
    if (slope < 0.2)   return 0.4
    return Math.max(0, 0.4 - (slope - 0.2) * 0.5)
  }
  if (direction === 'up') {
    if (slope >= 0.5)  return 1
    if (slope >= 0.2)  return 0.8
    if (slope > 0)     return 0.6
    if (slope > -0.2)  return 0.4
    return Math.max(0, 0.4 + (slope + 0.2) * 0.5)
  }
  // stable
  return Math.max(0, 1 - Math.abs(slope) * 2)
}

type RawBodyResult = { score: number; dataPoints: number; confidence: 'high' | 'low' | 'none' }

function normalizeBodyProgress(data: BodyDataInput): RawBodyResult {
  const { weightSeries, bodyFatSeries, leanMassSeries, trainingGoal } = data

  if (weightSeries.length < 2) {
    return { score: 50, dataPoints: 0, confidence: 'none' }
  }

  const scores: number[] = []
  let confidence: 'high' | 'low' | 'none' = 'low'

  const weightSlope = linRegSlope(weightSeries)
  scores.push(slopeToScore(weightSlope, GOAL_WEIGHT_DIRECTION[trainingGoal]))

  if (bodyFatSeries.length >= 2) {
    confidence = 'high'
    scores.push(slopeToScore(linRegSlope(bodyFatSeries), 'down'))
  }
  if (leanMassSeries.length >= 2) {
    confidence = 'high'
    scores.push(slopeToScore(linRegSlope(leanMassSeries), 'up'))
  }

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return { score: Math.round(avg * 100), dataPoints: weightSeries.length, confidence }
}

// ─── Performance normalization ────────────────────────────────────────────────

function normalizePerformance(
  input: PerformanceSummaryInput
): { score: number; dataPoints: number } {
  const { analysis, sessionsCount } = input
  const exercises = analysis.exercises

  if (exercises.length === 0 || sessionsCount === 0) {
    return { score: 0, dataPoints: 0 }
  }

  const scores: number[] = []

  const avgCompletion = exercises.reduce((s, e) => s + e.completion_rate, 0) / exercises.length
  scores.push(avgCompletion)

  const rirValues = exercises.map(e => e.avg_rir).filter((v): v is number => v != null)
  if (rirValues.length > 0) {
    const avgRir = rirValues.reduce((s, v) => s + v, 0) / rirValues.length
    scores.push(Math.max(0, Math.min(1, 1 - avgRir / 5)))
  }

  const stagnantRatio = exercises.filter(e => e.stagnation).length / exercises.length
  scores.push(1 - stagnantRatio)

  if (analysis.global_overreaching) scores.push(0.3)

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return { score: Math.round(avg * 100), dataPoints: exercises.length }
}

// ─── Alert generation ─────────────────────────────────────────────────────────

function generateAlerts(
  dims: TransformationScoreResult['dimensions'],
  checkin: CheckinSummaryInput
): TransformationAlert[] {
  const alerts: TransformationAlert[] = []

  if (dims.adherence.score < 50 && dims.adherence.dataPoints > 0) {
    const rate = checkin.response_rate
    if (rate != null && rate < 50) {
      alerts.push({
        dimension: 'adherence',
        message: `Check-in rate : ${rate}% — données insuffisantes`,
        severity: rate < 30 ? 'high' : 'medium',
      })
    } else {
      alerts.push({ dimension: 'adherence', message: 'Régularité des séances en baisse', severity: 'medium' })
    }
  }

  if (dims.recovery.score < 50 && dims.recovery.dataPoints > 0) {
    const avgs = checkin.field_averages
    if (avgs.sleep_duration != null && avgs.sleep_duration < 6.5) {
      alerts.push({
        dimension: 'recovery',
        message: `Sommeil moy. ${avgs.sleep_duration.toFixed(1)}h/nuit — sous le seuil de récupération`,
        severity: 'high',
      })
    } else if (avgs.stress != null && avgs.stress > 3.5) {
      alerts.push({
        dimension: 'recovery',
        message: `Stress élevé — moyenne ${avgs.stress.toFixed(1)}/5`,
        severity: 'medium',
      })
    } else {
      alerts.push({ dimension: 'recovery', message: 'Qualité de récupération insuffisante', severity: 'medium' })
    }
  }

  if (dims.bodyProgress.dataPoints === 0) {
    alerts.push({
      dimension: 'bodyProgress',
      message: 'Aucune donnée corporelle sur la période — planifier un bilan',
      severity: 'low',
    })
  } else if (dims.bodyProgress.score < 40) {
    alerts.push({
      dimension: 'bodyProgress',
      message: "Progression corporelle contraire à l'objectif",
      severity: 'high',
    })
  }

  if (dims.performance.score < 50 && dims.performance.dataPoints > 0) {
    alerts.push({
      dimension: 'performance',
      message: 'Progression en force stagnante sur la période',
      severity: dims.performance.score < 30 ? 'high' : 'medium',
    })
  }

  const order = { high: 0, medium: 1, low: 2 } as const
  return alerts.sort((a, b) => order[a.severity] - order[b.severity])
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeTransformationScore(input: ComputeScoreInput): TransformationScoreResult {
  const baseWeights = input.weightsOverride ?? DEFAULT_WEIGHTS[input.trainingGoal]
  const weightsSource: 'default' | 'coach_override' = input.weightsOverride ? 'coach_override' : 'default'

  const adherenceRaw = normalizeAdherence(
    input.checkin, input.performance.sessionsCount,
    input.performance.weeklyFrequency, input.window
  )
  const recoveryRaw   = normalizeRecovery(input.checkin.field_averages)
  const bodyRaw       = normalizeBodyProgress(input.bodyData)
  const performRaw    = normalizePerformance(input.performance)

  const insufficient: (keyof DimensionWeights)[] = []
  if (adherenceRaw.dataPoints < 1) insufficient.push('adherence')
  if (recoveryRaw.dataPoints < 3)  insufficient.push('recovery')
  if (bodyRaw.dataPoints < 2)      insufficient.push('bodyProgress')
  if (performRaw.dataPoints < 1)   insufficient.push('performance')

  const w = redistributeWeights(baseWeights, insufficient)

  const composite =
    adherenceRaw.score * w.adherence +
    recoveryRaw.score  * w.recovery  +
    bodyRaw.score      * w.bodyProgress +
    performRaw.score   * w.performance

  const dimensions = {
    adherence:    { score: adherenceRaw.score, weight: w.adherence,     dataPoints: adherenceRaw.dataPoints },
    recovery:     { score: recoveryRaw.score,  weight: w.recovery,      dataPoints: recoveryRaw.dataPoints  },
    bodyProgress: { score: bodyRaw.score,      weight: w.bodyProgress,  dataPoints: bodyRaw.dataPoints, confidence: bodyRaw.confidence },
    performance:  { score: performRaw.score,   weight: w.performance,   dataPoints: performRaw.dataPoints   },
  }

  return {
    score: Math.round(composite),
    label: getScoreLabel(Math.round(composite)),
    window: input.window,
    dimensions,
    alerts: generateAlerts(dimensions, input.checkin),
    weightsSource,
    insufficientData: insufficient.length > 0,
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/lib/transformationScore.test.ts
```
Expected: all tests PASS. If any fail, fix the logic before proceeding.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/coach/transformationScore.ts tests/lib/transformationScore.test.ts
git commit -m "feat(score): add transformation score calculation lib + unit tests"
```

---

## Task 3: API Route

**Files:**
- Create: `app/api/clients/[clientId]/transformation-score/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/clients/[clientId]/transformation-score/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  computeTransformationScore,
  type TrainingGoal,
  type DimensionWeights,
  type CheckinSummaryInput,
  type PerformanceSummaryInput,
  type BodyDataInput,
} from '@/lib/coach/transformationScore'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const querySchema = z.object({
  window: z.coerce.number().refine((v): v is 7 | 30 => v === 7 || v === 30, 'must be 7 or 30').default(7),
})

type Params = { params: { clientId: string } }

export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()

  const { data: clientData } = await db
    .from('coach_clients')
    .select('id, training_goal, weekly_frequency, score_weights_config')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!clientData) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const parsed = querySchema.safeParse({ window: url.searchParams.get('window') ?? 7 })
  if (!parsed.success) return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  const window = parsed.data.window

  const trainingGoal = (clientData.training_goal ?? 'recomp') as TrainingGoal
  const weeklyFrequency = Number(clientData.weekly_frequency ?? 3)
  const weightsOverride = (clientData.score_weights_config ?? null) as DimensionWeights | null

  const periodStart = new Date(Date.now() - window * 86400000).toISOString()
  const periodStartDate = periodStart.slice(0, 10)

  // Parallel DB fetch
  const [checkinRes, sessionRes, progressionRes, metricsRes, configRes] = await Promise.all([
    db.from('client_daily_checkins')
      .select('date, flow_type, sleep_hours, sleep_quality, energy_level, stress_level, muscle_soreness, hunger_level')
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

    // Body data: use last 90 days to ensure enough bilans for trend
    db.from('assessment_submissions')
      .select('submitted_at, bilan_date, assessment_responses(field_key, value_number)')
      .eq('client_id', params.clientId)
      .eq('coach_id', user.id)
      .eq('status', 'completed')
      .gte('submitted_at', new Date(Date.now() - 90 * 86400000).toISOString())
      .order('submitted_at', { ascending: true }),

    db.from('daily_checkin_configs')
      .select('days_of_week')
      .eq('client_id', params.clientId)
      .eq('coach_id', user.id)
      .maybeSingle(),
  ])

  // ── Build checkin input ──────────────────────────────────────────────────────
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

  let configuredDays = 0
  const daysOfWeek: number[] = configRes.data?.days_of_week ?? []
  if (daysOfWeek.length > 0) {
    for (let i = 0; i < window; i++) {
      const d = new Date(Date.now() - i * 86400000)
      const jsDay = d.getDay()
      const day = jsDay === 0 ? 6 : jsDay - 1
      if (daysOfWeek.includes(day)) configuredDays++
    }
  }

  const responseRate = configuredDays > 0
    ? Math.round((uniqueDays.size / configuredDays) * 100)
    : null

  const checkin: CheckinSummaryInput = {
    field_averages: {
      energy: fieldAverages.energy,
      sleep_duration: fieldAverages.sleep_duration,
      sleep_quality: fieldAverages.sleep_quality,
      stress: fieldAverages.stress,
      muscle_soreness: fieldAverages.muscle_soreness,
    },
    response_rate: responseRate,
    configured_days_count: configuredDays,
  }

  // ── Build performance input ──────────────────────────────────────────────────
  const sessionLogs = (sessionRes.data ?? []) as any[]
  const sessionsCount = sessionLogs.length
  const progressionEvents = (progressionRes.data ?? []) as any[]

  const exerciseMap = new Map<string, { completionRates: number[]; rirValues: number[] }>()

  for (const session of sessionLogs) {
    const sets = (session.client_set_logs ?? []) as any[]
    const exIds = [...new Set<string>(sets.map((s: any) => s.exercise_id as string))]
    for (const exId of exIds) {
      const exSets = sets.filter((s: any) => s.exercise_id === exId)
      const completedCount = exSets.filter((s: any) => s.completed).length
      const rirValues = exSets
        .map((s: any) => s.rir_actual)
        .filter((v: any): v is number => typeof v === 'number')
      if (!exerciseMap.has(exId)) exerciseMap.set(exId, { completionRates: [], rirValues: [] })
      const entry = exerciseMap.get(exId)!
      entry.completionRates.push(exSets.length > 0 ? completedCount / exSets.length : 0)
      entry.rirValues.push(...rirValues)
    }
  }

  const exercises = Array.from(exerciseMap.entries()).map(([exId, data]) => {
    const avgCompletion = data.completionRates.reduce((s, v) => s + v, 0) / data.completionRates.length
    const avgRir = data.rirValues.length > 0
      ? data.rirValues.reduce((s, v) => s + v, 0) / data.rirValues.length
      : null
    const overloads = progressionEvents.filter(
      (ev: any) => ev.exercise_id === exId && ev.trigger_type === 'overload'
    ).length
    return {
      completion_rate: avgCompletion,
      avg_rir: avgRir,
      overloads_last_4_weeks: overloads,
      stagnation: overloads === 0 && data.completionRates.length >= 3,
      overreaching: data.completionRates.filter(r => r < 0.8).length >= 2,
    }
  })

  const performance: PerformanceSummaryInput = {
    analysis: {
      exercises,
      global_overreaching: exercises.filter(e => e.overreaching).length >= 2,
    },
    sessionsCount,
    weeklyFrequency,
  }

  // ── Build body data input ────────────────────────────────────────────────────
  const submissions = (metricsRes.data ?? []) as any[]
  const weightSeries: { date: string; value: number }[] = []
  const bodyFatSeries: { date: string; value: number }[] = []
  const leanMassSeries: { date: string; value: number }[] = []

  for (const sub of submissions) {
    const rawDate: string = sub.bilan_date ?? sub.submitted_at ?? ''
    const date = rawDate.split('T')[0]
    if (!date) continue
    const responses = (sub.assessment_responses ?? []) as { field_key: string; value_number: number | null }[]
    for (const r of responses) {
      if (r.value_number == null) continue
      if (r.field_key === 'weight')        weightSeries.push({ date, value: r.value_number })
      if (r.field_key === 'body_fat_pct')  bodyFatSeries.push({ date, value: r.value_number })
      if (r.field_key === 'lean_mass_kg')  leanMassSeries.push({ date, value: r.value_number })
    }
  }

  const bodyData: BodyDataInput = {
    weightSeries,
    bodyFatSeries,
    leanMassSeries,
    trainingGoal,
  }

  // ── Compute and return ───────────────────────────────────────────────────────
  const result = computeTransformationScore({ trainingGoal, window, checkin, performance, bodyData, weightsOverride })
  return NextResponse.json(result)
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Manual smoke test**

With the dev server running (`npm run dev`), open a terminal and run:
```bash
curl -s "http://localhost:3000/api/clients/[REAL_CLIENT_ID]/transformation-score?window=7" \
  -H "Cookie: $(cat /tmp/dev-cookie.txt 2>/dev/null || echo '')" | jq '.score, .label'
```
Expected: a number 0–100 and a French label string. (Auth required — test in browser's network tab if easier.)

- [ ] **Step 4: Commit**

```bash
git add app/api/clients/[clientId]/transformation-score/route.ts
git commit -m "feat(score): add transformation-score API route"
```

---

## Task 4: Transformation Score Widget Component

**Files:**
- Create: `components/coach/TransformationScoreWidget.tsx`

The widget is a single self-contained `"use client"` component. It fetches from the API route, renders the gauge, pills, and alert list.

- [ ] **Step 1: Create `components/coach/TransformationScoreWidget.tsx`**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { TransformationScoreResult } from '@/lib/coach/transformationScore'

// ── SVG Gauge constants ────────────────────────────────────────────────────────
const CX = 100
const CY = 115
const R = 88
const TRACK_WIDTH = 14
const START_DEG = 225   // 7:30 o'clock (0° = top, clockwise)
const SWEEP = 270

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polarToCartesian(cx, cy, r, startDeg)
  const e = polarToCartesian(cx, cy, r, endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

const TRACK_PATH = arcPath(CX, CY, R, START_DEG, START_DEG + SWEEP)
const NEEDLE_START = polarToCartesian(CX, CY, R - 18, START_DEG)

// ── Gauge sub-component ───────────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score))

  return (
    <svg viewBox="0 0 200 148" className="w-full max-w-[220px] mx-auto">
      {/* Background track */}
      <path
        d={TRACK_PATH}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={TRACK_WIDTH}
        strokeLinecap="round"
      />
      {/* Active arc */}
      <motion.path
        d={TRACK_PATH}
        fill="none"
        stroke="#1f8a65"
        strokeWidth={TRACK_WIDTH}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: clamped / 100 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
      {/* Needle (rotates around center) */}
      <motion.g
        style={{ transformOrigin: `${CX}px ${CY}px` }}
        initial={{ rotate: 0 }}
        animate={{ rotate: (clamped / 100) * SWEEP }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      >
        <line
          x1={CX} y1={CY}
          x2={NEEDLE_START.x} y2={NEEDLE_START.y}
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </motion.g>
      {/* Center dot */}
      <circle cx={CX} cy={CY} r={5} fill="rgba(255,255,255,0.9)" />
      {/* Score number */}
      <text
        x={CX}
        y={CY - 20}
        textAnchor="middle"
        fill="white"
        fontSize={34}
        fontWeight={700}
        fontFamily="inherit"
        dominantBaseline="middle"
      >
        {score}
      </text>
    </svg>
  )
}

// ── Dimension pills ────────────────────────────────────────────────────────────
const DIM_LABELS: Record<string, string> = {
  adherence: 'ADH',
  recovery: 'REC',
  bodyProgress: 'CORPS',
  performance: 'PERF',
}

function DimensionPills({ dimensions }: { dimensions: TransformationScoreResult['dimensions'] }) {
  return (
    <div className="flex gap-2 justify-center mt-3">
      {Object.entries(dimensions).map(([key, dim]) => {
        const score = dim.score
        const scoreColor =
          dim.weight === 0   ? 'text-white/20' :
          score < 25         ? 'text-red-400' :
          score < 50         ? 'text-amber-400' :
                               'text-white/70'
        return (
          <div key={key} className="bg-white/[0.04] rounded-lg px-2.5 py-1.5 flex flex-col items-center gap-0.5">
            <span className={`text-[15px] font-bold tabular-nums ${scoreColor}`}>
              {dim.weight === 0 ? '—' : score}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/25">
              {DIM_LABELS[key]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Alert list ────────────────────────────────────────────────────────────────
const SEVERITY_DOT: Record<string, string> = {
  high:   'bg-red-400',
  medium: 'bg-amber-400',
  low:    'bg-white/30',
}

const DIM_FULL: Record<string, string> = {
  adherence:    'Adhérence',
  recovery:     'Récupération',
  bodyProgress: 'Corps',
  performance:  'Performance',
}

function AlertList({ alerts }: { alerts: TransformationScoreResult['alerts'] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 px-1 mt-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#1f8a65] flex-shrink-0" />
        <span className="text-[11px] text-white/40">Aucune alerte — client en bonne dynamique</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/30 mb-0.5">
        Priorités
      </p>
      {alerts.map((alert, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${SEVERITY_DOT[alert.severity]}`} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-white/60 uppercase tracking-[0.1em] mb-0.5">
              {DIM_FULL[alert.dimension]}
            </p>
            <p className="text-[11px] text-white/45 leading-snug">{alert.message}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Window toggle ─────────────────────────────────────────────────────────────
function WindowToggle({
  value,
  onChange,
}: {
  value: 7 | 30
  onChange: (v: 7 | 30) => void
}) {
  return (
    <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
      {([7, 30] as const).map(w => (
        <button
          key={w}
          onClick={() => onChange(w)}
          className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
            value === w
              ? 'bg-white/[0.08] text-white'
              : 'text-white/30 hover:text-white/50'
          }`}
        >
          {w}j
        </button>
      ))}
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────
interface Props {
  clientId: string
}

export default function TransformationScoreWidget({ clientId }: Props) {
  const [window, setWindow] = useState<7 | 30>(7)
  const [data, setData] = useState<TransformationScoreResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setData(null)
    fetch(`/api/clients/${clientId}/transformation-score?window=${window}`)
      .then(r => r.json())
      .then((d: TransformationScoreResult) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clientId, window])

  return (
    <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
          Score de transformation
        </p>
        <WindowToggle value={window} onChange={setWindow} />
      </div>

      {loading ? (
        <div className="h-[180px] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-6">
          {/* Left: gauge + pills + label */}
          <div className="flex flex-col items-center">
            <ScoreGauge score={data.score} />
            <p className="text-[11px] text-white/50 mt-1 -mt-1">{data.label}</p>
            <DimensionPills dimensions={data.dimensions} />
            {data.insufficientData && (
              <p className="text-[9px] text-amber-400/60 mt-2 text-center">
                Données partielles — score estimé
              </p>
            )}
          </div>
          {/* Right: alerts */}
          <div className="pt-1">
            <AlertList alerts={data.alerts} />
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-white/30 text-center py-8">Erreur de chargement</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/coach/TransformationScoreWidget.tsx
git commit -m "feat(score): add TransformationScoreWidget — gauge SVG + pills + alerts"
```

---

## Task 5: Integration in Profil Page

**Files:**
- Modify: `app/coach/clients/[clientId]/profil/page.tsx`

- [ ] **Step 1: Add import at top of file**

In `app/coach/clients/[clientId]/profil/page.tsx`, add after existing imports:

```typescript
import TransformationScoreWidget from '@/components/coach/TransformationScoreWidget'
```

- [ ] **Step 2: Insert widget above the 2-column grid**

Locate the `return (` block. Inside `<div className="px-6 pb-24">`, add the widget **before** `<div className="grid grid-cols-2 gap-4 items-start">`:

```tsx
<div className="px-6 pb-24">
  {/* Transformation Score — full width, top of profile */}
  <div className="mb-4">
    <TransformationScoreWidget clientId={clientId} />
  </div>

  <div className="grid grid-cols-2 gap-4 items-start">
    {/* ... existing columns unchanged ... */}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 4: Update CHANGELOG.md**

Add at top of today's section:
```
## 2026-05-29

FEATURE: Add Transformation Score widget to coach client profile page
```

- [ ] **Step 5: Commit**

```bash
git add app/coach/clients/[clientId]/profil/page.tsx CHANGELOG.md
git commit -m "feat(score): integrate TransformationScoreWidget into coach client profil page"
```

---

## Task 6: Verification

- [ ] **Run all tests**

```bash
npx vitest run tests/lib/transformationScore.test.ts
```
Expected: all PASS.

- [ ] **TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Visual verification**

1. Start dev server: `npm run dev`
2. Navigate to `/coach/clients/[any-client-id]/profil`
3. Verify: widget renders full-width at top, above Informations section
4. Verify: gauge arc animates on load (Framer Motion spring, ~1.2s)
5. Verify: score number and French label visible
6. Verify: 4 dimension pills (ADH / REC / CORPS / PERF) below gauge
7. Click toggle from **7j** to **30j** → gauge re-animates with new score
8. Client with no check-ins: "Données partielles — score estimé" note visible
9. DS v2.0 check: background `#121212`, accent `#1f8a65`, `rounded-2xl` card

- [ ] **Update `project-state.md`**

Add to "Dernières Avancées" section with date 2026-05-29, listing all new files.
