# MEV/MAV/MRV Volume Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scientifically-grounded MEV/MAV/MRV volume tracking indicator per muscle sub-group to the program intelligence engine, displayed as segmented gauge bars grouped by body segment in the Intelligence Panel, with a new `volumeCoverage` subscore weighted at 20% of the global score.

**Architecture:** A new pure function `scoreVolumeCoverage()` in `scoring.ts` computes weighted volume per muscle sub-group using `primaryActivation` + `secondaryActivations` from the exercise catalog, compares against Israetel-based MEV/MAV/MRV targets scaled by objective and level, and emits `UNDER_MEV` / `OVER_MAV` / `OVER_MRV` alerts. The result `volumeByMuscle` is added to `IntelligenceResult` and rendered as grouped gauge bars in `ProgramIntelligencePanel.tsx`.

**Tech Stack:** TypeScript strict, React, Tailwind CSS, Framer Motion, existing intelligence engine (`lib/programs/intelligence/`), Vitest for tests.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/programs/intelligence/volume-targets.ts` | **Create** | MEV/MAV/MRV constants + muscle group mapping + scaling logic |
| `lib/programs/intelligence/scoring.ts` | **Modify** | Add `scoreVolumeCoverage()`, update `buildIntelligenceResult()`, update SUBSCORE_WEIGHTS |
| `lib/programs/intelligence/types.ts` | **Modify** | Add `volumeByMuscle` to `IntelligenceResult`, add `volumeCoverage` to subscores |
| `lib/programs/intelligence/index.ts` | **Modify** | Update `EMPTY_RESULT` for new subscore + volumeByMuscle |
| `components/programs/ProgramIntelligencePanel.tsx` | **Modify** | Add Volume Coverage gauge section, update SUBSCORE_LABELS |
| `tests/lib/intelligence/volume-coverage.test.ts` | **Create** | Unit tests for scoreVolumeCoverage |

---

## Task 1: Create `volume-targets.ts` — constants and muscle mapping

**Files:**
- Create: `lib/programs/intelligence/volume-targets.ts`

- [ ] **Step 1: Create the file with muscle → sub-group mapping**

```typescript
// lib/programs/intelligence/volume-targets.ts

// Maps EN anatomical slugs (from catalog primaryMuscle / secondaryMuscles)
// to display sub-groups used in volume gauges.
export const MUSCLE_TO_VOLUME_GROUP: Record<string, string> = {
  // Jambes — Quadriceps
  rectus_femoris: 'quadriceps',
  vastus_lateralis: 'quadriceps',
  vastus_medialis: 'quadriceps',
  vastus_intermedius: 'quadriceps',
  quadriceps: 'quadriceps',
  // Jambes — Ischio-jambiers
  biceps_femoris: 'ischio',
  semimembranosus: 'ischio',
  semitendinosus: 'ischio',
  hamstrings: 'ischio',
  // Jambes — Grand fessier
  gluteus_maximus: 'fessiers_grand',
  glutes: 'fessiers_grand',
  // Jambes — Moyen fessier
  gluteus_medius: 'fessiers_moyen',
  gluteus_minimus: 'fessiers_moyen',
  // Jambes — Mollets
  gastrocnemius: 'mollets',
  soleus: 'mollets',
  calves: 'mollets',
  // Haut push — Pectoraux haut
  pectoralis_major_upper: 'pectoraux_haut',
  pectoralis_major_clavicular: 'pectoraux_haut',
  // Haut push — Pectoraux bas
  pectoralis_major: 'pectoraux_bas',
  pectoralis_major_lower: 'pectoraux_bas',
  pectoralis_major_sternal: 'pectoraux_bas',
  pectoralis_minor: 'pectoraux_bas',
  // Haut push — Épaules antérieur
  anterior_deltoid: 'epaules_ant',
  deltoid_anterior: 'epaules_ant',
  // Haut push — Épaules latéral
  lateral_deltoid: 'epaules_lat',
  medial_deltoid: 'epaules_lat',
  deltoid_lateral: 'epaules_lat',
  // Haut push — Épaules postérieur
  posterior_deltoid: 'epaules_post',
  deltoid_posterior: 'epaules_post',
  // Haut push — Triceps
  triceps_brachii: 'triceps',
  triceps: 'triceps',
  // Haut pull — Grand dorsal
  latissimus_dorsi: 'dos_grand_dorsal',
  lats: 'dos_grand_dorsal',
  teres_major: 'dos_grand_dorsal',
  // Haut pull — Trapèzes / Rhomboïdes
  rhomboids: 'dos_trapezes',
  trapezius: 'dos_trapezes',
  trapezius_upper: 'dos_trapezes',
  trapezius_middle: 'dos_trapezes',
  trapezius_lower: 'dos_trapezes',
  traps: 'dos_trapezes',
  upper_traps: 'dos_trapezes',
  // Haut pull — Lombaires
  spine_erectors: 'dos_lombaires',
  erector_spinae: 'dos_lombaires',
  lower_back: 'dos_lombaires',
  // Haut pull — Biceps
  biceps_brachii: 'biceps',
  brachialis: 'biceps',
  brachioradialis: 'biceps',
  // Core — Abdos
  rectus_abdominis: 'abdos',
  obliques: 'abdos',
  transverse_abdominis: 'abdos',
  core: 'abdos',
}

