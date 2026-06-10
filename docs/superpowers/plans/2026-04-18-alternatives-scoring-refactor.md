# Alternatives Scoring Refactor — Muscular Sub-Groups & Deduplication

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `scoreAlternatives()` so back exercises (tractions vs rows vs shrugs vs hip-hinge) score as truly distinct alternatives, eliminate near-duplicate candidates, and improve label discrimination.

**Architecture:** The exercise catalog stores all back exercises with the monolithic `'dos'` muscle slug. But the `movementPattern` field already encodes the functional sub-group: `vertical_pull` → grand dorsal, `horizontal_pull` → trapèzes moyen/rhomboïdes, `scapular_elevation` → trapèze supérieur, `hip_hinge` → lombaires/érecteurs. The fix: add a `deriveBackSubGroups()` helper in `catalog-utils.ts` that maps `(muscles[], movementPattern)` → a richer sub-muscle set at scoring time. `scoreAlternatives()` then computes overlap on these expanded sets instead of raw catalog muscle tags. Additionally, deduplicate candidates by name prefix (first 3 words) before returning results, and tighten label thresholds.

**Tech Stack:** TypeScript strict, no new dependencies, no catalog regeneration required.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/programs/intelligence/catalog-utils.ts` | Modify | Add `deriveBackSubGroups()` + `expandMusclesForScoring()` |
| `lib/programs/intelligence/alternatives.ts` | Modify | Use expanded muscles for overlap, deduplicate by name prefix |
| `tests/lib/intelligence/catalog-utils.test.ts` | Create/Modify | Unit tests for sub-group expansion |
| `tests/lib/intelligence/alternatives.test.ts` | Create | Unit tests for alternative scoring with back sub-groups |
| `CHANGELOG.md` | Modify | Document the fix |

---

## Task 1: Add sub-group expansion to catalog-utils.ts

**Files:**
- Modify: `lib/programs/intelligence/catalog-utils.ts`

**Context:** We introduce `expandMusclesForScoring(muscles, movementPattern)` which, when the muscles array contains `'dos'`, replaces it with a fine-grained set based on the movement pattern. This keeps the catalog unchanged while giving the scoring engine richer discrimination.

Sub-group mapping by pattern (for `'dos'` entries):
- `vertical_pull` → `['grand_dorsal', 'dos_large']` (lat-dominant)
- `horizontal_pull` → `['trapeze_moyen', 'rhomboides', 'dos_large']` (row-dominant)
- `scapular_elevation` → `['trapeze_superieur', 'dos_large']` (shrug-dominant)
- `hip_hinge` → `['lombaires', 'erecteurs_spinaux', 'dos_large']` (erector-dominant)
- `core_anti_flex` → `['lombaires', 'erecteurs_spinaux', 'dos_large']`
- `carry` → `['trapeze_superieur', 'dos_large']`
- default (unknown pattern) → `['dos_large']` (keep generic — same-group bonus vs truly different)

The `'dos_large'` tag acts as a "same gross group" marker. Two exercises sharing only `dos_large` (e.g. traction vs shrug) get a small partial bonus, not the full overlap bonus.

- [ ] **Step 1: Add `DOS_SUBGROUPS_BY_PATTERN` constant**

At the bottom of `lib/programs/intelligence/catalog-utils.ts`, before `MUSCLE_TO_BODY_PART`, add:

```typescript
// Fine-grained back sub-groups derived from movementPattern at scoring time.
// The catalog stores 'dos' monolithically — this map expands it without regenerating the catalog.
const DOS_SUBGROUPS_BY_PATTERN: Record<string, string[]> = {
  vertical_pull:      ['grand_dorsal', 'dos_large'],
  horizontal_pull:    ['trapeze_moyen', 'rhomboides', 'dos_large'],
  scapular_elevation: ['trapeze_superieur', 'dos_large'],
  hip_hinge:          ['lombaires', 'erecteurs_spinaux', 'dos_large'],
  core_anti_flex:     ['lombaires', 'erecteurs_spinaux', 'dos_large'],
  carry:              ['trapeze_superieur', 'dos_large'],
}
```

- [ ] **Step 2: Add `expandMusclesForScoring()` export**

Immediately after that constant, add:

```typescript
/**
 * Expands muscle slugs for scoring purposes.
 * When 'dos' is present, replaces it with functional sub-groups derived from movementPattern.
 * Other muscles are kept as-is (after normalization).
 */
