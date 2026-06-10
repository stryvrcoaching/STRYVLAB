# Transformation Score — Design Spec

**Date:** 2026-05-29
**Feature:** Coach Client Profile — Transformation Score Widget (Feature 1/3)
**Status:** Approved, ready for implementation

---

## Context

The coach client profile page (`/coach/clients/[clientId]/profil`) currently shows static info sections (Informations, Profil sportif, Accès, Tags). Coaches have no at-a-glance signal for how a client is actually progressing. They must navigate to multiple sub-pages (check-ins, bilans, performances) to build a mental picture.

This feature adds a full-width dashboard widget at the top of the profile page: a composite **Transformation Score** (0–100) derived from four data dimensions. It gives coaches an instant read — and a prioritized alert list explaining any score drops.

This is Feature 1 of 3 in the Coach Client Dashboard initiative. Features 2 (Transformation Phase Guide) and 3 (Metrics Averages) are separate sprints.

---

## Algorithm

### Four Dimensions

| Dimension | Sources | Signal |
|---|---|---|
| **Adhérence** | `checkin-summary.response_rate` + sessions complétées vs `weekly_frequency` | % compliance |
| **Récupération** | Moyennes check-in: `sleep_quality`, `sleep_hours`, `energy_level`, `stress_level` (inv.), `muscle_soreness` (inv.) | 1–5 normalisé |
| **Progression corps** | Tendance poids vs direction goal + `body_fat_pct` + `lean_mass_kg` depuis bilans | trend directionnel |
| **Performance** | Événements PR sur fenêtre + RIR trend + fréquence séances vs cible | progressions |

**Normalization:** each sub-metric scaled to 0–1, averaged into dimension score 0–100.

**Body progress — direction by goal (auto-inferred, zero client input):**
- `fat_loss` → poids ↓ = bon
- `hypertrophy` / `strength` → poids ↑ = bon
- `recomp` → poids stable + lean mass ↑ = bon
- `maintenance` → poids stable = bon
- `endurance` / `athletic` → perf-focused, body progress low weight

**Body composition source priority:**
1. Bilan `body_fat_pct` + `lean_mass_kg` (coach-measured, most accurate)
2. Navy formula from circumference measurements if bilan has them:
   - Homme: cou + taille + taille (no hips)
   - Femme: cou + taille + hanches
3. Weight trend only → `confidence: 'low'`
4. No data → `confidence: 'none'`, dimension redistributed

### Default Weights by `training_goal`

| Objectif | Adhérence | Récup | Corps | Perf |
|---|---|---|---|---|
| fat_loss | 30% | 25% | 30% | 15% |
| hypertrophy | 25% | 30% | 20% | 25% |
| strength | 25% | 25% | 15% | 35% |
| recomp | 30% | 25% | 25% | 20% |
| maintenance | 35% | 30% | 20% | 15% |
| endurance | 25% | 35% | 10% | 30% |
| athletic | 25% | 30% | 15% | 30% |

Coach can override per client (stored as JSONB). `null` = use default for client's `training_goal`.

**`score_weights_config` JSONB shape:**
```typescript
{
  adherence: number,    // 0–1, sum of all four must equal 1.0
  recovery: number,
  bodyProgress: number,
  performance: number
}
```

### `insufficientData` Handling

When a dimension has `dataPoints < 3` (e.g., no bilan in window, no check-ins):
- Dimension score excluded from composite
- Its weight redistributed proportionally to other dimensions
- `insufficientData: true` on the response if any dimension affected
- Alert generated: "Données insuffisantes — demandez à votre client de compléter ses check-ins"

### Score Labels

| Range | Label |
|---|---|
| 0–25 | En difficulté |
| 25–50 | En progression |
| 50–75 | Sur la bonne voie |
| 75–90 | Haute performance |
| 90–100 | Potentiel maximal |

---

## API

### `GET /api/clients/[clientId]/transformation-score`

**Query params:** `window=7|30` (default: 7)

**Auth:** `coach_clients.coach_id = auth.user.id` — same pattern as all `/api/clients/[clientId]/` routes.

**Data sources aggregated server-side (all existing):**
- `checkin-summary?days={window}` → adhérence + récupération
- `performance-summary?weeks={Math.ceil(window/7)}` → performance
- `metrics` → bilans for body progress

