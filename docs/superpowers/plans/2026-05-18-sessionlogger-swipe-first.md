# SessionLogger Swipe-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the text-input grid in SessionLogger with swipeable cards — swipe left to validate a set in <2s, tap to edit after validation.

**Architecture:** Create two new components (`SetSwipeCard`, `SetEditSheet`) with single responsibilities. Modify `SessionLogger.tsx` surgically — only the set-rendering sections (solo ~lines 1171-1287 and superset ~lines 1395-1476) change. All existing logic (toggleSet, updateSet, recommendNextSet, prSets, live save, rest timer, hydration) stays untouched.

**Tech Stack:** React, Framer Motion (`useMotionValue`, `useTransform`, `motion.div` with `drag="x"`), Lucide React, Tailwind CSS, DS v3.0 tokens.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `components/client/smart/SetSwipeCard.tsx` | **Create** | Single set card — drag gesture, visual feedback, validated state display |
| `components/client/smart/SetEditSheet.tsx` | **Create** | Bottom sheet with stepper inputs for reps/weight/RIR correction |
| `app/client/programme/session/[sessionId]/SessionLogger.tsx` | **Modify** | Replace grid JSX with `<SetSwipeCard>`, add `editingSet` state, render `<SetEditSheet>` |

---

## Task 1 — Create SetSwipeCard

**Files:**
- Create: `components/client/smart/SetSwipeCard.tsx`

### Key interfaces (copy these exactly — used in Task 3)

```ts
// Shared types used across Task 1 and Task 3
export interface SetSwipeCardSet {
  exercise_id: string
  exercise_name: string
  set_number: number
  side: 'left' | 'right' | 'bilateral'
  planned_reps: string
  actual_reps: string
  actual_weight_kg: string
  completed: boolean
  rir_actual: string
}

export interface SetSwipeCardExercise {
  id: string
  name: string
  target_rir: number | null
  rir: number | null
  weight_increment_kg?: number | null
  movement_pattern?: string | null
  tempo?: string | null
  group_id?: string | null
}

export interface SetSwipeCardRecommendation {
  weight_kg: number
  reps: number
  delta_vs_last: number | null
  confidence: 'high' | 'medium' | 'low'
}

export interface SetSwipeCardLastPerf {
  weight: number | null
  reps: number | null
  rir?: number | null
}
```

- [ ] **Step 1: Create the file with types and skeleton**

