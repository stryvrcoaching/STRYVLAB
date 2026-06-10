# Tempo Guide Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-screen tempo guide modal (style Technogym) with a sinusoidal SVG path, animated ball with comet trail, phase diamonds, rep bars, and haptic feedback — triggered by a ▶ button per set in SessionLogger.

**Architecture:** Two changes only. (1) New `components/client/TempoGuideModal.tsx` — fully self-contained, RAF-driven, zero external deps beyond Framer Motion. DOM mutations direct on SVG refs inside the loop — no React state in the hot path. (2) SessionLogger gets `tempoGuideTarget` state + a ▶ button per set row + modal render.

**Tech Stack:** React 18, Framer Motion (already in project), SVG, `requestAnimationFrame`, `navigator.vibrate`, `lib/training/tempo.ts` (already exists — `parseTempo`, `getDefaultTempo`).

---

## File Map

| File | Action | Role |
|------|--------|------|
| `components/client/TempoGuideModal.tsx` | Create | Full-screen tempo guide — SVG path, ball, trail, diamonds, rep bars, haptics |
| `app/client/programme/session/[sessionId]/SessionLogger.tsx` | Modify | Add `tempoGuideTarget` state + ▶ button per set + modal render |

---

## Task 1: TempoGuideModal — Static Shell

Build the visual structure with no animation yet. Verify it renders correctly before adding the RAF loop.

**Files:**
- Create: `components/client/TempoGuideModal.tsx`

- [ ] **Step 1: Create the file with all imports and static structure**

```tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { parseTempo, type ParsedTempo } from '@/lib/training/tempo'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TempoGuideModalProps {
  tempo: string          // already resolved (coach value or getDefaultTempo result)
  reps: number           // planned reps for this set
  exerciseName: string
  onClose: () => void    // called on manual close OR end of last rep
}

// Phase names in French
const PHASE_LABELS = ['DESCENTE', 'PAUSE BAS', 'MONTÉE', 'PAUSE HAUT'] as const
const ACCENT = '#FFB800'

// ─── SVG Path definition ─────────────────────────────────────────────────────
// Sinusoidal path crossing full width. 4 phases correspond to positions:
//   0.0  → start ECC (top-left)
//   0.25 → ECC→PB transition (bottom)
//   0.50 → PB→CON transition (bottom)
//   0.75 → CON→PH transition (top)
//   1.0  → end PH (top-right) = wrap to next rep
//
// The path is drawn in a 400×180 viewBox, scaled by SVG preserveAspectRatio.
// Control points tuned to match Technogym's smooth S-curve.
const PATH_D = 'M 0,45 C 40,45 60,155 100,155 C 140,155 160,45 200,45 C 240,45 260,155 300,155 C 340,155 360,45 400,45'

// Normalised t-values for each phase boundary on the path (0→1)
// ECC: 0.00→0.25, PB: 0.25→0.50, CON: 0.50→0.75, PH: 0.75→1.00
const PHASE_START = [0, 0.25, 0.50, 0.75]
const PHASE_END   = [0.25, 0.50, 0.75, 1.00]

// Easing functions
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}
function linear(t: number): number {
  return t
}
const PHASE_EASING = [easeInOut, linear, easeInOut, linear]

// ─── Haptic helper ───────────────────────────────────────────────────────────
function vibrate(pattern: number | number[]) {
  try { navigator.vibrate(pattern) } catch { /* not supported */ }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TempoGuideModal({
  tempo, reps, exerciseName, onClose,
}: TempoGuideModalProps) {
  const parsed = parseTempo(tempo)

  // If tempo can't be parsed, render nothing
  if (!parsed) return null

  return (
    <TempoGuideModalInner
      parsed={parsed}
      reps={reps}
      exerciseName={exerciseName}
      onClose={onClose}
    />
  )
}

// Inner component receives validated parsed tempo
function TempoGuideModalInner({
  parsed, reps, exerciseName, onClose,
}: {
  parsed: ParsedTempo
  reps: number
  exerciseName: string
  onClose: () => void
}) {
  // Phase durations in ms. "X" = 300ms. 0 = instant (skip).
  const phaseDurations: number[] = [
    parsed.eccentric  === 'X' ? 300 : (parsed.eccentric  as number) * 1000,
    parsed.pauseBottom=== 'X' ? 300 : (parsed.pauseBottom as number) * 1000,
    parsed.concentric === 'X' ? 300 : (parsed.concentric  as number) * 1000,
    parsed.pauseTop   === 'X' ? 300 : (parsed.pauseTop    as number) * 1000,
  ]
  const repDuration = phaseDurations.reduce((a, b) => a + b, 0)

  // React state — only updated on phase/rep changes (not every frame)
  const [currentPhase, setCurrentPhase] = useState(0)
  const [currentRep, setCurrentRep] = useState(0)
  const [done, setDone] = useState(false)

  // SVG refs — mutated directly in RAF loop
  const svgRef      = useRef<SVGSVGElement>(null)
  const pathRef     = useRef<SVGPathElement>(null)
  const ballRef     = useRef<SVGCircleElement>(null)
  const ballGlowRef = useRef<SVGCircleElement>(null)
  const trailRefs   = useRef<SVGCircleElement[]>([])
  const diamondRefs = useRef<SVGPolygonElement[]>([])

  // RAF state (mutable, not state)
  const rafRef       = useRef<number>(0)
  const startRef     = useRef<number | null>(null)
  const phaseRef     = useRef(0)
  const repRef       = useRef(0)
  const trailBuf     = useRef<{ x: number; y: number }[]>([])
  const TRAIL_LEN    = 10
  const lastPhaseRef = useRef(-1)

  // ── Closing ──
  const [closing, setClosing] = useState(false)
  const handleClose = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    setClosing(true)
  }, [])

  // ── RAF Loop ──
  const tick = useCallback((now: number) => {
    if (!pathRef.current || !ballRef.current || !ballGlowRef.current) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }

    if (startRef.current === null) startRef.current = now
    const elapsed = now - startRef.current

    // Global position in current rep: 0→1
    let tRep = (elapsed % repDuration) / repDuration
    const repIndex = Math.floor(elapsed / repDuration)

    // Rep complete
    if (repIndex >= reps) {
      // Move ball to end position
      const totalLen = pathRef.current.getTotalLength()
      const pt = pathRef.current.getPointAtLength(totalLen)
      ballRef.current.setAttribute('cx', String(pt.x))
      ballRef.current.setAttribute('cy', String(pt.y))
      ballGlowRef.current.setAttribute('cx', String(pt.x))
      ballGlowRef.current.setAttribute('cy', String(pt.y))
      vibrate([100, 40, 100, 40, 100])
      setDone(true)
      return
    }

    // Update rep state (React re-render for bars/counter)
    if (repIndex !== repRef.current) {
      repRef.current = repIndex
      setCurrentRep(repIndex)
      vibrate([70, 30, 70])
    }

    // Determine current phase from tRep
    let cumulative = 0
    let phase = 0
    let tInPhase = 0
    for (let i = 0; i < 4; i++) {
      const phaseFrac = phaseDurations[i] / repDuration
      if (phaseFrac === 0) continue // skip instant phases
      if (tRep < cumulative + phaseFrac) {
        phase = i
        tInPhase = (tRep - cumulative) / phaseFrac
        break
      }
      cumulative += phaseFrac
      phase = i
      tInPhase = 1
    }

    // Phase change → haptic + React state update
    if (phase !== lastPhaseRef.current) {
      lastPhaseRef.current = phase
      setCurrentPhase(phase)
      if (phase === 1) vibrate(40)       // ECC→PB
      else if (phase === 2) vibrate(70)  // PB→CON
      else if (phase === 3) vibrate(40)  // CON→PH
    }

    // Position on path
    const easedT = PHASE_EASING[phase](Math.min(tInPhase, 1))
    const pathT = PHASE_START[phase] + easedT * (PHASE_END[phase] - PHASE_START[phase])
    const totalLen = pathRef.current.getTotalLength()
    const pt = pathRef.current.getPointAtLength(pathT * totalLen)

    // Move ball
    ballRef.current.setAttribute('cx', String(pt.x))
    ballRef.current.setAttribute('cy', String(pt.y))
    ballGlowRef.current.setAttribute('cx', String(pt.x))
    ballGlowRef.current.setAttribute('cy', String(pt.y))

    // Update trail buffer
    trailBuf.current.unshift({ x: pt.x, y: pt.y })
    if (trailBuf.current.length > TRAIL_LEN) trailBuf.current.length = TRAIL_LEN
    trailRefs.current.forEach((el, i) => {
      if (!el) return
      const pos = trailBuf.current[i]
      if (!pos) { el.setAttribute('opacity', '0'); return }
      el.setAttribute('cx', String(pos.x))
      el.setAttribute('cy', String(pos.y))
      el.setAttribute('opacity', String(((TRAIL_LEN - i) / TRAIL_LEN) * 0.4))
      el.setAttribute('r', String(9 - i * 0.8))
    })

    // Diamond pulse: brighten when ball is within 0.04 of transition point
    const transitionPts = [0.25, 0.50, 0.75]
    diamondRefs.current.forEach((el, i) => {
      if (!el) return
      const dist = Math.abs(pathT - transitionPts[i])
      const opacity = dist < 0.04 ? 1.0 : 0.6
      el.setAttribute('opacity', String(opacity))
      const scale = dist < 0.04 ? 1.4 : 1.0
      const dPt = pathRef.current!.getPointAtLength(transitionPts[i] * totalLen)
      el.setAttribute('transform', `translate(${dPt.x}, ${dPt.y}) scale(${scale})`)
    })

    rafRef.current = requestAnimationFrame(tick)
  }, [reps, repDuration, phaseDurations])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [tick])

  // Auto-close when done
  useEffect(() => {
    if (done) {
      const t = setTimeout(() => setClosing(true), 400)
      return () => clearTimeout(t)
    }
  }, [done])

  // Positions of 3 diamond transition points on path (computed once after mount)
  const [diamondPositions, setDiamondPositions] = useState<{ x: number; y: number }[]>([])
  useEffect(() => {
    if (!pathRef.current) return
    const len = pathRef.current.getTotalLength()
    setDiamondPositions([0.25, 0.50, 0.75].map(t => pathRef.current!.getPointAtLength(t * len)))
  }, [])

  return (
    <AnimatePresence onExitComplete={onClose}>
      {!closing && (
        <motion.div
          key="tempo-guide"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 bg-[#080808] z-[60] flex flex-col select-none"
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between px-6 pt-6 pb-2 shrink-0">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Tempo guide</p>
              <p className="text-[14px] font-bold text-white leading-tight truncate max-w-[220px]">{exerciseName}</p>
            </div>
            <button
              onClick={handleClose}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.10] transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* ── SVG Circuit ── */}
          <div className="flex-1 flex items-center px-4">
            <svg
              ref={svgRef}
              viewBox="0 0 400 180"
              preserveAspectRatio="xMidYMid meet"
              className="w-full"
              style={{ overflow: 'visible' }}
            >
              {/* Glow track */}
              <path
                d={PATH_D}
                fill="none"
                stroke={`rgba(255,184,0,0.08)`}
                strokeWidth="32"
                strokeLinecap="round"
              />
              {/* Base track */}
              <path
                d={PATH_D}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="28"
                strokeLinecap="round"
              />
              {/* Invisible path for getPointAtLength */}
              <path ref={pathRef} d={PATH_D} fill="none" stroke="none" />

              {/* Trail circles */}
              {Array.from({ length: TRAIL_LEN }).map((_, i) => (
                <circle
                  key={i}
                  ref={el => { if (el) trailRefs.current[i] = el }}
                  r="9"
                  fill="white"
                  opacity="0"
                />
              ))}

              {/* Diamond transition markers */}
              {diamondPositions.map((pos, i) => (
                <polygon
                  key={i}
                  ref={el => { if (el) diamondRefs.current[i] = el }}
                  points="-7,0 0,-7 7,0 0,7"
                  fill={ACCENT}
                  opacity="0.6"
                  transform={`translate(${pos.x}, ${pos.y})`}
                  style={{ filter: `drop-shadow(0 0 6px ${ACCENT})` }}
                />
              ))}

              {/* Ball glow (larger, lower opacity) */}
              <circle
                ref={ballGlowRef}
                r="18"
                fill={ACCENT}
                opacity="0.25"
              />

              {/* Ball */}
              <circle
                ref={ballRef}
                r="10"
                fill="white"
                style={{ filter: `drop-shadow(0 0 14px rgba(255,184,0,0.9))` }}
              />
            </svg>
          </div>

          {/* ── Phase Label ── */}
          <div className="shrink-0 flex justify-center items-center gap-3 px-6 pb-4" style={{ height: 40 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPhase}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex items-baseline gap-2"
              >
                <span className="font-mono text-[13px] font-bold uppercase tracking-[0.2em] text-white">
                  {PHASE_LABELS[currentPhase]}
                </span>
                <span className="font-mono text-[11px] text-white/40">
                  {(() => {
                    const v = [parsed.eccentric, parsed.pauseBottom, parsed.concentric, parsed.pauseTop][currentPhase]
                    return v === 'X' ? 'X' : `${v}s`
                  })()}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Rep bars ── */}
          <div className="shrink-0 px-6 pb-4">
            <div className="flex gap-[3px]" style={{ height: 36 }}>
              {Array.from({ length: reps }).map((_, i) => (
                <motion.div
                  key={i}
                  className="flex-1 rounded-[2px]"
                  animate={{
                    backgroundColor: i < currentRep
                      ? ACCENT
                      : i === currentRep
                      ? ACCENT
                      : 'rgba(255,255,255,0.10)',
                    boxShadow: i === currentRep
                      ? `0 0 12px rgba(255,184,0,0.55)`
                      : 'none',
                  }}
                  initial={false}
                  transition={{ duration: 0.2 }}
                />
              ))}
            </div>
          </div>

          {/* ── Rep Counter ── */}
          <div className="shrink-0 flex justify-center pb-10">
            <p className="font-mono text-[28px] font-black text-white tracking-tight">
              <span style={{ color: ACCENT }}>{currentRep + 1}</span>
              <span className="text-white/30 text-[20px] mx-1">/</span>
              <span>{reps}</span>
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -v node_modules | grep "TempoGuideModal"
```

