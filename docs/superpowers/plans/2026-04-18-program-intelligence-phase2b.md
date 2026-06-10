# Program Intelligence Phase 2B — Complete Phase 1 Gaps + SRA Fitness Level Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the three incomplete items from the Phase 1 spec — `ExerciseSwapSheet` (client mobile swap), exercices custom coach (`POST /api/exercises/custom` + badge "Perso" dans ExercisePicker) — et brancher `fitnessLevel` du profil client sur `scoreSRA`, le seul sous-moteur qui ignore encore ce signal alors que le multiplier est déjà dans le code.

**Architecture:** `ExerciseSwapSheet` est un bottom sheet client-only qui réutilise `scoreAlternatives()` déjà dans `lib/programs/intelligence/alternatives.ts` — remplaçant temporaire en state local, jamais persisté. Les exercices custom coach s'appuient sur une nouvelle table Supabase `coach_custom_exercises` (pas Prisma — le projet utilise Supabase direct) avec un endpoint REST standard. Le badge "Perso" s'injecte dans l'`ExercisePicker` existant sans refactoring. `scoreSRA` reçoit `fitnessLevel` depuis l'`IntelligenceProfile` déjà disponible dans `buildIntelligenceResult`.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase (service role client), Zod, Tailwind CSS (DS v2.0 — `#121212` bg, `bg-white/[0.02]` cards, `#1f8a65` accent), Vitest pour les tests moteur, Framer Motion pour l'animation sheet.

---

## Prerequisite: Fix equipment PATCH allowlist

Le `PATCH /api/clients/[clientId]/route.ts` ligne 49–52 n'inclut pas `equipment` dans sa allowlist — le toggle d'équipement du `RestrictionsWidget` écrit vers cet endpoint mais le champ est silencieusement ignoré.

**File:** `app/api/clients/[clientId]/route.ts`

- [ ] **Step 1: Add `equipment` to the PATCH allowlist**

In `app/api/clients/[clientId]/route.ts`, find the `allowed` array (line ~49):

```typescript
const allowed = [
  'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'gender', 'notes', 'status',
  'training_goal', 'fitness_level', 'sport_practice', 'weekly_frequency', 'equipment_category',
  'equipment', // ← add this
]
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/api/clients/[clientId]/route.ts"
git commit -m "fix(api): add equipment to PATCH /api/clients/[clientId] allowlist"
```

---

## Task 1: scoreSRA — Brancher fitnessLevel depuis IntelligenceProfile

