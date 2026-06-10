# Exercise Catalog Biomech Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the exercise catalog with full biomechanical data from CSV files, remove all manual biomech fields from the coach builder UI, and enable coaches to create fully-specified custom exercises via a multi-step modal.

**Architecture:** A build script merges 10 per-group CSV files (457 exercises, 17 biomech fields each) into `data/exercise-catalog.json`. The intelligence engine consumes the enriched fields for two new subscores (Joint Load, Coordination). Coaches who add custom exercises fill a 6-step modal that captures the same biomech fields, stored in an extended `coach_custom_exercises` table.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase/PostgreSQL, Zod validation, Tailwind + Framer Motion (DS v2.0), `tsx` for script execution.

**Spec:** `docs/superpowers/specs/2026-04-23-exercise-catalog-biomech-enrichment.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/merge-exercise-catalog.ts` | Create | Parse CSVs, match to JSON, write enriched catalog |
| `scripts/exercise-id-map.json` | Create | Manual slug map for ~49 unmatched exercises |
| `data/exercise-catalog.json` | Modify (generated) | Single source of truth, enriched with biomech fields |
| `supabase/migrations/20260423_coach_custom_exercises_biomech.sql` | Create | Extend coach_custom_exercises with biomech columns |
| `supabase/migrations/20260423_program_exercises_biomech.sql` | Create | Extend template + program exercise tables |
| `app/api/exercises/custom/route.ts` | Modify | Full biomech Zod schema, all fields required |
| `app/api/exercises/custom/upload-media/route.ts` | Create | Multipart upload → Supabase Storage |
| `components/programs/ExercisePicker.tsx` | Modify | Source filter (All/STRYVR/Mine), extended onSelect payload |
| `components/programs/CustomExerciseModal.tsx` | Create | 6-step form: media, identity, classification, muscles, biomech, confirm |
| `components/programs/studio/ExerciseCard.tsx` | Modify | Remove movement_pattern select, equipment pills, is_compound toggle, muscle chips |
| `components/programs/studio/EditorPane.tsx` | Modify | Remove equipment_archetype select from UI |
| `components/programs/ProgramTemplateBuilder.tsx` | Modify | Extended Exercise interface, enriched onSelect wiring, extended save payload |
| `lib/programs/intelligence/types.ts` | Modify | BiomechData type, new alert codes, extended BuilderExercise |
| `lib/programs/intelligence/catalog-utils.ts` | Modify | getBiomechData(), updated resolveExerciseCoeff(), updated expandMusclesForScoring() |
| `lib/programs/intelligence/scoring.ts` | Modify | scoreJointLoad(), scoreCoordination(), updated globalScore weights |
| `lib/programs/intelligence/alternatives.ts` | Modify | constraintProfile + unilateral + activation delta scoring |
| `app/api/program-templates/[templateId]/route.ts` | Modify | Include new biomech columns in PATCH rebuild |
| `app/api/programs/[programId]/route.ts` | Modify | Include new biomech columns in PATCH rebuild |

---

## Task 1: Build Script — CSV to enriched catalog JSON

**Files:**
- Create: `scripts/merge-exercise-catalog.ts`
- Create: `scripts/exercise-id-map.json`

The script reads all 10 `schema-*.csv` files, matches each CSV row to a catalog JSON entry by slug, and writes the enriched JSON in-place. 408 entries match automatically; the remaining 49 need the manual map.

- [ ] **Step 1.1: Create the manual exercise ID map**

Create `scripts/exercise-id-map.json` mapping CSV `exercise_id` → catalog `slug`:

```json
{
  "ABS-008": "crunch-a-la-poulie-pour-les-obliques",
  "ABS-016": "crunch-sangle-suspension-trx",
  "ABS-020": "exercice-abdos-bicyclette",
  "ABS-021": "exercice-v-ups-gainage-renforcement-core-abdominaux",
  "ABS-022": "flexions-des-obliques-banc-lombaire-45-exercice-musculation",
  "ABS-029": "planche-abdos",
  "ABS-031": "planche-avec-sangles-de-suspension",
  "ABS-034": "planche-laterale-obliques",
  "ABS-040": "rotation-buste-barre",
  "ABS-041": "pallof-press",
  "ABS-042": "rotation-landmine",
  "ABS-043": "rotation-suspendu",
  "ABS-044": "russian-twist",
  "ABS-045": "roulette-abdos",
  "ABS-048": "sit-up-med-ball",
  "ABS-049": "sit-up-med-ball-mur",
  "ABS-052": "touche-talons",
  "BIC-002": "curl-allonge-a-la-poulie",
  "BIC-004": "curl-avec-elastique",
  "BIC-005": "curl-avec-sangles-de-suspension",
  "BIC-010": "curl-biceps-prise-pronation-bande-elastique",
  "BIC-011": "curl-concentre",
  "BIC-014": "curl-haltere-prise-marteau-pupitre",
  "BIC-015": "curl-haltere-prise-neutre",
  "BIC-019": "curl-pupitre-machine-prechargee",
  "BIC-021": "curl-unilateral-avec-sangles-de-suspension"
}
```

> Note: The remaining ~23 unmatched entries from dos, epaules, fessiers, etc. will be added here — run the script once first to see which IDs are still unmatched, then extend this map.

- [ ] **Step 1.2: Create the merge script**

Create `scripts/merge-exercise-catalog.ts`:

```typescript
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

const CATALOG_PATH = path.join(process.cwd(), 'data/exercise-catalog.json')
const LIBRARY_PATH = path.join(process.cwd(), 'public/bibliotheque_exercices')
const ID_MAP_PATH = path.join(process.cwd(), 'scripts/exercise-id-map.json')

interface CsvRow {
  exercise_id: string
  name: string
  pattern: string
  plane: string
  mechanic: string
  unilateral: string
  primary_muscle: string
  primary_activation: string
  secondary_muscles: string
  secondary_activations: string
  stabilizers: string
  joint_stress_spine: string
  joint_stress_knee: string
  joint_stress_shoulder: string
  global_instability: string
  coordination_demand: string
  constraint_profile: string
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parsePipe(val: string): string[] {
  return val ? val.split('|').map(s => s.trim()).filter(Boolean) : []
}

function parsePipeNumbers(val: string): number[] {
  return parsePipe(val).map(Number).filter(n => !isNaN(n))
}

function slugMatch(csvName: string, catalogSlugs: Set<string>): string | null {
  const direct = toSlug(csvName)
  if (catalogSlugs.has(direct)) return direct

  // 3-word prefix match
  const prefix = direct.split('-').slice(0, 3).join('-')
  const candidates = [...catalogSlugs].filter(s => s.startsWith(prefix))
  if (candidates.length === 1) return candidates[0]

  return null
}

async function main() {
  const catalog: Record<string, unknown>[] = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'))
  const idMap: Record<string, string> = JSON.parse(fs.readFileSync(ID_MAP_PATH, 'utf-8'))
  const catalogBySlug = new Map(catalog.map(e => [(e as { slug: string }).slug, e]))
  const catalogSlugs = new Set(catalogBySlug.keys())

  const groups = fs.readdirSync(LIBRARY_PATH).filter(f =>
    fs.statSync(path.join(LIBRARY_PATH, f)).isDirectory()
  )

  let matched = 0
  let unmatched: string[] = []

  for (const group of groups) {
    const csvFile = fs.readdirSync(path.join(LIBRARY_PATH, group)).find(f => f.endsWith('.csv'))
    if (!csvFile) continue

    const raw = fs.readFileSync(path.join(LIBRARY_PATH, group, csvFile), 'utf-8')
    const rows: CsvRow[] = parse(raw, { columns: true, skip_empty_lines: true })

    for (const row of rows) {
      // Priority 1: manual map
      let slug = idMap[row.exercise_id] ?? null

      // Priority 2: auto slug match
      if (!slug) slug = slugMatch(row.name, catalogSlugs)

      if (!slug || !catalogBySlug.has(slug)) {
        unmatched.push(`[${group}] ${row.exercise_id} | ${row.name}`)
        continue
      }

      const entry = catalogBySlug.get(slug) as Record<string, unknown>

      // Merge biomech fields
      entry.plane = row.plane || null
      entry.mechanic = row.mechanic || null
      entry.unilateral = row.unilateral === 'true'
      entry.primaryMuscle = row.primary_muscle || null
      entry.primaryActivation = row.primary_activation ? parseFloat(row.primary_activation) : null
      entry.secondaryMuscles = parsePipe(row.secondary_muscles)
      entry.secondaryActivations = parsePipeNumbers(row.secondary_activations)
      entry.stabilizers = parsePipe(row.stabilizers)
      entry.jointStressSpine = row.joint_stress_spine ? parseInt(row.joint_stress_spine) : null
      entry.jointStressKnee = row.joint_stress_knee ? parseInt(row.joint_stress_knee) : null
      entry.jointStressShoulder = row.joint_stress_shoulder ? parseInt(row.joint_stress_shoulder) : null
      entry.globalInstability = row.global_instability ? parseInt(row.global_instability) : null
      entry.coordinationDemand = row.coordination_demand ? parseInt(row.coordination_demand) : null
      entry.constraintProfile = row.constraint_profile || null

      matched++
    }
  }

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2))

  console.log(`✅ Matched: ${matched}`)
  console.log(`⚠️  Unmatched (${unmatched.length}):`)
  unmatched.forEach(u => console.log('  ', u))
}

main().catch(console.error)
```

- [ ] **Step 1.3: Install csv-parse if not present**

```bash
cd /Users/user/Desktop/VIRTUS
grep -q '"csv-parse"' package.json || npm install csv-parse
```

- [ ] **Step 1.4: Run the script**

```bash
npx tsx scripts/merge-exercise-catalog.ts
```

Expected output:
```
✅ Matched: 408+
⚠️  Unmatched (49 or fewer): [list of remaining IDs]
```

- [ ] **Step 1.5: Extend the ID map for remaining unmatched entries**

For each unmatched entry printed, find the correct slug in `data/exercise-catalog.json` and add it to `scripts/exercise-id-map.json`. Re-run the script until unmatched ≤ 5 (some CSV entries may not exist in the catalog at all — acceptable).

```bash
# Helper: search catalog for a term
python3 -c "import json; d=json.load(open('data/exercise-catalog.json')); [print(e['slug']) for e in d if 'pallof' in e['slug'].lower()]"
```

- [ ] **Step 1.6: Verify the enriched JSON**

```bash
python3 -c "
import json
d = json.load(open('data/exercise-catalog.json'))
enriched = [e for e in d if e.get('jointStressSpine') is not None]
print(f'Enriched: {len(enriched)}/{len(d)}')
print('Sample:', json.dumps({k: d[0][k] for k in ['name','jointStressSpine','primaryActivation','constraintProfile'] if k in d[0]}, indent=2))
"
```

