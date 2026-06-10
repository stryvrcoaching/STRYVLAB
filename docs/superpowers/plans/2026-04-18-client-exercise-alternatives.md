# Client Exercise Alternatives (Système A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a coach to pre-configure up to 3 alternative exercises for each exercise in a program template. During a session, the client sees an "Indisponible ?" button — tapping it shows the pre-configured alternatives and lets the client swap to one for that session only (never persisted).

**Architecture:** New table `coach_template_exercise_alternatives` with FK to `coach_program_template_exercises`. Coach adds alternatives via a new "Alternatives client" section inside each exercise card in `ProgramTemplateBuilder`. On the client side, `SessionLogger` receives alternatives in the page server fetch and renders a bottom sheet (reusing `ExerciseSwapSheet` pattern). The alternative is a temporary in-session name swap — never written to DB.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase (direct SQL migration via MCP), Zod, Tailwind CSS DS v2.0.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260418_template_exercise_alternatives.sql` | Create | New table for coach-configured alternatives |
| `app/api/program-templates/[templateId]/exercises/[exerciseId]/alternatives/route.ts` | Create | GET / POST / DELETE alternatives for a template exercise |
| `components/programs/ExerciseClientAlternatives.tsx` | Create | Inline section in builder card: list + add alternatives |
| `components/programs/ProgramTemplateBuilder.tsx` | Modify | Render ExerciseClientAlternatives inside each exercise card |
| `app/coach/programs/templates/[templateId]/edit/page.tsx` | Modify | Pass templateId down to builder (already done via props) |
| `app/client/programme/session/[sessionId]/page.tsx` | Modify | Fetch pre-configured alternatives per exercise in server fetch |
| `app/client/programme/session/[sessionId]/SessionLogger.tsx` | Modify | Add "Indisponible ?" button + ClientAlternativesSheet bottom sheet |
| `components/client/ClientAlternativesSheet.tsx` | Create | Bottom sheet showing coach-pre-configured alternatives |

---

## Task 1: DB Migration — coach_template_exercise_alternatives

**Files:**
- Create: `supabase/migrations/20260418_template_exercise_alternatives.sql`

**Context:** Stores up to 3 alternatives per template exercise. Each alternative has a name and optional notes from the coach. The `position` column orders them (0, 1, 2). RLS: coach can only read/write alternatives for their own template exercises (join via session → template → coach_id).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260418_template_exercise_alternatives.sql

CREATE TABLE IF NOT EXISTS public.coach_template_exercise_alternatives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id   uuid NOT NULL REFERENCES public.coach_program_template_exercises(id) ON DELETE CASCADE,
  name          text NOT NULL,
  notes         text,
  position      int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by exercise
CREATE INDEX IF NOT EXISTS idx_template_ex_alternatives_exercise_id
  ON public.coach_template_exercise_alternatives (exercise_id, position);

-- RLS
ALTER TABLE public.coach_template_exercise_alternatives ENABLE ROW LEVEL SECURITY;

-- Coach can manage alternatives for their own template exercises
CREATE POLICY "coach_manages_own_alternatives"
  ON public.coach_template_exercise_alternatives
  FOR ALL
  USING (
    exercise_id IN (
      SELECT cte.id
      FROM public.coach_program_template_exercises cte
      JOIN public.coach_program_template_sessions cts ON cts.id = cte.session_id
      JOIN public.coach_program_templates cpt ON cpt.id = cts.template_id
      WHERE cpt.coach_id = auth.uid()
    )
  );

-- Client can read alternatives for exercises in their assigned programs
CREATE POLICY "client_reads_alternatives"
  ON public.coach_template_exercise_alternatives
  FOR SELECT
  USING (
    exercise_id IN (
      SELECT cte.id
      FROM public.coach_program_template_exercises cte
      JOIN public.coach_program_template_sessions cts ON cts.id = cte.session_id
      JOIN public.coach_program_templates cpt ON cpt.id = cts.template_id
      JOIN public.programs p ON p.template_id = cpt.id
      JOIN public.coach_clients cc ON cc.id = p.client_id
      WHERE cc.user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__supabase__apply_migration` with:
- name: `template_exercise_alternatives`
- query: the SQL above

