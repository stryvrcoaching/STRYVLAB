# Transformation Phase Guide — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a coach-facing widget to `/coach/clients/[clientId]/profil` that computes and displays the optimal physical transformation phase for the client, compared to their current training goal.

**Architecture:** Extend `lib/coach/transformationScore.ts` with a new pure function `computeOptimalPhase()`. Add `phaseRecommendation: PhaseRecommendation` to `TransformationScoreResult` and compute it in the existing route. New widget `components/coach/TransformationPhaseWidget.tsx` reads the same API response already fetched by `TransformationScoreWidget`.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase service client, Framer Motion, Lucide React, Vitest

---

## Phase Taxonomy

| Slug | Label FR | Direction |
|------|----------|-----------|
| `fat_loss` | Perte de gras | Déficit calorique |
| `lean_bulk` | Prise de masse | Surplus modéré |
| `recomp` | Recomposition | Maintenance calorique |
| `competition_prep` | Pré-compétition | Affinage + pic de forme |
| `competition` | Compétition | Maintien du pic |
| `maintenance` | Maintenance | Stabilisation métabolique |
| `deload` | Recharge | Réduction volume 40–60% |

---

## Algorithm — Priority Cascade

### Priority 1 (Override): Deload triggers
- `recovery.score < 30` (any context) → `deload`, confidence `high`
- `recovery.score < 40` AND `performance.analysis.global_overreaching` → `deload`, confidence `high`

### Priority 2 (Primary driver): Body fat % — when ≥ 2 bilans available
Uses gender from `coach_clients.gender`:

| body_fat_pct (homme) | body_fat_pct (femme) | Recommendation |
|---|---|---|
| < 10% | < 12% | `lean_bulk` |
| 10–15% | 12–20% | `lean_bulk` if perf ok, else `recomp` |
| 15–20% | 20–28% | `fat_loss` if adherence ≥ 60, else `maintenance` |
| > 20% | > 28% | `fat_loss` |

Performance "ok" = `performance.score ≥ 50`
Adherence ≥ 60 = `adherence.score ≥ 60`

### Priority 3 (Secondary driver): Dimensions — when body_fat absent
- `recovery.score < 50` AND `performance.score < 50` → `maintenance`
- `adherence.score < 60` → `maintenance` (simplify before changing phase)
- `bodyProgress.score < 40` AND current goal is fat_loss or lean_bulk → keep goal (data signals contrary, but insufficient context)
- Otherwise → map `training_goal` to closest phase (see mapping below)

### training_goal → TransformationPhase mapping
```
fat_loss    → fat_loss
hypertrophy → lean_bulk
strength    → lean_bulk
recomp      → recomp
maintenance → maintenance
endurance   → maintenance
athletic    → maintenance
```

### Confidence levels
- `high`: deload override triggers, OR body_fat ≥ 2 bilans with clear threshold
- `medium`: body_fat borderline (e.g., 14% homme = fat_loss/lean_bulk boundary), OR dimensions-only with ≥ 3 dataPoints
- `low`: insufficient data across all dimensions (body fat absent + dimensions mostly zero)

### matchesCurrent
Map `training_goal` to `TransformationPhase` via mapping above. `matchesCurrent = (computedPhase === mappedCurrentPhase)`.

---

## Types

```ts
export type TransformationPhase =
  | 'fat_loss' | 'lean_bulk' | 'recomp'
  | 'competition_prep' | 'competition'
  | 'maintenance' | 'deload'

export interface PhaseRecommendation {
  phase: TransformationPhase
  confidence: 'high' | 'medium' | 'low'
  rationale: string[]   // 2–3 bullets in French
  matchesCurrent: boolean
  currentMappedPhase: TransformationPhase
}
```

`TransformationScoreResult` gains one field: `phaseRecommendation: PhaseRecommendation`

---

## API Route Changes

File: `app/api/clients/[clientId]/transformation-score/route.ts`

Add `gender` to the `coach_clients` select:
```ts
.select('id, training_goal, weekly_frequency, score_weights_config, gender')
```

After computing dimensions, extract latest body fat:
```ts
const latestBodyFat = bodyFatSeries.length > 0
  ? bodyFatSeries[bodyFatSeries.length - 1].value
  : null
```

Pass to `computeTransformationScore`:
```ts
const result = computeTransformationScore({
  trainingGoal, window: win, checkin, performance, bodyData,
  weightsOverride, gender: clientData.gender ?? null, latestBodyFat
})
```

---

## Widget Visual Design

File: `components/coach/TransformationPhaseWidget.tsx`

**Data source:** `/api/clients/${clientId}/transformation-score?window=30` — always 30-day window. Phase recommendation is a medium-term signal; 7 days is too noisy for a phase decision. No window toggle in this widget.

**Props:**
```ts
interface Props {
  clientId: string
}
```

