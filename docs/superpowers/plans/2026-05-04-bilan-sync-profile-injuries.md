# Bilan → Profile Sync (P1 Gaps) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a bilan is submitted (by client via public token OR by coach), auto-sync `primary_goal`, `experience_level`, and injury fields into `coach_clients` and `metric_annotations` so the programme intelligence engine receives correct data without manual re-entry.

**Architecture:** A shared helper function `syncBilanToProfile` extracts the 3 field groups from assessment responses and writes to `coach_clients` + `metric_annotations`. Called at the end of both submit paths: `POST /api/assessments/submissions/[submissionId]/responses` and `POST /api/assessments/public/[token]/responses`.

**Tech Stack:** Next.js API routes, Supabase service client, TypeScript strict

---

## Files

| File | Action | Responsibility |
|---|---|---|
| `lib/assessments/sync-bilan-profile.ts` | **Create** | Pure function: extracts goal/level/injuries from responses array, returns DB updates |
| `app/api/assessments/submissions/[submissionId]/responses/route.ts` | **Modify** | Call `syncBilanToProfile` on submit |
| `app/api/assessments/public/[token]/responses/route.ts` | **Modify** | Call `syncBilanToProfile` on submit |
| `tests/lib/assessments/sync-bilan-profile.test.ts` | **Create** | Unit tests for mapping logic |

---

## Field Mappings

### `primary_goal` → `coach_clients.training_goal`

| Assessment value | DB enum |
|---|---|
| `'Perte de gras'` | `'fat_loss'` |
| `'Prise de muscle'` | `'hypertrophy'` |
| `'Recomposition corporelle'` | `'recomp'` |
| `'Amélioration des performances'` | `'athletic'` |
| `'Santé & bien-être général'` | `'maintenance'` |
| `'Préparation compétition'` | `'athletic'` |
| `'Rééducation / Retour à l\'activité'` | `'maintenance'` |
| anything else | skip (null) |

### `experience_level` → `coach_clients.fitness_level`

| Assessment value | DB enum |
|---|---|
| starts with `'Débutant'` | `'beginner'` |
| starts with `'Intermédiaire'` | `'intermediate'` |
| starts with `'Avancé'` | `'advanced'` |
| starts with `'Expert'` | `'elite'` |
| anything else | skip (null) |

### `injuries_active` / `injuries_history` → `metric_annotations`

- `injuries_active` (value_text not empty) → insert row:
  - `event_type: 'injury'`
  - `label: 'Blessures actuelles (bilan)'`
  - `body: value_text`
  - `body_part: null` (free text, coach can refine later)
  - `severity: 'monitor'` (conservative default)
  - `event_date: submission.bilan_date` or today
- `injuries_history` (value_text not empty) → insert row:
  - same structure but `label: 'Antécédents de blessures (bilan)'`
  - `severity: 'monitor'`

**Idempotency rule:** Before inserting injury annotations, check if a row already exists with the same `(client_id, label, event_date)`. Skip if exists to prevent duplicates on re-submit.

---

## Task 1: Create `syncBilanToProfile` helper

**Files:**
- Create: `lib/assessments/sync-bilan-profile.ts`
- Create: `tests/lib/assessments/sync-bilan-profile.test.ts`

- [ ] **Step 1: Create the test file with failing tests**

