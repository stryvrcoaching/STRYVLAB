# Set Recommendation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a client completes a set (reps + weight + RIR filled, set checked), auto-fill the next set's weight and reps using a 1RM-based calculation anchored on last week's history when available.

**Architecture:** Three strict layers — pure calculation function (`lib/training/`) → React hook integration inside `SessionLogger.tsx` → server-side data injection in `page.tsx`. The pure function layer has a `historicalSessions?` hook for future ML approach (Approach C).

**Tech Stack:** TypeScript, React (useState/useCallback), Next.js App Router (Server Component page), Supabase, existing `lib/formulas/oneRM.ts` (`calculateOneRM`), Vitest

---

## File Map

```
NEW:
  lib/training/trainingZones.ts              — zone % 1RM + RIR target per goal
  lib/training/setRecommendation.ts          — pure recommendNextSet() function + types
  tests/lib/training/setRecommendation.test.ts

MODIFIED:
  app/client/programme/session/[sessionId]/page.tsx      — inject goal, level, rir in lastPerformance
  app/client/programme/session/[sessionId]/SessionLogger.tsx  — recommendation state + badge + pre-fill
```

---

## Task 1: Training Zones Module

**Files:**
- Create: `lib/training/trainingZones.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/training/trainingZones.ts

export interface TrainingZone {
  targetPct: number   // fraction of 1RM (e.g. 0.72)
  rirTarget: number   // reps in reserve to aim for
  repRangeMin: number
  repRangeMax: number
}

const ZONES: Record<string, TrainingZone> = {
  hypertrophy:  { targetPct: 0.72, rirTarget: 2, repRangeMin: 8,  repRangeMax: 12 },
  strength:     { targetPct: 0.85, rirTarget: 1, repRangeMin: 3,  repRangeMax: 5  },
  endurance:    { targetPct: 0.57, rirTarget: 4, repRangeMin: 15, repRangeMax: 20 },
  recomp:       { targetPct: 0.71, rirTarget: 2, repRangeMin: 8,  repRangeMax: 12 },
  fat_loss:     { targetPct: 0.67, rirTarget: 3, repRangeMin: 10, repRangeMax: 15 },
  maintenance:  { targetPct: 0.70, rirTarget: 2, repRangeMin: 8,  repRangeMax: 12 },
}

const FALLBACK: TrainingZone = ZONES.hypertrophy

export function getTrainingZone(goal: string): TrainingZone {
  return ZONES[goal] ?? FALLBACK
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/training/trainingZones.ts
git commit -m "feat(training): add training zones module with % 1RM targets per goal"
```

---

## Task 2: Pure Recommendation Function — Types + Skeleton

**Files:**
- Create: `lib/training/setRecommendation.ts`
- Create: `tests/lib/training/setRecommendation.test.ts`

- [ ] **Step 1: Write the failing tests first**