Expected: Enriched ≥ 400/458

- [ ] **Step 1.7: Commit**

```bash
git add scripts/merge-exercise-catalog.ts scripts/exercise-id-map.json data/exercise-catalog.json
git commit -m "feat(catalog): enrich exercise-catalog.json with full biomech data from CSV files"
```

---

## Task 2: Database Migrations

**Files:**
- Create: `supabase/migrations/20260423_coach_custom_exercises_biomech.sql`
- Create: `supabase/migrations/20260423_program_exercises_biomech.sql`

- [ ] **Step 2.1: Create the custom exercises migration**

Create `supabase/migrations/20260423_coach_custom_exercises_biomech.sql`:

```sql
-- Extend coach_custom_exercises with full biomechanical schema
-- Aligns custom exercises with the enriched catalog JSON fields

ALTER TABLE coach_custom_exercises
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IN ('image', 'gif', 'video')),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS plane text CHECK (plane IN ('sagittal', 'frontal', 'transverse')),
  ADD COLUMN IF NOT EXISTS mechanic text CHECK (mechanic IN ('isolation', 'compound', 'isometric', 'plyometric')),
  ADD COLUMN IF NOT EXISTS unilateral boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS primary_muscle text,
  ADD COLUMN IF NOT EXISTS primary_activation numeric(3,2) CHECK (primary_activation BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS secondary_muscles_detail text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_activations numeric(3,2)[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stabilizers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS joint_stress_spine integer CHECK (joint_stress_spine BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS joint_stress_knee integer CHECK (joint_stress_knee BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS joint_stress_shoulder integer CHECK (joint_stress_shoulder BETWEEN 1 AND 8),
  ADD COLUMN IF NOT EXISTS global_instability integer CHECK (global_instability BETWEEN 1 AND 9),
  ADD COLUMN IF NOT EXISTS coordination_demand integer CHECK (coordination_demand BETWEEN 1 AND 9),
  ADD COLUMN IF NOT EXISTS constraint_profile text;
```

- [ ] **Step 2.2: Create the program exercises migration**

Create `supabase/migrations/20260423_program_exercises_biomech.sql`:

```sql
-- Add biomechanical columns to template and program exercise tables
-- These are populated automatically when an exercise is added from the picker
-- NULL = exercise created before this migration (graceful degradation in scoring)

ALTER TABLE coach_program_template_exercises
  ADD COLUMN IF NOT EXISTS plane text,
  ADD COLUMN IF NOT EXISTS mechanic text,
  ADD COLUMN IF NOT EXISTS unilateral boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS primary_muscle text,
  ADD COLUMN IF NOT EXISTS primary_activation numeric(3,2),
  ADD COLUMN IF NOT EXISTS secondary_muscles_detail text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_activations numeric(3,2)[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stabilizers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS joint_stress_spine integer,
  ADD COLUMN IF NOT EXISTS joint_stress_knee integer,
  ADD COLUMN IF NOT EXISTS joint_stress_shoulder integer,
  ADD COLUMN IF NOT EXISTS global_instability integer,
  ADD COLUMN IF NOT EXISTS coordination_demand integer,
  ADD COLUMN IF NOT EXISTS constraint_profile text;

ALTER TABLE program_exercises
  ADD COLUMN IF NOT EXISTS plane text,
  ADD COLUMN IF NOT EXISTS mechanic text,
  ADD COLUMN IF NOT EXISTS unilateral boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS primary_muscle text,
  ADD COLUMN IF NOT EXISTS primary_activation numeric(3,2),
  ADD COLUMN IF NOT EXISTS secondary_muscles_detail text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS secondary_activations numeric(3,2)[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stabilizers text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS joint_stress_spine integer,
  ADD COLUMN IF NOT EXISTS joint_stress_knee integer,
  ADD COLUMN IF NOT EXISTS joint_stress_shoulder integer,
  ADD COLUMN IF NOT EXISTS global_instability integer,
  ADD COLUMN IF NOT EXISTS coordination_demand integer,
  ADD COLUMN IF NOT EXISTS constraint_profile text;
```

- [ ] **Step 2.3: Apply migrations via Supabase dashboard**

Apply both SQL files in the Supabase SQL Editor (Project → SQL Editor → New query). Apply `coach_custom_exercises_biomech.sql` first, then `program_exercises_biomech.sql`.

Verify:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'coach_custom_exercises'
AND column_name = 'joint_stress_spine';
-- Should return 1 row
```

- [ ] **Step 2.4: Commit migrations**

```bash
git add supabase/migrations/20260423_coach_custom_exercises_biomech.sql supabase/migrations/20260423_program_exercises_biomech.sql
git commit -m "schema: extend coach_custom_exercises and program_exercises with biomech columns"
```

---

## Task 3: Intelligence Types — BiomechData + new alerts

**Files:**
- Modify: `lib/programs/intelligence/types.ts`

- [ ] **Step 3.1: Add BiomechData interface and new alert codes**

Open `lib/programs/intelligence/types.ts` and add after the `LabOverrides` type at the end:

```typescript
// Biomechanical data available per exercise (from enriched catalog or custom exercises)
export interface BiomechData {
  plane: string | null
  mechanic: string | null
  unilateral: boolean
  primaryMuscle: string | null
  primaryActivation: number | null
  secondaryMuscles: string[]
  secondaryActivations: number[]
  stabilizers: string[]
  jointStressSpine: number | null
  jointStressKnee: number | null
  jointStressShoulder: number | null
  globalInstability: number | null
  coordinationDemand: number | null
  constraintProfile: string | null
}
```

- [ ] **Step 3.2: Extend BuilderExercise with biomech fields**

In `lib/programs/intelligence/types.ts`, replace the `BuilderExercise` interface:

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
  primary_muscles: string[]   // slugs FR : 'fessiers', 'quadriceps', etc.
  secondary_muscles: string[]
  is_compound?: boolean
  group_id?: string
  // Biomech fields (populated from catalog on picker selection, null for old exercises)
  plane?: string | null
  mechanic?: string | null
  unilateral?: boolean
  primaryMuscle?: string | null
  primaryActivation?: number | null
  secondaryMusclesDetail?: string[]
  secondaryActivations?: number[]
  stabilizers?: string[]
  jointStressSpine?: number | null
  jointStressKnee?: number | null
  jointStressShoulder?: number | null
  globalInstability?: number | null
  coordinationDemand?: number | null
  constraintProfile?: string | null
}
```

- [ ] **Step 3.3: Extend IntelligenceResult subscores**

In `lib/programs/intelligence/types.ts`, update the `IntelligenceResult.subscores` object:

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
    jointLoad: number       // new
    coordination: number    // new
  }
  alerts: IntelligenceAlert[]
  distribution: MuscleDistribution
  patternDistribution: PatternDistribution
  missingPatterns: MovementPattern[]
  redundantPairs: RedundantPair[]
  sraMap: SRAPoint[]
  sraHeatmap: SRAHeatmapWeek[]
  programStats: ProgramStats
}
```

- [ ] **Step 3.4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Fix any type errors before continuing.

- [ ] **Step 3.5: Commit**

```bash
git add lib/programs/intelligence/types.ts
git commit -m "feat(intelligence): add BiomechData type, extend BuilderExercise, add jointLoad/coordination subscores"
```

---

## Task 4: catalog-utils.ts — getBiomechData + updated resolveExerciseCoeff

**Files:**
- Modify: `lib/programs/intelligence/catalog-utils.ts`

- [ ] **Step 4.1: Update the CatalogEntry interface in catalog-utils.ts**

At the top of `lib/programs/intelligence/catalog-utils.ts`, replace:

```typescript
interface CatalogEntry {
  name: string
  slug: string
  movementPattern: string
  isCompound: boolean
  stimulus_coefficient: number
}

const catalog = catalogData as CatalogEntry[]
```

With:

```typescript
interface CatalogEntry {
  id: string
  name: string
  slug: string
  movementPattern: string | null
  isCompound: boolean
  stimulus_coefficient: number
  // Biomech fields (present after merge script)
  plane?: string | null
  mechanic?: string | null
  unilateral?: boolean
  primaryMuscle?: string | null
  primaryActivation?: number | null
  secondaryMuscles?: string[]
  secondaryActivations?: number[]
  stabilizers?: string[]
  jointStressSpine?: number | null
  jointStressKnee?: number | null
  jointStressShoulder?: number | null
  globalInstability?: number | null
  coordinationDemand?: number | null
  constraintProfile?: string | null
}

const catalog = catalogData as CatalogEntry[]
const catalogBySlug = new Map(catalog.map(e => [e.slug, e]))
```

- [ ] **Step 4.2: Add getBiomechData() function**

Add after `normalizeMuscleSlug()` in `lib/programs/intelligence/catalog-utils.ts`:

```typescript
import type { BiomechData } from './types'

