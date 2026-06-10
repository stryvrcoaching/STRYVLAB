# Set Recommendation Engine v2 — Design Spec

**Date:** 2026-05-17  
**Scope:** `lib/training/setRecommendation.ts` + `SessionLogger.tsx` + `page.tsx` (session fetch)  
**Goal:** Fix 5 bugs, close 1 architectural gap, make the engine scientifically sound for hypertrophy double-progression.

---

## 1. Problem Statement

The current engine has two paths (Path A = double progression with S-1 history, Path B = intra-session only) but suffers from:

1. **Bug — `lastPerformance` fetch includes current session**: No filter on `session_log_id`. Client doing an exercise twice today sees their own earlier sets as "last week".
2. **Bug — Path A ignores current-set RIR**: If S-1 justified an overload but the client is clearly struggling right now (RIR 0), the engine blindly prescribes +increment. Wrong.
3. **Bug — `belowZone && !rirTooLow` unhandled**: Client does fewer reps than target but has RIR left (load technically too heavy for form, not for effort). Falls through to `else`, gets `actual_reps + 1` at same weight — wrong. Should maintain weight and target `planned_reps`.
4. **Bug — trailing `.` / `,` in weight display**: `String(rec.weight_kg)` injected directly into input. Locale decimal separator + floating point can render `"47."` or `"48,"`.
5. **Bug — delta badge shown when targetWeight === prev_set_weight**: Client already lifted that weight this session. Showing `↑ +4.6kg` vs last week is misleading — the "jump" already happened.

---

## 2. Architecture

No new files. All changes confined to:

- `lib/training/setRecommendation.ts` — pure logic, no React
- `app/client/programme/session/[sessionId]/page.tsx` — fix fetch
- `app/client/programme/session/[sessionId]/SessionLogger.tsx` — fix float display + delta badge

The engine stays deterministic and pure (no side effects, no API calls inside). Fully unit-testable.

---

## 3. `setRecommendation.ts` v2 — Logic

### 3.1 Input interface (unchanged externally)

```ts
interface SetRecommendationInput {
  actual_weight_kg: number     // weight on set just completed
  actual_reps: number          // reps on set just completed
  rir_actual: number           // RIR on set just completed
  goal: string
  level: string
  planned_reps: number
  set_number: number
  rep_min?: number
  rep_max?: number
  target_rir?: number
  weight_increment_kg?: number
  lastWeek?: { weight_kg: number; reps: number; rir_actual: number }
  prev_set_weight_kg?: number   // floor — never recommend below this
}
```

### 3.2 Path A — Double progression with RIR modulation

**Trigger**: `lastWeek` present and valid.

**Base logic** (unchanged):
- `lastAtOrAboveRepMax && lastRirCompliant` → overload phase: `lastWeek.weight + increment`
- else → reps phase: `lastWeek.weight`, target `lastWeek.reps + 1`

**New: RIR override on current set**:
```
HOLD   : rir_actual ≤ target_rir - 2  → veto any overload, cap at lastWeek.weight
NORMAL : target_rir - 2 < rir_actual ≤ target_rir + 2  → base logic applies
BOOST  : rir_actual > target_rir + 2  → if already in overload phase, +2 increments instead of +1
```

HOLD prevents injury. BOOST accelerates when client is clearly undertrained on this load.

**Delta badge rule**: `delta_vs_last = targetWeight - lastWeek.weight_kg`. Set to `null` if `targetWeight <= prev_set_weight_kg` — the client is already at or above that load this session, the delta is stale information.

### 3.3 Path B — Intra-session (no S-1 history) — full branch coverage

All 6 branches now explicit:

| Condition | Weight | Reps | Rationale |
|-----------|--------|------|-----------|
| `aboveZone` | `+increment` | `rep_min` | Load too light |
| `belowZone && rirTooLow` | `-increment` | `rep_min` | Load too heavy, near failure |
| `belowZone && !rirTooLow` | `maintain` | `planned_reps` | **NEW** Load technically heavy but effort OK — hold, target prescription |
| `inZone && rirTooHigh` | `+increment` | `rep_min` | In zone but too easy |
| `inZone && rirTooLow` | `maintain` | `actual_reps` | In zone but near failure |
| `inZone && rirNormal` | `maintain` | `min(actual_reps+1, rep_max)` | Standard progression |

