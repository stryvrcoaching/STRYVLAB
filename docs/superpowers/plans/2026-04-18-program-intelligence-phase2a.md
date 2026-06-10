# Program Intelligence Phase 2A — Client Profile Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate client restrictions (injuries), equipment availability, and fitness profile into the Program Intelligence engine so that `buildIntelligenceResult` emits `INJURY_CONFLICT` and `EQUIPMENT_MISMATCH` alerts when a client's profile is provided.

**Architecture:** Two new columns on `metric_annotations` (`body_part`, `severity`) and one on `coach_clients` (`equipment text[]`). A new `/api/clients/[clientId]/intelligence-profile` endpoint aggregates the profile. Two UI widgets let coaches (on the client page) and clients (in their profile) declare restrictions. The builder gets an optional `clientId` prop that fetches the profile and passes it to `useProgramIntelligence`.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase (service role client), Zod, Tailwind CSS (DS v2.0 — `#121212` bg, `bg-white/[0.02]` cards, `#1f8a65` accent), Vitest.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260418_intelligence_profile.sql` | Create | Add `body_part`, `severity` to `metric_annotations`; add `equipment` to `coach_clients` |
| `lib/programs/intelligence/types.ts` | Modify | Add `InjuryRestriction`, `IntelligenceProfile` types |
| `lib/programs/intelligence/catalog-utils.ts` | Modify | Add `MUSCLE_TO_BODY_PART` map + `muscleConflictsWithRestriction()` helper |
| `lib/programs/intelligence/scoring.ts` | Modify | Pass `profile?` to `scoreSpecificity` and `scoreCompleteness`; emit `INJURY_CONFLICT` / `EQUIPMENT_MISMATCH` alerts |
| `lib/programs/intelligence/index.ts` | Modify | Export `IntelligenceProfile`; add `profile?` param to `useProgramIntelligence` |
| `app/api/clients/[clientId]/intelligence-profile/route.ts` | Create | Aggregate `coach_clients` + `metric_annotations` into `IntelligenceProfile` |
| `app/api/clients/[clientId]/annotations/route.ts` | Modify | Add `body_part` and `severity` to `createSchema` |
| `app/api/client/restrictions/route.ts` | Create | GET + POST for client-authenticated injury restrictions |
| `app/api/client/restrictions/[annotationId]/route.ts` | Create | DELETE for client-authenticated injury restrictions |
| `components/clients/RestrictionsWidget.tsx` | Create | Coach-facing widget: list + inline add + delete + equipment pills |
| `components/client/ClientRestrictionsSection.tsx` | Create | Client-facing section for profil page |
| `app/client/profil/page.tsx` | Modify | Add `<ClientRestrictionsSection>` with separator |
| `app/coach/clients/[clientId]/page.tsx` | Modify | Add `<RestrictionsWidget>` in Profil tab |
| `tests/lib/intelligence/profile-scoring.test.ts` | Create | Unit tests for INJURY_CONFLICT + EQUIPMENT_MISMATCH scoring |

---

## Task 1: DB Migration — `body_part`, `severity`, `equipment`

**Files:**
- Create: `supabase/migrations/20260418_intelligence_profile.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260418_intelligence_profile.sql

-- Add structured injury fields to metric_annotations
ALTER TABLE metric_annotations
  ADD COLUMN IF NOT EXISTS body_part text,
  ADD COLUMN IF NOT EXISTS severity  text
    CHECK (severity IN ('avoid', 'limit', 'monitor'));

-- Add equipment list to coach_clients
ALTER TABLE coach_clients
  ADD COLUMN IF NOT EXISTS equipment text[] DEFAULT '{}';
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Or if using local Supabase:
```bash
npx supabase migration up
```

Expected: no errors, migration applied.

- [ ] **Step 3: Verify columns exist**

Run in Supabase SQL editor or via `npx supabase db remote commit`:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'metric_annotations'
  AND column_name IN ('body_part', 'severity');

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'coach_clients'
  AND column_name = 'equipment';
```

Expected: 3 rows returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260418_intelligence_profile.sql
git commit -m "schema: add body_part/severity to metric_annotations, equipment to coach_clients"
```

---

## Task 2: Intelligence Engine — Types + `MUSCLE_TO_BODY_PART`

**Files:**
- Modify: `lib/programs/intelligence/types.ts`
- Modify: `lib/programs/intelligence/catalog-utils.ts`

- [ ] **Step 1: Write failing test for `muscleConflictsWithRestriction`**

Create file `tests/lib/intelligence/profile-scoring.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { muscleConflictsWithRestriction } from '@/lib/programs/intelligence/catalog-utils'
import type { InjuryRestriction } from '@/lib/programs/intelligence/types'

describe('muscleConflictsWithRestriction', () => {
  it('detects conflict when muscle maps to restricted body_part', () => {
    const restrictions: InjuryRestriction[] = [
      { bodyPart: 'shoulder_right', severity: 'avoid' },
    ]
    expect(muscleConflictsWithRestriction('deltoide_anterieur', restrictions)).toEqual({
      conflicts: true,
      severity: 'avoid',
    })
  })

  it('returns null when no conflict', () => {
    const restrictions: InjuryRestriction[] = [
      { bodyPart: 'knee_right', severity: 'avoid' },
    ]
    expect(muscleConflictsWithRestriction('pectoraux', restrictions)).toBeNull()
  })

  it('handles bilateral restriction (lower_back affects both sides)', () => {
    const restrictions: InjuryRestriction[] = [
      { bodyPart: 'lower_back', severity: 'limit' },
    ]
    expect(muscleConflictsWithRestriction('lombaires', restrictions)).toEqual({
      conflicts: true,
      severity: 'limit',
    })
  })

  it('returns highest severity when multiple muscles conflict', () => {
    const restrictions: InjuryRestriction[] = [
      { bodyPart: 'shoulder_right', severity: 'monitor' },
      { bodyPart: 'shoulder_left', severity: 'avoid' },
    ]
    // deltoide_anterieur maps to both shoulder_right and shoulder_left
    const result = muscleConflictsWithRestriction('deltoide_anterieur', restrictions)
    expect(result?.severity).toBe('avoid')
  })

  it('returns null for empty restrictions', () => {
    expect(muscleConflictsWithRestriction('quadriceps', [])).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/intelligence/profile-scoring.test.ts
```

Expected: FAIL with "muscleConflictsWithRestriction is not a function" or similar.