- [ ] **Step 3: Verify table exists**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name = 'coach_template_exercise_alternatives';
```

Expected: 1 row.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260418_template_exercise_alternatives.sql
git commit -m "schema: add coach_template_exercise_alternatives table with RLS for Système A alternatives"
```

---

## Task 2: API — GET / POST / DELETE alternatives

**Files:**
- Create: `app/api/program-templates/[templateId]/exercises/[exerciseId]/alternatives/route.ts`

**Context:** Three operations — GET lists all alternatives for an exercise (ordered by position), POST adds one (max 3 enforced), DELETE removes one. Auth: coach session required. Ownership check: exercise must belong to a template owned by the coach.

- [ ] **Step 1: Create the route file**

```typescript
// app/api/program-templates/[templateId]/exercises/[exerciseId]/alternatives/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'

const postSchema = z.object({
  name: z.string().min(1).max(200),
  notes: z.string().max(500).optional(),
})

async function getCoachAndVerifyOwnership(
  db: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  templateId: string,
  exerciseId: string,
) {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null

  // Verify the exercise belongs to a template owned by this coach
  const { data } = await db
    .from('coach_program_template_exercises')
    .select(`
      id,
      coach_program_template_sessions!inner (
        coach_program_templates!inner ( coach_id )
      )
    `)
    .eq('id', exerciseId)
    .single()

  if (!data) return null
  const coachId = (data as any).coach_program_template_sessions?.coach_program_templates?.coach_id
  if (coachId !== user.id) return null
  return user
}

export async function GET(
  req: NextRequest,
  { params }: { params: { templateId: string; exerciseId: string } },
) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await db
    .from('coach_template_exercise_alternatives')
    .select('id, name, notes, position')
    .eq('exercise_id', params.exerciseId)
    .order('position')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { templateId: string; exerciseId: string } },
) {
  const db = await createClient()
  const user = await getCoachAndVerifyOwnership(db, params.templateId, params.exerciseId)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = postSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  // Enforce max 3 alternatives
  const { count } = await db
    .from('coach_template_exercise_alternatives')
    .select('id', { count: 'exact', head: true })
    .eq('exercise_id', params.exerciseId)

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: 'Maximum 3 alternatives par exercice' }, { status: 422 })
  }

  const { data, error } = await db
    .from('coach_template_exercise_alternatives')
    .insert({
      exercise_id: params.exerciseId,
      name: body.data.name,
      notes: body.data.notes ?? null,
      position: count ?? 0,
    })
    .select('id, name, notes, position')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { templateId: string; exerciseId: string } },
) {
  const db = await createClient()
  const user = await getCoachAndVerifyOwnership(db, params.templateId, params.exerciseId)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const alternativeId = searchParams.get('id')
  if (!alternativeId) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error } = await db
    .from('coach_template_exercise_alternatives')
    .delete()
    .eq('id', alternativeId)
    .eq('exercise_id', params.exerciseId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "alternatives/route" | head -10
```

Expected: 0 lines.

- [ ] **Step 3: Commit**

```bash
git add "app/api/program-templates/[templateId]/exercises/[exerciseId]/alternatives/route.ts"
git commit -m "feat(api): GET/POST/DELETE /program-templates/[id]/exercises/[id]/alternatives — Système A coach pre-configured alternatives"
```

---

## Task 3: ExerciseClientAlternatives component

**Files:**
- Create: `components/programs/ExerciseClientAlternatives.tsx`

**Context:** Inline section rendered inside each exercise card in the builder (edit mode only — when `templateId` is defined). Shows existing alternatives as chips with delete buttons. Has an "Ajouter une alternative" input + save button. Max 3 enforced client-side (button hidden at 3). This component manages its own fetch/state.

- [ ] **Step 1: Create the component**