`confidence` stays `'low'` for all Path B (no S-1 data).

Floor rule applies after all branches: `targetWeight = max(targetWeight, prev_set_weight_kg, increment)`.

---

## 4. `page.tsx` — Fix Fetch

### Current (broken)
```ts
.from('client_set_logs')
.select('...')
.eq('completed', true)
.eq('client_session_logs.client_id', client.id)
.in('exercise_name', exerciseNames)
.order('created_at', { ascending: false })
.limit(200)
```

No exclusion of the current draft session log → today's sets contaminate "last week" data.

### Fixed
```ts
// Fetch the current draft session_log_id from the in-progress session
// (already available server-side via program_session → client_session_logs query)
// Filter: exclude any set_log belonging to a session_log where program_session_id = current session

.neq('client_session_logs.program_session_id', params.sessionId)
```

Or safer: resolve current draft `client_session_log.id` and `.neq('session_log_id', currentDraftId)`. Since the draft may not exist yet at server render time, filter by `completed_at IS NOT NULL` on `client_session_logs` (only fully completed sessions, not in-progress drafts).

**Fix**: add `.not('client_session_logs.completed_at', 'is', null)` to the join filter — only pull sets from **completed** sessions.

---

## 5. `SessionLogger.tsx` — Display Fixes

### 5.1 Float display

Replace:
```ts
actual_weight_kg: String(rec.weight_kg)
```

With:
```ts
actual_weight_kg: formatWeight(rec.weight_kg)
```

Where:
```ts
function formatWeight(kg: number): string {
  // Strip trailing zeros and dot: 47.50 → "47.5", 47.00 → "47", 47.5 → "47.5"
  return parseFloat(kg.toFixed(2)).toString()
}
```

This is locale-independent (`toString()` always uses `.` as decimal separator in JS).

### 5.2 Delta badge

`DeltaBadge` already checks `rec.delta_vs_last === null` → returns null. The fix is upstream in `recommendNextSet`: return `delta_vs_last: null` when `targetWeight <= (prev_set_weight_kg ?? 0)`. No UI change needed.

---

## 6. Tests

File: `tests/lib/training/setRecommendation.test.ts`

Coverage required:

**Path A:**
- Overload phase normal → +increment
- Overload phase HOLD (rir too low) → no overload, maintain last week weight
- Overload phase BOOST (rir very high) → +2 increments
- Reps phase → +1 rep, same weight
- Floor: targetWeight never below prev_set_weight_kg
- Delta null when targetWeight === prev_set_weight

**Path B:**
- aboveZone → +increment
- belowZone + rirTooLow → -increment
- belowZone + !rirTooLow → maintain, planned_reps  ← **the bug fix**
- inZone + rirTooHigh → +increment
- inZone + rirTooLow → maintain, actual_reps
- inZone + rirNormal → maintain, actual_reps+1

**Edge cases:**
- `actual_weight_kg = 0` → null
- `weight_increment_kg = 0` → defaults to 2.5
- Float precision: `roundToIncrement(47.5, 2.5)` → `47.5` not `47.500000001`

Minimum: **15 tests**, all passing before any UI work.

---

## 7. Invariants (non-negotiable)

1. `recommendNextSet` is pure — no side effects, no React hooks, no API calls.
2. Result `weight_kg` always ≥ `weight_increment_kg` (no zero or negative loads).
3. Result `weight_kg` always ≥ `prev_set_weight_kg` when provided.
4. `delta_vs_last` is null in Path B always (no S-1 reference).
5. `delta_vs_last` is null in Path A when `targetWeight <= prev_set_weight_kg`.
6. `confidence: 'high'` only in Path A. Path B always `'low'`.
7. `formatWeight` never emits locale-specific chars (no `,`, no trailing `.`).

---

## 8. Out of Scope

- ML regression (Approach C in comments) — Phase 2
- Per-exercise weight history chart — Phase 2
- Velocity-based training (VBT) — not in STRYVR roadmap
- Modifying the superset navigation logic
- Changing how `current_weight_kg` is initialized (coach-prescribed seed weight)