```tsx
// components/client/smart/SetSwipeCard.tsx
'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { CheckCircle2, Pencil } from 'lucide-react'

export interface SetSwipeCardSet {
  exercise_id: string
  exercise_name: string
  set_number: number
  side: 'left' | 'right' | 'bilateral'
  planned_reps: string
  actual_reps: string
  actual_weight_kg: string
  completed: boolean
  rir_actual: string
}

export interface SetSwipeCardExercise {
  id: string
  name: string
  target_rir: number | null
  rir: number | null
  weight_increment_kg?: number | null
  movement_pattern?: string | null
  tempo?: string | null
  group_id?: string | null
}

export interface SetSwipeCardRecommendation {
  weight_kg: number
  reps: number
  delta_vs_last: number | null
  confidence: 'high' | 'medium' | 'low'
}

export interface SetSwipeCardLastPerf {
  weight: number | null
  reps: number | null
  rir?: number | null
}

interface SetSwipeCardProps {
  set: SetSwipeCardSet
  exercise: SetSwipeCardExercise
  recommendation: SetSwipeCardRecommendation | undefined
  lastPerf: SetSwipeCardLastPerf | null
  isPR: boolean
  showSwipeHint: boolean        // true only for very first set ever (localStorage gate)
  coachingCue: string | null
  supersetColor?: string        // defined only for superset cards
  onValidate: () => void
  onEditRequest: () => void
  onTempoGuide?: () => void
  hasTempoGuide?: boolean
}

function sideLabel(side: 'left' | 'right' | 'bilateral'): string | null {
  if (side === 'left') return 'G'
  if (side === 'right') return 'D'
  return null
}

function sideColorClass(side: 'left' | 'right' | 'bilateral'): string {
  if (side === 'left') return 'text-blue-400'
  if (side === 'right') return 'text-violet-400'
  return 'text-white'
}

export default function SetSwipeCard({
  set,
  exercise,
  recommendation,
  lastPerf,
  isPR,
  showSwipeHint,
  coachingCue,
  supersetColor,
  onValidate,
  onEditRequest,
  onTempoGuide,
  hasTempoGuide,
}: SetSwipeCardProps) {
  const x = useMotionValue(0)
  const hasValidated = useRef(false)

  // Derive display values: recommendation > actual > lastPerf > planned
  const displayReps = recommendation
    ? String(recommendation.reps)
    : set.actual_reps || set.planned_reps || (lastPerf?.reps ? String(lastPerf.reps) : '—')

  const displayWeight = recommendation
    ? String(recommendation.weight_kg)
    : set.actual_weight_kg || (lastPerf?.weight ? String(lastPerf.weight) : '—')

  const effectiveRir = exercise.target_rir ?? exercise.rir

  // Visual transforms driven by drag
  const borderColor = useTransform(
    x,
    [-140, -80, -20, 0],
    ['#10b981', '#10b981', supersetColor ?? 'rgba(255,255,255,0.08)', supersetColor ?? 'rgba(255,255,255,0.08)']
  )
  const bgOpacity = useTransform(x, [-140, -60, 0], [0.12, 0.05, 0])
  const checkOpacity = useTransform(x, [-140, -80, 0], [1, 0.4, 0])
  const hintOpacity = useTransform(x, [-30, 0], [0, 1])

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (hasValidated.current) return
    if (info.offset.x < -140) {
      // Validate: snap offscreen then call onValidate
      hasValidated.current = true
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(40)
      }
      animate(x, -500, { type: 'spring', stiffness: 300, damping: 28 }).then(() => {
        onValidate()
        // Reset x so the completed UI renders (onValidate causes re-render to completed state)
        x.set(0)
        hasValidated.current = false
      })
    } else {
      // Snap back
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
    }
  }

  if (set.completed) {
    return (
      <div className="flex flex-col gap-1">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer active:scale-[0.99] transition-transform"
          style={{ backgroundColor: 'rgba(255,224,30,0.06)', borderColor: 'rgba(255,224,30,0.20)' }}
          onClick={onEditRequest}
        >
          <CheckCircle2 size={16} className="text-[#ffe01e] shrink-0" />
          <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/30 shrink-0">
            {set.side !== 'bilateral' ? `${sideLabel(set.side)} ` : ''}SET {set.set_number}
          </span>
          <span className="text-[13px] font-mono font-bold text-white flex-1">
            {set.actual_reps || displayReps} × {set.actual_weight_kg || displayWeight}kg
          </span>
          {set.rir_actual && (
            <span className="text-[11px] text-white/40 shrink-0">RIR {set.rir_actual}</span>
          )}
          {isPR && (
            <span className="bg-[#ffe01e] text-[#0d0d0d] text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0">
              PR
            </span>
          )}
          <Pencil size={11} className="text-white/20 shrink-0" />
        </div>
        {coachingCue && (
          <p className="px-1 text-[10px] text-white/40 italic">{coachingCue}</p>
        )}
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Green background revealed on swipe */}
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{ backgroundColor: '#10b981', opacity: bgOpacity }}
      />
      {/* Check icon revealed on swipe */}
      <motion.div
        className="absolute right-5 top-1/2 -translate-y-1/2"
        style={{ opacity: checkOpacity }}
      >
        <CheckCircle2 size={28} className="text-white" />
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -300, right: 0 }}
        dragElastic={{ left: 0.08, right: 0 }}
        style={{ x, borderColor }}
        onDragEnd={handleDragEnd}
        className="relative rounded-2xl border bg-[#161616] p-5 cursor-grab active:cursor-grabbing"
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30">
              {set.side !== 'bilateral' && (
                <span className={`${sideColorClass(set.side)} mr-1`}>{sideLabel(set.side)}</span>
              )}
              SET {set.set_number}
            </span>
            {isPR && (
              <span className="bg-[#ffe01e] text-[#0d0d0d] text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md">
                PR
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasTempoGuide && onTempoGuide && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onTempoGuide() }}
                className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.04] text-[#FFB800]/50 hover:text-[#FFB800] hover:bg-[#FFB800]/[0.08] active:scale-95 transition-all"
              >
                {/* Play icon inline to avoid import issues */}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <polygon points="2,1 9,5 2,9" />
                </svg>
              </button>
            )}
            {/* Swipe hint — only on first card ever */}
            {showSwipeHint && (
              <motion.span
                className="text-[10px] text-white/30 font-mono"
                animate={{ opacity: [0.6, 0.2, 0.6] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              >
                ← swipe
              </motion.span>
            )}
          </div>
        </div>

        {/* Main values row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Reps */}
          <div className="text-center">
            <p className="text-[32px] font-black text-white leading-none tabular-nums">
              {displayReps}
            </p>
            <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/25 mt-1">
              reps
            </p>
          </div>
          {/* Weight */}
          <div className="text-center">
            <p className="text-[32px] font-black text-white leading-none tabular-nums">
              {displayWeight}
            </p>
            <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/25 mt-1">
              kg
            </p>
            {recommendation?.delta_vs_last !== null && recommendation?.delta_vs_last !== undefined && (
              <p className={`text-[10px] font-semibold mt-0.5 ${
                recommendation.delta_vs_last > 0 ? 'text-[#ffe01e]' :
                recommendation.delta_vs_last < 0 ? 'text-amber-400' : 'text-white/30'
              }`}>
                {recommendation.delta_vs_last > 0 ? `↑ +${recommendation.delta_vs_last}kg` :
                 recommendation.delta_vs_last < 0 ? `↓ ${recommendation.delta_vs_last}kg` : '= S-1'}
              </p>
            )}
          </div>
          {/* RIR target */}
          <div className="text-center">
            <p className="text-[32px] font-black text-white/50 leading-none tabular-nums">
              {effectiveRir !== null && effectiveRir !== undefined ? effectiveRir : '—'}
            </p>
            <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/25 mt-1">
              RIR cible
            </p>
          </div>
        </div>

        {/* Last perf hint */}
        {lastPerf?.weight && lastPerf?.reps && (
          <p className="mt-3 text-[10px] text-white/20 text-center tabular-nums">
            S-1 : {lastPerf.reps} × {lastPerf.weight}kg
          </p>
        )}
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check on new file**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep "SetSwipeCard" | head -20
```

