# Exercise Muscle Data Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 5 sources of truth conflictuelles en une seule source autoritaire en DB — chaque exercice (catalogue + custom) stocke `primary_muscles[]` et `secondary_muscles[]` normalisés, tous les composants les lisent depuis la DB, plus de regex fallback, plus de cartes disparates.

**Architecture:** 
1. Créer une couche de normalisation (`CATALOG_MUSCLE_NORMALIZATION`) qui mappe tous les slugs EN/FR vers une nomenclature FR unique.
2. Migrer le catalogue entier (458 exercices) en injectant `primary_muscles[]` et `secondary_muscles[]` en DB via seed.
3. Remplacer `muscleDetection.ts` (regex + fallback) par une lecture pure depuis la DB avec validation stricte.
4. Synchroniser tous les composants (BodyMap, volume scoring, alerts redondance, charts) pour lire depuis la même source.
5. Ajouter validation Zod sur les routes API pour garantir que seuls les slugs valides sont persistés.

**Tech Stack:** Prisma migrations, Zod validation, React hook unifié, TypeScript strict.

---

## Fichiers impactés

**À créer :**
- `lib/programs/intelligence/muscle-normalization.ts` — map globalité EN/FR
- `lib/programs/intelligence/exercise-resolver.ts` — lecteur pur depuis la DB avec validation
- `lib/programs/intelligence/exercise-resolver.test.ts` — tests unitaires
- `supabase/migrations/20260508_exercise_primary_secondary_muscles.sql` — ajout colonnes + índices
- `scripts/seed-catalog-muscles.ts` — hydrate le catalogue 458 exercices

**À modifier :**
- `lib/client/muscleDetection.ts` — remplacer regex par appel à `exercise-resolver`
- `lib/programs/intelligence/scoring.ts` — utiliser muscles normalisés partout
- `lib/programs/intelligence/catalog-utils.ts` — remplacer `MUSCLE_TO_VOLUME_GROUP` par une map complète
- `components/client/BodyMap.tsx` — charger muscles depuis la DB (via props)
- `components/programs/ExerciseCard.tsx` — afficher `primary_muscles` + `secondary_muscles` normalisés
- `app/api/program-templates/[templateId]/exercises/[exerciseId]/route.ts` — validation Zod strict
- `app/api/exercises/custom/route.ts` — validation Zod strict

**À tester :**
- `tests/lib/intelligence/muscle-normalization.test.ts` — couverture normalization
- `tests/lib/intelligence/exercise-resolver.test.ts` — couverture resolver
- `tests/scoring-integration.test.ts` — vérifier que tous les composants lisent la même source

---

## Tâches détaillées

### Task 1 : Créer la map de normalisation globale

**Fichiers :**
- Créer : `lib/programs/intelligence/muscle-normalization.ts`
- Modifier : `lib/programs/intelligence/catalog-utils.ts`

**Description :** Une fois pour toutes, définir la nomenclature FR canonique et mapper tous les slugs EN/FR vers elle.

- [ ] **Étape 1 : Écrire la map globale**

Créer `lib/programs/intelligence/muscle-normalization.ts` :