Expected: no output (no errors in this file).

- [ ] **Step 3: Commit**

```bash
git add components/client/TempoGuideModal.tsx
git commit -m "feat(tempo-guide): TempoGuideModal — sinusoidal SVG path, RAF ball animation, haptics, rep bars"
```

---

## Task 2: Wire into SessionLogger

Add the ▶ button per set row, `tempoGuideTarget` state, and modal render.

**Files:**
- Modify: `app/client/programme/session/[sessionId]/SessionLogger.tsx`

- [ ] **Step 1: Add `Play` to lucide imports**

Find line 7–10 (the lucide import block):

```typescript
import {
  ChevronLeft, ChevronRight, CheckCircle2, Circle,
  Loader2, AlertCircle, RefreshCw, TrendingUp,
  Clock, ChevronUp, X, MessageSquare, Flag, ArrowLeftRight, Play
} from 'lucide-react'
```

- [ ] **Step 2: Add TempoGuideModal import**

After line 15 (`import { getDefaultTempo } from '@/lib/training/tempo'`), add:

```typescript
import TempoGuideModal from '@/components/client/TempoGuideModal'
import { parseTempo } from '@/lib/training/tempo'
```

- [ ] **Step 3: Add `tempoGuideTarget` state**

In the component body, after the existing `altSheetTarget` state (around line 184):