**Context:** `scoreSRA` in `lib/programs/intelligence/scoring.ts` has a `SRA_LEVEL_MULTIPLIER` map keyed on `'beginner' | 'intermediate' | 'advanced' | 'elite'` and reads from `meta.level` (the template's target level). `IntelligenceProfile.fitnessLevel` holds the actual client fitness level — which should override or modulate when present. Currently `profile` is passed to `scoreSpecificity` and `scoreCompleteness` but not `scoreSRA`. This task threads it through.

**Files:**
- Modify: `lib/programs/intelligence/scoring.ts`
- Modify: `tests/lib/intelligence/profile-scoring.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/lib/intelligence/profile-scoring.test.ts`:

```typescript
import { scoreSRA } from '@/lib/programs/intelligence/scoring'

const SESSION_HEAVY: BuilderSession = {
  name: 'Day A',
  day_of_week: 1,
  exercises: [
    {
      name: 'Squat barre',
      sets: 4, reps: '5', rest_sec: 180, rir: 1, notes: '',
      movement_pattern: 'squat_pattern',
      equipment_required: ['barre'],
      primary_muscles: ['quadriceps', 'fessiers'],
      secondary_muscles: [],
    },
  ],
}

const SESSION_SAME_MUS: BuilderSession = {
  name: 'Day B',
  day_of_week: 2, // 24h later — always a SRA violation for quads at beginner level (window = 48*1.25 = 60h)
  exercises: [
    {
      name: 'Leg Press',
      sets: 4, reps: '10', rest_sec: 90, rir: 2, notes: '',
      movement_pattern: 'squat_pattern',
      equipment_required: ['machine'],
      primary_muscles: ['quadriceps'],
      secondary_muscles: [],
    },
  ],
}

const META_INTERMEDIATE: TemplateMeta = {
  goal: 'strength', level: 'intermediate', weeks: 8, frequency: 4, equipment_archetype: 'full_gym',
}

describe('scoreSRA with fitnessLevel from profile', () => {
  it('uses profile fitnessLevel over meta.level when profile is provided', () => {
    const profileBeginner: IntelligenceProfile = { injuries: [], equipment: [], fitnessLevel: 'beginner' }
    const profileElite: IntelligenceProfile = { injuries: [], equipment: [], fitnessLevel: 'elite' }

    const resultBeginner = scoreSRA([SESSION_HEAVY, SESSION_SAME_MUS], META_INTERMEDIATE, profileBeginner)
    const resultElite = scoreSRA([SESSION_HEAVY, SESSION_SAME_MUS], META_INTERMEDIATE, profileElite)

    // Beginner has longer SRA window (×1.25) → more violations → lower score
    expect(resultBeginner.score).toBeLessThan(resultElite.score)
  })

  it('falls back to meta.level when profile has no fitnessLevel', () => {
    const profileNoLevel: IntelligenceProfile = { injuries: [], equipment: [] }
    const resultWithProfile = scoreSRA([SESSION_HEAVY, SESSION_SAME_MUS], META_INTERMEDIATE, profileNoLevel)
    const resultWithoutProfile = scoreSRA([SESSION_HEAVY, SESSION_SAME_MUS], META_INTERMEDIATE)

    expect(resultWithProfile.score).toBe(resultWithoutProfile.score)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/lib/intelligence/profile-scoring.test.ts 2>&1 | tail -20
```

Expected: FAIL — `scoreSRA` doesn't accept a third argument.

- [ ] **Step 3: Update scoreSRA signature**

In `lib/programs/intelligence/scoring.ts`, find `scoreSRA` (currently at ~line 134):

```typescript
export function scoreSRA(
  sessions: BuilderSession[],
  meta: TemplateMeta,
  profile?: IntelligenceProfile,
): { score: number; alerts: IntelligenceAlert[]; sraMap: SRAPoint[] } {
  const alerts: IntelligenceAlert[] = []
  const sraMap: SRAPoint[] = []
  // Use profile.fitnessLevel if provided, else fall back to meta.level
  const effectiveLevel = profile?.fitnessLevel ?? meta.level
  const levelMult = SRA_LEVEL_MULTIPLIER[effectiveLevel] ?? 1.0
  // ... rest of function unchanged
```

Replace only the first two lines of the function body (the two `const` declarations):

Old:
```typescript
  const alerts: IntelligenceAlert[] = []
  const sraMap: SRAPoint[] = []
  const levelMult = SRA_LEVEL_MULTIPLIER[meta.level] ?? 1.0
```

New:
```typescript
  const alerts: IntelligenceAlert[] = []
  const sraMap: SRAPoint[] = []
  const effectiveLevel = profile?.fitnessLevel ?? meta.level
  const levelMult = SRA_LEVEL_MULTIPLIER[effectiveLevel] ?? 1.0
```

- [ ] **Step 4: Thread profile through buildIntelligenceResult**

In `buildIntelligenceResult`, find the `scoreSRA` call (currently `const sraResult = scoreSRA(sessions, meta)`) and update:

```typescript
  const sraResult = scoreSRA(sessions, meta, profile)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/lib/intelligence/profile-scoring.test.ts 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add lib/programs/intelligence/scoring.ts tests/lib/intelligence/profile-scoring.test.ts
git commit -m "feat(intelligence): thread IntelligenceProfile.fitnessLevel into scoreSRA multiplier"
```

---

## Task 2: DB Migration — coach_custom_exercises table

**Context:** Custom exercises need to be persisted per coach so they appear in ExercisePicker alongside the static catalog. The table mirrors the fields in `ExercisePicker`'s `CatalogEntry` interface.

**Files:**
- Create: `supabase/migrations/20260418_coach_custom_exercises.sql`

- [ ] **Step 1: Write and apply migration**

```sql
-- supabase/migrations/20260418_coach_custom_exercises.sql
CREATE TABLE IF NOT EXISTS coach_custom_exercises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  slug            text NOT NULL,
  movement_pattern text,
  is_compound     boolean NOT NULL DEFAULT false,
  equipment       text[] NOT NULL DEFAULT '{}',
  muscles         text[] NOT NULL DEFAULT '{}',  -- FR slugs: 'quadriceps', 'fessiers', etc.
  muscle_group    text,                            -- primary display group
  stimulus_coefficient numeric(4,2) NOT NULL DEFAULT 0.60,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coach_id, slug)
);

-- Coach can only see their own exercises
ALTER TABLE coach_custom_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_custom_exercises_own" ON coach_custom_exercises
  FOR ALL USING (coach_id = auth.uid());
```

Apply via MCP tool or:
```bash
npx supabase db push
```

- [ ] **Step 2: Verify columns**

Run in Supabase SQL editor:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'coach_custom_exercises'
ORDER BY ordinal_position;
```

Expected: 12 rows returned (id through created_at).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260418_coach_custom_exercises.sql
git commit -m "schema: add coach_custom_exercises table with RLS"
```

---

## Task 3: API — POST /api/exercises/custom

**Context:** Coach-authenticated endpoint to create a custom exercise. The slug is derived from the name server-side to guarantee uniqueness. Returns the full created row so the UI can add it to local state immediately.

**Files:**
- Create: `app/api/exercises/custom/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/exercises/custom/route.ts
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
  name: z.string().min(2).max(120),
  movement_pattern: z.string().max(50).nullable().optional(),
  is_compound: z.boolean().optional().default(false),
  equipment: z.array(z.string()).max(10).optional().default([]),
  muscles: z.array(z.string()).max(12).optional().default([]),
  muscle_group: z.string().max(50).nullable().optional(),
  stimulus_coefficient: z.number().min(0).max(1).optional().default(0.60),
  notes: z.string().max(1000).nullable().optional(),
})

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET(_req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const { data, error } = await db
    .from('coach_custom_exercises')
    .select('*')
    .eq('coach_id', user.id)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(', ') }, { status: 400 })
  }

  const db = serviceClient()
  const slug = toSlug(parsed.data.name)

  const { data, error } = await db
    .from('coach_custom_exercises')
    .insert({
      coach_id: user.id,
      slug,
      name: parsed.data.name,
      movement_pattern: parsed.data.movement_pattern ?? null,
      is_compound: parsed.data.is_compound,
      equipment: parsed.data.equipment,
      muscles: parsed.data.muscles,
      muscle_group: parsed.data.muscle_group ?? null,
      stimulus_coefficient: parsed.data.stimulus_coefficient,
      notes: parsed.data.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Un exercice avec ce nom existe déjà.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/exercises/custom/route.ts
git commit -m "feat(api): add GET/POST /api/exercises/custom for coach custom exercises"
```

---

## Task 4: ExercisePicker — Load custom exercises + badge "Perso"

**Context:** `ExercisePicker` (`components/programs/ExercisePicker.tsx`) currently reads only from the static `exercise-catalog.json`. We need to fetch the coach's custom exercises from the API on mount and merge them into the search results with a "Perso" badge. The `CatalogEntry` interface needs a `source` discriminator field.

**Files:**
- Modify: `components/programs/ExercisePicker.tsx`

- [ ] **Step 1: Extend CatalogEntry + add fetch logic**

In `components/programs/ExercisePicker.tsx`, find the `CatalogEntry` interface (line ~9) and add `source`:

```typescript
interface CatalogEntry {
  id: string;
  name: string;
  slug: string;
  gifUrl: string;
  muscleGroup: string;
  exerciseType: "exercise" | "pedagogique";
  pattern: string[];
  movementPattern: string | null;
  equipment: string[];
  isCompound: boolean;
  muscles: string[];
  source?: 'catalog' | 'custom'; // ← add this
}
```

- [ ] **Step 2: Add custom exercises state + fetch**

Find the component function declaration (search for `export default function ExercisePicker`). After the existing `useState` calls at the top, add:

```typescript
const [customExercises, setCustomExercises] = useState<CatalogEntry[]>([])

useEffect(() => {
  fetch('/api/exercises/custom')
    .then(r => r.ok ? r.json() : [])
    .then((data: Array<{
      id: string; name: string; slug: string;
      muscle_group: string | null; movement_pattern: string | null;
      equipment: string[]; is_compound: boolean; muscles: string[];
    }>) => {
      setCustomExercises(data.map(e => ({
        id: e.id,
        name: e.name,
        slug: e.slug,
        gifUrl: '',
        muscleGroup: e.muscle_group ?? 'custom',
        exerciseType: 'exercise' as const,
        pattern: e.movement_pattern ? [e.movement_pattern] : [],
        movementPattern: e.movement_pattern,
        equipment: e.equipment,
        isCompound: e.is_compound,
        muscles: e.muscles,
        source: 'custom' as const,
      })))
    })
    .catch(() => {})
}, [])
```

- [ ] **Step 3: Merge custom exercises into filtered results**

Find where `exerciseCatalog` is used in the `useMemo` that builds the filtered list. It currently looks like:

```typescript
const filtered = useMemo(() => {
  return exerciseCatalog.filter(...)
```

Replace with:

```typescript
const allExercises = useMemo<CatalogEntry[]>(() => [
  ...exerciseCatalog.map(e => ({ ...e, source: 'catalog' as const })),
  ...customExercises,
], [customExercises])

const filtered = useMemo(() => {
  return allExercises.filter(...)
```

Update the `.filter(...)` reference from `exerciseCatalog` to `allExercises` throughout the `filtered` useMemo.

- [ ] **Step 4: Add "Perso" badge in the exercise card render**

Find where exercise names are rendered in the list (search for `e.name` or the exercise card JSX — it renders each entry in a `button` or `div`). After the exercise name, add the badge:

```tsx
{e.source === 'custom' && (
  <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#1f8a65]/15 text-[#1f8a65] shrink-0">
    Perso
  </span>
)}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/programs/ExercisePicker.tsx
git commit -m "feat(ui): load coach custom exercises in ExercisePicker with Perso badge"
```

---

## Task 5: ExerciseAlternativesDrawer — "Créer un exercice" inline form

**Context:** The spec requires a third path in the alternatives drawer: an inline form to create a custom exercise without leaving the builder. On submit it calls `POST /api/exercises/custom`, adds the result immediately to the template, and closes the drawer. The form is minimal: name, pattern (select), muscles (chips), is_compound toggle.

**Files:**
- Modify: `components/programs/ExerciseAlternativesDrawer.tsx`

- [ ] **Step 1: Read the current drawer structure**

Read `components/programs/ExerciseAlternativesDrawer.tsx` fully before editing. The component has props `{ exercise, sessionExercises, meta, onReplace, onClose }`. `onReplace` signature: `(name: string, gifUrl: string, movementPattern: string | null, equipment: string[]) => void`.

- [ ] **Step 2: Add "Créer" tab + form state**

In the drawer, find where the `filter` state is declared and add:

```typescript
const [view, setView] = useState<'alternatives' | 'create'>('alternatives')
const [createForm, setCreateForm] = useState({
  name: '',
  movement_pattern: '',
  is_compound: false,
  muscles: [] as string[],
})
const [creating, setCreating] = useState(false)
const [createError, setCreateError] = useState('')
```

- [ ] **Step 3: Add tab switcher in the header**

Find the drawer header JSX (it contains the close button and title). After the title, add a tab row:

```tsx
<div className="flex gap-1 mt-3">
  <button
    onClick={() => setView('alternatives')}
    className={`flex-1 h-7 rounded-lg text-[10px] font-bold transition-colors ${view === 'alternatives' ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06]'}`}
  >
    Alternatives
  </button>
  <button
    onClick={() => setView('create')}
    className={`flex-1 h-7 rounded-lg text-[10px] font-bold transition-colors ${view === 'create' ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06]'}`}
  >
    + Créer
  </button>
</div>
```

- [ ] **Step 4: Add create form JSX + submit handler**

Below the tab switcher, add conditional rendering. The `MOVEMENT_PATTERNS` array lists the same patterns used in `ProgramTemplateBuilder` — copy them here:

```typescript
const MOVEMENT_PATTERNS = [
  'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
  'squat_pattern', 'hip_hinge', 'elbow_flexion', 'elbow_extension',
  'lateral_raise', 'knee_flexion', 'knee_extension', 'calf_raise',
  'core_flex', 'core_anti_flex', 'core_rotation', 'carry', 'scapular_elevation',
]

const MUSCLE_OPTIONS = [
  { slug: 'quadriceps', label: 'Quadriceps' },
  { slug: 'fessiers', label: 'Fessiers' },
  { slug: 'ischio-jambiers', label: 'Ischio-jambiers' },
  { slug: 'pectoraux', label: 'Pectoraux' },
  { slug: 'dos', label: 'Dos' },
  { slug: 'epaules', label: 'Épaules' },
  { slug: 'biceps', label: 'Biceps' },
  { slug: 'triceps', label: 'Triceps' },
  { slug: 'mollets', label: 'Mollets' },
  { slug: 'abdos', label: 'Abdos' },
  { slug: 'lombaires', label: 'Lombaires' },
]
```

Submit handler (add before the return):

```typescript
async function handleCreate() {
  if (!createForm.name.trim()) return
  setCreating(true)
  setCreateError('')
  const res = await fetch('/api/exercises/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: createForm.name.trim(),
      movement_pattern: createForm.movement_pattern || null,
      is_compound: createForm.is_compound,
      muscles: createForm.muscles,
      stimulus_coefficient: createForm.is_compound ? 0.72 : 0.50,
    }),
  })
  if (res.ok) {
    const created = await res.json()
    onReplace(created.name, '', created.movement_pattern ?? null, created.equipment ?? [])
  } else {
    const err = await res.json()
    setCreateError(err.error ?? 'Erreur lors de la création')
  }
  setCreating(false)
}
```

Create form JSX (render when `view === 'create'`):

```tsx
{view === 'create' && (
  <div className="flex flex-col gap-3 p-4">
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Nom</label>
      <input
        value={createForm.name}
        onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
        placeholder="ex: Hip Thrust Barre Surélevé"
        className="w-full rounded-xl bg-[#0a0a0a] px-3 h-10 text-[13px] text-white placeholder:text-white/20 outline-none"
      />
    </div>
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Pattern</label>
      <select
        value={createForm.movement_pattern}
        onChange={e => setCreateForm(f => ({ ...f, movement_pattern: e.target.value }))}
        className="w-full rounded-xl bg-[#0a0a0a] px-3 h-10 text-[13px] text-white outline-none"
      >
        <option value="">Sélectionner…</option>
        {MOVEMENT_PATTERNS.map(p => (
          <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
        ))}
      </select>
    </div>
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-1.5">Muscles</label>
      <div className="flex flex-wrap gap-1.5">
        {MUSCLE_OPTIONS.map(m => {
          const active = createForm.muscles.includes(m.slug)
          return (
            <button
              key={m.slug}
              type="button"
              onClick={() => setCreateForm(f => ({
                ...f,
                muscles: active ? f.muscles.filter(s => s !== m.slug) : [...f.muscles, m.slug],
              }))}
              className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors ${active ? 'bg-[#1f8a65]/10 text-[#1f8a65]' : 'bg-white/[0.02] text-white/35 hover:bg-white/[0.05]'}`}
            >
              {m.label}
            </button>
          )
        })}
      </div>
    </div>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setCreateForm(f => ({ ...f, is_compound: !f.is_compound }))}
        className={`w-8 h-5 rounded-full transition-colors ${createForm.is_compound ? 'bg-[#1f8a65]' : 'bg-white/[0.10]'}`}
      >
        <span className={`block w-4 h-4 rounded-full bg-white mx-0.5 transition-transform ${createForm.is_compound ? 'translate-x-3' : 'translate-x-0'}`} />
      </button>
      <span className="text-[12px] text-white/60">Exercice composé</span>
    </div>
    {createError && <p className="text-[11px] text-red-400">{createError}</p>}
    <button
      type="button"
      onClick={handleCreate}
      disabled={!createForm.name.trim() || creating}
      className="h-10 rounded-xl bg-[#1f8a65] text-[12px] font-bold text-white hover:bg-[#217356] disabled:opacity-50 transition-colors"
    >
      {creating ? '…' : 'Créer et insérer'}
    </button>
  </div>
)}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/programs/ExerciseAlternativesDrawer.tsx
git commit -m "feat(ui): add 'Créer un exercice' tab in ExerciseAlternativesDrawer with POST /api/exercises/custom"
```

---

## Task 6: ExerciseSwapSheet — Client mobile bottom sheet

**Context:** The spec requires a client-facing swap UI triggered by a swap icon on each exercise in `SessionLogger`. It reuses `scoreAlternatives()` (same engine as the coach drawer). Replacement is **temporary** — stored in component state, never persisted to DB. Template is restored when the session ends (state is in `SessionLogger` which unmounts after submit). The sheet is mobile-first.

**Files:**
- Create: `app/client/programme/session/[sessionId]/ExerciseSwapSheet.tsx`
- Modify: `app/client/programme/session/[sessionId]/SessionLogger.tsx`

- [ ] **Step 1: Create ExerciseSwapSheet**

```typescript
// app/client/programme/session/[sessionId]/ExerciseSwapSheet.tsx
'use client'

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { scoreAlternatives } from '@/lib/programs/intelligence'
import type { BuilderExercise, TemplateMeta } from '@/lib/programs/intelligence'

interface Exercise {
  id: string
  name: string
  sets: number
  reps: string
  rest_sec: number | null
  rir: number | null
  notes: string | null
  image_url: string | null
  is_unilateral: boolean
  movement_pattern?: string | null
  equipment_required?: string[]
  primary_muscles?: string[]
  secondary_muscles?: string[]
}

interface Props {
  exercise: Exercise
  allExercises: Exercise[]
  equipmentArchetype?: string
  onSwap: (exerciseName: string) => void
  onClose: () => void
}

const SEVERITY_LABEL: Record<number, string> = {
  0: 'Recommandé',
  1: 'Similaire',
  2: 'Alternative',
}

export default function ExerciseSwapSheet({ exercise, allExercises, equipmentArchetype = 'commercial_gym', onSwap, onClose }: Props) {
  const [swapped, setSwapped] = useState<string | null>(null)

  const builderExercise: BuilderExercise = {
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    rest_sec: exercise.rest_sec,
    rir: exercise.rir,
    notes: exercise.notes ?? '',
    movement_pattern: exercise.movement_pattern ?? null,
    equipment_required: exercise.equipment_required ?? [],
    primary_muscles: exercise.primary_muscles ?? [],
    secondary_muscles: exercise.secondary_muscles ?? [],
  }

  const sessionBuilderExercises: BuilderExercise[] = allExercises.map(ex => ({
    name: ex.name,
    sets: ex.sets,
    reps: ex.reps,
    rest_sec: ex.rest_sec,
    rir: ex.rir,
    notes: ex.notes ?? '',
    movement_pattern: ex.movement_pattern ?? null,
    equipment_required: ex.equipment_required ?? [],
    primary_muscles: ex.primary_muscles ?? [],
    secondary_muscles: ex.secondary_muscles ?? [],
  }))

  const meta: TemplateMeta = {
    goal: 'hypertrophy',
    level: 'intermediate',
    weeks: 1,
    frequency: 3,
    equipment_archetype: equipmentArchetype,
  }

  const alternatives = useMemo(() =>
    scoreAlternatives(builderExercise, { equipmentArchetype, goal: 'hypertrophy', level: 'intermediate', sessionExercises: sessionBuilderExercises })
      .slice(0, 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exercise.name]
  )

  function handleUse(name: string) {
    setSwapped(name)
    onSwap(name)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-[#181818] rounded-t-2xl pb-safe-area-inset-bottom">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1" />
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Remplacer</p>
            <p className="text-[14px] font-bold text-white leading-tight">{exercise.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/50">
            <X size={14} />
          </button>
        </div>

        <p className="text-[11px] text-white/30 px-4 pb-3">
          Remplacement temporaire — le programme original est restauré après la séance.
        </p>

        <div className="flex flex-col gap-2 px-4 pb-6">
          {alternatives.length === 0 && (
            <p className="text-[12px] text-white/30 py-4 text-center">Aucune alternative trouvée pour cet exercice.</p>
          )}
          {alternatives.map((alt, idx) => (
            <div
              key={alt.entry.slug}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-white truncate">{alt.entry.name}</p>
                  <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#1f8a65]/10 text-[#1f8a65]">
                    {SEVERITY_LABEL[idx] ?? 'Alternative'}
                  </span>
                </div>
                <p className="text-[11px] text-white/40 mt-0.5">{alt.label}</p>
              </div>
              <button
                onClick={() => handleUse(alt.entry.name)}
                className="shrink-0 h-8 px-3 rounded-lg bg-[#1f8a65] text-[11px] font-bold text-white hover:bg-[#217356] transition-colors"
              >
                Utiliser
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Add swap trigger in SessionLogger**

In `app/client/programme/session/[sessionId]/SessionLogger.tsx`:

**Add state** (after existing useState declarations):
```typescript
const [swapTarget, setSwapTarget] = useState<string | null>(null)  // exercise id
const [swappedNames, setSwappedNames] = useState<Record<string, string>>({})  // exerciseId → new name
```

**Add import** at the top (with other imports):
```typescript
import { ArrowLeftRight } from 'lucide-react'
import ExerciseSwapSheet from './ExerciseSwapSheet'
```

**Add swap handler** (before the return):
```typescript
function handleSwap(exerciseId: string, newName: string) {
  setSwappedNames(prev => ({ ...prev, [exerciseId]: newName }))
  setSwapTarget(null)
}
```

**Add swap button** on the current exercise header. Find where the exercise name is rendered in the focused exercise view (search for `currentEx.name` in the JSX). Add a swap button beside it:

```tsx
<button
  onClick={() => setSwapTarget(currentEx.id)}
  className="flex items-center gap-1 h-7 px-2 rounded-lg bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-colors"
  title="Remplacer temporairement"
>
  <ArrowLeftRight size={13} />
</button>
```

**Show swapped name** when displaying the exercise name — replace raw `currentEx.name` in the header with:
```tsx
{swappedNames[currentEx.id] ?? currentEx.name}
```

**Render the sheet** just before the closing tag of the component's return:
```tsx
{swapTarget && (
  <ExerciseSwapSheet
    exercise={{
      ...exercises.find(e => e.id === swapTarget)!,
      movement_pattern: null,
      equipment_required: [],
      primary_muscles: [],
      secondary_muscles: [],
    }}
    allExercises={exercises.map(e => ({
      ...e,
      movement_pattern: null,
      equipment_required: [],
      primary_muscles: [],
      secondary_muscles: [],
    }))}
    onSwap={(newName) => handleSwap(swapTarget, newName)}
    onClose={() => setSwapTarget(null)}
  />
)}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If the `Exercise` interface in `SessionLogger` lacks optional fields for `movement_pattern` etc., add them as optional (`movement_pattern?: string | null`). The sheet will gracefully receive empty arrays.

- [ ] **Step 4: Commit**

```bash
git add "app/client/programme/session/[sessionId]/ExerciseSwapSheet.tsx" "app/client/programme/session/[sessionId]/SessionLogger.tsx"
git commit -m "feat(client): add ExerciseSwapSheet for temporary exercise swap during session"
```

---

## Task 7: Alert click → scroll + highlight exercice in builder

**Context:** The spec says clicking an alert in `ProgramIntelligencePanel` should scroll to and briefly highlight the exercise card in the builder. The alert has `sessionIndex` and `exerciseIndex`. The builder needs a ref map and a highlight state. This is purely UI — no data change.

**Files:**
- Modify: `components/programs/ProgramIntelligencePanel.tsx`
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

- [ ] **Step 1: Add onAlertClick prop to ProgramIntelligencePanel**

In `components/programs/ProgramIntelligencePanel.tsx`, find the `Props` interface and add:

```typescript
onAlertClick?: (sessionIndex: number, exerciseIndex: number) => void
```

Find where alerts are rendered in the feed (search for `alert.title` or the alert list JSX). Wrap each alert item in a clickable element that calls the prop:

```tsx
<button
  key={idx}
  type="button"
  onClick={() => {
    if (alert.sessionIndex !== undefined && alert.exerciseIndex !== undefined) {
      onAlertClick?.(alert.sessionIndex, alert.exerciseIndex)
    }
  }}
  className="w-full text-left ..."  // keep existing className
>
  {/* existing alert content unchanged */}
</button>
```

- [ ] **Step 2: Add ref map + highlight state in ProgramTemplateBuilder**

In `components/programs/ProgramTemplateBuilder.tsx`:

**Add state** (with existing state declarations):
```typescript
const [highlightKey, setHighlightKey] = useState<string | null>(null)
const exerciseRefs = useRef<Record<string, HTMLDivElement | null>>({})
```

**Add scroll handler**:
```typescript
function handleAlertClick(sessionIndex: number, exerciseIndex: number) {
  const key = `${sessionIndex}-${exerciseIndex}`
  const el = exerciseRefs.current[key]
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightKey(key)
    setTimeout(() => setHighlightKey(null), 2000)
  }
}
```

**Attach refs to exercise cards** — find where each exercise card `<div>` is rendered (search for `e.name` in the sessions map JSX). Add ref and highlight class:

```tsx
<div
  ref={el => { exerciseRefs.current[`${si}-${ei}`] = el }}
  className={`... ${highlightKey === `${si}-${ei}` ? 'ring-1 ring-[#1f8a65]/60 ring-offset-1 ring-offset-[#121212]' : ''}`}
>
```

**Pass the handler to ProgramIntelligencePanel**:
```tsx
<ProgramIntelligencePanel
  result={intelligenceResult}
  weeks={meta.weeks}
  onAlertClick={handleAlertClick}
/>
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/programs/ProgramIntelligencePanel.tsx components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(ui): alert click scrolls to and highlights target exercise in builder"
```

---

## Task 8: CHANGELOG + project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Update CHANGELOG.md**

Add at the top under `## 2026-04-18`:

```
FIX: Add equipment to PATCH /api/clients/[clientId] allowlist — RestrictionsWidget equipment toggle was silently ignored
FEATURE: scoreSRA uses IntelligenceProfile.fitnessLevel when provided, overriding meta.level
SCHEMA: Add coach_custom_exercises table with RLS (per-coach isolation)
FEATURE: GET/POST /api/exercises/custom — coach custom exercise persistence
FEATURE: ExercisePicker loads coach custom exercises from API, shows Perso badge
FEATURE: ExerciseAlternativesDrawer — Créer tab with inline custom exercise form
FEATURE: ExerciseSwapSheet — client mobile bottom sheet for temporary exercise swap during session
FEATURE: Alert click in ProgramIntelligencePanel scrolls to and highlights target exercise in builder
```

- [ ] **Step 2: Update project-state.md**

Add a new section `## 2026-04-18 — Program Intelligence Phase 2B` at the top (after the header, before Phase 2A) with:
- Files created/modified
- Key behaviors: custom exercise slug derivation, swap is never persisted, highlight timeout 2s, fitnessLevel override
- Points de vigilance: `equipment` PATCH fix was a silent bug, `ExerciseSwapSheet` receives empty muscle arrays (swap is name-only), ExercisePicker merges static + dynamic on every mount
- Cochez les next steps Phase 2B accomplis dans la section Phase 2A

- [ ] **Step 3: Final TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 new errors (pre-existing BodyFatCalculator + Stripe errors are known and out of scope).

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for Program Intelligence Phase 2B"
```

---

## Self-Review

**Spec coverage check (Phase 1 spec 2026-04-13):**
- ✅ Timeline RIR + bar chart volume — still out of scope (requires per-week data from builder, not available yet — noted in Phase 1 spec as dependent on future builder evolution)
- ✅ Alert click → scroll + highlight: Task 7
- ✅ `ExerciseSwapSheet` (client): Task 6
- ✅ Exercices custom coach — API: Task 3, DB: Task 2, badge: Task 4, inline form: Task 5

**Spec coverage check (Phase 2B next steps from project-state):**
- ✅ `fitnessLevel → scoreSRA`: Task 1
- ✅ Exercices custom coach: Tasks 2–5
- ❌ Supersets — out of scope for this plan (new plan needed, significant engine work)
- ❌ Prédictions sets/reps/RIR — out of scope (requires `client_set_logs` analysis, significant scope)

**Prerequisite bug fix:**
- ✅ `equipment` PATCH allowlist: Prerequisite task

**Placeholder scan:** None found. All code blocks are complete and self-contained.

**Type consistency:**
- `BuilderExercise` from `@/lib/programs/intelligence` — used in Task 6 `ExerciseSwapSheet`, consistent with types.ts definition ✅
- `TemplateMeta` hardcoded in `ExerciseSwapSheet` (goal/level/weeks don't matter for swap — only equipmentArchetype is used by `scoreAlternatives`) ✅
- `onAlertClick(sessionIndex, exerciseIndex)` defined in Task 7 panel props, called in Task 7 builder handler ✅
- `CatalogEntry.source` added in Task 4, used in badge render in Task 4 ✅
- `PATCH /api/clients/[clientId]` `equipment` field: fixed in Prerequisite, used by RestrictionsWidget from Phase 2A ✅