```typescript
// tests/lib/training/setRecommendation.test.ts
import { describe, it, expect } from 'vitest'
import { recommendNextSet } from '@/lib/training/setRecommendation'

describe('recommendNextSet', () => {
  it('returns null for invalid input (zero weight)', () => {
    const result = recommendNextSet({
      actual_weight_kg: 0,
      actual_reps: 8,
      rir_actual: 2,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 1,
    })
    expect(result).toBeNull()
  })

  it('returns null for invalid input (zero reps)', () => {
    const result = recommendNextSet({
      actual_weight_kg: 80,
      actual_reps: 0,
      rir_actual: 2,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 1,
    })
    expect(result).toBeNull()
  })

  it('returns a recommendation for hypertrophy without history', () => {
    const result = recommendNextSet({
      actual_weight_kg: 80,
      actual_reps: 8,
      rir_actual: 4,   // too easy — should recommend more weight
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 10,
      set_number: 1,
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBeGreaterThan(0)
    expect(result!.reps).toBe(10)   // uses planned_reps
    expect(result!.confidence).toBe('high')  // 8 reps ≤ 10
    expect(result!.delta_vs_last).toBeNull()  // no history
  })

  it('returns confidence low when reps > 10', () => {
    const result = recommendNextSet({
      actual_weight_kg: 50,
      actual_reps: 15,
      rir_actual: 2,
      goal: 'endurance',
      level: 'beginner',
      planned_reps: 15,
      set_number: 1,
    })
    expect(result).not.toBeNull()
    expect(result!.confidence).toBe('low')
  })

  it('blends history (0.7) with live (0.3) and returns positive delta', () => {
    // Last week: 80kg × 8 @ RIR2 → 1RM ~97
    // This week: 82.5kg × 8 @ RIR2 → 1RM ~100
    // Blended ~98, zone 72% = ~70.5kg recommended
    // delta = recommended - 80 (last week weight)
    const result = recommendNextSet({
      actual_weight_kg: 82.5,
      actual_reps: 8,
      rir_actual: 2,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 8,
      set_number: 2,
      lastWeek: { weight_kg: 80, reps: 8, rir_actual: 2 },
    })
    expect(result).not.toBeNull()
    expect(result!.delta_vs_last).not.toBeNull()
    expect(result!.weight_kg).toBeGreaterThan(0)
    // weight rounded to 0.25
    expect(result!.weight_kg % 0.25).toBeCloseTo(0, 5)
  })

  it('returns delta = 0 when same weight is recommended as last week', () => {
    // Identical performance → same 1RM → same recommended weight → delta 0
    const result = recommendNextSet({
      actual_weight_kg: 80,
      actual_reps: 8,
      rir_actual: 2,
      goal: 'hypertrophy',
      level: 'intermediate',
      planned_reps: 8,
      set_number: 1,
      lastWeek: { weight_kg: 80, reps: 8, rir_actual: 2 },
    })
    expect(result).not.toBeNull()
    // delta is recommended - lastWeek.weight_kg, could be 0 or small due to rounding
    expect(typeof result!.delta_vs_last).toBe('number')
  })

  it('falls back to hypertrophy zone for unknown goal', () => {
    const result = recommendNextSet({
      actual_weight_kg: 100,
      actual_reps: 5,
      rir_actual: 2,
      goal: 'unknown_goal',
      level: 'intermediate',
      planned_reps: 5,
      set_number: 1,
    })
    expect(result).not.toBeNull()
    expect(result!.weight_kg).toBeGreaterThan(0)
  })

  it('uses repRangeMin when planned_reps is 0', () => {
    const result = recommendNextSet({
      actual_weight_kg: 80,
      actual_reps: 8,
      rir_actual: 2,
      goal: 'strength',
      level: 'intermediate',
      planned_reps: 0,
      set_number: 1,
    })
    expect(result).not.toBeNull()
    expect(result!.reps).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/user/Desktop/VIRTUS && npx vitest run tests/lib/training/setRecommendation.test.ts 2>&1 | tail -20
```

Expected: FAIL — "Cannot find module '@/lib/training/setRecommendation'"

- [ ] **Step 3: Create the implementation**

