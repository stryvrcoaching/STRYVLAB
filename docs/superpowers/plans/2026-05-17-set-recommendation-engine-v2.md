# Set Recommendation Engine v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 bugs + 1 architectural gap in the set recommendation engine to produce scientifically sound double-progression recommendations during live training sessions.

**Architecture:** Pure logic fix in `lib/training/setRecommendation.ts` (no React, fully unit-tested), server-side fetch fix in `page.tsx` (exclude in-progress sessions from history), display fix in `SessionLogger.tsx` (float formatting + delta badge).

**Tech Stack:** TypeScript strict, Vitest, Next.js App Router, Supabase

**Spec:** `docs/superpowers/specs/2026-05-17-set-recommendation-engine-v2-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/training/setRecommendation.ts` | Modify | Core recommendation logic — Path A RIR modulation + Path B missing branch |
| `tests/lib/training/setRecommendation.test.ts` | Modify | Add 9 new tests covering new branches |
| `app/client/programme/session/[sessionId]/page.tsx` | Modify | Fix fetch to exclude in-progress session logs |
| `app/client/programme/session/[sessionId]/SessionLogger.tsx` | Modify | Fix float display + delta badge suppression |

---

## Task 1: Path B — fix missing `belowZone && !rirTooLow` branch

**Files:**
- Modify: `lib/training/setRecommendation.ts:132-135`
- Test: `tests/lib/training/setRecommendation.test.ts`

Current code has no branch for "client did fewer reps than rep_min BUT has RIR left". This falls through to `else` (standard path) and incorrectly suggests increasing reps at same weight. Correct behavior: maintain weight, target `planned_reps`.

- [ ] **Step 1: Write the failing test**

Add to `tests/lib/training/setRecommendation.test.ts` inside the `describe` block:

```ts
it('Path B — sous rep_min mais RIR OK → maintenir charge, viser planned_reps', () => {
  // Client fait 8 reps (sous rep_min=10) mais avec RIR 2 (pas proche de l'échec)
  // La charge est trop lourde techniquement mais pas à l'effort
  // → ne pas descendre, maintenir charge, viser la prescription
  const result = recommendNextSet({
    actual_weight_kg: 50,
    actual_reps: 8,
    rir_actual: 2,       // target_rir = 1 → rirTooLow = 2 < (1-1) = 2 < 0 → false
    goal: 'hypertrophy',
    level: 'intermediate',
    planned_reps: 10,
    set_number: 1,
    rep_min: 10,
    rep_max: 12,
    target_rir: 1,
    weight_increment_kg: 2.5,
  })
  expect(result).not.toBeNull()
  expect(result!.weight_kg).toBe(50)      // charge maintenue
  expect(result!.reps).toBe(10)           // planned_reps (pas actual_reps+1)
  expect(result!.phase).toBe('intra_session')
  expect(result!.confidence).toBe('low')
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/lib/training/setRecommendation.test.ts 2>&1 | tail -15
```

Expected: 1 test FAIL — `expect(result!.reps).toBe(10)` fails (gets 9 instead).

- [ ] **Step 3: Fix the branch in `setRecommendation.ts`**

In `lib/training/setRecommendation.ts`, replace the Path B block (lines ~117-149) with:

```ts
  const inZone = actual_reps >= effectiveRepMin && actual_reps <= effectiveRepMax
  const aboveZone = actual_reps > effectiveRepMax
  const belowZone = actual_reps < effectiveRepMin

  const rirTooLow = rir_actual < effectiveTargetRir - 1   // trop difficile
  const rirTooHigh = rir_actual > effectiveTargetRir + 2  // trop facile

  let targetWeight: number
  let targetReps: number
  let confidence: 'high' | 'low' = 'high'

  if (aboveZone) {
    // Charge trop légère → augmenter
    targetWeight = roundToIncrement(actual_weight_kg + increment, increment)
    targetReps = effectiveRepMin
  } else if (belowZone && rirTooLow) {
    // Sous le min ET proche de l'échec → descendre
    targetWeight = roundToIncrement(actual_weight_kg - increment, increment)
    targetReps = effectiveRepMin
  } else if (belowZone && !rirTooLow) {
    // Sous le min MAIS effort OK → charge trop lourde techniquement, pas à l'effort
    // Maintenir la charge, viser la prescription du coach
    targetWeight = roundToIncrement(actual_weight_kg, increment)
    targetReps = input.planned_reps > 0 ? input.planned_reps : effectiveRepMin
    confidence = 'low'
  } else if (inZone && rirTooHigh) {
    // Dans la zone mais trop facile → monter
    targetWeight = roundToIncrement(actual_weight_kg + increment, increment)
    targetReps = effectiveRepMin
  } else if (inZone && rirTooLow) {
    // Dans la zone mais proche de l'échec → maintenir
    targetWeight = roundToIncrement(actual_weight_kg, increment)
    targetReps = Math.min(actual_reps, effectiveRepMax)
  } else {
    // Cas standard — dans la zone, bon effort → +1 rep
    targetWeight = roundToIncrement(actual_weight_kg, increment)
    targetReps = Math.min(actual_reps + 1, effectiveRepMax)
    confidence = 'low'
  }
```

Note: `input.planned_reps` — add `planned_reps` to the destructured variables at the top of the function if not already there. Check line ~53 of the file; the current destructuring omits `planned_reps`. Add it:

```ts
  const {
    actual_weight_kg, actual_reps, rir_actual,
    goal,
    planned_reps,           // ← add this
    rep_min, rep_max, target_rir,
    weight_increment_kg = 2.5,
    lastWeek, prev_set_weight_kg,
  } = input
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/lib/training/setRecommendation.test.ts 2>&1 | tail -10
```

Expected: all 13 tests PASS.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep setRecommendation
```

Expected: no output (0 errors).

- [ ] **Step 6: Commit**

```bash
git add lib/training/setRecommendation.ts tests/lib/training/setRecommendation.test.ts
git commit -m "fix(training): handle belowZone+!rirTooLow branch in Path B recommendation"
```

---

## Task 2: Path A — RIR modulation (HOLD / NORMAL / BOOST)

**Files:**
- Modify: `lib/training/setRecommendation.ts:68-105`
- Test: `tests/lib/training/setRecommendation.test.ts`

Currently Path A ignores the RIR of the current set entirely. If S-1 justified overload but client is RIR 0 right now, the engine still prescribes +increment. Fix: add RIR override.

- [ ] **Step 1: Write the failing tests**

Add to `tests/lib/training/setRecommendation.test.ts`:

```ts
it('Path A — overload dû MAIS RIR actuel trop bas (HOLD) → maintenir charge S-1', () => {
  // S-1 a atteint rep_max avec bon RIR → overload normalement dû
  // MAIS client vient de faire ce set avec RIR 0 → trop difficile → veto overload
  const result = recommendNextSet({
    actual_weight_kg: 80,
    actual_reps: 10,
    rir_actual: 0,          // ≤ target_rir(2) - 2 = 0 → HOLD
    goal: 'hypertrophy',
    level: 'intermediate',
    planned_reps: 10,
    set_number: 2,
    rep_min: 8,
    rep_max: 12,
    target_rir: 2,
    weight_increment_kg: 2.5,
    lastWeek: { weight_kg: 80, reps: 12, rir_actual: 2 }, // overload normalement dû
  })
  expect(result).not.toBeNull()
  expect(result!.weight_kg).toBe(80)   // HOLD — pas d'overload
  expect(result!.phase).toBe('double_progression_overload') // phase inchangée
})

it('Path A — overload dû ET RIR actuel très haut (BOOST) → +2 incréments', () => {
  // S-1 à rep_max, RIR actuel = 5 (≥ target(2) + 3) → BOOST
  const result = recommendNextSet({
    actual_weight_kg: 80,
    actual_reps: 12,
    rir_actual: 5,           // ≥ target_rir(2) + 3 = 5 → BOOST
    goal: 'hypertrophy',
    level: 'intermediate',
    planned_reps: 10,
    set_number: 2,
    rep_min: 8,
    rep_max: 12,
    target_rir: 2,
    weight_increment_kg: 2.5,
    lastWeek: { weight_kg: 80, reps: 12, rir_actual: 2 },
  })
  expect(result).not.toBeNull()
  expect(result!.weight_kg).toBe(85)   // 80 + 2×2.5
  expect(result!.reps).toBe(8)
})

