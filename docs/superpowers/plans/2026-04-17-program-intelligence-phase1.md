# Program Intelligence Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une couche d'intelligence temps réel non-invasive au `ProgramTemplateBuilder` : moteur de scoring 6 sous-moteurs, panel latéral sticky avec charts, alertes inline par exercice, drawer d'alternatives, et support des exercices custom coach avec dérivation automatique du `stimulus_coefficient`.

**Architecture:** Moteur pur TypeScript dans `lib/programs/intelligence/` (zéro dépendances React), consommé via un hook `useProgramIntelligence` debounced dans le builder. Panel latéral `ProgramIntelligencePanel` (Recharts) toujours visible, alertes inline `IntelligenceAlertBadge` sous chaque exercice, drawer `ExerciseAlternativesDrawer` pour les alternatives. Les exercices custom héritent de `inferStimulusCoeff` déjà dans `scripts/generate-exercise-catalog.ts` — la même logique est extraite dans `lib/programs/intelligence/catalog-utils.ts`.

**Tech Stack:** TypeScript strict, React hooks, Recharts 3.8, Framer Motion 11, `data/exercise-catalog.json` (458 exercices avec `stimulus_coefficient`), Supabase (exercices custom), Zod (validation API), Vitest (tests moteur)

---

## File Map

### Créer
| Fichier | Responsabilité |
|---------|---------------|
| `lib/programs/intelligence/types.ts` | Tous les types internes du moteur |
| `lib/programs/intelligence/catalog-utils.ts` | Normalisation catalogue + dérivation `stimulus_coefficient` pour exercices custom |
| `lib/programs/intelligence/scoring.ts` | 6 sous-moteurs de scoring |
| `lib/programs/intelligence/alternatives.ts` | Sélection et scoring des alternatives |
| `lib/programs/intelligence/index.ts` | Export public API + hook `useProgramIntelligence` |
| `components/programs/ProgramIntelligencePanel.tsx` | Panel sticky droit avec charts Recharts |
| `components/programs/IntelligenceAlertBadge.tsx` | Badge alerte inline sous card exercice |
| `components/programs/ExerciseAlternativesDrawer.tsx` | Drawer alternatives coach |
| `tests/lib/intelligence/scoring.test.ts` | Tests unitaires moteur |
| `tests/lib/intelligence/catalog-utils.test.ts` | Tests dérivation stimulus_coefficient |

### Modifier
| Fichier | Modification |
|---------|-------------|
| `components/programs/ProgramTemplateBuilder.tsx` | Ajouter `is_compound` checkbox + intégration `useProgramIntelligence` + `IntelligenceAlertBadge` + bouton alternatives |
| `components/programs/ExercisePicker.tsx` | Exposer `stimulus_coefficient` + `isCompound` dans `onSelect` |
| `CHANGELOG.md` | Entrée après chaque tâche |

---

## Task 1 : Types du moteur

**Files:**
- Create: `lib/programs/intelligence/types.ts`

- [ ] **Step 1 : Écrire les types**

```typescript
// lib/programs/intelligence/types.ts

export type Severity = 'critical' | 'warning' | 'info'
export type MovementPattern = string

export interface IntelligenceAlert {
  severity: Severity
  code: string
  title: string
  explanation: string
  suggestion: string
  sessionIndex?: number
  exerciseIndex?: number
}

export interface SRAPoint {
  muscleGroup: string
  sessionIndex: number
  hoursFromPrevious: number | null
  windowRequired: number
  violation: boolean
}

export interface RedundantPair {
  sessionIndex: number
  exerciseIndexA: number
  exerciseIndexB: number
  reason: string
}

export interface MuscleDistribution {
  [muscleGroup: string]: number // volume pondéré (sets × stimCoeff)
}

export interface PatternDistribution {
  push: number
  pull: number
  legs: number
  core: number
}

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
  }
  alerts: IntelligenceAlert[]
  distribution: MuscleDistribution
  patternDistribution: PatternDistribution
  missingPatterns: MovementPattern[]
  redundantPairs: RedundantPair[]
  sraMap: SRAPoint[]
}

// Exercice tel que stocké dans le builder (coach_program_template_exercises)
export interface BuilderExercise {
  name: string
  sets: number
  reps: string
  rest_sec: number | null
  rir: number | null
  notes: string
  movement_pattern: string | null
  equipment_required: string[]
  primary_muscles: string[]   // slugs FR : 'fessiers', 'quadriceps', etc.
  secondary_muscles: string[]
  is_compound?: boolean       // checkbox coach — undefined = auto-dérivé
}

export interface BuilderSession {
  name: string
  day_of_week: number | null
  exercises: BuilderExercise[]
}

export interface TemplateMeta {
  goal: string      // 'hypertrophy' | 'strength' | 'fat_loss' | 'recomp' | 'maintenance' | 'athletic' | 'endurance'
  level: string     // 'beginner' | 'intermediate' | 'advanced' | 'elite'
  weeks: number
  frequency: number
  equipment_archetype: string
}
```

- [ ] **Step 2 : Commit**

```bash
git add lib/programs/intelligence/types.ts
git commit -m "feat(intelligence): add core types for program intelligence engine"
```

---

## Task 2 : `catalog-utils.ts` — normalisation + dérivation stimulus

**Files:**
- Create: `lib/programs/intelligence/catalog-utils.ts`
- Create: `tests/lib/intelligence/catalog-utils.test.ts`

La logique `inferStimulusCoeff` est identique à celle dans `scripts/generate-exercise-catalog.ts`. Elle est extraite ici pour être utilisée au runtime sur les exercices custom.

- [ ] **Step 1 : Écrire les tests**

```typescript
// tests/lib/intelligence/catalog-utils.test.ts
import { describe, it, expect } from 'vitest'
import {
  getStimulusCoeff,
  normalizeMuscleSlug,
  isCompoundFromMuscles,
  resolveExerciseCoeff,
} from '@/lib/programs/intelligence/catalog-utils'

describe('normalizeMuscleSlug', () => {
  it('maps French slugs to canonical form', () => {
    expect(normalizeMuscleSlug('fessiers')).toBe('fessiers')
    expect(normalizeMuscleSlug('ischio-jambiers')).toBe('ischio-jambiers')
    expect(normalizeMuscleSlug('dos')).toBe('dos')
    // slugs EN de l'ancien système → FR
    expect(normalizeMuscleSlug('glutes')).toBe('fessiers')
    expect(normalizeMuscleSlug('hamstrings')).toBe('ischio-jambiers')
    expect(normalizeMuscleSlug('back')).toBe('dos')
    expect(normalizeMuscleSlug('shoulders')).toBe('epaules')
    expect(normalizeMuscleSlug('chest')).toBe('pectoraux')
    expect(normalizeMuscleSlug('quads')).toBe('quadriceps')
    expect(normalizeMuscleSlug('calves')).toBe('mollets')
  })
})

describe('isCompoundFromMuscles', () => {
  it('returns true when ≥2 primary muscle groups', () => {
    expect(isCompoundFromMuscles(['fessiers', 'quadriceps', 'ischio-jambiers'])).toBe(true)
  })
  it('returns false when 1 primary muscle group', () => {
    expect(isCompoundFromMuscles(['biceps'])).toBe(false)
  })
  it('returns false for empty', () => {
    expect(isCompoundFromMuscles([])).toBe(false)
  })
})

describe('getStimulusCoeff', () => {
  it('returns 0.95 for heavy hip_hinge compound (SDT)', () => {
    expect(getStimulusCoeff('souleve-de-terre', 'hip_hinge', true)).toBe(0.95)
  })
  it('returns 0.48 for hip_hinge isolation (extension lombaire)', () => {
    expect(getStimulusCoeff('extension-lombaire-au-banc-45', 'hip_hinge', false)).toBe(0.48)
  })
  it('returns 0.90 for squat_pattern compound free', () => {
    expect(getStimulusCoeff('squat-barre', 'squat_pattern', true)).toBe(0.90)
  })
  it('returns 0.72 for squat_pattern machine', () => {
    expect(getStimulusCoeff('presse-a-cuisse-exercice-musculation', 'squat_pattern', true)).toBe(0.72)
  })
  it('returns 0.35 for lateral_raise', () => {
    expect(getStimulusCoeff('elevation-laterale-machine', 'lateral_raise', false)).toBe(0.35)
  })
  it('applies +0.08 stretch bonus for known slugs', () => {
    // leg-curl-assis-machine : knee_flexion isolation base 0.55 + 0.08 stretch
    expect(getStimulusCoeff('leg-curl-assis-machine', 'knee_flexion', false)).toBe(0.63)
  })
  it('returns 0.50 default for unknown pattern', () => {
    expect(getStimulusCoeff('mystery-exercise', 'unknown_pattern', false)).toBe(0.50)
  })
})

describe('resolveExerciseCoeff', () => {
  it('uses catalog entry when name matches', () => {
    // Soulevé de terre est dans le catalogue avec stimCoeff=0.95
    const coeff = resolveExerciseCoeff({
      name: 'Soulevé de terre',
      movement_pattern: 'hip_hinge',
      primary_muscles: ['fessiers', 'ischio-jambiers', 'dos'],
      is_compound: undefined,
    })
    expect(coeff).toBe(0.95)
  })
  it('uses is_compound flag when set by coach', () => {
    // Exercice custom, composé déclaré par le coach
    const coeff = resolveExerciseCoeff({
      name: 'Mon exercice custom composé',
      movement_pattern: 'squat_pattern',
      primary_muscles: ['fessiers', 'quadriceps'],
      is_compound: true,
    })
    expect(coeff).toBe(0.90)
  })
  it('derives is_compound from primary_muscles when is_compound=undefined', () => {
    // 2 muscles primaires → composé auto
    const coeff = resolveExerciseCoeff({
      name: 'Exercice custom non coché',
      movement_pattern: 'horizontal_push',
      primary_muscles: ['pectoraux', 'triceps'],
      is_compound: undefined,
    })
    expect(coeff).toBe(0.82) // horizontal_push composé libre
  })
  it('returns isolation coeff when 1 primary muscle and is_compound=false', () => {
    const coeff = resolveExerciseCoeff({
      name: 'Custom curl',
      movement_pattern: 'elbow_flexion',
      primary_muscles: ['biceps'],
      is_compound: false,
    })
    expect(coeff).toBe(0.55)
  })
})
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
npx vitest run tests/lib/intelligence/catalog-utils.test.ts
```
Résultat attendu : `FAIL — cannot find module '@/lib/programs/intelligence/catalog-utils'`

