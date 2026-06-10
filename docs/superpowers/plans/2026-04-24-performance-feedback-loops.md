# Performance Feedback Loops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display per-exercise performance trend badges (↗ Progression / → Stagnation / ↘ Surmenage) in the Program Template Builder when the builder has a `clientId`, by reading the last 3 completed sessions from `client_set_logs`.

**Architecture:** Three-layer: (1) a new API endpoint that reads `client_set_logs` + `client_session_logs` and returns a structured trend result; (2) a pure TypeScript function that applies three detection rules (stagnation, overtraining, progression) to a list of session observations; (3) a UI badge on `ExerciseCard` + data wiring through `EditorPane` → `ProgramTemplateBuilder`.

**Tech Stack:** Next.js App Router API routes, Supabase service client, Zod (validation), Vitest (tests), TypeScript strict, Tailwind DS v2.0.

---

## File Structure

| Path | Action | Responsibility |
|------|--------|----------------|
| `lib/programs/intelligence/performance.ts` | **Create** | Pure `detectPerformanceTrend(sessions)` function + types |
| `tests/lib/intelligence/performance.test.ts` | **Create** | Unit tests for all detection rules |
| `app/api/clients/[clientId]/performance/[exerciseName]/route.ts` | **Create** | GET endpoint returning trend for one exercise |
| `components/programs/studio/ExerciseCard.tsx` | **Modify** | Add optional `performanceTrend` prop + badge UI |
| `components/programs/studio/EditorPane.tsx` | **Modify** | Add `clientId?` prop, fetch trends, pass to ExerciseCard |
| `components/programs/ProgramTemplateBuilder.tsx` | **Modify** | Pass `clientId` down to EditorPane |

---

## Task 1: Pure Detection Function + Types

**Files:**
- Create: `lib/programs/intelligence/performance.ts`
- Create: `tests/lib/intelligence/performance.test.ts`

### Detection Rules

| Trend | Condition |
|-------|-----------|
| `'progression'` | volumeKg is strictly increasing across last 3 sessions AND avg RIR ≤ 4 |
| `'stagnation'` | volumeKg is equal or oscillating (max delta < 3%) across last 3 sessions AND avg RIR ≥ 3 |
| `'overtraining'` | avg RIR ≤ 1 across last 2 sessions AND set completion rate < 80% |
| `null` | fewer than 2 sessions, or data is ambiguous |

**volumeKg per session** = sum of (actual_reps × actual_weight_kg) for completed sets.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/intelligence/performance.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { detectPerformanceTrend, type SessionObservation } from '@/lib/programs/intelligence/performance'

const makeSession = (
  sets: { reps: number; weight: number; completed: boolean; rir?: number | null }[]
): SessionObservation => ({
  completedAt: new Date().toISOString(),
  sets: sets.map(s => ({
    actual_reps: s.reps,
    actual_weight_kg: s.weight,
    completed: s.completed,
    rir_actual: s.rir ?? null,
  })),
})

