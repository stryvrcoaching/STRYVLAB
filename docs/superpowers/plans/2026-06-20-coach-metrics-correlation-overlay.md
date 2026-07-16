# Coach Metrics Correlation Overlay — Implementation Plan

**Date:** 2026-06-20  
**Spec source:** [2026-06-20-coach-metrics-correlation-overlay-design.md](/Users/user/Desktop/STRYVLAB/docs/superpowers/specs/2026-06-20-coach-metrics-correlation-overlay-design.md)  
**Status:** Implementation plan ready

---

## Goal

Extend the existing coach `Vue superposée` on `/coach/clients/[clientId]/data/metriques` into a true cross-domain correlation overlay:

- keep the current relative-overlay logic
- keep current preconfigured groups + free selection
- add nutrition series
- add performance series
- add correlation-oriented groups
- add a visible correlation summary
- add an expandable detailed correlation panel

This feature must remain coherent with the existing responsibility split:

- `data metriques / vue superposée` = relative correlation reading
- `data nutrition` = detailed raw nutrition reading
- `data performance` = detailed raw performance reading

---

## Current State

### Existing UI

The overlay chart lives inside:

- [MetricsSection.tsx](/Users/user/Desktop/STRYVLAB/components/clients/MetricsSection.tsx)

Relevant current pieces:

- `METRIC_COLORS`
- `OVERLAY_GROUPS`
- `DEFAULT_OVERLAY_METRICS`
- `MultiSeriesChart`
- `MultiTooltip`
- overlay selection/filter state

The page route uses:

- [page.tsx](/Users/user/Desktop/STRYVLAB/app/coach/clients/[clientId]/data/metriques/page.tsx)

### Existing Data Source

Current metrics API:

- [route.ts](/Users/user/Desktop/STRYVLAB/app/api/clients/[clientId]/metrics/route.ts)

This route only returns:

- body/assessment series from `assessment_submissions`
- table rows for those same body measurements

It is **not** sufficient for the new overlay because it has no nutrition or performance aggregation.

---

## Delivery Strategy

Implement in 4 slices.

### Slice 1 — Overlay Data Model

Create a unified overlay-ready data model for:

- body/composition series
- recovery/well-being series
- nutrition planned/consumed series
- performance series

Recommended new module:

- `lib/coach/metricsOverlay/`

Recommended files:

- `seriesRegistry.ts`
- `groups.ts`
- `builders/body.ts`
- `builders/recovery.ts`
- `builders/nutrition.ts`
- `builders/performance.ts`
- `normalize.ts`
- `correlation.ts`
- `types.ts`

This slice should define:

- series id
- label
- family
- planned/consumed/observed mode
- chart style metadata
- group membership
- correlation eligibility

### Slice 2 — Dedicated Overlay API

Add a dedicated route instead of overloading the current `/metrics` endpoint.

Recommended route:

- `app/api/clients/[clientId]/metrics-overlay/route.ts`

Why:

- the current `/metrics` route is composition-only and table-oriented
- the overlay now becomes a mixed-source analytical endpoint
- keeping routes separate reduces coupling and regression risk

Expected API output:

```ts
{
  series: Record<string, { date: string; value: number }[]>,
  groups: Array<{
    key: string
    label: string
    desc: string
    metrics: string[]
    family: 'body' | 'recovery' | 'nutrition' | 'performance' | 'correlation'
  }>,
  metadata: Record<string, {
    label: string
    family: string
    mode: 'planned' | 'consumed' | 'observed'
    color: string
    dashed?: boolean
    correlationEligible: boolean
  }>
}
```

Data sources to aggregate:

- body metrics: `assessment_submissions` / `assessment_responses`
- recovery: likely from check-ins already used elsewhere
- nutrition consumed: existing nutrition logs / meals / daily totals
- nutrition planned: protocol day targets or currently shared protocol targets
- performance: reuse existing aggregation logic where possible from:
  - `app/api/clients/[clientId]/performance/route.ts`
  - `app/api/clients/[clientId]/performance-summary/route.ts`
  - shared libs under `lib/performance/` and `lib/coach/phaseEngine/`