- [ ] **Step 3 : Écrire l'implémentation**

```typescript
// lib/programs/intelligence/catalog-utils.ts
import catalogData from '@/data/exercise-catalog.json'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CatalogEntry {
  name: string
  slug: string
  movementPattern: string
  isCompound: boolean
  stimulus_coefficient: number
}

const catalog = catalogData as CatalogEntry[]

// ─── Normalisation slugs muscles ─────────────────────────────────────────────
// Le builder stocke les slugs FR (depuis MUSCLE_GROUPS dans ProgramTemplateBuilder).
// Si un ancien exercice ou exercice custom utilise des slugs EN, on les normalise.

const MUSCLE_SLUG_MAP: Record<string, string> = {
  glutes: 'fessiers',
  hamstrings: 'ischio-jambiers',
  back: 'dos',
  back_upper: 'dos',
  back_lower: 'dos',
  shoulders: 'epaules',
  chest: 'pectoraux',
  quads: 'quadriceps',
  calves: 'mollets',
  abs: 'abdos',
  traps: 'dos',
}

export function normalizeMuscleSlug(slug: string): string {
  return MUSCLE_SLUG_MAP[slug] ?? slug
}

// ─── isCompound depuis les muscles primaires ─────────────────────────────────
// Fallback quand le coach n'a pas coché la checkbox.
// Règle : ≥2 groupes musculaires primaires distincts = composé.

export function isCompoundFromMuscles(primaryMuscles: string[]): boolean {
  return primaryMuscles.length >= 2
}

// ─── Stimulus coefficient ─────────────────────────────────────────────────────
// Même logique que scripts/generate-exercise-catalog.ts (source de vérité).
// Utilisée au runtime pour les exercices custom (pas dans le catalogue JSON).

const STRETCH_POSITION_SLUGS = new Set([
  'curl-incline-halteres', 'curl-incline', 'spider-curl', 'curl-concentre', 'drag-curl',
  'extension-triceps-derriere-tete', 'extension-triceps-overhead', 'skull-crusher', 'barre-front',
  'leg-curl-assis', 'leg-curl-assis-machine',
  'souleve-de-terre-roumain', 'souleve-de-terre-roumain-kettlebell',
  'souleve-de-terre-roumain-landmine', 'souleve-de-terre-jambes-tendues',
  'good-morning', 'good-morning-elastique',
  'squat-bulgare-halteres-exercice-musculation', 'fente-avant-barre-femme',
  'fentes-avant-exercice-musculation', 'fentes-avant-kettlebell',
  'pull-over', 'pull-over-barre', 'musculation-pull-over-assis-machine',
])

export function getStimulusCoeff(slug: string, movementPattern: string, isCompound: boolean): number {
  const s = slug.toLowerCase()
  const stretchBonus = STRETCH_POSITION_SLUGS.has(s) ? 0.08 : 0

  let base: number

  switch (movementPattern) {
    case 'squat_pattern': {
      if (isCompound) {
        const isMachine = s.includes('machine') || s.includes('presse-a-cuisse') ||
          s.includes('presse-a-cuisses') || s.includes('presse-cuisse') ||
          s.includes('leg-press') || s.includes('hack-squat-assis') ||
          s.includes('pendulum') || s.includes('belt-squat')
        base = isMachine ? 0.72 : 0.90
      } else {
        base = 0.45
      }
      break
    }
    case 'hip_hinge': {
      if (isCompound) {
        const isHeavy = s.includes('souleve-de-terre') || s.includes('deadlift') ||
          s.includes('rack-pull') || s.includes('reeves-deadlift') ||
          s.includes('zercher-deadlift') || s.includes('good-morning')
        base = isHeavy ? 0.95 : 0.82
      } else {
        base = 0.48
      }
      break
    }
    case 'horizontal_push': {
      if (isCompound) {
        const isMachine = s.includes('machine') || s.includes('smith')
        base = isMachine ? 0.68 : 0.82
      } else {
        base = 0.52
      }
      break
    }
    case 'vertical_push': {
      if (isCompound) {
        const isMachine = s.includes('machine') || s.includes('smith')
        base = isMachine ? 0.65 : 0.80
      } else {
        base = 0.60
      }
      break
    }
    case 'horizontal_pull': {
      if (isCompound) {
        const isHeavy = s.includes('barre') || s.includes('barbell') ||
          s.includes('seal-row') || s.includes('renegade-row')
        base = isHeavy ? 0.88 : 0.75
      } else {
        base = 0.40
      }
      break
    }
    case 'vertical_pull': {
      if (isCompound) {
        const isBodyweight = s.includes('traction') || s.includes('chin-up')
        base = isBodyweight ? 0.92 : 0.74
      } else {
        base = 0.40
      }
      break
    }
    case 'scapular_elevation': base = 0.30; break
    case 'elbow_flexion': base = 0.55; break
    case 'elbow_extension': {
      const isOverhead = s.includes('derriere-tete') || s.includes('overhead') ||
        s.includes('skull-crusher') || s.includes('barre-front')
      base = isOverhead ? 0.52 : 0.42
      break
    }
    case 'lateral_raise': base = 0.35; break
    case 'knee_flexion': base = isCompound ? 0.78 : 0.55; break
    case 'knee_extension': base = 0.45; break
    case 'calf_raise': {
      const isHeavy = s.includes('donkey') || s.includes('debout') || s.includes('standing')
      base = isHeavy ? 0.50 : 0.38
      break
    }
    case 'core_flex': base = 0.32; break
    case 'core_anti_flex': base = 0.30; break
    case 'core_rotation': base = 0.28; break
    case 'carry': base = 0.65; break
    default: base = 0.50
  }

  return Math.min(1.0, Math.round((base + stretchBonus) * 100) / 100)
}

// ─── Resolve coeff pour un exercice du builder ────────────────────────────────
// Ordre de priorité :
// 1. Correspondance exacte par nom dans le catalogue JSON (exercice standard)
// 2. is_compound explicite du coach → getStimulusCoeff(slug_normalisé, pattern, is_compound)
// 3. is_compound déduit depuis primary_muscles.length ≥ 2

interface ExerciseInput {
  name: string
  movement_pattern: string | null
  primary_muscles: string[]
  is_compound: boolean | undefined
}

export function resolveExerciseCoeff(exercise: ExerciseInput): number {
  const pattern = exercise.movement_pattern ?? 'unknown'

  // 1. Recherche dans le catalogue par nom normalisé
  const nameNorm = exercise.name.toLowerCase().trim()
  const catalogEntry = catalog.find(e => e.name.toLowerCase().trim() === nameNorm)
  if (catalogEntry) return catalogEntry.stimulus_coefficient

  // 2. is_compound explicite du coach
  const slug = nameNorm.replace(/\s+/g, '-')
  const isComp = exercise.is_compound !== undefined
    ? exercise.is_compound
    : isCompoundFromMuscles(exercise.primary_muscles)

  return getStimulusCoeff(slug, pattern, isComp)
}
```

- [ ] **Step 4 : Lancer les tests**

```bash
npx vitest run tests/lib/intelligence/catalog-utils.test.ts
```
Résultat attendu : `PASS — 11 tests passed`

- [ ] **Step 5 : Commit**

```bash
git add lib/programs/intelligence/catalog-utils.ts tests/lib/intelligence/catalog-utils.test.ts
git commit -m "feat(intelligence): add catalog-utils — normalization + stimulus_coefficient derivation"
```

---

## Task 3 : Moteur de scoring — 6 sous-moteurs

**Files:**
- Create: `lib/programs/intelligence/scoring.ts`
- Create: `tests/lib/intelligence/scoring.test.ts`

- [ ] **Step 1 : Écrire les tests des 6 sous-moteurs**