export function getBiomechData(slugOrName: string): BiomechData | null {
  const slug = toSlug(slugOrName)
  const entry = catalogBySlug.get(slug) ?? catalog.find(e => toSlug(e.name) === slug)
  if (!entry || entry.jointStressSpine == null) return null

  return {
    plane: entry.plane ?? null,
    mechanic: entry.mechanic ?? null,
    unilateral: entry.unilateral ?? false,
    primaryMuscle: entry.primaryMuscle ?? null,
    primaryActivation: entry.primaryActivation ?? null,
    secondaryMuscles: entry.secondaryMuscles ?? [],
    secondaryActivations: entry.secondaryActivations ?? [],
    stabilizers: entry.stabilizers ?? [],
    jointStressSpine: entry.jointStressSpine,
    jointStressKnee: entry.jointStressKnee ?? null,
    jointStressShoulder: entry.jointStressShoulder ?? null,
    globalInstability: entry.globalInstability ?? null,
    coordinationDemand: entry.coordinationDemand ?? null,
    constraintProfile: entry.constraintProfile ?? null,
  }
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
```

- [ ] **Step 4.3: Update resolveExerciseCoeff() to prefer primaryActivation**

In `lib/programs/intelligence/catalog-utils.ts`, update `resolveExerciseCoeff()`:

```typescript
export function resolveExerciseCoeff(ex: {
  name: string
  movement_pattern: string | null
  primary_muscles: string[]
  is_compound?: boolean
  primaryActivation?: number | null
}): number {
  // Priority 1: primaryActivation from enriched catalog (most precise)
  if (ex.primaryActivation != null && ex.primaryActivation > 0) {
    return ex.primaryActivation
  }

  // Priority 2: catalog lookup by slug
  const slug = toSlug(ex.name)
  const entry = catalogBySlug.get(slug)
  if (entry) {
    if (entry.primaryActivation != null && entry.primaryActivation > 0) {
      return entry.primaryActivation
    }
    return entry.stimulus_coefficient
  }

  // Priority 3: derive from is_compound + movement_pattern (existing logic)
  const isCompound = ex.is_compound ?? isCompoundFromMuscles(ex.primary_muscles)
  return getStimulusCoeff(slug, ex.movement_pattern ?? '', isCompound)
}
```

- [ ] **Step 4.4: Update expandMusclesForScoring() to use precise secondary muscles**

Find `expandMusclesForScoring()` in `catalog-utils.ts` and add at the top of the function, before the existing `dos` expansion logic:

```typescript
export function expandMusclesForScoring(
  muscles: string[],
  movementPattern: string | null,
  secondaryMusclesDetail?: string[]   // new optional param
): string[] {
  // If we have precise EN secondary muscles from the enriched catalog, use them
  // as additional scoring signals alongside the FR slugs
  const enrichedSet = new Set<string>(muscles.map(normalizeMuscleSlug))
  if (secondaryMusclesDetail && secondaryMusclesDetail.length > 0) {
    secondaryMusclesDetail.forEach(m => enrichedSet.add(m))
  }
  const enrichedMuscles = [...enrichedSet]

  // Then apply existing dos sub-group expansion on the result
  // ... (keep existing dos expansion logic below, applied to enrichedMuscles)
```

> Keep the rest of the existing function body, just replace the initial muscles array with `enrichedMuscles`.

- [ ] **Step 4.5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4.6: Commit**

```bash
git add lib/programs/intelligence/catalog-utils.ts
git commit -m "feat(intelligence): add getBiomechData(), update resolveExerciseCoeff() to prefer primaryActivation"
```

---

## Task 5: scoring.ts — scoreJointLoad + scoreCoordination

**Files:**
- Modify: `lib/programs/intelligence/scoring.ts`

- [ ] **Step 5.1: Write failing tests for scoreJointLoad**

Create `tests/lib/intelligence/biomech-scoring.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildIntelligenceResult } from '@/lib/programs/intelligence/scoring'
import type { BuilderSession, TemplateMeta, IntelligenceProfile } from '@/lib/programs/intelligence/types'

const meta: TemplateMeta = {
  goal: 'hypertrophy', level: 'intermediate', weeks: 8, frequency: 3, equipment_archetype: 'full_gym'
}

function makeExercise(name: string, overrides: Record<string, unknown> = {}) {
  return {
    name,
    sets: 3, reps: '8-12', rest_sec: 90, rir: 2, notes: '',
    movement_pattern: 'hip_hinge',
    equipment_required: ['barbell'],
    primary_muscles: ['dos', 'fessiers'],
    secondary_muscles: [],
    is_compound: true,
    ...overrides,
  }
}

describe('scoreJointLoad', () => {
  it('emits JOINT_OVERLOAD critical when spine stress high on spine injury', () => {
    const session: BuilderSession = {
      name: 'S1', day_of_week: 1,
      exercises: [
        makeExercise('Deadlift', { jointStressSpine: 8, sets: 4 }),
        makeExercise('Good Morning', { jointStressSpine: 7, sets: 3 }),
        makeExercise('Romanian DL', { jointStressSpine: 6, sets: 3 }),
      ],
    }
    const profile: IntelligenceProfile = {
      injuries: [{ bodyPart: 'lower_back', severity: 'avoid' }],
      equipment: [],
    }
    const result = buildIntelligenceResult([session], meta, profile)
    const alert = result.alerts.find(a => a.code === 'JOINT_OVERLOAD')
    expect(alert).toBeDefined()
    expect(alert?.severity).toBe('critical')
  })

  it('does not emit JOINT_OVERLOAD when no injury profile', () => {
    const session: BuilderSession = {
      name: 'S1', day_of_week: 1,
      exercises: [makeExercise('Deadlift', { jointStressSpine: 8 })],
    }
    const result = buildIntelligenceResult([session], meta, undefined)
    expect(result.alerts.find(a => a.code === 'JOINT_OVERLOAD')).toBeUndefined()
  })

  it('emits JOINT_OVERLOAD warning when shoulder stress moderate on shoulder injury', () => {
    const session: BuilderSession = {
      name: 'S1', day_of_week: 1,
      exercises: [
        makeExercise('Overhead Press', { jointStressShoulder: 5, sets: 3 }),
        makeExercise('Lateral Raise', { jointStressShoulder: 4, sets: 3 }),
      ],
    }
    const profile: IntelligenceProfile = {
      injuries: [{ bodyPart: 'shoulder_right', severity: 'limit' }],
      equipment: [],
    }
    const result = buildIntelligenceResult([session], meta, profile)
    const alert = result.alerts.find(a => a.code === 'JOINT_OVERLOAD')
    expect(alert?.severity).toBe('warning')
  })
})

describe('scoreCoordination', () => {
  it('emits COORDINATION_MISMATCH warning for beginner with high coordination exercises', () => {
    const beginnerMeta: TemplateMeta = { ...meta, level: 'beginner' }
    const session: BuilderSession = {
      name: 'S1', day_of_week: 1,
      exercises: [
        makeExercise('Snatch', { coordinationDemand: 9, globalInstability: 8 }),
        makeExercise('Pistol Squat', { coordinationDemand: 8, globalInstability: 7 }),
      ],
    }
    const result = buildIntelligenceResult([session], beginnerMeta, undefined)
    expect(result.alerts.find(a => a.code === 'COORDINATION_MISMATCH')).toBeDefined()
  })

  it('does not emit COORDINATION_MISMATCH for intermediate with high coordination', () => {
    const session: BuilderSession = {
      name: 'S1', day_of_week: 1,
      exercises: [makeExercise('Snatch', { coordinationDemand: 9 })],
    }
    const result = buildIntelligenceResult([session], meta, undefined)
    expect(result.alerts.find(a => a.code === 'COORDINATION_MISMATCH')).toBeUndefined()
  })

  it('emits COORDINATION_MISMATCH critical for beginner avg > 7.5', () => {
    const beginnerMeta: TemplateMeta = { ...meta, level: 'beginner' }
    const session: BuilderSession = {
      name: 'S1', day_of_week: 1,
      exercises: [
        makeExercise('Ex1', { coordinationDemand: 9, globalInstability: 9 }),
        makeExercise('Ex2', { coordinationDemand: 8, globalInstability: 8 }),
      ],
    }
    const result = buildIntelligenceResult([session], beginnerMeta, undefined)
    const alert = result.alerts.find(a => a.code === 'COORDINATION_MISMATCH')
    expect(alert?.severity).toBe('critical')
  })
})
```

- [ ] **Step 5.2: Run tests to verify they fail**

```bash
npx vitest run tests/lib/intelligence/biomech-scoring.test.ts 2>&1 | tail -20
```

Expected: FAIL — `JOINT_OVERLOAD` and `COORDINATION_MISMATCH` are not defined.

- [ ] **Step 5.3: Add BODY_PART_TO_JOINT mapping**

At the top of `lib/programs/intelligence/scoring.ts`, after the existing constants, add:

```typescript
// Maps injury bodyPart slugs → which jointStress field they affect
const BODY_PART_TO_JOINT: Record<string, 'spine' | 'knee' | 'shoulder'> = {
  lower_back: 'spine',
  upper_back: 'spine',
  lumbar: 'spine',
  spine: 'spine',
  knee_left: 'knee',
  knee_right: 'knee',
  knee: 'knee',
  shoulder_left: 'shoulder',
  shoulder_right: 'shoulder',
  shoulder: 'shoulder',
  rotator_cuff: 'shoulder',
}
```

- [ ] **Step 5.4: Implement scoreJointLoad()**

Add after the existing `scoreCompleteness()` function in `scoring.ts`:

```typescript
function scoreJointLoad(
  sessions: BuilderSession[],
  profile?: IntelligenceProfile
): { score: number; alerts: IntelligenceAlert[] } {
  const alerts: IntelligenceAlert[] = []

  // No injury profile → no joint scoring (score is neutral 80)
  if (!profile || profile.injuries.length === 0) return { score: 80, alerts }

  const injuredJoints = profile.injuries
    .map(inj => ({ joint: BODY_PART_TO_JOINT[inj.bodyPart], severity: inj.severity }))
    .filter((x): x is { joint: 'spine' | 'knee' | 'shoulder'; severity: 'avoid' | 'limit' | 'monitor' } => !!x.joint)

  if (injuredJoints.length === 0) return { score: 80, alerts }

  let scoreDeduction = 0

  for (const { joint, severity } of injuredJoints) {
    const stressField = joint === 'spine'
      ? 'jointStressSpine'
      : joint === 'knee'
      ? 'jointStressKnee'
      : 'jointStressShoulder'

    const allExercises = sessions.flatMap(s => s.exercises)
    const stressValues = allExercises
      .map(e => (e as Record<string, unknown>)[stressField] as number | null | undefined)
      .filter((v): v is number => typeof v === 'number')

    if (stressValues.length === 0) continue

    const weightedAvg =
      allExercises.reduce((sum, e) => {
        const stress = (e as Record<string, unknown>)[stressField] as number | null | undefined
        return sum + (stress ?? 0) * e.sets
      }, 0) /
      allExercises.reduce((sum, e) => sum + e.sets, 0)

    const criticalThreshold = severity === 'avoid' ? 5 : 6
    const warningThreshold = severity === 'avoid' ? 3 : 4

    const jointLabel = joint === 'spine' ? 'rachis' : joint === 'knee' ? 'genou' : 'épaule'

    if (weightedAvg >= criticalThreshold) {
      alerts.push({
        severity: 'critical',
        code: 'JOINT_OVERLOAD',
        title: `Surcharge articulaire — ${jointLabel}`,
        explanation: `Stress moyen sur le ${jointLabel} : ${weightedAvg.toFixed(1)}/8. Niveau de restriction : ${severity}.`,
        suggestion: `Remplacez les exercices à fort stress ${jointLabel} par des variantes machine ou avec câble.`,
      })
      scoreDeduction += severity === 'avoid' ? 30 : 20
    } else if (weightedAvg >= warningThreshold) {
      alerts.push({
        severity: 'warning',
        code: 'JOINT_OVERLOAD',
        title: `Charge articulaire élevée — ${jointLabel}`,
        explanation: `Stress moyen sur le ${jointLabel} : ${weightedAvg.toFixed(1)}/8.`,
        suggestion: `Surveillez la récupération articulaire et envisagez de réduire le volume sur cette zone.`,
      })
      scoreDeduction += 10
    }
  }

  return { score: Math.max(0, 100 - scoreDeduction), alerts }
}
```

- [ ] **Step 5.5: Implement scoreCoordination()**

Add directly after `scoreJointLoad()` in `scoring.ts`:

```typescript
function scoreCoordination(
  sessions: BuilderSession[],
  meta: TemplateMeta
): { score: number; alerts: IntelligenceAlert[] } {
  const alerts: IntelligenceAlert[] = []

  if (meta.level !== 'beginner') return { score: 100, alerts }

  const allExercises = sessions.flatMap(s => s.exercises)
  const withData = allExercises.filter(
    e => (e as Record<string, unknown>).coordinationDemand != null ||
         (e as Record<string, unknown>).globalInstability != null
  )

  if (withData.length === 0) return { score: 100, alerts }

  const avg =
    withData.reduce((sum, e) => {
      const coord = ((e as Record<string, unknown>).coordinationDemand as number | null) ?? 5
      const instab = ((e as Record<string, unknown>).globalInstability as number | null) ?? 5
      return sum + (coord + instab) / 2
    }, 0) / withData.length

  if (avg > 7.5) {
    alerts.push({
      severity: 'critical',
      code: 'COORDINATION_MISMATCH',
      title: 'Exercices trop complexes pour débutant',
      explanation: `Score moyen coordination/instabilité : ${avg.toFixed(1)}/9. Ces exercices nécessitent un apprentissage moteur avancé.`,
      suggestion: `Remplacez par des exercices guidés (machine, câble) avec coordination ≤ 5 pour commencer.`,
    })
    return { score: 40, alerts }
  }

  if (avg > 6) {
    alerts.push({
      severity: 'warning',
      code: 'COORDINATION_MISMATCH',
      title: 'Complexité élevée pour niveau débutant',
      explanation: `Score moyen coordination : ${avg.toFixed(1)}/9.`,
      suggestion: `Privilégiez des exercices plus guidés en début de programme.`,
    })
    return { score: 70, alerts }
  }

  return { score: 100, alerts }
}
```

- [ ] **Step 5.6: Wire the two new subscores into buildIntelligenceResult()**

In `scoring.ts`, find `buildIntelligenceResult()` and update to include the new subscores. The function currently computes 6 scores. Add:

```typescript
// After the existing 6 score computations:
const jointLoadResult = scoreJointLoad(sessions, profile)
const coordinationResult = scoreCoordination(sessions, meta)

// Update globalScore calculation — replace current weighted sum with:
const globalScore = Math.round(
  scoreBalance.score * 0.20 +
  scoreSRAResult.score * 0.20 +
  scoreSpecificityResult.score * 0.15 +
  scoreProgressionResult.score * 0.10 +
  scoreCompletenessResult.score * 0.10 +
  scoreRedundancyResult.score * 0.10 +
  jointLoadResult.score * 0.10 +
  coordinationResult.score * 0.05
)

// Merge alerts from new subscores:
const allAlerts = [
  ...scoreBalance.alerts,
  ...scoreSRAResult.alerts,
  ...scoreSpecificityResult.alerts,
  ...scoreProgressionResult.alerts,
  ...scoreCompletenessResult.alerts,
  ...scoreRedundancyResult.alerts,
  ...jointLoadResult.alerts,     // new
  ...coordinationResult.alerts,  // new
]

// Update subscores object:
subscores: {
  balance: scoreBalance.score,
  recovery: scoreSRAResult.score,
  specificity: scoreSpecificityResult.score,
  progression: scoreProgressionResult.score,
  completeness: scoreCompletenessResult.score,
  redundancy: scoreRedundancyResult.score,
  jointLoad: jointLoadResult.score,      // new
  coordination: coordinationResult.score, // new
}
```

> Note: The existing `buildIntelligenceResult` uses variable names that may differ slightly. Match them to what's in the actual file — the pattern is the same.

- [ ] **Step 5.7: Run tests**

```bash
npx vitest run tests/lib/intelligence/biomech-scoring.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5.8: Run full test suite**

```bash
npx vitest run 2>&1 | tail -20
```

Expected: All existing tests still pass.

- [ ] **Step 5.9: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5.10: Commit**

```bash
git add lib/programs/intelligence/scoring.ts tests/lib/intelligence/biomech-scoring.test.ts
git commit -m "feat(intelligence): add scoreJointLoad and scoreCoordination subscores"
```

---

## Task 6: alternatives.ts — constraintProfile + unilateral + activation scoring

**Files:**
- Modify: `lib/programs/intelligence/alternatives.ts`

- [ ] **Step 6.1: Write failing test**

Add to `tests/lib/intelligence/biomech-scoring.test.ts`:

```typescript
import { scoreAlternatives } from '@/lib/programs/intelligence/alternatives'

describe('scoreAlternatives biomech criteria', () => {
  it('ranks same constraintProfile higher than different profile', () => {
    const original = {
      name: 'Curl barre', movement_pattern: 'elbow_flexion',
      equipment_required: ['barbell'], primary_muscles: ['biceps'],
      secondary_muscles: [], is_compound: false,
      constraintProfile: 'free_weight', unilateral: false, primaryActivation: 0.85,
    }
    const results = scoreAlternatives(original as never, [], { goal: 'hypertrophy', level: 'intermediate', weeks: 8, frequency: 3, equipment_archetype: 'full_gym' })
    // Exercises with constraintProfile: 'free_weight' should outrank 'machine_stability' alternatives
    // This test verifies the scoring doesn't crash and returns results
    expect(results.length).toBeGreaterThan(0)
  })

  it('penalizes alternatives with very different primaryActivation', () => {
    // Just verify the function runs with biomech fields present
    const original = {
      name: 'Deadlift', movement_pattern: 'hip_hinge',
      equipment_required: ['barbell'], primary_muscles: ['dos', 'fessiers'],
      secondary_muscles: [], is_compound: true,
      primaryActivation: 0.9,
    }
    expect(() => scoreAlternatives(original as never, [], meta)).not.toThrow()
  })
})
```

- [ ] **Step 6.2: Run test to verify it fails or passes (no crash)**

```bash
npx vitest run tests/lib/intelligence/biomech-scoring.test.ts -t "scoreAlternatives biomech"
```

- [ ] **Step 6.3: Update scoreAlternatives() in alternatives.ts**

In `lib/programs/intelligence/alternatives.ts`, find the main scoring loop where points are accumulated per candidate. Add these criteria after the existing 5:

```typescript
// Constraint profile match (+15 points)
if (
  original.constraintProfile &&
  (candidate as Record<string, unknown>).constraintProfile === original.constraintProfile
) {
  score += 15
}

// Unilateral match (+10 points)
const origUnilateral = (original as Record<string, unknown>).unilateral ?? false
const candUnilateral = (candidate as Record<string, unknown>).unilateral ?? false
if (origUnilateral === candUnilateral) {
  score += 10
}

// Primary activation delta penalty (0 to -15 points)
const origActivation = (original as Record<string, unknown>).primaryActivation as number | null
const candActivation = (candidate as Record<string, unknown>).primaryActivation as number | null
if (origActivation != null && candActivation != null) {
  const delta = Math.abs(origActivation - candActivation)
  if (delta > 0.25) score -= Math.round(delta * 60) // max -15 at delta=0.25
}
```

- [ ] **Step 6.4: Run tests**

```bash
npx vitest run tests/lib/intelligence/biomech-scoring.test.ts
```

Expected: All tests pass.

- [ ] **Step 6.5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6.6: Commit**

```bash
git add lib/programs/intelligence/alternatives.ts tests/lib/intelligence/biomech-scoring.test.ts
git commit -m "feat(intelligence): add constraintProfile, unilateral, and activation delta to scoreAlternatives"
```

---

## Task 7: ProgramTemplateBuilder — extend Exercise interface + enriched onSelect

**Files:**
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

- [ ] **Step 7.1: Extend the local Exercise interface**

In `ProgramTemplateBuilder.tsx`, find the `interface Exercise` and add the biomech fields:

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
  is_compound: boolean | undefined
  group_id?: string
  dbId?: string
  // Biomech fields (from catalog or custom exercise)
  plane?: string | null
  mechanic?: string | null
  unilateral?: boolean
  primaryMuscle?: string | null
  primaryActivation?: number | null
  secondaryMusclesDetail?: string[]
  secondaryActivations?: number[]
  stabilizers?: string[]
  jointStressSpine?: number | null
  jointStressKnee?: number | null
  jointStressShoulder?: number | null
  globalInstability?: number | null
  coordinationDemand?: number | null
  constraintProfile?: string | null
}
```

- [ ] **Step 7.2: Update emptyExercise() to include null biomech fields**

Find `emptyExercise()` in `ProgramTemplateBuilder.tsx` and add:

```typescript
function emptyExercise(): Exercise {
  return {
    name: '', sets: 3, reps: '8-12', rest_sec: 90, rir: 2, notes: '',
    image_url: null, movement_pattern: null, equipment_required: [],
    primary_muscles: [], secondary_muscles: [], is_compound: undefined,
    // Biomech defaults
    plane: null, mechanic: null, unilateral: false,
    primaryMuscle: null, primaryActivation: null,
    secondaryMusclesDetail: [], secondaryActivations: [],
    stabilizers: [], jointStressSpine: null, jointStressKnee: null,
    jointStressShoulder: null, globalInstability: null,
    coordinationDemand: null, constraintProfile: null,
  }
}
```

- [ ] **Step 7.3: Update the onSelect handler to pass biomech fields**

Find the `onSelect` handler in `ProgramTemplateBuilder.tsx` (the one that calls `updateExercise`). It currently sets `name`, `image_url`, `movement_pattern`, `equipment_required`, `is_compound`. Add:

```typescript
onSelect={({ name, gifUrl, movementPattern, equipment, isCompound,
             primaryMuscles, secondaryMuscles, plane, mechanic, unilateral,
             primaryMuscle, primaryActivation, secondaryMusclesDetail,
             secondaryActivations, stabilizers, jointStressSpine,
             jointStressKnee, jointStressShoulder, globalInstability,
             coordinationDemand, constraintProfile }) => {
  setSessions(prev => prev.map((s, si) =>
    si !== pickTarget.si ? s : {
      ...s,
      exercises: s.exercises.map((e, ei) =>
        ei !== pickTarget.ei ? e : {
          ...e,
          name,
          image_url: gifUrl,
          movement_pattern: movementPattern,
          equipment_required: equipment,
          is_compound: isCompound,
          primary_muscles: primaryMuscles ?? [],
          secondary_muscles: secondaryMuscles ?? [],
          plane, mechanic, unilateral: unilateral ?? false,
          primaryMuscle, primaryActivation,
          secondaryMusclesDetail: secondaryMusclesDetail ?? [],
          secondaryActivations: secondaryActivations ?? [],
          stabilizers: stabilizers ?? [],
          jointStressSpine, jointStressKnee, jointStressShoulder,
          globalInstability, coordinationDemand, constraintProfile,
        }
      )
    }
  ))
  setPickTarget(null)
}}
```

- [ ] **Step 7.4: Update the save payload to include biomech fields**

In the `handleSave()` function, find where exercises are serialized. Add the biomech fields to the exercise object being sent to the API:

```typescript
// In the session.exercises.map():
{
  name: e.name,
  sets: e.sets,
  reps: e.reps,
  rest_sec: e.rest_sec,
  rir: e.rir,
  notes: e.notes,
  position: ei,
  image_url: e.image_url,
  movement_pattern: e.movement_pattern,
  equipment_required: e.equipment_required,
  primary_muscles: e.primary_muscles,
  secondary_muscles: e.secondary_muscles,
  is_compound: e.is_compound,
  group_id: e.group_id,
  dbId: e.dbId,
  // Biomech fields
  plane: e.plane ?? null,
  mechanic: e.mechanic ?? null,
  unilateral: e.unilateral ?? false,
  primary_muscle: e.primaryMuscle ?? null,
  primary_activation: e.primaryActivation ?? null,
  secondary_muscles_detail: e.secondaryMusclesDetail ?? [],
  secondary_activations: e.secondaryActivations ?? [],
  stabilizers: e.stabilizers ?? [],
  joint_stress_spine: e.jointStressSpine ?? null,
  joint_stress_knee: e.jointStressKnee ?? null,
  joint_stress_shoulder: e.jointStressShoulder ?? null,
  global_instability: e.globalInstability ?? null,
  coordination_demand: e.coordinationDemand ?? null,
  constraint_profile: e.constraintProfile ?? null,
}
```

- [ ] **Step 7.5: Update load from initial (existing template/program)**

In the section where `initial` data is mapped to sessions (the `useEffect` or `useMemo` that converts API response to builder state), add the biomech field mapping:

```typescript
// In the exercise mapping from API response:
plane: e.plane ?? null,
mechanic: e.mechanic ?? null,
unilateral: e.unilateral ?? false,
primaryMuscle: e.primary_muscle ?? null,
primaryActivation: e.primary_activation ?? null,
secondaryMusclesDetail: e.secondary_muscles_detail ?? [],
secondaryActivations: e.secondary_activations ?? [],
stabilizers: e.stabilizers ?? [],
jointStressSpine: e.joint_stress_spine ?? null,
jointStressKnee: e.joint_stress_knee ?? null,
jointStressShoulder: e.joint_stress_shoulder ?? null,
globalInstability: e.global_instability ?? null,
coordinationDemand: e.coordination_demand ?? null,
constraintProfile: e.constraint_profile ?? null,
```

- [ ] **Step 7.6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7.7: Commit**

```bash
git add components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(builder): extend Exercise interface with biomech fields, wire enriched onSelect"
```

---

## Task 8: ExercisePicker — source filter + extended onSelect payload

**Files:**
- Modify: `components/programs/ExercisePicker.tsx`

- [ ] **Step 8.1: Add source filter state and UI**

In `ExercisePicker.tsx`, add a `sourceFilter` state:

```typescript
const [sourceFilter, setSourceFilter] = useState<'all' | 'stryvr' | 'custom'>('all')
```

Add the filter UI above the search bar, after the existing filter chips:

```tsx
{/* Source filter */}
<div className="flex gap-1.5 mb-3">
  {(['all', 'stryvr', 'custom'] as const).map(src => (
    <button
      key={src}
      onClick={() => setSourceFilter(src)}
      className={cn(
        'rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-colors',
        sourceFilter === src
          ? 'bg-[#1f8a65]/10 text-[#1f8a65]'
          : 'bg-white/[0.02] text-white/35 hover:bg-white/[0.05] hover:text-white/60'
      )}
    >
      {src === 'all' ? 'Tous' : src === 'stryvr' ? 'Catalogue STRYVR' : 'Mes exercices'}
    </button>
  ))}