This route should return already aggregated daily series whenever possible.

### Slice 3 — Overlay UI Refactor

Refactor [MetricsSection.tsx](/Users/user/Desktop/STRYVLAB/components/clients/MetricsSection.tsx) so the overlay no longer depends only on `FIELDS`.

Likely steps:

1. Extract current overlay-specific logic from `MetricsSection.tsx`
2. Introduce overlay-specific types separate from body-only metric fields
3. Replace static `OVERLAY_GROUPS` with server-fed or registry-fed overlay groups
4. Replace body-only metric chips with overlay-series chips
5. Support:
   - planned vs consumed visual distinction
   - performance family
   - correlation groups
   - quick pair shortcuts

Recommended new UI pieces:

- `components/clients/overlay/OverlaySeriesSelector.tsx`
- `components/clients/overlay/OverlayGroupChips.tsx`
- `components/clients/overlay/OverlayQuickActions.tsx`
- `components/clients/overlay/OverlayCorrelationSummary.tsx`
- `components/clients/overlay/OverlayCorrelationPanel.tsx`

Keep `MultiSeriesChart` if practical, but feed it overlay series rather than body-only field keys.

### Slice 4 — Correlation Engine

Add a bounded correlation layer that operates only on the currently visible active series.

Responsibilities:

- compare eligible visible series
- compute same-window relation score
- compute lag-aware relation score
- compute reliability
- emit:
  - 1 to 3 summary signals
  - detailed pair analyses

Recommended output:

```ts
{
  summary: Array<{
    id: string
    title: string
    direction: 'positive' | 'inverse' | 'neutral'
    strength: number
    reliability: 'low' | 'medium' | 'high'
  }>,
  details: Array<{
    id: string
    seriesA: string
    seriesB: string
    direction: 'positive' | 'inverse' | 'neutral'
    strength: number
    bestLagDays: number | null
    reliability: 'low' | 'medium' | 'high'
    explanation: string
    limitations: string[]
  }>
}
```

---

## Recommended Build Order

### Phase 1 — Data foundation

1. Create overlay types and registry
2. Define new overlay groups
3. Build nutrition series aggregation
4. Build performance series aggregation
5. Expose all overlay-ready series via new route

### Phase 2 — UI integration

1. Load overlay data from new route in `MetricsSection`
2. Replace old overlay group system with mixed-source group system
3. Add nutrition/performance manual selectors
4. Add pair shortcuts
5. Preserve current relative trend rendering

### Phase 3 — Correlation layer

1. Add correlation engine
2. Add top-level summary chips
3. Add detailed panel
4. Add reliability + limitations display

### Phase 4 — Quality and polish

1. Tune color/stroke system
2. Tune empty states and no-data logic
3. Tune performance with memoization/caching
4. Add documentation and tests

---

## Technical Decisions

### 1. Separate Overlay Route

Decision:

- use a new `/metrics-overlay` route

Why:

- avoids polluting `/metrics`
- makes mixed-source aggregation explicit
- reduces risk to the existing table/chart body metrics features

### 2. Registry-Based Series Model

Decision:

- do not hardcode the new overlay system inside the current `FIELDS` structure

Why:

- `FIELDS` is body-centric
- nutrition/performance do not belong naturally to the same schema
- registry-based series are easier to extend

### 3. Relative-Only Overlay

Decision:

- keep relative normalization only in this view

Why:

- preserves current mental model
- avoids overlapping with raw-value pages
- keeps cross-family comparisons readable

### 4. Correlation Is Interpretive

Decision:

- correlation UI must always express uncertainty

Why:

- coach utility depends on trust
- overclaiming causality would be product debt

---

## File-Level Change Map

### New