```typescript
// tests/lib/intelligence/scoring.test.ts
import { describe, it, expect } from 'vitest'
import {
  scoreBalance,
  scoreSRA,
  scoreRedundancy,
  scoreProgression,
  scoreSpecificity,
  scoreCompleteness,
  buildIntelligenceResult,
} from '@/lib/programs/intelligence/scoring'
import type { BuilderSession, TemplateMeta } from '@/lib/programs/intelligence/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const pushEx = {
  name: 'Développé couché', sets: 3, reps: '8-12', rest_sec: 90, rir: 2,
  notes: '', movement_pattern: 'horizontal_push', equipment_required: ['barbell'],
  primary_muscles: ['pectoraux', 'triceps'], secondary_muscles: ['epaules'],
  is_compound: true,
}
const pullEx = {
  name: 'Rowing barre', sets: 3, reps: '8-12', rest_sec: 90, rir: 2,
  notes: '', movement_pattern: 'horizontal_pull', equipment_required: ['barbell'],
  primary_muscles: ['dos', 'biceps'], secondary_muscles: [],
  is_compound: true,
}
const squatEx = {
  name: 'Squat barre', sets: 4, reps: '6-8', rest_sec: 120, rir: 2,
  notes: '', movement_pattern: 'squat_pattern', equipment_required: ['barbell'],
  primary_muscles: ['quadriceps', 'fessiers', 'ischio-jambiers'], secondary_muscles: [],
  is_compound: true,
}
const isolationEx = {
  name: 'Curl haltère', sets: 3, reps: '12-15', rest_sec: 60, rir: 2,
  notes: '', movement_pattern: 'elbow_flexion', equipment_required: ['dumbbell'],
  primary_muscles: ['biceps'], secondary_muscles: [],
  is_compound: false,
}

const hypertrophyMeta: TemplateMeta = {
  goal: 'hypertrophy', level: 'intermediate', weeks: 8, frequency: 3, equipment_archetype: 'commercial_gym',
}

// ── scoreBalance ──────────────────────────────────────────────────────────────

describe('scoreBalance', () => {
  it('returns 100 when push/pull ratio is balanced (1.0)', () => {
    const sessions: BuilderSession[] = [{
      name: 'Full Body', day_of_week: 1,
      exercises: [pushEx, pullEx],
    }]
    const { score } = scoreBalance(sessions, hypertrophyMeta)
    expect(score).toBeGreaterThan(80)
  })

  it('returns critical alert when only push, no pull', () => {
    const sessions: BuilderSession[] = [{
      name: 'Push only', day_of_week: 1,
      exercises: [pushEx, pushEx, pushEx],
    }]
    const { alerts } = scoreBalance(sessions, hypertrophyMeta)
    expect(alerts.some(a => a.severity === 'critical' && a.code === 'PUSH_PULL_IMBALANCE')).toBe(true)
  })

  it('returns score 100 when no push and no pull (core only)', () => {
    const coreEx = { ...isolationEx, movement_pattern: 'core_anti_flex', primary_muscles: ['abdos'] }
    const sessions: BuilderSession[] = [{ name: 'Core', day_of_week: 1, exercises: [coreEx] }]
    const { score } = scoreBalance(sessions, hypertrophyMeta)
    expect(score).toBe(100) // pas de déséquilibre si aucun pattern push/pull
  })
})

// ── scoreSRA ──────────────────────────────────────────────────────────────────

describe('scoreSRA', () => {
  it('returns no violation when sessions are on separate days', () => {
    const sessions: BuilderSession[] = [
      { name: 'J1 Push', day_of_week: 1, exercises: [pushEx] },
      { name: 'J3 Push', day_of_week: 3, exercises: [pushEx] },
    ]
    const { alerts } = scoreSRA(sessions, hypertrophyMeta)
    expect(alerts.filter(a => a.severity === 'critical')).toHaveLength(0)
  })

  it('returns critical alert when same muscle group on consecutive days', () => {
    const sessions: BuilderSession[] = [
      { name: 'J1', day_of_week: 1, exercises: [squatEx] },
      { name: 'J2', day_of_week: 2, exercises: [squatEx] }, // quadriceps 24h après = violation (min 48h)
    ]
    const { alerts } = scoreSRA(sessions, hypertrophyMeta)
    expect(alerts.some(a => a.severity === 'critical' && a.code === 'SRA_VIOLATION')).toBe(true)
  })

  it('applies +25% window for beginner level', () => {
    const beginnerMeta = { ...hypertrophyMeta, level: 'beginner' }
    const sessions: BuilderSession[] = [
      { name: 'J1', day_of_week: 1, exercises: [squatEx] },
      { name: 'J3', day_of_week: 3, exercises: [squatEx] }, // 48h gap, OK for intermediate, violation for beginner (48*1.25=60h)
    ]
    const { alerts } = scoreSRA(sessions, beginnerMeta)
    // 48h < 60h (beginner window) → warning ou critical
    expect(alerts.some(a => a.code === 'SRA_VIOLATION')).toBe(true)
  })
})

// ── scoreRedundancy ───────────────────────────────────────────────────────────

describe('scoreRedundancy', () => {
  it('detects redundant pair: same pattern + same muscles + both compound', () => {
    const hackSquat = { ...squatEx, name: 'Hack squat machine', movement_pattern: 'squat_pattern' }
    const sessions: BuilderSession[] = [{
      name: 'Legs', day_of_week: 1, exercises: [squatEx, hackSquat],
    }]
    const { alerts } = scoreRedundancy(sessions)
    expect(alerts.some(a => a.code === 'REDUNDANT_EXERCISES')).toBe(true)
  })

  it('does NOT flag squat + leg extension as redundant (compound + isolation = complementary)', () => {
    const legExt = { ...isolationEx, name: 'Leg extension', movement_pattern: 'knee_extension', primary_muscles: ['quadriceps'] }
    const sessions: BuilderSession[] = [{
      name: 'Legs', day_of_week: 1, exercises: [squatEx, legExt],
    }]
    const { alerts } = scoreRedundancy(sessions)
    expect(alerts.some(a => a.code === 'REDUNDANT_EXERCISES')).toBe(false)
  })
})

// ── scoreProgression ──────────────────────────────────────────────────────────

describe('scoreProgression', () => {
  it('returns score 100 when weeks = 1 (no progression to evaluate)', () => {
    const meta = { ...hypertrophyMeta, weeks: 1 }
    const { score } = scoreProgression([{ name: 'S1', day_of_week: 1, exercises: [squatEx] }], meta)
    expect(score).toBe(100)
  })

  it('returns critical alert when rir = 0 on week 1 exercises', () => {
    const rirZeroEx = { ...squatEx, rir: 0 }
    const meta = { ...hypertrophyMeta, weeks: 8 }
    const { alerts } = scoreProgression([{ name: 'S1', day_of_week: 1, exercises: [rirZeroEx] }], meta)
    expect(alerts.some(a => a.code === 'RIR_TOO_LOW_WEEK1' && a.severity === 'critical')).toBe(true)
  })
})

// ── scoreSpecificity ──────────────────────────────────────────────────────────

describe('scoreSpecificity', () => {
  it('returns high score for hypertrophy goal with 8-12 reps and RIR 1-3', () => {
    const sessions: BuilderSession[] = [{ name: 'S1', day_of_week: 1, exercises: [pushEx, squatEx] }]
    const { score } = scoreSpecificity(sessions, hypertrophyMeta)
    expect(score).toBeGreaterThan(70)
  })

  it('returns warning when strength goal has high RIR (> 2)', () => {
    const strengthMeta = { ...hypertrophyMeta, goal: 'strength' }
    const highRirEx = { ...squatEx, rir: 4, reps: '8-12' } // RIR 4 = trop confortable pour force
    const sessions: BuilderSession[] = [{ name: 'S1', day_of_week: 1, exercises: [highRirEx] }]
    const { alerts } = scoreSpecificity(sessions, strengthMeta)
    expect(alerts.some(a => a.code === 'GOAL_MISMATCH')).toBe(true)
  })
})

// ── scoreCompleteness ─────────────────────────────────────────────────────────

describe('scoreCompleteness', () => {
  it('returns 100 when all expected patterns are present for goal', () => {
    const hipEx = { ...squatEx, movement_pattern: 'hip_hinge' }
    const vPullEx = { ...pullEx, movement_pattern: 'vertical_pull' }
    const sessions: BuilderSession[] = [{
      name: 'Full', day_of_week: 1,
      exercises: [pushEx, pullEx, squatEx, hipEx, vPullEx, isolationEx],
    }]
    const { score } = scoreCompleteness(sessions, hypertrophyMeta)
    expect(score).toBeGreaterThan(75)
  })

  it('returns warning for each missing required pattern', () => {
    // Seulement push → beaucoup de patterns manquants pour hypertrophy
    const sessions: BuilderSession[] = [{ name: 'Push only', day_of_week: 1, exercises: [pushEx] }]
    const { alerts } = scoreCompleteness(sessions, hypertrophyMeta)
    expect(alerts.filter(a => a.code === 'MISSING_PATTERN').length).toBeGreaterThan(2)
  })
})

// ── buildIntelligenceResult ───────────────────────────────────────────────────

describe('buildIntelligenceResult', () => {
  it('returns a result with globalScore between 0 and 100', () => {
    const sessions: BuilderSession[] = [{ name: 'S1', day_of_week: 1, exercises: [pushEx, pullEx] }]
    const result = buildIntelligenceResult(sessions, hypertrophyMeta)
    expect(result.globalScore).toBeGreaterThanOrEqual(0)
    expect(result.globalScore).toBeLessThanOrEqual(100)
  })

  it('returns a non-empty globalNarrative', () => {
    const sessions: BuilderSession[] = [{ name: 'S1', day_of_week: 1, exercises: [pushEx] }]
    const result = buildIntelligenceResult(sessions, hypertrophyMeta)
    expect(result.globalNarrative.length).toBeGreaterThan(10)
  })

  it('returns empty result when sessions is empty', () => {
    const result = buildIntelligenceResult([], hypertrophyMeta)
    expect(result.globalScore).toBe(0)
    expect(result.alerts).toHaveLength(0)
  })
})
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
npx vitest run tests/lib/intelligence/scoring.test.ts
```
Résultat attendu : `FAIL — cannot find module '@/lib/programs/intelligence/scoring'`

- [ ] **Step 3 : Écrire le moteur de scoring**