- [ ] **Step 3: Add `InjuryRestriction` and `IntelligenceProfile` to types.ts**

In `lib/programs/intelligence/types.ts`, append after the last export:

```typescript
export interface InjuryRestriction {
  bodyPart: string
  severity: 'avoid' | 'limit' | 'monitor'
}

export interface IntelligenceProfile {
  injuries: InjuryRestriction[]
  equipment: string[]
  fitnessLevel?: string
  goal?: string
}
```

- [ ] **Step 4: Add `MUSCLE_TO_BODY_PART` and `muscleConflictsWithRestriction` to catalog-utils.ts**

Append to `lib/programs/intelligence/catalog-utils.ts` (after the existing `resolveExerciseCoeff` export):

```typescript
import type { InjuryRestriction } from './types'

// Maps FR muscle slugs to body_part vocabulary used in restrictions
export const MUSCLE_TO_BODY_PART: Record<string, string[]> = {
  // Shoulder / Elbow
  'deltoide_anterieur':  ['shoulder_right', 'shoulder_left'],
  'deltoide_lateral':    ['shoulder_right', 'shoulder_left'],
  'deltoide_posterieur': ['shoulder_right', 'shoulder_left'],
  'coiffe_rotateurs':    ['shoulder_right', 'shoulder_left'],
  'epaules':             ['shoulder_right', 'shoulder_left'],
  'biceps':              ['elbow_right', 'elbow_left'],
  'triceps':             ['elbow_right', 'elbow_left'],
  'avant_bras':          ['elbow_right', 'elbow_left', 'wrist_right', 'wrist_left'],

  // Knee / Hip
  'quadriceps':          ['knee_right', 'knee_left'],
  'ischio-jambiers':     ['knee_right', 'knee_left', 'hip_right', 'hip_left'],
  'fessiers':            ['hip_right', 'hip_left'],

  // Back / Neck
  'lombaires':           ['lower_back'],
  'erecteurs_spinaux':   ['lower_back', 'upper_back'],
  'dos':                 ['upper_back', 'lower_back'],
  'trapeze':             ['upper_back', 'neck'],
  'rhomboides':          ['upper_back'],
  'grand_dorsal':        ['upper_back'],

  // Chest / Core
  'pectoraux':           [],  // chest — no standard injury body_part in vocabulary
  'abdos':               [],
  'mollets':             ['ankle_right', 'ankle_left'],
}

const SEVERITY_ORDER: Record<string, number> = { avoid: 3, limit: 2, monitor: 1 }

export function muscleConflictsWithRestriction(
  muscleSlug: string,
  restrictions: InjuryRestriction[],
): { conflicts: true; severity: 'avoid' | 'limit' | 'monitor' } | null {
  if (restrictions.length === 0) return null

  const bodyParts = MUSCLE_TO_BODY_PART[normalizeMuscleSlug(muscleSlug)] ?? []
  if (bodyParts.length === 0) return null

  let highestSeverity: 'avoid' | 'limit' | 'monitor' | null = null

  for (const restriction of restrictions) {
    if (bodyParts.includes(restriction.bodyPart)) {
      if (
        highestSeverity === null ||
        SEVERITY_ORDER[restriction.severity] > SEVERITY_ORDER[highestSeverity]
      ) {
        highestSeverity = restriction.severity
      }
    }
  }

  return highestSeverity ? { conflicts: true, severity: highestSeverity } : null
}
```

Note: the `import type { InjuryRestriction }` must be added at the top of the file with the existing imports.

**Full updated top of `catalog-utils.ts`:**

```typescript
import catalogData from '@/data/exercise-catalog.json'
import type { InjuryRestriction } from './types'
```

(Only the second line is new — keep the existing `import catalogData` line unchanged.)

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run tests/lib/intelligence/profile-scoring.test.ts
```

Expected: PASS — 5 tests passing.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors (on the modified files).

- [ ] **Step 7: Commit**

```bash
git add lib/programs/intelligence/types.ts lib/programs/intelligence/catalog-utils.ts tests/lib/intelligence/profile-scoring.test.ts
git commit -m "feat(intelligence): add IntelligenceProfile types and MUSCLE_TO_BODY_PART mapping"
```

---

## Task 3: Scoring Engine — INJURY_CONFLICT + EQUIPMENT_MISMATCH

**Files:**
- Modify: `lib/programs/intelligence/scoring.ts`

- [ ] **Step 1: Add INJURY_CONFLICT tests**

Append to `tests/lib/intelligence/profile-scoring.test.ts`:

```typescript
import { buildIntelligenceResult } from '@/lib/programs/intelligence/scoring'
import type { BuilderSession, TemplateMeta, IntelligenceProfile } from '@/lib/programs/intelligence/types'

const META: TemplateMeta = {
  goal: 'hypertrophy',
  level: 'intermediate',
  weeks: 8,
  frequency: 4,
  equipment_archetype: 'full_gym',
}

const SESSION_WITH_SHOULDER: BuilderSession = {
  name: 'Push',
  day_of_week: 1,
  exercises: [
    {
      name: 'Développé couché',
      sets: 4,
      reps: '8-10',
      rest_sec: 120,
      rir: 2,
      notes: '',
      movement_pattern: 'horizontal_push',
      equipment_required: ['barre'],
      primary_muscles: ['pectoraux', 'deltoide_anterieur'],
      secondary_muscles: ['triceps'],
    },
    {
      name: 'Développé militaire',
      sets: 4,
      reps: '8-10',
      rest_sec: 120,
      rir: 2,
      notes: '',
      movement_pattern: 'vertical_push',
      equipment_required: ['barre'],
      primary_muscles: ['deltoide_anterieur', 'deltoide_lateral'],
      secondary_muscles: ['triceps'],
    },
  ],
}