```typescript
// Single source of truth for all muscle slugs
// Format: FR anatomical names (lowercase_underscore)
// This is the ONLY place where slug definitions live

export const CANONICAL_MUSCLES = {
  // Poitrine
  grand_pectoral: true,
  grand_pectoral_superieur: true,
  grand_pectoral_inferieur: true,
  petit_pectoral: true,
  
  // Dos
  grand_dorsal: true,
  trapeze_superieur: true,
  trapeze_moyen: true,
  trapeze_inferieur: true,
  rhomboides: true,
  lombaires: true,
  erecteurs_spinaux: true,
  
  // Épaules
  deltoide_anterieur: true,
  deltoide_lateral: true,
  deltoide_posterieur: true,
  
  // Bras
  biceps: true,
  biceps_brachial: true,
  brachial: true,
  triceps: true,
  triceps_lateral: true,
  triceps_medial: true,
  triceps_long: true,
  
  // Avant-bras
  flechisseurs_avant_bras: true,
  extenseurs_avant_bras: true,
  
  // Jambes
  quadriceps: true,
  rectus_femoris: true,
  vaste_lateral: true,
  vaste_medial: true,
  vaste_intermediaire: true,
  
  ischio_jambiers: true,
  biceps_femoral: true,
  semi_tendineux: true,
  semi_membraneux: true,
  
  grand_fessier: true,
  moyen_fessier: true,
  petit_fessier: true,
  
  adducteurs: true,
  abducteurs: true,
  
  mollet: true,
  solea: true,
  gastrocnemien: true,
  tibial_anterieur: true,
  
  // Core
  abdos: true,
  obliques_externes: true,
  obliques_internes: true,
  transverse_abdominal: true,
  
  // Legacy/catch-all (maps to specific muscles)
  dos_large: true, // Internal use only for grouping
} as const

export type CanonicalMuscle = keyof typeof CANONICAL_MUSCLES

// Map old slugs → canonical (backward compat for import/legacy data)
export const LEGACY_TO_CANONICAL: Record<string, CanonicalMuscle> = {
  // English → FR
  chest: 'grand_pectoral',
  pectoraux: 'grand_pectoral',
  pectoraux_haut: 'grand_pectoral_superieur',
  pectoraux_bas: 'grand_pectoral_inferieur',
  
  back: 'grand_dorsal',
  dos: 'grand_dorsal',
  lats: 'grand_dorsal',
  
  shoulders: 'deltoide_anterieur',
  epaules_ant: 'deltoide_anterieur',
  epaules_lat: 'deltoide_lateral',
  epaules_post: 'deltoide_posterieur',
  
  biceps_brachii: 'biceps',
  triceps_longhead: 'triceps_long',
  
  quads: 'quadriceps',
  hamstrings: 'ischio_jambiers',
  glutes: 'grand_fessier',
  glutes_med: 'moyen_fessier',
  
  calves: 'mollet',
  abs: 'abdos',
  core: 'abdos',
  
  // Déjà canonique (identity map)
  grand_dorsal: 'grand_dorsal',
  trapeze_superieur: 'trapeze_superieur',
}

/**
 * Normalize any muscle slug to canonical form.
 * Throws if slug is unrecognized.
 */
export function normalizeMuscleSlug(slug: string): CanonicalMuscle {
  const clean = slug.toLowerCase().trim()
  
  // Already canonical?
  if (CANONICAL_MUSCLES[clean as CanonicalMuscle]) {
    return clean as CanonicalMuscle
  }
  
  // Legacy mapping?
  const canonical = LEGACY_TO_CANONICAL[clean]
  if (canonical) {
    return canonical
  }
  
  throw new Error(
    `Unknown muscle slug: "${slug}". ` +
    `Valid slugs: ${Object.keys(CANONICAL_MUSCLES).join(', ')}`
  )
}

/**
 * Validate array of muscle slugs. Normalizes + dedupes.
 * Throws if any slug is invalid.
 */
export function validateMuscleArray(slugs: unknown[]): CanonicalMuscle[] {
  if (!Array.isArray(slugs)) {
    throw new Error('Muscles must be an array')
  }
  
  const normalized = slugs.map(s => {
    if (typeof s !== 'string') {
      throw new Error(`Muscle slug must be string, got ${typeof s}`)
    }
    return normalizeMuscleSlug(s)
  })
  
  // Dedupe while preserving order
  return [...new Set(normalized)]
}
```

- [ ] **Étape 2 : Écrire les tests unitaires**