```typescript
// lib/training/setRecommendation.ts
import { calculateOneRM } from '@/lib/formulas/oneRM'
import { getTrainingZone } from './trainingZones'

// Future hook for Approach C (ML regression) — unused in Phase 1
export interface HistoricalSession {
  date: string
  sets: Array<{ set_number: number; weight_kg: number; reps: number; rir_actual: number }>
}

export interface SetRecommendationInput {
  actual_weight_kg: number
  actual_reps: number
  rir_actual: number
  goal: string
  level: string
  planned_reps: number
  set_number: number
  lastWeek?: {
    weight_kg: number
    reps: number
    rir_actual: number
  }
  // Intentionally unused Phase 1 — branch added in Approach C
  historicalSessions?: HistoricalSession[]
}

export interface SetRecommendation {
  weight_kg: number
  reps: number
  confidence: 'high' | 'low'
  delta_vs_last: number | null
}

function roundToQuarter(value: number): number {
  return Math.round(value * 4) / 4
}

function estimateOneRM(weight_kg: number, reps: number, rir_actual: number): number {
  const repsToFailure = reps + rir_actual
  // Guard: repsToFailure must be >= 1 for formulas to work
  const clampedRTF = Math.max(1, repsToFailure)
  const result = calculateOneRM({ weight: weight_kg, reps: clampedRTF }, 'average')
  return result.oneRM
}

export function recommendNextSet(input: SetRecommendationInput): SetRecommendation | null {
  const { actual_weight_kg, actual_reps, rir_actual, goal, planned_reps, lastWeek } = input

  // Guard: invalid inputs
  if (actual_weight_kg <= 0 || actual_reps <= 0) return null
  if (actual_reps + rir_actual < 1) return null

  const zone = getTrainingZone(goal)

  // Estimate 1RM from current set
  const liveOneRM = estimateOneRM(actual_weight_kg, actual_reps, rir_actual)

  // Blend with history if available (history anchors at 70%)
  let blendedOneRM: number
  if (lastWeek && lastWeek.weight_kg > 0 && lastWeek.reps > 0) {
    const historyOneRM = estimateOneRM(lastWeek.weight_kg, lastWeek.reps, lastWeek.rir_actual)
    blendedOneRM = historyOneRM * 0.7 + liveOneRM * 0.3
  } else {
    blendedOneRM = liveOneRM
  }

  // Derive target weight
  const rawWeight = blendedOneRM * zone.targetPct
  const targetWeight = roundToQuarter(rawWeight)

  // Derive target reps: use planned_reps if valid, else zone mid-range
  const targetReps = planned_reps > 0
    ? planned_reps
    : Math.round((zone.repRangeMin + zone.repRangeMax) / 2)

  // Confidence: low if reps > 10 (formulas become unreliable)
  const confidence: 'high' | 'low' = actual_reps > 10 ? 'low' : 'high'

  // Delta vs last week
  const delta_vs_last = lastWeek && lastWeek.weight_kg > 0
    ? roundToQuarter(targetWeight - lastWeek.weight_kg)
    : null

  return {
    weight_kg: targetWeight,
    reps: targetReps,
    confidence,
    delta_vs_last,
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/user/Desktop/VIRTUS && npx vitest run tests/lib/training/setRecommendation.test.ts 2>&1 | tail -20
```

Expected: all 8 tests PASS.

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 new errors.

- [ ] **Step 6: Commit**

```bash
git add lib/training/setRecommendation.ts tests/lib/training/setRecommendation.test.ts
git commit -m "feat(training): add pure recommendNextSet function with 1RM blend + test suite"
```

---

## Task 3: Enrich page.tsx — goal, level, rir_actual in lastPerformance

**Files:**
- Modify: `app/client/programme/session/[sessionId]/page.tsx`

- [ ] **Step 1: Read the current programs fetch to understand the query chain**

The file already fetches `program_id` from `program_sessions`, then fetches `programs` separately. We need to add `template_id` join to get `goal` and `level` from `coach_program_templates`.

Look at lines 36–47: the `programs` query already exists:
```typescript
const { data: program } = await service
  .from('programs')
  .select('id, progressive_overload_enabled')
  .eq('id', (session as any).program_id)
  ...
```

We extend this select to also pull `template_id`, then join `coach_program_templates`.

- [ ] **Step 2: Update the programs query to include template_id and goal/level**

Replace the existing programs query (lines 36–47) with:

```typescript
  const { data: program } = await service
    .from('programs')
    .select(`
      id,
      progressive_overload_enabled,
      template_id,
      coach_program_templates (
        goal,
        level
      )
    `)
    .eq('id', (session as any).program_id)
    .eq('client_id', client.id)
    .eq('status', 'active')
    .single()

  if (!program) notFound()

  const progressionEnabled = (program as any).progressive_overload_enabled ?? false
  const goal: string = (program as any).coach_program_templates?.goal ?? 'hypertrophy'
  const level: string = (program as any).coach_program_templates?.level ?? 'intermediate'
```

