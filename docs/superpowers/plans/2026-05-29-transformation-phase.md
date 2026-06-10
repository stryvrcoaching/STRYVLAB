# Transformation Phase Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `TransformationPhaseWidget` to the coach client profile page that computes and displays the optimal physical transformation phase vs. the current training goal.

**Architecture:** Extend `lib/coach/transformationScore.ts` with `TransformationPhase`, `PhaseRecommendation` types and a pure `computeOptimalPhase()` function. Add `gender` + `latestBodyFat` to `ComputeScoreInput`. The API route passes these new inputs and the result includes `phaseRecommendation`. New widget fetches the same endpoint at `window=30`.

**Tech Stack:** Next.js App Router, TypeScript strict, Vitest, Framer Motion, Lucide React

---

## File Map

| File | Action |
|------|--------|
| `lib/coach/transformationScore.ts` | Add `TransformationPhase`, `PhaseRecommendation` types; add `gender`/`latestBodyFat` to `ComputeScoreInput`; export `computeOptimalPhase()` + `GOAL_TO_PHASE`; call it in `computeTransformationScore()` |
| `tests/lib/transformationScore.test.ts` | Add `describe('computeOptimalPhase', ...)` with 12 new tests |
| `app/api/clients/[clientId]/transformation-score/route.ts` | Add `gender` to `coach_clients` select; extract `latestBodyFat`; pass both to `computeTransformationScore` |
| `components/coach/TransformationPhaseWidget.tsx` | New widget — create |
| `app/coach/clients/[clientId]/profil/page.tsx` | Add import + `<TransformationPhaseWidget clientId={clientId} />` below score widget |
| `CHANGELOG.md` | Update |

---

## Task 1: Write failing tests for `computeOptimalPhase`

**Files:**
- Modify: `tests/lib/transformationScore.test.ts`

- [ ] **Step 1: Add imports and helpers to test file**

At the top of `tests/lib/transformationScore.test.ts`, add `computeOptimalPhase` and `GOAL_TO_PHASE` to the import block, and add the `makeDims` helper. The full updated imports + helper:

```ts
import { describe, it, expect } from 'vitest'
import {
  getScoreLabel,
  DEFAULT_WEIGHTS,
  computeTransformationScore,
  computeOptimalPhase,
  GOAL_TO_PHASE,
  type ComputeScoreInput,
  type DimensionWeights,
  type TransformationScoreResult,
} from '@/lib/coach/transformationScore'
```

Add this helper after the existing `makeInput` helper (around line 86):

```ts
function makeDims(overrides: Partial<TransformationScoreResult['dimensions']> = {}): TransformationScoreResult['dimensions'] {
  return {
    adherence:    { score: 80, weight: 0.25, dataPoints: 5 },
    recovery:     { score: 75, weight: 0.30, dataPoints: 5 },
    bodyProgress: { score: 60, weight: 0.20, dataPoints: 3, confidence: 'high' as const },
    performance:  { score: 80, weight: 0.25, dataPoints: 4 },
    ...overrides,
  }
}
```

- [ ] **Step 2: Add the failing test suite**

Append the following test block at the end of `tests/lib/transformationScore.test.ts`:

```ts
// ── computeOptimalPhase ───────────────────────────────────────────────────────

describe('computeOptimalPhase', () => {
  it('returns deload when recovery score < 30', () => {
    const dims = makeDims({ recovery: { score: 25, weight: 0.30, dataPoints: 5 } })
    const result = computeOptimalPhase('hypertrophy', dims, null, null)
    expect(result.phase).toBe('deload')
    expect(result.confidence).toBe('high')
  })

  it('returns deload when recovery < 40 and performance < 40', () => {
    const dims = makeDims({
      recovery:    { score: 35, weight: 0.30, dataPoints: 5 },
      performance: { score: 32, weight: 0.25, dataPoints: 4 },
    })
    const result = computeOptimalPhase('hypertrophy', dims, null, null)
    expect(result.phase).toBe('deload')
    expect(result.confidence).toBe('high')
  })

  it('returns lean_bulk when body_fat < 10% male', () => {
    const result = computeOptimalPhase('fat_loss', makeDims(), 9.5, 'male')
    expect(result.phase).toBe('lean_bulk')
    expect(result.confidence).toBe('high')
  })

  it('returns lean_bulk when body_fat < 12% female', () => {
    const result = computeOptimalPhase('fat_loss', makeDims(), 11.0, 'female')
    expect(result.phase).toBe('lean_bulk')
    expect(result.confidence).toBe('high')
  })

  it('returns fat_loss when body_fat > 20% male', () => {
    const result = computeOptimalPhase('hypertrophy', makeDims(), 22.0, 'male')
    expect(result.phase).toBe('fat_loss')
    expect(result.confidence).toBe('high')
  })

  it('returns fat_loss when body_fat > 28% female', () => {
    const result = computeOptimalPhase('hypertrophy', makeDims(), 30.0, 'female')
    expect(result.phase).toBe('fat_loss')
    expect(result.confidence).toBe('high')
  })

  it('returns lean_bulk when body_fat 13% male and performance ok', () => {
    const dims = makeDims({ performance: { score: 70, weight: 0.25, dataPoints: 4 } })
    const result = computeOptimalPhase('recomp', dims, 13.0, 'male')
    expect(result.phase).toBe('lean_bulk')
    expect(result.confidence).toBe('medium')
  })

  it('returns recomp when body_fat 13% male and performance low', () => {
    const dims = makeDims({ performance: { score: 35, weight: 0.25, dataPoints: 4 } })
    const result = computeOptimalPhase('recomp', dims, 13.0, 'male')
    expect(result.phase).toBe('recomp')
    expect(result.confidence).toBe('medium')
  })

  it('returns maintenance when no body_fat and adherence < 60', () => {
    const dims = makeDims({ adherence: { score: 45, weight: 0.25, dataPoints: 5 } })
    const result = computeOptimalPhase('hypertrophy', dims, null, null)
    expect(result.phase).toBe('maintenance')
  })

  it('returns maintenance when recovery and performance both < 50 (no body_fat)', () => {
    const dims = makeDims({
      recovery:    { score: 40, weight: 0.30, dataPoints: 5 },
      performance: { score: 42, weight: 0.25, dataPoints: 4 },
    })
    const result = computeOptimalPhase('hypertrophy', dims, null, null)
    expect(result.phase).toBe('maintenance')
  })

  it('matchesCurrent is true when recommendation matches mapped training_goal', () => {
    // hypertrophy maps to lean_bulk; body_fat < 10% → lean_bulk
    const result = computeOptimalPhase('hypertrophy', makeDims(), 9.0, 'male')
    expect(result.phase).toBe('lean_bulk')
    expect(result.currentMappedPhase).toBe('lean_bulk')
    expect(result.matchesCurrent).toBe(true)
  })

  it('matchesCurrent is false when recommendation differs from mapped training_goal', () => {
    // hypertrophy maps to lean_bulk; recovery < 30 → deload
    const dims = makeDims({ recovery: { score: 20, weight: 0.30, dataPoints: 5 } })
    const result = computeOptimalPhase('hypertrophy', dims, null, null)
    expect(result.phase).toBe('deload')
    expect(result.currentMappedPhase).toBe('lean_bulk')
    expect(result.matchesCurrent).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
npx vitest run tests/lib/transformationScore.test.ts 2>&1 | tail -20
```

Expected: failures mentioning `computeOptimalPhase is not a function` or import error.

---

## Task 2: Implement types + `computeOptimalPhase` in the score lib

**Files:**
- Modify: `lib/coach/transformationScore.ts`

- [ ] **Step 1: Add new types after the existing `TransformationAlert` type**

In `lib/coach/transformationScore.ts`, after the `TransformationAlert` interface (around line 28), add:

```ts
export type TransformationPhase =
  | 'fat_loss' | 'lean_bulk' | 'recomp'
  | 'competition_prep' | 'competition'
  | 'maintenance' | 'deload'

export interface PhaseRecommendation {
  phase: TransformationPhase
  confidence: 'high' | 'medium' | 'low'
  rationale: string[]
  matchesCurrent: boolean
  currentMappedPhase: TransformationPhase
}
```

- [ ] **Step 2: Add `phaseRecommendation` to `TransformationScoreResult`**

Update `TransformationScoreResult`:

```ts
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
  phaseRecommendation: PhaseRecommendation
}
```

- [ ] **Step 3: Add `gender` and `latestBodyFat` to `ComputeScoreInput`**

Update `ComputeScoreInput`:

```ts
export interface ComputeScoreInput {
  trainingGoal: TrainingGoal
  window: 7 | 30
  checkin: CheckinSummaryInput
  performance: PerformanceSummaryInput
  bodyData: BodyDataInput
  weightsOverride: DimensionWeights | null
  gender: string | null
  latestBodyFat: number | null
}
```

- [ ] **Step 4: Add `GOAL_TO_PHASE` constant and `computeOptimalPhase` function**

Add before the `computeTransformationScore` function (after `generateAlerts`):

```ts
// ─── Phase recommendation ────────────────────────────────────────────────────

export const GOAL_TO_PHASE: Record<TrainingGoal, TransformationPhase> = {
  fat_loss:    'fat_loss',
  hypertrophy: 'lean_bulk',
  strength:    'lean_bulk',
  recomp:      'recomp',
  maintenance: 'maintenance',
  endurance:   'maintenance',
  athletic:    'maintenance',
}

export function computeOptimalPhase(
  trainingGoal: TrainingGoal,
  dims: TransformationScoreResult['dimensions'],
  latestBodyFat: number | null,
  gender: string | null,
): PhaseRecommendation {
  const currentMappedPhase = GOAL_TO_PHASE[trainingGoal]

  // Priority 1: Deload — recovery critical
  if (dims.recovery.dataPoints > 0 && dims.recovery.score < 30) {
    return {
      phase: 'deload',
      confidence: 'high',
      rationale: [
        `Récupération critique — score ${dims.recovery.score}/100`,
        'Réduire le volume d\'entraînement 40–50% pendant 1 semaine',
        'Reprendre la phase en cours après la décharge',
      ],
      matchesCurrent: currentMappedPhase === 'deload',
      currentMappedPhase,
    }
  }

  // Priority 1b: Deload — recovery + performance both low (overreaching proxy)
  if (
    dims.recovery.dataPoints > 0 && dims.recovery.score < 40 &&
    dims.performance.dataPoints > 0 && dims.performance.score < 40
  ) {
    return {
      phase: 'deload',
      confidence: 'high',
      rationale: [
        `Récupération insuffisante — score ${dims.recovery.score}/100`,
        `Performance en baisse — score ${dims.performance.score}/100`,
        'Semaine de décharge recommandée avant reprise',
      ],
      matchesCurrent: currentMappedPhase === 'deload',
      currentMappedPhase,
    }
  }

  // Priority 2: Body fat driven (requires at least 1 bilan with body_fat_pct)
  if (latestBodyFat !== null) {
    const isFemale = gender === 'female'
    const leanCutoff  = isFemale ? 12 : 10   // below → lean_bulk
    const borderUpper = isFemale ? 20 : 15   // 10–15% homme / 12–20% femme
    const fatLossUpper = isFemale ? 28 : 20  // above → fat_loss

    if (latestBodyFat < leanCutoff) {
      return {
        phase: 'lean_bulk',
        confidence: 'high',
        rationale: [
          `Body fat ${latestBodyFat.toFixed(1)}% — trop faible pour un déficit calorique`,
          'Fenêtre idéale pour une prise de masse propre',
          'Surplus modéré de 250–500 kcal recommandé',
        ],
        matchesCurrent: currentMappedPhase === 'lean_bulk',
        currentMappedPhase,
      }
    }

    if (latestBodyFat > fatLossUpper) {
      return {
        phase: 'fat_loss',
        confidence: 'high',
        rationale: [
          `Body fat ${latestBodyFat.toFixed(1)}% — au-dessus du seuil recommandé`,
          'Déficit calorique modéré prioritaire (300–500 kcal)',
          'Charge protéique élevée pour préserver la masse maigre',
        ],
        matchesCurrent: currentMappedPhase === 'fat_loss',
        currentMappedPhase,
      }
    }

    if (latestBodyFat < borderUpper) {
      // 10–15% homme / 12–20% femme — lean_bulk if perf ok, else recomp
      const phase: TransformationPhase = dims.performance.score >= 50 ? 'lean_bulk' : 'recomp'
      return {
        phase,
        confidence: 'medium',
        rationale: phase === 'lean_bulk'
          ? [
              `Body fat ${latestBodyFat.toFixed(1)}% — dans la fenêtre pour un lean bulk`,
              `Progression stable (score performance ${dims.performance.score}/100)`,
              'Surplus modéré pour maximiser la synthèse protéique',
            ]
          : [
              `Body fat ${latestBodyFat.toFixed(1)}% — recomposition envisageable`,
              `Performance variable (score ${dims.performance.score}/100)`,
              'Maintien calorique avec entraînement en résistance optimal',
            ],
        matchesCurrent: currentMappedPhase === phase,
        currentMappedPhase,
      }
    }

    // 15–20% homme / 20–28% femme — fat_loss if adherence ok, else maintenance
    const phase: TransformationPhase = dims.adherence.score >= 60 ? 'fat_loss' : 'maintenance'
    return {
      phase,
      confidence: 'medium',
      rationale: phase === 'fat_loss'
        ? [
            `Body fat ${latestBodyFat.toFixed(1)}% — réduction recommandée`,
            `Adhérence suffisante (${dims.adherence.score}%) pour tenir un déficit`,
            'Déficit modéré de 300–500 kcal',
          ]
        : [
            `Body fat ${latestBodyFat.toFixed(1)}% — stabilisation avant déficit`,
            `Adhérence insuffisante (${dims.adherence.score}%) — consolider les habitudes d'abord`,
            'Phase de maintenance pour construire la régularité',
          ],
      matchesCurrent: currentMappedPhase === phase,
      currentMappedPhase,
    }
  }

  // Priority 3: Dimension-driven fallback (no body fat data)
  if (dims.adherence.dataPoints > 0 && dims.adherence.score < 60) {
    return {
      phase: 'maintenance',
      confidence: 'medium',
      rationale: [
        `Adhérence insuffisante — ${dims.adherence.score}%`,
        'Stabiliser les habitudes avant de changer de phase',
        'Objectif : atteindre 80%+ d\'adhérence sur 4 semaines',
      ],
      matchesCurrent: currentMappedPhase === 'maintenance',
      currentMappedPhase,
    }
  }

  if (
    dims.recovery.dataPoints > 0 && dims.recovery.score < 50 &&
    dims.performance.dataPoints > 0 && dims.performance.score < 50
  ) {
    return {
      phase: 'maintenance',
      confidence: 'medium',
      rationale: [
        `Récupération et performance sous les seuils optimaux`,
        `Score récupération : ${dims.recovery.score}/100 — score performance : ${dims.performance.score}/100`,
        'Maintien calorique pour consolider la base avant relance',
      ],
      matchesCurrent: currentMappedPhase === 'maintenance',
      currentMappedPhase,
    }
  }

  // Fallback: mirror training_goal
  const insufficientData = dims.adherence.dataPoints < 1 && dims.recovery.dataPoints < 1
  return {
    phase: currentMappedPhase,
    confidence: insufficientData ? 'low' : 'medium',
    rationale: insufficientData
      ? [
          'Données insuffisantes pour une recommandation précise',
          'Phase actuelle maintenue par défaut',
          'Planifier des bilans réguliers pour affiner la recommandation',
        ]
      : [
          'Profil conforme à la phase en cours',
          `Récupération correcte (${dims.recovery.score}/100)`,
          'Continuer la phase actuelle — surveiller les bilans',
        ],
    matchesCurrent: true,
    currentMappedPhase,
  }
}
```

- [ ] **Step 5: Call `computeOptimalPhase` inside `computeTransformationScore`**

In the `computeTransformationScore` function, after building `dimensions` and before the `return` statement, add:

```ts
  const phaseRecommendation = computeOptimalPhase(
    input.trainingGoal,
    dimensions,
    input.latestBodyFat,
    input.gender,
  )