Expected: no errors on this file.

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/SetSwipeCard.tsx
git commit -m "feat(session): SetSwipeCard — swipe-first set validation component"
```

---

## Task 2 — Create SetEditSheet

**Files:**
- Create: `components/client/smart/SetEditSheet.tsx`

- [ ] **Step 1: Create the file**

```tsx
// components/client/smart/SetEditSheet.tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus, Plus } from 'lucide-react'

interface SetEditSheetProps {
  open: boolean
  setNumber: number
  exerciseName: string
  side: 'left' | 'right' | 'bilateral'
  initialReps: string
  initialWeight: string
  initialRir: string
  weightIncrement: number   // step for weight stepper (ex.weight_increment_kg ?? 2.5)
  onConfirm: (reps: string, weight: string, rir: string) => void
  onClose: () => void
}

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  unit?: string
}) {
  return (
    <div>
      <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30 mb-2">
        {label}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, Math.round((value - step) / step) * step))}
          className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/[0.06] text-white active:scale-95 active:bg-white/[0.10] transition-all shrink-0"
        >
          <Minus size={18} />
        </button>
        <div className="flex-1 text-center">
          <p className="text-[36px] font-black text-white leading-none tabular-nums">
            {value % 1 === 0 ? value : value.toFixed(1)}
            {unit && <span className="text-[18px] text-white/40 ml-1">{unit}</span>}
          </p>
        </div>
        <button
          onClick={() => onChange(Math.min(max, Math.round((value + step) / step) * step))}
          className="h-12 w-12 flex items-center justify-center rounded-xl bg-white/[0.06] text-white active:scale-95 active:bg-white/[0.10] transition-all shrink-0"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  )
}

