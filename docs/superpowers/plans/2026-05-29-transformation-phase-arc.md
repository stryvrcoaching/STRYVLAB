# Transformation Phase Arc Widget — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `TransformationPhaseWidget` as a speedometer arc (7 phases) and move both transformation widgets side-by-side in a dedicated top row on the coach client profil page.

**Architecture:** Pure UI change — same API endpoint (`/api/clients/[clientId]/transformation-score?window=30`), same data types. Two files modified: layout in `profil/page.tsx`, full rewrite of `TransformationPhaseWidget.tsx`.

**Tech Stack:** Next.js App Router, React, Framer Motion, SVG (hand-drawn arc paths), Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `app/coach/clients/[clientId]/profil/page.tsx` | Extract both widgets from left column, add dedicated 2-col top row |
| `components/coach/TransformationPhaseWidget.tsx` | Full rewrite — speedometer SVG arc |

---

### Task 1: Layout restructure — profil/page.tsx

**Files:**
- Modify: `app/coach/clients/[clientId]/profil/page.tsx`

- [ ] **Step 1: Read the current file**

Open `app/coach/clients/[clientId]/profil/page.tsx`. Find the `return` block. The current structure inside `<main>` is:

```tsx
<main className="min-h-screen bg-[#121212]">
  <div className="px-6 pb-24">
    <div className="grid grid-cols-2 gap-4 items-start">

      {/* ── COLONNE GAUCHE ── */}
      <div className="flex flex-col gap-4">
        <TransformationScoreWidget clientId={clientId} />
        <TransformationPhaseWidget clientId={clientId} />
        {/* ... rest of left col ... */}
      </div>

      {/* ── COLONNE DROITE ── */}
      <div className="flex flex-col gap-4">
        {/* ... right col ... */}
      </div>
    </div>
  </div>
</main>
```

- [ ] **Step 2: Restructure the layout**

Replace the inner `<div className="px-6 pb-24">` content with the new two-row structure below. The two widget lines move OUT of the left column into a dedicated top row:

```tsx
<div className="px-6 pb-24">
  {/* ── Widgets transformation — pleine largeur ── */}
  <div className="grid grid-cols-2 gap-4 mb-4">
    <TransformationScoreWidget clientId={clientId} />
    <TransformationPhaseWidget clientId={clientId} />
  </div>

  {/* ── Grille 2 colonnes ── */}
  <div className="grid grid-cols-2 gap-4 items-start">

    {/* ── COLONNE GAUCHE ── */}
    <div className="flex flex-col gap-4">
      {/* ── Informations ── */}
      <Card>
        {/* ... (unchanged) */}
      </Card>

      {/* ── Profil sportif ... ── */}
      <Card>
        {/* ... (unchanged) */}
      </Card>

      {/* Zone dangereuse */}
      <div className="bg-red-950/20 ...">
        {/* ... (unchanged) */}
      </div>
    </div>

    {/* ── COLONNE DROITE ── */}
    <div className="flex flex-col gap-4">
      {/* ... (unchanged) */}
    </div>
  </div>
</div>
```