export function expandMusclesForScoring(muscles: string[], movementPattern: string | null): string[] {
  const result: string[] = []
  for (const m of muscles) {
    const norm = normalizeMuscleSlug(m)
    if (norm === 'dos') {
      const subgroups = DOS_SUBGROUPS_BY_PATTERN[movementPattern ?? ''] ?? ['dos_large']
      result.push(...subgroups)
    } else {
      result.push(norm)
    }
  }
  return result
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "catalog-utils" | head -10
```

Expected: 0 lines.

- [ ] **Step 4: Commit**

```bash
git add lib/programs/intelligence/catalog-utils.ts
git commit -m "feat(intelligence): add expandMusclesForScoring with back sub-groups by movementPattern"
```

---

## Task 2: Unit tests for expandMusclesForScoring

**Files:**
- Create/Modify: `tests/lib/intelligence/catalog-utils.test.ts`

**Context:** Verify sub-group expansion works for all back patterns and that non-back muscles are passed through unchanged.

- [ ] **Step 1: Check if test file exists**

```bash
ls tests/lib/intelligence/catalog-utils.test.ts 2>/dev/null && echo "exists" || echo "missing"
```

- [ ] **Step 2: Add tests (append if exists, create if missing)**

Add these tests to the file (or create it with this content if missing):

```typescript
import { describe, it, expect } from 'vitest'
import { expandMusclesForScoring } from '@/lib/programs/intelligence/catalog-utils'

describe('expandMusclesForScoring', () => {
  it('expands dos on vertical_pull to grand_dorsal + dos_large', () => {
    const result = expandMusclesForScoring(['dos', 'biceps'], 'vertical_pull')
    expect(result).toContain('grand_dorsal')
    expect(result).toContain('dos_large')
    expect(result).toContain('biceps')
    expect(result).not.toContain('dos')
  })

  it('expands dos on horizontal_pull to trapeze_moyen + rhomboides + dos_large', () => {
    const result = expandMusclesForScoring(['dos', 'biceps'], 'horizontal_pull')
    expect(result).toContain('trapeze_moyen')
    expect(result).toContain('rhomboides')
    expect(result).toContain('dos_large')
    expect(result).not.toContain('dos')
  })

  it('expands dos on scapular_elevation to trapeze_superieur + dos_large', () => {
    const result = expandMusclesForScoring(['dos'], 'scapular_elevation')
    expect(result).toContain('trapeze_superieur')
    expect(result).toContain('dos_large')
    expect(result).not.toContain('dos')
  })

  it('expands dos on hip_hinge to lombaires + erecteurs_spinaux + dos_large', () => {
    const result = expandMusclesForScoring(['dos'], 'hip_hinge')
    expect(result).toContain('lombaires')
    expect(result).toContain('erecteurs_spinaux')
    expect(result).toContain('dos_large')
  })

  it('falls back to dos_large for unknown pattern', () => {
    const result = expandMusclesForScoring(['dos'], null)
    expect(result).toEqual(['dos_large'])
  })

  it('passes through non-back muscles unchanged', () => {
    const result = expandMusclesForScoring(['quadriceps', 'fessiers'], 'squat_pattern')
    expect(result).toEqual(['quadriceps', 'fessiers'])
  })

  it('handles empty array', () => {
    expect(expandMusclesForScoring([], 'vertical_pull')).toEqual([])
  })
})
```

- [ ] **Step 3: Run the tests**

```bash
npx vitest run tests/lib/intelligence/catalog-utils.test.ts 2>&1 | tail -15
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/lib/intelligence/catalog-utils.test.ts
git commit -m "test(intelligence): unit tests for expandMusclesForScoring sub-group expansion"
```

---

## Task 3: Refactor scoreAlternatives — sub-group overlap + deduplication

**Files:**
- Modify: `lib/programs/intelligence/alternatives.ts`

**Context:** Three changes:
1. Use `expandMusclesForScoring` for both the original exercise and each candidate when computing muscle overlap.
2. Deduplicate candidates by "name prefix" (first 3 words, lowercased) — e.g. "Tirage vertical poulie haute variante A" and "Tirage vertical poulie haute variante B" become one entry (keep highest score).
3. Return max 6 (not 8) after dedup, with tighter label thresholds.

- [ ] **Step 1: Update imports in alternatives.ts**

Find the import line:
```typescript
import { normalizeMuscleSlug, getStimulusCoeff } from './catalog-utils'
```

Replace with:
```typescript
import { normalizeMuscleSlug, getStimulusCoeff, expandMusclesForScoring } from './catalog-utils'
```

- [ ] **Step 2: Replace overlap computation to use expanded muscles**

In `scoreAlternatives`, find the section that builds `originalMuscles`:
```typescript
const originalMuscles = new Set(original.primary_muscles.map(normalizeMuscleSlug))
```

Replace with:
```typescript
const originalMusclesExpanded = new Set(
  expandMusclesForScoring(original.primary_muscles, originalPattern)
)
```

Then find the candidate overlap computation inside the for-loop:
```typescript
// Muscles primaires communs (+30)
const candidateMuscles = new Set(candidate.muscles.map(normalizeMuscleSlug))
const overlap = Array.from(originalMuscles).filter(m => candidateMuscles.has(m))
if (overlap.length > 0) score += Math.min(30, overlap.length * 15)
```

Replace with:
```typescript
// Muscles primaires communs — via sub-groups pour 'dos' (+30 max)
const candidateMusclesExpanded = new Set(
  expandMusclesForScoring(candidate.muscles, candidate.movementPattern)
)
const overlap = Array.from(originalMusclesExpanded).filter(m => candidateMusclesExpanded.has(m))
// dos_large-only overlap (different back sub-groups) = partial credit only
const hasOnlyDosLarge = overlap.length > 0 && overlap.every(m => m === 'dos_large')
if (overlap.length > 0) {
  score += hasOnlyDosLarge ? 8 : Math.min(30, overlap.length * 15)
}
```

Also update the `originalMuscles` reference in the label line (it now references the wrong variable). Find:
```typescript
if (candidate.movementPattern === originalPattern && overlap.length >= 1) label = 'Remplace mécaniquement'
else if (candidate.movementPattern !== originalPattern && overlap.length >= 1) label = 'Angle complémentaire'
```

Replace with:
```typescript
const hasRealOverlap = overlap.length > 0 && !hasOnlyDosLarge
if (candidate.movementPattern === originalPattern && hasRealOverlap) label = 'Remplace mécaniquement'
else if (candidate.movementPattern !== originalPattern && hasRealOverlap) label = 'Angle complémentaire'
```

- [ ] **Step 3: Add deduplication before the return**

Find the return statement:
```typescript
return scored
  .sort((a, b) => b.score - a.score)
  .slice(0, 8) // max 8 alternatives retournées au drawer
```

Replace with:
```typescript
// Deduplicate by name prefix (first 3 words) — keeps highest scoring variant
const sorted = scored.sort((a, b) => b.score - a.score)
const seenPrefixes = new Set<string>()
const deduped: AlternativeScore[] = []
for (const alt of sorted) {
  const prefix = alt.entry.name.toLowerCase().split(/\s+/).slice(0, 3).join(' ')
  if (!seenPrefixes.has(prefix)) {
    seenPrefixes.add(prefix)
    deduped.push(alt)
  }
  if (deduped.length >= 6) break
}
return deduped
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "alternatives" | head -10
```

Expected: 0 lines.

- [ ] **Step 5: Commit**

```bash
git add lib/programs/intelligence/alternatives.ts
git commit -m "fix(intelligence): alternatives — back sub-group overlap, dedup by name prefix, max 6 results"
```

---

## Task 4: Unit tests for refactored scoreAlternatives

**Files:**
- Create: `tests/lib/intelligence/alternatives.test.ts`

**Context:** Verify that a traction (vertical_pull) does not rank a shrug (scapular_elevation) as "Remplace mécaniquement", that true mechanical replacements score higher than cross-pattern alternatives, and that deduplication removes near-duplicate names.

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect } from 'vitest'
import { scoreAlternatives } from '@/lib/programs/intelligence/alternatives'
import type { BuilderExercise, TemplateMeta } from '@/lib/programs/intelligence/types'

function makeExercise(overrides: Partial<BuilderExercise>): BuilderExercise {
  return {
    id: 'test-id',
    name: '',
    sets: 3,
    reps: '8-10',
    rir: 2,
    movement_pattern: null,
    primary_muscles: [],
    secondary_muscles: [],
    equipment_required: [],
    is_compound: undefined,
    group_id: undefined,
    ...overrides,
  }
}

const context = {
  equipmentArchetype: 'commercial_gym',
  goal: 'hypertrophy',
  level: 'intermediate',
  sessionExercises: [],
}

describe('scoreAlternatives — back sub-groups', () => {
  it('traction (vertical_pull) does NOT label shrug (scapular_elevation) as Remplace mécaniquement', () => {
    const traction = makeExercise({
      name: 'Traction pronation',
      movement_pattern: 'vertical_pull',
      primary_muscles: ['dos'],
      is_compound: true,
    })
    const alts = scoreAlternatives(traction, context)
    const shrugs = alts.filter(a => a.entry.movementPattern === 'scapular_elevation')
    for (const s of shrugs) {
      expect(s.label).not.toBe('Remplace mécaniquement')
    }
  })

  it('traction (vertical_pull) scores another vertical_pull higher than a horizontal_pull', () => {
    const traction = makeExercise({
      name: 'Traction pronation',
      movement_pattern: 'vertical_pull',
      primary_muscles: ['dos'],
      is_compound: true,
    })
    const alts = scoreAlternatives(traction, context)
    const vPulls = alts.filter(a => a.entry.movementPattern === 'vertical_pull')
    const hPulls = alts.filter(a => a.entry.movementPattern === 'horizontal_pull')
    if (vPulls.length > 0 && hPulls.length > 0) {
      expect(vPulls[0].score).toBeGreaterThan(hPulls[0].score)
    }
  })

  it('returns at most 6 alternatives', () => {
    const ex = makeExercise({
      name: 'Développé couché barre',
      movement_pattern: 'horizontal_push',
      primary_muscles: ['pectoraux'],
      is_compound: true,
    })
    const alts = scoreAlternatives(ex, context)
    expect(alts.length).toBeLessThanOrEqual(6)
  })

  it('no duplicate name prefixes in results', () => {
    const ex = makeExercise({
      name: 'Tirage vertical poulie haute',
      movement_pattern: 'vertical_pull',
      primary_muscles: ['dos'],
      is_compound: true,
    })
    const alts = scoreAlternatives(ex, context)
    const prefixes = alts.map(a =>
      a.entry.name.toLowerCase().split(/\s+/).slice(0, 3).join(' ')
    )
    const unique = new Set(prefixes)
    expect(unique.size).toBe(prefixes.length)
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run tests/lib/intelligence/alternatives.test.ts 2>&1 | tail -20
```

Expected: all tests PASS (4/4).

- [ ] **Step 3: Commit**

```bash
git add tests/lib/intelligence/alternatives.test.ts
git commit -m "test(intelligence): scoreAlternatives — back sub-group discrimination + dedup tests"
```

---

## Task 5: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update CHANGELOG**

Add at top under `## 2026-04-18`:

```
FIX: scoreAlternatives — back muscle sub-groups (grand_dorsal / trapeze_moyen / rhomboides / trapeze_superieur / lombaires) derived from movementPattern, replaces monolithic 'dos' overlap
FIX: scoreAlternatives — deduplicate candidates by name prefix (first 3 words), max 6 results returned
FIX: ExerciseAlternativesDrawer — 'Remplace mécaniquement' label now requires true sub-group overlap, not dos_large-only match
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for alternatives scoring refactor"
```