- [ ] **Step 3: Add rir_actual to the lastPerformance fetch**

Find the `client_set_logs` select (around line 112):

```typescript
// BEFORE:
.select('exercise_name, set_number, actual_weight_kg, actual_reps, side, completed, client_session_logs!inner(client_id)')

// AFTER:
.select('exercise_name, set_number, actual_weight_kg, actual_reps, rir_actual, side, completed, client_session_logs!inner(client_id)')
```

- [ ] **Step 4: Update the LastPerf type and the push() call**

Update the `lastPerformance` type declaration (line 105):

```typescript
// BEFORE:
let lastPerformance: Record<string, { weight: number | null; reps: number | null; side?: string | null }[]> = {}

// AFTER:
let lastPerformance: Record<string, { weight: number | null; reps: number | null; rir?: number | null; side?: string | null }[]> = {}
```

Update the push call inside the loop (around line 126–131):

```typescript
// BEFORE:
lastPerformance[log.exercise_name].push({
  weight: log.actual_weight_kg,
  reps: log.actual_reps,
  side: log.side,
})

// AFTER:
lastPerformance[log.exercise_name].push({
  weight: log.actual_weight_kg,
  reps: log.actual_reps,
  rir: (log as any).rir_actual ?? null,
  side: log.side,
})
```

- [ ] **Step 5: Pass goal and level to SessionLogger**

Update the return statement (line 144–151):

```typescript
  return (
    <SessionLogger
      clientId={client.id}
      sessionId={params.sessionId}
      session={{ id: session.id, name: session.name }}
      exercises={exercisesWithAlternatives}
      lastPerformance={lastPerformance}
      goal={goal}
      level={level}
    />
  )
```

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only on SessionLogger props (goal/level not yet accepted) — normal, will be fixed in Task 4.

- [ ] **Step 7: Commit**

```bash
git add app/client/programme/session/[sessionId]/page.tsx
git commit -m "feat(session): inject goal, level, rir_actual into session page for recommendation engine"
```

---

## Task 4: SessionLogger — Props, State, Recommendation Logic

**Files:**
- Modify: `app/client/programme/session/[sessionId]/SessionLogger.tsx`

- [ ] **Step 1: Update LastPerf interface and Props**

In the `// ─── Types ───` section, update `LastPerf` and `Props`:

```typescript
interface LastPerf {
  weight: number | null
  reps: number | null
  rir?: number | null
  side?: string | null
}

interface Props {
  clientId: string
  sessionId: string
  session: { id: string; name: string }
  exercises: Exercise[]
  lastPerformance: Record<string, LastPerf[]>
  goal: string
  level: string
}
```

- [ ] **Step 2: Add recommendation imports and state**

Add the import at the top of the file, after existing imports:

```typescript
import { recommendNextSet, type SetRecommendation } from '@/lib/training/setRecommendation'
```

In the component function, add after existing state declarations (around line 152):

```typescript
  const [recommendations, setRecommendations] = useState<Record<string, SetRecommendation>>({})
  const [manuallyEdited, setManuallyEdited] = useState<Set<string>>(new Set())
```

Update the component signature to destructure the new props:

```typescript
export default function SessionLogger({ clientId, sessionId, session, exercises, lastPerformance, goal, level }: Props) {
```

- [ ] **Step 3: Add the recommendation key helper**

Add this helper after `sideColor()` (around line 133):

```typescript
function recKey(exerciseId: string, setNumber: number, side: string): string {
  return `${exerciseId}_set${setNumber}_${side}`
}
```

- [ ] **Step 4: Add the triggerRecommendation function**

Add this `useCallback` after the `patchSets` function (around line 210):