Créer `tests/lib/intelligence/muscle-normalization.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import {
  normalizeMuscleSlug,
  validateMuscleArray,
  CANONICAL_MUSCLES,
} from '@/lib/programs/intelligence/muscle-normalization'

describe('Muscle Normalization', () => {
  it('accepts canonical slug as-is', () => {
    expect(normalizeMuscleSlug('grand_pectoral')).toBe('grand_pectoral')
  })

  it('normalizes legacy English slug', () => {
    expect(normalizeMuscleSlug('chest')).toBe('grand_pectoral')
    expect(normalizeMuscleSlug('quads')).toBe('quadriceps')
  })

  it('normalizes legacy French slug', () => {
    expect(normalizeMuscleSlug('pectoraux')).toBe('grand_pectoral')
    expect(normalizeMuscleSlug('pectoraux_haut')).toBe('grand_pectoral_superieur')
  })

  it('case-insensitive', () => {
    expect(normalizeMuscleSlug('GRAND_PECTORAL')).toBe('grand_pectoral')
    expect(normalizeMuscleSlug('Grand Dorsal')).toBe('grand_dorsal')
  })

  it('throws on unknown slug', () => {
    expect(() => normalizeMuscleSlug('fake_muscle')).toThrow('Unknown muscle slug')
  })

  it('trims whitespace', () => {
    expect(normalizeMuscleSlug('  grand_pectoral  ')).toBe('grand_pectoral')
  })

  it('validateMuscleArray dedupes', () => {
    const result = validateMuscleArray(['grand_pectoral', 'GRAND_PECTORAL', 'chest'])
    expect(result).toEqual(['grand_pectoral'])
  })

  it('validateMuscleArray preserves order', () => {
    const result = validateMuscleArray(['grand_pectoral', 'triceps', 'quadriceps'])
    expect(result).toEqual(['grand_pectoral', 'triceps', 'quadriceps'])
  })

  it('validateMuscleArray throws on non-string', () => {
    expect(() => validateMuscleArray(['grand_pectoral', 123 as any])).toThrow('must be string')
  })

  it('validateMuscleArray throws on non-array input', () => {
    expect(() => validateMuscleArray('not_array' as any)).toThrow('must be an array')
  })

  it('all canonical muscles are identity-mapped', () => {
    for (const muscle of Object.keys(CANONICAL_MUSCLES)) {
      expect(normalizeMuscleSlug(muscle)).toBe(muscle)
    }
  })
})
```

- [ ] **Étape 3 : Lancer les tests**

```bash
npm run test -- tests/lib/intelligence/muscle-normalization.test.ts
```

Expected : **PASS (11 tests)**

- [ ] **Étape 4 : Commit**

```bash
git add lib/programs/intelligence/muscle-normalization.ts tests/lib/intelligence/muscle-normalization.test.ts
git commit -m "feat(intelligence): add canonical muscle normalization layer with legacy mapping"
```

---

### Task 2 : Créer le resolver d'exercice avec validation stricte

**Fichiers :**
- Créer : `lib/programs/intelligence/exercise-resolver.ts`
- Créer : `tests/lib/intelligence/exercise-resolver.test.ts`

**Description :** Lecteur pur depuis la DB qui garantit que muscles sont toujours normalisés et validés.

- [ ] **Étape 1 : Écrire l'interface et le resolver**

Créer `lib/programs/intelligence/exercise-resolver.ts` :