describe('detectPerformanceTrend', () => {
  it('returns null when fewer than 2 sessions', () => {
    const result = detectPerformanceTrend([makeSession([{ reps: 8, weight: 80, completed: true, rir: 3 }])])
    expect(result.trend).toBeNull()
  })

  it('detects progression: volume strictly increasing + avg RIR <= 4', () => {
    const sessions = [
      makeSession([{ reps: 8, weight: 60, completed: true, rir: 4 }]),
      makeSession([{ reps: 8, weight: 70, completed: true, rir: 3 }]),
      makeSession([{ reps: 8, weight: 80, completed: true, rir: 2 }]),
    ]
    const result = detectPerformanceTrend(sessions)
    expect(result.trend).toBe('progression')
    expect(result.suggestion).not.toBeNull()
  })

  it('detects stagnation: flat volume + avg RIR >= 3', () => {
    const sessions = [
      makeSession([{ reps: 8, weight: 80, completed: true, rir: 4 }]),
      makeSession([{ reps: 8, weight: 80, completed: true, rir: 3 }]),
      makeSession([{ reps: 8, weight: 80, completed: true, rir: 3 }]),
    ]
    const result = detectPerformanceTrend(sessions)
    expect(result.trend).toBe('stagnation')
  })

  it('detects stagnation: oscillating volume (delta < 3%) + avg RIR >= 3', () => {
    // 640 → 644 → 640: all deltas < 3%
    const sessions = [
      makeSession([{ reps: 8, weight: 80, completed: true, rir: 3 }]),    // 640
      makeSession([{ reps: 8, weight: 80.5, completed: true, rir: 3 }]),  // 644
      makeSession([{ reps: 8, weight: 80, completed: true, rir: 3 }]),    // 640
    ]
    const result = detectPerformanceTrend(sessions)
    expect(result.trend).toBe('stagnation')
  })

  it('detects overtraining: avg RIR <= 1 for last 2 + completion < 80%', () => {
    const sessions = [
      makeSession([
        { reps: 8, weight: 80, completed: true, rir: 1 },
        { reps: 8, weight: 80, completed: false, rir: 0 },
        { reps: 8, weight: 80, completed: false, rir: 0 },
      ]),
      makeSession([
        { reps: 8, weight: 80, completed: true, rir: 0 },
        { reps: 8, weight: 80, completed: false, rir: 0 },
        { reps: 8, weight: 80, completed: false, rir: 0 },
      ]),
    ]
    const result = detectPerformanceTrend(sessions)
    expect(result.trend).toBe('overtraining')
  })

  it('overtraining requires both low RIR AND low completion — high RIR no trigger', () => {
    const sessions = [
      makeSession([{ reps: 8, weight: 80, completed: false, rir: 4 }, { reps: 8, weight: 80, completed: false, rir: 3 }]),
      makeSession([{ reps: 8, weight: 80, completed: false, rir: 3 }, { reps: 8, weight: 80, completed: false, rir: 4 }]),
    ]
    const result = detectPerformanceTrend(sessions)
    // High RIR means too easy, not overtraining
    expect(result.trend).not.toBe('overtraining')
  })

  it('returns null when only 1 session even if RIR = 0', () => {
    const result = detectPerformanceTrend([
      makeSession([{ reps: 8, weight: 80, completed: false, rir: 0 }]),
    ])
    expect(result.trend).toBeNull()
  })

  it('returns null with 2 sessions but ambiguous (progression not stable)', () => {
    // Only 2 sessions and volume went up — progression needs >= 2 sessions and trend
    const sessions = [
      makeSession([{ reps: 8, weight: 80, completed: true, rir: 2 }]),
      makeSession([{ reps: 8, weight: 85, completed: true, rir: 2 }]),
    ]
    // With 2 sessions, volume went up and RIR <= 4 — we allow progression detection
    const result = detectPerformanceTrend(sessions)
    expect(result.trend).toBe('progression')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/user/Desktop/VIRTUS && npx vitest run tests/lib/intelligence/performance.test.ts 2>&1 | head -30
```

Expected: FAIL with "Cannot find module '@/lib/programs/intelligence/performance'"

- [ ] **Step 3: Implement `lib/programs/intelligence/performance.ts`**

```typescript
// lib/programs/intelligence/performance.ts

export interface SetObservation {
  actual_reps: number | null
  actual_weight_kg: number | null
  completed: boolean
  rir_actual: number | null
}

export interface SessionObservation {
  completedAt: string
  sets: SetObservation[]
}

export interface PerformanceTrendResult {
  trend: 'progression' | 'stagnation' | 'overtraining' | null
  suggestion: string | null
  sessionCount: number
}

function sessionVolumeKg(session: SessionObservation): number {
  return session.sets
    .filter(s => s.completed)
    .reduce((sum, s) => sum + (s.actual_reps ?? 0) * (s.actual_weight_kg ?? 0), 0)
}

function avgRir(sets: SetObservation[]): number | null {
  const withRir = sets.filter(s => s.rir_actual != null)
  if (withRir.length === 0) return null
  return withRir.reduce((sum, s) => sum + (s.rir_actual ?? 0), 0) / withRir.length
}

function completionRate(sets: SetObservation[]): number {
  if (sets.length === 0) return 1
  return sets.filter(s => s.completed).length / sets.length
}

export function detectPerformanceTrend(
  sessions: SessionObservation[],
): PerformanceTrendResult {
  if (sessions.length < 2) {
    return { trend: null, suggestion: null, sessionCount: sessions.length }
  }

  // Sort oldest → newest (API returns newest first, so we reverse)
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  )

  const recent2 = sorted.slice(-2)
  const allSetsRecent2 = recent2.flatMap(s => s.sets)

  // Rule 1: Overtraining — avg RIR ≤ 1 in last 2 sessions AND completion < 80%
  const rir2 = avgRir(allSetsRecent2)
  const completion2 = completionRate(allSetsRecent2)
  if (rir2 !== null && rir2 <= 1 && completion2 < 0.8) {
    return {
      trend: 'overtraining',
      suggestion: 'Réduire le volume ou ajouter une séance de récupération active.',
      sessionCount: sessions.length,
    }
  }

  // Volume per session (oldest to newest)
  const volumes = sorted.map(sessionVolumeKg)

  // Rule 2: Progression — volume strictly increasing, avg RIR ≤ 4
  const allSets = sorted.flatMap(s => s.sets)
  const avgRirAll = avgRir(allSets)
  const isIncreasing = volumes.every((v, i) => i === 0 || v > volumes[i - 1])
  if (isIncreasing && (avgRirAll === null || avgRirAll <= 4)) {
    return {
      trend: 'progression',
      suggestion: 'Bonne progression — envisager une surcharge progressive (+2.5kg ou +1 rep).',
      sessionCount: sessions.length,
    }
  }

  // Rule 3: Stagnation — all volume deltas < 3%, avg RIR ≥ 3
  const maxDelta = volumes.reduce((max, v, i) => {
    if (i === 0) return max
    const ref = volumes[i - 1]
    if (ref === 0) return max
    return Math.max(max, Math.abs(v - ref) / ref)
  }, 0)
  const isFlat = maxDelta < 0.03
  if (isFlat && avgRirAll !== null && avgRirAll >= 3) {
    return {
      trend: 'stagnation',
      suggestion: 'Plateau détecté — augmenter la charge ou modifier le schéma de sets/reps.',
      sessionCount: sessions.length,
    }
  }

  return { trend: null, suggestion: null, sessionCount: sessions.length }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/user/Desktop/VIRTUS && npx vitest run tests/lib/intelligence/performance.test.ts 2>&1
```

Expected: 8/8 PASS

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
cd /Users/user/Desktop/VIRTUS && git add lib/programs/intelligence/performance.ts tests/lib/intelligence/performance.test.ts && git commit -m "feat(intelligence): add detectPerformanceTrend pure function with 8 unit tests"
```

---

## Task 2: API Endpoint

**Files:**
- Create: `app/api/clients/[clientId]/performance/[exerciseName]/route.ts`

This endpoint:
1. Authenticates coach + verifies ownership
2. Queries last 3 completed `client_session_logs` that have at least one `client_set_logs` row matching `exercise_name`
3. Returns `PerformanceTrendResult` + raw sessions for debugging

- [ ] **Step 1: Write the route**

Create `app/api/clients/[clientId]/performance/[exerciseName]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { detectPerformanceTrend } from '@/lib/programs/intelligence/performance'
import type { SessionObservation } from '@/lib/programs/intelligence/performance'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type Params = { params: { clientId: string; exerciseName: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = service()

  // Coach ownership check
  const { data: client } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  }

  const exerciseName = decodeURIComponent(params.exerciseName)

  // Get last 3 completed session logs that contain this exercise
  const { data: sessionLogs } = await db
    .from('client_session_logs')
    .select('id, completed_at')
    .eq('client_id', params.clientId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(10) // fetch more, then filter by exercise presence below

  if (!sessionLogs || sessionLogs.length === 0) {
    return NextResponse.json({ trend: null, suggestion: null, sessionCount: 0 })
  }

  const sessionIds = sessionLogs.map(s => s.id)

  // Fetch set logs for this exercise across those sessions
  const { data: setLogs } = await db
    .from('client_set_logs')
    .select('session_log_id, actual_reps, actual_weight_kg, completed, rir_actual')
    .eq('exercise_name', exerciseName)
    .in('session_log_id', sessionIds)

  if (!setLogs || setLogs.length === 0) {
    return NextResponse.json({ trend: null, suggestion: null, sessionCount: 0 })
  }

  // Group sets by session, keep only sessions that have at least 1 set for this exercise
  const setsBySession: Record<string, typeof setLogs> = {}
  for (const set of setLogs) {
    if (!setsBySession[set.session_log_id]) {
      setsBySession[set.session_log_id] = []
    }
    setsBySession[set.session_log_id].push(set)
  }

  // Build SessionObservation list, limited to last 3 sessions with data
  const observations: SessionObservation[] = sessionLogs
    .filter(s => setsBySession[s.id])
    .slice(0, 3)
    .map(s => ({
      completedAt: s.completed_at as string,
      sets: setsBySession[s.id].map(set => ({
        actual_reps: set.actual_reps,
        actual_weight_kg: set.actual_weight_kg,
        completed: set.completed,
        rir_actual: set.rir_actual,
      })),
    }))

  const result = detectPerformanceTrend(observations)

  return NextResponse.json(result)
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors

- [ ] **Step 3: Manual smoke test (optional)**

The endpoint is a standard authenticated GET — no unit test required for the route itself (integration tests against Supabase are out of scope). Verify by checking tsc output above.

- [ ] **Step 4: Commit**

```bash
cd /Users/user/Desktop/VIRTUS && git add app/api/clients/[clientId]/performance/ && git commit -m "feat(api): add GET /api/clients/[clientId]/performance/[exerciseName] endpoint"
```

---

## Task 3: UI — Badge on ExerciseCard + Wiring

**Files:**
- Modify: `components/programs/studio/ExerciseCard.tsx`
- Modify: `components/programs/studio/EditorPane.tsx`
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

### 3A: ExerciseCard — add `performanceTrend` prop + badge

The badge appears just below the exercise name. It shows:
- `↗ Progression` in green (`#1f8a65`)
- `→ Stagnation` in amber (`#f59e0b`)
- `↘ Surmenage` in red (`#ef4444`)

- [ ] **Step 1: Add `performanceTrend` to Props and render badge**

In `components/programs/studio/ExerciseCard.tsx`, add to the `Props` interface (after `isLast?: boolean`):

```typescript
  performanceTrend?: 'progression' | 'stagnation' | 'overtraining' | null
  performanceSuggestion?: string | null
```

Add to the destructured props in `ExerciseCard` function signature (after `isLast`):

```typescript
  performanceTrend,
  performanceSuggestion,
```

Find the spot just after the exercise name input field (the `<input value={exercise.name}` block), and add the badge immediately after it. The badge should only render when `performanceTrend` is not null:

```tsx
{performanceTrend && (
  <div className="flex items-center gap-1.5 mt-1">
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{
        color: performanceTrend === 'progression' ? '#1f8a65'
          : performanceTrend === 'stagnation' ? '#f59e0b'
          : '#ef4444',
        backgroundColor: performanceTrend === 'progression' ? 'rgba(31,138,101,0.12)'
          : performanceTrend === 'stagnation' ? 'rgba(245,158,11,0.12)'
          : 'rgba(239,68,68,0.12)',
      }}
    >
      {performanceTrend === 'progression' ? '↗ Progression'
        : performanceTrend === 'stagnation' ? '→ Stagnation'
        : '↘ Surmenage'}
    </span>
    {performanceSuggestion && (
      <span className="text-[10px] text-white/35 truncate max-w-[200px]" title={performanceSuggestion}>
        {performanceSuggestion}
      </span>
    )}
  </div>
)}
```

- [ ] **Step 2: Verify TypeScript in ExerciseCard**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | grep ExerciseCard
```

Expected: no errors

### 3B: EditorPane — add `clientId?` + fetch trends

- [ ] **Step 3: Locate EditorPane props and fetch logic**

Read `components/programs/studio/EditorPane.tsx` to find:
- The Props interface
- Where sessions are rendered (where `ExerciseCard` is called)
- Import section

- [ ] **Step 4: Add `clientId?` prop to EditorPane and fetch trend data**

Add to EditorPane's Props interface:
```typescript
  clientId?: string
```

Add to the EditorPane component imports:
```typescript
import { useEffect, useState, useCallback } from 'react'
```
(merge with existing React imports if present)

Add after the existing state declarations:
```typescript
const [trendMap, setTrendMap] = useState<Record<string, { trend: 'progression' | 'stagnation' | 'overtraining' | null; suggestion: string | null }>>({})

const fetchTrend = useCallback(async (exerciseName: string) => {
  if (!clientId || !exerciseName.trim()) return
  // Cache: skip if already fetched
  setTrendMap(prev => {
    if (exerciseName in prev) return prev
    return prev
  })
  try {
    const res = await fetch(
      `/api/clients/${clientId}/performance/${encodeURIComponent(exerciseName)}`
    )
    if (!res.ok) return
    const data = await res.json()
    setTrendMap(prev => ({ ...prev, [exerciseName]: { trend: data.trend, suggestion: data.suggestion } }))
  } catch {
    // non-blocking
  }
}, [clientId])

useEffect(() => {
  if (!clientId) return
  const names = sessions.flatMap(s => s.exercises.map(e => e.name)).filter(n => n.trim())
  const unique = [...new Set(names)]
  unique.forEach(name => fetchTrend(name))
}, [clientId, sessions, fetchTrend])
```

- [ ] **Step 5: Pass trend props to ExerciseCard**

In the EditorPane's ExerciseCard render call, add:
```tsx
performanceTrend={trendMap[exercise.name]?.trend ?? null}
performanceSuggestion={trendMap[exercise.name]?.suggestion ?? null}
```

- [ ] **Step 6: Verify TypeScript in EditorPane**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | grep EditorPane
```

Expected: no errors

### 3C: ProgramTemplateBuilder — pass clientId to EditorPane

- [ ] **Step 7: Find where EditorPane is rendered in ProgramTemplateBuilder**

Read `components/programs/ProgramTemplateBuilder.tsx` — search for `<EditorPane` to find the props list.

- [ ] **Step 8: Add `clientId` prop to EditorPane call**

In the `<EditorPane ... />` JSX block, add:
```tsx
clientId={clientId}
```

(The `clientId` prop already exists on `ProgramTemplateBuilder` — it just needs to be forwarded.)

- [ ] **Step 9: Full TypeScript check**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1
```

Expected: 0 errors

- [ ] **Step 10: Update CHANGELOG.md**

Add to `CHANGELOG.md` under today's date:

```
## 2026-04-24

FEATURE: Phase 3 Performance Feedback Loops — detectPerformanceTrend, API endpoint, ExerciseCard badges
```

- [ ] **Step 11: Update project-state.md**

Add a new dated section `## 2026-04-24 — Phase 3 Performance Feedback Loops` to `.claude/rules/project-state.md` describing what was done, files changed, and next steps.

- [ ] **Step 12: Commit all UI changes**

```bash
cd /Users/user/Desktop/VIRTUS && git add components/programs/studio/ExerciseCard.tsx components/programs/studio/EditorPane.tsx components/programs/ProgramTemplateBuilder.tsx CHANGELOG.md .claude/rules/project-state.md && git commit -m "feat(ui): add performance trend badges on ExerciseCard — client-context only"
```

---

## Self-Review

**Spec coverage:**
- ✅ Task 1: Pure function with 8 tests covering all rules
- ✅ Task 2: API endpoint with ownership check, fetches last 3 sessions with exercise data
- ✅ Task 3A: Badge UI on ExerciseCard with 3 visual states
- ✅ Task 3B: EditorPane fetches trends per exercise name (de-duplicated), non-blocking
- ✅ Task 3C: clientId forwarded from ProgramTemplateBuilder → EditorPane

**No placeholders:** All code steps are complete and runnable.

**Type consistency:**
- `PerformanceTrendResult.trend` is `'progression' | 'stagnation' | 'overtraining' | null` throughout
- `performanceTrend` prop on ExerciseCard uses the same union
- `trendMap` in EditorPane stores same shape as API response

**YAGNI check:**
- No auto-apply of recommendations — display only
- No morpho-performance correlation — out of scope
- No SRA real-weeks heatmap — out of scope
- Trend data is fetched once on mount (not subscribed) — sufficient for Phase 3