```typescript
  const triggerRecommendation = useCallback((completedSet: SetLog) => {
    const { exercise_id, exercise_name, set_number, side, actual_reps, actual_weight_kg, rir_actual } = completedSet

    // All three fields must be filled
    const reps = parseInt(actual_reps, 10)
    const weight = parseFloat(actual_weight_kg)
    const rir = parseInt(rir_actual, 10)
    if (!actual_reps || !actual_weight_kg || !rir_actual) return
    if (isNaN(reps) || isNaN(weight) || isNaN(rir)) return

    // Find next set for the same exercise + side
    const exerciseSets = sets.filter(s => s.exercise_id === exercise_id && s.side === side)
    const currentIdx = exerciseSets.findIndex(s => s.set_number === set_number)
    if (currentIdx === -1 || currentIdx >= exerciseSets.length - 1) return // no next set
    const nextSet = exerciseSets[currentIdx + 1]

    const nextKey = recKey(exercise_id, nextSet.set_number, side)

    // Don't overwrite if manually edited
    if (manuallyEdited.has(nextKey)) return

    // Build lastWeek data for same exercise + set_number + side
    const history = lastPerformance[exercise_name] ?? []
    const historyEntry = history.find(h => h.side === side || side === 'bilateral')
    const lastWeek = historyEntry && historyEntry.weight != null && historyEntry.reps != null
      ? {
          weight_kg: historyEntry.weight,
          reps: historyEntry.reps,
          rir_actual: historyEntry.rir ?? 2,
        }
      : undefined

    const plannedReps = parseInt(nextSet.planned_reps, 10) || 0

    const rec = recommendNextSet({
      actual_weight_kg: weight,
      actual_reps: reps,
      rir_actual: rir,
      goal,
      level,
      planned_reps: plannedReps,
      set_number: nextSet.set_number,
      lastWeek,
    })

    if (!rec) return

    // Store recommendation
    setRecommendations(prev => ({ ...prev, [nextKey]: rec }))

    // Pre-fill next set fields
    setSets(prev => prev.map(s => {
      if (s.exercise_id === exercise_id && s.set_number === nextSet.set_number && s.side === side) {
        return {
          ...s,
          actual_weight_kg: String(rec.weight_kg),
          actual_reps: String(rec.reps),
        }
      }
      return s
    }))
  }, [sets, lastPerformance, goal, level, manuallyEdited])
```

- [ ] **Step 5: Call triggerRecommendation inside toggleSet**

Find the `toggleSet` function (search for `function toggleSet` or `const toggleSet`). Inside the function, after a set is marked `completed: true`, add a call to `triggerRecommendation`.

The toggle currently uses `setSets(prev => prev.map(...))`. After that `setSets` call, add:

```typescript
    // Trigger recommendation for next set when completing
    if (!wasCompleted) {
      // Use the updated set value (with current inputs)
      const updatedSet = sets.find(s =>
        s.exercise_id === exerciseId &&
        s.set_number === setNumber &&
        s.side === side
      )
      if (updatedSet) triggerRecommendation(updatedSet)
    }
```

Note: `wasCompleted` is the previous `completed` value before the toggle. If `toggleSet` receives the set object directly, read `completedSet.completed` before the toggle to know the previous state.

- [ ] **Step 6: Mark field as manually edited on user input**

Find where `actual_weight_kg` input `onChange` is handled in the set rendering section. Add to the onChange handler:

```typescript
onChange={(e) => {
  const key = recKey(s.exercise_id, s.set_number, s.side)
  setManuallyEdited(prev => new Set(prev).add(key))
  setRecommendations(prev => {
    const next = { ...prev }
    delete next[key]
    return next
  })
  updateSet(s.exercise_id, s.set_number, s.side, 'actual_weight_kg', e.target.value)
}}
```

Do the same for `actual_reps` input onChange.

- [ ] **Step 7: TypeScript check**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 new errors.