```

And add `phaseRecommendation` to the return object:

```ts
  return {
    score: Math.round(composite),
    label: getScoreLabel(Math.round(composite)),
    window: input.window,
    dimensions,
    alerts: generateAlerts(dimensions, input.checkin),
    weightsSource,
    insufficientData: insufficient.length > 0,
    phaseRecommendation,
  }
```

- [ ] **Step 6: Run tests — all must pass**

```bash
npx vitest run tests/lib/transformationScore.test.ts 2>&1 | tail -20
```

Expected: `Tests 30 passed (30)` (18 existing + 12 new).

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "transformationScore"
```

Expected: no output (no errors in this file).

- [ ] **Step 8: Commit**

```bash
git add lib/coach/transformationScore.ts tests/lib/transformationScore.test.ts
git commit -m "feat(phase): add computeOptimalPhase — 7-phase recommendation algorithm with 30 tests"
```

---

## Task 3: Update API route

**Files:**
- Modify: `app/api/clients/[clientId]/transformation-score/route.ts`

- [ ] **Step 1: Add `gender` to `coach_clients` select**

Find line 36:
```ts
    .select('id, training_goal, weekly_frequency, score_weights_config')
```

Replace with:
```ts
    .select('id, training_goal, weekly_frequency, score_weights_config, gender')
```