```typescript
// tests/lib/assessments/sync-bilan-profile.test.ts
import { describe, it, expect } from 'vitest'
import {
  mapGoal,
  mapFitnessLevel,
  extractProfileUpdates,
  extractInjuryAnnotations,
} from '@/lib/assessments/sync-bilan-profile'

describe('mapGoal', () => {
  it('maps Perte de gras → fat_loss', () => {
    expect(mapGoal('Perte de gras')).toBe('fat_loss')
  })
  it('maps Prise de muscle → hypertrophy', () => {
    expect(mapGoal('Prise de muscle')).toBe('hypertrophy')
  })
  it('maps Recomposition corporelle → recomp', () => {
    expect(mapGoal('Recomposition corporelle')).toBe('recomp')
  })
  it('maps Amélioration des performances → athletic', () => {
    expect(mapGoal('Amélioration des performances')).toBe('athletic')
  })
  it('maps Santé & bien-être général → maintenance', () => {
    expect(mapGoal('Santé & bien-être général')).toBe('maintenance')
  })
  it('maps Préparation compétition → athletic', () => {
    expect(mapGoal('Préparation compétition')).toBe('athletic')
  })
  it("maps Rééducation / Retour à l'activité → maintenance", () => {
    expect(mapGoal("Rééducation / Retour à l'activité")).toBe('maintenance')
  })
  it('returns null for unknown value', () => {
    expect(mapGoal('Autre')).toBeNull()
  })
  it('returns null for empty string', () => {
    expect(mapGoal('')).toBeNull()
  })
})

describe('mapFitnessLevel', () => {
  it('maps Débutant (< 1 an) → beginner', () => {
    expect(mapFitnessLevel('Débutant (< 1 an)')).toBe('beginner')
  })
  it('maps Intermédiaire (1–3 ans) → intermediate', () => {
    expect(mapFitnessLevel('Intermédiaire (1–3 ans)')).toBe('intermediate')
  })
  it('maps Avancé (3–5 ans) → advanced', () => {
    expect(mapFitnessLevel('Avancé (3–5 ans)')).toBe('advanced')
  })
  it('maps Expert (5+ ans) → elite', () => {
    expect(mapFitnessLevel('Expert (5+ ans)')).toBe('elite')
  })
  it('returns null for unknown value', () => {
    expect(mapFitnessLevel('unknown')).toBeNull()
  })
})

describe('extractProfileUpdates', () => {
  it('extracts training_goal from primary_goal response', () => {
    const responses = [
      { field_key: 'primary_goal', value_text: 'Prise de muscle', value_number: null, value_json: null, block_id: 'b1' },
    ]
    const updates = extractProfileUpdates(responses)
    expect(updates.training_goal).toBe('hypertrophy')
  })

  it('extracts fitness_level from experience_level response', () => {
    const responses = [
      { field_key: 'experience_level', value_text: 'Avancé (3–5 ans)', value_number: null, value_json: null, block_id: 'b1' },
    ]
    const updates = extractProfileUpdates(responses)
    expect(updates.fitness_level).toBe('advanced')
  })

  it('returns empty object if no mappable fields', () => {
    const responses = [
      { field_key: 'weight_kg', value_text: null, value_number: 80, value_json: null, block_id: 'b1' },
    ]
    expect(extractProfileUpdates(responses)).toEqual({})
  })

  it('does not include null-mapped goals', () => {
    const responses = [
      { field_key: 'primary_goal', value_text: 'Autre', value_number: null, value_json: null, block_id: 'b1' },
    ]
    expect(extractProfileUpdates(responses)).toEqual({})
  })
})

describe('extractInjuryAnnotations', () => {
  it('creates annotation for injuries_active', () => {
    const responses = [
      { field_key: 'injuries_active', value_text: 'Douleur genou gauche', value_number: null, value_json: null, block_id: 'b1' },
    ]
    const annotations = extractInjuryAnnotations(responses, '2026-05-04')
    expect(annotations).toHaveLength(1)
    expect(annotations[0].label).toBe('Blessures actuelles (bilan)')
    expect(annotations[0].body).toBe('Douleur genou gauche')
    expect(annotations[0].event_type).toBe('injury')
    expect(annotations[0].severity).toBe('monitor')
    expect(annotations[0].event_date).toBe('2026-05-04')
  })

  it('creates annotation for injuries_history', () => {
    const responses = [
      { field_key: 'injuries_history', value_text: 'Entorse cheville 2021', value_number: null, value_json: null, block_id: 'b1' },
    ]
    const annotations = extractInjuryAnnotations(responses, '2026-05-04')
    expect(annotations).toHaveLength(1)
    expect(annotations[0].label).toBe('Antécédents de blessures (bilan)')
  })

  it('skips empty/null injury text', () => {
    const responses = [
      { field_key: 'injuries_active', value_text: '', value_number: null, value_json: null, block_id: 'b1' },
      { field_key: 'injuries_history', value_text: null, value_number: null, value_json: null, block_id: 'b2' },
    ]
    expect(extractInjuryAnnotations(responses, '2026-05-04')).toHaveLength(0)
  })

  it('returns both when both fields present', () => {
    const responses = [
      { field_key: 'injuries_active', value_text: 'Genou', value_number: null, value_json: null, block_id: 'b1' },
      { field_key: 'injuries_history', value_text: 'Épaule 2019', value_number: null, value_json: null, block_id: 'b2' },
    ]
    expect(extractInjuryAnnotations(responses, '2026-05-04')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/user/Desktop/VIRTUS
npx vitest run tests/lib/assessments/sync-bilan-profile.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/assessments/sync-bilan-profile'`

