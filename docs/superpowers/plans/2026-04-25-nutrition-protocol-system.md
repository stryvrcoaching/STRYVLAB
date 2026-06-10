# Nutrition Protocol System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a coach-scoped nutrition protocol system where all nutrition tools (Macros, Carb Cycling, Hydratation, Cycle Sync) are accessible only via a client context, with automatic biometric pre-fill, multi-day protocol creation, save/share to client, and a client-facing result view.

**Architecture:** New table `nutrition_protocols` + `nutrition_protocol_days` stores versioned protocols per client. The existing `/outils/macros` standalone route is removed and replaced by a unified tool page at `/coach/clients/[clientId]/protocoles/nutrition/new`. Client biometric data is fetched directly via a new `/api/clients/[clientId]/nutrition-data` endpoint (same data shape as `LabClient` from lab-client-search). Sharing a protocol auto-creates a `metric_annotation` with `event_type = 'nutrition'` on the client's metrics timeline.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase (raw SQL migration), React hooks, Tailwind DS v2.0, Framer Motion, Lucide React.

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260425_nutrition_protocols.sql` | Tables `nutrition_protocols` + `nutrition_protocol_days` + RLS |
| `app/api/clients/[clientId]/nutrition-data/route.ts` | GET — returns enriched `LabClient` data for a specific clientId (no search, direct fetch) |
| `app/api/clients/[clientId]/nutrition-protocols/route.ts` | GET list + POST create protocol |
| `app/api/clients/[clientId]/nutrition-protocols/[protocolId]/route.ts` | GET one + PATCH update + DELETE |
| `app/api/clients/[clientId]/nutrition-protocols/[protocolId]/share/route.ts` | POST share (sets status=shared, creates annotation, archives previous shared) |
| `app/api/clients/[clientId]/nutrition-protocols/[protocolId]/unshare/route.ts` | POST unshare (sets status=draft) |
| `app/coach/clients/[clientId]/protocoles/nutrition/page.tsx` | Dashboard: active protocol + history list |
| `app/coach/clients/[clientId]/protocoles/nutrition/new/page.tsx` | Wrapper page for new protocol tool |
| `app/coach/clients/[clientId]/protocoles/nutrition/[protocolId]/edit/page.tsx` | Wrapper page for editing existing protocol |
| `components/nutrition/NutritionProtocolTool.tsx` | Unified tool: Macros + Carb Cycling + Hydratation + Cycle Sync (replaces MacroCalculator standalone) |
| `components/nutrition/NutritionProtocolDayTabs.tsx` | Day tabs management (add/remove/rename days) |
| `components/nutrition/NutritionMacrosSection.tsx` | Macros & calories section (extracted from MacroCalculator logic) |
| `components/nutrition/NutritionCarbCyclingSection.tsx` | Carb cycling section per day |
| `components/nutrition/NutritionHydratationSection.tsx` | Hydratation section per day |
| `components/nutrition/NutritionCycleSyncSection.tsx` | Cycle sync section — rendered only if client gender = female |
| `components/nutrition/NutritionProtocolDashboard.tsx` | Active protocol display card + day pills + donut |
| `app/client/nutrition/page.tsx` | Client-facing nutrition page (active protocol result only) |
| `lib/nutrition/types.ts` | Shared TypeScript types for protocol, day, and tool state |

### Modified files
| File | Change |
|------|--------|
| `app/outils/macros/page.tsx` | Redirect to `/coach/clients` (remove standalone) |
| `app/outils/macros/MacroCalculator.tsx` | Keep as-is (logic reused in NutritionMacrosSection) |
| `app/coach/clients/[clientId]/protocoles/nutrition/page.tsx` | Full rewrite (was a simple tool list) |
| `components/client/BottomNav.tsx` | Add `/client/nutrition` nav item |
| `components/clients/MetricsSection.tsx` | Add `'nutrition'` to `AnnotationType` (already exists — verify) |
| `CHANGELOG.md` | Update after each task |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260425_nutrition_protocols.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260425_nutrition_protocols.sql

-- nutrition_protocols
CREATE TABLE IF NOT EXISTS nutrition_protocols (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Protocole sans titre',
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'shared')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- nutrition_protocol_days
CREATE TABLE IF NOT EXISTS nutrition_protocol_days (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id      UUID NOT NULL REFERENCES nutrition_protocols(id) ON DELETE CASCADE,
  name             TEXT NOT NULL DEFAULT 'Jour',
  position         INT  NOT NULL DEFAULT 0,
  calories         NUMERIC,
  protein_g        NUMERIC,
  carbs_g          NUMERIC,
  fat_g            NUMERIC,
  hydration_ml     INT,
  carb_cycle_type  TEXT CHECK (carb_cycle_type IN ('high', 'medium', 'low')),
  cycle_sync_phase TEXT CHECK (cycle_sync_phase IN ('follicular', 'ovulatory', 'luteal', 'menstrual')),
  recommendations  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE TRIGGER set_nutrition_protocols_updated_at
  BEFORE UPDATE ON nutrition_protocols
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nutrition_protocols_client_id ON nutrition_protocols(client_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_protocols_status ON nutrition_protocols(client_id, status);
CREATE INDEX IF NOT EXISTS idx_nutrition_protocol_days_protocol_id ON nutrition_protocol_days(protocol_id, position);

-- RLS
ALTER TABLE nutrition_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_protocol_days ENABLE ROW LEVEL SECURITY;

-- Coach: full access to their own clients' protocols
CREATE POLICY "coach_nutrition_protocols" ON nutrition_protocols
  FOR ALL USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );

-- Client: SELECT only on shared protocols
CREATE POLICY "client_nutrition_protocols_read" ON nutrition_protocols
  FOR SELECT USING (
    status = 'shared' AND
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

-- Coach: full access to days (via protocol ownership)
CREATE POLICY "coach_nutrition_protocol_days" ON nutrition_protocol_days
  FOR ALL USING (
    protocol_id IN (
      SELECT id FROM nutrition_protocols
      WHERE client_id IN (
        SELECT id FROM coach_clients WHERE coach_id = auth.uid()
      )
    )
  );

-- Client: SELECT only on shared protocol days
CREATE POLICY "client_nutrition_protocol_days_read" ON nutrition_protocol_days
  FOR SELECT USING (
    protocol_id IN (
      SELECT id FROM nutrition_protocols
      WHERE status = 'shared' AND
        client_id IN (
          SELECT id FROM coach_clients WHERE user_id = auth.uid()
        )
    )
  );
```

- [ ] **Step 2: Apply migration in Supabase Dashboard SQL Editor**

Paste the SQL above in Supabase Dashboard → SQL Editor → Run.
Expected: Tables created, no errors.

- [ ] **Step 3: Verify tables exist**

```bash
# In Supabase Dashboard → Table Editor, confirm:
# - nutrition_protocols (6 columns + timestamps)
# - nutrition_protocol_days (11 columns + timestamps)
```

- [ ] **Step 4: Update CHANGELOG.md**

```
## 2026-04-25
SCHEMA: Add nutrition_protocols and nutrition_protocol_days tables with RLS
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260425_nutrition_protocols.sql CHANGELOG.md
git commit -m "schema: add nutrition_protocols and nutrition_protocol_days tables"
```

---

## Task 2: Shared TypeScript Types

**Files:**
- Create: `lib/nutrition/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// lib/nutrition/types.ts

export interface NutritionProtocol {
  id: string
  client_id: string
  coach_id: string
  name: string
  status: 'draft' | 'shared'
  notes: string | null
  created_at: string
  updated_at: string
  days?: NutritionProtocolDay[]
}

export interface NutritionProtocolDay {
  id: string
  protocol_id: string
  name: string
  position: number
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  hydration_ml: number | null
  carb_cycle_type: 'high' | 'medium' | 'low' | null
  cycle_sync_phase: 'follicular' | 'ovulatory' | 'luteal' | 'menstrual' | null
  recommendations: string | null
  created_at: string
}

// Local state for a day being edited in the tool (includes unsaved changes)
export interface DayDraft {
  localId: string        // temp id for new days not yet saved
  dbId?: string          // undefined until saved
  name: string
  calories: string       // string for input binding
  protein_g: string
  carbs_g: string
  fat_g: string
  hydration_ml: string
  carb_cycle_type: 'high' | 'medium' | 'low' | ''
  cycle_sync_phase: 'follicular' | 'ovulatory' | 'luteal' | 'menstrual' | ''
  recommendations: string
}

export function emptyDayDraft(name = 'Nouveau jour'): DayDraft {
  return {
    localId: crypto.randomUUID(),
    name,
    calories: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
    hydration_ml: '',
    carb_cycle_type: '',
    cycle_sync_phase: '',
    recommendations: '',
  }
}

export function dayDraftFromDb(day: NutritionProtocolDay): DayDraft {
  return {
    localId: day.id,
    dbId: day.id,
    name: day.name,
    calories: day.calories != null ? String(day.calories) : '',
    protein_g: day.protein_g != null ? String(day.protein_g) : '',
    carbs_g: day.carbs_g != null ? String(day.carbs_g) : '',
    fat_g: day.fat_g != null ? String(day.fat_g) : '',
    hydration_ml: day.hydration_ml != null ? String(day.hydration_ml) : '',
    carb_cycle_type: day.carb_cycle_type ?? '',
    cycle_sync_phase: day.cycle_sync_phase ?? '',
    recommendations: day.recommendations ?? '',
  }
}

// Enriched client data for pre-filling the tool
export interface NutritionClientData {
  id: string
  name: string
  gender: string | null
  age: number | null
  height_cm: number | null
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  lean_mass_kg: number | null
  bmr_kcal_measured: number | null
  visceral_fat_level: number | null
  weekly_frequency: number | null
  training_goal: string | null
  sport_practice: string | null
  session_duration_min: number | null
  training_calories_weekly: number | null
  cardio_frequency: number | null
  cardio_duration_min: number | null
  daily_steps: number | null
  stress_level: number | null
  sleep_duration_h: number | null
  sleep_quality: number | null
  energy_level: number | null
  caffeine_daily_mg: number | null
  alcohol_weekly: number | null
  work_hours_per_week: number | null
  menstrual_cycle: string | null
  occupation: string | null
  occupation_multiplier: number | null
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add lib/nutrition/types.ts
git commit -m "feat(nutrition): add shared TypeScript types for protocol system"
```