it('Path A — delta_vs_last null quand targetWeight === prev_set_weight', () => {
  // Client a déjà fait le poids cible ce session → badge "+Xkg vs S-1" trompeur → null
  const result = recommendNextSet({
    actual_weight_kg: 82.5,
    actual_reps: 10,
    rir_actual: 2,
    goal: 'hypertrophy',
    level: 'intermediate',
    planned_reps: 10,
    set_number: 3,
    rep_min: 8,
    rep_max: 12,
    target_rir: 2,
    weight_increment_kg: 2.5,
    lastWeek: { weight_kg: 80, reps: 12, rir_actual: 2 },
    prev_set_weight_kg: 82.5,  // déjà à ce niveau cette session
  })
  expect(result).not.toBeNull()
  expect(result!.weight_kg).toBe(82.5)
  expect(result!.delta_vs_last).toBeNull()  // pas de badge trompeur
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
npx vitest run tests/lib/training/setRecommendation.test.ts 2>&1 | tail -15
```

Expected: 3 new tests FAIL (HOLD gets 82.5 instead of 80, BOOST gets 82.5 instead of 85, delta test gets 2.5 instead of null).

- [ ] **Step 3: Implement RIR modulation in Path A**

In `lib/training/setRecommendation.ts`, replace the entire Path A block (after the early return guard, before the Path B comment) with:

```ts
  // ── Path A : double progression (historique S-1 disponible) ──
  if (lastWeek && lastWeek.weight_kg > 0 && lastWeek.reps > 0) {
    const lastAtOrAboveRepMax = lastWeek.reps >= effectiveRepMax
    const lastRirCompliant = lastWeek.rir_actual <= effectiveTargetRir + 1

    // RIR modulation — signal du set courant
    const rir_hold   = rir_actual <= effectiveTargetRir - 2  // trop difficile → veto overload
    const rir_boost  = rir_actual >= effectiveTargetRir + 3  // trop facile → accélérer

    // Phase overload : S-1 avait atteint rep_max avec bon effort
    if (lastAtOrAboveRepMax && lastRirCompliant) {
      let baseWeight = lastWeek.weight_kg + increment
      if (rir_hold) {
        // HOLD : client en difficulté → pas d'overload, maintenir S-1
        baseWeight = lastWeek.weight_kg
      } else if (rir_boost) {
        // BOOST : trop facile → double incrément
        baseWeight = lastWeek.weight_kg + increment * 2
      }
      let targetWeight = roundToIncrement(baseWeight, increment)
      if (prev_set_weight_kg !== undefined && prev_set_weight_kg > 0) {
        targetWeight = Math.max(targetWeight, prev_set_weight_kg)
      }
      // Delta null si client est déjà à ce niveau cette session
      const delta = roundToIncrement(targetWeight - lastWeek.weight_kg, increment)
      const delta_vs_last = (prev_set_weight_kg !== undefined && targetWeight <= prev_set_weight_kg)
        ? null
        : (delta !== 0 ? delta : null)
      return {
        weight_kg: targetWeight,
        reps: effectiveRepMin,
        confidence: 'high',
        delta_vs_last,
        phase: 'double_progression_overload',
      }
    }

    // Phase reps ↑ : garder la charge de S-1, viser +1 rep vers rep_max
    let targetWeight = roundToIncrement(lastWeek.weight_kg, increment)
    if (prev_set_weight_kg !== undefined && prev_set_weight_kg > 0) {
      targetWeight = Math.max(targetWeight, prev_set_weight_kg)
    }
    const targetReps = Math.min(lastWeek.reps + 1, effectiveRepMax)
    const delta = roundToIncrement(targetWeight - lastWeek.weight_kg, increment)
    const delta_vs_last = (prev_set_weight_kg !== undefined && targetWeight <= prev_set_weight_kg)
      ? null
      : (delta !== 0 ? delta : null)
    return {
      weight_kg: targetWeight,
      reps: targetReps,
      confidence: 'high',
      delta_vs_last,
      phase: 'double_progression_reps',
    }
  }
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run tests/lib/training/setRecommendation.test.ts 2>&1 | tail -10
```

Expected: all 16 tests PASS.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep setRecommendation
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add lib/training/setRecommendation.ts tests/lib/training/setRecommendation.test.ts
git commit -m "feat(training): Path A RIR modulation — HOLD/BOOST + fix delta_vs_last when already at target weight"
```

---

## Task 3: Fix `lastPerformance` fetch — exclude in-progress sessions

**Files:**
- Modify: `app/client/programme/session/[sessionId]/page.tsx:113-139`

The fetch grabs the 200 most recent `client_set_logs` without filtering out in-progress (not yet completed) session logs. If a client starts a second session today with the same exercises, they see their own current-session data as "last week". Fix: only pull sets from **fully completed** sessions (`completed_at IS NOT NULL`).

- [ ] **Step 1: Read the current fetch block**

Open `app/client/programme/session/[sessionId]/page.tsx` and locate lines ~110-140. The query currently reads:

```ts
const { data: lastLogs } = await service
  .from('client_set_logs')
  .select('exercise_name, set_number, actual_weight_kg, actual_reps, rir_actual, side, completed, client_session_logs!inner(client_id)')
  .eq('completed', true)
  .eq('client_session_logs.client_id', client.id)
  .in('exercise_name', exerciseNames)
  .order('created_at', { ascending: false })
  .limit(200)
```

- [ ] **Step 2: Add the completed_at filter**

Replace the query with:

```ts
const { data: lastLogs } = await service
  .from('client_set_logs')
  .select('exercise_name, set_number, actual_weight_kg, actual_reps, rir_actual, side, completed, client_session_logs!inner(client_id, completed_at)')
  .eq('completed', true)
  .eq('client_session_logs.client_id', client.id)
  .not('client_session_logs.completed_at', 'is', null)  // only fully completed sessions
  .in('exercise_name', exerciseNames)
  .order('created_at', { ascending: false })
  .limit(200)
```

The key change: add `completed_at` to the `select` of the joined table, then filter `.not('client_session_logs.completed_at', 'is', null)`. This excludes any draft/in-progress session log whose `completed_at` is still NULL.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "session/\[sessionId\]/page"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add "app/client/programme/session/[sessionId]/page.tsx"
git commit -m "fix(session): exclude in-progress session logs from lastPerformance fetch"
```

---

## Task 4: Fix float display + `formatWeight` helper

**Files:**
- Modify: `app/client/programme/session/[sessionId]/SessionLogger.tsx`

Two display bugs:
1. `String(rec.weight_kg)` can produce `"47."` or `"48,"` depending on locale/float precision.
2. The `DeltaBadge` receives `delta_vs_last` which is already fixed in Task 2 — no UI change needed here. This task is purely the float formatter.

- [ ] **Step 1: Add `formatWeight` helper**

In `SessionLogger.tsx`, find the block of pure helper functions (around line 131 where `formatTime` is defined). Add immediately after `formatTime`:

```ts
function formatWeight(kg: number): string {
  // Locale-independent: always uses '.' as decimal, strips trailing zeros/dot
  // 47.50 → "47.5" | 47.00 → "47" | 47.5 → "47.5"
  return parseFloat(kg.toFixed(2)).toString()
}
```

- [ ] **Step 2: Apply formatter in `triggerRecommendation`**

In `triggerRecommendation` (around line 327), find the `setSets` call that injects the recommendation:

```ts
    setSets(prev => prev.map(s => {
      if (s.exercise_id === exercise_id && s.set_number === nextSet.set_number && s.side === side) {
        return { ...s, actual_weight_kg: String(rec.weight_kg), actual_reps: String(rec.reps) }
      }
      return s
    }))
```

Replace `String(rec.weight_kg)` with `formatWeight(rec.weight_kg)`:

```ts
    setSets(prev => prev.map(s => {
      if (s.exercise_id === exercise_id && s.set_number === nextSet.set_number && s.side === side) {
        return { ...s, actual_weight_kg: formatWeight(rec.weight_kg), actual_reps: String(rec.reps) }
      }
      return s
    }))
```

- [ ] **Step 3: Find and fix the superset equivalent**

Search for any other place in `SessionLogger.tsx` where `String(rec.weight_kg)` is used (the superset rendering block around line 1230+). Apply the same replacement:

```bash
grep -n "String(rec.weight_kg)" app/client/programme/session/\[sessionId\]/SessionLogger.tsx
```

Replace every occurrence with `formatWeight(rec.weight_kg)`.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep SessionLogger
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add "app/client/programme/session/[sessionId]/SessionLogger.tsx"
git commit -m "fix(session): formatWeight helper — strip trailing dot/zeros from recommendation display"
```

---

## Task 5: Update CHANGELOG + project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Update CHANGELOG**

Add to the top of `CHANGELOG.md` under today's date `## 2026-05-17`:

```
FIX: setRecommendation — belowZone+!rirTooLow branch now maintains weight, targets planned_reps
FIX: setRecommendation — Path A HOLD/BOOST RIR modulation on current set
FIX: setRecommendation — delta_vs_last null when targetWeight already reached this session
FIX: session/page.tsx — lastPerformance fetch excludes in-progress session logs
FIX: SessionLogger — formatWeight strips trailing dot/zeros from recommendation inputs
```

- [ ] **Step 2: Update project-state**

In `.claude/rules/project-state.md`, add a new entry under "Dernières Avancées" (top):

```markdown
### SessionLogger — Set Recommendation Engine v2 (COMPLET — 2026-05-17)

- ✅ Path B : branche `belowZone && !rirTooLow` ajoutée — maintien charge, vise `planned_reps`
- ✅ Path A : modulation RIR sur set courant — HOLD (rir ≤ target-2) veto overload, BOOST (rir ≥ target+3) double incrément
- ✅ Path A : `delta_vs_last` → null quand `targetWeight <= prev_set_weight_kg` (badge trompeur supprimé)
- ✅ Fetch historique : filtre `completed_at IS NOT NULL` — exclut les sessions en cours
- ✅ Display : `formatWeight()` — `47.50` → `"47.5"`, `47.00` → `"47"`, locale-independent
- Tests : 16 tests Vitest, tous PASS
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG + project-state for set recommendation engine v2"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|-----------------|------|
| Bug 1 — fetch excludes current session | Task 3 |
| Bug 2 — Path A ignores current RIR | Task 2 |
| Bug 3 — belowZone && !rirTooLow unhandled | Task 1 |
| Bug 4 — trailing `.`/`,` display | Task 4 |
| Bug 5 — delta badge trompeur | Task 2 (engine) + fixed in Task 4 (already null from engine) |
| HOLD condition `rir ≤ target-2` | Task 2 |
| BOOST condition `rir ≥ target+3` | Task 2 |
| `formatWeight` locale-independent | Task 4 |
| 15+ tests | Tasks 1+2 add 4 tests → 16 total |
| Invariants: weight ≥ increment | Already in existing code, preserved |
| Invariants: confidence high only Path A | Preserved in all branches |
| CHANGELOG + project-state | Task 5 |

**No placeholders found.** All steps have concrete code.

**Type consistency:** `SetRecommendationInput`, `SetRecommendation`, `roundToIncrement`, `formatWeight` — consistent across all tasks. `planned_reps` destructured in Task 1 before use in `belowZone && !rirTooLow` branch.

**Edge case check:** `planned_reps = 0` → fallback to `effectiveRepMin` in the new branch (guarded by `input.planned_reps > 0 ? ... : effectiveRepMin`). ✓