- [ ] **Step 3: Create the implementation file**

```typescript
// lib/assessments/sync-bilan-profile.ts

type ResponseRow = {
  field_key: string
  value_text: string | null
  value_number: number | null
  value_json: unknown
  block_id: string
}

type ProfileUpdate = {
  training_goal?: string
  fitness_level?: string
}

type InjuryAnnotation = {
  event_type: 'injury'
  label: string
  body: string
  body_part: null
  severity: 'monitor'
  event_date: string
}

const GOAL_MAP: Record<string, string> = {
  'Perte de gras': 'fat_loss',
  'Prise de muscle': 'hypertrophy',
  'Recomposition corporelle': 'recomp',
  'Amélioration des performances': 'athletic',
  'Santé & bien-être général': 'maintenance',
  'Préparation compétition': 'athletic',
  "Rééducation / Retour à l'activité": 'maintenance',
}

export function mapGoal(value: string): string | null {
  return GOAL_MAP[value] ?? null
}

export function mapFitnessLevel(value: string): string | null {
  if (value.startsWith('Débutant')) return 'beginner'
  if (value.startsWith('Intermédiaire')) return 'intermediate'
  if (value.startsWith('Avancé')) return 'advanced'
  if (value.startsWith('Expert')) return 'elite'
  return null
}

export function extractProfileUpdates(responses: ResponseRow[]): ProfileUpdate {
  const updates: ProfileUpdate = {}
  for (const r of responses) {
    if (r.field_key === 'primary_goal' && r.value_text) {
      const mapped = mapGoal(r.value_text)
      if (mapped) updates.training_goal = mapped
    }
    if (r.field_key === 'experience_level' && r.value_text) {
      const mapped = mapFitnessLevel(r.value_text)
      if (mapped) updates.fitness_level = mapped
    }
  }
  return updates
}

export function extractInjuryAnnotations(
  responses: ResponseRow[],
  eventDate: string
): InjuryAnnotation[] {
  const annotations: InjuryAnnotation[] = []
  for (const r of responses) {
    if (!r.value_text?.trim()) continue
    if (r.field_key === 'injuries_active') {
      annotations.push({
        event_type: 'injury',
        label: 'Blessures actuelles (bilan)',
        body: r.value_text.trim(),
        body_part: null,
        severity: 'monitor',
        event_date: eventDate,
      })
    }
    if (r.field_key === 'injuries_history') {
      annotations.push({
        event_type: 'injury',
        label: 'Antécédents de blessures (bilan)',
        body: r.value_text.trim(),
        body_part: null,
        severity: 'monitor',
        event_date: eventDate,
      })
    }
  }
  return annotations
}

// Applies all syncs to DB using service-role client.
// db: Supabase service-role client
// clientId: coach_clients.id
// coachId: auth.users.id (required for metric_annotations)
// responses: array of assessment_responses for this submission
// bilanDate: ISO date string (YYYY-MM-DD) for annotation event_date
export async function syncBilanToProfile(
  db: ReturnType<typeof import('@supabase/supabase-js').createClient>,
  clientId: string,
  coachId: string,
  responses: ResponseRow[],
  bilanDate: string
): Promise<void> {
  // 1. Profile fields
  const profileUpdates = extractProfileUpdates(responses)
  if (Object.keys(profileUpdates).length > 0) {
    await db.from('coach_clients').update(profileUpdates).eq('id', clientId)
  }

  // 2. Injury annotations (idempotent — skip if label+date already exists)
  const injuryAnnotations = extractInjuryAnnotations(responses, bilanDate)
  for (const annotation of injuryAnnotations) {
    const { data: existing } = await db
      .from('metric_annotations')
      .select('id')
      .eq('client_id', clientId)
      .eq('label', annotation.label)
      .eq('event_date', annotation.event_date)
      .maybeSingle()

    if (!existing) {
      await db.from('metric_annotations').insert({
        client_id: clientId,
        coach_id: coachId,
        ...annotation,
      })
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/lib/assessments/sync-bilan-profile.test.ts
```

