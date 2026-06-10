# Transformation Phase Arc Widget — Design Spec

**Date:** 2026-05-29
**Scope:** Redesign `TransformationPhaseWidget` + layout change on coach client profil page

---

## Layout Change

Remove both widgets from the left column. Place them in a dedicated full-width row above the main 2-column grid:

```
┌─────────────────────┬─────────────────────┐
│  TransformationScore│  TransformationPhase │  ← new top row (grid-cols-2 gap-4)
│  Widget             │  Arc Widget          │
├─────────────────────┴─────────────────────┤
│  LEFT COLUMN        │  RIGHT COLUMN        │  ← existing 2-col grid (unchanged)
│  (Info, Sport, etc.)│  (Accès, Tags, etc.) │
└─────────────────────┴─────────────────────┘
```

File: `app/coach/clients/[clientId]/profil/page.tsx`
- Extract `<TransformationScoreWidget>` and `<TransformationPhaseWidget>` from the left column
- Wrap them in `<div className="grid grid-cols-2 gap-4 mb-4">`
- Leave all other content untouched

---

## TransformationPhaseWidget — Redesign

### Data source

Same fetch as current: `GET /api/clients/${clientId}/transformation-score?window=30`
Uses `data.phaseRecommendation: PhaseRecommendation` from the response.

### Phase order on arc (left → right, 7 segments)

```
deload → maintenance → fat_loss → recomp → lean_bulk → competition_prep → competition
  DL        MN          PG         RC        PM           CP               CO
```

Short labels (used under the arc): `DL / MN / PG / RC / PM / CP / CO`

### Layout sections (top → bottom)

#### 1. Header
- Left: `PHASE DE TRANSFORMATION` — `text-[9px] font-bold uppercase tracking-[0.18em] text-white/30`
- Right: `<ConfidenceDots>` + confidence label (same component from existing widget, keep it)

#### 2. Arc SVG

- **Type:** Speedometer arc, 225° sweep (start: 225°, end: 45°, clockwise)
- **7 segments** drawn as SVG `<path>` arcs with ~3° gap between each
- **Segment states:**
  - Default (inactive): `rgba(255,255,255,0.07)`
  - Current phase: `rgba(255,255,255,0.28)`
  - Optimal phase: `#1f8a65` (accent green)
  - If `matchesCurrent`: single segment styled with green only
- **Animation:** Framer Motion `motion.path` staggered opacity 0→1 (delay `i * 0.05s`), optimal segment animates last with slight scale pulse
- **Center of arc (text block):**
  - Phase icon from `PHASE_ICONS` — 28px, `text-white/60`
  - Phase name (optimal) — `text-[17px] font-bold text-white leading-tight`
  - `PHASE OPTIMALE` label — `text-[8px] uppercase tracking-[0.18em] text-white/25`
  - If `matchesCurrent`: replace label with `✓ Alignée` badge — `text-[10px] font-bold text-[#1f8a65]`

#### 3. Phase label strip

7 short labels below the arc, each horizontally positioned under its segment.
- Active (current or optimal): `text-white/60`
- Others: `text-white/15`
- Font: `text-[8px] font-bold uppercase tracking-[0.12em]`
- Implemented via `flexbox justify-between` — 7 equal-width cells, each centered under its segment

#### 4. Separator + Rationale

- `h-px bg-white/[0.05]` divider
- 2–3 rationale bullets:
  - `•` dot `text-white/20` + text `text-[11px] text-white/40 leading-snug`

### States

| State | Behavior |
|-------|----------|
| Loading | Spinner centered (same as current) |
| `rec` present | Full arc + labels + rationale |
| `rec` null | `"Données insuffisantes"` centered text |

### Files

| File | Change |
|------|--------|
| `components/coach/TransformationPhaseWidget.tsx` | Full rewrite |
| `app/coach/clients/[clientId]/profil/page.tsx` | Layout restructure only |

### No data model changes

No API changes, no schema changes, no new routes. Pure UI/layout work.

---

## Non-negotiable DS rules (coach web — DS v2.0)

- Background: `#121212` on `<main>` — unchanged
- Card: `bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl`
- Accent: `#1f8a65`
- No shadows, no colored gradients on card backgrounds
- Framer Motion for all animations