**Response:**
```typescript
{
  score: number,
  label: string,
  window: 7 | 30,
  dimensions: {
    adherence:    { score: number, weight: number, dataPoints: number },
    recovery:     { score: number, weight: number, dataPoints: number },
    bodyProgress: { score: number, weight: number, dataPoints: number, confidence: 'high' | 'low' | 'none' },
    performance:  { score: number, weight: number, dataPoints: number },
  },
  alerts: {
    dimension: 'adherence' | 'recovery' | 'bodyProgress' | 'performance',
    message: string,
    severity: 'low' | 'medium' | 'high'
  }[],
  weightsSource: 'default' | 'coach_override',
  insufficientData: boolean
}
```

Alerts are sorted by severity (high first), generated when dimension score < 50.

---

## Visual Component

### Layout — full width, top of profil page

```
┌─────────────────────────────────────────────────────────────────┐
│  SCORE DE TRANSFORMATION                          [7J]  [30J]  │
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │                          │  │  PRIORITÉS                   │ │
│  │      ╱ arc gauge ╲       │  │                              │ │
│  │     │     78      │      │  │  ● Récupération — HIGH       │ │
│  │      ╲ Sur la    ╱       │  │    Sommeil moy. 5.8h/nuit    │ │
│  │        bonne voie        │  │                              │ │
│  │                          │  │  ● Adhérence — MED           │ │
│  │  ADH   REC  CORPS  PERF  │  │    Check-in rate : 43%       │ │
│  │   85    62    88    71   │  │                              │ │
│  └──────────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Gauge SVG
- Arc ouvert en bas (210°→330°, style speedometer)
- Aiguille SVG animée via Framer Motion (spring, on mount + on window change)
- Arc rempli proportionnellement en `#1f8a65` (DS v2.0 accent)
- Score large au centre, label dessous
- DS v2.0 strict: `bg-white/[0.02]`, `border-[0.3px] border-white/[0.06]`, `rounded-2xl`

### Dimension Pills
4 pills sous le gauge: score + label court (`ADH / REC / CORPS / PERF`).
- Default: `bg-white/[0.04] text-white/50`
- Score < 50: score en `text-amber-400`
- Score < 25: score en `text-red-400`

### Alert List (right column)
- Sorted by severity (high first)
- Dot coloré: high=`text-red-400`, medium=`text-amber-400`, low=`text-white/40`
- Message court (1 ligne) + dimension label
- Empty state: "Aucune alerte — client en bonne dynamique"

### Toggle 7J / 30J
- Top-right du widget
- Local React state, re-fetch on change
- Active tab: `bg-white/[0.08] text-white`, inactive: `text-white/30`

---

## Files

### New
| File | Role |
|---|---|
| `lib/coach/transformationScore.ts` | Pure calculation logic: normalization, weighting, redistribution, alert generation, label |
| `app/api/clients/[clientId]/transformation-score/route.ts` | API route: auth, aggregate sources, call lib, return response |
| `components/coach/TransformationScoreWidget.tsx` | Full widget: gauge SVG + pills + alerts + toggle |

### Modified
| File | Change |
|---|---|
| `app/coach/clients/[clientId]/profil/page.tsx` | Add `<TransformationScoreWidget clientId={clientId} />` above existing columns |
| `supabase/migrations/YYYYMMDD_transformation_score.sql` | `ALTER TABLE coach_clients ADD COLUMN score_weights_config JSONB` |

### Tests
| File | Coverage |
|---|---|
| `tests/lib/transformationScore.test.ts` | Normalization per dimension, weight redistribution on insufficientData, label thresholds, alert generation, all 7 training_goal defaults |

---

## Verification

1. Visit `/coach/clients/[clientId]/profil` — widget renders at top full-width
2. Score gauge animates on load (Framer Motion spring)
3. Toggle 7J → 30J → different scores fetched and gauge re-animates
4. Client with missing check-ins → `insufficientData: true` → alert appears in priority list
5. Coach override weights (via direct API PATCH) → `weightsSource: 'coach_override'` in response
6. `npx tsc --noEmit` → 0 errors
7. Unit tests pass: `npx vitest run tests/lib/transformationScore.test.ts`