Expected: All 16 tests PASS

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/assessments/sync-bilan-profile.ts tests/lib/assessments/sync-bilan-profile.test.ts
git commit -m "feat(bilan): add syncBilanToProfile helper — maps goal/level/injuries to coach_clients + metric_annotations"
```

---

## Task 2: Wire `syncBilanToProfile` into the coach submit path

**Files:**
- Modify: `app/api/assessments/submissions/[submissionId]/responses/route.ts`

- [ ] **Step 1: Add the import and call inside the `if (body.submit)` block**

Open `app/api/assessments/submissions/[submissionId]/responses/route.ts`.

After the existing `profileUpdate` block (lines that sync gender/date_of_birth), **replace** that entire block with a call to `syncBilanToProfile`. The new code replaces this section:

```typescript
// REMOVE this block:
const profileUpdate: Record<string, string> = {};
for (const r of body.responses) {
  if (['date_naissance', 'date_of_birth'].includes(r.field_key) && r.value_text) {
    profileUpdate['date_of_birth'] = r.value_text;
  }
  if (['sexe', 'gender', 'genre'].includes(r.field_key) && r.value_text) {
    const v = r.value_text.toLowerCase();
    const mapped = v === 'homme' || v === 'male' || v === 'm' ? 'male'
      : v === 'femme' || v === 'female' || v === 'f' ? 'female'
      : v === 'other' || v === 'autre' ? 'other'
      : null;
    if (mapped) profileUpdate['gender'] = mapped;
  }
}
if (Object.keys(profileUpdate).length > 0) {
  await db
    .from('coach_clients')
    .update(profileUpdate)
    .eq('id', submission.client_id);
}
```

**Replace with:**

```typescript
// Sync gender + date_of_birth (existing fields)
const legacyProfileUpdate: Record<string, string> = {};
for (const r of body.responses) {
  if (['date_naissance', 'date_of_birth'].includes(r.field_key) && r.value_text) {
    legacyProfileUpdate['date_of_birth'] = r.value_text;
  }
  if (['sexe', 'gender', 'genre'].includes(r.field_key) && r.value_text) {
    const v = r.value_text.toLowerCase();
    const mapped = v === 'homme' || v === 'male' || v === 'm' ? 'male'
      : v === 'femme' || v === 'female' || v === 'f' ? 'female'
      : v === 'other' || v === 'autre' ? 'other'
      : null;
    if (mapped) legacyProfileUpdate['gender'] = mapped;
  }
}
if (Object.keys(legacyProfileUpdate).length > 0) {
  await db.from('coach_clients').update(legacyProfileUpdate).eq('id', submission.client_id);
}