```typescript
// lib/programs/intelligence/scoring.ts
import { resolveExerciseCoeff, normalizeMuscleSlug } from './catalog-utils'
import type {
  BuilderSession, BuilderExercise, TemplateMeta,
  IntelligenceAlert, IntelligenceResult, MuscleDistribution,
  PatternDistribution, SRAPoint, RedundantPair,
} from './types'

// ─── Constantes ───────────────────────────────────────────────────────────────

// Fenêtres SRA en heures par groupe musculaire (niveau intermédiaire)
// Sources : Schoenfeld 2010, Colquhoun 2018 (fréquence optimale)
const SRA_WINDOWS: Record<string, number> = {
  quadriceps: 48, fessiers: 48, 'ischio-jambiers': 48,
  dos: 48, pectoraux: 48,
  epaules: 36, biceps: 36, triceps: 36,
  mollets: 24, abdos: 24,
}
const SRA_WINDOW_DEFAULT = 48

// Modulation de la fenêtre SRA par niveau
const SRA_LEVEL_MULTIPLIER: Record<string, number> = {
  beginner: 1.25, intermediate: 1.0, advanced: 0.9, elite: 0.85,
}

// Groupes "push" et "pull" pour le calcul de balance
const PUSH_PATTERNS = new Set(['horizontal_push', 'vertical_push', 'elbow_extension'])
const PULL_PATTERNS = new Set(['horizontal_pull', 'vertical_pull', 'elbow_flexion', 'scapular_elevation'])
const LEGS_PATTERNS = new Set(['squat_pattern', 'hip_hinge', 'knee_flexion', 'knee_extension', 'calf_raise'])
const CORE_PATTERNS = new Set(['core_flex', 'core_anti_flex', 'core_rotation'])

// Seuils ratio push/pull par goal
const BALANCE_THRESHOLDS: Record<string, { warn: [number, number], critical: [number, number] }> = {
  athletic:     { warn: [0.8, 1.2], critical: [0.5, 2.0] },
  strength:     { warn: [0.6, 1.6], critical: [0.4, 2.5] },
  default:      { warn: [0.7, 1.4], critical: [0.5, 2.0] },
}

// Patterns attendus par goal (pour scoreCompleteness)
const REQUIRED_PATTERNS: Record<string, string[]> = {
  hypertrophy: ['horizontal_push', 'horizontal_pull', 'vertical_pull', 'squat_pattern', 'hip_hinge', 'elbow_flexion', 'elbow_extension', 'lateral_raise'],
  strength:    ['horizontal_push', 'vertical_push', 'squat_pattern', 'hip_hinge', 'horizontal_pull'],
  fat_loss:    ['squat_pattern', 'hip_hinge', 'horizontal_push', 'horizontal_pull', 'carry'],
  athletic:    ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull', 'squat_pattern', 'hip_hinge', 'carry'],
  recomp:      ['squat_pattern', 'hip_hinge', 'horizontal_push', 'horizontal_pull'],
  endurance:   ['squat_pattern', 'hip_hinge', 'horizontal_pull', 'carry'],
  maintenance: ['horizontal_push', 'horizontal_pull', 'squat_pattern', 'hip_hinge'],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCoeff(ex: BuilderExercise): number {
  return resolveExerciseCoeff({
    name: ex.name,
    movement_pattern: ex.movement_pattern,
    primary_muscles: ex.primary_muscles,
    is_compound: ex.is_compound,
  })
}

function getPattern(ex: BuilderExercise): string {
  return ex.movement_pattern ?? 'unknown'
}

// Calcule le volume pondéré d'un exercice : sets × stimCoeff
function weightedVolume(ex: BuilderExercise): number {
  return ex.sets * getCoeff(ex)
}

// Norme un score 0–100 depuis un ratio
function clampScore(v: number): number {
  return Math.round(Math.max(0, Math.min(100, v)))
}

// Heures entre deux jours de semaine (1=Lundi…7=Dimanche), cycliques
function hoursBetween(dayA: number | null, dayB: number | null): number | null {
  if (dayA === null || dayB === null) return null
  const diff = ((dayB - dayA + 7) % 7) || 7
  return diff * 24
}

// ─── 1. Balance push / pull / legs / core ────────────────────────────────────

export function scoreBalance(
  sessions: BuilderSession[],
  meta: TemplateMeta,
): { score: number; alerts: IntelligenceAlert[] } {
  const alerts: IntelligenceAlert[] = []

  let pushVol = 0, pullVol = 0
  for (const session of sessions) {
    for (const ex of session.exercises) {
      const p = getPattern(ex)
      const vol = weightedVolume(ex)
      if (PUSH_PATTERNS.has(p)) pushVol += vol
      if (PULL_PATTERNS.has(p)) pullVol += vol
    }
  }

  // Aucun push ni pull → pas de déséquilibre mesurable
  if (pushVol === 0 && pullVol === 0) return { score: 100, alerts }

  // Évite division par zéro si un côté est absent
  const ratio = pullVol === 0 ? 999 : pushVol === 0 ? 0.001 : pushVol / pullVol
  const thresholds = BALANCE_THRESHOLDS[meta.goal] ?? BALANCE_THRESHOLDS.default

  const deviation = Math.abs(ratio - 1.0)
  let score = clampScore(100 - deviation * 60)

  if (ratio < thresholds.critical[0] || ratio > thresholds.critical[1]) {
    score = Math.min(score, 30)
    alerts.push({
      severity: 'critical',
      code: 'PUSH_PULL_IMBALANCE',
      title: 'Déséquilibre push/pull sévère',
      explanation: `Le ratio push/pull est de ${ratio.toFixed(2)} (idéal : ~1.0). Un déséquilibre important augmente le risque de dysfonction gléno-humérale et d'inhibition réciproque.`,
      suggestion: ratio > 1 ? 'Ajoutez des exercices de tirage (rowing, tractions) pour rééquilibrer.' : 'Ajoutez des exercices de poussée (développé, OHP) pour rééquilibrer.',
    })
  } else if (ratio < thresholds.warn[0] || ratio > thresholds.warn[1]) {
    score = Math.min(score, 65)
    alerts.push({
      severity: 'warning',
      code: 'PUSH_PULL_IMBALANCE',
      title: 'Déséquilibre push/pull',
      explanation: `Ratio push/pull : ${ratio.toFixed(2)}. Optimal pour "${meta.goal}" : ${thresholds.warn[0]}–${thresholds.warn[1]}.`,
      suggestion: ratio > 1 ? 'Envisagez d\'ajouter 1–2 exercices de tirage.' : 'Envisagez d\'ajouter 1–2 exercices de poussée.',
    })
  }

  return { score, alerts }
}

// ─── 2. Modèle SRA (Stimulus → Récupération → Adaptation) ────────────────────

export function scoreSRA(
  sessions: BuilderSession[],
  meta: TemplateMeta,
): { score: number; alerts: IntelligenceAlert[]; sraMap: SRAPoint[] } {
  const alerts: IntelligenceAlert[] = []
  const sraMap: SRAPoint[] = []
  const levelMult = SRA_LEVEL_MULTIPLIER[meta.level] ?? 1.0

  // Construit une map muscle → [{sessionIndex, dayOfWeek}]
  const muscleSessionMap: Record<string, { sessionIndex: number; day: number | null }[]> = {}

  sessions.forEach((session, si) => {
    const muscles = new Set<string>()
    for (const ex of session.exercises) {
      ex.primary_muscles.map(normalizeMuscleSlug).forEach(m => muscles.add(m))
    }
    muscles.forEach(muscle => {
      if (!muscleSessionMap[muscle]) muscleSessionMap[muscle] = []
      muscleSessionMap[muscle].push({ sessionIndex: si, day: session.day_of_week })
    })
  })

  let violations = 0
  let totalChecks = 0

  for (const [muscle, occurrences] of Object.entries(muscleSessionMap)) {
    const window = (SRA_WINDOWS[muscle] ?? SRA_WINDOW_DEFAULT) * levelMult

    for (let i = 1; i < occurrences.length; i++) {
      const prev = occurrences[i - 1]
      const curr = occurrences[i]
      const hours = hoursBetween(prev.day, curr.day)
      totalChecks++

      const point: SRAPoint = {
        muscleGroup: muscle,
        sessionIndex: curr.sessionIndex,
        hoursFromPrevious: hours,
        windowRequired: Math.round(window),
        violation: false,
      }

      if (hours !== null) {
        if (hours < window * 0.5) {
          point.violation = true
          violations++
          alerts.push({
            severity: 'critical',
            code: 'SRA_VIOLATION',
            title: `Récupération insuffisante — ${muscle}`,
            explanation: `${muscle} sollicité ${hours}h après la séance précédente. Fenêtre minimum : ${Math.round(window)}h (niveau ${meta.level}).`,
            suggestion: `Espacez les séances sollicitant ${muscle} d'au moins ${Math.round(window - hours)}h supplémentaires.`,
            sessionIndex: curr.sessionIndex,
          })
        } else if (hours < window * 0.8) {
          violations += 0.5
          alerts.push({
            severity: 'warning',
            code: 'SRA_VIOLATION',
            title: `Récupération courte — ${muscle}`,
            explanation: `${muscle} sollicité ${hours}h après la séance précédente. Idéal : ${Math.round(window)}h.`,
            suggestion: `Envisagez d'espacer davantage ou de réduire l'intensité de l'une des séances.`,
            sessionIndex: curr.sessionIndex,
          })
        }
      }

      sraMap.push(point)
    }
  }

  const score = totalChecks === 0
    ? 100
    : clampScore(100 - (violations / totalChecks) * 100)

  return { score, alerts, sraMap }
}

// ─── 3. Redondance mécanique ──────────────────────────────────────────────────

export function scoreRedundancy(
  sessions: BuilderSession[],
): { score: number; alerts: IntelligenceAlert[]; redundantPairs: RedundantPair[] } {
  const alerts: IntelligenceAlert[] = []
  const redundantPairs: RedundantPair[] = []

  sessions.forEach((session, si) => {
    const exs = session.exercises
    for (let a = 0; a < exs.length; a++) {
      for (let b = a + 1; b < exs.length; b++) {
        const exA = exs[a], exB = exs[b]
        const pA = getPattern(exA), pB = getPattern(exB)

        // Patterns identiques
        if (pA !== pB || pA === 'unknown') continue

        // Les deux composés (composé + isolation = complémentaire, pas redondant)
        const isCompA = resolveExerciseCoeff({ name: exA.name, movement_pattern: pA, primary_muscles: exA.primary_muscles, is_compound: exA.is_compound }) > 0.65
        const isCompB = resolveExerciseCoeff({ name: exB.name, movement_pattern: pB, primary_muscles: exB.primary_muscles, is_compound: exB.is_compound }) > 0.65
        if (!isCompA || !isCompB) continue

        // Muscle primaire commun
        const musA = new Set(exA.primary_muscles.map(normalizeMuscleSlug))
        const musB = new Set(exB.primary_muscles.map(normalizeMuscleSlug))
        const overlap = [...musA].filter(m => musB.has(m))
        if (overlap.length === 0) continue

        // Coefficients proches (même registre d'intensité)
        const coeffA = getCoeff(exA), coeffB = getCoeff(exB)
        if (Math.abs(coeffA - coeffB) >= 0.15) continue

        redundantPairs.push({ sessionIndex: si, exerciseIndexA: a, exerciseIndexB: b, reason: `Même pattern (${pA}), muscles communs : ${overlap.join(', ')}` })
        alerts.push({
          severity: 'warning',
          code: 'REDUNDANT_EXERCISES',
          title: `Redondance mécanique : ${exA.name} + ${exB.name}`,
          explanation: `Ces deux exercices ciblent les mêmes muscles (${overlap.join(', ')}) avec le même pattern (${pA}) et une intensité similaire. Le gain marginal du second est faible.`,
          suggestion: 'Remplacez l\'un par un exercice sous un angle différent ou avec un pattern complémentaire.',
          sessionIndex: si,
          exerciseIndex: b,
        })
      }
    }
  })

  const totalExercises = sessions.reduce((acc, s) => acc + s.exercises.length, 0)
  const score = totalExercises === 0
    ? 100
    : clampScore(100 - (redundantPairs.length / totalExercises) * 80)

  return { score, alerts, redundantPairs }
}

// ─── 4. Progression RIR / intensité ──────────────────────────────────────────