The widget fetches independently (same endpoint as score widget at window=30, separate state).

### Layout — Mismatch case
```
┌─────────────────────────────────────────────────────────┐
│ PHASE DE TRANSFORMATION                                  │
│                                                          │
│  ACTUELLE              OPTIMALE                          │
│  ┌───────────────┐  →  ┌────────────────────────┐       │
│  │ ⬆ Prise de   │     │ ⚡ Recharge             │       │
│  │   masse       │     │              Haute ●●● │       │
│  └───────────────┘     └────────────────────────┘       │
│                                                          │
│  • Récupération critique — score 28/100                  │
│  • Overreaching détecté sur 3 exercices                  │
│  • 1 semaine de décharge avant reprise                   │
└─────────────────────────────────────────────────────────┘
```

### Layout — Match case
```
┌─────────────────────────────────────────────────────────┐
│ PHASE DE TRANSFORMATION            ✓ Phase alignée       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ⬆ Prise de masse                   Confiance ●● │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  • Body fat 14% — fenêtre idéale pour lean bulk          │
│  • Récupération correcte (76/100)                        │
│  • Progression stable sur la période                     │
└─────────────────────────────────────────────────────────┘
```

### Visual tokens
- Card: `bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl px-6 py-5`
- Phase box actuelle: `bg-white/[0.04] rounded-xl`
- Phase box optimale (mismatch): `bg-white/[0.06] border-[0.3px] border-[#1f8a65]/20 rounded-xl`
- Phase box single (match): `bg-white/[0.04] rounded-xl`
- "✓ Phase alignée" badge: `text-[#1f8a65] text-[10px] font-bold uppercase tracking-[0.12em]`
- Phase label: `text-[13px] font-semibold text-white`
- Confidence dots: filled `bg-white/60` / empty `bg-white/15`, 3 dots max
- Rationale bullets: `text-[11px] text-white/40 leading-snug`
- Arrow between boxes: `→` in `text-white/20`

### Phase icons (Lucide)
```ts
const PHASE_ICONS = {
  fat_loss:         TrendingDown,
  lean_bulk:        TrendingUp,
  recomp:           RefreshCw,
  competition_prep: Target,
  competition:      Trophy,
  maintenance:      Minus,
  deload:           Zap,
}
```

### Phase labels FR
```ts
const PHASE_LABELS = {
  fat_loss:         'Perte de gras',
  lean_bulk:        'Prise de masse',
  recomp:           'Recomposition',
  competition_prep: 'Pré-compétition',
  competition:      'Compétition',
  maintenance:      'Maintenance',
  deload:           'Recharge',
}
```

---

## Rationale strings (examples per phase)

Each call to `computeOptimalPhase` builds `rationale[]` from the triggered rules:

- Deload (recovery override): `"Récupération critique — score ${recovery.score}/100"`, `"Overreaching détecté — réduire le volume 40–50%"`, `"1 semaine de décharge avant reprise"`
- fat_loss (body_fat): `"Body fat ${bf}% — au-dessus du seuil de coupure recommandé"`, `"Adhérence suffisante pour maintenir un déficit"`, `"Favorise la préservation de la masse maigre en phase de coupe"`
- lean_bulk (body_fat): `"Body fat ${bf}% — fenêtre idéale pour une prise de masse propre"`, `"Récupération correcte (${recovery.score}/100)"`, `"Progression stable — conditions optimales pour le surplus"`
- recomp (no body_fat): `"Données corporelles insuffisantes — recomposition par défaut"`, `"Maintien calorique recommandé en attendant plus de bilans"`
- maintenance (adherence low): `"Adhérence ${adherence.score}% — simplifier avant de changer de phase"`, `"Stabilisation prioritaire"`

---

## File Map

| File | Action |
|------|--------|
| `lib/coach/transformationScore.ts` | Add `TransformationPhase`, `PhaseRecommendation` types; add `gender` + `latestBodyFat` to `ComputeScoreInput`; add `mapGoalToPhase()`; add `computeOptimalPhase()`; call it in `computeTransformationScore()` |
| `tests/lib/transformationScore.test.ts` | Add ~10 tests for `computeOptimalPhase` |
| `app/api/clients/[clientId]/transformation-score/route.ts` | Add `gender` to select; extract `latestBodyFat`; pass to compute |
| `components/coach/TransformationPhaseWidget.tsx` | New widget |
| `app/coach/clients/[clientId]/profil/page.tsx` | Add `<TransformationPhaseWidget clientId={clientId} />` below score widget |
| `CHANGELOG.md` | Update |

---

## Verification

1. `npx vitest run tests/lib/transformationScore.test.ts` — all tests pass (18 existing + ~10 new)
2. `npx tsc --noEmit` — 0 errors
3. Browser: navigate to `/coach/clients/[clientId]/profil`, verify both widgets render, mismatch case shows two boxes + arrow, match case shows single box + green badge