```typescript
const [tempoGuideTarget, setTempoGuideTarget] = useState<{
  tempo: string
  reps: number
  exerciseName: string
} | null>(null)
```

- [ ] **Step 4: Add a helper to resolve reps count from an exercise**

Add this function near the other helpers (after `recKey`, before `DeltaBadge`, around line 141):

```typescript
function resolveReps(ex: Exercise): number {
  // If reps is a pure integer string ("8"), use it directly
  const n = parseInt(ex.reps, 10)
  if (!isNaN(n) && String(n) === ex.reps.trim()) return n
  // Range "6-12" → use rep_min
  if (ex.rep_min !== null && ex.rep_min > 0) return ex.rep_min
  // Fallback
  return 8
}
```

- [ ] **Step 5: Add ▶ button in the set row**

Find the set row button (the toggleSet button, around line 1035):

```tsx
<button onClick={() => toggleSet(ex.id, s.set_number, s.side, ex.rest_sec)} title="Valider" ...>
```

**Before** that button, insert the tempo guide button. The surrounding grid has columns defined on the parent div. Add the button inside the same grid cell as the check button, or just before it:

```tsx
{/* Tempo guide trigger */}
{(() => {
  const resolvedTempo = ex.tempo ?? getDefaultTempo(ex.movement_pattern ?? null, goal)
  const repCount = resolveReps(ex)
  const canGuide = parseTempo(resolvedTempo) !== null && repCount > 0 && !s.completed
  if (!canGuide) return null
  return (
    <button
      onClick={() => setTempoGuideTarget({
        tempo: resolvedTempo,
        reps: repCount,
        exerciseName: swappedNames[ex.id] ?? ex.name,
      })}
      title="Guide tempo"
      className="flex justify-center items-center h-10 w-10 rounded-xl bg-white/[0.04] text-white/30 hover:text-[#FFB800] hover:bg-white/[0.08] transition-colors shrink-0"
    >
      <Play size={12} fill="currentColor" />
    </button>
  )
})()}
```