- [ ] **Step 8: Commit**

```bash
git add app/client/programme/session/[sessionId]/SessionLogger.tsx
git commit -m "feat(session-logger): add recommendation state and triggerRecommendation logic"
```

---

## Task 5: SessionLogger — Badge Display

**Files:**
- Modify: `app/client/programme/session/[sessionId]/SessionLogger.tsx`

- [ ] **Step 1: Add the badge helper function**

Add after `recKey()` helper:

```typescript
function DeltaBadge({ rec }: { rec: SetRecommendation }) {
  if (rec.delta_vs_last === null) return null

  const isLowConfidence = rec.confidence === 'low'
  const delta = rec.delta_vs_last

  const colorClass = isLowConfidence
    ? 'text-white/40'
    : delta > 0
      ? 'text-[#1f8a65]'
      : delta < 0
        ? 'text-amber-400'
        : 'text-white/40'

  const label = delta > 0
    ? `↑ +${delta}kg`
    : delta < 0
      ? `↓ ${delta}kg`
      : `= S-1`

  return (
    <span className={`text-[10px] font-semibold ${colorClass}`}>
      {label}
    </span>
  )
}
```

- [ ] **Step 2: Render the badge next to the weight field**

In the set rendering section, find where `actual_weight_kg` input is rendered. Add the badge immediately after the input (or in the same row):

```tsx
{(() => {
  const key = recKey(s.exercise_id, s.set_number, s.side)
  const rec = recommendations[key]
  return rec ? <DeltaBadge rec={rec} /> : null
})()}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 new errors.

- [ ] **Step 4: Run the full test suite**

```bash
cd /Users/user/Desktop/VIRTUS && npx vitest run 2>&1 | tail -20
```

Expected: all existing tests pass + 8 new recommendation tests pass.

- [ ] **Step 5: Update CHANGELOG**

Open `CHANGELOG.md` and add at the top under today's date `## 2026-04-28`:

```
FEATURE: Add in-session set recommendation engine — pre-fills next set weight/reps using 1RM calculation blended with last week history. Badge shows delta vs previous week.
```

- [ ] **Step 6: Final commit**

```bash
git add app/client/programme/session/[sessionId]/SessionLogger.tsx CHANGELOG.md
git commit -m "feat(session-logger): render delta badge for recommended sets — set recommendation engine complete"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Pure `recommendNextSet()` function — Task 2
- [x] `trainingZones.ts` with % 1RM per goal — Task 1
- [x] `goal` + `level` injected server-side from template — Task 3
- [x] `rir_actual` added to `lastPerformance` — Task 3
- [x] Pre-fill next set weight + reps — Task 4
- [x] `manuallyEdited` tracking → badge disappears on edit — Tasks 4+5
- [x] History blend 0.7/0.3 — Task 2 implementation
- [x] Delta badge (↑ green / ↓ amber / = white) — Task 5
- [x] Confidence low when reps > 10 → badge white/40 — Task 2 + Task 5
- [x] No recommendation on last set — Task 4 (currentIdx >= length - 1 guard)
- [x] Unilateral: per-side independently — Task 4 (filters by side)
- [x] Fallback goal → hypertrophy — Task 1 (FALLBACK constant)
- [x] `historicalSessions?` future hook present — Task 2 (in interface, unused)
- [x] No schema changes, no new API endpoints — confirmed throughout
- [x] CHANGELOG update — Task 5

**Type consistency:**
- `recKey()` defined in Task 4 Step 3, used in Tasks 4+5 ✓
- `SetRecommendation` imported from `lib/training/setRecommendation.ts`, used in Tasks 4+5 ✓
- `LastPerf.rir` added in Task 3+4, consumed in `triggerRecommendation` ✓
- `DeltaBadge` receives `rec: SetRecommendation`, consistent with `recommendations` state type ✓

**Placeholder scan:** No TBD, no TODOs, all steps have code. ✓
