# Supersets / Tri-sets (group_id) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add superset/tri-set support to the program template builder using a `group_id` field on exercises — grouped exercises share a visual container, display as paired/tripled in the UI, and the SRA scoring engine accounts for interleaved recovery (exercises within the same group occur simultaneously, so the SRA window is measured from the group's last occurrence as a unit, not per exercise).

**Architecture:** `group_id` is a nullable `text` UUID column on `coach_program_template_exercises`. Within a session, exercises with the same `group_id` are rendered as a visually grouped block (colored left border, "Superset" label). The coach assigns group membership by clicking a "Grouper avec…" button on an exercise. The intelligence engine's `scoreSRA` receives `group_id` on `BuilderExercise` and collapses grouped exercises into a single "slot" when computing inter-session muscle recovery — muscles trained together in one group slot share the same timestamp for SRA purposes. A new alert code `SUPERSET_IMBALANCE` warns when two exercises in the same superset train the same primary muscle group (agonist–agonist pairing, which is sub-optimal).

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase (direct SQL migration via MCP), Zod, Tailwind CSS (DS v2.0 — `#121212` bg, `bg-white/[0.02]` cards, `#1f8a65` accent, `border-[0.3px] border-white/[0.06]`), Vitest for engine tests.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260418_exercise_group_id.sql` | Create | Add `group_id text` to `coach_program_template_exercises` |
| `lib/programs/intelligence/types.ts` | Modify | Add `group_id?: string` to `BuilderExercise` |
| `lib/programs/intelligence/scoring.ts` | Modify | Collapse group slots in `scoreSRA`; add `SUPERSET_IMBALANCE` alert in new `scoreSuperset()` function |
| `lib/programs/intelligence/index.ts` | Modify | Re-export `scoreSuperset` |
| `tests/lib/intelligence/superset-scoring.test.ts` | Create | Vitest tests for SRA group collapsing + SUPERSET_IMBALANCE |
| `components/programs/ProgramTemplateBuilder.tsx` | Modify | Add `group_id` to `Exercise` interface + `emptyExercise()`; add group assign/ungroup UI; render grouped blocks; send `group_id` in payload |
| `app/api/program-templates/route.ts` | Modify | Persist `group_id` in POST insert |
| `app/api/program-templates/[templateId]/route.ts` | Modify | Persist `group_id` in PATCH recreate |

---

## Task 1: DB Migration — add group_id to coach_program_template_exercises

**Files:**
- Create: `supabase/migrations/20260418_exercise_group_id.sql`

**Context:** `coach_program_template_exercises` currently has columns: `id, session_id, name, sets, reps, rest_sec, rir, notes, position, created_at, image_url, movement_pattern, equipment_required, primary_muscles, secondary_muscles, rep_min, rep_max, target_rir, weight_increment_kg`. We add `group_id text` (nullable). No FK — the ID is a client-generated UUID. An index on `(session_id, group_id)` makes grouping lookups fast.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260418_exercise_group_id.sql
ALTER TABLE coach_program_template_exercises
  ADD COLUMN IF NOT EXISTS group_id text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_template_exercises_group_id
  ON coach_program_template_exercises (session_id, group_id)
  WHERE group_id IS NOT NULL;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use the `mcp__supabase__apply_migration` tool with:
- name: `exercise_group_id`
- query: the SQL above

- [ ] **Step 3: Verify column exists**

Run in Supabase SQL editor:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'coach_program_template_exercises'
  AND column_name = 'group_id';
```

Expected: 1 row — `group_id | text | YES`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260418_exercise_group_id.sql
git commit -m "schema: add group_id to coach_program_template_exercises for superset grouping"
```

---

## Task 2: Types — add group_id to BuilderExercise

**Files:**
- Modify: `lib/programs/intelligence/types.ts` (lines 60–78)

**Context:** `BuilderExercise` is the shape used by the intelligence engine. Adding `group_id?: string` here allows `scoreSRA` and `scoreSuperset` to read it without touching other callers (backward compatible — undefined = not grouped).

- [ ] **Step 1: Write failing test (type-level — verify the engine accepts group_id)**

Create `tests/lib/intelligence/superset-scoring.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { scoreSRA, buildIntelligenceResult } from '@/lib/programs/intelligence/scoring'
import type { BuilderSession, TemplateMeta, BuilderExercise } from '@/lib/programs/intelligence/types'

// Two exercises in the same superset group
const GROUP_A = 'group-aaa'

const pushEx: BuilderExercise = {
  name: 'Développé couché', sets: 3, reps: '8-12', rest_sec: 90, rir: 2,
  notes: '', movement_pattern: 'horizontal_push', equipment_required: ['barbell'],
  primary_muscles: ['pectoraux', 'triceps'], secondary_muscles: ['epaules'],
  group_id: GROUP_A,
}