- [ ] **Step 2: Extract `latestBodyFat` after building `bodyFatSeries`**

After line 205 (`if (r.field_key === 'lean_mass_kg') leanMassSeries.push(...)`), before building `bodyData`, add:

```ts
  const latestBodyFat = bodyFatSeries.length > 0
    ? bodyFatSeries[bodyFatSeries.length - 1].value
    : null
```

- [ ] **Step 3: Pass `gender` and `latestBodyFat` to `computeTransformationScore`**

Find line 216:
```ts
  const result = computeTransformationScore({ trainingGoal, window: win, checkin, performance, bodyData, weightsOverride })
```

Replace with:
```ts
  const result = computeTransformationScore({
    trainingGoal,
    window: win,
    checkin,
    performance,
    bodyData,
    weightsOverride,
    gender: (clientData.gender ?? null) as string | null,
    latestBodyFat,
  })
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "transformation-score"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add app/api/clients/\[clientId\]/transformation-score/route.ts
git commit -m "feat(phase): update transformation-score route — pass gender + latestBodyFat to score engine"
```

---

## Task 4: Build `TransformationPhaseWidget`

**Files:**
- Create: `components/coach/TransformationPhaseWidget.tsx`

- [ ] **Step 1: Create the widget file**

```tsx
'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingDown, TrendingUp, RefreshCw, Target, Trophy, Minus, Zap } from 'lucide-react'
import type { TransformationScoreResult, TransformationPhase } from '@/lib/coach/transformationScore'

// ── Phase metadata ────────────────────────────────────────────────────────────
const PHASE_LABELS: Record<TransformationPhase, string> = {
  fat_loss:         'Perte de gras',
  lean_bulk:        'Prise de masse',
  recomp:           'Recomposition',
  competition_prep: 'Pré-compétition',
  competition:      'Compétition',
  maintenance:      'Maintenance',
  deload:           'Recharge',
}

const PHASE_ICONS: Record<TransformationPhase, React.ElementType> = {
  fat_loss:         TrendingDown,
  lean_bulk:        TrendingUp,
  recomp:           RefreshCw,
  competition_prep: Target,
  competition:      Trophy,
  maintenance:      Minus,
  deload:           Zap,
}

// ── Confidence dots ───────────────────────────────────────────────────────────
function ConfidenceDots({ level }: { level: 'high' | 'medium' | 'low' }) {
  const filled = level === 'high' ? 3 : level === 'medium' ? 2 : 1
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i < filled ? 'bg-white/60' : 'bg-white/15'}`}
        />
      ))}
    </div>
  )
}