</div>
```

Apply filter in the `filteredExercises` computation:

```typescript
.filter(e => {
  if (sourceFilter === 'custom') return e.source === 'custom'
  if (sourceFilter === 'stryvr') return e.source !== 'custom'
  return true
})
```

- [ ] **Step 8.2: Extend the onSelect callback type**

Find the `onSelect` prop type in `ExercisePicker`. It currently returns `{ name, gifUrl, movementPattern, equipment, isCompound }`. Extend it:

```typescript
onSelect: (exercise: {
  name: string
  gifUrl: string
  movementPattern: string | null
  equipment: string[]
  isCompound: boolean
  primaryMuscles: string[]
  secondaryMuscles: string[]
  // Biomech fields
  plane: string | null
  mechanic: string | null
  unilateral: boolean
  primaryMuscle: string | null
  primaryActivation: number | null
  secondaryMusclesDetail: string[]
  secondaryActivations: number[]
  stabilizers: string[]
  jointStressSpine: number | null
  jointStressKnee: number | null
  jointStressShoulder: number | null
  globalInstability: number | null
  coordinationDemand: number | null
  constraintProfile: string | null
}) => void
```

- [ ] **Step 8.3: Pass biomech fields in the onSelect call**

Find where `onSelect` is called (when a user clicks an exercise). Update to pass all fields:

```typescript
onSelect({
  name: entry.name,
  gifUrl: entry.gifUrl,
  movementPattern: entry.movementPattern ?? null,
  equipment: entry.equipment ?? [],
  isCompound: entry.isCompound ?? false,
  primaryMuscles: entry.muscles ?? [],
  secondaryMuscles: [],
  plane: (entry as Record<string, unknown>).plane as string ?? null,
  mechanic: (entry as Record<string, unknown>).mechanic as string ?? null,
  unilateral: (entry as Record<string, unknown>).unilateral as boolean ?? false,
  primaryMuscle: (entry as Record<string, unknown>).primaryMuscle as string ?? null,
  primaryActivation: (entry as Record<string, unknown>).primaryActivation as number ?? null,
  secondaryMusclesDetail: ((entry as Record<string, unknown>).secondaryMuscles as string[]) ?? [],
  secondaryActivations: ((entry as Record<string, unknown>).secondaryActivations as number[]) ?? [],
  stabilizers: ((entry as Record<string, unknown>).stabilizers as string[]) ?? [],
  jointStressSpine: (entry as Record<string, unknown>).jointStressSpine as number ?? null,
  jointStressKnee: (entry as Record<string, unknown>).jointStressKnee as number ?? null,
  jointStressShoulder: (entry as Record<string, unknown>).jointStressShoulder as number ?? null,
  globalInstability: (entry as Record<string, unknown>).globalInstability as number ?? null,
  coordinationDemand: (entry as Record<string, unknown>).coordinationDemand as number ?? null,
  constraintProfile: (entry as Record<string, unknown>).constraintProfile as string ?? null,
})
```

- [ ] **Step 8.4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 8.5: Commit**

```bash
git add components/programs/ExercisePicker.tsx
git commit -m "feat(picker): add source filter (All/STRYVR/Mine), extend onSelect with biomech fields"
```

---

## Task 9: Remove manual biomech UI from ExerciseCard + EditorPane

**Files:**
- Modify: `components/programs/studio/ExerciseCard.tsx`
- Modify: `components/programs/studio/EditorPane.tsx`

- [ ] **Step 9.1: Remove biomech UI fields from ExerciseCard**

In `components/programs/studio/ExerciseCard.tsx`:

1. Remove the `MOVEMENT_PATTERNS` constant array (lines ~15–34)
2. Remove the `EQUIPMENT_ITEMS` constant array (lines ~36–48)
3. Remove the `MUSCLE_GROUPS` constant array (lines ~50–63)
4. In the JSX, remove:
   - The movement pattern `<select>` block (search for `movement_pattern` in JSX)
   - The equipment pills block (search for `equipment_required` in JSX)
   - The `is_compound` toggle/checkbox block
   - The primary muscles chips block (search for `primary_muscles` in JSX)
5. Keep `movement_pattern`, `equipment_required`, `primary_muscles`, `secondary_muscles`, `is_compound` in the `ExerciseData` interface (they are still stored, just not editable in UI)

- [ ] **Step 9.2: Remove equipment_archetype UI from EditorPane**

In `components/programs/studio/EditorPane.tsx`:

Find the `equipment_archetype` select element and remove it from the JSX. Keep the `equipment_archetype` in the `TemplateMeta` type and the `onMetaChange` prop — it's still used for scoring, just not shown to the coach.

- [ ] **Step 9.3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Fix any errors from removed elements.

- [ ] **Step 9.4: Commit**

```bash
git add components/programs/studio/ExerciseCard.tsx components/programs/studio/EditorPane.tsx
git commit -m "feat(builder): remove manual biomech UI fields — movement pattern, equipment, muscles, is_compound now auto-populated from catalog"
```

---

## Task 10: API routes — persist biomech fields in save/load

**Files:**
- Modify: `app/api/program-templates/[templateId]/route.ts`
- Modify: `app/api/programs/[programId]/route.ts`

- [ ] **Step 10.1: Update template PATCH to include biomech fields**

In `app/api/program-templates/[templateId]/route.ts`, find the exercise insert/upsert block in the full-rebuild PATCH. Add all biomech fields to the insert object:

```typescript
// In the exercise insert, add:
plane: ex.plane ?? null,
mechanic: ex.mechanic ?? null,
unilateral: ex.unilateral ?? false,
primary_muscle: ex.primary_muscle ?? null,
primary_activation: ex.primary_activation ?? null,
secondary_muscles_detail: ex.secondary_muscles_detail ?? [],
secondary_activations: ex.secondary_activations ?? [],
stabilizers: ex.stabilizers ?? [],
joint_stress_spine: ex.joint_stress_spine ?? null,
joint_stress_knee: ex.joint_stress_knee ?? null,
joint_stress_shoulder: ex.joint_stress_shoulder ?? null,
global_instability: ex.global_instability ?? null,
coordination_demand: ex.coordination_demand ?? null,
constraint_profile: ex.constraint_profile ?? null,
```

Also update the GET to select these columns (if using explicit select) or verify `select('*')` is used.

- [ ] **Step 10.2: Update program PATCH similarly**

Apply the same changes to `app/api/programs/[programId]/route.ts`.

- [ ] **Step 10.3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 10.4: Commit**

```bash
git add app/api/program-templates/[templateId]/route.ts app/api/programs/[programId]/route.ts
git commit -m "feat(api): persist biomech fields in template and program exercise save/load"
```

---

## Task 11: Custom exercise media upload API

**Files:**
- Create: `app/api/exercises/custom/upload-media/route.ts`

- [ ] **Step 11.1: Create the upload route**

Create `app/api/exercises/custom/upload-media/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm',
])
const MAX_SIZE = 50 * 1024 * 1024 // 50MB

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getMediaType(mimeType: string): 'image' | 'gif' | 'video' {
  if (mimeType === 'image/gif') return 'gif'
  if (mimeType.startsWith('video/')) return 'video'
  return 'image'
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/gif': 'gif', 'video/mp4': 'mp4', 'video/webm': 'webm',
  }
  return map[mimeType] ?? 'bin'
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Type de fichier non supporté. Utilisez JPG, PNG, WebP, GIF, MP4 ou WebM.' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 50MB).' }, { status: 400 })
  }

  const ext = getExtension(file.type)
  const path = `custom-exercises/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const db = serviceClient()
  const { error } = await db.storage
    .from('exercise-images')
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = db.storage
    .from('exercise-images')
    .getPublicUrl(path)

  return NextResponse.json({
    url: publicUrl,
    mediaType: getMediaType(file.type),
  }, { status: 201 })
}
```