export default function SetEditSheet({
  open,
  setNumber,
  exerciseName,
  side,
  initialReps,
  initialWeight,
  initialRir,
  weightIncrement,
  onConfirm,
  onClose,
}: SetEditSheetProps) {
  const [reps, setReps] = useState(parseInt(initialReps, 10) || 8)
  const [weight, setWeight] = useState(parseFloat(initialWeight) || 0)
  const [rir, setRir] = useState(parseInt(initialRir, 10) || 2)

  // Sync when the sheet opens for a different set
  useEffect(() => {
    if (open) {
      setReps(parseInt(initialReps, 10) || 8)
      setWeight(parseFloat(initialWeight) || 0)
      setRir(parseInt(initialRir, 10) || 2)
    }
  }, [open, initialReps, initialWeight, initialRir])

  const sideLabel = side === 'left' ? 'G' : side === 'right' ? 'D' : null

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[70] bg-[#161616] rounded-t-2xl border-t border-white/[0.08] p-6"
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { type: 'spring', stiffness: 350, damping: 30 } }}
            exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
          >
            {/* Drag handle */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.12]" />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[13px] font-bold text-white">
                  Modifier — {sideLabel ? `${sideLabel} · ` : ''}SET {setNumber}
                </p>
                <p className="text-[11px] text-white/40 mt-0.5">{exerciseName}</p>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Steppers */}
            <div className="space-y-6 mb-6">
              <Stepper
                label="Reps"
                value={reps}
                onChange={setReps}
                min={1}
                max={50}
                step={1}
              />
              <Stepper
                label="Poids"
                value={weight}
                onChange={setWeight}
                min={0}
                max={500}
                step={weightIncrement}
                unit="kg"
              />
              <Stepper
                label="RIR"
                value={rir}
                onChange={setRir}
                min={0}
                max={10}
                step={1}
              />
            </div>

            {/* CTA */}
            <button
              onClick={() => {
                onConfirm(String(reps), String(weight), String(rir))
                onClose()
              }}
              className="w-full h-13 flex items-center justify-center bg-[#ffe01e] text-[#0d0d0d] text-[13px] font-black uppercase tracking-[0.1em] rounded-xl active:scale-[0.98] transition-transform"
            >
              Confirmer
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep "SetEditSheet" | head -20
```

Expected: no errors on this file.

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/SetEditSheet.tsx
git commit -m "feat(session): SetEditSheet — stepper bottom sheet for post-validation correction"
```

---

## Task 3 — Integrate into SessionLogger

**Files:**
- Modify: `app/client/programme/session/[sessionId]/SessionLogger.tsx`

This task has two sub-parts: (A) the solo exercise section, (B) the superset section. Both replace `<input>` grids with `<SetSwipeCard>`.

### Step 1: Add imports + editingSet state

- [ ] **Step 1a: Add imports at top of file (after existing imports, line ~17)**

```tsx
import SetSwipeCard from '@/components/client/smart/SetSwipeCard'
import SetEditSheet from '@/components/client/smart/SetEditSheet'
```

- [ ] **Step 1b: Add `editingSet` state (after existing `manuallyEdited` state, ~line 235)**

Add this after the line `const [manuallyEdited, setManuallyEdited] = useState<Set<string>>(new Set())`:

```tsx
// ── Swipe-first edit state ──
const [editingSet, setEditingSet] = useState<{
  exId: string
  setNum: number
  side: 'left' | 'right' | 'bilateral'
  exerciseName: string
  weightIncrement: number
} | null>(null)

// Swipe hint — show only until first validation ever
const [swipeHintDismissed, setSwipeHintDismissed] = useState<boolean>(() => {
  if (typeof window === 'undefined') return true
  return localStorage.getItem('swipe_hint_seen') === '1'
})
const [swipeHintShownForKey, setSwipeHintShownForKey] = useState<string | null>(null)
```

- [ ] **Step 1c: Derive the hint key (inside component body, before the return statement)**

Add after the `hydrationPlan` useMemo (~line 253):

```tsx
// Key of the very first incomplete set (for swipe hint)
const firstIncompleteKey = useMemo(() => {
  if (swipeHintDismissed) return null
  const first = sets.find(s => !s.completed)
  if (!first) return null
  return recKey(first.exercise_id, first.set_number, first.side)
}, [sets, swipeHintDismissed])
```

- [ ] **Step 1d: TypeScript check after state additions**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -E "editingSet|swipeHint|firstIncomplete" | head -10
```

Expected: no errors.

### Step 2: Replace solo exercise grid

The solo exercise grid is inside the block `!isSuperset ? ( currentGroup.map((ex) => { ... }) )`.

The grid section to replace starts at approximately:

```tsx
<div className="border-t border-white/[0.05]">
  {prFlash && ( ... )}
  {/* COLS: #+prévu | RÉALISÉ | KG | RIR | ▶ | ✓ */}
  <div className="grid items-center gap-3 ...">  ← HEADER ROW
    ...
  </div>
  {exSetsForEx.map((s, idx) => {   ← SETS ROWS
    ...
  })}
</div>
```

- [ ] **Step 2a: Replace the entire `<div className="border-t border-white/[0.05]">` block** (which contains the grid header + set rows, ending before the notes section `<div className="border-t border-white/[0.05] px-5 py-3">`)

Replace with:

```tsx
<div className="border-t border-white/[0.05] px-4 py-4 flex flex-col gap-3">
  {prFlash && (
    <div className="px-3 py-2 bg-[#ffe01e]/10 border border-[#ffe01e]/30 rounded-xl text-[11px] font-bold text-[#ffe01e]">
      {prFlash}
    </div>
  )}
  {exSetsForEx.map((s) => {
    const lastP = getExLastPerfLabel(s.set_number, s.side)
    const key = recKey(ex.id, s.set_number, s.side)
    const rec = recommendations[key]
    const exSetsForCue = exSetsForEx.filter(x => x.exercise_id === s.exercise_id && x.side === s.side)
    const isLastSet = s.set_number === exSetsForCue.length
    const rir = s.rir_actual !== '' ? parseInt(s.rir_actual, 10) : null
    const cue = getCoachingCue(isNaN(rir!) ? null : rir, s.set_number, exSetsForCue.length, isLastSet)
    const cardKey = recKey(ex.id, s.set_number, s.side)
    const isHintCard = !swipeHintDismissed && firstIncompleteKey === cardKey
    const resolvedTempo = ex.tempo ?? getDefaultTempo(ex.movement_pattern ?? null, goal)
    const canGuide = parseTempo(resolvedTempo) !== null && !s.completed

    return (
      <SetSwipeCard
        key={`${s.set_number}-${s.side}`}
        set={s}
        exercise={ex}
        recommendation={rec && !s.completed ? rec : undefined}
        lastPerf={lastP ? { weight: lastP.weight, reps: lastP.reps, rir: lastP.rir } : null}
        isPR={prSets.has(cardKey)}
        showSwipeHint={isHintCard}
        coachingCue={cue}
        onValidate={() => {
          if (!swipeHintDismissed) {
            localStorage.setItem('swipe_hint_seen', '1')
            setSwipeHintDismissed(true)
          }
          toggleSet(ex.id, s.set_number, s.side, ex.rest_sec)
        }}
        onEditRequest={() => {
          setEditingSet({
            exId: ex.id,
            setNum: s.set_number,
            side: s.side,
            exerciseName: swappedNames[ex.id] ?? ex.name,
            weightIncrement: ex.weight_increment_kg ?? 2.5,
          })
        }}
        onTempoGuide={canGuide ? () => {
          const exName = swappedNames[ex.id] ?? ex.name
          if (!hasPrepTimeConfigured(exName)) {
            setPrepTimeTarget({ tempo: resolvedTempo, reps: rec?.reps ?? resolveReps(ex), exerciseName: exName })
          } else {
            setTempoGuideTarget({ tempo: resolvedTempo, reps: rec?.reps ?? resolveReps(ex), exerciseName: exName, prepSeconds: getPrepTime(exName), hapticsEnabled: getHapticsEnabled() })
          }
        } : undefined}
        hasTempoGuide={canGuide}
      />
    )
  })}