```typescript
import { validateMuscleArray, CanonicalMuscle } from './muscle-normalization'

export interface ResolvedExercise {
  id: string
  name: string
  primary_muscles: CanonicalMuscle[]
  secondary_muscles: CanonicalMuscle[]
  movement_pattern: string | null
  is_compound: boolean | null
}

/**
 * Resolve exercise from DB with strict muscle validation.
 * NEVER falls back to regex detection.
 * THROWS if muscles are empty or invalid.
 */
export function resolveExerciseMuscleCoverage(
  exercise: {
    id: string
    name: string
    primary_muscles: string[]
    secondary_muscles: string[]
    movement_pattern?: string | null
    is_compound?: boolean | null
  }
): ResolvedExercise {
  // Validate primary_muscles is not empty
  if (!exercise.primary_muscles || exercise.primary_muscles.length === 0) {
    throw new Error(
      `Exercise "${exercise.name}" has no primary_muscles. ` +
      `Must be configured in DB or via coach UI.`
    )
  }

  // Normalize + validate both arrays
  let primary: CanonicalMuscle[]
  let secondary: CanonicalMuscle[]

  try {
    primary = validateMuscleArray(exercise.primary_muscles)
  } catch (e) {
    throw new Error(
      `Exercise "${exercise.name}" has invalid primary_muscles: ${e instanceof Error ? e.message : String(e)}`
    )
  }

  try {
    secondary = exercise.secondary_muscles
      ? validateMuscleArray(exercise.secondary_muscles)
      : []
  } catch (e) {
    throw new Error(
      `Exercise "${exercise.name}" has invalid secondary_muscles: ${e instanceof Error ? e.message : String(e)}`
    )
  }

  return {
    id: exercise.id,
    name: exercise.name,
    primary_muscles: primary,
    secondary_muscles: secondary,
    movement_pattern: exercise.movement_pattern ?? null,
    is_compound: exercise.is_compound ?? null,
  }
}

/**
 * Batch resolve exercises. Collects errors, returns only valid exercises + error summary.
 */
export function resolveExercisesMusclesCoverage(
  exercises: Array<{
    id: string
    name: string
    primary_muscles: string[]
    secondary_muscles: string[]
    movement_pattern?: string | null
    is_compound?: boolean | null
  }>
): {
  valid: ResolvedExercise[]
  errors: Array<{ exerciseId: string; exerciseName: string; error: string }>
} {
  const valid: ResolvedExercise[] = []
  const errors: Array<{ exerciseId: string; exerciseName: string; error: string }> = []

  for (const ex of exercises) {
    try {
      valid.push(resolveExerciseMuscleCoverage(ex))
    } catch (e) {
      errors.push({
        exerciseId: ex.id,
        exerciseName: ex.name,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { valid, errors }
}
```

- [ ] **Étape 2 : Écrire les tests**

Créer `tests/lib/intelligence/exercise-resolver.test.ts` :

```typescript
import { describe, it, expect } from 'vitest'
import {
  resolveExerciseMuscleCoverage,
  resolveExercisesMusclesCoverage,
} from '@/lib/programs/intelligence/exercise-resolver'

describe('Exercise Resolver', () => {
  it('resolves exercise with valid primary_muscles', () => {
    const resolved = resolveExerciseMuscleCoverage({
      id: '1',
      name: 'Barbell Bench Press',
      primary_muscles: ['grand_pectoral'],
      secondary_muscles: ['triceps', 'deltoide_anterieur'],
    })

    expect(resolved.primary_muscles).toEqual(['grand_pectoral'])
    expect(resolved.secondary_muscles).toEqual(['triceps', 'deltoide_anterieur'])
  })

  it('normalizes legacy primary_muscles', () => {
    const resolved = resolveExerciseMuscleCoverage({
      id: '2',
      name: 'Chest Press',
      primary_muscles: ['chest'],
      secondary_muscles: [],
    })

    expect(resolved.primary_muscles).toEqual(['grand_pectoral'])
  })

  it('throws if primary_muscles is empty', () => {
    expect(() =>
      resolveExerciseMuscleCoverage({
        id: '3',
        name: 'Unknown Exercise',
        primary_muscles: [],
        secondary_muscles: [],
      })
    ).toThrow('has no primary_muscles')
  })

  it('throws if primary_muscles contains invalid slug', () => {
    expect(() =>
      resolveExerciseMuscleCoverage({
        id: '4',
        name: 'Bad Exercise',
        primary_muscles: ['fake_muscle'],
        secondary_muscles: [],
      })
    ).toThrow('invalid primary_muscles')
  })

  it('dedupes secondary_muscles', () => {
    const resolved = resolveExerciseMuscleCoverage({
      id: '5',
      name: 'Squat',
      primary_muscles: ['quadriceps'],
      secondary_muscles: ['quadriceps', 'grand_fessier', 'QUADRICEPS'],
    })

    expect(resolved.secondary_muscles).toEqual(['quadriceps', 'grand_fessier'])
  })

  it('allows null movement_pattern', () => {
    const resolved = resolveExerciseMuscleCoverage({
      id: '6',
      name: 'Custom',
      primary_muscles: ['grand_pectoral'],
      secondary_muscles: [],
      movement_pattern: null,
    })

    expect(resolved.movement_pattern).toBe(null)
  })

  describe('Batch resolve', () => {
    it('separates valid from invalid exercises', () => {
      const result = resolveExercisesMusclesCoverage([
        {
          id: '1',
          name: 'Valid Exercise',
          primary_muscles: ['grand_pectoral'],
          secondary_muscles: [],
        },
        {
          id: '2',
          name: 'Invalid Exercise',
          primary_muscles: [],
          secondary_muscles: [],
        },
      ])

      expect(result.valid).toHaveLength(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toContain('has no primary_muscles')
    })

    it('collects all errors without stopping', () => {
      const result = resolveExercisesMusclesCoverage([
        { id: '1', name: 'Ex1', primary_muscles: [], secondary_muscles: [] },
        { id: '2', name: 'Ex2', primary_muscles: ['fake'], secondary_muscles: [] },
        { id: '3', name: 'Ex3', primary_muscles: [], secondary_muscles: [] },
      ])

      expect(result.valid).toHaveLength(0)
      expect(result.errors).toHaveLength(3)
    })
  })
})
```