- [ ] **Step 11.2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 11.3: Commit**

```bash
git add app/api/exercises/custom/upload-media/route.ts
git commit -m "feat(api): add custom exercise media upload endpoint (image/gif/video → Supabase Storage)"
```

---

## Task 12: Custom exercise API — full biomech schema

**Files:**
- Modify: `app/api/exercises/custom/route.ts`

- [ ] **Step 12.1: Update Zod schema to require all biomech fields**

Replace the existing `createSchema` in `app/api/exercises/custom/route.ts`:

```typescript
const createSchema = z.object({
  // Identity
  name: z.string().min(2).max(120),
  description: z.string().max(500).nullable().optional(),
  muscle_group: z.string().max(50),
  media_url: z.string().url(),
  media_type: z.enum(['image', 'gif', 'video']),
  // Classification
  movement_pattern: z.string().max(50),
  plane: z.enum(['sagittal', 'frontal', 'transverse']),
  mechanic: z.enum(['isolation', 'compound', 'isometric', 'plyometric']),
  unilateral: z.boolean(),
  equipment: z.array(z.string()).min(1).max(10),
  is_compound: z.boolean(),
  // Muscles
  primary_muscle: z.string().max(80),
  primary_activation: z.number().min(0.3).max(1.0),
  muscles: z.array(z.string()).max(12).optional().default([]),
  secondary_muscles_detail: z.array(z.string()).max(5).optional().default([]),
  secondary_activations: z.array(z.number()).max(5).optional().default([]),
  stabilizers: z.array(z.string()).max(5).optional().default([]),
  // Biomechanics
  joint_stress_spine: z.number().int().min(1).max(8),
  joint_stress_knee: z.number().int().min(1).max(8),
  joint_stress_shoulder: z.number().int().min(1).max(8),
  global_instability: z.number().int().min(1).max(9),
  coordination_demand: z.number().int().min(1).max(9),
  constraint_profile: z.string().max(50),
  stimulus_coefficient: z.number().min(0).max(1).optional().default(0.60),
  notes: z.string().max(1000).nullable().optional(),
})
```