</div>
```

- [ ] **Step 2b: TypeScript check**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -E "SessionLogger|SetSwipeCard" | grep -v "node_modules" | head -20
```

Expected: no errors on these files.

### Step 3: Replace superset grid

The superset rows are rendered inside `Array.from({ length: numRounds }, (_, roundIdx) => { ... })`.

Inside each round, for each exercise, the grid header + set rows look like:

```tsx
<div className="grid items-center gap-3 px-4 py-1 ... ">  ← HEADER
  ...
</div>
{exSetsForRound.map((s) => {        ← SET ROWS WITH INPUTS
  ...
  <div className="grid items-center gap-3 px-4 py-2.5 ...">
    <input .../>  (reps)
    <input .../>  (weight)
    <input .../>  (rir)
    ...
  </div>
})}
```

- [ ] **Step 3a: Replace the grid header + `exSetsForRound.map()` block** for each exercise in each round.

Find the `<>` fragment that contains the header row div and the `exSetsForRound.map(...)`, starting with:

```tsx
return <>
  <div className="grid items-center gap-3 px-4 py-1 ...">
```

Replace the entire `<>...</>` fragment with:

```tsx
return (
  <div key={`round-${roundIdx}-ex-${ex.id}`} className="px-3 py-2 flex flex-col gap-2">
    {exSetsForRound.map((s) => {
      const lastP = getExLastPerfLabel(s.side)
      const key = recKey(ex.id, s.set_number, s.side)
      const rec = recommendations[key]
      const rir = s.rir_actual !== '' ? parseInt(s.rir_actual, 10) : null
      const cue = getCoachingCue(isNaN(rir!) ? null : rir, s.set_number, exSetsForRound.length, s.set_number === exSetsForRound.length)
      const ssResolvedTempo = ex.tempo ?? getDefaultTempo(ex.movement_pattern ?? null, goal)
      const ssCanGuide = parseTempo(ssResolvedTempo) !== null && !s.completed
      const cardKey = recKey(ex.id, s.set_number, s.side)
      const isHintCard = !swipeHintDismissed && firstIncompleteKey === cardKey

      return (
        <SetSwipeCard
          key={`${s.set_number}-${s.side}`}
          set={s}
          exercise={ex}
          recommendation={rec && !s.completed ? rec : undefined}
          lastPerf={lastP ? { weight: lastP.weight, reps: lastP.reps, rir: lastP.rir } : null}
          isPR={prSets.has(cardKey)}
          showSwipeHint={isHintCard}
          coachingCue={cue}
          supersetColor={groupColor}
          onValidate={() => {
            if (!swipeHintDismissed) {
              localStorage.setItem('swipe_hint_seen', '1')
              setSwipeHintDismissed(true)
            }
            toggleSet(ex.id, s.set_number, s.side, restSecForToggle)
          }}
          onEditRequest={() => {
            setEditingSet({
              exId: ex.id,
              setNum: s.set_number,
              side: s.side,
              exerciseName: swappedNames[ex.id] ?? ex.name,
              weightIncrement: ex.weight_increment_kg ?? 2.5,
            })
          }}
          onTempoGuide={ssCanGuide ? () => {
            const exName = swappedNames[ex.id] ?? ex.name
            const ssRepCount = rec?.reps ?? resolveReps(ex)
            if (!hasPrepTimeConfigured(exName)) {
              setPrepTimeTarget({ tempo: ssResolvedTempo, reps: ssRepCount, exerciseName: exName })
            } else {
              setTempoGuideTarget({ tempo: ssResolvedTempo, reps: ssRepCount, exerciseName: exName, prepSeconds: getPrepTime(exName), hapticsEnabled: getHapticsEnabled() })
            }
          } : undefined}
          hasTempoGuide={ssCanGuide}
        />
      )
    })}
  </div>
)
```

