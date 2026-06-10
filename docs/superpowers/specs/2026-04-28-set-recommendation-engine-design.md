# Set Recommendation Engine — Design Spec

**Date:** 2026-04-28
**Status:** Approved
**Scope:** Client app — SessionLogger — in-session charge recommendation

---

## Problem

The client manually enters weight, reps, and RIR for every set with no guidance. Other leading apps pre-fill the next set based on performance data. STRYVR has all the data needed (1RM formulas, historical logs, training goal) but doesn't use it in-session.

---

## Goal

After a client completes a set (weight + reps + RIR all entered, set checked), automatically pre-fill the next set's weight and reps fields with an optimal recommendation. Display a badge showing the delta vs last week's performance.

---

## Architecture

Three layers, strictly separated:

```
page.tsx (server)
  → injects: goal, level, lastPerformance (enriched with rir_actual)
      ↓
SessionLogger (client)
  → useSetRecommendation hook
      ↓
lib/training/setRecommendation.ts (pure function, no React, no network)
```

The pure function layer is designed for future replacement by an ML-based approach (Approach C) without touching the SessionLogger or page.tsx.

---

## New Files

### `lib/training/trainingZones.ts`

Defines target intensity zones per goal and level:

| Goal | % 1RM target (mid-zone) | RIR target |
|------|--------------------------|------------|
| hypertrophy | 72% (67–80%) | 2 |
| strength | 85% (80–90%) | 1 |
| endurance | 57% (50–65%) | 4 |
| recomp | 71% (67–75%) | 2 |
| fat_loss | 67% (60–75%) | 3 |
| maintenance | 70% | 2 |

Fallback if goal unknown: hypertrophy zone.

### `lib/training/setRecommendation.ts`

**Input type:**
```typescript
interface SetRecommendationInput {
  // Completed set data
  actual_weight_kg: number
  actual_reps: number
  rir_actual: number

  // Program context
  goal: string
  level: string // 'beginner' | 'intermediate' | 'advanced' | 'elite'
  planned_reps: number // target reps for next set (from program)
  set_number: number // which set is being recommended (1-indexed)

  // Optional: historical data from last week (same exercise, same set_number)
  lastWeek?: {
    weight_kg: number
    reps: number
    rir_actual: number
  }

  // Future hook for Approach C (ML regression)
  historicalSessions?: HistoricalSession[]
}

interface SetRecommendation {
  weight_kg: number       // recommended weight, rounded to 0.25kg
  reps: number            // recommended reps
  confidence: 'high' | 'low'  // low if actual_reps > 10
  delta_vs_last: number | null // +2.5, -2.5, or 0 — null if no history
}
```

**Calculation logic:**

1. **Estimate 1RM from completed set:**
   `repsToFailure = actual_reps + rir_actual`
   `estimatedOneRM = calculateOneRM({ weight: actual_weight_kg, reps: repsToFailure }, 'average')`

2. **If history available — blend:**
   `oneRMHistory = calculateOneRM({ weight: lastWeek.weight_kg, reps: lastWeek.reps + lastWeek.rir_actual }, 'average')`
   `blendedOneRM = (oneRMHistory × 0.7) + (estimatedOneRM × 0.3)`

3. **If no history:**
   `blendedOneRM = estimatedOneRM`

4. **Derive target weight:**
   `targetWeight = blendedOneRM × targetPct` (from trainingZones)
   Round to nearest 0.25kg.

5. **Derive target reps:**
   Use `planned_reps` from the program as the rep target. If planned_reps is 0 or null, derive from the zone mid-rep range.

6. **Confidence:**
   `'low'` if `actual_reps > 10` (Brzycki/Epley become unreliable above 10 reps).

7. **Delta:**
   `delta_vs_last = targetWeight - lastWeek.weight_kg` (null if no history).

8. **No recommendation returned when:**
   - `actual_reps <= 0` or `actual_weight_kg <= 0`
   - `actual_reps + rir_actual < 1` (impossible input)
   - This is the last set of the exercise (no next set to fill)

### `tests/lib/training/setRecommendation.test.ts`

Unit tests covering:
- Hypertrophy zone without history
- Strength zone without history
- With history: blended 1RM anchors correctly
- Delta badge: positive, negative, zero
- Confidence: high ≤ 10 reps, low > 10 reps
- Edge cases: reps=1, rir=0, no goal fallback