- `/Users/user/Desktop/STRYVLAB/app/api/clients/[clientId]/metrics-overlay/route.ts`
- `/Users/user/Desktop/STRYVLAB/lib/coach/metricsOverlay/types.ts`
- `/Users/user/Desktop/STRYVLAB/lib/coach/metricsOverlay/seriesRegistry.ts`
- `/Users/user/Desktop/STRYVLAB/lib/coach/metricsOverlay/groups.ts`
- `/Users/user/Desktop/STRYVLAB/lib/coach/metricsOverlay/normalize.ts`
- `/Users/user/Desktop/STRYVLAB/lib/coach/metricsOverlay/correlation.ts`
- `/Users/user/Desktop/STRYVLAB/lib/coach/metricsOverlay/builders/body.ts`
- `/Users/user/Desktop/STRYVLAB/lib/coach/metricsOverlay/builders/recovery.ts`
- `/Users/user/Desktop/STRYVLAB/lib/coach/metricsOverlay/builders/nutrition.ts`
- `/Users/user/Desktop/STRYVLAB/lib/coach/metricsOverlay/builders/performance.ts`
- `/Users/user/Desktop/STRYVLAB/components/clients/overlay/OverlaySeriesSelector.tsx`
- `/Users/user/Desktop/STRYVLAB/components/clients/overlay/OverlayGroupChips.tsx`
- `/Users/user/Desktop/STRYVLAB/components/clients/overlay/OverlayQuickActions.tsx`
- `/Users/user/Desktop/STRYVLAB/components/clients/overlay/OverlayCorrelationSummary.tsx`
- `/Users/user/Desktop/STRYVLAB/components/clients/overlay/OverlayCorrelationPanel.tsx`

### Modified

- `/Users/user/Desktop/STRYVLAB/components/clients/MetricsSection.tsx`
- `/Users/user/Desktop/STRYVLAB/app/coach/clients/[clientId]/data/metriques/page.tsx`

Possibly:

- `/Users/user/Desktop/STRYVLAB/app/api/clients/[clientId]/performance/route.ts`
- `/Users/user/Desktop/STRYVLAB/app/api/clients/[clientId]/performance-summary/route.ts`

Only if shared aggregation extraction is needed.

---

## Testing Plan

### Unit

- relative normalization for new overlay series
- planned vs consumed series building
- performance series aggregation
- correlation direction / lag / reliability scoring
- guardrails on insufficient data

Recommended test files:

- `tests/lib/coach/metricsOverlay/normalize.test.ts`
- `tests/lib/coach/metricsOverlay/nutritionSeries.test.ts`
- `tests/lib/coach/metricsOverlay/performanceSeries.test.ts`
- `tests/lib/coach/metricsOverlay/correlation.test.ts`

### API

- `/api/clients/[clientId]/metrics-overlay` ownership
- empty-state handling
- mixed-source series response shape

Recommended:

- `tests/api/clients-metrics-overlay.test.ts`

### UI

- group activation
- manual add/remove
- planned/consumed pair shortcuts
- correlation summary shown only when eligible
- detailed panel reliability states

Recommended:

- `tests/components/clients/overlay-correlation.test.tsx`

---

## Risks and Watchouts

- `MetricsSection.tsx` is already large, so feature work should extract overlay-specific components early.
- Nutrition data may have inconsistent daily coverage; reliability logic is mandatory.
- Performance data aggregation may differ between planned workouts and other training flows; decide explicitly what counts in overlay V1.
- Too many series without a strong legend system will reduce usefulness.

---

## Definition of Done

- Coach can activate nutrition and performance series inside the existing overlay view.
- Coach can activate planned and consumed nutrition series separately or together.
- Coach can use new correlation-oriented groups.
- Overlay remains relative-only and visually coherent.
- Correlation summary appears for eligible visible series.
- Detailed correlation panel explains direction, strength, lag, and reliability.
- Mixed-source overlay route is covered by tests.

---

## Recommended First Implementation Ticket

`Build overlay data foundation`

Scope:

- create series registry
- create dedicated overlay route
- expose body + recovery + nutrition + performance series in one payload
- no UI correlation panel yet

Reason:

- this de-risks all later UI work
- lets the existing overlay be migrated progressively