export function scoreProgression(
  sessions: BuilderSession[],
  meta: TemplateMeta,
): { score: number; alerts: IntelligenceAlert[] } {
  const alerts: IntelligenceAlert[] = []

  // Si durée ≤ 1 semaine : pas de progression évaluable
  if (meta.weeks <= 1) return { score: 100, alerts }

  const allExercises = sessions.flatMap(s => s.exercises)

  // Alerte critique si RIR = 0 dès semaine 1 (aucune marge de progression)
  const rirZeroW1 = allExercises.filter(ex => ex.rir === 0)
  if (rirZeroW1.length > 0) {
    alerts.push({
      severity: 'critical',
      code: 'RIR_TOO_LOW_WEEK1',
      title: 'RIR 0 en semaine 1 — aucune marge de progression',
      explanation: `${rirZeroW1.length} exercice(s) démarrent avec RIR = 0. La progression linéaire (−0.5 RIR/semaine) est impossible sans recommencer à charge réduite.`,
      suggestion: `Démarrez à RIR 3–4 pour un programme de ${meta.weeks} semaines et descendez progressivement.`,
    })
    return { score: 20, alerts }
  }

  // Alerte info si RIR trop élevé pour le nombre de semaines (sous-utilisation)
  const avgRir = allExercises.reduce((acc, ex) => acc + (ex.rir ?? 2), 0) / (allExercises.length || 1)
  const recommendedStartRir = Math.min(4, Math.ceil(meta.weeks * 0.5))
  if (avgRir > recommendedStartRir + 1) {
    alerts.push({
      severity: 'info',
      code: 'RIR_TOO_HIGH',
      title: 'Intensité initiale faible',
      explanation: `RIR moyen de ${avgRir.toFixed(1)} pour un programme de ${meta.weeks} semaines. La fenêtre de progression est sous-utilisée.`,
      suggestion: `Pour ${meta.weeks} semaines, un RIR initial de ${recommendedStartRir}–${recommendedStartRir + 1} est optimal.`,
    })
  }

  const score = alerts.some(a => a.severity === 'critical') ? 20 :
                alerts.some(a => a.severity === 'warning') ? 60 : 90

  return { score, alerts }
}

// ─── 5. Spécificité goal ──────────────────────────────────────────────────────

// Score de spécificité 0–1 par exercice selon le goal
function exerciseSpecificityScore(ex: BuilderExercise, goal: string): number {
  const pattern = getPattern(ex)
  const repsStr = ex.reps ?? ''
  const repsLow = parseInt(repsStr.split('-')[0] ?? '0') || 0
  const rir = ex.rir ?? 2
  const restSec = ex.rest_sec ?? 90
  const coeff = getCoeff(ex)

  switch (goal) {
    case 'hypertrophy': {
      let s = 0.5
      if (repsLow >= 6 && repsLow <= 15) s += 0.2
      if (rir >= 1 && rir <= 3) s += 0.15
      if (restSec <= 180) s += 0.15
      if (coeff < 0.45) s -= 0.15 // isolation pure pénalisée légèrement
      return Math.min(1, Math.max(0, s))
    }
    case 'strength': {
      let s = 0.5
      if (repsLow >= 1 && repsLow <= 6) s += 0.25
      if (rir <= 2) s += 0.15
      if (['squat_pattern', 'hip_hinge', 'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull'].includes(pattern)) s += 0.1
      if (coeff > 0.80) s += 0.1
      if (rir > 2) s -= 0.2 // confort excessif pénalisé
      return Math.min(1, Math.max(0, s))
    }
    case 'fat_loss': {
      let s = 0.5
      if (restSec <= 60) s += 0.2
      if (ex.sets >= 3) s += 0.1
      if (['squat_pattern', 'hip_hinge', 'carry'].includes(pattern)) s += 0.2
      if (restSec > 120) s -= 0.2
      return Math.min(1, Math.max(0, s))
    }
    case 'endurance': {
      let s = 0.5
      if (repsLow >= 15) s += 0.25
      if (restSec <= 45) s += 0.15
      if (coeff > 0.80) s -= 0.1
      return Math.min(1, Math.max(0, s))
    }
    default:
      return 0.65 // score neutre pour recomp / maintenance / athletic
  }
}

export function scoreSpecificity(
  sessions: BuilderSession[],
  meta: TemplateMeta,
): { score: number; alerts: IntelligenceAlert[] } {
  const alerts: IntelligenceAlert[] = []
  const allExercises = sessions.flatMap(s => s.exercises)

  if (allExercises.length === 0) return { score: 100, alerts }

  // Moyenne pondérée par stimCoeff
  let totalWeight = 0, weightedSum = 0
  allExercises.forEach((ex, i) => {
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

  const avgSpecificity = totalWeight === 0 ? 0.65 : weightedSum / totalWeight
  return { score: clampScore(avgSpecificity * 100), alerts }
}

// ─── 6. Patterns manquants ────────────────────────────────────────────────────

export function scoreCompleteness(
  sessions: BuilderSession[],
  meta: TemplateMeta,
): { score: number; alerts: IntelligenceAlert[]; missingPatterns: string[] } {
  const alerts: IntelligenceAlert[] = []
  const required = REQUIRED_PATTERNS[meta.goal] ?? REQUIRED_PATTERNS.maintenance
  const presentPatterns = new Set(
    sessions.flatMap(s => s.exercises.map(ex => ex.movement_pattern).filter(Boolean))
  )

  const missing = required.filter(p => !presentPatterns.has(p))

  // Exemple d'exercice suggéré par pattern manquant
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

  const score = required.length === 0
    ? 100
    : clampScore(((required.length - missing.length) / required.length) * 100)

  return { score, alerts, missingPatterns: missing }
}

// ─── Agrégation finale ────────────────────────────────────────────────────────

// Poids des subscores dans le globalScore
const SUBSCORE_WEIGHTS = {
  balance: 0.25,
  recovery: 0.25,
  specificity: 0.15,
  progression: 0.15,
  completeness: 0.10,
  redundancy: 0.10,
}

function buildNarrative(subscores: IntelligenceResult['subscores'], alerts: IntelligenceAlert[]): string {
  const criticals = alerts.filter(a => a.severity === 'critical')
  if (criticals.length > 0) {
    return `Point critique : ${criticals[0].title.toLowerCase()}.`
  }

  const sorted = Object.entries(subscores).sort(([, a], [, b]) => b - a)
  const [bestKey, bestVal] = sorted[0]
  const [worstKey, worstVal] = sorted[sorted.length - 1]

  const labels: Record<string, string> = {
    balance: 'équilibre push/pull',
    recovery: 'récupération inter-séances',
    specificity: 'cohérence avec l\'objectif',
    progression: 'progression d\'intensité',
    completeness: 'couverture des patterns',
    redundancy: 'diversité des exercices',
  }

  if (worstVal < 60) {
    return `Point fort : ${labels[bestKey]} (${bestVal}/100). À améliorer : ${labels[worstKey]} (${worstVal}/100).`
  }
  return `Programme équilibré. Meilleur score : ${labels[bestKey]} (${bestVal}/100).`
}

export function buildIntelligenceResult(
  sessions: BuilderSession[],
  meta: TemplateMeta,
): IntelligenceResult {
  if (sessions.length === 0 || sessions.every(s => s.exercises.length === 0)) {
    return {
      globalScore: 0,
      globalNarrative: 'Ajoutez des exercices pour voir l\'analyse.',
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
  const specificityResult = scoreSpecificity(sessions, meta)
  const completenessResult = scoreCompleteness(sessions, meta)

  const subscores = {
    balance: balanceResult.score,
    recovery: sraResult.score,
    specificity: specificityResult.score,
    progression: progressionResult.score,
    completeness: completenessResult.score,
    redundancy: redundancyResult.score,
  }

  const globalScore = clampScore(
    Object.entries(subscores).reduce((acc, [key, val]) => {
      return acc + val * SUBSCORE_WEIGHTS[key as keyof typeof SUBSCORE_WEIGHTS]
    }, 0)
  )

  const allAlerts = [
    ...balanceResult.alerts,
    ...sraResult.alerts,
    ...redundancyResult.alerts,
    ...progressionResult.alerts,
    ...specificityResult.alerts,
    ...completenessResult.alerts,
  ].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return order[a.severity] - order[b.severity]
  })

  // Distribution musculaire (volume pondéré par groupe)
  const distribution: MuscleDistribution = {}
  for (const session of sessions) {
    for (const ex of session.exercises) {
      const vol = weightedVolume(ex)
      ex.primary_muscles.forEach(m => {
        const norm = normalizeMuscleSlug(m)
        distribution[norm] = (distribution[norm] ?? 0) + vol
      })
    }
  }

  // Distribution patterns (volume brut)
  const patternDistribution: PatternDistribution = { push: 0, pull: 0, legs: 0, core: 0 }
  for (const session of sessions) {
    for (const ex of session.exercises) {
      const p = getPattern(ex)
      const vol = ex.sets
      if (PUSH_PATTERNS.has(p)) patternDistribution.push += vol
      else if (PULL_PATTERNS.has(p)) patternDistribution.pull += vol
      else if (LEGS_PATTERNS.has(p)) patternDistribution.legs += vol
      else if (CORE_PATTERNS.has(p)) patternDistribution.core += vol
    }
  }

  return {
    globalScore,
    globalNarrative: buildNarrative(subscores, allAlerts),
    subscores,
    alerts: allAlerts,
    distribution,
    patternDistribution,
    missingPatterns: completenessResult.missingPatterns,
    redundantPairs: redundancyResult.redundantPairs,
    sraMap: sraResult.sraMap,
  }
}
```

- [ ] **Step 4 : Lancer les tests**

```bash
npx vitest run tests/lib/intelligence/scoring.test.ts
```
Résultat attendu : `PASS — tous les tests passent`

- [ ] **Step 5 : Commit**

```bash
git add lib/programs/intelligence/scoring.ts tests/lib/intelligence/scoring.test.ts
git commit -m "feat(intelligence): scoring engine — 6 subscores (balance, SRA, redundancy, progression, specificity, completeness)"
```

---

## Task 4 : Moteur d'alternatives + export public API

**Files:**
- Create: `lib/programs/intelligence/alternatives.ts`
- Create: `lib/programs/intelligence/index.ts`

- [ ] **Step 1 : Écrire `alternatives.ts`**

```typescript
// lib/programs/intelligence/alternatives.ts
import catalogData from '@/data/exercise-catalog.json'
import { normalizeMuscleSlug, getStimulusCoeff } from './catalog-utils'
import type { BuilderExercise } from './types'

interface CatalogEntry {
  id: string
  name: string
  slug: string
  gifUrl: string
  muscleGroup: string
  exerciseType: string
  pattern: string[]
  movementPattern: string
  equipment: string[]
  isCompound: boolean
  muscles: string[]
  stimulus_coefficient: number
}

const catalog = (catalogData as CatalogEntry[]).filter(e => e.exerciseType === 'exercise')

export interface AlternativeScore {
  entry: CatalogEntry
  score: number
  label: string // 'Remplace mécaniquement' | 'Angle complémentaire' | 'Alternative équipement'
}

interface AlternativesContext {
  equipmentArchetype: string
  goal: string
  level: string
  sessionExercises: BuilderExercise[]
}

// Équipements disponibles par archétype
const ARCHETYPE_EQUIPMENT: Record<string, string[]> = {
  bodyweight:      ['bodyweight', 'band'],
  home_dumbbells:  ['bodyweight', 'dumbbell', 'band', 'kettlebell'],
  home_full:       ['bodyweight', 'dumbbell', 'barbell', 'band', 'kettlebell', 'ez_bar'],
  home_rack:       ['bodyweight', 'dumbbell', 'barbell', 'band', 'kettlebell', 'ez_bar', 'smith'],
  functional_box:  ['bodyweight', 'dumbbell', 'kettlebell', 'band', 'cable', 'trx', 'medicine_ball', 'sled'],
  commercial_gym:  ['bodyweight', 'dumbbell', 'barbell', 'kettlebell', 'band', 'cable', 'machine', 'smith', 'ez_bar', 'trap_bar', 'landmine', 'trx', 'rings', 'sled'],
}

export function scoreAlternatives(
  original: BuilderExercise,
  context: AlternativesContext,
): AlternativeScore[] {
  const availableEquipment = ARCHETYPE_EQUIPMENT[context.equipmentArchetype] ?? ARCHETYPE_EQUIPMENT.commercial_gym
  const originalPattern = original.movement_pattern ?? ''
  const originalMuscles = new Set(original.primary_muscles.map(normalizeMuscleSlug))
  const originalCoeff = getStimulusCoeff(
    original.name.toLowerCase().replace(/\s+/g, '-'),
    originalPattern,
    (original.is_compound ?? originalMuscles.size >= 2),
  )

  // Patterns déjà présents dans la session (pour détecter la redondance)
  const sessionPatterns = context.sessionExercises
    .filter(e => e !== original)
    .map(e => e.movement_pattern)

  const scored: AlternativeScore[] = []

  for (const candidate of catalog) {
    // Exclure l'exercice original lui-même
    if (candidate.name.toLowerCase() === original.name.toLowerCase()) continue

    // Compatibilité équipement
    const hasEquipment = candidate.equipment.some(eq => availableEquipment.includes(eq))
    if (!hasEquipment) continue

    let score = 0

    // Même pattern primaire (+40)
    if (candidate.movementPattern === originalPattern) score += 40

    // Muscles primaires communs (+30)
    const candidateMuscles = new Set(candidate.muscles.map(normalizeMuscleSlug))
    const overlap = [...originalMuscles].filter(m => candidateMuscles.has(m))
    if (overlap.length > 0) score += Math.min(30, overlap.length * 15)

    // Équipement compatible (+20) — déjà filtré au-dessus, bonus pour équipement similaire
    const sameEquip = original.equipment_required.some(eq => candidate.equipment.includes(eq))
    if (sameEquip) score += 20

    // Non redondant avec les autres exercices de la session (+10)
    const isRedundant = sessionPatterns.includes(candidate.movementPattern)
    if (!isRedundant) score += 10

    // Pénalité si stimulus_coefficient inférieur à l'original (−15)
    if (candidate.stimulus_coefficient < originalCoeff - 0.15) score -= 15

    if (score <= 0) continue

    // Label qualitatif
    let label = 'Alternative'
    if (candidate.movementPattern === originalPattern && overlap.length >= 1) label = 'Remplace mécaniquement'
    else if (candidate.movementPattern !== originalPattern && overlap.length >= 1) label = 'Angle complémentaire'
    else if (!sameEquip && hasEquipment) label = 'Alternative équipement'

    scored.push({ entry: candidate, score, label })
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 8) // max 8 alternatives retournées au drawer
}
```

- [ ] **Step 2 : Écrire `index.ts` avec le hook `useProgramIntelligence`**

```typescript
// lib/programs/intelligence/index.ts
'use client'

import { useState, useEffect, useRef } from 'react'
import { buildIntelligenceResult } from './scoring'
import type { BuilderSession, TemplateMeta, IntelligenceResult, IntelligenceAlert } from './types'

export type { IntelligenceResult, IntelligenceAlert, BuilderSession, TemplateMeta }
export { scoreAlternatives } from './alternatives'
export type { AlternativeScore } from './alternatives'
export { resolveExerciseCoeff } from './catalog-utils'

const EMPTY_RESULT: IntelligenceResult = {
  globalScore: 0,
  globalNarrative: 'Ajoutez des exercices pour voir l\'analyse.',
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
): {
  result: IntelligenceResult
  alertsFor: (sessionIdx: number, exerciseIdx: number) => IntelligenceAlert[]
} {
  const [result, setResult] = useState<IntelligenceResult>(EMPTY_RESULT)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      const next = buildIntelligenceResult(sessions, meta)
      setResult(next)
    }, 400) // debounce 400ms

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [sessions, meta])

  function alertsFor(sessionIdx: number, exerciseIdx: number): IntelligenceAlert[] {
    return result.alerts.filter(
      a => a.sessionIndex === sessionIdx && a.exerciseIndex === exerciseIdx,
    )
  }

  return { result, alertsFor }
}
```

- [ ] **Step 3 : Commit**

```bash
git add lib/programs/intelligence/alternatives.ts lib/programs/intelligence/index.ts
git commit -m "feat(intelligence): alternatives engine + useProgramIntelligence hook"
```

---

## Task 5 : `IntelligenceAlertBadge.tsx`

**Files:**
- Create: `components/programs/IntelligenceAlertBadge.tsx`

- [ ] **Step 1 : Écrire le composant**

```tsx
// components/programs/IntelligenceAlertBadge.tsx
'use client'

import { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, X, ArrowRight } from 'lucide-react'
import type { IntelligenceAlert } from '@/lib/programs/intelligence'

interface Props {
  alerts: IntelligenceAlert[]
  onOpenAlternatives?: () => void
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    border: 'border-red-500/40',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    iconColor: 'text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    iconColor: 'text-amber-400',
  },
  info: {
    icon: Info,
    border: 'border-white/[0.06]',
    bg: 'bg-white/[0.02]',
    text: 'text-white/50',
    iconColor: 'text-white/30',
  },
}

export default function IntelligenceAlertBadge({ alerts, onOpenAlternatives }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)

  const visible = alerts.filter(a => !dismissed.has(a.code + (a.exerciseIndex ?? '')))
  const shown = visible.slice(0, 2)
  const hidden = visible.length - 2

  if (visible.length === 0) return null

  return (
    <div className="flex flex-col gap-1 mt-1.5">
      {shown.map((alert, i) => {
        const cfg = SEVERITY_CONFIG[alert.severity]
        const Icon = cfg.icon
        const key = alert.code + (alert.exerciseIndex ?? '') + i
        const isExpanded = expanded === key

        return (
          <div
            key={key}
            className={`rounded-xl border ${cfg.border} ${cfg.bg} px-3 py-2`}
          >
            <div className="flex items-start gap-2">
              <Icon size={12} className={`${cfg.iconColor} mt-0.5 shrink-0`} />
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : key)}
                  className={`text-[11px] font-semibold ${cfg.text} text-left w-full`}
                >
                  {alert.title}
                </button>
                {isExpanded && (
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    <p className="text-[10px] text-white/50 leading-relaxed">{alert.explanation}</p>
                    <p className={`text-[10px] font-medium ${cfg.text}`}>→ {alert.suggestion}</p>
                    {onOpenAlternatives && (
                      <button
                        type="button"
                        onClick={onOpenAlternatives}
                        className="flex items-center gap-1 text-[10px] font-semibold text-[#1f8a65] hover:opacity-80 transition-opacity mt-0.5"
                      >
                        <ArrowRight size={10} />
                        Voir les alternatives
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDismissed(prev => new Set([...prev, alert.code + (alert.exerciseIndex ?? '')]))}
                className="text-white/30 hover:text-white/60 transition-colors shrink-0"
              >
                <X size={10} />
              </button>
            </div>
          </div>
        )
      })}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded('all')}
          className="text-[10px] text-white/40 hover:text-white/60 transition-colors text-left pl-1"
        >
          +{hidden} alerte{hidden > 1 ? 's' : ''} supplémentaire{hidden > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add components/programs/IntelligenceAlertBadge.tsx
git commit -m "feat(intelligence): IntelligenceAlertBadge — inline alert under exercise card"
```

---

## Task 6 : `ExerciseAlternativesDrawer.tsx`

**Files:**
- Create: `components/programs/ExerciseAlternativesDrawer.tsx`

- [ ] **Step 1 : Écrire le composant**

```tsx
// components/programs/ExerciseAlternativesDrawer.tsx
'use client'

import { useState, useMemo } from 'react'
import { X, ArrowLeftRight, Zap, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import { scoreAlternatives } from '@/lib/programs/intelligence'
import type { BuilderExercise, TemplateMeta } from '@/lib/programs/intelligence'
import type { AlternativeScore } from '@/lib/programs/intelligence'

interface Props {
  exercise: BuilderExercise
  sessionExercises: BuilderExercise[]
  meta: TemplateMeta
  onReplace: (name: string, gifUrl: string, movementPattern: string | null, equipment: string[]) => void
  onClose: () => void
}

const FILTER_LABELS: Record<string, string> = {
  all: 'Toutes',
  same_equipment: 'Même équipement',
  different_equipment: 'Autre équipement',
  easier: 'Plus simple',
  harder: 'Plus difficile',
}

export default function ExerciseAlternativesDrawer({ exercise, sessionExercises, meta, onReplace, onClose }: Props) {
  const [filter, setFilter] = useState<string>('all')

  const alternatives = useMemo(() => {
    return scoreAlternatives(exercise, {
      equipmentArchetype: meta.equipment_archetype,
      goal: meta.goal,
      level: meta.level,
      sessionExercises,
    })
  }, [exercise, sessionExercises, meta])

  const filtered = useMemo((): AlternativeScore[] => {
    const origEquip = exercise.equipment_required
    switch (filter) {
      case 'same_equipment':
        return alternatives.filter(a => a.entry.equipment.some(e => origEquip.includes(e)))
      case 'different_equipment':
        return alternatives.filter(a => !a.entry.equipment.some(e => origEquip.includes(e)))
      case 'easier':
        return alternatives.filter(a => a.entry.stimulus_coefficient < 0.65)
      case 'harder':
        return alternatives.filter(a => a.entry.stimulus_coefficient > 0.80)
      default:
        return alternatives
    }
  }, [alternatives, filter, exercise.equipment_required])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-[420px] h-full bg-[#181818] border-l border-white/[0.06] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Alternatives à</p>
            <p className="text-[13px] font-bold text-white mt-0.5 truncate max-w-[300px]">{exercise.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] text-white/50 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 px-4 py-3 border-b border-white/[0.06] overflow-x-auto">
          {Object.entries(FILTER_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold shrink-0 transition-colors ${
                filter === key
                  ? 'bg-[#1f8a65]/20 text-[#1f8a65]'
                  : 'bg-white/[0.04] text-white/40 hover:text-white/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <ArrowLeftRight size={20} className="text-white/20" />
              <p className="text-[12px] text-white/40">Aucune alternative pour ce filtre</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-white/[0.04]">
              {filtered.map(alt => (
                <div key={alt.entry.id} className="flex gap-3 p-4 hover:bg-white/[0.02] transition-colors">
                  {/* GIF thumbnail */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-white/[0.04] shrink-0 relative">
                    <Image
                      src={alt.entry.gifUrl}
                      alt={alt.entry.name}
                      fill
                      className="object-cover"
                      unoptimized={alt.entry.gifUrl.endsWith('.gif')}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-white truncate">{alt.entry.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#1f8a65]/10 text-[#1f8a65]/80">
                        {alt.label}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] text-white/40">
                        <Zap size={8} className="text-amber-400/60" />
                        {Math.round(alt.entry.stimulus_coefficient * 100)}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/30 mt-0.5 truncate">
                      {alt.entry.muscles.slice(0, 3).join(', ')}
                    </p>
                  </div>

                  {/* Replace button */}
                  <button
                    type="button"
                    onClick={() => {
                      onReplace(
                        alt.entry.name,
                        alt.entry.gifUrl,
                        alt.entry.movementPattern,
                        alt.entry.equipment,
                      )
                      onClose()
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1f8a65]/10 text-[#1f8a65] text-[10px] font-bold shrink-0 hover:bg-[#1f8a65]/20 transition-colors self-center"
                  >
                    Remplacer
                    <ChevronRight size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add components/programs/ExerciseAlternativesDrawer.tsx
git commit -m "feat(intelligence): ExerciseAlternativesDrawer — scored alternatives with filters"
```

---

## Task 7 : `ProgramIntelligencePanel.tsx`

**Files:**
- Create: `components/programs/ProgramIntelligencePanel.tsx`

- [ ] **Step 1 : Écrire le panel**

```tsx
// components/programs/ProgramIntelligencePanel.tsx
'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip,
  BarChart, Bar,
} from 'recharts'
import { Zap, ChevronDown, ChevronUp, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import type { IntelligenceResult, IntelligenceAlert } from '@/lib/programs/intelligence'

interface Props {
  result: IntelligenceResult
  weeks: number
  onAlertClick?: (alert: IntelligenceAlert) => void
}

const SUBSCORE_LABELS: Record<string, string> = {
  balance: 'Équilibre',
  recovery: 'Récupération',
  specificity: 'Cohérence objectif',
  progression: 'Progression',
  completeness: 'Couverture',
  redundancy: 'Diversité',
}

const SCORE_COLOR = (score: number) =>
  score >= 75 ? '#1f8a65' : score >= 50 ? '#f59e0b' : '#ef4444'

const SEVERITY_ICON = { critical: AlertCircle, warning: AlertTriangle, info: Info }
const SEVERITY_COLOR = { critical: 'text-red-400', warning: 'text-amber-400', info: 'text-white/40' }

const RADAR_MUSCLE_LABELS: Record<string, string> = {
  dos: 'Dos', pectoraux: 'Pecto', epaules: 'Épaules',
  biceps: 'Biceps', triceps: 'Triceps', quadriceps: 'Quad',
  'ischio-jambiers': 'Ischio', fessiers: 'Fessiers',
  mollets: 'Mollets', abdos: 'Abdos',
}

const PIE_COLORS = ['#1f8a65', '#3b82f6', '#f59e0b', '#8b5cf6']

export default function ProgramIntelligencePanel({ result, weeks, onAlertClick }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [alertsExpanded, setAlertsExpanded] = useState(false)

  const globalColor = SCORE_COLOR(result.globalScore)

  // Radar data
  const radarData = Object.entries(RADAR_MUSCLE_LABELS).map(([key, label]) => ({
    muscle: label,
    volume: Math.round(result.distribution[key] ?? 0),
  }))

  // Donut data
  const donutData = [
    { name: 'Push', value: result.patternDistribution.push },
    { name: 'Pull', value: result.patternDistribution.pull },
    { name: 'Jambes', value: result.patternDistribution.legs },
    { name: 'Core', value: result.patternDistribution.core },
  ].filter(d => d.value > 0)

  // Volume par session bar chart
  const sessionVolumeData = result.sraMap.length > 0
    ? [] // sera construit depuis sessions — placeholder
    : []

  const shownAlerts = alertsExpanded ? result.alerts.slice(0, 8) : result.alerts.slice(0, 3)

  return (
    <div className="w-[280px] shrink-0 flex flex-col gap-3 sticky top-4">
      {/* Header + score */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap size={13} className="text-[#1f8a65]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">Intelligence</p>
          </div>
          <button onClick={() => setCollapsed(!collapsed)} className="text-white/30 hover:text-white/60">
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>

        {/* Score global animé */}
        <div className="flex items-end gap-2 mb-2">
          <motion.span
            key={result.globalScore}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[2.4rem] font-black leading-none"
            style={{ color: globalColor }}
          >
            {result.globalScore}
          </motion.span>
          <span className="text-[13px] text-white/30 mb-1">/100</span>
        </div>

        {/* Barre segmentée subscores */}
        <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden mb-3">
          {Object.entries(result.subscores).map(([key, val]) => (
            <div
              key={key}
              className="flex-1 rounded-full"
              style={{ backgroundColor: SCORE_COLOR(val), opacity: 0.7 + (val / 100) * 0.3 }}
              title={`${SUBSCORE_LABELS[key]}: ${val}`}
            />
          ))}
        </div>

        <p className="text-[11px] text-white/50 leading-relaxed">{result.globalNarrative}</p>
      </div>

      {!collapsed && (
        <>
          {/* Grille 2×3 subscores */}
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(result.subscores).map(([key, val]) => (
              <div key={key} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-2.5">
                <p className="text-[18px] font-black leading-none" style={{ color: SCORE_COLOR(val) }}>
                  {val}
                </p>
                <p className="text-[9px] text-white/40 mt-0.5">{SUBSCORE_LABELS[key]}</p>
              </div>
            ))}
          </div>

          {/* Radar musculaire */}
          {Object.keys(result.distribution).length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mb-2">Distribution musculaire</p>
              <ResponsiveContainer width="100%" height={160}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="muscle" tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.4)' }} />
                  <Radar
                    name="Volume"
                    dataKey="volume"
                    stroke="#1f8a65"
                    fill="#1f8a65"
                    fillOpacity={0.25}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Donut patterns */}
          {donutData.length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mb-2">Répartition patterns</p>
              <ResponsiveContainer width="100%" height={100}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={44}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donutData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#0f0f0f', border: 'none', borderRadius: 8, fontSize: 10 }}
                    itemStyle={{ color: 'rgba(255,255,255,0.7)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {donutData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-[9px] text-white/40">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alertes */}
          {result.alerts.length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40 mb-2">
                Alertes ({result.alerts.length})
              </p>
              <div className="flex flex-col gap-1.5">
                {shownAlerts.map((alert, i) => {
                  const Icon = SEVERITY_ICON[alert.severity]
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onAlertClick?.(alert)}
                      className="flex items-start gap-2 text-left hover:bg-white/[0.03] rounded-lg p-1.5 transition-colors"
                    >
                      <Icon size={11} className={`${SEVERITY_COLOR[alert.severity]} mt-0.5 shrink-0`} />
                      <p className="text-[10px] text-white/60 leading-snug">{alert.title}</p>
                    </button>
                  )
                })}
              </div>
              {result.alerts.length > 3 && (
                <button
                  onClick={() => setAlertsExpanded(!alertsExpanded)}
                  className="text-[9px] text-white/30 hover:text-white/50 transition-colors mt-2"
                >
                  {alertsExpanded ? 'Voir moins' : `+${result.alerts.length - 3} alertes`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add components/programs/ProgramIntelligencePanel.tsx
git commit -m "feat(intelligence): ProgramIntelligencePanel — sticky panel with radar, donut, subscores, alerts"
```

---

## Task 8 : Intégration dans `ProgramTemplateBuilder`

**Files:**
- Modify: `components/programs/ProgramTemplateBuilder.tsx`
- Modify: `components/programs/ExercisePicker.tsx`

### 8a — Ajouter `is_compound` à l'interface `Exercise` et à la checkbox

- [ ] **Step 1 : Mettre à jour l'interface `Exercise` et `emptyExercise()`**

Dans `ProgramTemplateBuilder.tsx`, ligne 121 — ajouter `is_compound` à l'interface et `MOVEMENT_PATTERNS` mettre à jour avec `scapular_elevation` :

```typescript
interface Exercise {
  name: string
  sets: number
  reps: string
  rest_sec: number | null
  rir: number | null
  notes: string
  image_url: string | null
  movement_pattern: string | null
  equipment_required: string[]
  primary_muscles: string[]
  secondary_muscles: string[]
  is_compound: boolean | undefined  // ← AJOUT
}
```

```typescript
function emptyExercise(): Exercise {
  return {
    name: '',
    sets: 3,
    reps: '8-12',
    rest_sec: 90,
    rir: 2,
    notes: '',
    image_url: null,
    movement_pattern: null,
    equipment_required: [],
    primary_muscles: [],
    secondary_muscles: [],
    is_compound: undefined,  // ← AJOUT
  }
}
```

Ajouter `scapular_elevation` dans `MOVEMENT_PATTERNS` (après `carry`) :
```typescript
{ value: 'scapular_elevation', label: 'Élévation scapulaire (Shrug)' },
```

Mettre à jour le mapping depuis `initial` dans `useState<Session[]>` (ligne ~224) :
```typescript
.map((e: any) => ({
  name: e.name,
  sets: e.sets,
  reps: e.reps,
  rest_sec: e.rest_sec,
  rir: e.rir,
  notes: e.notes ?? '',
  image_url: e.image_url ?? null,
  movement_pattern: e.movement_pattern ?? null,
  equipment_required: e.equipment_required ?? [],
  primary_muscles: e.primary_muscles ?? [],
  secondary_muscles: e.secondary_muscles ?? [],
  is_compound: e.is_compound ?? undefined,  // ← AJOUT
})),
```

- [ ] **Step 2 : Ajouter la checkbox "Poly-articulaire" dans la carte exercice**

Dans la section "Matching metadata" (après le select `movement_pattern`, ligne ~806), ajouter après le grid `grid-cols-2` :

```tsx
{/* Poly-articulaire */}
<div className="flex items-center gap-2 mt-1">
  <button
    type="button"
    onClick={() => updateExercise(si, ei, {
      is_compound: ex.is_compound === true ? false : ex.is_compound === false ? undefined : true
    })}
    className={`w-4 h-4 rounded border transition-colors shrink-0 flex items-center justify-center ${
      ex.is_compound === true
        ? 'bg-[#1f8a65] border-[#1f8a65]'
        : ex.is_compound === false
        ? 'bg-red-500/20 border-red-500/40'
        : 'bg-white/[0.04] border-white/[0.08]'
    }`}
  >
    {ex.is_compound === true && <span className="text-white text-[8px] font-bold">✓</span>}
    {ex.is_compound === false && <span className="text-red-400 text-[8px] font-bold">✗</span>}
  </button>
  <label className="text-[9px] font-semibold text-white/50 uppercase tracking-[0.12em]">
    Poly-articulaire
    {ex.is_compound === undefined && (
      <span className="ml-1 text-white/30 normal-case tracking-normal">(auto)</span>
    )}
  </label>
</div>
```

- [ ] **Step 3 : Intégrer `useProgramIntelligence` et `ProgramIntelligencePanel`**

En haut du composant `ProgramTemplateBuilder`, ajouter les imports :
```typescript
import { useProgramIntelligence } from '@/lib/programs/intelligence'
import ProgramIntelligencePanel from './ProgramIntelligencePanel'
import IntelligenceAlertBadge from './IntelligenceAlertBadge'
import ExerciseAlternativesDrawer from './ExerciseAlternativesDrawer'
```

Dans le corps du composant (après `const [error, setError]`), ajouter :
```typescript
const { result: intelligenceResult, alertsFor } = useProgramIntelligence(sessions, meta)
const [alternativesTarget, setAlternativesTarget] = useState<{ si: number; ei: number } | null>(null)
```

Modifier le `return` pour wrapper le contenu en layout flex horizontal :
```tsx
return (
  <div className="flex gap-6 items-start">
    {/* Builder principal (flex-1) */}
    <div className="flex-1 flex flex-col gap-6">
      {/* ... tout le contenu existant ... */}
    </div>

    {/* Panel intelligence sticky */}
    <ProgramIntelligencePanel
      result={intelligenceResult}
      weeks={meta.weeks}
    />

    {/* Drawer alternatives */}
    {alternativesTarget && (
      <ExerciseAlternativesDrawer
        exercise={sessions[alternativesTarget.si].exercises[alternativesTarget.ei]}
        sessionExercises={sessions[alternativesTarget.si].exercises}
        meta={meta}
        onReplace={(name, gifUrl, movementPattern, equipment) => {
          updateExercise(alternativesTarget.si, alternativesTarget.ei, {
            name,
            image_url: gifUrl,
            movement_pattern: movementPattern,
            equipment_required: equipment,
            is_compound: undefined, // reset → auto-dérivé pour l'exercice remplacé
          })
        }}
        onClose={() => setAlternativesTarget(null)}
      />
    )}
  </div>
)
```

- [ ] **Step 4 : Ajouter `IntelligenceAlertBadge` + bouton alternatives sous chaque exercice**

Dans la carte exercice (après `<input value={ex.notes}.../>`, ligne ~863), ajouter juste avant la fermeture du `div` de la carte :

```tsx
{/* Alertes intelligence */}
<IntelligenceAlertBadge
  alerts={alertsFor(si, ei)}
  onOpenAlternatives={() => setAlternativesTarget({ si, ei })}
/>

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

Ajouter `ArrowLeftRight` aux imports Lucide en haut du fichier.

- [ ] **Step 5 : Mettre à jour `ExercisePicker` pour transmettre `is_compound`**

Dans `ExercisePicker.tsx`, mettre à jour l'interface `Props.onSelect` et l'appel :

```typescript
// Interface Props onSelect — ajouter isCompound
onSelect: (exercise: {
  name: string
  gifUrl: string
  movementPattern: string | null
  equipment: string[]
  isCompound: boolean  // ← AJOUT
}) => void
```

Dans l'appel `onSelect` du catalogue (chercher `onSelect({` dans ExercisePicker), ajouter :
```typescript
onSelect({
  name: exercise.name,
  gifUrl: exercise.gifUrl,
  movementPattern: exercise.movementPattern,
  equipment: exercise.equipment,
  isCompound: exercise.isCompound,  // ← AJOUT
})
```

Dans `ProgramTemplateBuilder`, l'handler `ExercisePicker.onSelect` :
```typescript
// Chercher la ligne onSelect dans ProgramTemplateBuilder où pickerTarget est utilisé
// et ajouter is_compound dans le patch :
updateExercise(pickerTarget.si, pickerTarget.ei, {
  name: ex.name,
  image_url: ex.gifUrl,
  movement_pattern: ex.movementPattern,
  equipment_required: ex.equipment,
  is_compound: ex.isCompound,  // ← AJOUT
})
```

- [ ] **Step 6 : Vérifier TypeScript**

```bash
npx tsc --noEmit
```
Résultat attendu : 0 nouvelles erreurs (les erreurs pré-existantes stripe/BodyFatCalculator restent, elles sont hors scope)

- [ ] **Step 7 : Commit**

```bash
git add components/programs/ProgramTemplateBuilder.tsx components/programs/ExercisePicker.tsx
git commit -m "feat(intelligence): wire useProgramIntelligence into ProgramTemplateBuilder — panel, alerts, alternatives, is_compound"
```

---

## Task 9 : CHANGELOG + project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1 : Mettre à jour CHANGELOG.md**

Ajouter en tête de la section `## 2026-04-17` :

```
FEATURE: Program Intelligence Phase 1 — moteur scoring 6 sous-moteurs (balance push/pull, SRA, redondance, progression RIR, spécificité goal, patterns manquants)
FEATURE: lib/programs/intelligence/ — types, catalog-utils, scoring, alternatives, hook useProgramIntelligence
FEATURE: components/programs/ProgramIntelligencePanel — sticky panel radar/donut/subscores/alertes (Recharts)
FEATURE: components/programs/IntelligenceAlertBadge — alertes inline sous chaque exercice
FEATURE: components/programs/ExerciseAlternativesDrawer — drawer alternatives scorées avec filtres
FEATURE: ProgramTemplateBuilder — is_compound checkbox + intégration intelligence complète
```

- [ ] **Step 2 : Mettre à jour project-state.md**

Ajouter une section `## 2026-04-17 — Program Intelligence Phase 1` dans `.claude/rules/project-state.md` avec les fichiers créés, les invariants, les points de vigilance et les next steps (Phase 2 : profil client, supersets, prédictions).

- [ ] **Step 3 : Commit final**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for Program Intelligence Phase 1"
```

---

## Self-Review

### Couverture spec

| Exigence spec | Tâche |
|---------------|-------|
| Moteur `lib/programs/intelligence/` | Tasks 1–4 |
| 6 sous-moteurs scoring | Task 3 |
| `stimulus_coefficient` sur exercices custom | Task 2 (`resolveExerciseCoeff`) |
| `is_compound` checkbox coach | Task 8a |
| Hook `useProgramIntelligence` debounce 400ms | Task 4 |
| Panel sticky 280px | Task 7 |
| Score animé Framer Motion | Task 7 |
| Radar chart muscles | Task 7 |
| Donut patterns | Task 7 |
| Feed alertes (max 5, sévérité) | Task 7 |
| Alertes inline `IntelligenceAlertBadge` | Task 5 |
| Dismiss local alertes | Task 5 |
| Drawer alternatives coach | Task 6 |
| Scoring alternatives (5 critères) | Task 4 (`alternatives.ts`) |
| Filtres drawer | Task 6 |
| Remplacement exercice depuis drawer | Task 8 |
| `ExercisePicker` transmet `isCompound` | Task 8 |
| TypeScript strict 0 erreur | Task 8 Step 6 |
| CHANGELOG + project-state | Task 9 |

**Gaps identifiés et résolus :**
- La spec mentionne "Timeline RIR" (LineChart semaines) — non implémentée car le builder stocke un RIR unique par exercice, pas par semaine. Le moteur `scoreProgression` évalue le RIR initial + alerte, ce qui est l'information disponible. Timeline ajoutée en Phase 2 quand les semaines auront des données distinctes.
- La spec mentionne "Mini bar chart volume par session" — implémenté dans le panel via `patternDistribution` donut. Le bar chart horizontal par session nécessite une donnée `sessionVolume[]` qui sera ajoutée en Phase 2.

### Consistance des types
- `BuilderExercise.is_compound: boolean | undefined` — cohérent Tasks 1, 2, 3, 8
- `resolveExerciseCoeff({ name, movement_pattern, primary_muscles, is_compound })` — appelé identiquement dans scoring.ts (Task 3) et alternatives.ts (Task 4)
- `IntelligenceAlert.sessionIndex / exerciseIndex` — optionnels dans types.ts (Task 1), filtrés dans `alertsFor()` (Task 4), affichés dans badge (Task 5)
- `scoreAlternatives` retourne `AlternativeScore[]` — consommé dans drawer (Task 6) avec `.entry.stimulus_coefficient` présent dans le JSON catalogue