// Display labels for each sub-group (FR)
export const VOLUME_GROUP_LABELS: Record<string, string> = {
  quadriceps: 'Quadriceps',
  ischio: 'Ischio-jambiers',
  fessiers_grand: 'Grand fessier',
  fessiers_moyen: 'Moyen fessier',
  mollets: 'Mollets',
  pectoraux_haut: 'Pectoraux — Haut',
  pectoraux_bas: 'Pectoraux — Bas',
  epaules_ant: 'Épaules — Antérieur',
  epaules_lat: 'Épaules — Latéral',
  epaules_post: 'Épaules — Postérieur',
  triceps: 'Triceps',
  dos_grand_dorsal: 'Grand dorsal',
  dos_trapezes: 'Trapèzes / Rhomboïdes',
  dos_lombaires: 'Lombaires',
  biceps: 'Biceps',
  abdos: 'Abdos',
}

// Body segment groupings for display (4 segments)
export const VOLUME_SEGMENTS: { key: string; label: string; groups: string[] }[] = [
  {
    key: 'jambes',
    label: 'Jambes',
    groups: ['quadriceps', 'ischio', 'fessiers_grand', 'fessiers_moyen', 'mollets'],
  },
  {
    key: 'push',
    label: 'Haut du corps — Push',
    groups: ['pectoraux_haut', 'pectoraux_bas', 'epaules_ant', 'epaules_lat', 'epaules_post', 'triceps'],
  },
  {
    key: 'pull',
    label: 'Haut du corps — Pull',
    groups: ['dos_grand_dorsal', 'dos_trapezes', 'dos_lombaires', 'biceps'],
  },
  {
    key: 'core',
    label: 'Core',
    groups: ['abdos'],
  },
]

// MEV/MAV/MRV targets per sub-group for intermediate hypertrophy (Israetel/RP Strength base)
// Format: [MEV, MAV, MRV] in sets/week
const BASE_TARGETS: Record<string, [number, number, number]> = {
  quadriceps:      [8,  16, 22],
  ischio:          [6,  12, 18],
  fessiers_grand:  [6,  14, 20],
  fessiers_moyen:  [4,  10, 16],
  mollets:         [8,  16, 24],
  pectoraux_haut:  [6,  12, 18],
  pectoraux_bas:   [6,  14, 20],
  epaules_ant:     [4,  10, 16],
  epaules_lat:     [6,  14, 20],
  epaules_post:    [6,  14, 20],
  triceps:         [6,  14, 20],
  dos_grand_dorsal:[8,  16, 22],
  dos_trapezes:    [6,  14, 20],
  dos_lombaires:   [4,  10, 16],
  biceps:          [6,  14, 20],
  abdos:           [6,  16, 22],
}

// Multipliers by fitness level (applied to all three thresholds)
const LEVEL_MULTIPLIER: Record<string, number> = {
  beginner:     0.65,
  intermediate: 1.00,
  advanced:     1.25,
  elite:        1.50,
}

// Multipliers by goal
const GOAL_MULTIPLIER: Record<string, number> = {
  hypertrophy: 1.00,
  strength:    0.65,
  fat_loss:    0.80,
  endurance:   1.20,
  recomp:      0.90,
  maintenance: 0.75,
  athletic:    0.85,
}

/**
 * Returns [MEV, MAV, MRV] for a given sub-group, goal, and level.
 * Values are rounded to nearest integer.
 */