---

## Modified Files

### `app/client/programme/session/[sessionId]/page.tsx`

**Additional fetch:** Join `program_sessions → programs → coach_program_templates` to get `goal` and `level`.

```typescript
// Existing query extended:
const { data: sessionData } = await supabase
  .from('program_sessions')
  .select(`
    ...existing fields...,
    programs (
      coach_program_templates (
        goal,
        level
      )
    )
  `)
  .eq('id', sessionId)
  .single()

const goal = sessionData?.programs?.coach_program_templates?.goal
  ?? clientData?.training_goal
  ?? 'hypertrophy'

const level = sessionData?.programs?.coach_program_templates?.level
  ?? clientData?.fitness_level
  ?? 'intermediate'
```

**`lastPerformance` enriched:** Add `rir_actual` to the existing select on `client_set_logs`:

```typescript
// Before: { weight, reps, side }
// After:  { weight, reps, side, rir }
```

**Props added to SessionLogger:**
```typescript
goal: string
level: string
// lastPerformance already passed, now includes rir per set
```

### `app/client/programme/session/[sessionId]/SessionLogger.tsx`

**New props:**
```typescript
goal: string
level: string
```

**New state:**
```typescript
recommendations: Record<string, SetRecommendation>
// Key format: `${exerciseId}_set${setNumber}_${side}`
```

**Trigger logic (inside `toggleSet` or a dedicated effect):**

When a set is checked AND `actual_reps`, `actual_weight_kg`, `rir_actual` are all non-empty:
1. Find the next set for the same exercise
2. If next set exists and hasn't been manually edited yet:
   - Call `recommendNextSet(input)`
   - Store result in `recommendations`
   - Pre-fill `actual_weight_kg` and `actual_reps` for next set

**"Manually edited" detection:**
Track `manuallyEdited: Set<string>` — add key when user types into a pre-filled field. Pre-fill only if key not in this set.

**Badge display:**

Rendered next to the weight field of each set that has a recommendation:

```tsx
{rec.delta_vs_last !== null && (
  <span className={cn(
    "text-[10px] font-semibold",
    rec.delta_vs_last > 0 ? "text-[#1f8a65]" : 
    rec.delta_vs_last < 0 ? "text-amber-400" : 
    "text-white/40",
    rec.confidence === 'low' ? "text-white/40" : ""
  )}>
    {rec.delta_vs_last > 0 ? `↑ +${rec.delta_vs_last}kg` :
     rec.delta_vs_last < 0 ? `↓ ${rec.delta_vs_last}kg` :
     `= S-1`}
  </span>
)}
```

Badge disappears when user manually edits the field (key added to `manuallyEdited`).

**Unilateral exercises:**
Recommendation is computed per side independently — left and right have separate `lastWeek` data and separate recommendation keys.

---

## Constraints & Edge Cases

| Case | Behavior |
|------|----------|
| RIR not entered on completed set | No recommendation triggered |
| actual_reps > 10 | Recommendation computed but confidence = 'low', badge in white/40 |
| Last set of exercise | No recommendation (no next set) |
| Client modifies pre-filled field | Badge disappears, field stays free |
| No history, first session ever | Recommendation from live 1RM only (no delta badge) |
| goal/level not found | Fallback: hypertrophy + intermediate |
| Unilateral exercise | Independent computation per side |

---

## Future: Approach C Hook

`SetRecommendationInput` includes `historicalSessions?: HistoricalSession[]` — intentionally unused in Phase 1. When the ML regression approach is ready:
1. Populate `historicalSessions` in `page.tsx` from the full `client_set_logs` history
2. Add a branch in `recommendNextSet()` that uses regression when `historicalSessions.length >= N`
3. No changes to SessionLogger or badge display logic

---

## No Schema Changes

- No new DB tables
- No new API endpoints
- No Prisma migration required
- `rir_actual` already exists in `client_set_logs` — just needs to be included in the existing select

---

## Files Summary

```
NEW:
  lib/training/setRecommendation.ts
  lib/training/trainingZones.ts
  tests/lib/training/setRecommendation.test.ts

MODIFIED:
  app/client/programme/session/[sessionId]/page.tsx
  app/client/programme/session/[sessionId]/SessionLogger.tsx
```