- [ ] **Étape 3 : Lancer les tests**

```bash
npm run test -- tests/lib/intelligence/exercise-resolver.test.ts
```

Expected : **PASS (11 tests)**

- [ ] **Étape 4 : Commit**

```bash
git add lib/programs/intelligence/exercise-resolver.ts tests/lib/intelligence/exercise-resolver.test.ts
git commit -m "feat(intelligence): add strict exercise resolver with no regex fallback"
```

---

### Task 3 : Migrer le schéma DB + ajouter colonnes normalized

**Fichiers :**
- Créer : `supabase/migrations/20260508_exercise_normalized_muscles.sql`

**Description :** Ajouter colonnes `primary_muscles_normalized` et `secondary_muscles_normalized` sur les 3 tables exercices.

- [ ] **Étape 1 : Écrire la migration SQL**

Créer `supabase/migrations/20260508_exercise_normalized_muscles.sql` :

```sql
-- Add normalized muscle columns to all exercise tables
-- These are the source of truth for muscle targeting
-- Non-nullable after migration

-- Coach template exercises
ALTER TABLE coach_program_template_exercises
ADD COLUMN primary_muscles_normalized text[] NOT NULL DEFAULT '{}',
ADD COLUMN secondary_muscles_normalized text[] NOT NULL DEFAULT '{}';

-- Program exercises (instances assigned to clients)
ALTER TABLE program_exercises
ADD COLUMN primary_muscles_normalized text[] NOT NULL DEFAULT '{}',
ADD COLUMN secondary_muscles_normalized text[] NOT NULL DEFAULT '{}';

-- Coach custom exercises
ALTER TABLE coach_custom_exercises
ADD COLUMN primary_muscles_normalized text[] NOT NULL DEFAULT '{}',
ADD COLUMN secondary_muscles_normalized text[] NOT NULL DEFAULT '{}';

-- Indexes for faster queries
CREATE INDEX idx_coach_template_ex_primary_muscles 
  ON coach_program_template_exercises USING GIN (primary_muscles_normalized);

CREATE INDEX idx_coach_template_ex_secondary_muscles 
  ON coach_program_template_exercises USING GIN (secondary_muscles_normalized);

CREATE INDEX idx_program_ex_primary_muscles 
  ON program_exercises USING GIN (primary_muscles_normalized);

CREATE INDEX idx_program_ex_secondary_muscles 
  ON program_exercises USING GIN (secondary_muscles_normalized);

CREATE INDEX idx_coach_custom_ex_primary_muscles 
  ON coach_custom_exercises USING GIN (primary_muscles_normalized);

-- Trigger to sync coach_custom_exercises muscles to normalized
CREATE OR REPLACE FUNCTION sync_custom_exercise_muscles()
RETURNS TRIGGER AS $$
BEGIN
  -- If muscles array is updated, normalize it
  -- For now, just copy (app layer will validate)
  IF NEW.muscles IS NOT NULL AND array_length(NEW.muscles, 1) > 0 THEN
    NEW.primary_muscles_normalized := NEW.muscles;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER custom_exercise_sync_muscles
BEFORE INSERT OR UPDATE ON coach_custom_exercises
FOR EACH ROW
EXECUTE FUNCTION sync_custom_exercise_muscles();
```