The only change: remove `<TransformationScoreWidget>` and `<TransformationPhaseWidget>` from the left column flex stack and place them in the new top `grid grid-cols-2 gap-4 mb-4` row. All other content is untouched.

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit
```

Expected: 0 errors. If errors → fix before continuing.

- [ ] **Step 4: Commit**

```bash
git add app/coach/clients/[clientId]/profil/page.tsx
git commit -m "refactor(profil): move transformation widgets to full-width top row"
```

---

### Task 2: TransformationPhaseWidget — full rewrite

**Files:**
- Modify: `components/coach/TransformationPhaseWidget.tsx`

- [ ] **Step 1: Understand the SVG arc geometry**

The arc is a 270° speedometer drawn with 7 arc path segments. Key constants:

```
Center: (CX=130, CY=150)
Radius: R=90
ViewBox: "0 0 260 218"
Start angle (compass): 225° (lower-left, ~8 o'clock)
Total sweep: 270° clockwise → ends at 135° (lower-right, ~4 o'clock)
Segments: 7
Gap between segments: 3°
Segment sweep: (270 - 3×6) / 7 = 252/7 = 36°
Stride (segment + gap): 39°
```

Compass → SVG coordinates (y-axis inverted):
```
x = CX + R × sin(deg × π/180)
y = CY - R × cos(deg × π/180)
```

Segment i (0-indexed):
```
startDeg = 225 + i × 39
endDeg   = 225 + i × 39 + 36
```

All segments have sweep = 36° < 180°, so `largeArc = 0` always.

Phase order on arc (left → right, i = 0 → 6):
```
deload → maintenance → fat_loss → recomp → lean_bulk → competition_prep → competition
```

- [ ] **Step 2: Write the full component**

Replace the entire content of `components/coach/TransformationPhaseWidget.tsx` with:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  TrendingDown, TrendingUp, RefreshCw,
  Target, Trophy, Minus, Zap,
} from 'lucide-react'
import type {
  TransformationScoreResult,
  TransformationPhase,
  PhaseRecommendation,
} from '@/lib/coach/transformationScore'

// ── Phase metadata ─────────────────────────────────────────────────────────────

const PHASES: TransformationPhase[] = [
  'deload', 'maintenance', 'fat_loss', 'recomp',
  'lean_bulk', 'competition_prep', 'competition',
]

const PHASE_LABELS: Record<TransformationPhase, string> = {
  fat_loss:         'Perte de gras',
  lean_bulk:        'Prise de masse',
  recomp:           'Recomposition',
  competition_prep: 'Pré-compétition',
  competition:      'Compétition',
  maintenance:      'Maintenance',
  deload:           'Recharge',
}

const PHASE_SHORT: Record<TransformationPhase, string> = {
  deload:           'DL',
  maintenance:      'MN',
  fat_loss:         'PG',
  recomp:           'RC',
  lean_bulk:        'PM',
  competition_prep: 'CP',
  competition:      'CO',
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

const CONFIDENCE_LABELS: Record<'high' | 'medium' | 'low', string> = {
  high:   'Haute confiance',
  medium: 'Confiance moyenne',
  low:    'Données insuffisantes',
}

// ── SVG arc helpers ────────────────────────────────────────────────────────────

const CX = 130
const CY = 150
const R  = 90
const START_DEG    = 225
const SEGMENT_SWEEP = (270 - 3 * 6) / 7   // ≈ 36°
const STRIDE        = SEGMENT_SWEEP + 3    // ≈ 39°

function compassToXY(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180
  return { x: CX + R * Math.sin(rad), y: CY - R * Math.cos(rad) }
}

function arcD(startDeg: number, endDeg: number): string {
  const s = compassToXY(startDeg)
  const e = compassToXY(endDeg)
  return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${R} ${R} 0 0 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`
}

function segmentColor(phase: TransformationPhase, rec: PhaseRecommendation): string {
  if (phase === rec.phase) return '#1f8a65'
  if (!rec.matchesCurrent && phase === rec.currentMappedPhase) return 'rgba(255,255,255,0.28)'
  return 'rgba(255,255,255,0.07)'
}

function isActiveLabel(phase: TransformationPhase, rec: PhaseRecommendation): boolean {
  return phase === rec.phase || (!rec.matchesCurrent && phase === rec.currentMappedPhase)
}

// ── Confidence dots ────────────────────────────────────────────────────────────

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

// ── Main widget ────────────────────────────────────────────────────────────────

interface Props { clientId: string }

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
  const OptimalIcon = rec ? PHASE_ICONS[rec.phase] : null

  return (
    <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
          Phase de transformation
        </p>
        {rec && (
          <div className="flex items-center gap-1.5">
            <ConfidenceDots level={rec.confidence} />
            <span className="text-[9px] text-white/25 uppercase tracking-[0.1em]">
              {CONFIDENCE_LABELS[rec.confidence]}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-[180px] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      ) : rec ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Arc + center text */}
          <div className="relative">
            <svg
              viewBox="0 0 260 218"
              className="w-full"
              aria-hidden="true"
            >
              {PHASES.map((phase, i) => {
                const startDeg = START_DEG + i * STRIDE
                const endDeg   = startDeg + SEGMENT_SWEEP
                return (
                  <motion.path
                    key={phase}
                    d={arcD(startDeg, endDeg)}
                    stroke={segmentColor(phase, rec)}
                    strokeWidth={20}
                    fill="none"
                    strokeLinecap="round"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                  />
                )
              })}
            </svg>

            {/* Center text overlay */}
            <div
              className="absolute flex flex-col items-center gap-1 pointer-events-none"
              style={{ top: '42%', left: '50%', transform: 'translate(-50%, -50%)' }}
            >
              {OptimalIcon && (
                <OptimalIcon className="w-7 h-7 text-white/50 mb-0.5" />
              )}
              <p className="text-[17px] font-bold text-white leading-none text-center">
                {PHASE_LABELS[rec.phase]}
              </p>
              {rec.matchesCurrent ? (
                <span className="text-[10px] font-bold text-[#1f8a65] tracking-[0.06em] mt-0.5">
                  ✓ Alignée
                </span>
              ) : (
                <p className="text-[8px] uppercase tracking-[0.18em] text-white/25 mt-0.5">
                  Phase optimale
                </p>
              )}
            </div>
          </div>

          {/* Phase label strip */}
          <div className="flex justify-between px-1 -mt-5 mb-4">
            {PHASES.map(phase => (
              <span
                key={phase}
                className={`text-[8px] font-bold uppercase tracking-[0.12em] ${
                  isActiveLabel(phase, rec) ? 'text-white/60' : 'text-white/15'
                }`}
              >
                {PHASE_SHORT[phase]}
              </span>
            ))}
          </div>

          {/* Rationale */}
          {rec.rationale.length > 0 && (
            <>
              <div className="h-px bg-white/[0.05] mb-3" />
              <div className="space-y-2">
                {rec.rationale.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-white/20 mt-0.5 flex-shrink-0 select-none">•</span>
                    <p className="text-[11px] text-white/40 leading-snug">{r}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      ) : (
        <p className="text-[11px] text-white/30 text-center py-10">Données insuffisantes</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit
```

Expected: 0 errors. Common issues to watch:
- `React.ElementType` import — ensure `React` is in scope (it is via JSX transform, but `React.ElementType` type needs explicit `import React from 'react'` or use `ElementType` from react directly)
- If `React.ElementType` causes error, replace with `import type { ElementType } from 'react'` and use `ElementType` instead

Fix: if `React.ElementType` errors, add `import type { ElementType } from 'react'` at top and change `React.ElementType` → `ElementType` in `PHASE_ICONS` type and `OptimalIcon` type.

- [ ] **Step 4: Commit**

```bash
git add components/coach/TransformationPhaseWidget.tsx
git commit -m "feat(profil): redesign TransformationPhaseWidget as speedometer arc (7 phases)"
```

---

### Task 3: CHANGELOG + visual verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update CHANGELOG**

Open `CHANGELOG.md`. Add at the TOP of the `## 2026-05-29` section (or create it):

```
## 2026-05-29

FEATURE: Redesign TransformationPhaseWidget — speedometer SVG arc, 7 phase segments, Framer Motion stagger
REFACTOR: Move transformation widgets to dedicated full-width top row on coach client profil page
```

- [ ] **Step 2: Final TypeScript check**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "chore: update CHANGELOG for phase arc widget"
```

---

## Visual Tuning Notes

After implementation, check these visually in the browser:

1. **Center text position** — The overlay uses `top: 42%`. If the phase name appears too low/high within the arc bowl, adjust this value (try `38%`–`48%`).
2. **Label strip spacing** — The `-mt-5` on the label strip pulls it up under the arc. If labels overlap the arc, increase to `-mt-4` or `-mt-3`.
3. **Arc width** — `strokeWidth={20}` gives ~20px thick segments. Increase to `22` or `24` if it looks thin.
4. **Phase name wrapping** — `Pré-compétition` is long. If it wraps badly in center, add `whitespace-nowrap` or reduce font to `text-[14px]`.