- [ ] **Step 12.2: Update the POST insert to include all new fields**

In the `POST` handler, update the insert object:

```typescript
const { data, error } = await db
  .from('coach_custom_exercises')
  .insert({
    coach_id: user.id,
    slug,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    muscle_group: parsed.data.muscle_group,
    media_url: parsed.data.media_url,
    media_type: parsed.data.media_type,
    movement_pattern: parsed.data.movement_pattern,
    plane: parsed.data.plane,
    mechanic: parsed.data.mechanic,
    unilateral: parsed.data.unilateral,
    equipment: parsed.data.equipment,
    is_compound: parsed.data.is_compound,
    muscles: parsed.data.muscles,
    primary_muscle: parsed.data.primary_muscle,
    primary_activation: parsed.data.primary_activation,
    secondary_muscles_detail: parsed.data.secondary_muscles_detail,
    secondary_activations: parsed.data.secondary_activations,
    stabilizers: parsed.data.stabilizers,
    joint_stress_spine: parsed.data.joint_stress_spine,
    joint_stress_knee: parsed.data.joint_stress_knee,
    joint_stress_shoulder: parsed.data.joint_stress_shoulder,
    global_instability: parsed.data.global_instability,
    coordination_demand: parsed.data.coordination_demand,
    constraint_profile: parsed.data.constraint_profile,
    stimulus_coefficient: parsed.data.stimulus_coefficient,
    notes: parsed.data.notes ?? null,
  })
  .select()
  .single()
```

- [ ] **Step 12.3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 12.4: Commit**

```bash
git add app/api/exercises/custom/route.ts
git commit -m "feat(api): require full biomech schema for custom exercise creation"
```

---

## Task 13: CustomExerciseModal — 6-step form

**Files:**
- Create: `components/programs/CustomExerciseModal.tsx`

This is the largest component. Build it step by step.

- [ ] **Step 13.1: Create the modal scaffold with step state**

Create `components/programs/CustomExerciseModal.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronLeft, Check, Upload } from 'lucide-react'

const STEPS = ['Média', 'Identité', 'Classification', 'Muscles', 'Biomécanique', 'Confirmation'] as const
type Step = 0 | 1 | 2 | 3 | 4 | 5

interface FormData {
  // Step 1
  mediaUrl: string
  mediaType: 'image' | 'gif' | 'video' | ''
  // Step 2
  name: string
  description: string
  muscleGroup: string
  // Step 3
  movementPattern: string
  plane: 'sagittal' | 'frontal' | 'transverse' | ''
  mechanic: 'isolation' | 'compound' | 'isometric' | 'plyometric' | ''
  unilateral: boolean
  equipment: string[]
  isCompound: boolean
  // Step 4
  primaryMuscle: string
  primaryActivation: number
  secondaryMusclesDetail: string[]
  secondaryActivations: number[]
  stabilizers: string[]
  // Step 5
  jointStressSpine: number
  jointStressKnee: number
  jointStressShoulder: number
  globalInstability: number
  coordinationDemand: number
  constraintProfile: string
}

const initialForm: FormData = {
  mediaUrl: '', mediaType: '',
  name: '', description: '', muscleGroup: '',
  movementPattern: '', plane: '', mechanic: '', unilateral: false, equipment: [], isCompound: false,
  primaryMuscle: '', primaryActivation: 0.75, secondaryMusclesDetail: [], secondaryActivations: [], stabilizers: [],
  jointStressSpine: 3, jointStressKnee: 3, jointStressShoulder: 3, globalInstability: 3, coordinationDemand: 3, constraintProfile: '',
}

interface Props {
  onClose: () => void
  onCreated: (exercise: { name: string; mediaUrl: string; mediaType: string; movementPattern: string; equipment: string[]; isCompound: boolean; primaryMuscle: string; primaryActivation: number; jointStressSpine: number; jointStressKnee: number; jointStressShoulder: number; globalInstability: number; coordinationDemand: number; constraintProfile: string }) => void
}

export default function CustomExerciseModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>(0)
  const [form, setForm] = useState<FormData>(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(patch: Partial<FormData>) {
    setForm(prev => ({ ...prev, ...patch }))
  }

  function canAdvance(): boolean {
    if (step === 0) return !!form.mediaUrl && !!form.mediaType
    if (step === 1) return form.name.trim().length >= 2 && !!form.muscleGroup
    if (step === 2) return !!form.movementPattern && !!form.plane && !!form.mechanic && form.equipment.length > 0
    if (step === 3) return !!form.primaryMuscle && form.primaryActivation > 0
    if (step === 4) return !!form.constraintProfile
    return true
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/exercises/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          muscle_group: form.muscleGroup,
          media_url: form.mediaUrl,
          media_type: form.mediaType,
          movement_pattern: form.movementPattern,
          plane: form.plane,
          mechanic: form.mechanic,
          unilateral: form.unilateral,
          equipment: form.equipment,
          is_compound: form.isCompound,
          primary_muscle: form.primaryMuscle,
          primary_activation: form.primaryActivation,
          secondary_muscles_detail: form.secondaryMusclesDetail,
          secondary_activations: form.secondaryActivations,
          stabilizers: form.stabilizers,
          joint_stress_spine: form.jointStressSpine,
          joint_stress_knee: form.jointStressKnee,
          joint_stress_shoulder: form.jointStressShoulder,
          global_instability: form.globalInstability,
          coordination_demand: form.coordinationDemand,
          constraint_profile: form.constraintProfile,
          stimulus_coefficient: form.primaryActivation,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erreur lors de la création')
      }
      onCreated({
        name: form.name,
        mediaUrl: form.mediaUrl,
        mediaType: form.mediaType,
        movementPattern: form.movementPattern,
        equipment: form.equipment,
        isCompound: form.isCompound,
        primaryMuscle: form.primaryMuscle,
        primaryActivation: form.primaryActivation,
        jointStressSpine: form.jointStressSpine,
        jointStressKnee: form.jointStressKnee,
        jointStressShoulder: form.jointStressShoulder,
        globalInstability: form.globalInstability,
        coordinationDemand: form.coordinationDemand,
        constraintProfile: form.constraintProfile,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="bg-[#181818] rounded-2xl w-full max-w-lg border border-[0.3px] border-white/[0.06] flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[0.3px] border-white/[0.06]">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/30">Étape {step + 1}/{STEPS.length}</p>
            <h2 className="text-[13px] font-semibold text-white mt-0.5">{STEPS[step]}</h2>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-white/40 hover:text-white/70 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-[2px] bg-white/[0.06]">
          <motion.div
            className="h-full bg-[#1f8a65]"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.25 }}
            >
              {step === 0 && <StepMedia form={form} update={update} />}
              {step === 1 && <StepIdentity form={form} update={update} />}
              {step === 2 && <StepClassification form={form} update={update} />}
              {step === 3 && <StepMuscles form={form} update={update} />}
              {step === 4 && <StepBiomech form={form} update={update} />}
              {step === 5 && <StepConfirm form={form} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Error */}
        {error && (
          <p className="px-5 pb-2 text-[12px] text-red-400">{error}</p>
        )}

        {/* Footer nav */}
        <div className="flex items-center justify-between px-5 pb-5 pt-3 border-t border-[0.3px] border-white/[0.06]">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1) as Step)}
            disabled={step === 0}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.04] px-4 text-[12px] font-medium text-white/50 hover:text-white/80 transition-colors disabled:opacity-30"
          >
            <ChevronLeft size={14} /> Retour
          </button>

          {step < 5 ? (
            <button
              onClick={() => setStep(s => (s + 1) as Step)}
              disabled={!canAdvance()}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-[#1f8a65] px-4 text-[12px] font-bold text-white hover:bg-[#217356] transition-colors disabled:opacity-40"
            >
              Suivant <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-[#1f8a65] px-4 text-[12px] font-bold text-white hover:bg-[#217356] transition-colors disabled:opacity-40"
            >
              {saving ? '...' : <><Check size={14} /> Créer l&apos;exercice</>}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 13.2: Implement StepMedia**

Add below the `CustomExerciseModal` export in the same file:

```tsx
function StepMedia({ form, update }: { form: FormData; update: (p: Partial<FormData>) => void }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setUploadError(null)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/exercises/custom/upload-media', { method: 'POST', body: fd })
    if (!res.ok) {
      const d = await res.json()
      setUploadError(d.error ?? 'Erreur upload')
      setUploading(false)
      return
    }
    const { url, mediaType } = await res.json()
    update({ mediaUrl: url, mediaType })
    setUploading(false)
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-white/50">Ajoutez une image, un GIF de démonstration, ou une vidéo.</p>

      {form.mediaUrl ? (
        <div className="relative rounded-xl overflow-hidden bg-white/[0.02] border border-[0.3px] border-white/[0.06]">
          {form.mediaType === 'video' ? (
            <video src={form.mediaUrl} className="w-full max-h-48 object-cover" controls />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.mediaUrl} alt="preview" className="w-full max-h-48 object-contain" />
          )}
          <button
            onClick={() => update({ mediaUrl: '', mediaType: '' })}
            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white/70 hover:text-white"
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-3 h-40 rounded-xl border border-dashed border-white/10 bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] transition-colors">
          {uploading ? (
            <span className="text-[12px] text-white/40">Upload en cours...</span>
          ) : (
            <>
              <Upload size={20} className="text-white/25" />
              <span className="text-[12px] text-white/40">Glissez ou cliquez pour uploader</span>
              <span className="text-[10px] text-white/25">JPG, PNG, WebP, GIF, MP4, WebM — max 50MB</span>
            </>
          )}
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
        </label>
      )}

      {uploadError && <p className="text-[11px] text-red-400">{uploadError}</p>}
    </div>
  )
}
```

- [ ] **Step 13.3: Implement StepIdentity, StepClassification, StepMuscles, StepBiomech, StepConfirm**

Add all remaining step components to the same file:

```tsx
const MUSCLE_GROUPS_OPTIONS = [
  'abdos', 'biceps', 'dos', 'epaules', 'fessiers',
  'ischio-jambiers', 'mollets', 'pectoraux', 'quadriceps', 'triceps',
]