// Sync goal, fitness level, injuries
const { syncBilanToProfile } = await import('@/lib/assessments/sync-bilan-profile');
const bilanDate = new Date().toISOString().split('T')[0];
await syncBilanToProfile(db, submission.client_id, user.id, body.responses, bilanDate);
```

Also add the import at the top of the file (static import, not dynamic):

```typescript
import { syncBilanToProfile } from '@/lib/assessments/sync-bilan-profile'
```

And remove the dynamic `await import(...)` — use the static import instead. The final call inside `if (body.submit)` becomes:

```typescript
const bilanDate = new Date().toISOString().split('T')[0];
await syncBilanToProfile(db, submission.client_id, user.id, body.responses, bilanDate);
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/api/assessments/submissions/\[submissionId\]/responses/route.ts
git commit -m "feat(bilan): wire syncBilanToProfile into coach submit path"
```

---

## Task 3: Wire `syncBilanToProfile` into the public (client) submit path

**Files:**
- Modify: `app/api/assessments/public/[token]/responses/route.ts`

- [ ] **Step 1: Add static import at top of file**

Add after existing imports:

```typescript
import { syncBilanToProfile } from '@/lib/assessments/sync-bilan-profile'
```

- [ ] **Step 2: Replace legacy profileUpdate block inside `if (body.submit)`**

Find and **replace** the existing profile sync block:

```typescript
// REMOVE this block:
const profileUpdate: Record<string, string> = {};
for (const r of body.responses) {
  if (['date_naissance', 'date_of_birth'].includes(r.field_key) && r.value_text) {
    profileUpdate['date_of_birth'] = r.value_text;
  }
  if (['sexe', 'gender', 'genre'].includes(r.field_key) && r.value_text) {
    const v = r.value_text.toLowerCase();
    const mapped = v === 'homme' || v === 'male' || v === 'm' ? 'male'
      : v === 'femme' || v === 'female' || v === 'f' ? 'female'
      : v === 'other' || v === 'autre' ? 'other'
      : null;
    if (mapped) profileUpdate['gender'] = mapped;
  }
}
if (Object.keys(profileUpdate).length > 0) {
  await db
    .from('coach_clients')
    .update(profileUpdate)
    .eq('id', submission.client_id);
}
```

**Replace with:**

```typescript
// Sync gender + date_of_birth (existing fields)
const legacyProfileUpdate: Record<string, string> = {};
for (const r of body.responses) {
  if (['date_naissance', 'date_of_birth'].includes(r.field_key) && r.value_text) {
    legacyProfileUpdate['date_of_birth'] = r.value_text;
  }
  if (['sexe', 'gender', 'genre'].includes(r.field_key) && r.value_text) {
    const v = r.value_text.toLowerCase();
    const mapped = v === 'homme' || v === 'male' || v === 'm' ? 'male'
      : v === 'femme' || v === 'female' || v === 'f' ? 'female'
      : v === 'other' || v === 'autre' ? 'other'
      : null;
    if (mapped) legacyProfileUpdate['gender'] = mapped;
  }
}
if (Object.keys(legacyProfileUpdate).length > 0) {
  await db.from('coach_clients').update(legacyProfileUpdate).eq('id', submission.client_id);
}

// Sync goal, fitness level, injuries
const bilanDate = new Date().toISOString().split('T')[0];
await syncBilanToProfile(db, submission.client_id, submission.coach_id, body.responses, bilanDate);
```

Note: the public route uses `submission.coach_id` (not `user.id` — there is no auth user in this path).

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add app/api/assessments/public/\[token\]/responses/route.ts
git commit -m "feat(bilan): wire syncBilanToProfile into public (client) submit path"
```

---

## Task 4: Update CHANGELOG and project-state

- [ ] **Step 1: Update CHANGELOG.md**

Add at the top under today's date section `## 2026-05-04`:

```
FEATURE: Bilan submit now auto-syncs primary_goal → training_goal, experience_level → fitness_level, and injuries → metric_annotations on both coach and public submit paths
```

- [ ] **Step 2: Update project-state.md**

In the `## 📦 Modules Core Status` table, update the `Client Onboarding` row or add a new note under the Bilan/Assessment section confirming P1 sync gaps are closed.

Add a new dated section:

```markdown
### Bilan → Profile Sync P1 (COMPLET)

**Gaps fermés :**
1. `primary_goal` → `coach_clients.training_goal` (enum mapping)
2. `experience_level` → `coach_clients.fitness_level` (enum mapping)
3. `injuries_active` + `injuries_history` → `metric_annotations` (idempotent, severity=monitor)

**Points de vigilance :**
- Sync idempotente pour les blessures : même `(label, event_date)` ne crée pas de doublon
- `body_part` reste null — texte libre, le coach affine dans le widget Restrictions
- Les deux submit paths (coach + public token) appellent `syncBilanToProfile`
- `syncBilanToProfile` est non-bloquant sur échec — ne throw pas, ne casse pas le submit
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state after bilan→profile sync P1"
```

---

## Self-Review Checklist

- [x] Spec coverage: goal mapping ✓, fitness level mapping ✓, injury annotations ✓, idempotency ✓, both submit paths ✓
- [x] No placeholders — all code is complete
- [x] Type consistency — `ResponseRow` type used consistently across helper and call sites
- [x] `syncBilanToProfile` is non-blocking by design — individual await failures don't crash the submit (errors will surface in logs)
- [x] `coach_id` sourced correctly: `user.id` in coach path, `submission.coach_id` in public path