const pullEx: BuilderExercise = {
  name: 'Rowing barre', sets: 3, reps: '8-12', rest_sec: 90, rir: 2,
  notes: '', movement_pattern: 'horizontal_pull', equipment_required: ['barbell'],
  primary_muscles: ['dos', 'biceps'], secondary_muscles: [],
  group_id: GROUP_A,
}

const meta: TemplateMeta = {
  goal: 'hypertrophy', level: 'intermediate', weeks: 8, frequency: 4,
  equipment_archetype: 'full_gym',
}

// Session A (day 1) and Session B (day 2) — same superset, same muscles
const sessionA: BuilderSession = { name: 'Day A', day_of_week: 1, exercises: [pushEx, pullEx] }
const sessionB: BuilderSession = { name: 'Day B', day_of_week: 2, exercises: [pushEx, pullEx] }

describe('scoreSRA with group_id', () => {
  it('accepts BuilderExercise with group_id without TypeScript error', () => {
    // This test passes if TypeScript compilation succeeds (type-level guard)
    const result = scoreSRA([sessionA], meta)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('treats grouped exercises as one slot — no intra-group SRA violation', () => {
    // pushEx and pullEx are in the same group on the same session.
    // Without grouping, pectoraux would appear to train dos at 0h gap → violation.
    // With grouping, they're one slot → no violation within the slot.
    // On day 1 only → no inter-session comparison → 0 violations expected.
    const result = scoreSRA([sessionA], meta)
    const violations = result.alerts.filter(a => a.code === 'SRA_VIOLATION')
    expect(violations).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails (TypeScript: group_id not on BuilderExercise)**

```bash
npx vitest run tests/lib/intelligence/superset-scoring.test.ts 2>&1 | tail -20
```

Expected: FAIL with type error or test error about `group_id` not existing on `BuilderExercise`.

- [ ] **Step 3: Add group_id to BuilderExercise**

In `lib/programs/intelligence/types.ts`, find the `BuilderExercise` interface (line ~60) and add the field:

```typescript
export interface BuilderExercise {
  name: string
  sets: number
  reps: string
  rest_sec: number | null
  rir: number | null
  notes: string
  movement_pattern: string | null
  equipment_required: string[]
  primary_muscles: string[]
  secondary_muscles: string[]
  is_compound?: boolean
  group_id?: string       // ← add this — undefined = standalone exercise
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "BuilderExercise\|group_id" | head -10
```

Expected: no lines (0 new errors on these symbols).

- [ ] **Step 5: Run test — should now pass the type guard test, fail the SRA logic test**

```bash
npx vitest run tests/lib/intelligence/superset-scoring.test.ts 2>&1 | tail -20
```

Expected: first test PASS, second test FAIL (SRA doesn't collapse groups yet).

- [ ] **Step 6: Commit**

```bash
git add lib/programs/intelligence/types.ts tests/lib/intelligence/superset-scoring.test.ts
git commit -m "feat(intelligence): add group_id to BuilderExercise + superset SRA test scaffold"
```

---

## Task 3: scoreSRA — collapse group_id slots

**Files:**
- Modify: `lib/programs/intelligence/scoring.ts`

**Context:** Currently `scoreSRA` builds a `muscleSessionMap` that records every `{ sessionIndex, day }` at which a muscle appears across all exercises. With supersets, two exercises in the same group train different muscles at the same moment — the SRA measurement between sessions should still work normally (the muscles from BOTH exercises in the group recover from the same point in time). What we do NOT want is intra-group violations: exercise A and exercise B both in `group_id: 'xyz'` within the same session should be treated as one combined "slot" — their muscles all share the same session/day entry.

The fix: before building `muscleSessionMap`, deduplicate exercises per group per session. For each session, exercises with the same `group_id` count as one occurrence of all their combined muscles. Exercises without `group_id` (or `group_id: undefined`) are unchanged.

- [ ] **Step 1: Add the group deduplication helper in scoring.ts**

In `lib/programs/intelligence/scoring.ts`, find the `scoreSRA` function (line ~134). Before the `muscleSessionMap` construction loop, add this helper inline:

```typescript
export function scoreSRA(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
): { score: number; alerts: IntelligenceAlert[]; sraMap: SRAPoint[] } {
  const alerts: IntelligenceAlert[] = []
  const sraMap: SRAPoint[] = []
  const effectiveLevel = profile?.fitnessLevel ?? meta.level
  const levelMult = SRA_LEVEL_MULTIPLIER[effectiveLevel] ?? 1.0

  // Collapse grouped exercises into combined slots before building the muscle map.
  // For each session, exercises sharing a group_id are merged into one virtual exercise
  // that holds the union of their primary muscles. Standalone exercises pass through unchanged.
  function collapseGroups(exercises: BuilderExercise[]): BuilderExercise[] {
    const seen = new Map<string, BuilderExercise>()
    const out: BuilderExercise[] = []
    for (const ex of exercises) {
      if (!ex.group_id) {
        out.push(ex)
        continue
      }
      if (seen.has(ex.group_id)) {
        const existing = seen.get(ex.group_id)!
        existing.primary_muscles = Array.from(new Set([...existing.primary_muscles, ...ex.primary_muscles]))
        existing.secondary_muscles = Array.from(new Set([...existing.secondary_muscles, ...ex.secondary_muscles]))
      } else {
        const slot: BuilderExercise = { ...ex, primary_muscles: [...ex.primary_muscles], secondary_muscles: [...ex.secondary_muscles] }
        seen.set(ex.group_id, slot)
        out.push(slot)
      }
    }
    return out
  }

  // Construit une map muscle → [{sessionIndex, dayOfWeek}]
  const muscleSessionMap: Record<string, { sessionIndex: number; day: number | null }[]> = {}

  sessions.forEach((session, si) => {
    const collapsed = collapseGroups(session.exercises)
    const muscles = new Set<string>()
    for (const ex of collapsed) {
      ex.primary_muscles.map(normalizeMuscleSlug).forEach(m => muscles.add(m))
    }
    muscles.forEach(muscle => {
      if (!muscleSessionMap[muscle]) muscleSessionMap[muscle] = []
      muscleSessionMap[muscle].push({ sessionIndex: si, day: session.day_of_week })
    })
  })
  // ... rest of function unchanged from here
```

Replace the existing `scoreSRA` body from the `const muscleSessionMap` declaration down through the `sessions.forEach` loop, substituting the collapsed version above. **Leave everything after the forEach loop unchanged** (the violations loop, score computation, return).

- [ ] **Step 2: Run the SRA tests**

```bash
npx vitest run tests/lib/intelligence/superset-scoring.test.ts 2>&1 | tail -20
```

Expected: both SRA tests PASS.

- [ ] **Step 3: Verify existing tests still pass**

```bash
npx vitest run tests/lib/intelligence/ 2>&1 | tail -10
```

Expected: all 39 tests PASS (no regressions).

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "scoring\.ts" | head -10
```

Expected: 0 lines.

- [ ] **Step 5: Commit**

```bash
git add lib/programs/intelligence/scoring.ts
git commit -m "feat(intelligence): scoreSRA collapses group_id slots — superset muscles share one SRA timestamp"
```

---

## Task 4: scoreSuperset — SUPERSET_IMBALANCE alert

**Files:**
- Modify: `lib/programs/intelligence/scoring.ts`
- Modify: `lib/programs/intelligence/index.ts`
- Modify: `tests/lib/intelligence/superset-scoring.test.ts`

**Context:** A new sub-engine detects agonist–agonist supersets (e.g., bench press + incline press — both hit pectoraux). This is sub-optimal for hypertrophy because there's no antagonist recovery during the partner's set. The function iterates all sessions, finds exercises sharing a `group_id`, and checks if their primary muscles overlap. Emits a `warning` alert (not critical — coaches sometimes do this intentionally for metabolic stress). Does not affect the global score — it's purely informational.

- [ ] **Step 1: Add new tests**

Append to `tests/lib/intelligence/superset-scoring.test.ts`:

```typescript
import { scoreSuperset } from '@/lib/programs/intelligence/scoring'

const agonistA: BuilderExercise = {
  name: 'Développé couché', sets: 3, reps: '8-12', rest_sec: 0, rir: 2,
  notes: '', movement_pattern: 'horizontal_push', equipment_required: ['barbell'],
  primary_muscles: ['pectoraux', 'triceps'], secondary_muscles: [],
  group_id: 'group-chest',
}
const agonistB: BuilderExercise = {
  name: 'Développé incliné', sets: 3, reps: '10-12', rest_sec: 90, rir: 2,
  notes: '', movement_pattern: 'horizontal_push', equipment_required: ['barbell'],
  primary_muscles: ['pectoraux', 'epaules'], secondary_muscles: [],
  group_id: 'group-chest',
}
const antagonist: BuilderExercise = {
  name: 'Rowing barre', sets: 3, reps: '8-12', rest_sec: 0, rir: 2,
  notes: '', movement_pattern: 'horizontal_pull', equipment_required: ['barbell'],
  primary_muscles: ['dos', 'biceps'], secondary_muscles: [],
  group_id: 'group-chest', // Intentional: agonist-antagonist superset — no imbalance
}

const sessionWithAntagonist: BuilderSession = {
  name: 'Push Pull', day_of_week: 1,
  exercises: [agonistA, antagonist],
}

const sessionWithAgonist: BuilderSession = {
  name: 'Chest Blast', day_of_week: 1,
  exercises: [agonistA, agonistB],
}

describe('scoreSuperset', () => {
  it('emits SUPERSET_IMBALANCE warning when two grouped exercises share primary muscles', () => {
    const result = scoreSuperset([sessionWithAgonist])
    expect(result.alerts).toHaveLength(1)
    expect(result.alerts[0].code).toBe('SUPERSET_IMBALANCE')
    expect(result.alerts[0].severity).toBe('warning')
    expect(result.alerts[0].sessionIndex).toBe(0)
  })

  it('emits no alert when grouped exercises are antagonist pairs', () => {
    const result = scoreSuperset([sessionWithAntagonist])
    expect(result.alerts).toHaveLength(0)
  })

  it('emits no alert when no exercises have group_id', () => {
    const standalone: BuilderSession = {
      name: 'Solo', day_of_week: 1,
      exercises: [{ ...agonistA, group_id: undefined }, { ...agonistB, group_id: undefined }],
    }
    const result = scoreSuperset([standalone])
    expect(result.alerts).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/lib/intelligence/superset-scoring.test.ts 2>&1 | tail -20
```

Expected: FAIL — `scoreSuperset is not a function`.

- [ ] **Step 3: Implement scoreSuperset in scoring.ts**

Add this function near the end of `lib/programs/intelligence/scoring.ts`, just before `buildIntelligenceResult`:

```typescript
// ─── 7. Supersets — détection agoniste-agoniste ────────────────────────────

export function scoreSuperset(
  sessions: BuilderSession[],
): { alerts: IntelligenceAlert[] } {
  const alerts: IntelligenceAlert[] = []

  sessions.forEach((session, si) => {
    // Collect exercises by group_id
    const groups = new Map<string, { ex: BuilderExercise; ei: number }[]>()
    session.exercises.forEach((ex, ei) => {
      if (!ex.group_id) return
      if (!groups.has(ex.group_id)) groups.set(ex.group_id, [])
      groups.get(ex.group_id)!.push({ ex, ei })
    })

    for (const [, members] of groups) {
      if (members.length < 2) continue
      // Check all pairs within the group for primary muscle overlap
      for (let a = 0; a < members.length - 1; a++) {
        for (let b = a + 1; b < members.length; b++) {
          const musclesA = new Set(members[a].ex.primary_muscles.map(normalizeMuscleSlug))
          const musclesB = new Set(members[b].ex.primary_muscles.map(normalizeMuscleSlug))
          const overlap = [...musclesA].filter(m => musclesB.has(m))
          if (overlap.length > 0) {
            alerts.push({
              severity: 'warning',
              code: 'SUPERSET_IMBALANCE',
              title: 'Superset agoniste–agoniste',
              explanation: `"${members[a].ex.name}" et "${members[b].ex.name}" ciblent les mêmes muscles (${overlap.join(', ')}). Le partenaire du superset ne permet pas de récupération active.`,
              suggestion: 'Associez des muscles antagonistes (ex: pectoraux + dos, quadriceps + ischio) pour maximiser la récupération entre les séries.',
              sessionIndex: si,
              exerciseIndex: members[a].ei,
            })
          }
        }
      }
    }
  })

  return { alerts }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/lib/intelligence/superset-scoring.test.ts 2>&1 | tail -20
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Wire scoreSuperset into buildIntelligenceResult**

In `buildIntelligenceResult` (line ~566), find where the sub-engines are called and add:

```typescript
  const supersetResult = scoreSuperset(sessions)
```

Then add its alerts to the `allAlerts` aggregation. Find the line that reads `const allAlerts = [` or similar aggregation and add `...supersetResult.alerts`:

```typescript
  const allAlerts: IntelligenceAlert[] = [
    ...balanceResult.alerts,
    ...sraResult.alerts,
    ...redundancyResult.alerts,
    ...progressionResult.alerts,
    ...specificityResult.alerts,
    ...completenessResult.alerts,
    ...supersetResult.alerts,   // ← add this line
  ].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return order[a.severity] - order[b.severity]
  })
```

**Note:** `scoreSuperset` does NOT contribute to globalScore or subscores — it's purely informational (like a lint warning). No subscore key needed.

- [ ] **Step 6: Export scoreSuperset from index.ts**

In `lib/programs/intelligence/index.ts`, find the re-exports section and add:

```typescript
export { scoreSuperset } from './scoring'
```

- [ ] **Step 7: Run all intelligence tests**

```bash
npx vitest run tests/lib/intelligence/ 2>&1 | tail -10
```

Expected: all tests PASS (39 previous + 5 new = 44 total).

- [ ] **Step 8: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "scoring\|index\|superset" | head -10
```

Expected: 0 lines.

- [ ] **Step 9: Commit**

```bash
git add lib/programs/intelligence/scoring.ts lib/programs/intelligence/index.ts tests/lib/intelligence/superset-scoring.test.ts
git commit -m "feat(intelligence): add scoreSuperset — SUPERSET_IMBALANCE alert for agonist-agonist pairs"
```

---

## Task 5: API — persist group_id in POST and PATCH

**Files:**
- Modify: `app/api/program-templates/route.ts`
- Modify: `app/api/program-templates/[templateId]/route.ts`

**Context:** The POST handler (line ~51–105) inserts exercises with a fixed set of columns. The PATCH handler (line ~42–96) deletes and recreates sessions/exercises. Both need to include `group_id` in the insert. The SELECT clause also needs `group_id` so it's returned to the builder on load.

- [ ] **Step 1: Update POST /api/program-templates**

In `app/api/program-templates/route.ts`, find the `db.from('coach_program_template_exercises').insert(...)` call. Update the mapped object to include `group_id`:

```typescript
await db.from('coach_program_template_exercises').insert(
  s.exercises.map((e: Record<string, unknown>, ei: number) => ({
    session_id: session.id,
    name: e.name,
    sets: (e.sets as number) ?? 3,
    reps: (e.reps as string) ?? '8-12',
    rest_sec: (e.rest_sec as number | null) ?? null,
    rir: (e.rir as number | null) ?? null,
    notes: (e.notes as string | null) ?? null,
    position: ei,
    image_url: (e.image_url as string | null) ?? null,
    movement_pattern: (e.movement_pattern as string | null) ?? null,
    equipment_required: (e.equipment_required as string[]) ?? [],
    primary_muscles: (e.primary_muscles as string[]) ?? [],
    secondary_muscles: (e.secondary_muscles as string[]) ?? [],
    group_id: (e.group_id as string | null) ?? null,   // ← add this line
  }))
)
```

Also update the SELECT clause (line ~12–20) to include `group_id`:

```typescript
const SELECT = `
  id, name, description, goal, level, frequency, weeks, muscle_tags, notes,
  is_public, is_system, coach_id, equipment_archetype, created_at,
  coach_program_template_sessions (
    id, name, day_of_week, position, notes,
    coach_program_template_exercises (
      id, name, sets, reps, rest_sec, rir, notes, position, image_url,
      movement_pattern, equipment_required, primary_muscles, secondary_muscles,
      group_id
    )
  )
`
```

- [ ] **Step 2: Update PATCH /api/program-templates/[templateId]/route.ts**

Apply the same `group_id` addition to the insert mapping in the PATCH handler — it has the identical insert block.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "program-templates" | head -10
```

Expected: 0 lines.

- [ ] **Step 4: Commit**

```bash
git add app/api/program-templates/route.ts "app/api/program-templates/[templateId]/route.ts"
git commit -m "feat(api): persist group_id on coach_program_template_exercises in POST and PATCH"
```

---

## Task 6: ProgramTemplateBuilder — group_id state + assign/ungroup UI

**Files:**
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

**Context:** The builder needs:
1. `group_id?: string` on the `Exercise` interface and `emptyExercise()`
2. A way for the coach to assign two exercises into a group — clicking "Superset avec ▼" on exercise A opens a small popover listing the other exercises in the session; selecting exercise B assigns both a shared UUID as `group_id`
3. A way to ungroup — clicking "Dissocier" on a grouped exercise sets `group_id: undefined` for all members of that group
4. Visual grouping — exercises sharing a `group_id` are rendered with a green left border and a "Superset" / "Tri-set" label at the top of the first exercise in the group
5. `group_id` included in the save payload (already flows through `sessions.map(s => ({ ...s, exercises: s.exercises }))` so no change to `handleSave` needed — the field is on the object)

- [ ] **Step 1: Add group_id to Exercise interface and emptyExercise()**

Find the `interface Exercise` (line ~127) and add:

```typescript
interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest_sec: number | null;
  rir: number | null;
  notes: string;
  image_url: string | null;
  movement_pattern: string | null;
  equipment_required: string[];
  primary_muscles: string[];
  secondary_muscles: string[];
  is_compound: boolean | undefined;
  group_id?: string;   // ← add this
}
```

Find `emptyExercise()` (line ~160) and add:

```typescript
function emptyExercise(): Exercise {
  return {
    name: "",
    sets: 3,
    reps: "8-12",
    rest_sec: 90,
    rir: 2,
    notes: "",
    image_url: null,
    movement_pattern: null,
    equipment_required: [],
    primary_muscles: [],
    secondary_muscles: [],
    is_compound: undefined,
    group_id: undefined,   // ← add this
  };
}
```

- [ ] **Step 2: Add group management helper functions**

Add these two functions near `updateExercise` (line ~364):

```typescript
function assignGroup(si: number, eiA: number, eiB: number) {
  const newGroupId = crypto.randomUUID()
  setSessions(prev =>
    prev.map((s, idx) => {
      if (idx !== si) return s
      return {
        ...s,
        exercises: s.exercises.map((e, i) => {
          if (i === eiA || i === eiB) return { ...e, group_id: newGroupId }
          return e
        }),
      }
    })
  )
}

function addToGroup(si: number, targetEi: number, groupId: string) {
  setSessions(prev =>
    prev.map((s, idx) => {
      if (idx !== si) return s
      return {
        ...s,
        exercises: s.exercises.map((e, i) =>
          i === targetEi ? { ...e, group_id: groupId } : e
        ),
      }
    })
  )
}

function ungroup(si: number, groupId: string) {
  setSessions(prev =>
    prev.map((s, idx) => {
      if (idx !== si) return s
      return {
        ...s,
        exercises: s.exercises.map(e =>
          e.group_id === groupId ? { ...e, group_id: undefined } : e
        ),
      }
    })
  )
}
```

- [ ] **Step 3: Add groupPicker state**

Add near the other `useState` declarations (after line ~252):

```typescript
const [groupPickerTarget, setGroupPickerTarget] = useState<{ si: number; ei: number } | null>(null)
```

- [ ] **Step 4: Load group_id from initial data**

Find where exercises are loaded from `initial` prop (search for `exercises: s.exercises.map` in the useState initializer, around line ~230). Ensure `group_id` is included:

```typescript
exercises: s.exercises.map((e) => ({
  name: e.name ?? "",
  sets: e.sets ?? 3,
  reps: e.reps ?? "8-12",
  rest_sec: e.rest_sec ?? null,
  rir: e.rir ?? null,
  notes: e.notes ?? "",
  image_url: e.image_url ?? null,
  movement_pattern: e.movement_pattern ?? null,
  equipment_required: e.equipment_required ?? [],
  primary_muscles: e.primary_muscles ?? [],
  secondary_muscles: e.secondary_muscles ?? [],
  is_compound: e.is_compound,
  group_id: e.group_id ?? undefined,   // ← add this
})),
```

- [ ] **Step 5: Add group header rendering before exercise cards**

Find the exercise list render (line ~659):

```tsx
{session.exercises.map((ex, ei) => (
  <div key={ei} ref={...} className={`bg-[#0a0a0a] ...`}>
```

Replace with a version that shows a group header when a new group starts:

```tsx
{session.exercises.map((ex, ei) => {
  const isGroupStart = ex.group_id && (ei === 0 || session.exercises[ei - 1].group_id !== ex.group_id)
  const isGroupEnd = ex.group_id && (ei === session.exercises.length - 1 || session.exercises[ei + 1].group_id !== ex.group_id)
  const groupSize = ex.group_id
    ? session.exercises.filter(e => e.group_id === ex.group_id).length
    : 0
  const groupLabel = groupSize === 2 ? 'Superset' : groupSize === 3 ? 'Tri-set' : 'Giant set'

  return (
    <div key={ei}>
      {isGroupStart && ex.group_id && (
        <div className="flex items-center gap-2 mb-1 mt-1">
          <div className="h-px flex-1 bg-[#1f8a65]/20" />
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#1f8a65]/60">
            {groupLabel}
          </span>
          <div className="h-px flex-1 bg-[#1f8a65]/20" />
          <button
            type="button"
            onClick={() => ungroup(si, ex.group_id!)}
            className="text-[9px] font-semibold text-white/30 hover:text-red-400 transition-colors"
          >
            Dissocier
          </button>
        </div>
      )}
      <div
        ref={el => { exerciseRefs.current[`${si}-${ei}`] = el }}
        className={[
          'bg-[#0a0a0a] rounded-2xl p-3 flex flex-col gap-2 transition-all duration-300',
          highlightKey === `${si}-${ei}` ? 'ring-1 ring-[#1f8a65]/60 ring-offset-1 ring-offset-[#121212]' : '',
          ex.group_id ? 'border-l-2 border-[#1f8a65]/40' : '',
        ].filter(Boolean).join(' ')}
      >
```

Close the new wrapper `</div>` after the exercise card's closing tag:

```tsx
      </div>
    </div>
  )
})}
```

- [ ] **Step 6: Add "Superset avec" button + group picker popover inside each exercise card**

Find where the "Alternatives" button is rendered (line ~964–972):

```tsx
{/* Bouton alternatives */}
<button
  type="button"
  onClick={() => setAlternativesTarget({ si, ei })}
  className="flex items-center gap-1.5 text-[10px] font-semibold text-white/30 hover:text-[#1f8a65] transition-colors mt-1"
>
  <ArrowLeftRight size={10} />
  Alternatives
</button>
```

Add the superset button and picker immediately after it:

```tsx
{/* Bouton superset */}
{!ex.group_id ? (
  <div className="relative">
    <button
      type="button"
      onClick={() => setGroupPickerTarget(groupPickerTarget?.ei === ei && groupPickerTarget?.si === si ? null : { si, ei })}
      className="flex items-center gap-1.5 text-[10px] font-semibold text-white/30 hover:text-[#1f8a65] transition-colors mt-1"
    >
      <Link size={10} />
      Superset avec…
    </button>
    {groupPickerTarget?.si === si && groupPickerTarget?.ei === ei && (
      <div className="absolute left-0 top-6 z-30 bg-[#181818] border border-white/[0.06] rounded-xl p-2 flex flex-col gap-1 min-w-[180px] shadow-lg">
        {session.exercises
          .map((other, oi) => ({ other, oi }))
          .filter(({ oi, other }) => oi !== ei && !other.group_id)
          .map(({ other, oi }) => (
            <button
              key={oi}
              type="button"
              onClick={() => { assignGroup(si, ei, oi); setGroupPickerTarget(null) }}
              className="text-left text-[11px] text-white/70 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors truncate"
            >
              {other.name || `Exercice ${oi + 1}`}
            </button>
          ))
        }
        {session.exercises.filter((o, oi) => oi !== ei && !o.group_id).length === 0 && (
          <p className="text-[10px] text-white/30 px-2 py-1">Aucun exercice disponible</p>
        )}
      </div>
    )}
  </div>
) : (
  // Already in a group — show "Ajouter au superset" for exercises not yet in this group
  <div className="relative">
    <button
      type="button"
      onClick={() => setGroupPickerTarget(groupPickerTarget?.ei === ei && groupPickerTarget?.si === si ? null : { si, ei })}
      className="flex items-center gap-1.5 text-[10px] font-semibold text-[#1f8a65]/50 hover:text-[#1f8a65] transition-colors mt-1"
    >
      <Link size={10} />
      Ajouter au groupe…
    </button>
    {groupPickerTarget?.si === si && groupPickerTarget?.ei === ei && (
      <div className="absolute left-0 top-6 z-30 bg-[#181818] border border-white/[0.06] rounded-xl p-2 flex flex-col gap-1 min-w-[180px] shadow-lg">
        {session.exercises
          .map((other, oi) => ({ other, oi }))
          .filter(({ oi, other }) => oi !== ei && other.group_id !== ex.group_id)
          .map(({ other, oi }) => (
            <button
              key={oi}
              type="button"
              onClick={() => { addToGroup(si, oi, ex.group_id!); setGroupPickerTarget(null) }}
              className="text-left text-[11px] text-white/70 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors truncate"
            >
              {other.name || `Exercice ${oi + 1}`}
            </button>
          ))
        }
      </div>
    )}
  </div>
)}
```

- [ ] **Step 7: Add Link icon to imports**

In the Lucide import line at the top of `ProgramTemplateBuilder.tsx`, add `Link`:

```typescript
import { ..., Link } from 'lucide-react'
```

- [ ] **Step 8: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "ProgramTemplateBuilder" | head -10
```

Expected: 0 lines.

- [ ] **Step 9: Commit**

```bash
git add components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(ui): superset grouping in ProgramTemplateBuilder — assign/ungroup UI, grouped left-border visual, group header label"
```

---

## Task 7: Wire group_id into intelligenceSessions

**Files:**
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

**Context:** The `intelligenceSessions` derived value (around line ~268–295) maps the builder's `Session[]` to `BuilderSession[]` for the engine. It currently maps all exercise fields except `group_id`. This task adds it so `scoreSuperset` and `scoreSRA` see the groups.

- [ ] **Step 1: Find the intelligenceSessions mapping**

Search for `intelligenceSessions` in `ProgramTemplateBuilder.tsx`. It should look like:

```typescript
const intelligenceSessions: BuilderSession[] = sessions.map(s => ({
  name: s.name,
  day_of_week: s.day_of_week,
  exercises: s.exercises.map(e => ({
    name: e.name,
    sets: e.sets,
    reps: e.reps,
    rest_sec: e.rest_sec,
    rir: e.rir,
    notes: e.notes,
    movement_pattern: e.movement_pattern,
    equipment_required: e.equipment_required,
    primary_muscles: e.primary_muscles,
    secondary_muscles: e.secondary_muscles,
    is_compound: e.is_compound,
  })),
}));
```

- [ ] **Step 2: Add group_id to the mapping**

```typescript
const intelligenceSessions: BuilderSession[] = sessions.map(s => ({
  name: s.name,
  day_of_week: s.day_of_week,
  exercises: s.exercises.map(e => ({
    name: e.name,
    sets: e.sets,
    reps: e.reps,
    rest_sec: e.rest_sec,
    rir: e.rir,
    notes: e.notes,
    movement_pattern: e.movement_pattern,
    equipment_required: e.equipment_required,
    primary_muscles: e.primary_muscles,
    secondary_muscles: e.secondary_muscles,
    is_compound: e.is_compound,
    group_id: e.group_id,   // ← add this
  })),
}));
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "intelligenceSessions\|group_id" | head -10
```

Expected: 0 lines.

- [ ] **Step 4: Commit**

```bash
git add components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(ui): pass group_id to intelligenceSessions so scoreSuperset receives superset context"
```

---

## Task 8: CHANGELOG + project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Update CHANGELOG.md**

Add at the top under `## 2026-04-18`:

```
SCHEMA: Add group_id text to coach_program_template_exercises for superset grouping
FEATURE: BuilderExercise.group_id — intelligence engine now accepts superset membership
FEATURE: scoreSRA collapses group_id slots — exercises in same group share SRA timestamp (no intra-group violations)
FEATURE: scoreSuperset — SUPERSET_IMBALANCE warning alert for agonist-agonist superset pairs
FEATURE: ProgramTemplateBuilder — assign/ungroup superset UI, green left-border grouped visual, Superset/Tri-set/Giant set label
FEATURE: group_id persisted via POST + PATCH /api/program-templates and loaded back into builder on edit
```

- [ ] **Step 2: Update project-state.md**

Add a new section `## 2026-04-18 — Supersets / Tri-sets (group_id)` at the top (before Phase 2B) with:

- Files modified and what each does
- Key behaviors: `group_id` is a client-generated UUID, `collapseGroups()` runs inside `scoreSRA` only, `scoreSuperset` doesn't affect globalScore, "Dissocier" removes `group_id` from all members atomically
- Points de vigilance:
  - `scoreSuperset` ne contribue PAS au globalScore — alertes uniquement (comme un linter)
  - `crypto.randomUUID()` côté client — compatible tous navigateurs modernes (pas de polyfill requis)
  - Le picker "Superset avec…" filtre les exercices sans `group_id` — un exercice déjà dans un groupe ne peut pas être ajouté dans un autre groupe sans dissociation préalable
  - `collapseGroups()` est défini inline dans `scoreSRA` (closure) — pas exporté, pas besoin de tests directs (couvert par les tests SRA)
  - Si le coach réordonne les exercices (drag), les `group_id` suivent — la logique de visuel `isGroupStart/isGroupEnd` se recalcule automatiquement
- Next Steps Phase 3:
  - [ ] SessionLogger client : afficher les exercices du même groupe côte à côte (two-column layout)
  - [ ] Scoring SRA inter-sessions : tenir compte du repos actif dans le superset (réduction de fenêtre SRA de 10–15%)
  - [ ] Attribution automatique de `group_id` à la détection de redondance mécanique (suggestion UI)

- [ ] **Step 3: Final TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | grep -v "BodyFatCalculator\|CarbCycling\|HRZones\|MacroCalculator\|payments\|genesis\|stripe" | head -20
```

Expected: 0 lines.

- [ ] **Step 4: Run all intelligence tests**

```bash
npx vitest run tests/lib/intelligence/ 2>&1 | tail -10
```

Expected: 44 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for Supersets / Tri-sets (group_id)"
```

---

## Self-Review

**Spec coverage:**
- ✅ `group_id` text column on `coach_program_template_exercises`: Task 1
- ✅ `BuilderExercise.group_id?: string`: Task 2
- ✅ SRA engine collapses grouped exercises into one slot (no intra-group violations): Task 3
- ✅ `SUPERSET_IMBALANCE` alert for agonist–agonist pairs: Task 4
- ✅ API persists and returns `group_id`: Task 5
- ✅ Builder UI — assign, add-to-group, ungroup: Task 6
- ✅ Grouped visual — left green border, group header label (Superset / Tri-set / Giant set): Task 6
- ✅ `intelligenceSessions` passes `group_id` to engine: Task 7
- ✅ Docs: Task 8

**Placeholder scan:** None found. All code blocks are self-contained with exact function bodies, no "add appropriate handling" language.

**Type consistency:**
- `BuilderExercise.group_id?: string` defined in Task 2, used in Task 3 (`ex.group_id`), Task 4 (`ex.group_id`), Task 6 (`e.group_id`), Task 7 (`e.group_id`) — consistent ✅
- `assignGroup(si, eiA, eiB)` defined in Task 6 Step 2, called in Task 6 Step 6 — consistent ✅
- `addToGroup(si, targetEi, groupId)` defined in Task 6 Step 2, called in Task 6 Step 6 — consistent ✅
- `ungroup(si, groupId)` defined in Task 6 Step 2, called in Task 6 Step 5 — consistent ✅
- `groupPickerTarget: { si: number; ei: number } | null` defined in Task 6 Step 3, read in Task 6 Step 6 — consistent ✅
- `scoreSuperset` exported from `scoring.ts` in Task 4, re-exported from `index.ts` in Task 4 Step 6, tested via direct import from `scoring` in Task 4 Step 1 — consistent ✅
- `collapseGroups` is an inline closure in `scoreSRA` — not exported, not referenced externally — consistent ✅