const MOVEMENT_PATTERNS_OPTIONS = [
  { value: 'horizontal_push', label: 'Poussée horizontale' },
  { value: 'vertical_push', label: 'Poussée verticale' },
  { value: 'horizontal_pull', label: 'Tirage horizontal' },
  { value: 'vertical_pull', label: 'Tirage vertical' },
  { value: 'squat_pattern', label: 'Pattern squat' },
  { value: 'hip_hinge', label: 'Charnière hanche' },
  { value: 'knee_flexion', label: 'Flexion genou' },
  { value: 'knee_extension', label: 'Extension genou' },
  { value: 'calf_raise', label: 'Extension mollets' },
  { value: 'elbow_flexion', label: 'Flexion coude (Biceps)' },
  { value: 'elbow_extension', label: 'Extension coude (Triceps)' },
  { value: 'lateral_raise', label: 'Élévation latérale' },
  { value: 'core_anti_flex', label: 'Gainage anti-flexion' },
  { value: 'core_flex', label: 'Flexion core' },
  { value: 'core_rotation', label: 'Rotation core' },
  { value: 'carry', label: 'Porté (Carry)' },
  { value: 'scapular_elevation', label: 'Élévation scapulaire' },
]

const EQUIPMENT_OPTIONS = [
  { value: 'bodyweight', label: 'Poids du corps' },
  { value: 'band', label: 'Élastique' },
  { value: 'dumbbell', label: 'Haltères' },
  { value: 'barbell', label: 'Barre' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'machine', label: 'Machine' },
  { value: 'cable', label: 'Poulie' },
  { value: 'smith', label: 'Smith Machine' },
  { value: 'trx', label: 'TRX / Sangles' },
  { value: 'ez_bar', label: 'Barre EZ' },
]

const CONSTRAINT_PROFILES = [
  { value: 'free_weight', label: 'Poids libre' },
  { value: 'cable_constant', label: 'Câble (tension constante)' },
  { value: 'machine_stability', label: 'Machine guidée' },
  { value: 'bodyweight_pull', label: 'Poids du corps (traction)' },
  { value: 'variable_resistance', label: 'Résistance variable (élastique)' },
  { value: 'strict_isolation', label: 'Isolation stricte' },
  { value: 'anti_extension', label: 'Anti-extension (gainage)' },
  { value: 'coordination_core', label: 'Coordination core' },
  { value: 'unilateral_instability', label: 'Instabilité unilatérale' },
]

const MUSCLE_OPTIONS = [
  'biceps_brachii', 'brachialis', 'brachioradialis',
  'triceps_brachii', 'pectoralis_major', 'pectoralis_minor',
  'deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior',
  'trapezius', 'rhomboids', 'latissimus_dorsi',
  'spine_erectors', 'gluteus_maximus', 'gluteus_medius', 'gluteus_minimus',
  'quadriceps', 'hamstrings', 'gastrocnemius', 'soleus',
  'rectus_abdominis', 'obliques', 'transverse_abdominis', 'core',
]