```typescript
// components/programs/ExerciseClientAlternatives.tsx
'use client'

import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'

interface Alternative {
  id: string
  name: string
  notes: string | null
  position: number
}

interface Props {
  templateId: string
  exerciseId: string  // DB id of the coach_program_template_exercises row
}

export default function ExerciseClientAlternatives({ templateId, exerciseId }: Props) {
  const [alternatives, setAlternatives] = useState<Alternative[]>([])
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const url = `/api/program-templates/${templateId}/exercises/${exerciseId}/alternatives`

  useEffect(() => {
    fetch(url).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setAlternatives(data)
    }).catch(() => {})
  }, [url])

  async function handleAdd() {
    if (!newName.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Erreur')
    } else {
      setAlternatives(prev => [...prev, data])
      setNewName('')
      setAdding(false)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const res = await fetch(`${url}?id=${id}`, { method: 'DELETE' })
    if (res.ok) setAlternatives(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="mt-1">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/30 mb-1.5">
        Alternatives client ({alternatives.length}/3)
      </p>

      {/* Liste des alternatives existantes */}
      {alternatives.length > 0 && (
        <div className="flex flex-col gap-1 mb-1.5">
          {alternatives.map(alt => (
            <div
              key={alt.id}
              className="flex items-center justify-between gap-2 bg-white/[0.03] rounded-lg px-2 py-1.5"
            >
              <span className="text-[11px] text-white/60 truncate">{alt.name}</span>
              <button
                type="button"
                onClick={() => handleDelete(alt.id)}
                className="shrink-0 text-white/25 hover:text-red-400 transition-colors"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire ajout */}
      {adding ? (
        <div className="flex gap-1.5">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Nom de l'alternative…"
            autoFocus
            className="flex-1 bg-[#0a0a0a] rounded-lg px-2 py-1.5 text-[11px] text-white placeholder:text-white/20 outline-none"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            className="shrink-0 px-2 py-1.5 bg-[#1f8a65]/80 text-white text-[10px] font-bold rounded-lg disabled:opacity-40 hover:bg-[#1f8a65] transition-colors"
          >
            {saving ? '…' : 'OK'}
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setNewName(''); setError('') }}
            className="shrink-0 px-2 py-1.5 bg-white/[0.04] text-white/40 text-[10px] rounded-lg hover:bg-white/[0.08] transition-colors"
          >
            ✕
          </button>
        </div>
      ) : alternatives.length < 3 ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/50 transition-colors"
        >
          <Plus size={10} />
          Ajouter une alternative
        </button>
      ) : null}

      {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "ExerciseClientAlternatives" | head -10
```

Expected: 0 lines.

- [ ] **Step 3: Commit**

```bash
git add components/programs/ExerciseClientAlternatives.tsx
git commit -m "feat(ui): ExerciseClientAlternatives — inline coach UI to pre-configure up to 3 client alternatives per exercise"
```

---

## Task 4: Integrate ExerciseClientAlternatives into ProgramTemplateBuilder

**Files:**
- Modify: `components/programs/ProgramTemplateBuilder.tsx`

**Context:** The component should appear inside each exercise card, but **only in edit mode** (when `templateId` prop is defined and the exercise has been saved to DB — i.e., it has a DB id). In new template creation mode, the exercise has no DB id yet, so the section is hidden.

The `Exercise` interface in the builder doesn't store the DB `id` of the saved exercise. We need to add it so the component can target the right row.

- [ ] **Step 1: Add dbId to Exercise interface**