**Important:** The set row grid `gridTemplateColumns` on the parent div must accommodate the extra button. Find the div with `style={{ gridTemplateColumns: ex.is_unilateral ? '1fr 1fr 1.8fr 1.8fr 1.8fr 1.5fr 1fr' : '0.6fr 1.8fr 1.8fr 1.8fr 1.5fr 1fr' }}` (around line 1000) and add a column for the play button:

```tsx
style={{ gridTemplateColumns: ex.is_unilateral
  ? '1fr 1fr 1.8fr 1.8fr 1.8fr 1.5fr 0.8fr 1fr'
  : '0.6fr 1.8fr 1.8fr 1.8fr 1.5fr 0.8fr 1fr'
}}
```

- [ ] **Step 6: Add modal render at the bottom of the component**

Find the section after the `altSheetTarget` modal render (around line 1262). Add:

```tsx
{/* ── Tempo Guide Modal ── */}
{tempoGuideTarget && (
  <TempoGuideModal
    tempo={tempoGuideTarget.tempo}
    reps={tempoGuideTarget.reps}
    exerciseName={tempoGuideTarget.exerciseName}
    onClose={() => setTempoGuideTarget(null)}
  />
)}
```

- [ ] **Step 7: TypeScript check — full project**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```

Expected: same pre-existing errors as before, nothing new from SessionLogger or TempoGuideModal.

- [ ] **Step 8: Run all tests**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run 2>&1 | tail -6
```

Expected: all tests pass (298+).

- [ ] **Step 9: Commit**