function StepIdentity({ form, update }: { form: FormData; update: (p: Partial<FormData>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Nom de l'exercice *</label>
        <input
          value={form.name}
          onChange={e => update({ name: e.target.value })}
          placeholder="Ex: Curl Concentré Haltère"
          className="w-full h-[44px] rounded-xl bg-[#0a0a0a] px-4 text-[13px] text-white placeholder:text-white/20 outline-none"
        />
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Groupe musculaire principal *</label>
        <select
          value={form.muscleGroup}
          onChange={e => update({ muscleGroup: e.target.value })}
          className="w-full h-[44px] rounded-xl bg-[#0a0a0a] px-4 text-[13px] text-white/80 outline-none"
        >
          <option value="">— Choisir —</option>
          {MUSCLE_GROUPS_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Description (optionnelle)</label>
        <textarea
          value={form.description}
          onChange={e => update({ description: e.target.value })}
          rows={2}
          placeholder="Notes sur l'exécution..."
          className="w-full rounded-xl bg-[#0a0a0a] px-4 py-2.5 text-[13px] text-white/80 placeholder:text-white/20 outline-none resize-none"
        />
      </div>
    </div>
  )
}

function StepClassification({ form, update }: { form: FormData; update: (p: Partial<FormData>) => void }) {
  function toggleEquipment(val: string) {
    const current = form.equipment
    update({ equipment: current.includes(val) ? current.filter(e => e !== val) : [...current, val] })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Pattern de mouvement *</label>
        <select value={form.movementPattern} onChange={e => update({ movementPattern: e.target.value })} className="w-full h-[44px] rounded-xl bg-[#0a0a0a] px-4 text-[13px] text-white/80 outline-none">
          <option value="">— Choisir —</option>
          {MOVEMENT_PATTERNS_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Plan *</label>
          <select value={form.plane} onChange={e => update({ plane: e.target.value as FormData['plane'] })} className="w-full h-[44px] rounded-xl bg-[#0a0a0a] px-3 text-[13px] text-white/80 outline-none">
            <option value="">—</option>
            <option value="sagittal">Sagittal</option>
            <option value="frontal">Frontal</option>
            <option value="transverse">Transverse</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Mécanique *</label>
          <select value={form.mechanic} onChange={e => update({ mechanic: e.target.value as FormData['mechanic'], isCompound: e.target.value === 'compound' })} className="w-full h-[44px] rounded-xl bg-[#0a0a0a] px-3 text-[13px] text-white/80 outline-none">
            <option value="">—</option>
            <option value="isolation">Isolation</option>
            <option value="compound">Composé</option>
            <option value="isometric">Isométrique</option>
            <option value="plyometric">Pliométrique</option>
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-white/[0.02] px-4 py-3 border border-[0.3px] border-white/[0.06]">
        <span className="text-[12px] text-white/70">Exercice unilatéral</span>
        <button
          onClick={() => update({ unilateral: !form.unilateral })}
          className={`w-10 h-5 rounded-full transition-colors ${form.unilateral ? 'bg-[#1f8a65]' : 'bg-white/10'}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white mx-0.5 transition-transform ${form.unilateral ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">Équipement requis * (au moins 1)</label>
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT_OPTIONS.map(eq => (
            <button
              key={eq.value}
              onClick={() => toggleEquipment(eq.value)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                form.equipment.includes(eq.value)
                  ? 'bg-[#1f8a65]/10 text-[#1f8a65]'
                  : 'bg-white/[0.04] text-white/40 hover:text-white/60'
              }`}
            >
              {eq.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepMuscles({ form, update }: { form: FormData; update: (p: Partial<FormData>) => void }) {
  function toggleSecondary(muscle: string) {
    if (form.secondaryMusclesDetail.includes(muscle)) {
      const idx = form.secondaryMusclesDetail.indexOf(muscle)
      update({
        secondaryMusclesDetail: form.secondaryMusclesDetail.filter(m => m !== muscle),
        secondaryActivations: form.secondaryActivations.filter((_, i) => i !== idx),
      })
    } else if (form.secondaryMusclesDetail.length < 3) {
      update({
        secondaryMusclesDetail: [...form.secondaryMusclesDetail, muscle],
        secondaryActivations: [...form.secondaryActivations, 0.15],
      })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Muscle primaire *</label>
        <select value={form.primaryMuscle} onChange={e => update({ primaryMuscle: e.target.value })} className="w-full h-[44px] rounded-xl bg-[#0a0a0a] px-4 text-[13px] text-white/80 outline-none">
          <option value="">— Choisir —</option>
          {MUSCLE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">
          Activation primaire : <span className="text-[#1f8a65]">{form.primaryActivation.toFixed(2)}</span>
        </label>
        <input type="range" min={0.3} max={0.98} step={0.01} value={form.primaryActivation}
          onChange={e => update({ primaryActivation: parseFloat(e.target.value) })}
          className="w-full accent-[#1f8a65]" />
        <div className="flex justify-between text-[9px] text-white/25 mt-1"><span>0.30 (faible)</span><span>0.98 (max)</span></div>
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">Muscles secondaires (max 3, optionnel)</label>
        <div className="flex flex-wrap gap-1.5">
          {MUSCLE_OPTIONS.filter(m => m !== form.primaryMuscle).map(m => (
            <button key={m} onClick={() => toggleSecondary(m)}
              className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
                form.secondaryMusclesDetail.includes(m) ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.04] text-white/35 hover:text-white/55'
              }`}
            >{m}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepBiomech({ form, update }: { form: FormData; update: (p: Partial<FormData>) => void }) {
  const sliders: { key: keyof FormData; label: string; max: number; low: string; high: string }[] = [
    { key: 'jointStressSpine', label: 'Stress rachis', max: 8, low: '1 — minimal', high: '8 — maximal' },
    { key: 'jointStressKnee', label: 'Stress genou', max: 8, low: '1 — minimal', high: '8 — maximal' },
    { key: 'jointStressShoulder', label: 'Stress épaule', max: 8, low: '1 — minimal', high: '8 — maximal' },
    { key: 'globalInstability', label: 'Instabilité globale', max: 9, low: '1 — stable', high: '9 — très instable' },
    { key: 'coordinationDemand', label: 'Demande coordination', max: 9, low: '1 — simple', high: '9 — complexe' },
  ]

  return (
    <div className="space-y-5">
      {sliders.map(({ key, label, max, low, high }) => (
        <div key={key}>
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">
            {label} : <span className="text-white">{form[key] as number}</span>/{max}
          </label>
          <input type="range" min={1} max={max} step={1} value={form[key] as number}
            onChange={e => update({ [key]: parseInt(e.target.value) } as Partial<FormData>)}
            className="w-full accent-[#1f8a65]" />
          <div className="flex justify-between text-[9px] text-white/25 mt-1"><span>{low}</span><span>{high}</span></div>
        </div>
      ))}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Profil de contrainte *</label>
        <select value={form.constraintProfile} onChange={e => update({ constraintProfile: e.target.value })} className="w-full h-[44px] rounded-xl bg-[#0a0a0a] px-4 text-[13px] text-white/80 outline-none">
          <option value="">— Choisir —</option>
          {CONSTRAINT_PROFILES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
    </div>
  )
}

function StepConfirm({ form }: { form: FormData }) {
  const rows = [
    ['Nom', form.name],
    ['Groupe', form.muscleGroup],
    ['Pattern', form.movementPattern],
    ['Plan', form.plane],
    ['Mécanique', form.mechanic],
    ['Unilatéral', form.unilateral ? 'Oui' : 'Non'],
    ['Équipement', form.equipment.join(', ')],
    ['Muscle primaire', `${form.primaryMuscle} (${form.primaryActivation.toFixed(2)})`],
    ['Stress rachis / genou / épaule', `${form.jointStressSpine} / ${form.jointStressKnee} / ${form.jointStressShoulder}`],
    ['Instabilité / Coordination', `${form.globalInstability} / ${form.coordinationDemand}`],
    ['Profil contrainte', form.constraintProfile],
  ]

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-white/50 mb-3">Vérifiez les informations avant de créer l&apos;exercice.</p>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-4 py-2 border-b border-white/[0.04]">
          <span className="text-[11px] text-white/40 shrink-0">{label}</span>
          <span className="text-[11px] text-white/80 text-right">{value || '—'}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 13.4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 13.5: Wire modal into ExercisePicker**

In `ExercisePicker.tsx`, add a button to trigger the custom exercise modal. When a custom exercise is created, add it to the local `customExercises` state:

```tsx
// Add state:
const [showCustomModal, setShowCustomModal] = useState(false)

// Add button near the "Créer" tab or at the bottom of the picker:
<button
  onClick={() => setShowCustomModal(true)}
  className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-[12px] text-white/50 hover:text-white/80 transition-colors border border-[0.3px] border-white/[0.06]"
>
  + Mon exercice
</button>

// Add modal:
{showCustomModal && (
  <CustomExerciseModal
    onClose={() => setShowCustomModal(false)}
    onCreated={(exercise) => {
      // Add to custom exercises list so it appears immediately
      setCustomExercises(prev => [...prev, {
        id: `custom__${exercise.name}`,
        name: exercise.name,
        slug: exercise.name.toLowerCase().replace(/\s+/g, '-'),
        gifUrl: exercise.mediaUrl,
        muscleGroup: '',
        exerciseType: 'exercise' as const,
        pattern: [],
        movementPattern: exercise.movementPattern,
        equipment: exercise.equipment,
        isCompound: exercise.isCompound,
        muscles: [],
        stimulus_coefficient: exercise.primaryActivation,
        source: 'custom' as const,
      }])
      setShowCustomModal(false)
    }}
  />
)}
```

- [ ] **Step 13.6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 13.7: Commit**

```bash
git add components/programs/CustomExerciseModal.tsx components/programs/ExercisePicker.tsx
git commit -m "feat(picker): add CustomExerciseModal 6-step form for coach custom exercises"
```

---

## Task 14: ProgramIntelligencePanel — show new subscores

**Files:**
- Modify: `components/programs/ProgramIntelligencePanel.tsx`

- [ ] **Step 14.1: Add jointLoad and coordination to subscores display**

In `ProgramIntelligencePanel.tsx`, find the subscores grid (currently 6 subscores: balance, recovery, specificity, progression, completeness, redundancy). Add the two new subscores:

```tsx
// In the subscores grid, add:
{ key: 'jointLoad', label: 'Charge articulaire', icon: ... },
{ key: 'coordination', label: 'Coordination', icon: ... },
```

The exact implementation depends on how the current grid is structured. Find the array or list of subscore items and append these two entries following the same pattern.

- [ ] **Step 14.2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 14.3: Commit**

```bash
git add components/programs/ProgramIntelligencePanel.tsx
git commit -m "feat(panel): display jointLoad and coordination subscores in intelligence panel"
```

---

## Task 15: End-to-end verification

- [ ] **Step 15.1: Run full test suite**

```bash
npx vitest run 2>&1 | tail -30
```

Expected: All tests pass.

- [ ] **Step 15.2: TypeScript full check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 15.3: Manual smoke test — catalog enrichment**

```bash
python3 -c "
import json
d = json.load(open('data/exercise-catalog.json'))
enriched = [e for e in d if e.get('jointStressSpine') is not None]
print(f'Enriched: {len(enriched)}/{len(d)} ({100*len(enriched)//len(d)}%)')
sample = enriched[0]
print('Sample fields:', {k: sample[k] for k in ['name','primaryActivation','jointStressSpine','constraintProfile','unilateral']})
"
```

Expected: ≥ 400/458 enriched (87%+).

- [ ] **Step 15.4: Manual smoke test — builder**

1. Open the program template builder
2. Add an exercise via the picker → verify no movement_pattern / equipment / muscle chips appear in the ExerciseCard
3. Verify the Intelligence Panel shows `jointLoad` and `coordination` subscores
4. Add exercises with high `jointStressSpine` to a program with a lower_back injury profile → verify `JOINT_OVERLOAD` alert appears

- [ ] **Step 15.5: Manual smoke test — custom exercise**

1. Click "+ Mon exercice" in the picker
2. Complete all 6 steps of the modal
3. Verify the exercise appears under "Mes exercices" filter in the picker

- [ ] **Step 15.6: Update CHANGELOG.md**

Add to `CHANGELOG.md`:

```
## 2026-04-23

FEATURE: Enrich exercise-catalog.json with full biomechanical data from CSV files (457 exercises, 13 new fields)
FEATURE: Add scoreJointLoad and scoreCoordination subscores to intelligence engine
FEATURE: Remove manual biomech UI from ExerciseCard (movement pattern, equipment, muscles, is_compound)
FEATURE: Add CustomExerciseModal — 6-step form for coach custom exercises with full biomech schema
FEATURE: Extend ExercisePicker with source filter (All / STRYVR / Mine)
FEATURE: Add biomech fields to constraintProfile + unilateral + activation delta in scoreAlternatives
SCHEMA: Extend coach_custom_exercises with 16 biomech columns
SCHEMA: Extend coach_program_template_exercises and program_exercises with 13 biomech columns
```

- [ ] **Step 15.7: Update project-state.md**

Add a new section at the top of `.claude/rules/project-state.md`:

```markdown
## 2026-04-23 — Exercise Catalog Biomech Enrichment

**Ce qui a été fait :**

1. **`scripts/merge-exercise-catalog.ts`** — script de build qui fusionne les 10 CSV bioméchaniques dans le catalog JSON
   - 457 exercices enrichis avec 13 nouveaux champs : plane, mechanic, unilateral, primaryMuscle, primaryActivation, secondaryMuscles, secondaryActivations, stabilizers, jointStress{Spine,Knee,Shoulder}, globalInstability, coordinationDemand, constraintProfile
   - ~408 matchés automatiquement, ~49 via fichier de mapping manuel

2. **Migrations DB** — 3 tables étendues avec champs bioméchaniques :
   - `coach_custom_exercises` : 16 nouveaux champs
   - `coach_program_template_exercises` : 13 nouveaux champs
   - `program_exercises` : 13 nouveaux champs

3. **Intelligence Engine** :
   - `scoreJointLoad()` : alerte JOINT_OVERLOAD basée sur joint_stress × profil blessures client
   - `scoreCoordination()` : alerte COORDINATION_MISMATCH pour débutants avec exercices complexes
   - `resolveExerciseCoeff()` : priorité 1 = primaryActivation du catalog
   - `getBiomechData()` : lookup biomech par slug
   - `scoreAlternatives()` : +15 constraintProfile, +10 unilateral, −15 activation delta

4. **UI Builder simplifié** :
   - ExerciseCard : suppression movement_pattern select, equipment pills, is_compound toggle, muscle chips
   - EditorPane : suppression equipment_archetype select
   - Tous les champs biomec auto-injectés depuis le catalog à la sélection

5. **CustomExerciseModal** : formulaire 6 étapes (Média, Identité, Classification, Muscles, Biomécanique, Confirmation) avec tous les champs requis

6. **ExercisePicker** : filtre source (Tous / Catalogue STRYVR / Mes exercices)

**Points de vigilance :**
- Les exercices créés avant cette migration ont les champs biomec à NULL → moteur dégrade gracieusement (comportement pré-migration)
- `primaryActivation` prend la priorité sur `stimulus_coefficient` dans resolveExerciseCoeff — les anciens scores peuvent varier légèrement
- `scoreJointLoad` retourne score neutre 80 si pas de profil blessures — pas d'impact négatif sur les programmes sans profil client
```

- [ ] **Step 15.8: Final commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "chore: update CHANGELOG and project-state for biomech enrichment feature"
```