Find `interface Exercise` in `ProgramTemplateBuilder.tsx` and add:

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
  group_id?: string;
  dbId?: string;   // ← add this — DB id, set only when loaded from existing template
}
```

Find `emptyExercise()` and add `dbId: undefined`.

- [ ] **Step 2: Load dbId from initial data**

In the `useState` initializer where exercises are loaded from `initial` (around line ~232), add:

```typescript
dbId: e.id ?? undefined,
```

- [ ] **Step 3: Import ExerciseClientAlternatives**

Add at top of `ProgramTemplateBuilder.tsx`:

```typescript
import ExerciseClientAlternatives from './ExerciseClientAlternatives'
```

- [ ] **Step 4: Render the section inside each exercise card**

Find where the "Notes optionnelles" input is rendered inside the exercise card (search for `Notes optionnelles`). After that input and before the "Alternatives" button row, add:

```tsx
{/* Alternatives client (mode édition uniquement) */}
{isEdit && templateId && ex.dbId && (
  <ExerciseClientAlternatives
    templateId={templateId}
    exerciseId={ex.dbId}
  />
)}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "ProgramTemplateBuilder\|ExerciseClientAlternatives" | head -10
```

Expected: 0 lines.

- [ ] **Step 6: Commit**

```bash
git add components/programs/ProgramTemplateBuilder.tsx
git commit -m "feat(ui): render ExerciseClientAlternatives in builder edit mode — dbId tracked on Exercise"
```

---

## Task 5: Server fetch — load alternatives in session page

**Files:**
- Modify: `app/client/programme/session/[sessionId]/page.tsx`

**Context:** The session page server component fetches `program_exercises` for the session. We need to also fetch alternatives from `coach_template_exercise_alternatives` for each exercise (via the template exercise id — stored in `program_exercises.template_exercise_id` if it exists, or we need to join via `coach_program_template_sessions`).

Check the actual join path: `program_exercises` → `program_sessions` → `programs` → `template_id` → `coach_program_template_sessions` → `coach_program_template_exercises` → `coach_template_exercise_alternatives`.

Since this join is complex, the simplest approach: after fetching `program_exercises`, look up each exercise's alternatives by matching on `name` against `coach_program_template_exercises` within the same template. We add a `clientAlternatives: string[]` to the exercise data passed to `SessionLogger`.

- [ ] **Step 1: Add alternatives fetch to session page**

In `app/client/programme/session/[sessionId]/page.tsx`, after the existing `program_exercises` fetch, add:

```typescript
// Fetch the template_id for this session's program
const { data: sessionData } = await db
  .from('program_sessions')
  .select('program_id, programs!inner(template_id)')
  .eq('id', sessionId)
  .single()

const templateId = (sessionData as any)?.programs?.template_id as string | null

// For each exercise, find coach-configured alternatives via name match in the template
let alternativesMap: Record<string, string[]> = {}
if (templateId && exercises?.length) {
  const { data: templateExercises } = await db
    .from('coach_program_template_exercises')
    .select(`
      name,
      coach_template_exercise_alternatives (name, position)
    `)
    .in('name', exercises.map((e: any) => e.name))

  if (templateExercises) {
    for (const te of templateExercises) {
      const alts = ((te as any).coach_template_exercise_alternatives ?? [])
        .sort((a: any, b: any) => a.position - b.position)
        .map((a: any) => a.name as string)
      if (alts.length > 0) alternativesMap[te.name] = alts
    }
  }
}
```

Then pass `clientAlternatives` to the `SessionLogger` for each exercise:

```typescript
exercises: (exercises ?? []).map((e: any) => ({
  // ... existing fields ...
  clientAlternatives: alternativesMap[e.name] ?? [],
}))
```

- [ ] **Step 2: Update SessionLogger props type**

In `SessionLogger.tsx`, find the `Exercise` interface (or prop type) and add:

```typescript
clientAlternatives?: string[]  // coach-pre-configured alternatives
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "session/\[sessionId\]" | head -10
```

Expected: 0 lines.

- [ ] **Step 4: Commit**

```bash
git add "app/client/programme/session/[sessionId]/page.tsx" "app/client/programme/session/[sessionId]/SessionLogger.tsx"
git commit -m "feat(client): fetch coach-pre-configured alternatives in session page, pass to SessionLogger"
```

---

## Task 6: ClientAlternativesSheet + SessionLogger integration

**Files:**
- Create: `components/client/ClientAlternativesSheet.tsx`
- Modify: `app/client/programme/session/[sessionId]/SessionLogger.tsx`

**Context:** When a client taps "Indisponible ?" on an exercise that has pre-configured alternatives, a bottom sheet opens showing the alternatives list. Tapping one swaps the exercise name for the rest of the session (local state only, never persisted). This reuses the same pattern as `ExerciseSwapSheet`.

- [ ] **Step 1: Create ClientAlternativesSheet**

```typescript
// components/client/ClientAlternativesSheet.tsx
'use client'

import { X } from 'lucide-react'

interface Props {
  exerciseName: string
  alternatives: string[]
  onSelect: (name: string) => void
  onClose: () => void
}