---

## Task 3: API — Nutrition Client Data Endpoint

**Files:**
- Create: `app/api/clients/[clientId]/nutrition-data/route.ts`

This endpoint reuses the aggregation logic from `/api/lab/client-search/route.ts` but for a single specific client by ID (no search, direct fetch).

- [ ] **Step 1: Create the endpoint**

```typescript
// app/api/clients/[clientId]/nutrition-data/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { NutritionClientData } from '@/lib/nutrition/types'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function avg(samples: number[]): number | null {
  if (samples.length === 0) return null
  return Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10
}

const OCCUPATION_MULTIPLIER_MAP: Record<string, number> = {
  'Sédentaire (bureau)': 1.00,
  'Légèrement actif': 1.05,
  'Modérément actif': 1.10,
  'Très actif (travail physique)': 1.18,
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const { clientId } = params

  // Ownership check
  const { data: client, error: clientError } = await db
    .from('coach_clients')
    .select('id, first_name, last_name, email, date_of_birth, gender, weekly_frequency, fitness_level, training_goal, sport_practice, equipment_category')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch assessment data — same aggregation as lab/client-search
  const { data: submissions } = await db
    .from('assessment_submissions')
    .select(`
      client_id,
      submitted_at,
      assessment_responses(field_key, value_number, value_text, value_json)
    `)
    .eq('client_id', clientId)
    .eq('coach_id', user.id)
    .eq('status', 'completed')
    .order('submitted_at', { ascending: false })
    .limit(20)

  // Aggregate metrics (same logic as lab-client-search)
  const entry = {
    weight_kg: null as number | null,
    body_fat_pct: null as number | null,
    height_cm: null as number | null,
    muscle_mass_kg: null as number | null,
    lean_mass_kg: null as number | null,
    bmr_kcal_measured: null as number | null,
    visceral_fat_level: null as number | null,
    session_duration_min: null as number | null,
    training_calories: null as number | null,
    training_frequency: null as number | null,
    daily_steps: null as number | null,
    cardio_frequency: null as number | null,
    cardio_duration_min: null as number | null,
    caffeine_daily_mg: null as number | null,
    alcohol_weekly: null as number | null,
    work_hours_per_week: null as number | null,
    occupation: null as string | null,
    menstrual_cycle: null as string | null,
    stress_samples: [] as number[],
    sleep_h_samples: [] as number[],
    sleep_q_samples: [] as number[],
    energy_samples: [] as number[],
  }

  const BIOMETRIC = ['weight_kg', 'body_fat_pct', 'height_cm', 'muscle_mass_kg', 'lean_mass_kg', 'bmr_kcal_measured', 'visceral_fat_level']
  const TRAINING  = ['session_duration_min', 'training_calories', 'training_frequency']
  const CARDIO    = ['daily_steps', 'cardio_frequency', 'cardio_duration_min']
  const LIFESTYLE = ['caffeine_daily_mg', 'alcohol_weekly', 'work_hours_per_week']

  for (const sub of (submissions ?? [])) {
    const responses = sub.assessment_responses as { field_key: string; value_number: number | null; value_text: string | null; value_json: unknown }[] ?? []
    for (const r of responses) {
      const num = r.value_number
      const key = r.field_key as keyof typeof entry

      if (BIOMETRIC.includes(r.field_key) && (entry as Record<string, unknown>)[r.field_key] === null && num !== null) {
        (entry as Record<string, unknown>)[r.field_key] = num; continue
      }
      if (TRAINING.includes(r.field_key) && (entry as Record<string, unknown>)[r.field_key] === null && num !== null) {
        (entry as Record<string, unknown>)[r.field_key] = num; continue
      }
      if (CARDIO.includes(r.field_key) && (entry as Record<string, unknown>)[r.field_key] === null && num !== null) {
        (entry as Record<string, unknown>)[r.field_key] = num; continue
      }
      if (LIFESTYLE.includes(r.field_key) && (entry as Record<string, unknown>)[r.field_key] === null && num !== null) {
        (entry as Record<string, unknown>)[r.field_key] = num; continue
      }
      if (r.field_key === 'stress_level'    && num !== null && entry.stress_samples.length < 3)  { entry.stress_samples.push(num); continue }
      if (r.field_key === 'sleep_duration_h' && num !== null && entry.sleep_h_samples.length < 3) { entry.sleep_h_samples.push(num); continue }
      if (r.field_key === 'sleep_quality'   && num !== null && entry.sleep_q_samples.length < 3)  { entry.sleep_q_samples.push(num); continue }
      if (r.field_key === 'energy_level'    && num !== null && entry.energy_samples.length < 3)   { entry.energy_samples.push(num); continue }
      if (r.field_key === 'occupation'      && entry.occupation === null      && r.value_text) { entry.occupation = r.value_text; continue }
      if (r.field_key === 'menstrual_cycle' && entry.menstrual_cycle === null && r.value_text) { entry.menstrual_cycle = r.value_text; continue }
    }
  }

  let age: number | null = null
  if (client.date_of_birth) {
    const dob = new Date(client.date_of_birth)
    const today = new Date()
    age = today.getFullYear() - dob.getFullYear()
    const m = today.getMonth() - dob.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  }

  const result: NutritionClientData = {
    id: client.id,
    name: [client.first_name, client.last_name].filter(Boolean).join(' '),
    gender: client.gender ?? null,
    age,
    height_cm: entry.height_cm,
    weight_kg: entry.weight_kg,
    body_fat_pct: entry.body_fat_pct,
    muscle_mass_kg: entry.muscle_mass_kg,
    lean_mass_kg: entry.lean_mass_kg,
    bmr_kcal_measured: entry.bmr_kcal_measured,
    visceral_fat_level: entry.visceral_fat_level,
    weekly_frequency: client.weekly_frequency ?? entry.training_frequency,
    training_goal: client.training_goal ?? null,
    sport_practice: client.sport_practice ?? null,
    session_duration_min: entry.session_duration_min,
    training_calories_weekly: entry.training_calories,
    cardio_frequency: entry.cardio_frequency,
    cardio_duration_min: entry.cardio_duration_min,
    daily_steps: entry.daily_steps,
    stress_level: avg(entry.stress_samples),
    sleep_duration_h: avg(entry.sleep_h_samples),
    sleep_quality: avg(entry.sleep_q_samples),
    energy_level: avg(entry.energy_samples),
    caffeine_daily_mg: entry.caffeine_daily_mg,
    alcohol_weekly: entry.alcohol_weekly,
    work_hours_per_week: entry.work_hours_per_week,
    menstrual_cycle: entry.menstrual_cycle,
    occupation: entry.occupation,
    occupation_multiplier: entry.occupation ? (OCCUPATION_MULTIPLIER_MAP[entry.occupation] ?? null) : null,
  }

  return NextResponse.json({ client: result })
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Update CHANGELOG.md**

```
FEATURE: Add GET /api/clients/[clientId]/nutrition-data — enriched biometric data for nutrition tool
```

- [ ] **Step 4: Commit**

```bash
git add app/api/clients/[clientId]/nutrition-data/route.ts CHANGELOG.md
git commit -m "feat(nutrition): add /api/clients/[clientId]/nutrition-data endpoint"
```

---

## Task 4: API — Nutrition Protocols CRUD

**Files:**
- Create: `app/api/clients/[clientId]/nutrition-protocols/route.ts`
- Create: `app/api/clients/[clientId]/nutrition-protocols/[protocolId]/route.ts`
- Create: `app/api/clients/[clientId]/nutrition-protocols/[protocolId]/share/route.ts`
- Create: `app/api/clients/[clientId]/nutrition-protocols/[protocolId]/unshare/route.ts`

- [ ] **Step 1: Create the list + create endpoint**

```typescript
// app/api/clients/[clientId]/nutrition-protocols/route.ts
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

async function ownershipCheck(coachId: string, clientId: string) {
  const db = serviceClient()
  const { data } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', coachId)
    .single()
  return !!data
}