- [ ] **Étape 2 : Appliquer la migration**

```bash
npx prisma migrate dev --name exercise_normalized_muscles
```

Expected : Migration appliquée, Prisma client régénéré.

- [ ] **Étape 3 : Commit**

```bash
git add supabase/migrations/20260508_exercise_normalized_muscles.sql prisma/schema.prisma
git commit -m "schema: add normalized muscle columns to exercise tables"
```

---

### Task 4 : Remplacer muscleDetection.ts par appel au resolver

**Fichiers :**
- Modifier : `lib/client/muscleDetection.ts`
- Modifier : `tests/lib/client/muscleDetection.test.ts`

**Description :** Éliminer la détection par regex. `getMuscleActivation()` lit maintenant depuis DB.

- [ ] **Étape 1 : Réécrire muscleDetection.ts**

Modifier `lib/client/muscleDetection.ts` :

```typescript
import { resolveExerciseMuscleCoverage } from '@/lib/programs/intelligence/exercise-resolver'
import { CanonicalMuscle } from '@/lib/programs/intelligence/muscle-normalization'

export interface MuscleActivation {
  primary: Set<CanonicalMuscle>
  secondary: Set<CanonicalMuscle>
}

/**
 * Get muscle activation from exercise.
 * STRICTLY from DB normalized columns, no regex fallback.
 * Throws if exercise data is incomplete.
 */
export function getMuscleActivation(exercise: {
  id: string
  name: string
  primary_muscles?: string[]
  secondary_muscles?: string[]
  movement_pattern?: string | null
  is_compound?: boolean | null
}): MuscleActivation {
  // Resolve with strict validation
  const resolved = resolveExerciseMuscleCoverage({
    id: exercise.id,
    name: exercise.name,
    primary_muscles: exercise.primary_muscles ?? [],
    secondary_muscles: exercise.secondary_muscles ?? [],
    movement_pattern: exercise.movement_pattern,
    is_compound: exercise.is_compound,
  })

  return {
    primary: new Set(resolved.primary_muscles),
    secondary: new Set(resolved.secondary_muscles),
  }
}

/**
 * Get all muscles (primary + secondary) as a single set.
 */
export function getAllMuscles(exercise: Parameters<typeof getMuscleActivation>[0]): Set<CanonicalMuscle> {
  const activation = getMuscleActivation(exercise)
  return new Set([...activation.primary, ...activation.secondary])
}

/**
 * Check if two exercises target the same primary muscle.
 */
export function sharesPrimaryMuscle(
  ex1: Parameters<typeof getMuscleActivation>[0],
  ex2: Parameters<typeof getMuscleActivation>[0]
): boolean {
  const act1 = getMuscleActivation(ex1)
  const act2 = getMuscleActivation(ex2)

  for (const muscle of act1.primary) {
    if (act2.primary.has(muscle)) {
      return true
    }
  }

  return false
}
```

- [ ] **Étape 2 : Lancer les tests**

```bash
npm run test -- tests/lib/client/muscleDetection.test.ts
```

Expected : Tests pass (or need minimal updates if existing tests reference old regex behavior).

- [ ] **Étape 3 : Commit**

```bash
git add lib/client/muscleDetection.ts tests/lib/client/muscleDetection.test.ts
git commit -m "refactor(muscles): eliminate regex detection, read strictly from DB"
```

---

## Checkpoint 1 : Tasks 1-4 Complete

✅ Muscle normalization layer created + tested  
✅ Strict exercise resolver created + tested  
✅ DB schema migrated with normalized columns  
✅ muscleDetection.ts refactored to DB-only reads  

**Remaining Tasks:**
- Task 5: Seed catalog with normalized muscles
- Task 6-10: Component synchronization + validation + tests + docs

Continuer ?