export default function ClientAlternativesSheet({ exerciseName, alternatives, onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-[#181818] rounded-t-2xl p-5 pb-8 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30 mb-0.5">
              Alternatives à
            </p>
            <p className="text-[15px] font-bold text-white leading-snug">{exerciseName}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/50"
          >
            <X size={14} />
          </button>
        </div>

        <p className="text-[12px] text-white/40 -mt-1">
          Exercice indisponible ? Choisissez une alternative préparée par votre coach.
        </p>

        <div className="flex flex-col gap-2">
          {alternatives.map((alt, i) => (
            <button
              key={i}
              onClick={() => { onSelect(alt); onClose() }}
              className="flex items-center justify-between w-full bg-white/[0.04] hover:bg-white/[0.08] rounded-xl px-4 py-3.5 text-left transition-colors active:scale-[0.98]"
            >
              <span className="text-[13px] font-semibold text-white">{alt}</span>
              <span className="text-[11px] text-[#1f8a65] font-bold">Choisir →</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add "Indisponible ?" button + sheet in SessionLogger**

In `SessionLogger.tsx`, add state:

```typescript
const [altSheetTarget, setAltSheetTarget] = useState<number | null>(null)
```

Find where the exercise name / header is rendered for the current exercise. After the exercise name display, add the button (only when `currentEx.clientAlternatives?.length`):

```tsx
{currentEx.clientAlternatives && currentEx.clientAlternatives.length > 0 && !swappedNames[currentExIndex] && (
  <button
    type="button"
    onClick={() => setAltSheetTarget(currentExIndex)}
    className="text-[10px] font-semibold text-white/30 hover:text-amber-400 transition-colors flex items-center gap-1"
  >
    Indisponible ?
  </button>
)}
```

At the bottom of the component, add:

```tsx
{altSheetTarget !== null && exercises[altSheetTarget]?.clientAlternatives?.length ? (
  <ClientAlternativesSheet
    exerciseName={swappedNames[altSheetTarget] ?? exercises[altSheetTarget].name}
    alternatives={exercises[altSheetTarget].clientAlternatives!}
    onSelect={name => setSwappedNames(prev => ({ ...prev, [altSheetTarget]: name }))}
    onClose={() => setAltSheetTarget(null)}
  />
) : null}
```

Add the import at the top:

```typescript
import ClientAlternativesSheet from '@/components/client/ClientAlternativesSheet'
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "SessionLogger\|ClientAlternativesSheet" | head -10
```

Expected: 0 lines.

- [ ] **Step 4: Commit**

```bash
git add components/client/ClientAlternativesSheet.tsx "app/client/programme/session/[sessionId]/SessionLogger.tsx"
git commit -m "feat(client): ClientAlternativesSheet + Indisponible? button in SessionLogger — Système A alternatives live"
```

---

## Task 7: CHANGELOG + project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Update CHANGELOG**

```
SCHEMA: Add coach_template_exercise_alternatives table (max 3 per exercise, RLS coach + client)
FEATURE: GET/POST/DELETE /api/program-templates/[id]/exercises/[id]/alternatives — Système A API
FEATURE: ExerciseClientAlternatives — coach UI in builder edit mode to pre-configure client alternatives
FEATURE: ClientAlternativesSheet — client bottom sheet "Indisponible ?" showing coach-pre-configured alternatives
FEATURE: SessionLogger — Indisponible? button per exercise, temporary name swap from pre-configured alternatives
```

- [ ] **Step 2: Add project-state section**

Add `## 2026-04-18 — Système A : Alternatives Client` to `.claude/rules/project-state.md` with:
- Files modified
- Key behavior: alternatives are temp swaps in SessionLogger state only — never written to `client_set_logs`
- Points de vigilance:
  - La section `ExerciseClientAlternatives` ne s'affiche que si `isEdit && templateId && ex.dbId` — en mode création, l'exercice n'est pas encore en DB
  - Le matching alternatives → exercice se fait par `name` dans la page serveur — si le coach renomme un exercice après avoir configuré des alternatives, le lien est rompu
  - Max 3 alternatives enforced côté API (422) ET côté UI (bouton masqué)
  - `clientAlternatives` et `ExerciseSwapSheet` (swap depuis catalogue) coexistent — `swappedNames` state est partagé

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for Système A client alternatives"
```