describe('buildIntelligenceResult with profile', () => {
  it('emits INJURY_CONFLICT critical alert for avoid restriction', () => {
    const profile: IntelligenceProfile = {
      injuries: [{ bodyPart: 'shoulder_right', severity: 'avoid' }],
      equipment: [],
    }
    const result = buildIntelligenceResult([SESSION_WITH_SHOULDER], META, profile)
    const injuryAlerts = result.alerts.filter(a => a.code === 'INJURY_CONFLICT')
    expect(injuryAlerts.length).toBeGreaterThan(0)
    expect(injuryAlerts.some(a => a.severity === 'critical')).toBe(true)
  })

  it('emits no INJURY_CONFLICT when no matching restriction', () => {
    const profile: IntelligenceProfile = {
      injuries: [{ bodyPart: 'knee_right', severity: 'avoid' }],
      equipment: [],
    }
    const result = buildIntelligenceResult([SESSION_WITH_SHOULDER], META, profile)
    const injuryAlerts = result.alerts.filter(a => a.code === 'INJURY_CONFLICT')
    expect(injuryAlerts.length).toBe(0)
  })

  it('emits INJURY_CONFLICT with warning severity for limit restriction', () => {
    const profile: IntelligenceProfile = {
      injuries: [{ bodyPart: 'shoulder_left', severity: 'limit' }],
      equipment: [],
    }
    const result = buildIntelligenceResult([SESSION_WITH_SHOULDER], META, profile)
    const injuryAlerts = result.alerts.filter(a => a.code === 'INJURY_CONFLICT')
    expect(injuryAlerts.length).toBeGreaterThan(0)
    expect(injuryAlerts.every(a => a.severity === 'warning')).toBe(true)
  })

  it('produces same result without profile (backwards compat)', () => {
    const withoutProfile = buildIntelligenceResult([SESSION_WITH_SHOULDER], META)
    const withEmptyProfile = buildIntelligenceResult([SESSION_WITH_SHOULDER], META, { injuries: [], equipment: [] })
    expect(withoutProfile.globalScore).toBe(withEmptyProfile.globalScore)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/lib/intelligence/profile-scoring.test.ts
```

Expected: FAIL — `buildIntelligenceResult` doesn't accept a third argument yet.

- [ ] **Step 3: Update `scoreSpecificity` to accept and use `profile`**

In `lib/programs/intelligence/scoring.ts`:

**Add import at the top** (after the existing imports):
```typescript
import { resolveExerciseCoeff, normalizeMuscleSlug, muscleConflictsWithRestriction } from './catalog-utils'
import type {
  BuilderSession, BuilderExercise, TemplateMeta,
  IntelligenceAlert, IntelligenceResult, MuscleDistribution,
  PatternDistribution, SRAPoint, RedundantPair, IntelligenceProfile,
} from './types'
```

(Replace the existing two import lines with the above — `IntelligenceProfile` is the only new type added.)

**Update `scoreSpecificity` signature** (find the function at line ~361):

```typescript
export function scoreSpecificity(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
): { score: number; alerts: IntelligenceAlert[] } {
  const alerts: IntelligenceAlert[] = []
  const allExercises = sessions.flatMap(s => s.exercises)

  if (allExercises.length === 0) return { score: 100, alerts }

  // Injury conflict alerts (per exercise)
  if (profile && profile.injuries.length > 0) {
    allExercises.forEach((ex) => {
      const si = sessions.findIndex(s => s.exercises.includes(ex))
      const ei = sessions[si]?.exercises.indexOf(ex) ?? -1
      const allMuscles = [...ex.primary_muscles, ...ex.secondary_muscles]

      let worstConflict: { conflicts: true; severity: 'avoid' | 'limit' | 'monitor' } | null = null
      for (const muscle of allMuscles) {
        const conflict = muscleConflictsWithRestriction(muscle, profile.injuries)
        if (conflict) {
          const SEVERITY_ORDER: Record<string, number> = { avoid: 3, limit: 2, monitor: 1 }
          if (!worstConflict || SEVERITY_ORDER[conflict.severity] > SEVERITY_ORDER[worstConflict.severity]) {
            worstConflict = conflict
          }
        }
      }

      if (worstConflict) {
        const severityLabel = worstConflict.severity === 'avoid' ? 'évitée' : worstConflict.severity === 'limit' ? 'limitée' : 'surveillée'
        alerts.push({
          severity: worstConflict.severity === 'avoid' ? 'critical' : worstConflict.severity === 'limit' ? 'warning' : 'info',
          code: 'INJURY_CONFLICT',
          title: `Conflit blessure — ${ex.name}`,
          explanation: `Cet exercice sollicite une zone ${severityLabel} selon le profil client.`,
          suggestion: 'Voir les alternatives pour éviter cette zone musculaire.',
          sessionIndex: si >= 0 ? si : undefined,
          exerciseIndex: ei >= 0 ? ei : undefined,
        })
      }
    })
  }

  // Moyenne pondérée par stimCoeff (existing logic — unchanged)
  let totalWeight = 0, weightedSum = 0
  allExercises.forEach((ex) => {
    const coeff = getCoeff(ex)
    const specificity = exerciseSpecificityScore(ex, meta.goal)
    weightedSum += specificity * coeff
    totalWeight += coeff

    if (specificity < 0.5) {
      const si = sessions.findIndex(s => s.exercises.includes(ex))
      alerts.push({
        severity: 'warning',
        code: 'GOAL_MISMATCH',
        title: `${ex.name} — peu adapté à l'objectif "${meta.goal}"`,
        explanation: `Cet exercice (${ex.movement_pattern ?? 'pattern inconnu'}, RIR ${ex.rir}, ${ex.reps} reps) est peu aligné avec l'objectif "${meta.goal}".`,
        suggestion: 'Ajustez les paramètres (reps, RIR, repos) ou remplacez par un exercice plus spécifique.',
        sessionIndex: si,
        exerciseIndex: sessions[si]?.exercises.indexOf(ex),
      })
    }
  })

  // Penalty on score if any avoid conflicts
  const avoidConflicts = alerts.filter(a => a.code === 'INJURY_CONFLICT' && a.severity === 'critical').length
  const limitConflicts = alerts.filter(a => a.code === 'INJURY_CONFLICT' && a.severity === 'warning').length
  const avgSpecificity = totalWeight === 0 ? 0.65 : weightedSum / totalWeight
  const injuryPenalty = Math.min(40, avoidConflicts * 30 + limitConflicts * 15)
  return { score: clampScore(avgSpecificity * 100 - injuryPenalty), alerts }
}
```

- [ ] **Step 4: Update `scoreCompleteness` to filter patterns by equipment**

Replace the existing `scoreCompleteness` function:

```typescript
// Exercises available for each pattern given equipment constraints
// Maps pattern → equipment slugs that support it
const PATTERN_EQUIPMENT_REQUIREMENTS: Record<string, string[]> = {
  horizontal_push:  ['barre', 'halteres', 'machine', 'cables', 'smith'],
  vertical_push:    ['barre', 'halteres', 'machine', 'smith'],
  horizontal_pull:  ['barre', 'halteres', 'machine', 'cables', 'trx'],
  vertical_pull:    ['barre', 'halteres', 'machine', 'cables', 'trx', 'poulie'],
  squat_pattern:    ['barre', 'halteres', 'machine', 'smith', 'kettlebell'],
  hip_hinge:        ['barre', 'halteres', 'machine', 'kettlebell'],
  elbow_flexion:    ['barre', 'halteres', 'machine', 'cables', 'elastiques'],
  elbow_extension:  ['barre', 'halteres', 'machine', 'cables', 'elastiques'],
  lateral_raise:    ['halteres', 'machine', 'cables'],
  carry:            ['halteres', 'kettlebell', 'barre'],
  knee_flexion:     ['machine', 'cables'],
  calf_raise:       ['machine', 'barre', 'halteres'],
}

export function scoreCompleteness(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
): { score: number; alerts: IntelligenceAlert[]; missingPatterns: string[] } {
  const alerts: IntelligenceAlert[] = []
  const required = REQUIRED_PATTERNS[meta.goal] ?? REQUIRED_PATTERNS.maintenance
  const presentPatterns = new Set(
    sessions.flatMap(s => s.exercises.map(ex => ex.movement_pattern).filter(Boolean))
  )

  // If equipment is specified, filter out patterns that can't be done with available equipment
  const effectiveRequired = profile && profile.equipment.length > 0
    ? required.filter(pattern => {
        const needed = PATTERN_EQUIPMENT_REQUIREMENTS[pattern]
        if (!needed) return true  // unknown pattern → keep
        return needed.some(eq => profile.equipment.includes(eq))
      })
    : required

  const missing = effectiveRequired.filter(p => !presentPatterns.has(p))

  // Equipment mismatch alerts: exercises in program that need unavailable equipment
  if (profile && profile.equipment.length > 0) {
    sessions.forEach((session, si) => {
      session.exercises.forEach((ex, ei) => {
        if (ex.equipment_required.length === 0) return
        const hasEquipment = ex.equipment_required.some(eq => profile.equipment.includes(eq))
        if (!hasEquipment) {
          alerts.push({
            severity: 'warning',
            code: 'EQUIPMENT_MISMATCH',
            title: `Équipement manquant — ${ex.name}`,
            explanation: `Cet exercice nécessite : ${ex.equipment_required.join(', ')}. Équipement disponible : ${profile.equipment.join(', ')}.`,
            suggestion: 'Voir les alternatives compatibles avec l\'équipement disponible.',
            sessionIndex: si,
            exerciseIndex: ei,
          })
        }
      })
    })
  }

  const PATTERN_EXAMPLES: Record<string, string> = {
    horizontal_push: 'Développé couché',
    vertical_push: 'Développé militaire',
    horizontal_pull: 'Rowing barre',
    vertical_pull: 'Tractions',
    squat_pattern: 'Squat barre',
    hip_hinge: 'Soulevé de terre',
    elbow_flexion: 'Curl haltères',
    elbow_extension: 'Extension triceps overhead',
    lateral_raise: 'Élévation latérale',
    carry: 'Marche du fermier',
    knee_flexion: 'Leg curl',
    calf_raise: 'Extension mollets',
  }

  missing.forEach(pattern => {
    alerts.push({
      severity: 'warning',
      code: 'MISSING_PATTERN',
      title: `Pattern manquant : ${pattern.replace(/_/g, ' ')}`,
      explanation: `L'objectif "${meta.goal}" recommande d'inclure des exercices de type ${pattern.replace(/_/g, ' ')}.`,
      suggestion: `Exemple : ${PATTERN_EXAMPLES[pattern] ?? 'exercice de ce pattern'}.`,
    })
  })

  const score = effectiveRequired.length === 0
    ? 100
    : clampScore(((effectiveRequired.length - missing.length) / effectiveRequired.length) * 100)

  return { score, alerts, missingPatterns: missing }
}
```

- [ ] **Step 5: Update `buildIntelligenceResult` to pass `profile` through**

Replace the `buildIntelligenceResult` function signature and internal calls:

```typescript
export function buildIntelligenceResult(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
): IntelligenceResult {
  if (sessions.length === 0 || sessions.every(s => s.exercises.length === 0)) {
    return {
      globalScore: 0,
      globalNarrative: "Ajoutez des exercices pour voir l'analyse.",
      subscores: { balance: 0, recovery: 0, specificity: 0, progression: 0, completeness: 0, redundancy: 0 },
      alerts: [],
      distribution: {},
      patternDistribution: { push: 0, pull: 0, legs: 0, core: 0 },
      missingPatterns: [],
      redundantPairs: [],
      sraMap: [],
    }
  }

  const balanceResult = scoreBalance(sessions, meta)
  const sraResult = scoreSRA(sessions, meta)
  const redundancyResult = scoreRedundancy(sessions)
  const progressionResult = scoreProgression(sessions, meta)
  const specificityResult = scoreSpecificity(sessions, meta, profile)     // ← profile added
  const completenessResult = scoreCompleteness(sessions, meta, profile)   // ← profile added

  // ... rest of the function unchanged
```

(Only the two `scoreSpecificity` and `scoreCompleteness` calls change — add `, profile` as the third argument. Everything else in the function body stays identical.)

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run tests/lib/intelligence/profile-scoring.test.ts
```

Expected: PASS — all tests passing (existing 32 + new tests).

- [ ] **Step 7: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add lib/programs/intelligence/scoring.ts tests/lib/intelligence/profile-scoring.test.ts
git commit -m "feat(intelligence): add INJURY_CONFLICT and EQUIPMENT_MISMATCH scoring with IntelligenceProfile"
```

---

## Task 4: Update `useProgramIntelligence` + Export Types

**Files:**
- Modify: `lib/programs/intelligence/index.ts`

- [ ] **Step 1: Update `index.ts`**

Replace the entire file content:

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { buildIntelligenceResult } from './scoring'
import type { BuilderSession, TemplateMeta, IntelligenceResult, IntelligenceAlert, BuilderExercise, IntelligenceProfile } from './types'

export type { IntelligenceResult, IntelligenceAlert, BuilderSession, TemplateMeta, BuilderExercise, IntelligenceProfile }
export { scoreAlternatives } from './alternatives'
export type { AlternativeScore } from './alternatives'
export { resolveExerciseCoeff } from './catalog-utils'

const EMPTY_RESULT: IntelligenceResult = {
  globalScore: 0,
  globalNarrative: "Ajoutez des exercices pour voir l'analyse.",
  subscores: { balance: 0, recovery: 0, specificity: 0, progression: 0, completeness: 0, redundancy: 0 },
  alerts: [],
  distribution: {},
  patternDistribution: { push: 0, pull: 0, legs: 0, core: 0 },
  missingPatterns: [],
  redundantPairs: [],
  sraMap: [],
}

export function useProgramIntelligence(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
): {
  result: IntelligenceResult
  alertsFor: (sessionIdx: number, exerciseIdx: number) => IntelligenceAlert[]
} {
  const [result, setResult] = useState<IntelligenceResult>(EMPTY_RESULT)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      const next = buildIntelligenceResult(sessions, meta, profile)
      setResult(next)
    }, 400)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [sessions, meta, profile])

  function alertsFor(sessionIdx: number, exerciseIdx: number): IntelligenceAlert[] {
    return result.alerts.filter(
      a => a.sessionIndex === sessionIdx && a.exerciseIndex === exerciseIdx,
    )
  }

  return { result, alertsFor }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/programs/intelligence/index.ts
git commit -m "feat(intelligence): export IntelligenceProfile, add profile param to useProgramIntelligence"
```

---

## Task 5: API Route — `intelligence-profile` endpoint

**Files:**
- Create: `app/api/clients/[clientId]/intelligence-profile/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/clients/[clientId]/intelligence-profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { IntelligenceProfile } from '@/lib/programs/intelligence/types'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { clientId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()

  // Verify ownership
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id, training_goal, fitness_level, equipment')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!clientRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch injury annotations
  const { data: annotations } = await db
    .from('metric_annotations')
    .select('id, label, body, body_part, severity, event_date')
    .eq('client_id', clientId)
    .eq('event_type', 'injury')
    .not('body_part', 'is', null)
    .order('event_date', { ascending: false })

  const profile: IntelligenceProfile = {
    injuries: (annotations ?? []).map(a => ({
      bodyPart: a.body_part as string,
      severity: a.severity as 'avoid' | 'limit' | 'monitor',
      label: a.label,
      note: a.body ?? undefined,
    })),
    equipment: (clientRow.equipment as string[]) ?? [],
    fitnessLevel: clientRow.fitness_level ?? undefined,
    goal: clientRow.training_goal ?? undefined,
  }

  return NextResponse.json(profile)
}
```

- [ ] **Step 2: Update annotations POST schema to include `body_part` and `severity`**

In `app/api/clients/[clientId]/annotations/route.ts`, replace `createSchema`:

```typescript
const createSchema = z.object({
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().min(1).max(200),
  body: z.string().max(5000).nullable().optional(),
  event_type: z.enum(['program_change', 'injury', 'travel', 'nutrition', 'note', 'lab_protocol']),
  body_part: z.string().max(50).optional().nullable(),
  severity: z.enum(['avoid', 'limit', 'monitor']).optional().nullable(),
})
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/clients/[clientId]/intelligence-profile/route.ts app/api/clients/[clientId]/annotations/route.ts
git commit -m "feat(api): add intelligence-profile endpoint, extend annotations schema with body_part/severity"
```

---

## Task 6: Client Restrictions API

**Files:**
- Create: `app/api/client/restrictions/route.ts`
- Create: `app/api/client/restrictions/[annotationId]/route.ts`

- [ ] **Step 1: Create client restrictions GET + POST route**

```typescript
// app/api/client/restrictions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const createSchema = z.object({
  bodyPart: z.string().min(1).max(50),
  severity: z.enum(['avoid', 'limit', 'monitor']),
  label: z.string().min(1).max(200),
  note: z.string().max(5000).optional().nullable(),
  annotationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function GET(_req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()

  // Resolve client_id from auth user
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { data, error } = await db
    .from('metric_annotations')
    .select('id, label, body, body_part, severity, event_date')
    .eq('client_id', clientRow.id)
    .eq('event_type', 'injury')
    .not('body_part', 'is', null)
    .order('event_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = createSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.issues.map(i => i.message).join(', ') }, { status: 400 })

  const db = serviceClient()

  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await db
    .from('metric_annotations')
    .insert({
      client_id: clientRow.id,
      event_type: 'injury',
      label: body.data.label,
      body: body.data.note ?? null,
      body_part: body.data.bodyPart,
      severity: body.data.severity,
      event_date: body.data.annotationDate ?? today,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Create client restrictions DELETE route**

```typescript
// app/api/client/restrictions/[annotationId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ annotationId: string }> }
) {
  const { annotationId } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()

  // Resolve client_id and verify ownership via user_id
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { error } = await db
    .from('metric_annotations')
    .delete()
    .eq('id', annotationId)
    .eq('client_id', clientRow.id)
    .eq('event_type', 'injury')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/client/restrictions/route.ts app/api/client/restrictions/[annotationId]/route.ts
git commit -m "feat(api): add client restrictions endpoints (GET/POST/DELETE)"
```

---

## Task 7: `RestrictionsWidget` — Coach UI

**Files:**
- Create: `components/clients/RestrictionsWidget.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/clients/RestrictionsWidget.tsx
'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, AlertTriangle, Eye, Shield } from 'lucide-react'

interface Restriction {
  id: string
  label: string
  body_part: string
  severity: 'avoid' | 'limit' | 'monitor'
  event_date: string
  body?: string | null
}

const BODY_PART_LABELS: Record<string, string> = {
  shoulder_right: 'Épaule droite',
  shoulder_left:  'Épaule gauche',
  elbow_right:    'Coude droit',
  elbow_left:     'Coude gauche',
  wrist_right:    'Poignet droit',
  wrist_left:     'Poignet gauche',
  knee_right:     'Genou droit',
  knee_left:      'Genou gauche',
  hip_right:      'Hanche droite',
  hip_left:       'Hanche gauche',
  lower_back:     'Bas du dos',
  upper_back:     'Haut du dos',
  neck:           'Nuque / cou',
  ankle_right:    'Cheville droite',
  ankle_left:     'Cheville gauche',
}

const SEVERITY_CONFIG = {
  avoid:   { label: 'Éviter',     bg: 'bg-red-500/10',   text: 'text-red-400',   border: 'border-red-500/20' },
  limit:   { label: 'Limiter',    bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  monitor: { label: 'Surveiller', bg: 'bg-white/[0.04]', text: 'text-white/50',  border: 'border-white/[0.06]' },
}

const EQUIPMENT_OPTIONS = [
  { slug: 'barre',      label: 'Barre' },
  { slug: 'halteres',   label: 'Haltères' },
  { slug: 'machine',    label: 'Machine' },
  { slug: 'cables',     label: 'Câbles' },
  { slug: 'kettlebell', label: 'Kettlebell' },
  { slug: 'smith',      label: 'Smith machine' },
  { slug: 'trx',        label: 'TRX / Suspension' },
  { slug: 'elastiques', label: 'Élastiques' },
  { slug: 'poulie',     label: 'Poulie haute' },
]

interface Props {
  clientId: string
}

export default function RestrictionsWidget({ clientId }: Props) {
  const [restrictions, setRestrictions] = useState<Restriction[]>([])
  const [equipment, setEquipment] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formBodyPart, setFormBodyPart] = useState('')
  const [formSeverity, setFormSeverity] = useState<'avoid' | 'limit' | 'monitor'>('avoid')
  const [formLabel, setFormLabel] = useState('')
  const [formNote, setFormNote] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetch(`/api/clients/${clientId}/intelligence-profile`)
      .then(r => r.json())
      .then(data => {
        setRestrictions(data.injuries?.map((inj: any) => ({
          id: inj.id ?? Math.random().toString(),
          label: inj.label,
          body_part: inj.bodyPart,
          severity: inj.severity,
          event_date: inj.annotationDate ?? '',
          body: inj.note,
        })) ?? [])
        setEquipment(data.equipment ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  async function handleAdd() {
    if (!formBodyPart || !formLabel) return
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'injury',
        event_date: formDate,
        label: formLabel,
        body: formNote || null,
        body_part: formBodyPart,
        severity: formSeverity,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setRestrictions(prev => [...prev, {
        id: created.id,
        label: created.label,
        body_part: created.body_part,
        severity: created.severity,
        event_date: created.event_date,
        body: created.body,
      }])
      setShowForm(false)
      setFormBodyPart('')
      setFormLabel('')
      setFormNote('')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/clients/${clientId}/annotations/${id}`, { method: 'DELETE' })
    setRestrictions(prev => prev.filter(r => r.id !== id))
  }

  async function handleEquipmentToggle(slug: string) {
    const next = equipment.includes(slug)
      ? equipment.filter(e => e !== slug)
      : [...equipment, slug]
    setEquipment(next)
    await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equipment: next }),
    })
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Restrictions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Restrictions physiques</p>
          <button
            type="button"
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-[#1f8a65] hover:opacity-80 transition-opacity"
          >
            <Plus size={12} />
            Ajouter
          </button>
        </div>

        {restrictions.length === 0 && !showForm && (
          <p className="text-[12px] text-white/30 py-2">Aucune restriction enregistrée.</p>
        )}

        <div className="flex flex-col gap-2">
          {restrictions.map(r => {
            const cfg = SEVERITY_CONFIG[r.severity]
            return (
              <div key={r.id} className={`flex items-start gap-3 rounded-xl border ${cfg.border} ${cfg.bg} px-3 py-2.5`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold text-white">{BODY_PART_LABELS[r.body_part] ?? r.body_part}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  <p className="text-[11px] text-white/50 mt-0.5">{r.label}</p>
                  {r.body && <p className="text-[10px] text-white/30 mt-0.5 italic">{r.body}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="text-white/20 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>

        {showForm && (
          <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 flex flex-col gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Zone</label>
              <select
                value={formBodyPart}
                onChange={e => setFormBodyPart(e.target.value)}
                className="w-full rounded-xl bg-[#0a0a0a] px-3 h-10 text-[13px] text-white outline-none border-none"
              >
                <option value="">Sélectionner…</option>
                {Object.entries(BODY_PART_LABELS).map(([slug, label]) => (
                  <option key={slug} value={slug}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Niveau</label>
              <div className="flex gap-2">
                {(['avoid', 'limit', 'monitor'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFormSeverity(s)}
                    className={`flex-1 h-8 rounded-lg text-[10px] font-bold transition-colors ${formSeverity === s ? `${SEVERITY_CONFIG[s].bg} ${SEVERITY_CONFIG[s].text} border ${SEVERITY_CONFIG[s].border}` : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06]'}`}
                  >
                    {SEVERITY_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Label</label>
              <input
                value={formLabel}
                onChange={e => setFormLabel(e.target.value)}
                placeholder="ex: Tendinite rotateurs"
                className="w-full rounded-xl bg-[#0a0a0a] px-3 h-10 text-[13px] text-white placeholder:text-white/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Note (optionnel)</label>
              <textarea
                value={formNote}
                onChange={e => setFormNote(e.target.value)}
                placeholder="Détails, contexte…"
                rows={2}
                className="w-full rounded-xl bg-[#0a0a0a] px-3 py-2 text-[13px] text-white placeholder:text-white/20 outline-none resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 h-9 rounded-xl bg-white/[0.04] text-[12px] text-white/50 hover:text-white/70 transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!formBodyPart || !formLabel || saving}
                className="flex-1 h-9 rounded-xl bg-[#1f8a65] text-[12px] font-bold text-white hover:bg-[#217356] disabled:opacity-50 transition-colors"
              >
                {saving ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Equipment */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40 mb-3">Équipement disponible</p>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map(eq => {
            const active = equipment.includes(eq.slug)
            return (
              <button
                key={eq.slug}
                type="button"
                onClick={() => handleEquipmentToggle(eq.slug)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${active ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.02] text-white/35 hover:bg-white/[0.05] hover:text-white/60'}`}
              >
                {eq.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/clients/RestrictionsWidget.tsx
git commit -m "feat(ui): add RestrictionsWidget for coach client page"
```

---

## Task 8: `ClientRestrictionsSection` — Client UI

**Files:**
- Create: `components/client/ClientRestrictionsSection.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/client/ClientRestrictionsSection.tsx
'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface Restriction {
  id: string
  label: string
  body_part: string
  severity: 'avoid' | 'limit' | 'monitor'
  event_date: string
  body?: string | null
}

const BODY_PART_LABELS: Record<string, string> = {
  shoulder_right: 'Épaule droite',
  shoulder_left:  'Épaule gauche',
  elbow_right:    'Coude droit',
  elbow_left:     'Coude gauche',
  wrist_right:    'Poignet droit',
  wrist_left:     'Poignet gauche',
  knee_right:     'Genou droit',
  knee_left:      'Genou gauche',
  hip_right:      'Hanche droite',
  hip_left:       'Hanche gauche',
  lower_back:     'Bas du dos',
  upper_back:     'Haut du dos',
  neck:           'Nuque / cou',
  ankle_right:    'Cheville droite',
  ankle_left:     'Cheville gauche',
}

// Client-friendly labels for severity levels
const SEVERITY_PROMPTS = [
  { value: 'avoid'   as const, label: 'Je ne peux pas faire…', desc: "Exercice à éviter complètement" },
  { value: 'limit'   as const, label: "J'ai des douleurs à…",  desc: 'À surveiller, charge réduite' },
  { value: 'monitor' as const, label: 'Je surveille…',          desc: 'Pas de douleur mais attention' },
]

const SEVERITY_CONFIG = {
  avoid:   { label: 'À éviter',     bg: 'bg-red-500/10',   text: 'text-red-400',   border: 'border-red-500/20' },
  limit:   { label: 'Douleurs',     bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  monitor: { label: 'Surveillance', bg: 'bg-white/[0.04]', text: 'text-white/50',  border: 'border-white/[0.06]' },
}

export default function ClientRestrictionsSection() {
  const [restrictions, setRestrictions] = useState<Restriction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formBodyPart, setFormBodyPart] = useState('')
  const [formSeverity, setFormSeverity] = useState<'avoid' | 'limit' | 'monitor'>('avoid')
  const [formLabel, setFormLabel] = useState('')
  const [formNote, setFormNote] = useState('')

  useEffect(() => {
    fetch('/api/client/restrictions')
      .then(r => r.ok ? r.json() : [])
      .then(data => setRestrictions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd() {
    if (!formBodyPart) return
    const autoLabel = `${BODY_PART_LABELS[formBodyPart] ?? formBodyPart} — ${SEVERITY_PROMPTS.find(s => s.value === formSeverity)?.label ?? ''}`
    setSaving(true)
    const res = await fetch('/api/client/restrictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bodyPart: formBodyPart,
        severity: formSeverity,
        label: formLabel || autoLabel,
        note: formNote || null,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setRestrictions(prev => [...prev, {
        id: created.id,
        label: created.label,
        body_part: created.body_part,
        severity: created.severity,
        event_date: created.event_date,
        body: created.body,
      }])
      setShowForm(false)
      setFormBodyPart('')
      setFormLabel('')
      setFormNote('')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/client/restrictions/${id}`, { method: 'DELETE' })
    setRestrictions(prev => prev.filter(r => r.id !== id))
  }

  return (
    <section className="flex flex-col gap-3">
      {/* Section separator */}
      <div className="h-px bg-white/[0.07]" />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Restrictions physiques</p>
          <p className="text-[12px] text-white/40 mt-0.5">Zones à éviter ou surveiller lors des entraînements</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/[0.04] text-[11px] font-semibold text-white/60 hover:bg-white/[0.07] hover:text-white transition-colors"
        >
          <Plus size={12} />
          Ajouter
        </button>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />)}
        </div>
      )}

      {!loading && restrictions.length === 0 && !showForm && (
        <p className="text-[12px] text-white/30 py-1">Aucune restriction enregistrée.</p>
      )}

      {!loading && (
        <div className="flex flex-col gap-2">
          {restrictions.map(r => {
            const cfg = SEVERITY_CONFIG[r.severity]
            return (
              <div key={r.id} className={`flex items-start gap-3 rounded-xl border ${cfg.border} ${cfg.bg} px-3 py-2.5`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold text-white">{BODY_PART_LABELS[r.body_part] ?? r.body_part}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                  </div>
                  {r.body && <p className="text-[10px] text-white/30 mt-0.5 italic">{r.body}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="text-white/20 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 flex flex-col gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Zone concernée</label>
            <select
              value={formBodyPart}
              onChange={e => setFormBodyPart(e.target.value)}
              className="w-full rounded-xl bg-[#0a0a0a] px-3 h-10 text-[13px] text-white outline-none border-none"
            >
              <option value="">Sélectionner…</option>
              {Object.entries(BODY_PART_LABELS).map(([slug, label]) => (
                <option key={slug} value={slug}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Situation</label>
            <div className="flex flex-col gap-1.5">
              {SEVERITY_PROMPTS.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setFormSeverity(s.value)}
                  className={`flex items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors ${formSeverity === s.value ? 'bg-[#1f8a65]/10 border border-[#1f8a65]/20' : 'bg-white/[0.02] border border-transparent hover:bg-white/[0.04]'}`}
                >
                  <div className={`w-3 h-3 rounded-full mt-0.5 shrink-0 border ${formSeverity === s.value ? 'bg-[#1f8a65] border-[#1f8a65]' : 'border-white/20'}`} />
                  <div>
                    <p className={`text-[12px] font-semibold ${formSeverity === s.value ? 'text-[#1f8a65]' : 'text-white/70'}`}>{s.label}</p>
                    <p className="text-[10px] text-white/30">{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Précision (optionnel)</label>
            <textarea
              value={formNote}
              onChange={e => setFormNote(e.target.value)}
              placeholder="ex: douleur en rotation externe, pas de charge lourde…"
              rows={2}
              className="w-full rounded-xl bg-[#0a0a0a] px-3 py-2 text-[13px] text-white placeholder:text-white/20 outline-none resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 h-9 rounded-xl bg-white/[0.04] text-[12px] text-white/50 hover:text-white/70 font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!formBodyPart || saving}
              className="flex-1 h-9 rounded-xl bg-[#1f8a65] text-[12px] font-bold text-white hover:bg-[#217356] disabled:opacity-50 transition-colors"
            >
              {saving ? '…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/client/ClientRestrictionsSection.tsx
git commit -m "feat(ui): add ClientRestrictionsSection for client profil page"
```

---

## Task 9: Wire UI into Pages

**Files:**
- Modify: `app/client/profil/page.tsx`
- Modify: `app/coach/clients/[clientId]/page.tsx`

- [ ] **Step 1: Add `ClientRestrictionsSection` to client profil page**

In `app/client/profil/page.tsx`, find the `<Section title={ct(lang, 'profil.section.info')} icon="👤">` block. After its closing `</Section>` tag and before the next `<Section>`, insert:

```tsx
{/* ── Restrictions physiques ── */}
<Section title="Restrictions physiques" icon="🚫">
  <ClientRestrictionsSection />
</Section>
```

Add the import at the top of the file:
```tsx
import ClientRestrictionsSection from '@/components/client/ClientRestrictionsSection'
```

Note: The `Section` component is defined at the bottom of `app/client/profil/page.tsx`. It accepts `title`, `icon`, and optional `badge` props.

- [ ] **Step 2: Add `RestrictionsWidget` to coach client profil tab**

In `app/coach/clients/[clientId]/page.tsx`, find the section that renders when `tab === 'profil'`. Search for `"Zone dangereuse"` (the `DeleteClientModal` trigger section). Above it, add:

```tsx
{/* Restrictions */}
<div className="mt-4">
  <RestrictionsWidget clientId={clientId} />
</div>
```

Add the import at the top of the file:
```tsx
import RestrictionsWidget from '@/components/clients/RestrictionsWidget'
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/client/profil/page.tsx app/coach/clients/[clientId]/page.tsx
git commit -m "feat(ui): integrate RestrictionsWidget and ClientRestrictionsSection into profile pages"
```

---

## Task 10: Wire Profile into ProgramTemplateBuilder

**Files:**
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

- [ ] **Step 1: Add `clientId` prop and profile fetch**

In `components/programs/ProgramTemplateBuilder.tsx`:

**Find the `Props` interface** (or wherever the component props are defined) and add:
```typescript
clientId?: string
```

**Find the component body** — add a new state and effect after the existing state declarations:

```typescript
const [intelligenceProfile, setIntelligenceProfile] = useState<import('@/lib/programs/intelligence').IntelligenceProfile | undefined>(undefined)

useEffect(() => {
  if (!props.clientId) return
  fetch(`/api/clients/${props.clientId}/intelligence-profile`)
    .then(r => r.ok ? r.json() : null)
    .then(data => { if (data) setIntelligenceProfile(data) })
    .catch(() => {})
}, [props.clientId])
```

**Find the `useProgramIntelligence` call** and add the profile:
```typescript
const { result, alertsFor } = useProgramIntelligence(intelligenceSessions, intelligenceMeta, intelligenceProfile)
```

**Find the ProgramIntelligencePanel render** (inside the JSX) and add a "Profil appliqué" chip when a profile is active. Find the panel header area and add:
```tsx
{intelligenceProfile && (intelligenceProfile.injuries.length > 0 || intelligenceProfile.equipment.length > 0) && (
  <div className="flex items-center gap-1 mb-2">
    <span className="text-[10px] font-semibold text-[#1f8a65] bg-[#1f8a65]/10 px-2 py-0.5 rounded-full">
      Profil client appliqué
    </span>
  </div>
)}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(builder): add clientId prop, fetch and apply IntelligenceProfile to scoring"
```

---

## Task 11: CHANGELOG + project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Update CHANGELOG.md**

Add at the top under today's date `## 2026-04-18`:

```
SCHEMA: Add body_part/severity to metric_annotations, equipment to coach_clients
FEATURE: Add intelligence-profile API endpoint aggregating injuries + equipment
FEATURE: Add client restrictions API routes (GET/POST/DELETE /api/client/restrictions)
FEATURE: Extend annotations POST schema with body_part and severity fields
FEATURE: Add IntelligenceProfile types and MUSCLE_TO_BODY_PART mapping to catalog-utils
FEATURE: Score INJURY_CONFLICT alerts (critical/warning/info) in scoreSpecificity
FEATURE: Score EQUIPMENT_MISMATCH alerts and filter required patterns in scoreCompleteness
FEATURE: Add profile param to useProgramIntelligence and buildIntelligenceResult
FEATURE: RestrictionsWidget — coach-facing injury restrictions + equipment selector
FEATURE: ClientRestrictionsSection — client-facing restrictions in profil page
FEATURE: Wire RestrictionsWidget into /coach/clients/[clientId] profil tab
FEATURE: Wire ClientRestrictionsSection into /client/profil page
FEATURE: Wire IntelligenceProfile into ProgramTemplateBuilder via clientId prop
```

- [ ] **Step 2: Update project-state.md**

Add a new section `## 2026-04-18 — Program Intelligence Phase 2A` at the top (after the header) with:
- Files created/modified
- Key behaviors: INJURY_CONFLICT alert codes, equipment filter, severity semantics
- Points de vigilance: `pectoraux` and `abdos` map to no body_part (chest/abs not in vocabulary), `coach_clients.user_id` is the link for client auth, `intelligence-profile` endpoint requires `body_part IS NOT NULL` filter
- Next Steps for Phase 2B (supersets, predictions)

- [ ] **Step 3: TypeScript final check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for Program Intelligence Phase 2A"
```

---

## Self-Review

**Spec coverage check:**
- ✅ DB migration: Task 1
- ✅ `InjuryRestriction` + `IntelligenceProfile` types: Task 2
- ✅ `MUSCLE_TO_BODY_PART` mapping: Task 2
- ✅ `muscleConflictsWithRestriction` helper + tests: Task 2
- ✅ `INJURY_CONFLICT` scoring in `scoreSpecificity`: Task 3
- ✅ `EQUIPMENT_MISMATCH` scoring in `scoreCompleteness`: Task 3
- ✅ `buildIntelligenceResult(sessions, meta, profile?)`: Task 3
- ✅ `useProgramIntelligence(sessions, meta, profile?)`: Task 4
- ✅ `GET /api/clients/[clientId]/intelligence-profile`: Task 5
- ✅ Extended annotations schema (`body_part`, `severity`): Task 5
- ✅ `GET/POST /api/client/restrictions`: Task 6
- ✅ `DELETE /api/client/restrictions/[annotationId]`: Task 6
- ✅ `RestrictionsWidget` (coach): Task 7
- ✅ `ClientRestrictionsSection` (client): Task 8
- ✅ Integration into `/client/profil`: Task 9
- ✅ Integration into `/coach/clients/[clientId]`: Task 9
- ✅ `ProgramTemplateBuilder` `clientId` prop + profile chip: Task 10
- ✅ CHANGELOG + project-state: Task 11

**Placeholder scan:** None found.

**Type consistency:**
- `IntelligenceProfile` defined in Task 2 (types.ts), imported in Tasks 3, 4, 5, 6, 7, 8, 10 ✅
- `InjuryRestriction` defined in Task 2, used in Task 2 tests ✅
- `muscleConflictsWithRestriction` defined in Task 2, called in Task 3 `scoreSpecificity` ✅
- `buildIntelligenceResult` third param `profile?` added in Task 3, consumed by Task 4 ✅
- `RestrictionsWidget` `clientId: string` prop in Task 7, used in Task 9 ✅