Note: Remove the `key={`${s.set_number}-${s.side}`}` from the outer `<div>` if it was on the old fragment — the key is now on `SetSwipeCard`.

- [ ] **Step 3b: TypeScript check**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep "error TS" | grep -v "stripe\|MacroCalculator\|genesis\|OneRMCalc\|glass-card\|HRZones\|Comparison\|CTA\|Failure\|Hero\|morpho/photos\|payments\|program-templates\|ClientPage\|CoachTop\|nutrition/studio\|sections\|outils/1rm\|components/OneRM" | head -20
```

Expected: no new errors beyond pre-existing ones.

### Step 4: Render SetEditSheet + wire confirm

- [ ] **Step 4a: Find the editing set data for the sheet**

Add this helper just before the `return (` of the component (after the `remainingSets` line):

```tsx
// Find the set currently being edited (for SetEditSheet)
const editingSetData = editingSet
  ? sets.find(s =>
      s.exercise_id === editingSet.exId &&
      s.set_number === editingSet.setNum &&
      s.side === editingSet.side
    ) ?? null
  : null
```

- [ ] **Step 4b: Add `<SetEditSheet>` just before the closing `</div>` of the main component return**

Find the very last closing tag of the return (just before the closing of `export default function SessionLogger`). Add before the final `</div>`:

```tsx
{/* ── SetEditSheet — post-validation correction ── */}
<SetEditSheet
  open={editingSet !== null && editingSetData !== null}
  setNumber={editingSet?.setNum ?? 1}
  exerciseName={editingSet?.exerciseName ?? ''}
  side={editingSet?.side ?? 'bilateral'}
  initialReps={editingSetData?.actual_reps ?? editingSetData?.planned_reps ?? '8'}
  initialWeight={editingSetData?.actual_weight_kg ?? '0'}
  initialRir={editingSetData?.rir_actual ?? '2'}
  weightIncrement={editingSet?.weightIncrement ?? 2.5}
  onConfirm={(reps, weight, rir) => {
    if (!editingSet) return
    updateSet(editingSet.exId, editingSet.setNum, editingSet.side, {
      actual_reps: reps,
      actual_weight_kg: weight,
      rir_actual: rir,
    })
    // Re-run PR detection with new values
    const s = editingSetData
    if (s) {
      const exHistory = lastPerformance[s.exercise_name] ?? []
      const historyBest = exHistory.reduce((best: typeof exHistory[0] | null, h) => {
        if (h.weight === null || h.reps === null) return best
        return h.weight > (best?.weight ?? 0) ? h : best
      }, null)
      const repsNum = parseInt(reps, 10)
      const weightNum = parseFloat(weight)
      if (!isNaN(repsNum) && !isNaN(weightNum) && weightNum > 0 && repsNum > 0) {
        const isNewPR = !historyBest ||
          weightNum > (historyBest.weight ?? 0) ||
          (weightNum === historyBest.weight && repsNum > (historyBest.reps ?? 0))
        if (isNewPR) {
          const key = recKey(editingSet.exId, editingSet.setNum, editingSet.side)
          setPrSets(prev => new Set(prev).add(key))
          setPrFlash(`⚡ Nouveau record — ${weight}kg × ${reps} reps`)
          setTimeout(() => setPrFlash(null), 3000)
        }
      }
    }
  }}
  onClose={() => setEditingSet(null)}
/>
```

- [ ] **Step 4c: Final TypeScript check**

```bash
cd /Users/user/Desktop/STRYVLAB && npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep "error TS" | grep -v "stripe\|MacroCalculator\|genesis\|OneRMCalc\|glass-card\|HRZones\|Comparison\|CTA\|Failure\|Hero\|morpho/photos\|payments\|program-templates\|ClientPage\|CoachTop\|nutrition/studio\|sections\|outils/1rm\|components/OneRM" | head -20
```

Expected: 0 new errors.

- [ ] **Step 4d: Commit**

```bash
git add app/client/programme/session/[sessionId]/SessionLogger.tsx
git commit -m "feat(session): integrate SetSwipeCard + SetEditSheet — keyboard-less swipe validation"
```

---

## Task 4 — CHANGELOG + Final Check

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run 2>&1 | tail -8
```

Expected: same pass/fail ratio as before this feature (346 passing, 7 pre-existing tempo failures).

- [ ] **Step 2: Update CHANGELOG.md**

Add at top of `## 2026-05-18` section:

```
FEATURE: SessionLogger swipe-first — SwipeCard par set (<3s/set), SetEditSheet steppers post-validation
FEATURE: SetSwipeCard — Framer Motion drag, feedback vert, haptic, hint swipe first-use
FEATURE: SetEditSheet — bottom sheet steppers reps/poids/RIR avec spring motion
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "chore: changelog — SessionLogger swipe-first keyboard-less"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|-----------------|------|
| SwipeCard avec valeurs read-only (rec ou planned) | Task 1 — displayReps/displayWeight logic |
| `dragConstraints left: -300` | Task 1 — motion.div drag props |
| Seuil -140px → validation | Task 1 — `handleDragEnd` |
| Spring back si < seuil | Task 1 — `animate(x, 0, ...)` |
| Feedback vert via useTransform | Task 1 — `borderColor`, `bgOpacity` |
| Check icon révélé | Task 1 — absolute CheckCircle2 |
| Haptic 40ms | Task 1 — `navigator.vibrate(40)` |
| Hint `← swipe` loop infini | Task 1 — motion.span animate opacity |
| localStorage gate hint | Task 1 + Task 3 — `swipe_hint_seen` |
| État validé compact 1 ligne | Task 1 — completed branch |
| Bouton éditer sur validé | Task 1 — onClick onEditRequest |
| SetEditSheet steppers reps/poids/RIR | Task 2 |
| Step poids = `weight_increment_kg ?? 2.5` | Task 2 — weightIncrement prop |
| Spring sheet entrée | Task 2 — motion animate |
| editingSet state | Task 3 Step 1b |
| Solo grid → SetSwipeCard | Task 3 Step 2 |
| Superset grid → SetSwipeCard | Task 3 Step 3 |
| supersetColor prop pour border | Task 3 Step 3 — supersetColor={groupColor} |
| onEditRequest → SetEditSheet open | Task 3 Step 4 |
| PR detection sur confirm | Task 3 Step 4b |
| updateSet appelé sur confirm | Task 3 Step 4b |
| toggleSet inchangé | Task 3 — onValidate appelle toggleSet |
| Supersets unilatéraux | Task 1 — sideLabel/sideColorClass + Task 3 superset |

All spec requirements covered. No placeholders. Types consistent: `SetSwipeCardSet`, `SetSwipeCardExercise`, `SetSwipeCardRecommendation`, `SetSwipeCardLastPerf` defined in Task 1, consumed in Task 3 via props.