// ── Phase box ─────────────────────────────────────────────────────────────────
function PhaseBox({
  phase,
  label,
  highlight,
}: {
  phase: TransformationPhase
  label: 'ACTUELLE' | 'OPTIMALE'
  highlight: boolean
}) {
  const Icon = PHASE_ICONS[phase]
  return (
    <div className={`flex-1 rounded-xl px-4 py-3 ${
      highlight
        ? 'bg-white/[0.06] border-[0.3px] border-[#1f8a65]/25'
        : 'bg-white/[0.04] border-[0.3px] border-white/[0.06]'
    }`}>
      <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/25 mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-white/40 flex-shrink-0" />
        <span className="text-[13px] font-semibold text-white leading-tight">
          {PHASE_LABELS[phase]}
        </span>
      </div>
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────────────
interface Props {
  clientId: string
}

export default function TransformationPhaseWidget({ clientId }: Props) {
  const [data, setData] = useState<TransformationScoreResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/clients/${clientId}/transformation-score?window=30`)
      .then(r => r.json())
      .then((d: TransformationScoreResult) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clientId])

  const rec = data?.phaseRecommendation

  return (
    <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
          Phase de transformation
        </p>
        {rec?.matchesCurrent && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] font-bold text-[#1f8a65] tracking-[0.06em]"
          >
            ✓ Phase alignée
          </motion.span>
        )}
      </div>

      {loading ? (
        <div className="h-[100px] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      ) : rec ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* Phase boxes */}
          {rec.matchesCurrent ? (
            <PhaseBox phase={rec.phase} label="ACTUELLE" highlight={false} />
          ) : (
            <div className="flex items-center gap-3">
              <PhaseBox phase={rec.currentMappedPhase} label="ACTUELLE" highlight={false} />
              <span className="text-white/20 text-[18px] flex-shrink-0 select-none">→</span>
              <PhaseBox phase={rec.phase} label="OPTIMALE" highlight={true} />
            </div>
          )}

          {/* Confidence + rationale */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <ConfidenceDots level={rec.confidence} />
              <span className="text-[9px] text-white/25 uppercase tracking-[0.1em]">
                {rec.confidence === 'high' ? 'Haute confiance' :
                 rec.confidence === 'medium' ? 'Confiance moyenne' :
                 'Données insuffisantes'}
              </span>
            </div>
            {rec.rationale.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-white/20 mt-0.5 flex-shrink-0 select-none">•</span>
                <p className="text-[11px] text-white/40 leading-snug">{r}</p>
              </div>
            ))}
          </div>
        </motion.div>
      ) : (
        <p className="text-[11px] text-white/30 text-center py-6">Données insuffisantes</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "TransformationPhase"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/coach/TransformationPhaseWidget.tsx
git commit -m "feat(phase): add TransformationPhaseWidget — phase actuelle vs optimale + confidence + rationale"
```

---

## Task 5: Integrate into profil page + CHANGELOG

**Files:**
- Modify: `app/coach/clients/[clientId]/profil/page.tsx`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add import to profil page**

At the top of `app/coach/clients/[clientId]/profil/page.tsx`, after the `TransformationScoreWidget` import (line 17):

```ts
import TransformationPhaseWidget from "@/components/coach/TransformationPhaseWidget";
```

- [ ] **Step 2: Insert widget below `TransformationScoreWidget`**

Find the existing widget block (around line 298–302):

```tsx
            <TransformationScoreWidget clientId={clientId} />
```

Add the phase widget immediately after it:

```tsx
            <TransformationScoreWidget clientId={clientId} />
            <TransformationPhaseWidget clientId={clientId} />
```

- [ ] **Step 3: Update CHANGELOG.md**

Add at the top of the `## 2026-05-29` section:

```
FEATURE: Add TransformationPhaseWidget to coach client profile — 7-phase recommendation engine (fat_loss/lean_bulk/recomp/competition_prep/competition/maintenance/deload), cascade algorithm using body_fat % + recovery + performance + adherence, matchesCurrent comparison vs training_goal, confidence dots + rationale bullets
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "^$" | grep -v "vitality\|nutrition-data\|dashboard/coach\|stripe\|BodyFat" | head -20
```

Expected: no output (only pre-existing errors may appear in unrelated files).

- [ ] **Step 5: Commit**

```bash
git add app/coach/clients/\[clientId\]/profil/page.tsx CHANGELOG.md
git commit -m "feat(phase): integrate TransformationPhaseWidget into coach client profil page"
```

---

## Task 6: Final verification

**Files:** None — read-only checks

- [ ] **Step 1: Run all tests**

```bash
npx vitest run tests/lib/transformationScore.test.ts
```

Expected: `Tests 30 passed (30)`

- [ ] **Step 2: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "vitality\|nutrition-data\|dashboard/coach\|stripe\|BodyFat"
```

Expected: no new errors (only pre-existing ones in unrelated files filtered above).

- [ ] **Step 3: Update `project-state.md`**

In `.claude/rules/project-state.md`:

1. In the modules table, update the Transformation Score Widget row:

```markdown
| **Transformation Score Widget** | ✅ composite 0–100 gauge + Phase Guide widget (7 phases, cascade algorithm, body fat + recovery + performance drivers) | 2026-05-29 |
```

2. Add a new dated section under `## 🚀 Dernières Avancées`:

```markdown
### 2026-05-29 — Transformation Phase Guide Widget

- `lib/coach/transformationScore.ts` — +`TransformationPhase` (7 phases), `PhaseRecommendation`, `GOAL_TO_PHASE`, `computeOptimalPhase(trainingGoal, dims, latestBodyFat, gender)` — cascade: deload override (recovery<30 / both<40) → body_fat % drivers (male/female thresholds) → dimension fallbacks → goal mirror
- `tests/lib/transformationScore.test.ts` — 12 nouveaux tests, total 30 PASS
- `app/api/clients/[clientId]/transformation-score/route.ts` — +`gender` dans select, `latestBodyFat` extrait de `bodyFatSeries`, tous deux passés à `computeTransformationScore`
- `components/coach/TransformationPhaseWidget.tsx` — widget coach : layout mismatch (2 boîtes + flèche) vs match (1 boîte + badge vert), ConfidenceDots, rationale bullets, fetch `?window=30` fixe
- `app/coach/clients/[clientId]/profil/page.tsx` — widget inséré sous `TransformationScoreWidget`
- Points de vigilance : `computeOptimalPhase` utilise `performance.score < 40` comme proxy pour global_overreaching (le flag exact n'est pas dans les `dims`) ; `gender` castée depuis DB (string | null) — seule valeur 'female' déclenche les seuils femmes ; `latestBodyFat` = dernier bilan uniquement (pas une moyenne)
```

3. Check the Next Steps list — add:
```
- [x] Transformation Phase Guide Widget — 7-phase cascade algorithm, coach profil integration (2026-05-29)
```