// GET — list all protocols for this client (with days)
export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clientId } = params
  if (!(await ownershipCheck(user.id, clientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const db = serviceClient()
  const { data, error } = await db
    .from('nutrition_protocols')
    .select(`
      *,
      days:nutrition_protocol_days(*)
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sort days by position within each protocol
  const protocols = (data ?? []).map(p => ({
    ...p,
    days: (p.days ?? []).sort((a: { position: number }, b: { position: number }) => a.position - b.position),
  }))

  return NextResponse.json({ protocols })
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  notes: z.string().optional().nullable(),
  days: z.array(z.object({
    name: z.string().min(1).max(200),
    position: z.number().int().min(0),
    calories: z.number().nullable().optional(),
    protein_g: z.number().nullable().optional(),
    carbs_g: z.number().nullable().optional(),
    fat_g: z.number().nullable().optional(),
    hydration_ml: z.number().int().nullable().optional(),
    carb_cycle_type: z.enum(['high', 'medium', 'low']).nullable().optional(),
    cycle_sync_phase: z.enum(['follicular', 'ovulatory', 'luteal', 'menstrual']).nullable().optional(),
    recommendations: z.string().nullable().optional(),
  })).min(1),
})

// POST — create a new protocol with days
export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { clientId } = params
  if (!(await ownershipCheck(user.id, clientId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = createSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = serviceClient()

  const { data: protocol, error: protoError } = await db
    .from('nutrition_protocols')
    .insert({ client_id: clientId, coach_id: user.id, name: body.data.name, notes: body.data.notes ?? null })
    .select('*')
    .single()

  if (protoError || !protocol) {
    return NextResponse.json({ error: protoError?.message ?? 'Failed to create protocol' }, { status: 500 })
  }

  const daysToInsert = body.data.days.map(d => ({
    protocol_id: protocol.id,
    name: d.name,
    position: d.position,
    calories: d.calories ?? null,
    protein_g: d.protein_g ?? null,
    carbs_g: d.carbs_g ?? null,
    fat_g: d.fat_g ?? null,
    hydration_ml: d.hydration_ml ?? null,
    carb_cycle_type: d.carb_cycle_type ?? null,
    cycle_sync_phase: d.cycle_sync_phase ?? null,
    recommendations: d.recommendations ?? null,
  }))

  const { data: days, error: daysError } = await db
    .from('nutrition_protocol_days')
    .insert(daysToInsert)
    .select('*')

  if (daysError) {
    return NextResponse.json({ error: daysError.message }, { status: 500 })
  }

  return NextResponse.json({ protocol: { ...protocol, days: days ?? [] } }, { status: 201 })
}
```

- [ ] **Step 2: Create the single protocol endpoint**

```typescript
// app/api/clients/[clientId]/nutrition-protocols/[protocolId]/route.ts
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

async function resolveProtocol(coachId: string, clientId: string, protocolId: string) {
  const db = serviceClient()
  const { data } = await db
    .from('nutrition_protocols')
    .select(`*, days:nutrition_protocol_days(*)`)
    .eq('id', protocolId)
    .eq('client_id', clientId)
    .single()
  if (!data) return null
  // Verify coach ownership via coach_clients
  const { data: cc } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', coachId)
    .single()
  if (!cc) return null
  return { ...data, days: (data.days ?? []).sort((a: { position: number }, b: { position: number }) => a.position - b.position) }
}

// GET — single protocol with days
export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string; protocolId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const protocol = await resolveProtocol(user.id, params.clientId, params.protocolId)
  if (!protocol) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ protocol })
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  notes: z.string().nullable().optional(),
  days: z.array(z.object({
    id: z.string().uuid().optional(),  // undefined = new day
    name: z.string().min(1).max(200),
    position: z.number().int().min(0),
    calories: z.number().nullable().optional(),
    protein_g: z.number().nullable().optional(),
    carbs_g: z.number().nullable().optional(),
    fat_g: z.number().nullable().optional(),
    hydration_ml: z.number().int().nullable().optional(),
    carb_cycle_type: z.enum(['high', 'medium', 'low']).nullable().optional(),
    cycle_sync_phase: z.enum(['follicular', 'ovulatory', 'luteal', 'menstrual']).nullable().optional(),
    recommendations: z.string().nullable().optional(),
  })).optional(),
})

// PATCH — update protocol name/notes/days
export async function PATCH(
  req: NextRequest,
  { params }: { params: { clientId: string; protocolId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await resolveProtocol(user.id, params.clientId, params.protocolId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = updateSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = serviceClient()

  // Update protocol metadata
  if (body.data.name !== undefined || body.data.notes !== undefined) {
    const updates: Record<string, unknown> = {}
    if (body.data.name !== undefined) updates.name = body.data.name
    if (body.data.notes !== undefined) updates.notes = body.data.notes
    await db.from('nutrition_protocols').update(updates).eq('id', params.protocolId)
  }

  // Replace all days if provided
  if (body.data.days !== undefined) {
    await db.from('nutrition_protocol_days').delete().eq('protocol_id', params.protocolId)
    const daysToInsert = body.data.days.map(d => ({
      protocol_id: params.protocolId,
      name: d.name,
      position: d.position,
      calories: d.calories ?? null,
      protein_g: d.protein_g ?? null,
      carbs_g: d.carbs_g ?? null,
      fat_g: d.fat_g ?? null,
      hydration_ml: d.hydration_ml ?? null,
      carb_cycle_type: d.carb_cycle_type ?? null,
      cycle_sync_phase: d.cycle_sync_phase ?? null,
      recommendations: d.recommendations ?? null,
    }))
    await db.from('nutrition_protocol_days').insert(daysToInsert)
  }

  const updated = await resolveProtocol(user.id, params.clientId, params.protocolId)
  return NextResponse.json({ protocol: updated })
}

// DELETE
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { clientId: string; protocolId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await resolveProtocol(user.id, params.clientId, params.protocolId)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const db = serviceClient()
  await db.from('nutrition_protocols').delete().eq('id', params.protocolId)

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Create the share endpoint**

```typescript
// app/api/clients/[clientId]/nutrition-protocols/[protocolId]/share/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { clientId: string; protocolId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()

  // Ownership check
  const { data: cc } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()
  if (!cc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify protocol belongs to this client
  const { data: protocol } = await db
    .from('nutrition_protocols')
    .select('id, name')
    .eq('id', params.protocolId)
    .eq('client_id', params.clientId)
    .single()
  if (!protocol) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Archive any previously shared protocol for this client
  await db
    .from('nutrition_protocols')
    .update({ status: 'draft' })
    .eq('client_id', params.clientId)
    .eq('status', 'shared')
    .neq('id', params.protocolId)

  // Set this protocol as shared
  await db
    .from('nutrition_protocols')
    .update({ status: 'shared' })
    .eq('id', params.protocolId)

  // Create metric annotation — same system as existing annotations
  const today = new Date().toISOString().split('T')[0]
  await db
    .from('metric_annotations')
    .insert({
      client_id: params.clientId,
      coach_id: user.id,
      event_type: 'nutrition',
      event_date: today,
      label: `Protocole nutritionnel : ${protocol.name}`,
      body: `Protocole partagé avec le client`,
    })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Create the unshare endpoint**

```typescript
// app/api/clients/[clientId]/nutrition-protocols/[protocolId]/unshare/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { clientId: string; protocolId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()

  const { data: cc } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()
  if (!cc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db
    .from('nutrition_protocols')
    .update({ status: 'draft' })
    .eq('id', params.protocolId)
    .eq('client_id', params.clientId)

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 6: Update CHANGELOG.md**

```
FEATURE: Add nutrition protocol CRUD API (list, create, update, delete, share, unshare)
```

- [ ] **Step 7: Commit**

```bash
git add app/api/clients/[clientId]/nutrition-protocols/ CHANGELOG.md
git commit -m "feat(nutrition): add nutrition protocol CRUD and share/unshare API endpoints"
```

---

## Task 5: Coach — Nutrition Protocol Dashboard Page

**Files:**
- Modify: `app/coach/clients/[clientId]/protocoles/nutrition/page.tsx`
- Create: `components/nutrition/NutritionProtocolDashboard.tsx`

- [ ] **Step 1: Create NutritionProtocolDashboard component**

```tsx
// components/nutrition/NutritionProtocolDashboard.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, Clock, Plus, Edit2, Trash2, Share2, EyeOff, ChevronRight } from 'lucide-react'
import type { NutritionProtocol, NutritionProtocolDay } from '@/lib/nutrition/types'

// Minimal SVG donut for macro visualization
function MacroDonut({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const total = protein * 4 + carbs * 4 + fat * 9
  if (total === 0) return null

  const proteinPct = (protein * 4) / total
  const carbsPct   = (carbs * 4) / total
  const fatPct     = (fat * 9) / total

  const r = 28
  const cx = 36
  const cy = 36
  const circ = 2 * Math.PI * r

  function arc(startPct: number, pct: number) {
    const start = startPct * circ
    const len   = pct * circ
    return `${len} ${circ - len}`
  }

  const proteinOffset = 0
  const carbsOffset   = proteinPct * circ
  const fatOffset     = (proteinPct + carbsPct) * circ

  return (
    <svg width={72} height={72} viewBox="0 0 72 72" className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={8} />
      {/* Protein — green */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1f8a65" strokeWidth={8}
        strokeDasharray={arc(0, proteinPct)} strokeDashoffset={-proteinOffset}
        transform={`rotate(-90 ${cx} ${cy})`} />
      {/* Carbs — blue */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3b82f6" strokeWidth={8}
        strokeDasharray={arc(proteinPct, carbsPct)} strokeDashoffset={-carbsOffset}
        transform={`rotate(-90 ${cx} ${cy})`} />
      {/* Fat — amber */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f59e0b" strokeWidth={8}
        strokeDasharray={arc(proteinPct + carbsPct, fatPct)} strokeDashoffset={-fatOffset}
        transform={`rotate(-90 ${cx} ${cy})`} />
    </svg>
  )
}

interface Props {
  protocols: NutritionProtocol[]
  onRefresh: () => void
}

export default function NutritionProtocolDashboard({ protocols, onRefresh }: Props) {
  const params    = useParams()
  const router    = useRouter()
  const clientId  = params.clientId as string
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const shared  = protocols.find(p => p.status === 'shared')
  const drafts  = protocols.filter(p => p.status !== 'shared')

  async function handleShare(protocolId: string) {
    setActionLoading(`share-${protocolId}`)
    await fetch(`/api/clients/${clientId}/nutrition-protocols/${protocolId}/share`, { method: 'POST' })
    setActionLoading(null)
    onRefresh()
  }

  async function handleUnshare(protocolId: string) {
    setActionLoading(`unshare-${protocolId}`)
    await fetch(`/api/clients/${clientId}/nutrition-protocols/${protocolId}/unshare`, { method: 'POST' })
    setActionLoading(null)
    onRefresh()
  }

  async function handleDelete(protocolId: string) {
    if (!confirm('Supprimer ce protocole ?')) return
    setActionLoading(`delete-${protocolId}`)
    await fetch(`/api/clients/${clientId}/nutrition-protocols/${protocolId}`, { method: 'DELETE' })
    setActionLoading(null)
    onRefresh()
  }

  function renderDay(day: NutritionProtocolDay) {
    return (
      <div key={day.id} className="flex items-center gap-3 py-2 border-b-[0.3px] border-white/[0.04] last:border-0">
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-white truncate">{day.name}</p>
          <p className="text-[10px] text-white/40 mt-0.5">
            {day.calories != null ? `${day.calories} kcal` : '—'}
            {day.protein_g != null ? ` · P ${day.protein_g}g` : ''}
            {day.carbs_g != null ? ` · G ${day.carbs_g}g` : ''}
            {day.fat_g != null ? ` · L ${day.fat_g}g` : ''}
          </p>
        </div>
        {day.calories != null && day.protein_g != null && day.carbs_g != null && day.fat_g != null && (
          <MacroDonut protein={day.protein_g} carbs={day.carbs_g} fat={day.fat_g} />
        )}
      </div>
    )
  }

  function renderProtocolCard(protocol: NutritionProtocol, isActive: boolean) {
    const days = protocol.days ?? []
    return (
      <div
        key={protocol.id}
        className={`bg-white/[0.02] border-[0.3px] rounded-2xl p-4 ${
          isActive ? 'border-[#1f8a65]/30' : 'border-white/[0.06]'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {isActive ? (
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#1f8a65]">
                  <CheckCircle2 size={10} /> Actif
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white/30">
                  <Clock size={10} /> Brouillon
                </span>
              )}
            </div>
            <p className="text-[14px] font-semibold text-white truncate">{protocol.name}</p>
            <p className="text-[10px] text-white/30 mt-0.5">
              {new Date(protocol.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' · '}{days.length} jour{days.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => router.push(`/coach/clients/${clientId}/protocoles/nutrition/${protocol.id}/edit`)}
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] text-white/40 hover:bg-white/[0.08] hover:text-white transition-all"
            >
              <Edit2 size={12} />
            </button>
            {isActive ? (
              <button
                onClick={() => handleUnshare(protocol.id)}
                disabled={actionLoading === `unshare-${protocol.id}`}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/[0.04] text-[10px] font-semibold text-white/40 hover:bg-white/[0.08] hover:text-white transition-all disabled:opacity-40"
              >
                <EyeOff size={11} /> Retirer
              </button>
            ) : (
              <button
                onClick={() => handleShare(protocol.id)}
                disabled={actionLoading === `share-${protocol.id}`}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-[#1f8a65]/10 text-[10px] font-semibold text-[#1f8a65] hover:bg-[#1f8a65]/20 transition-all disabled:opacity-40"
              >
                <Share2 size={11} /> Partager
              </button>
            )}
            {!isActive && (
              <button
                onClick={() => handleDelete(protocol.id)}
                disabled={actionLoading === `delete-${protocol.id}`}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] text-white/30 hover:bg-red-500/10 hover:text-red-400 transition-all disabled:opacity-40"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Days preview */}
        {days.length > 0 && (
          <div className="mt-2">
            {days.slice(0, 3).map(renderDay)}
            {days.length > 3 && (
              <p className="text-[10px] text-white/30 mt-1.5">+{days.length - 3} jour{days.length - 3 !== 1 ? 's' : ''}</p>
            )}
          </div>
        )}
      </div>
    )
  }

  if (protocols.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
          <Plus size={20} className="text-white/20" />
        </div>
        <p className="text-[14px] font-semibold text-white/60 mb-1">Aucun protocole nutritionnel</p>
        <p className="text-[12px] text-white/30 mb-6">Créez le premier protocole pour ce client</p>
        <Link
          href={`/coach/clients/${clientId}/protocoles/nutrition/new`}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[#1f8a65] text-white text-[12px] font-bold uppercase tracking-[0.12em] hover:bg-[#217356] transition-colors"
        >
          <Plus size={14} /> Créer un protocole
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {shared && renderProtocolCard(shared, true)}
      {drafts.map(p => renderProtocolCard(p, false))}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite the nutrition page**

```tsx
// app/coach/clients/[clientId]/protocoles/nutrition/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useClientTopBar } from '@/components/clients/useClientTopBar'
import { Skeleton } from '@/components/ui/skeleton'
import NutritionProtocolDashboard from '@/components/nutrition/NutritionProtocolDashboard'
import type { NutritionProtocol } from '@/lib/nutrition/types'

export default function NutritionPage() {
  const params   = useParams()
  const clientId = params.clientId as string

  const [protocols, setProtocols] = useState<NutritionProtocol[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  useClientTopBar('Nutrition')

  const fetchProtocols = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/clients/${clientId}/nutrition-protocols`)
      if (!res.ok) { setError('Erreur serveur'); return }
      const data = await res.json()
      setProtocols(data.protocols ?? [])
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { fetchProtocols() }, [fetchProtocols])

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="px-6 pb-24">
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
            Protocoles nutritionnels
          </p>
          <Link
            href={`/coach/clients/${clientId}/protocoles/nutrition/new`}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#1f8a65] text-white text-[11px] font-bold uppercase tracking-[0.12em] hover:bg-[#217356] transition-colors active:scale-[0.97]"
          >
            <Plus size={13} /> Nouveau
          </Link>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-4 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="text-[13px] text-red-400/70">{error}</p>
        )}

        {!loading && !error && (
          <NutritionProtocolDashboard protocols={protocols} onRefresh={fetchProtocols} />
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Update CHANGELOG.md**

```
FEATURE: Nutrition protocol dashboard — active protocol + history with share/unshare/delete actions
```

- [ ] **Step 5: Commit**

```bash
git add app/coach/clients/[clientId]/protocoles/nutrition/page.tsx components/nutrition/NutritionProtocolDashboard.tsx CHANGELOG.md
git commit -m "feat(nutrition): add nutrition protocol dashboard page"
```

---

## Task 6: Coach — Unified Nutrition Tool Page

**Files:**
- Create: `components/nutrition/NutritionProtocolTool.tsx`
- Create: `components/nutrition/NutritionProtocolDayTabs.tsx`
- Create: `components/nutrition/NutritionMacrosSection.tsx`
- Create: `components/nutrition/NutritionCarbCyclingSection.tsx`
- Create: `components/nutrition/NutritionHydratationSection.tsx`
- Create: `components/nutrition/NutritionCycleSyncSection.tsx`
- Create: `app/coach/clients/[clientId]/protocoles/nutrition/new/page.tsx`
- Create: `app/coach/clients/[clientId]/protocoles/nutrition/[protocolId]/edit/page.tsx`

- [ ] **Step 1: Create NutritionProtocolDayTabs**

```tsx
// components/nutrition/NutritionProtocolDayTabs.tsx
'use client'

import { Plus, X, GripVertical } from 'lucide-react'
import type { DayDraft } from '@/lib/nutrition/types'

interface Props {
  days: DayDraft[]
  activeDayIndex: number
  onSelectDay: (index: number) => void
  onAddDay: () => void
  onRemoveDay: (index: number) => void
  onRenameDay: (index: number, name: string) => void
}

export default function NutritionProtocolDayTabs({
  days, activeDayIndex, onSelectDay, onAddDay, onRemoveDay, onRenameDay,
}: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {days.map((day, i) => (
        <div
          key={day.localId}
          className={`group relative flex items-center gap-1.5 h-8 px-3 rounded-xl border-[0.3px] shrink-0 transition-all cursor-pointer ${
            i === activeDayIndex
              ? 'bg-[#1f8a65]/10 border-[#1f8a65]/30 text-[#1f8a65]'
              : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.05] hover:text-white/80'
          }`}
          onClick={() => onSelectDay(i)}
        >
          {i === activeDayIndex ? (
            <input
              value={day.name}
              onChange={e => onRenameDay(i, e.target.value)}
              onClick={e => e.stopPropagation()}
              className="bg-transparent text-[12px] font-semibold outline-none w-[120px] truncate text-[#1f8a65]"
            />
          ) : (
            <span className="text-[12px] font-semibold truncate max-w-[120px]">{day.name}</span>
          )}
          {days.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); onRemoveDay(i) }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-red-400"
            >
              <X size={11} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onAddDay}
        className="flex items-center gap-1 h-8 px-3 rounded-xl bg-white/[0.03] border-[0.3px] border-white/[0.06] text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all shrink-0 text-[12px] font-semibold"
      >
        <Plus size={12} /> Ajouter un jour
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create NutritionMacrosSection**

This section reuses the calculation logic from `lib/formulas/macros.ts` but in a simplified form focused on the current day's values.

```tsx
// components/nutrition/NutritionMacrosSection.tsx
'use client'

import { useMemo } from 'react'
import { calculateMacros, type MacroGoal, type MacroGender } from '@/lib/formulas/macros'
import type { DayDraft, NutritionClientData } from '@/lib/nutrition/types'

const GOAL_OPTIONS: { value: MacroGoal; label: string }[] = [
  { value: 'deficit',     label: 'Déficit — Perte de gras' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'surplus',     label: 'Surplus — Prise de muscle' },
]

const CLIENT_GOAL_MAP: Record<string, MacroGoal> = {
  fat_loss: 'deficit', weight_loss: 'deficit',
  muscle_gain: 'surplus', hypertrophy: 'surplus',
  maintenance: 'maintenance', recomposition: 'maintenance',
}

interface Props {
  day: DayDraft
  clientData: NutritionClientData | null
  goal: MacroGoal
  onGoalChange: (g: MacroGoal) => void
  onDayChange: (updates: Partial<DayDraft>) => void
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-1">{children}</label>
}

function NumInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full h-8 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-3 text-[12px] font-semibold text-white placeholder:text-white/20 outline-none focus:border-white/[0.12] transition-colors"
    />
  )
}

export default function NutritionMacrosSection({ day, clientData, goal, onGoalChange, onDayChange }: Props) {
  // Auto-calculate when client data is present and day fields are empty
  const autoCalc = useMemo(() => {
    if (!clientData?.weight_kg || !clientData?.age || !clientData?.height_cm) return null
    try {
      return calculateMacros({
        gender: (clientData.gender === 'female' ? 'female' : 'male') as MacroGender,
        age: clientData.age,
        weight: clientData.weight_kg,
        height: clientData.height_cm,
        bodyFat: clientData.body_fat_pct ?? undefined,
        muscleMass: clientData.muscle_mass_kg ?? undefined,
        activityLevel: 'moderate',
        workoutsPerWeek: clientData.weekly_frequency ?? 3,
        goal,
        bmrMeasured: clientData.bmr_kcal_measured ?? undefined,
        dailySteps: clientData.daily_steps ?? undefined,
        stressLevel: clientData.stress_level ?? undefined,
        sleepHours: clientData.sleep_duration_h ?? undefined,
        caffeineDaily: clientData.caffeine_daily_mg ?? undefined,
        alcoholWeekly: clientData.alcohol_weekly ?? undefined,
        workHoursPerWeek: clientData.work_hours_per_week ?? undefined,
        sessionDurationMin: clientData.session_duration_min ?? undefined,
      })
    } catch {
      return null
    }
  }, [clientData, goal])

  function applyAutoCalc() {
    if (!autoCalc) return
    onDayChange({
      calories: String(Math.round(autoCalc.totalCalories)),
      protein_g: String(Math.round(autoCalc.protein)),
      carbs_g: String(Math.round(autoCalc.carbs)),
      fat_g: String(Math.round(autoCalc.fat)),
    })
  }

  const calories = Number(day.calories) || 0
  const protein  = Number(day.protein_g) || 0
  const carbs    = Number(day.carbs_g) || 0
  const fat      = Number(day.fat_g) || 0
  const total    = protein * 4 + carbs * 4 + fat * 9

  return (
    <div className="space-y-4">
      {/* Objectif */}
      <div>
        <FieldLabel>Objectif nutritionnel</FieldLabel>
        <select
          value={goal}
          onChange={e => onGoalChange(e.target.value as MacroGoal)}
          className="w-full h-8 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-3 text-[12px] font-semibold text-white outline-none appearance-none"
        >
          {GOAL_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-[#181818]">{o.label}</option>)}
        </select>
      </div>

      {/* Auto-calc banner */}
      {autoCalc && (
        <div className="flex items-center justify-between bg-[#1f8a65]/[0.06] border-[0.3px] border-[#1f8a65]/20 rounded-xl px-3 py-2.5">
          <div>
            <p className="text-[11px] font-semibold text-[#1f8a65]">Calcul automatique disponible</p>
            <p className="text-[10px] text-white/40 mt-0.5">
              {Math.round(autoCalc.totalCalories)} kcal · P {Math.round(autoCalc.protein)}g · G {Math.round(autoCalc.carbs)}g · L {Math.round(autoCalc.fat)}g
            </p>
          </div>
          <button
            onClick={applyAutoCalc}
            className="h-7 px-3 rounded-lg bg-[#1f8a65]/20 text-[#1f8a65] text-[11px] font-bold hover:bg-[#1f8a65]/30 transition-colors"
          >
            Appliquer
          </button>
        </div>
      )}

      {/* Manual inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Calories (kcal)</FieldLabel>
          <NumInput value={day.calories} onChange={v => onDayChange({ calories: v })} placeholder="ex: 2200" />
        </div>
        <div>
          <FieldLabel>Protéines (g)</FieldLabel>
          <NumInput value={day.protein_g} onChange={v => onDayChange({ protein_g: v })} placeholder="ex: 180" />
        </div>
        <div>
          <FieldLabel>Glucides (g)</FieldLabel>
          <NumInput value={day.carbs_g} onChange={v => onDayChange({ carbs_g: v })} placeholder="ex: 250" />
        </div>
        <div>
          <FieldLabel>Lipides (g)</FieldLabel>
          <NumInput value={day.fat_g} onChange={v => onDayChange({ fat_g: v })} placeholder="ex: 70" />
        </div>
      </div>

      {/* Macro distribution preview */}
      {total > 0 && (
        <div className="flex items-center gap-4 bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-3">
          <div className="grid grid-cols-3 flex-1 gap-2 text-center">
            <div>
              <p className="text-[10px] text-white/40 mb-0.5">Protéines</p>
              <p className="text-[13px] font-bold text-[#1f8a65]">{total > 0 ? Math.round((protein * 4 / total) * 100) : 0}%</p>
              <p className="text-[9px] text-white/30">{protein}g</p>
            </div>
            <div>
              <p className="text-[10px] text-white/40 mb-0.5">Glucides</p>
              <p className="text-[13px] font-bold text-blue-400">{total > 0 ? Math.round((carbs * 4 / total) * 100) : 0}%</p>
              <p className="text-[9px] text-white/30">{carbs}g</p>
            </div>
            <div>
              <p className="text-[10px] text-white/40 mb-0.5">Lipides</p>
              <p className="text-[13px] font-bold text-amber-400">{total > 0 ? Math.round((fat * 9 / total) * 100) : 0}%</p>
              <p className="text-[9px] text-white/30">{fat}g</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create NutritionCarbCyclingSection**

```tsx
// components/nutrition/NutritionCarbCyclingSection.tsx
'use client'

import type { DayDraft } from '@/lib/nutrition/types'

const TYPES = [
  { value: 'high',   label: 'Haute',   desc: 'Jour d\'entraînement intense',        color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
  { value: 'medium', label: 'Moyenne', desc: 'Jour d\'entraînement modéré',         color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  { value: 'low',    label: 'Basse',   desc: 'Jour de repos ou cardio léger',       color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
] as const

interface Props {
  day: DayDraft
  onDayChange: (updates: Partial<DayDraft>) => void
}

export default function NutritionCarbCyclingSection({ day, onDayChange }: Props) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-3">Type de charge glucidique</p>
      <div className="grid grid-cols-3 gap-2">
        {TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => onDayChange({ carb_cycle_type: day.carb_cycle_type === t.value ? '' : t.value as DayDraft['carb_cycle_type'] })}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border-[0.3px] text-center transition-all ${
              day.carb_cycle_type === t.value
                ? `${t.bg} ${t.border} ${t.color}`
                : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:bg-white/[0.04]'
            }`}
          >
            <span className="text-[12px] font-bold">{t.label}</span>
            <span className="text-[9px] leading-snug opacity-70">{t.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create NutritionHydratationSection**

```tsx
// components/nutrition/NutritionHydratationSection.tsx
'use client'

import type { DayDraft, NutritionClientData } from '@/lib/nutrition/types'

interface Props {
  day: DayDraft
  clientData: NutritionClientData | null
  onDayChange: (updates: Partial<DayDraft>) => void
}

export default function NutritionHydratationSection({ day, clientData, onDayChange }: Props) {
  // Simple auto-calc: 35ml/kg bodyweight, +500ml if training day
  const autoMl = clientData?.weight_kg
    ? Math.round(clientData.weight_kg * 35)
    : null

  return (
    <div className="space-y-3">
      {autoMl && !day.hydration_ml && (
        <div className="flex items-center justify-between bg-blue-500/[0.06] border-[0.3px] border-blue-500/20 rounded-xl px-3 py-2.5">
          <div>
            <p className="text-[11px] font-semibold text-blue-400">Suggestion hydratation</p>
            <p className="text-[10px] text-white/40 mt-0.5">{autoMl} ml · basé sur {clientData?.weight_kg} kg × 35 ml/kg</p>
          </div>
          <button
            onClick={() => onDayChange({ hydration_ml: String(autoMl) })}
            className="h-7 px-3 rounded-lg bg-blue-500/20 text-blue-400 text-[11px] font-bold hover:bg-blue-500/30 transition-colors"
          >
            Appliquer
          </button>
        </div>
      )}
      <div>
        <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-1">Hydratation (ml/jour)</label>
        <input
          type="number"
          value={day.hydration_ml}
          onChange={e => onDayChange({ hydration_ml: e.target.value })}
          placeholder="ex: 2500"
          className="w-full h-8 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-3 text-[12px] font-semibold text-white placeholder:text-white/20 outline-none focus:border-white/[0.12] transition-colors"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create NutritionCycleSyncSection**

```tsx
// components/nutrition/NutritionCycleSyncSection.tsx
'use client'

import type { DayDraft } from '@/lib/nutrition/types'

const PHASES = [
  {
    value: 'follicular',
    label: 'Folliculaire',
    days: 'J1–J13',
    desc: 'Énergie en hausse, métabolisme bas. Favoriser glucides complexes et protéines maigres.',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
  },
  {
    value: 'ovulatory',
    label: 'Ovulatoire',
    days: 'J14–J16',
    desc: 'Pic de testostérone et œstrogènes. Priorité aux entraînements intenses et protéines.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  {
    value: 'luteal',
    label: 'Lutéale',
    days: 'J17–J28',
    desc: 'Métabolisme +100–300 kcal. Augmenter légèrement lipides et glucides. Réduire sodium.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    value: 'menstrual',
    label: 'Menstruelle',
    days: 'J1–J5',
    desc: 'Réduire inflammation. Anti-oxydants, oméga-3, magnésium, éviter alcool et caféine.',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
] as const

interface Props {
  day: DayDraft
  onDayChange: (updates: Partial<DayDraft>) => void
}

export default function NutritionCycleSyncSection({ day, onDayChange }: Props) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-3">Phase du cycle menstruel</p>
      <div className="grid grid-cols-2 gap-2">
        {PHASES.map(p => (
          <button
            key={p.value}
            onClick={() => onDayChange({ cycle_sync_phase: day.cycle_sync_phase === p.value ? '' : p.value as DayDraft['cycle_sync_phase'] })}
            className={`flex flex-col items-start gap-1 p-3 rounded-xl border-[0.3px] text-left transition-all ${
              day.cycle_sync_phase === p.value
                ? `${p.bg} ${p.border} ${p.color}`
                : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[12px] font-bold">{p.label}</span>
              <span className="text-[9px] opacity-60">{p.days}</span>
            </div>
            <span className="text-[9px] leading-snug opacity-70">{p.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create the main NutritionProtocolTool**

```tsx
// components/nutrition/NutritionProtocolTool.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Share2, ChevronDown, ChevronUp } from 'lucide-react'
import { useClientTopBar } from '@/components/clients/useClientTopBar'
import NutritionProtocolDayTabs from './NutritionProtocolDayTabs'
import NutritionMacrosSection from './NutritionMacrosSection'
import NutritionCarbCyclingSection from './NutritionCarbCyclingSection'
import NutritionHydratationSection from './NutritionHydratationSection'
import NutritionCycleSyncSection from './NutritionCycleSyncSection'
import { Skeleton } from '@/components/ui/skeleton'
import {
  type DayDraft, type NutritionProtocol, type NutritionClientData,
  emptyDayDraft, dayDraftFromDb,
} from '@/lib/nutrition/types'
import type { MacroGoal } from '@/lib/formulas/macros'

interface Props {
  clientId: string
  existingProtocol?: NutritionProtocol
}

function SectionBlock({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{title}</p>
        {open ? <ChevronUp size={13} className="text-white/30" /> : <ChevronDown size={13} className="text-white/30" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

export default function NutritionProtocolTool({ clientId, existingProtocol }: Props) {
  const router = useRouter()

  const [clientData, setClientData]   = useState<NutritionClientData | null>(null)
  const [loadingClient, setLoadingClient] = useState(true)

  const [protocolName, setProtocolName] = useState(existingProtocol?.name ?? 'Nouveau protocole')
  const [days, setDays]                 = useState<DayDraft[]>(
    existingProtocol?.days?.length
      ? existingProtocol.days.map(dayDraftFromDb)
      : [emptyDayDraft('Jour entraînement'), emptyDayDraft('Jour repos')]
  )
  const [activeDayIndex, setActiveDayIndex] = useState(0)
  const [goal, setGoal]                 = useState<MacroGoal>('maintenance')

  const [saving,  setSaving]  = useState(false)
  const [sharing, setSharing] = useState(false)
  const [error,   setError]   = useState('')

  const isEditing = !!existingProtocol

  useClientTopBar(isEditing ? 'Modifier le protocole' : 'Nouveau protocole')

  // Fetch client biometric data for pre-fill
  useEffect(() => {
    fetch(`/api/clients/${clientId}/nutrition-data`)
      .then(r => r.json())
      .then(d => {
        if (d.client) {
          setClientData(d.client)
          // Auto-detect goal from client training_goal
          const goalMap: Record<string, MacroGoal> = {
            fat_loss: 'deficit', weight_loss: 'deficit',
            muscle_gain: 'surplus', hypertrophy: 'surplus',
            maintenance: 'maintenance', recomposition: 'maintenance',
          }
          if (d.client.training_goal) {
            const mapped = goalMap[d.client.training_goal.toLowerCase()]
            if (mapped) setGoal(mapped)
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingClient(false))
  }, [clientId])

  const activeDay = days[activeDayIndex] ?? days[0]
  const isFemale  = clientData?.gender === 'female'

  function updateDay(index: number, updates: Partial<DayDraft>) {
    setDays(prev => prev.map((d, i) => i === index ? { ...d, ...updates } : d))
  }

  function addDay() {
    const newDay = emptyDayDraft(`Jour ${days.length + 1}`)
    setDays(prev => [...prev, newDay])
    setActiveDayIndex(days.length)
  }

  function removeDay(index: number) {
    setDays(prev => prev.filter((_, i) => i !== index))
    setActiveDayIndex(prev => Math.min(prev, days.length - 2))
  }

  function renameDay(index: number, name: string) {
    setDays(prev => prev.map((d, i) => i === index ? { ...d, name } : d))
  }

  function daysPayload() {
    return days.map((d, i) => ({
      id: d.dbId,
      name: d.name,
      position: i,
      calories:         d.calories         ? Number(d.calories)         : null,
      protein_g:        d.protein_g        ? Number(d.protein_g)        : null,
      carbs_g:          d.carbs_g          ? Number(d.carbs_g)          : null,
      fat_g:            d.fat_g            ? Number(d.fat_g)            : null,
      hydration_ml:     d.hydration_ml     ? Number(d.hydration_ml)     : null,
      carb_cycle_type:  d.carb_cycle_type  || null,
      cycle_sync_phase: d.cycle_sync_phase || null,
      recommendations:  d.recommendations  || null,
    }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const payload = { name: protocolName, days: daysPayload() }
      let res: Response

      if (isEditing && existingProtocol) {
        res = await fetch(`/api/clients/${clientId}/nutrition-protocols/${existingProtocol.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/clients/${clientId}/nutrition-protocols`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const err = await res.json()
        setError(err.error ?? 'Erreur lors de la sauvegarde')
        return
      }

      router.push(`/coach/clients/${clientId}/protocoles/nutrition`)
    } catch {
      setError('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAndShare() {
    setSaving(true)
    setSharing(true)
    setError('')
    try {
      const payload = { name: protocolName, days: daysPayload() }
      let protocolId = existingProtocol?.id

      if (isEditing && protocolId) {
        const res = await fetch(`/api/clients/${clientId}/nutrition-protocols/${protocolId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) { setError('Erreur lors de la sauvegarde'); return }
      } else {
        const res = await fetch(`/api/clients/${clientId}/nutrition-protocols`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) { setError('Erreur lors de la sauvegarde'); return }
        const data = await res.json()
        protocolId = data.protocol.id
      }

      if (protocolId) {
        await fetch(`/api/clients/${clientId}/nutrition-protocols/${protocolId}/share`, { method: 'POST' })
      }

      router.push(`/coach/clients/${clientId}/protocoles/nutrition`)
    } catch {
      setError('Erreur réseau')
    } finally {
      setSaving(false)
      setSharing(false)
    }
  }

  if (loadingClient) {
    return (
      <main className="min-h-screen bg-[#121212]">
        <div className="px-6 pb-24 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="px-6 pb-24 space-y-4">

        {/* Protocol name input */}
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-1">
            Nom du protocole
          </label>
          <input
            value={protocolName}
            onChange={e => setProtocolName(e.target.value)}
            placeholder="ex: Protocole Avril 2026"
            className="w-full h-10 rounded-xl bg-white/[0.04] border-[0.3px] border-white/[0.06] px-4 text-[14px] font-semibold text-white placeholder:text-white/20 outline-none focus:border-white/[0.12] transition-colors"
          />
        </div>

        {/* Client data banner */}
        {clientData && (
          <div className="flex items-center gap-2 bg-[#1f8a65]/[0.06] border-[0.3px] border-[#1f8a65]/20 rounded-xl px-3 py-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#1f8a65] shrink-0" />
            <p className="text-[11px] text-[#1f8a65]/80">
              Données de {clientData.name} injectées
              {clientData.weight_kg ? ` · ${clientData.weight_kg} kg` : ''}
              {clientData.body_fat_pct ? ` · ${clientData.body_fat_pct}% MG` : ''}
            </p>
          </div>
        )}

        {/* Day tabs */}
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-2">Jours</p>
          <NutritionProtocolDayTabs
            days={days}
            activeDayIndex={activeDayIndex}
            onSelectDay={setActiveDayIndex}
            onAddDay={addDay}
            onRemoveDay={removeDay}
            onRenameDay={renameDay}
          />
        </div>

        {/* Sections for active day */}
        {activeDay && (
          <>
            <SectionBlock title="Calories & Macros">
              <NutritionMacrosSection
                day={activeDay}
                clientData={clientData}
                goal={goal}
                onGoalChange={setGoal}
                onDayChange={updates => updateDay(activeDayIndex, updates)}
              />
            </SectionBlock>

            <SectionBlock title="Carb Cycling" defaultOpen={false}>
              <NutritionCarbCyclingSection
                day={activeDay}
                onDayChange={updates => updateDay(activeDayIndex, updates)}
              />
            </SectionBlock>

            <SectionBlock title="Hydratation" defaultOpen={false}>
              <NutritionHydratationSection
                day={activeDay}
                clientData={clientData}
                onDayChange={updates => updateDay(activeDayIndex, updates)}
              />
            </SectionBlock>

            {isFemale && (
              <SectionBlock title="Cycle Sync" defaultOpen={false}>
                <NutritionCycleSyncSection
                  day={activeDay}
                  onDayChange={updates => updateDay(activeDayIndex, updates)}
                />
              </SectionBlock>
            )}

            <SectionBlock title="Recommandations & Notes" defaultOpen={false}>
              <textarea
                value={activeDay.recommendations}
                onChange={e => updateDay(activeDayIndex, { recommendations: e.target.value })}
                placeholder="Notes visibles par le client..."
                rows={4}
                className="w-full rounded-xl bg-white/[0.04] border-[0.3px] border-white/[0.06] px-4 py-3 text-[13px] text-white placeholder:text-white/20 outline-none focus:border-white/[0.12] transition-colors resize-none"
              />
            </SectionBlock>
          </>
        )}

        {error && <p className="text-[12px] text-red-400/70">{error}</p>}

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 h-10 px-5 rounded-xl bg-white/[0.06] text-white text-[12px] font-bold uppercase tracking-[0.12em] hover:bg-white/[0.09] transition-colors disabled:opacity-40 active:scale-[0.98]"
          >
            <Save size={14} />
            {saving && !sharing ? 'Sauvegarde...' : 'Sauvegarder brouillon'}
          </button>
          <button
            onClick={handleSaveAndShare}
            disabled={saving}
            className="flex items-center gap-2 h-10 px-5 rounded-xl bg-[#1f8a65] text-white text-[12px] font-bold uppercase tracking-[0.12em] hover:bg-[#217356] transition-colors disabled:opacity-40 active:scale-[0.98]"
          >
            <Share2 size={14} />
            {sharing ? 'Partage...' : 'Sauvegarder & Partager'}
          </button>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 7: Create the new protocol page**

```tsx
// app/coach/clients/[clientId]/protocoles/nutrition/new/page.tsx
'use client'

import { useParams } from 'next/navigation'
import NutritionProtocolTool from '@/components/nutrition/NutritionProtocolTool'

export default function NewNutritionProtocolPage() {
  const params   = useParams()
  const clientId = params.clientId as string
  return <NutritionProtocolTool clientId={clientId} />
}
```

- [ ] **Step 8: Create the edit protocol page**

```tsx
// app/coach/clients/[clientId]/protocoles/nutrition/[protocolId]/edit/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import NutritionProtocolTool from '@/components/nutrition/NutritionProtocolTool'
import type { NutritionProtocol } from '@/lib/nutrition/types'

export default function EditNutritionProtocolPage() {
  const params     = useParams()
  const clientId   = params.clientId as string
  const protocolId = params.protocolId as string

  const [protocol, setProtocol] = useState<NutritionProtocol | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    fetch(`/api/clients/${clientId}/nutrition-protocols/${protocolId}`)
      .then(r => r.json())
      .then(d => {
        if (d.protocol) setProtocol(d.protocol)
        else setError('Protocole introuvable')
      })
      .catch(() => setError('Erreur réseau'))
      .finally(() => setLoading(false))
  }, [clientId, protocolId])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#121212]">
        <div className="px-6 pb-24 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </main>
    )
  }

  if (error || !protocol) {
    return (
      <main className="min-h-screen bg-[#121212]">
        <div className="px-6 pt-10 text-center">
          <p className="text-[14px] text-white/50">{error || 'Protocole introuvable'}</p>
        </div>
      </main>
    )
  }

  return <NutritionProtocolTool clientId={clientId} existingProtocol={protocol} />
}
```

- [ ] **Step 9: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 10: Update CHANGELOG.md**

```
FEATURE: Add unified nutrition protocol tool — Macros, Carb Cycling, Hydratation, Cycle Sync (female-only) with client pre-fill, multi-day support, save/share
```

- [ ] **Step 11: Commit**

```bash
git add components/nutrition/ app/coach/clients/[clientId]/protocoles/nutrition/new/ app/coach/clients/[clientId]/protocoles/nutrition/[protocolId]/ CHANGELOG.md
git commit -m "feat(nutrition): add unified nutrition protocol tool with multi-day support and auto client pre-fill"
```

---

## Task 7: Remove Standalone Macro Route

**Files:**
- Modify: `app/outils/macros/page.tsx`

- [ ] **Step 1: Replace standalone page with redirect**

```tsx
// app/outils/macros/page.tsx
import { redirect } from 'next/navigation'

export default function MacrosPage() {
  redirect('/coach/clients')
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Update CHANGELOG.md**

```
REFACTOR: Redirect /outils/macros to /coach/clients — macro tool now only accessible via client context
```

- [ ] **Step 4: Commit**

```bash
git add app/outils/macros/page.tsx CHANGELOG.md
git commit -m "refactor(nutrition): redirect standalone /outils/macros to /coach/clients"
```

---

## Task 8: Client-Facing Nutrition Page

**Files:**
- Create: `app/client/nutrition/page.tsx`
- Modify: `components/client/BottomNav.tsx`

- [ ] **Step 1: Create client nutrition page**

```tsx
// app/client/nutrition/page.tsx
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { Utensils } from 'lucide-react'
import type { NutritionProtocol, NutritionProtocolDay } from '@/lib/nutrition/types'

function MacroDonut({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const total = protein * 4 + carbs * 4 + fat * 9
  if (total === 0) return null

  const proteinPct = (protein * 4) / total
  const carbsPct   = (carbs * 4) / total
  const fatPct     = (fat * 9) / total
  const r = 52, cx = 64, cy = 64
  const circ = 2 * Math.PI * r

  const proteinDash = `${proteinPct * circ} ${circ - proteinPct * circ}`
  const carbsDash   = `${carbsPct * circ} ${circ - carbsPct * circ}`
  const fatDash     = `${fatPct * circ} ${circ - fatPct * circ}`

  return (
    <svg width={128} height={128} viewBox="0 0 128 128">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={14} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1f8a65" strokeWidth={14}
        strokeDasharray={proteinDash} strokeDashoffset={0}
        transform={`rotate(-90 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3b82f6" strokeWidth={14}
        strokeDasharray={carbsDash} strokeDashoffset={-(proteinPct * circ)}
        transform={`rotate(-90 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f59e0b" strokeWidth={14}
        strokeDasharray={fatDash} strokeDashoffset={-((proteinPct + carbsPct) * circ)}
        transform={`rotate(-90 ${cx} ${cy})`} />
    </svg>
  )
}

const CYCLE_PHASE_LABELS: Record<string, string> = {
  follicular: 'Phase folliculaire',
  ovulatory: 'Phase ovulatoire',
  luteal: 'Phase lutéale',
  menstrual: 'Phase menstruelle',
}

const CARB_CYCLE_LABELS: Record<string, string> = {
  high: 'Charge glucidique haute',
  medium: 'Charge glucidique moyenne',
  low: 'Charge glucidique basse',
}

export default async function ClientNutritionPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const clientRecord = await resolveClientFromUser(user.id, service)
  if (!clientRecord) {
    return (
      <main className="min-h-screen bg-[#121212] flex items-center justify-center">
        <p className="text-[13px] text-white/30">Profil non trouvé</p>
      </main>
    )
  }

  // Fetch active shared protocol
  const { data: protocols } = await service
    .from('nutrition_protocols')
    .select(`*, days:nutrition_protocol_days(*)`)
    .eq('client_id', clientRecord.id)
    .eq('status', 'shared')
    .order('updated_at', { ascending: false })
    .limit(1)

  const protocol: NutritionProtocol | null = protocols?.[0] ?? null
  const days: NutritionProtocolDay[] = protocol?.days
    ? [...protocol.days].sort((a, b) => a.position - b.position)
    : []

  if (!protocol) {
    return (
      <main className="min-h-screen bg-[#121212]">
        <div className="px-5 pt-6 pb-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center">
              <Utensils size={15} className="text-white/30" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-semibold text-white">Nutrition</p>
          </div>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
              <Utensils size={22} className="text-white/15" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-semibold text-white/50 mb-1">Aucun protocole actif</p>
            <p className="text-[12px] text-white/25 leading-relaxed max-w-[220px]">
              Votre coach prépare votre protocole nutritionnel
            </p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#121212]">
      <div className="px-5 pt-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-xl bg-[#1f8a65]/10 flex items-center justify-center">
            <Utensils size={15} className="text-[#1f8a65]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[11px] text-white/30 uppercase tracking-[0.14em] font-semibold leading-none mb-0.5">Nutrition</p>
            <p className="text-[14px] font-semibold text-white leading-none">{protocol.name}</p>
          </div>
        </div>

        {/* Day pills */}
        {days.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none mb-5">
            {days.map((day, i) => (
              <a
                key={day.id}
                href={`#day-${day.id}`}
                className="flex items-center h-8 px-3 rounded-xl bg-white/[0.04] border-[0.3px] border-white/[0.06] text-[12px] font-semibold text-white/60 shrink-0 hover:text-white/90 hover:bg-white/[0.07] transition-all"
              >
                {day.name}
              </a>
            ))}
          </div>
        )}

        {/* Day cards */}
        <div className="space-y-4">
          {days.map((day) => (
            <div
              key={day.id}
              id={`day-${day.id}`}
              className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl p-4"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/40 mb-4">{day.name}</p>

              {/* Calories */}
              {day.calories != null && (
                <div className="text-center mb-4">
                  <p className="text-[36px] font-black text-white leading-none">{day.calories}</p>
                  <p className="text-[11px] text-white/30 mt-1">kcal / jour</p>
                </div>
              )}

              {/* Donut + macros */}
              {day.protein_g != null && day.carbs_g != null && day.fat_g != null && (
                <div className="flex items-center gap-4 mb-4">
                  <MacroDonut protein={day.protein_g} carbs={day.carbs_g} fat={day.fat_g} />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#1f8a65]" />
                        <span className="text-[12px] text-white/60">Protéines</span>
                      </div>
                      <span className="text-[13px] font-bold text-white">{day.protein_g}g</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        <span className="text-[12px] text-white/60">Glucides</span>
                      </div>
                      <span className="text-[13px] font-bold text-white">{day.carbs_g}g</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-[12px] text-white/60">Lipides</span>
                      </div>
                      <span className="text-[13px] font-bold text-white">{day.fat_g}g</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Hydratation */}
              {day.hydration_ml != null && (
                <div className="flex items-center justify-between py-2 border-t-[0.3px] border-white/[0.04]">
                  <span className="text-[12px] text-white/40">Hydratation</span>
                  <span className="text-[13px] font-bold text-white">{day.hydration_ml} ml</span>
                </div>
              )}

              {/* Carb cycling */}
              {day.carb_cycle_type && (
                <div className="flex items-center justify-between py-2 border-t-[0.3px] border-white/[0.04]">
                  <span className="text-[12px] text-white/40">Charge glucidique</span>
                  <span className="text-[12px] font-semibold text-blue-400">{CARB_CYCLE_LABELS[day.carb_cycle_type]}</span>
                </div>
              )}

              {/* Cycle sync */}
              {day.cycle_sync_phase && (
                <div className="flex items-center justify-between py-2 border-t-[0.3px] border-white/[0.04]">
                  <span className="text-[12px] text-white/40">Phase cycle</span>
                  <span className="text-[12px] font-semibold text-pink-400">{CYCLE_PHASE_LABELS[day.cycle_sync_phase]}</span>
                </div>
              )}

              {/* Recommendations */}
              {day.recommendations && (
                <div className="mt-3 pt-3 border-t-[0.3px] border-white/[0.04]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/30 mb-1.5">Recommandations</p>
                  <p className="text-[12px] text-white/60 leading-relaxed">{day.recommendations}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Add nutrition tab to BottomNav**

Read [components/client/BottomNav.tsx](components/client/BottomNav.tsx) first, then add the nutrition entry.

In [components/client/BottomNav.tsx](components/client/BottomNav.tsx), add `Utensils` to the import and add the nutrition nav entry:

```tsx
import { Home, ClipboardList, User, Dumbbell, TrendingUp, Utensils } from 'lucide-react'
```

Add to the `NAV` array (between `programme` and `progress`):
```tsx
{ href: '/client/nutrition', labelKey: 'nav.nutrition', icon: Utensils },
```

- [ ] **Step 3: Add the translation key**

In `lib/i18n/clientTranslations.ts`, find the `nav` section and add:
```typescript
'nav.nutrition': { fr: 'Nutrition', en: 'Nutrition', es: 'Nutrición' },
```

Also add `'nav.nutrition'` to the `ClientDictKey` type.

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 5: Update CHANGELOG.md**

```
FEATURE: Add /client/nutrition page — client-facing active protocol view with macro donut, day pills, recommendations
FEATURE: Add Nutrition tab to client BottomNav
```

- [ ] **Step 6: Commit**

```bash
git add app/client/nutrition/ components/client/BottomNav.tsx lib/i18n/clientTranslations.ts CHANGELOG.md
git commit -m "feat(nutrition): add client-facing nutrition page with macro donut and day navigation"
```

---

## Task 9: Update project-state.md

**Files:**
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Add new section at the top of project-state.md**

Add after the file header:

```markdown
## 2026-04-25 — Nutrition Protocol System (Phase 1)

**Ce qui a été fait :**

1. **`supabase/migrations/20260425_nutrition_protocols.sql`** — nouvelles tables
   - `nutrition_protocols` : versioned protocols per client (draft/shared), un seul shared actif à la fois
   - `nutrition_protocol_days` : jours multi-nommés librement (calories, macros, hydratation, carb cycling type, cycle sync phase)
   - RLS : coach full access via coach_clients.coach_id, client SELECT only sur status='shared'

2. **`lib/nutrition/types.ts`** — types partagés
   - `NutritionProtocol`, `NutritionProtocolDay`, `DayDraft`, `NutritionClientData`
   - `emptyDayDraft()` et `dayDraftFromDb()` helpers

3. **`app/api/clients/[clientId]/nutrition-data/route.ts`** — GET données biométriques client
   - Même agrégation que lab/client-search mais pour un clientId direct (pas de recherche)
   - Retourne `NutritionClientData` avec biométrie, training, cardio, lifestyle, wellness

4. **API CRUD nutrition-protocols :**
   - GET/POST `/api/clients/[clientId]/nutrition-protocols`
   - GET/PATCH/DELETE `/api/clients/[clientId]/nutrition-protocols/[protocolId]`
   - POST share → archive le précédent shared + crée annotation `metric_annotation` event_type='nutrition'
   - POST unshare → repasse en draft

5. **Pages coach :**
   - `/coach/clients/[clientId]/protocoles/nutrition` → Dashboard : protocole actif + historique brouillons
   - `/coach/clients/[clientId]/protocoles/nutrition/new` → Outil unifié
   - `/coach/clients/[clientId]/protocoles/nutrition/[protocolId]/edit` → Édition

6. **`components/nutrition/NutritionProtocolTool.tsx`** — outil unifié
   - Pré-remplissage auto des données biométriques client au chargement
   - Multi-jours avec noms libres (tabs renommables, add/remove)
   - Sections : Macros (calcul auto + saisie manuelle), Carb Cycling, Hydratation, Cycle Sync (femmes uniquement)
   - Save brouillon ou Save & Partager en une action

7. **`app/client/nutrition/page.tsx`** — vue client (Server Component)
   - Protocole actif uniquement (résultat final)
   - Donut SVG macros, day pills navigation, hydratation, phase cycle, recommandations

8. **Route `/outils/macros`** → redirigée vers `/coach/clients` (tool uniquement via contexte client)

9. **`components/client/BottomNav.tsx`** → onglet Nutrition ajouté

**Points de vigilance :**
- Cycle Sync s'affiche uniquement si `clientData.gender === 'female'` — côté coach ET client
- Share archive automatiquement le précédent protocol shared (un seul actif à la fois par client)
- La migration doit être appliquée manuellement via Supabase Dashboard SQL Editor
- L'annotation créée au partage utilise `event_type = 'nutrition'` — déjà supporté par MetricsSection
- Le calcul auto dans NutritionMacrosSection utilise `calculateMacros` de `lib/formulas/macros.ts` — si le client n'a pas de données biométriques complètes (poids, âge, taille), le bouton auto-calc n'apparaît pas

**Phase 2 — Sync calendrier (documentée, non implémentée) :**
- Sync calendrier nutrition ↔ programme d'entraînement (jour entraînement/repos auto-détecté)
- Vue calendrier coach pour assigner protocoles à des dates spécifiques
- Cycle Sync automatique aligné sur phases menstruelles détectées
- Vue jour-par-jour côté client avec bar calendrier (comme page programme)
```

- [ ] **Step 2: Commit**

```bash
git add .claude/rules/project-state.md
git commit -m "docs: update project-state.md with nutrition protocol system Phase 1"
```

---

## Self-Review Checklist

### Spec coverage
- [x] Route uniquement via contexte client → Task 7 (redirect `/outils/macros`)
- [x] Dashboard coach avec protocole actif + historique → Task 5
- [x] Pré-remplissage auto données biométriques → Task 3 + Task 6 (NutritionProtocolTool useEffect)
- [x] Multi-jours noms libres → Task 6 (NutritionProtocolDayTabs)
- [x] Macros + Carb Cycling + Hydratation + Cycle Sync sur même page → Task 6
- [x] Cycle Sync conditionnel genre féminin → Task 6 (`isFemale` check)
- [x] Save brouillon + Save & Partager → Task 6 (handleSave / handleSaveAndShare)
- [x] Annotation metric auto au partage avec event_type='nutrition' → Task 4 (share endpoint)
- [x] Un seul protocole shared actif → Task 4 (archive previous in share endpoint)
- [x] Vue client protocole actif → Task 8
- [x] Donut macros SVG client → Task 8
- [x] Paramètres de calcul NON visibles côté client → Task 8 (only result values shown)
- [x] Top bar avec info client → useClientTopBar('Nutrition') dans tool pages
- [x] `nutrition_protocols` table avec historique → Task 1

### Type consistency
- `NutritionProtocol`, `NutritionProtocolDay`, `DayDraft`, `NutritionClientData` — définis Task 2, utilisés de façon cohérente Tasks 3–8
- `MacroGoal` — importé de `lib/formulas/macros` dans Task 6
- `emptyDayDraft` / `dayDraftFromDb` — définis Task 2, utilisés Task 6

### No placeholders
- Tous les steps contiennent du vrai code complet
- Toutes les commandes sont exactes avec expected output