```bash
git add "app/client/programme/session/[sessionId]/SessionLogger.tsx"
git commit -m "feat(tempo-guide): wire TempoGuideModal into SessionLogger — ▶ button per set, tempoGuideTarget state"
```

---

## Task 3: CHANGELOG update

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add entries**

Open `CHANGELOG.md`. In the `## 2026-05-16` section, add at the top:

```
FEATURE: Tempo Guide Modal — guide visuel plein écran style Technogym (SVG sinusoïdal, balle+trail, losanges, barres reps, haptique) déclenché par bouton ▶ par set dans SessionLogger
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG update for tempo guide modal"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|-------------|------|
| Full-screen modal, `fixed inset-0 bg-[#080808]` | Task 1 |
| Framer Motion enter/exit `scale + opacity` | Task 1 (AnimatePresence) |
| Sinusoidal SVG bézier path (Technogym shape) | Task 1 (`PATH_D`) |
| Track background + glow track | Task 1 (two `<path>` overlaid) |
| Ball white + yellow glow `drop-shadow` | Task 1 (`ballRef` + filter) |
| Ball glow circle (wider, lower opacity) | Task 1 (`ballGlowRef`) |
| Comet trail (10 fading circles) | Task 1 (`trailRefs`, `trailBuf`) |
| 3 diamond markers at 0.25/0.50/0.75 | Task 1 (`diamondRefs`, `diamondPositions`) |
| Diamond pulse when ball passes | Task 1 (dist < 0.04 check in RAF) |
| Phase label `DESCENTE / PAUSE BAS / MONTÉE / PAUSE HAUT` | Task 1 (`PHASE_LABELS`, `AnimatePresence`) |
| Phase duration label `Xs` | Task 1 (phase label section) |
| Rep bars — completed yellow / current yellow+glow / remaining grey | Task 1 (Framer Motion animate) |
| Rep counter `N / total` with yellow current | Task 1 (footer) |
| RAF loop — zero React state in hot path | Task 1 (all DOM mutations via refs) |
| Phase easing: ECC/CON easeInOut, PB/PH linear | Task 1 (`PHASE_EASING`) |
| Phase X = 300ms | Task 1 (`phaseDurations` computation) |
| Phase 0 = skip (phaseFrac === 0 guard) | Task 1 (RAF loop `if (phaseFrac === 0) continue`) |
| Vibrate at ECC→PB (40ms), PB→CON (70ms), CON→PH (40ms) | Task 1 (phase change detection) |
| Vibrate end-rep `[70,30,70]` | Task 1 (repIndex change) |
| Vibrate end-set `[100,40,100,40,100]` | Task 1 (repIndex >= reps) |
| Auto-close 400ms after last rep | Task 1 (`done` effect) |
| `[×]` button manual close | Task 1 (`handleClose`) |
| `parseTempo` returns null → render nothing | Task 1 (early return) |
| ▶ button per set in SessionLogger | Task 2 |
| Button hidden if: tempo not parsable / reps=0 / set completed | Task 2 (`canGuide` check) |
| `resolveReps` — handles "8", "8-12", fallback | Task 2 |
| `tempoGuideTarget` state | Task 2 |
| Modal render at bottom of SessionLogger | Task 2 |
| Grid column added for ▶ button | Task 2 (gridTemplateColumns) |

### Placeholder scan

None found.

### Type consistency

- `TempoGuideModalProps.tempo: string` → passed from SessionLogger as `string` ✓
- `TempoGuideModalProps.reps: number` → `resolveReps(ex)` returns `number` ✓
- `parseTempo` imported from `@/lib/training/tempo` in both files ✓
- `ParsedTempo` imported from `@/lib/training/tempo` in TempoGuideModal ✓
- `getDefaultTempo` already imported in SessionLogger (from previous tempo feature) ✓
- `diamondRefs.current` typed as `SVGPolygonElement[]` — `<polygon ref={el => { if (el) diamondRefs.current[i] = el }}>` ✓
