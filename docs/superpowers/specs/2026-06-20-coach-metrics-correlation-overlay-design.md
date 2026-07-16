# Coach Metrics Correlation Overlay — Design Spec

**Date:** 2026-06-20  
**Feature:** Coach Data Metrics — Superposed Correlation Overlay  
**Status:** Validated design, ready for implementation planning

---

## Understanding Summary

- The existing coach metrics page already includes a `graphique superposé` with preconfigured groups and free metric toggling.
- This view should evolve into a true `correlation view` for coaches, without replacing the existing detailed nutrition and performance analytics pages.
- The overlay chart must stay aligned with the current model: each selected series is shown in **relative evolution**, starting at `0%` on the first point of the filtered period.
- The main product goal is to help coaches visually cross nutrition, body composition, recovery, and performance trends on a single chart.
- Nutrition and performance values in their raw units remain the responsibility of `data nutrition`, `data performance`, `nutrition studio`, and `workout studio`.
- The enhanced overlay must support both `preconfigured groups` and `free manual selection` of series.
- The feature should add a `visible correlation layer` plus a `detailed analysis panel`, while staying explicit that it suggests plausible relationships rather than proving causality.

---

## Why This Exists

Coaches can already inspect body and recovery metrics in a relative overlay, but they cannot yet cross those trends against nutrition intake and performance signals inside the same view. This prevents fast coach-level reads such as:

- rising protein intake vs muscle mass progression
- falling performance vs continued fat loss
- sleep degradation vs RPE increase
- carb intake changes vs volume or completion trends

The overlay chart should become a fast trans-domain interpretation layer, while the existing nutrition and performance pages remain the detailed source of truth for raw values.

---

## Users

- Primary: coach reviewing one client profile and looking for actionable cross-domain patterns
- Secondary: coach validating whether body change, recovery, and performance trends are coherent with the nutrition protocol

---

## Explicit Non-Goals

- This feature does **not** replace nutrition analytics pages
- This feature does **not** replace performance analytics pages
- This feature does **not** display universal raw-value charts for every selected series
- This feature does **not** claim scientific causality between signals
- This feature does **not** attempt to become a full data science workbench

---

## Assumptions

- The current overlay chart already supports grouped activation and manual metric toggling.
- Relative evolution is already accepted by coaches as the right abstraction for this page.
- Nutrition series can be derived from existing consumed and planned nutrition data.
- Performance series can be derived from existing performance aggregation signals.
- The page has sufficient room to add a compact correlation summary and an expandable detail panel.

---

## Product Decision

The existing `graphique superposé` remains the entry point and becomes a `coach correlation overlay`.

It keeps:

- relative trend logic
- current group-based activation model
- manual add/remove metric behavior

It gains:

- nutrition series
- performance series
- correlation-oriented cross-domain groups
- quick pair shortcuts
- correlation summary signals
- detailed correlation interpretation panel

---

## Core Interaction Model

### Existing Behavior To Preserve

- Filtered time window defines the active period
- Each active series starts at `0%` on the first point of the filtered period
- Clicking a group activates a preconfigured bundle of metrics
- Coaches can manually add or remove individual series

### New Behavior To Add

- Add nutrition and performance series to the same selection model
- Support planned and consumed nutrition series
- Support cross-domain preconfigured groups
- Show immediate correlation signals based on currently active series
- Allow opening a detailed correlation analysis panel

---

## Series Families

### Body / Composition

Existing and still relevant:

- weight
- body fat
- lean mass
- muscle mass
- key body measurements already exposed by the overlay page

### Recovery / Well-Being

Existing and still relevant:

- sleep
- energy
- stress
- soreness
- other current recovery signals already available in the overlay page

### Nutrition

New:

- proteins consumed
- proteins planned
- carbs consumed
- carbs planned
- fats consumed
- fats planned
- calories consumed
- calories planned
- hydration consumed
- hydration planned

### Performance

New V1 scope:

- average RIR
- average RPE
- total volume
- average load
- completion rate

---

## Display Logic

### Relative-Only View

This overlay remains a **relative comparison view only**.

Reasons:

- It stays coherent with the current chart mental model.
- It avoids overlapping responsibilities with nutrition and performance detail pages.
- It makes heterogeneous families visually comparable on one chart.

### Planned vs Consumed

Nutrition series must support:

- individual selection (`proteins consumed`)
- pair shortcuts (`proteins planned + proteins consumed`)

Planned vs consumed should use a consistent visual relationship:

- same family color
- distinct stroke style, brightness, or dash pattern

Example:

- proteins planned = dashed
- proteins consumed = solid

---

## Preconfigured Groups

### Preserve Existing Groups

- recomposition
- body ratio
- metabolic risk
- limb measurements
- trunk measurements
- recovery and well-being

### Add New Nutrition Groups

- nutrition consumed
- nutrition planned
- protein intake
- carbohydrate intake
- hydration trend

### Add New Performance Groups

- effort and fatigue
- training output
- completion quality

### Add New Correlation Groups

- nutrition vs composition
- nutrition vs performance
- recovery vs performance
- calories vs fat loss
- proteins vs muscle mass
- carbs vs training output
- sleep vs performance

These groups should be designed as coach-first bundles, not raw database categories.

---

## Correlation Layer

### Immediate Signals

The UI should show 1 to 3 short high-signal interpretations based on currently active series.

Examples:

- `Positive relation: proteins consumed vs muscle mass`
- `Inverse relation: sleep vs RPE`
- `Performance drop compatible with calorie deficit`
- `Weak relation: signal too noisy`

These signals are not permanent truths. They are contextual outputs derived from the currently active overlay.

### Detailed Panel

The detailed panel expands the interpretation and should display:

- series compared
- direction: positive / inverse / neutral
- strength of relation
- probable lag
- reliability level
- explicit limits

The panel must clearly state that this is an interpretive relationship read, not proof of causality.

---

## Correlation Computation Principles

### Purpose

Help coaches spot plausible patterns, not publish scientific certainty.

### Suggested Method

For selected compatible series:

- compute same-window trend alignment
- compute simple relationship score
- compute lag-aware relationship score
- compare:
  - same-day relation
  - short lag relation (`J+1`, `J+2`, up to `~7d` depending on metric family)
  - rolling-smoothed relation where relevant

### Output Shape

Each compared pair should produce something like:

```ts
{
  seriesA: 'protein_consumed',
  seriesB: 'muscle_mass',
  direction: 'positive' | 'inverse' | 'neutral',
  strength: number, // 0..100
  bestLagDays: number | null,
  reliability: 'low' | 'medium' | 'high',
  explanation: string,
  limitations: string[],
}
```

### Guardrails

Do not emit strong conclusions when:

- too few data points
- poor time coverage
- highly irregular spacing
- one or both series are too noisy
- selected series are semantically poor comparison candidates

---

## Reliability Model

Reliability should account for:

- number of points on each active series
- overlap quality between the two series
- recency of the active period
- smoothness vs volatility
- amount of inferred / missing data

This reliability should be shown in both:

- quick summary
- detailed panel

---

## Time Logic

The chart remains bound to the currently selected filtered period.

Relative normalization is computed on:

- the first point inside the filtered window
- only for the active selected series

Correlation analysis should use:

- the same active period
- only active visible series
- optional lag testing inside that period

No second independent time mode is introduced in this view.

---

## UX Rules

### Selection Model

- No hard limit on selected curves
- Preserve current free-stacking philosophy
- Keep chart usable through visual design rather than blocking selection

### Visual Safeguards

- stable color family by metric domain
- consistent visual encoding for planned vs consumed
- domain-aware legend
- visible active-series chips or badges
- correlation panel derived strictly from visible active series

### Smart Shortcuts

Examples:

- `Add planned + consumed`
- `Add sleep + RPE`
- `Add carbs + volume`
- `Add proteins + muscle mass`

These accelerate common coach workflows without blocking manual configuration.

---

## Technical Shape

### Recommended Registry Model

Create a unified `overlay series registry` so every series declares:

- id
- label
- family
- source
- relative transformation rule
- default color/stroke style
- whether it is `planned`, `consumed`, or `observed`
- whether it is allowed in correlation analysis

Example:

```ts
type OverlaySeriesDefinition = {
  id: string
  label: string
  family: 'body' | 'recovery' | 'nutrition' | 'performance'
  mode: 'planned' | 'consumed' | 'observed'
  correlationEligible: boolean
  buildSeries: (input: OverlayDataContext) => { date: string; value: number }[]
  chartStyle: {
    color: string
    dashed?: boolean
  }
}
```

This avoids scattering chart behavior across multiple page-specific branches.

### Data Layer

The overlay should consume pre-aggregated time-aligned series, not fetch raw records ad hoc per curve render.

Recommended pipeline:

- page route or API builds all available overlay-ready time series for the selected window
- UI selects among already-built series
- correlation engine runs on currently active series

---

## Non-Functional Requirements

### Performance

- chart must stay responsive with many active series
- aggregation should happen before rendering
- correlation calculations should be bounded and cached per active configuration when possible

### Scale

- must work across short and medium windows without UI freeze
- should tolerate many available series even if the coach activates many at once

### Reliability

- never overstate certainty
- always communicate reliability and limitations

### Security

- no new permission model
- continue using existing coach-scoped access rules

### Maintenance

- new series should be added through registry/config, not bespoke chart code each time

---

## Risks

- Too many visible curves may become unreadable without strong legend and style rules
- Correlation wording can easily over-promise causality if not carefully phrased
- Nutrition and performance data quality may be uneven, reducing confidence
- Lag-aware correlation can become misleading if presented without reliability thresholds

---

## Recommended Delivery Strategy

### Phase 1

- integrate nutrition and performance series into the existing overlay
- preserve current relative logic
- add new groups and free selection
- add planned vs consumed series and pair shortcuts

### Phase 2

- add immediate correlation summary layer
- add detailed correlation panel
- add reliability model and lag-aware interpretation

### Phase 3

- refine smart recommendations and coach-oriented insights based on actual usage patterns

---

## Decision Log

- Decided: enrich the existing superposed metrics chart instead of creating a separate view.
- Decided: keep this chart as a relative-evolution view only.
- Decided: preserve `groups + free manual selection`.
- Decided: add nutrition and performance as new selectable families.
- Decided: support both single-series selection and fast planned/consumed pair activation.
- Decided: add a visible correlation summary plus a detailed interpretation panel.
- Decided: make correlation outputs probabilistic and coach-readable, not causal claims.
- Decided: include lag-aware correlation logic for stronger coach interpretation value.
- Decided: use a unified overlay series registry for maintainable implementation.