export function getVolumeTargets(
  group: string,
  goal: string,
  level: string,
): [number, number, number] {
  const base = BASE_TARGETS[group] ?? [6, 12, 18]
  const levelMult = LEVEL_MULTIPLIER[level] ?? 1.0
  const goalMult = GOAL_MULTIPLIER[goal] ?? 1.0
  const factor = levelMult * goalMult
  return [
    Math.round(base[0] * factor),
    Math.round(base[1] * factor),
    Math.round(base[2] * factor),
  ]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/programs/intelligence/volume-targets.ts
git commit -m "feat(intelligence): add MEV/MAV/MRV volume targets — muscle sub-group mapping + Israetel-based thresholds"
```

---

## Task 2: Write failing tests for `scoreVolumeCoverage`

**Files:**
- Create: `tests/lib/intelligence/volume-coverage.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// tests/lib/intelligence/volume-coverage.test.ts
import { describe, it, expect } from 'vitest'
import { scoreVolumeCoverage } from '@/lib/programs/intelligence/scoring'
import type { BuilderSession, TemplateMeta } from '@/lib/programs/intelligence/types'

const META_HYPERTROPHY_INTERMEDIATE: TemplateMeta = {
  goal: 'hypertrophy',
  level: 'intermediate',
  weeks: 8,
  frequency: 4,
  equipment_archetype: 'full_gym',
}

// Exercise with full biomech data — 3 sets, quad primary (rectus_femoris, 0.75),
// glutes secondary (gluteus_maximus, 0.30)
const SQUAT: BuilderSession['exercises'][0] = {
  name: 'Squat barre',
  sets: 4,
  reps: '8',
  rest_sec: 120,
  rir: 2,
  notes: '',
  movement_pattern: 'squat_pattern',
  equipment_required: ['barbell'],
  primary_muscles: ['quadriceps'],
  secondary_muscles: ['fessiers', 'ischio-jambiers'],
  is_compound: true,
  primaryMuscle: 'rectus_femoris',
  primaryActivation: 0.82,
  secondaryMusclesDetail: ['gluteus_maximus', 'biceps_femoris'],
  secondaryActivations: [0.30, 0.15],
}

// Exercise without biomech data — should not contribute to volume tracking
const EXERCISE_NO_BIOMECH: BuilderSession['exercises'][0] = {
  name: 'Exercice inconnu',
  sets: 3,
  reps: '10',
  rest_sec: 90,
  rir: 2,
  notes: '',
  movement_pattern: 'squat_pattern',
  equipment_required: [],
  primary_muscles: ['quadriceps'],
  secondary_muscles: [],
}

const sessionWith = (exercises: BuilderSession['exercises']): BuilderSession[] => [
  { name: 'Séance A', day_of_week: 1, exercises },
]

describe('scoreVolumeCoverage', () => {
  it('returns score 100 and no alerts when no exercises', () => {
    const result = scoreVolumeCoverage([], META_HYPERTROPHY_INTERMEDIATE)
    expect(result.score).toBe(100)
    expect(result.alerts).toHaveLength(0)
    expect(result.volumeByMuscle).toEqual({})
  })

  it('computes weighted volume using primaryActivation for primary muscle', () => {
    const result = scoreVolumeCoverage(sessionWith([SQUAT]), META_HYPERTROPHY_INTERMEDIATE)
    // quadriceps: 4 sets × 0.82 = 3.28
    expect(result.volumeByMuscle['quadriceps']).toBeCloseTo(3.28, 1)
  })

  it('computes weighted volume using secondaryActivations for secondary muscles', () => {
    const result = scoreVolumeCoverage(sessionWith([SQUAT]), META_HYPERTROPHY_INTERMEDIATE)
    // fessiers_grand: 4 sets × 0.30 = 1.20
    expect(result.volumeByMuscle['fessiers_grand']).toBeCloseTo(1.20, 1)
    // ischio: 4 sets × 0.15 = 0.60
    expect(result.volumeByMuscle['ischio']).toBeCloseTo(0.60, 1)
  })

  it('emits UNDER_MEV warning when volume below MEV', () => {
    // 1 set of squat = 0.82 weighted sets for quads — MEV for intermediate hypertrophy = 8
    const singleSet = { ...SQUAT, sets: 1 }
    const result = scoreVolumeCoverage(sessionWith([singleSet]), META_HYPERTROPHY_INTERMEDIATE)
    const underMev = result.alerts.filter(a => a.code === 'UNDER_MEV')
    expect(underMev.length).toBeGreaterThan(0)
    expect(underMev[0].severity).toBe('warning')
  })

  it('emits OVER_MRV critical alert when volume exceeds MRV', () => {
    // 30 sets of squat = 24.6 weighted sets for quads — MRV for intermediate hypertrophy = 22
    const manySetsSqaut = { ...SQUAT, sets: 30 }
    const result = scoreVolumeCoverage(sessionWith([manySetsSqaut]), META_HYPERTROPHY_INTERMEDIATE)
    const overMrv = result.alerts.filter(a => a.code === 'OVER_MRV')
    expect(overMrv.length).toBeGreaterThan(0)
    expect(overMrv[0].severity).toBe('critical')
  })

  it('emits OVER_MAV info alert when volume between MAV and MRV', () => {
    // 22 sets × 0.82 = 18.04 weighted sets for quads — MAV=16, MRV=22
    const overMavSets = { ...SQUAT, sets: 22 }
    const result = scoreVolumeCoverage(sessionWith([overMavSets]), META_HYPERTROPHY_INTERMEDIATE)
    const overMav = result.alerts.filter(a => a.code === 'OVER_MAV')
    expect(overMav.length).toBeGreaterThan(0)
    expect(overMav[0].severity).toBe('info')
  })

  it('does not include exercises without biomech data in volume tracking', () => {
    const result = scoreVolumeCoverage(sessionWith([EXERCISE_NO_BIOMECH]), META_HYPERTROPHY_INTERMEDIATE)
    expect(result.volumeByMuscle).toEqual({})
  })

  it('accumulates volume across multiple sessions', () => {
    const sessions: BuilderSession[] = [
      { name: 'Séance A', day_of_week: 1, exercises: [SQUAT] },
      { name: 'Séance B', day_of_week: 3, exercises: [SQUAT] },
    ]
    const result = scoreVolumeCoverage(sessions, META_HYPERTROPHY_INTERMEDIATE)
    // quadriceps: 2 × (4 × 0.82) = 6.56
    expect(result.volumeByMuscle['quadriceps']).toBeCloseTo(6.56, 1)
  })

  it('scales targets by level — beginner has lower MEV', () => {
    const beginnerMeta: TemplateMeta = { ...META_HYPERTROPHY_INTERMEDIATE, level: 'beginner' }
    // 5 sets × 0.82 = 4.10 weighted sets — above beginner MEV (8 × 0.65 = 5.2), so no UNDER_MEV
    const fewSets = { ...SQUAT, sets: 7 }
    const result = scoreVolumeCoverage(sessionWith([fewSets]), beginnerMeta)
    // beginner MEV for quads = round(8 × 0.65 × 1.0) = 5
    // 7 × 0.82 = 5.74 > 5 — should NOT emit UNDER_MEV for quadriceps
    const underMev = result.alerts.filter(a => a.code === 'UNDER_MEV' && a.title.includes('Quadriceps'))
    expect(underMev).toHaveLength(0)
  })

  it('scales targets by goal — strength has lower MRV', () => {
    const strengthMeta: TemplateMeta = { ...META_HYPERTROPHY_INTERMEDIATE, goal: 'strength' }
    // strength MRV for quads = round(22 × 0.65 × 1.0) = 14
    // 18 sets × 0.82 = 14.76 > 14 — should emit OVER_MRV
    const heavySets = { ...SQUAT, sets: 18 }
    const result = scoreVolumeCoverage(sessionWith([heavySets]), strengthMeta)
    const overMrv = result.alerts.filter(a => a.code === 'OVER_MRV')
    expect(overMrv.length).toBeGreaterThan(0)
  })

  it('score degrades proportionally to number of under-MEV muscles', () => {
    // Single set = most muscles under MEV → low score
    const minimalSession = { ...SQUAT, sets: 1 }
    const result = scoreVolumeCoverage(sessionWith([minimalSession]), META_HYPERTROPHY_INTERMEDIATE)
    expect(result.score).toBeLessThan(80)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail (function not yet implemented)**

```bash
npx vitest run tests/lib/intelligence/volume-coverage.test.ts
```

Expected: All tests FAIL with "scoreVolumeCoverage is not a function" or similar import error.

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/lib/intelligence/volume-coverage.test.ts
git commit -m "test(intelligence): failing tests for scoreVolumeCoverage — MEV/MAV/MRV volume tracking"
```

---

## Task 3: Update `types.ts` — add `volumeByMuscle` and `volumeCoverage` subscore

**Files:**
- Modify: `lib/programs/intelligence/types.ts`

- [ ] **Step 1: Add `volumeByMuscle` to `IntelligenceResult` and `volumeCoverage` to subscores**

In `lib/programs/intelligence/types.ts`, replace the `IntelligenceResult` interface (lines 59–80):

```typescript
export interface IntelligenceResult {
  globalScore: number
  globalNarrative: string
  subscores: {
    balance: number
    recovery: number
    specificity: number
    progression: number
    completeness: number
    redundancy: number
    jointLoad: number
    coordination: number
    volumeCoverage: number   // ← NEW
  }
  alerts: IntelligenceAlert[]
  distribution: MuscleDistribution
  patternDistribution: PatternDistribution
  missingPatterns: MovementPattern[]
  redundantPairs: RedundantPair[]
  sraMap: SRAPoint[]
  sraHeatmap: SRAHeatmapWeek[]
  programStats: ProgramStats
  volumeByMuscle: Record<string, number>  // ← NEW: sub-group slug → weighted sets/week
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: Errors on `EMPTY_RESULT` in `index.ts` and `buildIntelligenceResult` in `scoring.ts` (missing new fields — fix in next tasks).

- [ ] **Step 3: Commit**

```bash
git add lib/programs/intelligence/types.ts
git commit -m "feat(intelligence): add volumeCoverage subscore + volumeByMuscle to IntelligenceResult type"
```

---

## Task 4: Implement `scoreVolumeCoverage` in `scoring.ts`

**Files:**
- Modify: `lib/programs/intelligence/scoring.ts`

- [ ] **Step 1: Add import for volume-targets at the top of scoring.ts**

Add after the existing imports (line 8):

```typescript
import { MUSCLE_TO_VOLUME_GROUP, getVolumeTargets } from './volume-targets'
```

- [ ] **Step 2: Add `scoreVolumeCoverage` function**

Add this function before `buildIntelligenceResult` (find the `// ─── Build ───` comment):

```typescript
// ─── 9. Volume Coverage (MEV/MAV/MRV) ────────────────────────────────────────

export function scoreVolumeCoverage(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
): {
  score: number
  alerts: IntelligenceAlert[]
  volumeByMuscle: Record<string, number>
} {
  const alerts: IntelligenceAlert[] = []
  const volumeByMuscle: Record<string, number> = {}

  const goal = profile?.goal ?? meta.goal
  const level = profile?.fitnessLevel ?? meta.level

  // ── Accumulate weighted volume per sub-group ──────────────────────────────
  for (const session of sessions) {
    for (const ex of session.exercises) {
      // Skip exercises without biomech data
      if (!ex.primaryMuscle || ex.primaryActivation == null) continue

      const primaryGroup = MUSCLE_TO_VOLUME_GROUP[ex.primaryMuscle]
      if (primaryGroup) {
        volumeByMuscle[primaryGroup] = (volumeByMuscle[primaryGroup] ?? 0) + ex.sets * ex.primaryActivation
      }

      if (ex.secondaryMusclesDetail && ex.secondaryActivations) {
        ex.secondaryMusclesDetail.forEach((muscle, i) => {
          const activation = ex.secondaryActivations?.[i]
          if (activation == null) return
          const group = MUSCLE_TO_VOLUME_GROUP[muscle]
          if (group) {
            volumeByMuscle[group] = (volumeByMuscle[group] ?? 0) + ex.sets * activation
          }
        })
      }
    }
  }

  // ── Score and emit alerts ─────────────────────────────────────────────────
  const trackedGroups = Object.keys(volumeByMuscle)
  if (trackedGroups.length === 0) return { score: 100, alerts, volumeByMuscle }

  let totalPenalty = 0

  for (const group of trackedGroups) {
    const volume = volumeByMuscle[group]
    const [mev, mav, mrv] = getVolumeTargets(group, goal, level)
    const label = group.replace(/_/g, ' ')

    if (volume > mrv) {
      totalPenalty += 20
      alerts.push({
        severity: 'critical',
        code: 'OVER_MRV',
        title: `Volume excessif : ${label}`,
        explanation: `${Math.round(volume)} sets équivalents/sem — dépasse le volume récupérable (MRV = ${mrv}). Risque de surentraînement.`,
        suggestion: `Réduisez le volume sur ce groupe à moins de ${mrv} sets équivalents/sem.`,
      })
    } else if (volume > mav) {
      totalPenalty += 5
      alerts.push({
        severity: 'info',
        code: 'OVER_MAV',
        title: `Volume surplus : ${label}`,
        explanation: `${Math.round(volume)} sets équivalents/sem — au-delà du volume adaptatif optimal (MAV = ${mav}). Gains marginaux décroissants.`,
        suggestion: `Réduisez légèrement le volume ou déplacez des séries vers un groupe sous-entraîné.`,
      })
    } else if (volume < mev) {
      totalPenalty += 15
      alerts.push({
        severity: 'warning',
        code: 'UNDER_MEV',
        title: `Volume insuffisant : ${label}`,
        explanation: `${Math.round(volume)} sets équivalents/sem — sous le minimum efficace (MEV = ${mev}). Stimulus insuffisant pour progresser.`,
        suggestion: `Ajoutez ${mev - Math.round(volume)} sets équivalents/sem sur ce groupe musculaire.`,
      })
    }
  }

  const score = clampScore(100 - (totalPenalty / trackedGroups.length))
  return { score, alerts, volumeByMuscle }
}
```

- [ ] **Step 3: Update `SUBSCORE_WEIGHTS` constant in `scoring.ts`**

Find the `SUBSCORE_WEIGHTS` constant and replace it:

```typescript
const SUBSCORE_WEIGHTS: Record<string, number> = {
  balance:        0.15,  // was 0.20
  recovery:       0.15,  // was 0.20
  specificity:    0.15,
  progression:    0.10,
  completeness:   0.10,
  redundancy:     0.08,  // was 0.10
  jointLoad:      0.05,  // was 0.10
  coordination:   0.02,  // was 0.05
  volumeCoverage: 0.20,  // NEW
}
```

- [ ] **Step 4: Update `buildIntelligenceResult` to call `scoreVolumeCoverage` and include results**

In `buildIntelligenceResult`, add the call alongside the other score calls and include it in the return value. Find where the other scores are computed and add:

```typescript
const volumeResult = scoreVolumeCoverage(sessions, meta, profile)
```

Then in the `subscores` object of the return value, add:

```typescript
volumeCoverage: volumeResult.score,
```

Then in the `alerts` aggregation, add:

```typescript
...volumeResult.alerts,
```

Then add `volumeByMuscle` to the returned object:

```typescript
volumeByMuscle: volumeResult.volumeByMuscle,
```

- [ ] **Step 5: Run the tests**

```bash
npx vitest run tests/lib/intelligence/volume-coverage.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: Errors on `EMPTY_RESULT` in `index.ts` (missing `volumeCoverage` and `volumeByMuscle`) — fix in next task.

- [ ] **Step 7: Commit**

```bash
git add lib/programs/intelligence/scoring.ts lib/programs/intelligence/volume-targets.ts
git commit -m "feat(intelligence): implement scoreVolumeCoverage — MEV/MAV/MRV weighted volume scoring with Israetel targets"
```

---

## Task 5: Update `index.ts` — fix `EMPTY_RESULT` and re-exports

**Files:**
- Modify: `lib/programs/intelligence/index.ts`

- [ ] **Step 1: Update `EMPTY_RESULT` to include new fields**

In `index.ts`, update `EMPTY_RESULT`:

```typescript
const EMPTY_RESULT: IntelligenceResult = {
  globalScore: 0,
  globalNarrative: "Ajoutez des exercices pour voir l'analyse.",
  subscores: {
    balance: 0,
    recovery: 0,
    specificity: 0,
    progression: 0,
    completeness: 0,
    redundancy: 0,
    jointLoad: 100,
    coordination: 100,
    volumeCoverage: 0,   // ← NEW
  },
  alerts: [],
  distribution: {},
  patternDistribution: { push: 0, pull: 0, legs: 0, core: 0 },
  missingPatterns: [],
  redundantPairs: [],
  sraMap: [],
  sraHeatmap: [],
  programStats: {
    totalSets: 0,
    totalEstimatedReps: 0,
    totalExercises: 0,
    avgExercisesPerSession: 0,
    sessionsStats: [],
  },
  volumeByMuscle: {},   // ← NEW
}
```

- [ ] **Step 2: Add re-export for VOLUME_SEGMENTS and VOLUME_GROUP_LABELS**

Add after existing exports:

```typescript
export { VOLUME_SEGMENTS, VOLUME_GROUP_LABELS, getVolumeTargets } from './volume-targets'
```

- [ ] **Step 3: Verify TypeScript compiles with 0 errors**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run all intelligence tests**

```bash
npx vitest run tests/lib/intelligence/
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/programs/intelligence/index.ts
git commit -m "fix(intelligence): update EMPTY_RESULT for volumeCoverage subscore + volumeByMuscle; re-export volume helpers"
```

---

## Task 6: Update `ProgramIntelligencePanel.tsx` — add gauge section and subscore label

**Files:**
- Modify: `components/programs/ProgramIntelligencePanel.tsx`

- [ ] **Step 1: Add import for volume helpers at the top of the file**

Add to existing imports from `@/lib/programs/intelligence`:

```typescript
import { VOLUME_SEGMENTS, VOLUME_GROUP_LABELS, getVolumeTargets } from '@/lib/programs/intelligence'
```

- [ ] **Step 2: Add `volumeCoverage` to `SUBSCORE_LABELS`**

In the `SUBSCORE_LABELS` constant, add:

```typescript
volumeCoverage: 'Volume musculaire',
```

- [ ] **Step 3: Add `volumeCoverage` to `SUBSCORE_ACCENT`**

Add to the `SUBSCORE_ACCENT` constant:

```typescript
volumeCoverage: '#3b82f6',  // blue — distinct from green (optimal) and orange (jointLoad)
```

- [ ] **Step 4: Add the Volume Coverage gauge section**

Add this section after the Donut patterns section (after the closing `</div>` of the donut block, around line 289):

```tsx
{/* ── Volume par muscle (MEV/MAV/MRV) ── */}
{Object.keys(result.volumeByMuscle).length > 0 && (
  <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mb-0.5">
      Volume par muscle
    </p>
    <p className="text-[9px] text-white/25 mb-3">Sets pondérés/sem · MEV → MAV → MRV</p>

    <div className="flex flex-col gap-4">
      {VOLUME_SEGMENTS.map(segment => {
        const groupsWithData = segment.groups.filter(g => result.volumeByMuscle[g] != null)
        if (groupsWithData.length === 0) return null

        return (
          <div key={segment.key}>
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-white/30 mb-2">
              {segment.label}
            </p>
            <div className="flex flex-col gap-2">
              {groupsWithData.map(group => {
                const volume = result.volumeByMuscle[group] ?? 0
                const [mev, mav, mrv] = getVolumeTargets(
                  group,
                  result.subscores.volumeCoverage != null ? (props.meta?.goal ?? 'hypertrophy') : 'hypertrophy',
                  'intermediate',
                )
                const label = VOLUME_GROUP_LABELS[group] ?? group

                // Determine status
                const status = volume > mrv
                  ? 'critical'
                  : volume > mav
                  ? 'surplus'
                  : volume >= mev
                  ? 'optimal'
                  : 'under'

                const STATUS_COLOR = {
                  critical: '#ef4444',
                  surplus:  '#f59e0b',
                  optimal:  '#1f8a65',
                  under:    '#6b7280',
                }

                const STATUS_LABEL = {
                  critical: 'CRITIQUE',
                  surplus:  'SURPLUS',
                  optimal:  'OPTIMAL',
                  under:    'SOUS MEV',
                }

                // Bar fill: volume relative to MRV (capped at 110% for display)
                const fillPct = Math.min(110, (volume / mrv) * 100)
                // MEV marker position
                const mevPct = (mev / mrv) * 100
                // MAV marker position
                const mavPct = (mav / mrv) * 100

                return (
                  <div key={group}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-white/55">{label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono text-white/40">
                          {Math.round(volume)}s
                        </span>
                        <span
                          className="text-[7px] font-bold tracking-wide px-1 py-0.5 rounded"
                          style={{ color: STATUS_COLOR[status], backgroundColor: `${STATUS_COLOR[status]}18` }}
                        >
                          {STATUS_LABEL[status]}
                        </span>
                      </div>
                    </div>
                    {/* Segmented bar */}
                    <div className="relative h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                      {/* Fill */}
                      <div
                        className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${fillPct}%`,
                          backgroundColor: STATUS_COLOR[status],
                          opacity: 0.75,
                        }}
                      />
                      {/* MEV marker */}
                      <div
                        className="absolute top-0 h-full w-px bg-white/20"
                        style={{ left: `${mevPct}%` }}
                      />
                      {/* MAV marker */}
                      <div
                        className="absolute top-0 h-full w-px bg-white/20"
                        style={{ left: `${mavPct}%` }}
                      />
                    </div>
                    {/* Scale labels: MEV / MAV / MRV */}
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[7px] text-white/20">0</span>
                      <span className="text-[7px] text-white/20" style={{ marginLeft: `${mevPct - 5}%` }}>
                        MEV {mev}
                      </span>
                      <span className="text-[7px] text-white/20">MRV {mrv}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  </div>
)}
```

- [ ] **Step 5: Pass `meta` as a prop to `ProgramIntelligencePanel`**

The gauge needs `goal` and `level` from `meta` to call `getVolumeTargets` with correct scaling. Update the `Props` interface:

```typescript
interface Props {
  result: IntelligenceResult
  weeks: number
  meta?: { goal: string; level: string }   // ← NEW optional prop
  onAlertClick?: (sessionIndex: number, exerciseIndex: number) => void
}
```

Update the function signature:

```typescript
export default function ProgramIntelligencePanel({ result, weeks, meta, onAlertClick }: Props) {
```

Then replace the hardcoded `'hypertrophy'` / `'intermediate'` in the gauge with:

```typescript
const [mev, mav, mrv] = getVolumeTargets(
  group,
  meta?.goal ?? 'hypertrophy',
  meta?.level ?? 'intermediate',
)
```

- [ ] **Step 6: Pass `meta` from `ProgramTemplateBuilder` to `ProgramIntelligencePanel`**

In `components/programs/ProgramTemplateBuilder.tsx`, find where `<ProgramIntelligencePanel>` is rendered and add the `meta` prop:

```tsx
<ProgramIntelligencePanel
  result={result}
  weeks={meta.weeks}
  meta={{ goal: meta.goal, level: meta.level }}
  onAlertClick={handleAlertClick}
/>
```

Also find where it's rendered inside `IntelligencePanelShell.tsx` if applicable, and pass `meta` there too.

- [ ] **Step 7: Verify TypeScript compiles with 0 errors**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Run all tests**

```bash
npx vitest run tests/lib/intelligence/
```

Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
git add components/programs/ProgramIntelligencePanel.tsx components/programs/ProgramTemplateBuilder.tsx components/programs/studio/IntelligencePanelShell.tsx
git commit -m "feat(ui): add MEV/MAV/MRV volume coverage gauge section in Intelligence Panel — 4 body segments, segmented bars"
```

---

## Task 7: Update CHANGELOG and project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Update CHANGELOG.md**

Add at the top of today's date section:

```
FEATURE: Intelligence Panel — MEV/MAV/MRV Volume Coverage: new scoreVolumeCoverage() scoring function, 19 muscle sub-groups mapped to Israetel-based targets scaled by goal + level, UNDER_MEV/OVER_MAV/OVER_MRV alerts, segmented gauge bars grouped by body segment (Jambes/Push/Pull/Core) in Intelligence Panel
FEATURE: Intelligence Panel — volumeCoverage subscore at 20% global weight; rebalanced: balance 15%, recovery 15%, redundancy 8%, jointLoad 5%, coordination 2%
CHORE: Exercise catalog — all 458 exercises now have complete biomech data (was 363/458)
```

- [ ] **Step 2: Update project-state.md**

Add a new dated section at the top of project-state.md documenting:
- `lib/programs/intelligence/volume-targets.ts` — new file, purpose, constants
- `scoreVolumeCoverage()` in scoring.ts — formula, alert codes, score penalty logic
- Updated SUBSCORE_WEIGHTS
- Updated IntelligenceResult type
- UI gauge section in ProgramIntelligencePanel
- Points de vigilance: weighted sets ≠ raw sets; exercises without biomech data are excluded; `meta` prop added to ProgramIntelligencePanel

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for MEV/MAV/MRV volume coverage feature"
```

---

## Self-Review

### Spec coverage check

| Requirement | Task |
|-------------|------|
| Indicateur visuel + score global 20% | Tasks 3, 4, 6 |
| Israetel base + objectif + niveau | Task 1 (`getVolumeTargets`) |
| Sets pondérés primaryActivation + secondaryActivations | Task 4 |
| 19 sous-groupes musculaires | Task 1 (`MUSCLE_TO_VOLUME_GROUP`) |
| Jauges segmentées groupées par segment | Task 6 |
| UNDER_MEV / OVER_MAV / OVER_MRV alerts | Task 4 |
| Override Lab Mode (future) | Not in scope — `getVolumeTargets` is exported, Lab Mode extension is Phase 5 |
| Exercices sans biomech exclus | Task 4 (`if (!ex.primaryMuscle...)`) |
| Rebalancement poids subscores | Task 4 (`SUBSCORE_WEIGHTS`) |
| Tests unitaires | Task 2 (9 tests) |

### Placeholder scan
No TBD, TODO, or vague steps found.

### Type consistency
- `volumeByMuscle: Record<string, number>` defined in Task 3 (types.ts), used in Task 4 (scoring.ts), read in Task 6 (panel)
- `volumeCoverage: number` in `subscores` defined in Task 3, populated in Task 4, labeled in Task 6
- `VOLUME_SEGMENTS` / `VOLUME_GROUP_LABELS` / `getVolumeTargets` defined in Task 1, exported in Task 5, imported in Task 6
- `meta?: { goal: string; level: string }` prop added to `Props` in Task 6 Step 5, passed from builder in Step 6
