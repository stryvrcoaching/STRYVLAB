# Smart Agenda Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Smart Agenda for the client app — chronological daily/weekly view aggregating meals (with AI macro analysis via GPT-4o + Inngest), check-ins, sessions, and assessments — plus BottomNav `+` quick-add menu and live macro progress on the nutrition page.

**Architecture:** `smart_agenda_events` central table aggregates all event types via `source_id`. Meals are saved immediately (ai_status=pending), then a new Inngest job `meal/analyze.requested` calls GPT-4o Vision with transcript + photos and patches the row. Client polls for status. Existing `/api/client/meals` route is extended (not replaced).

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase (service role for writes, RLS for reads), Inngest, GPT-4o Vision (OpenAI SDK), Framer Motion, Phosphor Icons, Tailwind DS v2.0.

---

## File Map

### New files
- `supabase/migrations/20260506_smart_agenda.sql` — `smart_agenda_events` + `coach_agenda_annotations` tables + RLS + `meal_logs` columns
- `app/client/agenda/page.tsx` — Smart Agenda page (day/week toggle, timeline)
- `app/client/agenda/meals/new/page.tsx` — Add meal page (transcript + photos + time)
- `app/api/client/meals/[id]/route.ts` — GET single meal (AI status poll)
- `app/api/client/agenda/route.ts` — GET events for a day
- `app/api/client/agenda/week/route.ts` — GET 7-day event density
- `app/api/client/nutrition/today-progress/route.ts` — GET macros consumed vs protocol
- `lib/inngest/functions/meal-analyze.ts` — Inngest job: GPT-4o Vision → macros
- `components/client/AgendaDayView.tsx` — Timeline list for one day
- `components/client/AgendaWeekView.tsx` — Week header pills + day content
- `components/client/AgendaEventCard.tsx` — Card renderer per event type
- `components/client/BottomNavPlusMenu.tsx` — Slide-up `+` menu over BottomNav

### Modified files
- `app/api/client/meals/route.ts` — POST: add `transcript`, `photo_urls`, `ai_status` fields + insert `smart_agenda_events` + send Inngest event
- `components/client/BottomNav.tsx` — Add `+` button that opens `BottomNavPlusMenu`
- `app/client/nutrition/page.tsx` — Add "Aujourd'hui" macro progress section
- `app/client/page.tsx` — Add "Smart Agenda" button in TopBar right
- `app/api/inngest/route.ts` — Register `mealAnalyzeFunction`

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260506_smart_agenda.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260506_smart_agenda.sql

-- 1. Extend meal_logs
ALTER TABLE public.meal_logs
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT 'pending' CHECK (ai_status IN ('pending', 'done', 'failed'));

-- 2. smart_agenda_events
CREATE TABLE IF NOT EXISTS public.smart_agenda_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.coach_clients(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN ('meal', 'checkin', 'session', 'assessment')),
  event_date  DATE NOT NULL,
  event_time  TIME,
  source_id   UUID,
  title       TEXT,
  summary     TEXT,
  data        JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sae_client_date ON public.smart_agenda_events (client_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_sae_client_type_date ON public.smart_agenda_events (client_id, event_type, event_date);

-- RLS
ALTER TABLE public.smart_agenda_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_sees_agenda_events" ON public.smart_agenda_events;
CREATE POLICY "coach_sees_agenda_events" ON public.smart_agenda_events
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_clients cc
    WHERE cc.id = smart_agenda_events.client_id AND cc.coach_id = auth.uid()
  ));

DROP POLICY IF EXISTS "client_own_agenda_events" ON public.smart_agenda_events;
CREATE POLICY "client_own_agenda_events" ON public.smart_agenda_events
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_clients cc
    WHERE cc.id = smart_agenda_events.client_id AND cc.user_id = auth.uid()
  ));

-- 3. coach_agenda_annotations (Phase 2 table — created now, used in Phase 2)
CREATE TABLE IF NOT EXISTS public.coach_agenda_annotations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL,
  client_id   UUID NOT NULL REFERENCES public.coach_clients(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES public.smart_agenda_events(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  read_at     TIMESTAMPTZ
);

ALTER TABLE public.coach_agenda_annotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_owns_annotations" ON public.coach_agenda_annotations;
CREATE POLICY "coach_owns_annotations" ON public.coach_agenda_annotations
  FOR ALL TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "client_sees_annotations" ON public.coach_agenda_annotations;
CREATE POLICY "client_sees_annotations" ON public.coach_agenda_annotations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_clients cc
    WHERE cc.id = coach_agenda_annotations.client_id AND cc.user_id = auth.uid()
  ));
```

- [ ] **Step 2: Apply migration in Supabase Dashboard SQL Editor**

Copy the SQL above into Supabase Dashboard → SQL Editor → Run.
Verify: no errors. Check `smart_agenda_events` table exists.

- [ ] **Step 3: Create `meal-photos` Storage bucket**

In Supabase Dashboard → Storage → New bucket:
- Name: `meal-photos`
- Public: false
- File size limit: 10MB
- Allowed MIME types: `image/jpeg, image/png, image/webp, image/heic`

Add policy: authenticated users can INSERT into their own folder (`{user_id}/*`).

---

## Task 2: Inngest meal-analyze job

**Files:**
- Create: `lib/inngest/functions/meal-analyze.ts`
- Modify: `app/api/inngest/route.ts`

- [ ] **Step 1: Write the Inngest function**

```typescript
// lib/inngest/functions/meal-analyze.ts
import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

const MEAL_ANALYSIS_PROMPT = `You are a sports nutrition expert. Analyze the meal description and/or photos provided and estimate the nutritional macros as accurately as possible.

Return ONLY a valid JSON object with these exact keys (all values are numbers, use 0 if unknown):
{
  "calories_kcal": <number>,
  "protein_g": <number>,
  "carbs_g": <number>,
  "fats_g": <number>,
  "fiber_g": <number>
}

Be realistic — base your estimates on typical portion sizes. If the user provides weights/volumes, use them precisely.`

export const mealAnalyzeFunction = inngest.createFunction(
  { id: 'meal-analyze', retries: 3, timeouts: { finish: '2m' } },
  { event: 'meal/analyze.requested' },
  async ({ event, step }) => {
    const { mealLogId } = event.data as { mealLogId: string }

    await step.run('analyze-with-gpt4o', async () => {
      const db = service()

      // Fetch the meal log
      const { data: meal, error: fetchErr } = await db
        .from('meal_logs')
        .select('transcript, photo_urls, name')
        .eq('id', mealLogId)
        .single()

      if (fetchErr || !meal) {
        await db.from('meal_logs').update({ ai_status: 'failed' }).eq('id', mealLogId)
        throw new Error(`Meal not found: ${mealLogId}`)
      }

      // Build content array for GPT-4o
      const userContent: OpenAI.Chat.ChatCompletionContentPart[] = []

      const description = [meal.name, meal.transcript].filter(Boolean).join('\n')
      if (description) {
        userContent.push({ type: 'text', text: description })
      }

      for (const url of (meal.photo_urls ?? []).slice(0, 3)) {
        userContent.push({ type: 'image_url', image_url: { url, detail: 'low' } })
      }

      if (userContent.length === 0) {
        await db.from('meal_logs').update({ ai_status: 'failed' }).eq('id', mealLogId)
        return
      }

      let macros: Record<string, number> = {}
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: MEAL_ANALYSIS_PROMPT },
            { role: 'user', content: userContent },
          ],
          max_tokens: 200,
        })
        macros = JSON.parse(response.choices[0].message.content ?? '{}')
      } catch {
        await db.from('meal_logs').update({ ai_status: 'failed' }).eq('id', mealLogId)
        throw new Error('OpenAI call failed')
      }

      // Patch meal_logs
      await db.from('meal_logs').update({
        estimated_macros: macros,
        ai_status: 'done',
      }).eq('id', mealLogId)

      // Update smart_agenda_events data snapshot
      await db.from('smart_agenda_events').update({
        data: macros,
        summary: `${macros.calories_kcal ?? 0} kcal · P${macros.protein_g ?? 0}g G${macros.carbs_g ?? 0}g L${macros.fats_g ?? 0}g`,
      }).eq('source_id', mealLogId).eq('event_type', 'meal')
    })
  }
)
```

- [ ] **Step 2: Register function in Inngest route**

```typescript
// app/api/inngest/route.ts
import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { checkinStreakEvaluateFunction } from '@/lib/inngest/functions/checkin-streak-evaluate'
import { pointsLevelUpdateFunction } from '@/lib/inngest/functions/points-level-update'
import { checkinStreakExpireFunction } from '@/lib/inngest/functions/checkin-streak-expire'
import { checkinReminderSendFunction } from '@/lib/inngest/functions/checkin-reminder-send'
import { mealAnalyzeFunction } from '@/lib/inngest/functions/meal-analyze'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    checkinStreakEvaluateFunction,
    pointsLevelUpdateFunction,
    checkinStreakExpireFunction,
    checkinReminderSendFunction,
    mealAnalyzeFunction,
  ],
})
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors (pre-existing errors in stripe/webhook are excluded).

- [ ] **Step 4: Commit**

```bash
git add lib/inngest/functions/meal-analyze.ts app/api/inngest/route.ts
git commit -m "feat(inngest): meal-analyze job — GPT-4o Vision → estimated macros"
```

---

## Task 3: Extend meals API + create agenda event on meal creation

**Files:**
- Modify: `app/api/client/meals/route.ts`
- Create: `app/api/client/meals/[id]/route.ts`

- [ ] **Step 1: Extend POST /api/client/meals**

Replace the entire `app/api/client/meals/route.ts` with:

```typescript
// app/api/client/meals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { inngest } from '@/lib/inngest/client'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveClientId(userId: string): Promise<string | null> {
  const { data } = await service()
    .from('coach_clients')
    .select('id')
    .eq('user_id', userId)
    .single()
  return data?.id ?? null
}

// GET /api/client/meals?date=YYYY-MM-DD&page=0&limit=20
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const url = new URL(req.url)
  const dateFilter = url.searchParams.get('date')
  const page = parseInt(url.searchParams.get('page') ?? '0', 10)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100)

  let query = service()
    .from('meal_logs')
    .select('*', { count: 'exact' })
    .eq('client_id', clientId)
    .order('logged_at', { ascending: true })
    .range(page * limit, (page + 1) * limit - 1)

  if (dateFilter) {
    query = query
      .gte('logged_at', `${dateFilter}T00:00:00.000Z`)
      .lte('logged_at', `${dateFilter}T23:59:59.999Z`)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit })
}

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  logged_at: z.string().datetime().optional(),
  photo_url: z.string().url().nullable().optional(),
  photo_urls: z.array(z.string().url()).max(3).optional(),
  transcript: z.string().max(2000).nullable().optional(),
  quality_rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  estimated_macros: z.object({
    calories_kcal: z.number().nonnegative().optional(),
    protein_g: z.number().nonnegative().optional(),
    carbs_g: z.number().nonnegative().optional(),
    fats_g: z.number().nonnegative().optional(),
    fiber_g: z.number().nonnegative().optional(),
  }).nullable().optional(),
})

// POST /api/client/meals
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const loggedAt = body.data.logged_at ?? new Date().toISOString()
  const hasAiContent = !!(body.data.transcript || (body.data.photo_urls ?? []).length > 0)

  const { data: meal, error } = await service()
    .from('meal_logs')
    .insert({
      client_id: clientId,
      name: body.data.name,
      logged_at: loggedAt,
      photo_url: body.data.photo_url ?? null,
      photo_urls: body.data.photo_urls ?? [],
      transcript: body.data.transcript ?? null,
      ai_status: hasAiContent ? 'pending' : 'done',
      quality_rating: body.data.quality_rating ?? null,
      notes: body.data.notes ?? null,
      estimated_macros: body.data.estimated_macros ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const eventDate = loggedAt.split('T')[0]
  const eventTime = loggedAt.split('T')[1]?.slice(0, 5) ?? null

  // Insert smart_agenda_events (fire and forget on error)
  await service().from('smart_agenda_events').insert({
    client_id: clientId,
    event_type: 'meal',
    event_date: eventDate,
    event_time: eventTime,
    source_id: meal.id,
    title: meal.name,
    summary: hasAiContent ? 'Analyse en cours...' : null,
    data: meal.estimated_macros ?? null,
  })

  // Award points
  await service().from('client_points').insert({
    client_id: clientId,
    action_type: 'meal',
    points: 3,
    reference_id: meal.id,
  })

  // Trigger AI analysis if there's content to analyze
  if (hasAiContent) {
    await inngest.send({ name: 'meal/analyze.requested', data: { mealLogId: meal.id } })
  }

  return NextResponse.json(meal, { status: 201 })
}
```

- [ ] **Step 2: Create GET /api/client/meals/[id] for polling**

```typescript
// app/api/client/meals/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cc } = await service()
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { data, error } = await service()
    .from('meal_logs')
    .select('id, name, logged_at, ai_status, estimated_macros, photo_urls, transcript')
    .eq('id', params.id)
    .eq('client_id', cc.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/client/meals/route.ts app/api/client/meals/[id]/route.ts
git commit -m "feat(api): extend meals POST with transcript/photo_urls/ai_status + agenda event insertion"
```

---

## Task 4: Agenda API routes

**Files:**
- Create: `app/api/client/agenda/route.ts`
- Create: `app/api/client/agenda/week/route.ts`
- Create: `app/api/client/nutrition/today-progress/route.ts`

- [ ] **Step 1: Create GET /api/client/agenda**

```typescript
// app/api/client/agenda/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/client/agenda?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cc } = await service()
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const url = new URL(req.url)
  const date = url.searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const { data, error } = await service()
    .from('smart_agenda_events')
    .select('*')
    .eq('client_id', cc.id)
    .eq('event_date', date)
    .order('event_time', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [], date })
}
```

- [ ] **Step 2: Create GET /api/client/agenda/week**

```typescript
// app/api/client/agenda/week/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/client/agenda/week?start=YYYY-MM-DD
// Returns event counts per day for the 7 days starting at `start`
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cc } = await service()
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const url = new URL(req.url)
  const start = url.searchParams.get('start') ?? new Date().toISOString().split('T')[0]
  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 6)
  const end = endDate.toISOString().split('T')[0]

  const { data, error } = await service()
    .from('smart_agenda_events')
    .select('event_date, event_type')
    .eq('client_id', cc.id)
    .gte('event_date', start)
    .lte('event_date', end)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build density map: { 'YYYY-MM-DD': { meal: N, session: N, checkin: N, assessment: N, total: N } }
  const density: Record<string, Record<string, number>> = {}
  for (const row of data ?? []) {
    if (!density[row.event_date]) density[row.event_date] = { total: 0 }
    density[row.event_date][row.event_type] = (density[row.event_date][row.event_type] ?? 0) + 1
    density[row.event_date].total += 1
  }

  return NextResponse.json({ density, start, end })
}
```

- [ ] **Step 3: Create GET /api/client/nutrition/today-progress**

```typescript
// app/api/client/nutrition/today-progress/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/client/nutrition/today-progress
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cc } = await service()
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const today = new Date().toISOString().split('T')[0]

  // Get active protocol
  const { data: protocol } = await service()
    .from('nutrition_protocols')
    .select('id, nutrition_protocol_days(*)')
    .eq('client_id', cc.id)
    .eq('status', 'shared')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Get today's logged meals with done AI status
  const { data: meals } = await service()
    .from('meal_logs')
    .select('estimated_macros, ai_status')
    .eq('client_id', cc.id)
    .gte('logged_at', `${today}T00:00:00.000Z`)
    .lte('logged_at', `${today}T23:59:59.999Z`)
    .eq('ai_status', 'done')

  const consumed = (meals ?? []).reduce(
    (acc, m) => {
      const em = m.estimated_macros as any
      if (!em) return acc
      return {
        calories: acc.calories + (em.calories_kcal ?? 0),
        protein_g: acc.protein_g + (em.protein_g ?? 0),
        carbs_g: acc.carbs_g + (em.carbs_g ?? 0),
        fat_g: acc.fat_g + (em.fats_g ?? 0),
      }
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )

  // Use first protocol day as target (simplification — no day-of-week mapping in Phase 1)
  const days = (protocol as any)?.nutrition_protocol_days ?? []
  const targetDay = days[0] ?? null

  const target = targetDay
    ? {
        calories: Number(targetDay.calories ?? 0),
        protein_g: Number(targetDay.protein_g ?? 0),
        carbs_g: Number(targetDay.carbs_g ?? 0),
        fat_g: Number(targetDay.fat_g ?? 0),
      }
    : null

  return NextResponse.json({
    consumed,
    target,
    hasProtocol: !!protocol,
    mealCount: (meals ?? []).length,
  })
}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 new errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/client/agenda/route.ts app/api/client/agenda/week/route.ts app/api/client/nutrition/today-progress/route.ts
git commit -m "feat(api): agenda day/week routes + nutrition today-progress endpoint"
```

---

## Task 5: AgendaEventCard component

**Files:**
- Create: `components/client/AgendaEventCard.tsx`

- [ ] **Step 1: Write component**

```typescript
// components/client/AgendaEventCard.tsx
'use client'

import { Utensils, Sun, Moon, Dumbbell, ClipboardList, Loader } from 'lucide-react'

export type AgendaEvent = {
  id: string
  event_type: 'meal' | 'checkin' | 'session' | 'assessment'
  event_date: string
  event_time: string | null
  source_id: string | null
  title: string | null
  summary: string | null
  data: Record<string, number> | null
  // For meal: ai_status from join or embedded
  ai_status?: 'pending' | 'done' | 'failed'
}

const TYPE_CONFIG = {
  meal: {
    icon: Utensils,
    color: 'text-[#1f8a65]',
    bg: 'bg-[#1f8a65]/[0.08]',
    label: 'Repas',
  },
  checkin: {
    icon: Sun, // overridden per moment below
    color: 'text-blue-400',
    bg: 'bg-blue-500/[0.08]',
    label: 'Check-in',
  },
  session: {
    icon: Dumbbell,
    color: 'text-amber-400',
    bg: 'bg-amber-500/[0.08]',
    label: 'Séance',
  },
  assessment: {
    icon: ClipboardList,
    color: 'text-white/50',
    bg: 'bg-white/[0.04]',
    label: 'Bilan',
  },
}

function MacroLine({ data }: { data: Record<string, number> | null }) {
  if (!data) return null
  const { protein_g, carbs_g, fats_g, calories_kcal } = data
  if (!calories_kcal) return null
  return (
    <div className="flex gap-3 mt-1.5 flex-wrap">
      <span className="text-[11px] font-semibold text-white/70">{calories_kcal} kcal</span>
      {protein_g != null && (
        <span className="text-[10px] text-white/40">P <span className="text-white/60 font-medium">{protein_g}g</span></span>
      )}
      {carbs_g != null && (
        <span className="text-[10px] text-white/40">G <span className="text-white/60 font-medium">{carbs_g}g</span></span>
      )}
      {fats_g != null && (
        <span className="text-[10px] text-white/40">L <span className="text-white/60 font-medium">{fats_g}g</span></span>
      )}
    </div>
  )
}

export default function AgendaEventCard({ event }: { event: AgendaEvent }) {
  const cfg = TYPE_CONFIG[event.event_type]

  // Checkin: detect morning/evening from title
  const isMorningCheckin = event.event_type === 'checkin' && event.title?.toLowerCase().includes('matin')
  const CheckinIcon = isMorningCheckin ? Sun : Moon
  const Icon = event.event_type === 'checkin' ? CheckinIcon : cfg.icon

  const isPending = event.event_type === 'meal' && event.ai_status === 'pending'

  return (
    <div className="flex gap-3 items-start bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl px-3.5 py-3">
      <div className={`mt-0.5 h-8 w-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
        <Icon size={15} className={cfg.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-white truncate">{event.title ?? cfg.label}</p>
          {event.event_time && (
            <span className="text-[10px] text-white/30 shrink-0">{event.event_time.slice(0, 5)}</span>
          )}
        </div>
        {isPending ? (
          <div className="flex items-center gap-1.5 mt-1">
            <Loader size={11} className="text-white/30 animate-spin" />
            <span className="text-[11px] text-white/30">Analyse en cours...</span>
          </div>
        ) : (
          <>
            {event.summary && !event.data && (
              <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{event.summary}</p>
            )}
            <MacroLine data={event.data} />
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/client/AgendaEventCard.tsx
git commit -m "feat(ui): AgendaEventCard — renders meal/checkin/session/assessment events"
```

---

## Task 6: AgendaDayView + AgendaWeekView components

**Files:**
- Create: `components/client/AgendaDayView.tsx`
- Create: `components/client/AgendaWeekView.tsx`

- [ ] **Step 1: Write AgendaDayView**

```typescript
// components/client/AgendaDayView.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import AgendaEventCard, { type AgendaEvent } from './AgendaEventCard'
import { Skeleton } from '@/components/ui/skeleton'

function dateIso(d: Date) {
  return d.toISOString().split('T')[0]
}

function formatDayHeader(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`)
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function MacroProgressBar({
  label, consumed, target, color,
}: {
  label: string; consumed: number; target: number; color: string
}) {
  const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-4">{label}</span>
      <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-white/50 w-16 text-right">
        {Math.round(consumed)}/{Math.round(target)}g
      </span>
    </div>
  )
}

export default function AgendaDayView({
  initialDate,
}: {
  initialDate: string
}) {
  const [date, setDate] = useState(initialDate)
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<{
    consumed: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
    target: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null
    hasProtocol: boolean
  } | null>(null)

  const loadDay = useCallback(async (d: string) => {
    setLoading(true)
    const [evRes, prRes] = await Promise.all([
      fetch(`/api/client/agenda?date=${d}`),
      fetch('/api/client/nutrition/today-progress'),
    ])
    const evData = await evRes.json()
    const prData = await prRes.json()
    setEvents(evData.data ?? [])
    setProgress(prData)
    setLoading(false)
  }, [])

  useEffect(() => { loadDay(date) }, [date, loadDay])

  // Poll pending meals every 3s
  useEffect(() => {
    const hasPending = events.some(
      e => e.event_type === 'meal' && e.ai_status === 'pending'
    )
    if (!hasPending) return
    const timer = setTimeout(() => loadDay(date), 3000)
    return () => clearTimeout(timer)
  }, [events, date, loadDay])

  function prevDay() {
    const d = new Date(`${date}T12:00:00Z`)
    d.setDate(d.getDate() - 1)
    setDate(dateIso(d))
  }

  function nextDay() {
    const d = new Date(`${date}T12:00:00Z`)
    d.setDate(d.getDate() + 1)
    setDate(dateIso(d))
  }

  const isToday = date === dateIso(new Date())

  return (
    <div className="space-y-4">
      {/* Date nav */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={prevDay}
          className="h-8 w-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.07] transition-colors active:scale-[0.95]"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <p className="text-[13px] font-semibold text-white capitalize">{formatDayHeader(date)}</p>
          {isToday && (
            <p className="text-[10px] text-[#1f8a65] font-medium">Aujourd'hui</p>
          )}
        </div>
        <button
          onClick={nextDay}
          disabled={isToday}
          className="h-8 w-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.07] transition-colors active:scale-[0.95] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Macro progress (today + protocol active) */}
      {isToday && progress?.hasProtocol && progress.target && (
        <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl px-4 py-3 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/30 mb-2">
            Macros du jour
          </p>
          <MacroProgressBar
            label="P" consumed={progress.consumed.protein_g}
            target={progress.target.protein_g} color="bg-blue-500"
          />
          <MacroProgressBar
            label="G" consumed={progress.consumed.carbs_g}
            target={progress.target.carbs_g} color="bg-amber-500"
          />
          <MacroProgressBar
            label="L" consumed={progress.consumed.fat_g}
            target={progress.target.fat_g} color="bg-red-400"
          />
          <div className="flex justify-between pt-1">
            <span className="text-[10px] text-white/35">Calories consommées</span>
            <span className="text-[11px] font-semibold text-white/70">
              {Math.round(progress.consumed.calories)} / {progress.target.calories} kcal
            </span>
          </div>
        </div>
      )}

      {/* Events list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 items-start bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl px-3.5 py-3">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-8 flex flex-col items-center text-center gap-2">
          <p className="text-[13px] font-medium text-white/30">Aucun événement ce jour</p>
          <p className="text-[11px] text-white/20">Ajoute un repas ou un check-in via le bouton +</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(event => (
            <AgendaEventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write AgendaWeekView**

```typescript
// components/client/AgendaWeekView.tsx
'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import AgendaDayView from './AgendaDayView'

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function getMondayOf(dateIso: string): Date {
  const d = new Date(`${dateIso}T12:00:00Z`)
  const day = d.getDay() // 0=Sun
  const dow = day === 0 ? 7 : day
  d.setDate(d.getDate() - (dow - 1))
  return d
}

function dateIso(d: Date) {
  return d.toISOString().split('T')[0]
}

function getDaysOfWeek(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return dateIso(d)
  })
}

type DensityMap = Record<string, { total: number; meal?: number; session?: number; checkin?: number; assessment?: number }>

export default function AgendaWeekView({ initialDate }: { initialDate: string }) {
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [monday, setMonday] = useState(() => getMondayOf(initialDate))
  const [density, setDensity] = useState<DensityMap>({})

  const days = getDaysOfWeek(monday)
  const today = dateIso(new Date())

  useEffect(() => {
    fetch(`/api/client/agenda/week?start=${dateIso(monday)}`)
      .then(r => r.json())
      .then(d => setDensity(d.density ?? {}))
  }, [monday])

  function prevWeek() {
    const m = new Date(monday)
    m.setDate(m.getDate() - 7)
    setMonday(m)
    setSelectedDate(dateIso(m))
  }

  function nextWeek() {
    const m = new Date(monday)
    m.setDate(m.getDate() + 7)
    setMonday(m)
    setSelectedDate(dateIso(m))
  }

  const monthLabel = new Date(`${days[0]}T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* Week nav */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={prevWeek}
          className="h-8 w-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors active:scale-[0.95]"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-[12px] font-medium text-white/50 capitalize">{monthLabel}</p>
        <button
          onClick={nextWeek}
          className="h-8 w-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors active:scale-[0.95]"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day pills */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const isSelected = d === selectedDate
          const isToday = d === today
          const dayNum = new Date(`${d}T12:00:00Z`).getDate()
          const dayDensity = density[d]?.total ?? 0

          return (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                isSelected
                  ? 'bg-[#1f8a65]/10'
                  : 'hover:bg-white/[0.04]'
              }`}
            >
              <span className={`text-[9px] font-semibold uppercase tracking-wide ${
                isSelected ? 'text-[#1f8a65]' : 'text-white/30'
              }`}>
                {DAY_LABELS[i]}
              </span>
              <span className={`text-[14px] font-bold leading-none ${
                isToday
                  ? 'text-[#1f8a65]'
                  : isSelected
                  ? 'text-white'
                  : 'text-white/50'
              }`}>
                {dayNum}
              </span>
              {/* Density bars */}
              <div className="flex gap-0.5">
                {Array.from({ length: Math.min(dayDensity, 4) }, (_, j) => (
                  <div
                    key={j}
                    className={`h-1 w-1 rounded-full ${
                      isSelected ? 'bg-[#1f8a65]' : 'bg-white/20'
                    }`}
                  />
                ))}
                {dayDensity === 0 && <div className="h-1 w-1" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Day content for selected date */}
      <AgendaDayView initialDate={selectedDate} />
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/client/AgendaDayView.tsx components/client/AgendaWeekView.tsx
git commit -m "feat(ui): AgendaDayView + AgendaWeekView — timeline with macro progress + week density pills"
```

---

## Task 7: Smart Agenda page

**Files:**
- Create: `app/client/agenda/page.tsx`

- [ ] **Step 1: Write the page**

```typescript
// app/client/agenda/page.tsx
'use client'

import { useState } from 'react'
import ClientTopBar from '@/components/client/ClientTopBar'
import AgendaDayView from '@/components/client/AgendaDayView'
import AgendaWeekView from '@/components/client/AgendaWeekView'

function dateIso(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function SmartAgendaPage() {
  const [view, setView] = useState<'day' | 'week'>('day')
  const today = dateIso(new Date())

  return (
    <div className="min-h-screen bg-[#121212]">
      <ClientTopBar
        section="Suivi"
        title="Smart Agenda"
      />

      <main className="max-w-lg mx-auto px-4 pt-[88px] pb-28 space-y-4">
        {/* View toggle */}
        <div className="flex gap-1 bg-white/[0.03] border-[0.3px] border-white/[0.06] rounded-xl p-1">
          <button
            onClick={() => setView('day')}
            className={`flex-1 h-8 rounded-lg text-[12px] font-semibold transition-colors ${
              view === 'day'
                ? 'bg-[#1f8a65] text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Jour
          </button>
          <button
            onClick={() => setView('week')}
            className={`flex-1 h-8 rounded-lg text-[12px] font-semibold transition-colors ${
              view === 'week'
                ? 'bg-[#1f8a65] text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Semaine
          </button>
        </div>

        {view === 'day' ? (
          <AgendaDayView initialDate={today} />
        ) : (
          <AgendaWeekView initialDate={today} />
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/client/agenda/page.tsx
git commit -m "feat(client): Smart Agenda page — day/week toggle"
```

---

## Task 8: Add meal page with transcript + photo upload + voice

**Files:**
- Create: `app/client/agenda/meals/new/page.tsx`

- [ ] **Step 1: Write the page**

```typescript
// app/client/agenda/meals/new/page.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import ClientTopBar from '@/components/client/ClientTopBar'
import { Mic, MicOff, Camera, X, ChevronLeft, ArrowRight } from 'lucide-react'

function timeNow() {
  return new Date().toTimeString().slice(0, 5)
}

function dateIso(d: Date) {
  return d.toISOString().split('T')[0]
}

export default function AddMealPage() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('Repas')
  const [transcript, setTranscript] = useState('')
  const [time, setTime] = useState(timeNow)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [recording, setRecording] = useState(false)
  const recognitionRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleVoice = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) return

    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }

    const rec = new SpeechRecognition()
    rec.lang = 'fr-FR'
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e: any) => {
      const result = Array.from(e.results as SpeechRecognitionResultList)
        .map((r: any) => r[0].transcript)
        .join(' ')
      setTranscript(prev => (prev ? `${prev} ${result}` : result))
    }
    rec.onend = () => setRecording(false)
    rec.start()
    recognitionRef.current = rec
    setRecording(true)
  }, [recording])

  async function uploadPhotos(files: File[]): Promise<string[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const urls: string[] = []
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage
        .from('meal-photos')
        .upload(path, file, { upsert: false })
      if (error) continue
      const { data } = supabase.storage.from('meal-photos').getPublicUrl(path)
      urls.push(data.publicUrl)
    }
    return urls
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 3 - photoFiles.length)
    setPhotoFiles(prev => [...prev, ...files].slice(0, 3))
    const previews = files.map(f => URL.createObjectURL(f))
    setPhotoUrls(prev => [...prev, ...previews].slice(0, 3))
  }

  function removePhoto(idx: number) {
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx))
    setPhotoUrls(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    try {
      const uploadedUrls = await uploadPhotos(photoFiles)
      const today = dateIso(new Date())
      const loggedAt = new Date(`${today}T${time}:00`).toISOString()

      const res = await fetch('/api/client/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          logged_at: loggedAt,
          transcript: transcript || null,
          photo_urls: uploadedUrls,
        }),
      })

      if (!res.ok) throw new Error('Failed to save meal')

      router.push('/client/agenda')
    } catch {
      setSubmitting(false)
    }
  }

  const hasSpeechAPI = typeof window !== 'undefined' &&
    !!(( window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  return (
    <div className="min-h-screen bg-[#121212]">
      <ClientTopBar section="Nutrition" title="Nouveau repas" />

      <main className="max-w-lg mx-auto px-4 pt-[88px] pb-28 space-y-4">
        {/* Meal name */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
            Nom du repas
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-xl bg-[#0a0a0a] px-4 h-[52px] text-[14px] font-medium text-white placeholder:text-white/20 outline-none"
            placeholder="Petit-déjeuner, Collation pré-entraînement..."
          />
        </div>

        {/* Time */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
            Heure
          </label>
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="w-full rounded-xl bg-[#0a0a0a] px-4 h-[52px] text-[14px] font-medium text-white outline-none"
          />
        </div>

        {/* Transcript */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
              Description
            </label>
            {hasSpeechAPI && (
              <button
                onClick={toggleVoice}
                className={`flex items-center gap-1.5 px-3 h-7 rounded-lg text-[11px] font-semibold transition-colors ${
                  recording
                    ? 'bg-red-500/20 text-red-400 animate-pulse'
                    : 'bg-white/[0.04] text-white/45 hover:bg-white/[0.08]'
                }`}
              >
                {recording ? <MicOff size={12} /> : <Mic size={12} />}
                {recording ? 'Stop' : 'Vocal'}
              </button>
            )}
          </div>
          <textarea
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            rows={4}
            className="w-full rounded-xl bg-[#0a0a0a] px-4 py-3.5 text-[14px] font-medium text-white placeholder:text-white/20 outline-none resize-none leading-relaxed"
            placeholder="Ex: 250ml lait écrémé, 40g flocons d'avoine, 1 banane..."
          />
        </div>

        {/* Photos */}
        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
            Photos (optionnel, max 3)
          </label>
          <div className="flex gap-2">
            {photoUrls.map((url, i) => (
              <div key={i} className="relative w-20 h-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover rounded-xl" />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
            {photoFiles.length < 3 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-[0.3px] border-dashed border-white/20 flex flex-col items-center justify-center gap-1 text-white/30 hover:text-white/50 hover:border-white/30 transition-colors"
              >
                <Camera size={18} />
                <span className="text-[9px]">Ajouter</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !name.trim()}
          className="group/btn flex h-[52px] w-full items-center justify-between rounded-xl bg-[#1f8a65] pl-5 pr-1.5 transition-all hover:bg-[#217356] active:scale-[0.99] disabled:opacity-50"
        >
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-white">
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </span>
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-lg bg-black/[0.12]">
            <ArrowRight size={16} className="text-white" />
          </div>
        </button>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/client/agenda/meals/new/page.tsx
git commit -m "feat(client): add meal page — transcript + voice + photo upload + AI trigger"
```

---

## Task 9: BottomNav + menu

**Files:**
- Create: `components/client/BottomNavPlusMenu.tsx`
- Modify: `components/client/BottomNav.tsx`

- [ ] **Step 1: Write BottomNavPlusMenu**

```typescript
// components/client/BottomNavPlusMenu.tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Utensils, ClipboardCheck, X } from 'lucide-react'

export default function BottomNavPlusMenu({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()

  function getMoment() {
    const hour = new Date().getHours()
    return hour < 14 ? 'matin' : 'soir'
  }

  function goMeal() {
    onClose()
    router.push('/client/agenda/meals/new')
  }

  function goCheckin() {
    onClose()
    router.push(`/client/checkin/${getMoment()}`)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/40"
          />

          {/* Menu */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-[90px] left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-[480px]"
          >
            <div className="bg-[#181818] border-[0.3px] border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
              <button
                onClick={goMeal}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/[0.04] transition-colors active:scale-[0.99] border-b-[0.3px] border-white/[0.05]"
              >
                <div className="h-9 w-9 rounded-xl bg-[#1f8a65]/15 flex items-center justify-center shrink-0">
                  <Utensils size={16} className="text-[#1f8a65]" />
                </div>
                <div className="text-left">
                  <p className="text-[13px] font-semibold text-white">Ajouter un repas</p>
                  <p className="text-[11px] text-white/35">Texte, vocal ou photo</p>
                </div>
              </button>

              <button
                onClick={goCheckin}
                className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/[0.04] transition-colors active:scale-[0.99]"
              >
                <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <ClipboardCheck size={16} className="text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="text-[13px] font-semibold text-white">Check-in</p>
                  <p className="text-[11px] text-white/35">
                    {new Date().getHours() < 14 ? 'Check-in du matin' : 'Check-in du soir'}
                  </p>
                </div>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Modify BottomNav to add + button**

Replace `components/client/BottomNav.tsx` with:

```typescript
// components/client/BottomNav.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, Barbell, ForkKnife, UserCircle } from '@phosphor-icons/react'
import { Plus } from 'lucide-react'
import { useClientT } from './ClientI18nProvider'
import { useTour } from './TourContext'
import BottomNavPlusMenu from './BottomNavPlusMenu'
import type { ClientDictKey } from '@/lib/i18n/clientTranslations'

const NAV: { href: string; labelKey: ClientDictKey; Icon: React.ElementType }[] = [
  { href: '/client',           labelKey: 'nav.home',      Icon: House },
  { href: '/client/programme', labelKey: 'nav.programme', Icon: Barbell },
  { href: '/client/nutrition', labelKey: 'nav.nutrition', Icon: ForkKnife },
  { href: '/client/profil',    labelKey: 'nav.profil',    Icon: UserCircle },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { t } = useClientT()
  const { highlightedNavIndex } = useTour()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <BottomNavPlusMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-auto w-full max-w-[480px] px-4">
          <div className="flex items-center rounded-2xl border-[0.3px] border-white/[0.06] bg-[#181818] backdrop-blur-md shadow-[0_-1px_0_rgba(255,255,255,0.03),0_-12px_40px_rgba(0,0,0,0.5)] px-2 h-[62px]">

            {/* Left 2 nav items */}
            {NAV.slice(0, 2).map(({ href, labelKey, Icon }, idx) => {
              const routeActive = href === '/client' ? pathname === '/client' : pathname.startsWith(href)
              const active = routeActive || highlightedNavIndex === idx
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex flex-col items-center justify-center gap-[4px] flex-1 h-full transition-all duration-200 active:scale-[0.92] ${
                    active ? 'text-[#1f8a65]' : 'text-white/35 hover:text-white/60'
                  }`}
                >
                  {active && (
                    <span className="absolute inset-x-1 inset-y-2 rounded-xl bg-[#1f8a65]/[0.12]" />
                  )}
                  <Icon size={24} weight={active ? 'fill' : 'regular'} className="relative z-10" />
                  <span className={`relative z-10 text-[10px] font-semibold leading-none tracking-wide transition-colors duration-200 ${
                    active ? 'text-[#1f8a65]' : 'text-white/30'
                  }`}>
                    {t(labelKey)}
                  </span>
                </Link>
              )
            })}

            {/* Center + button */}
            <div className="flex items-center justify-center px-2">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="h-10 w-10 rounded-xl bg-[#1f8a65] flex items-center justify-center text-white shadow-[0_0_16px_rgba(31,138,101,0.35)] hover:bg-[#217356] active:scale-[0.95] transition-all"
              >
                <Plus size={20} strokeWidth={2.5} />
              </button>
            </div>

            {/* Right 2 nav items */}
            {NAV.slice(2).map(({ href, labelKey, Icon }, idx) => {
              const realIdx = idx + 2
              const routeActive = pathname.startsWith(href)
              const active = routeActive || highlightedNavIndex === realIdx
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex flex-col items-center justify-center gap-[4px] flex-1 h-full transition-all duration-200 active:scale-[0.92] ${
                    active ? 'text-[#1f8a65]' : 'text-white/35 hover:text-white/60'
                  }`}
                >
                  {active && (
                    <span className="absolute inset-x-1 inset-y-2 rounded-xl bg-[#1f8a65]/[0.12]" />
                  )}
                  <Icon size={24} weight={active ? 'fill' : 'regular'} className="relative z-10" />
                  <span className={`relative z-10 text-[10px] font-semibold leading-none tracking-wide transition-colors duration-200 ${
                    active ? 'text-[#1f8a65]' : 'text-white/30'
                  }`}>
                    {t(labelKey)}
                  </span>
                </Link>
              )
            })}

          </div>
        </div>
      </nav>
    </>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/client/BottomNavPlusMenu.tsx components/client/BottomNav.tsx
git commit -m "feat(nav): BottomNav + button with slide-up menu (repas / check-in)"
```

---

## Task 10: Home page Smart Agenda button + nutrition page macro progress

**Files:**
- Modify: `app/client/page.tsx`
- Modify: `app/client/nutrition/page.tsx`

- [ ] **Step 1: Add Smart Agenda button to home TopBar**

In `app/client/page.tsx`, locate the `ClientTopBar` render. The current page uses `ClientTopBar` with `section` and `title`. We need to add a right-side button using `useSetTopBar`. Since this is a Server Component, we'll add a client wrapper.

Create `components/client/HomeTopBarActions.tsx`:

```typescript
// components/client/HomeTopBarActions.tsx
'use client'

import { useEffect } from 'react'
import { CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { useSetTopBar } from '@/components/client/ClientTopBar'

export default function HomeTopBarActions() {
  const setTopBar = useSetTopBar()

  useEffect(() => {
    setTopBar(
      undefined, // left stays as-is
      <Link
        href="/client/agenda"
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/[0.04] text-white/55 hover:bg-white/[0.08] hover:text-white/80 transition-colors text-[12px] font-bold uppercase tracking-[0.12em]"
      >
        <CalendarDays size={13} />
        <span>Agenda</span>
      </Link>
    )
  }, [setTopBar])

  return null
}
```

Then in `app/client/page.tsx`, add `<HomeTopBarActions />` inside the returned JSX (after `<ClientTopBar>`). If `useSetTopBar` doesn't exist yet in `ClientTopBar`, skip this and instead add a direct Link button in the page below the TopBar as a floating shortcut:

```typescript
// In app/client/page.tsx, add after ClientTopBar:
// <Link href="/client/agenda" className="..."> Smart Agenda </Link>
```

Check first if `useSetTopBar` or equivalent hook exists in ClientTopBar:

```bash
grep -n "useSetTopBar\|setTopBar\|topBarRight" /Users/user/Desktop/VIRTUS/components/client/ClientTopBar.tsx | head -20
```

If it doesn't exist, add a small "Smart Agenda →" link card to the home page's existing sections instead:

In `app/client/page.tsx`, add this block before the closing `</main>` tag (inside the existing page markup):

```typescript
{/* Smart Agenda shortcut */}
<Link
  href="/client/agenda"
  className="flex items-center justify-between bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl px-4 py-3 hover:bg-white/[0.04] transition-colors active:scale-[0.99]"
>
  <div className="flex items-center gap-3">
    <div className="h-8 w-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
      <CalendarDays size={15} className="text-white/40" />
    </div>
    <div>
      <p className="text-[13px] font-semibold text-white">Smart Agenda</p>
      <p className="text-[11px] text-white/35">Voir mon suivi du jour</p>
    </div>
  </div>
  <ChevronRight size={15} className="text-white/25" />
</Link>
```

Make sure `CalendarDays` is imported from `lucide-react` in `app/client/page.tsx`.

- [ ] **Step 2: Add macro progress to nutrition page**

In `app/client/nutrition/page.tsx`, add a server-side fetch for today's progress and render it before the protocol section.

Add this fetch at the end of the existing fetch block (after the protocol fetch):

```typescript
// After existing fetches in ClientNutritionPage:
const today = new Date().toISOString().split('T')[0]
const { data: todayMeals } = client
  ? await service
      .from('meal_logs')
      .select('estimated_macros, ai_status')
      .eq('client_id', client.id)
      .gte('logged_at', `${today}T00:00:00.000Z`)
      .lte('logged_at', `${today}T23:59:59.999Z`)
      .eq('ai_status', 'done')
  : { data: null }

const consumed = (todayMeals ?? []).reduce(
  (acc: any, m: any) => {
    const em = m.estimated_macros
    if (!em) return acc
    return {
      calories: acc.calories + (em.calories_kcal ?? 0),
      protein_g: acc.protein_g + (em.protein_g ?? 0),
      carbs_g: acc.carbs_g + (em.carbs_g ?? 0),
      fat_g: acc.fat_g + (em.fats_g ?? 0),
    }
  },
  { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
)

const targetDay = days[0] ?? null
```

Add this JSX block inside `<main>`, before the `{!protocol && (...)}` block:

```typescript
{/* Today's macro progress */}
{protocol && targetDay && (consumed.calories > 0 || (todayMeals ?? []).length > 0) && (
  <div className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-2xl px-4 py-3.5 space-y-3">
    <div className="flex items-center justify-between">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35 font-semibold">
        Aujourd'hui
      </p>
      <Link href="/client/agenda" className="text-[11px] text-[#1f8a65] font-semibold hover:underline">
        Voir l'agenda →
      </Link>
    </div>
    <div className="flex items-baseline gap-1.5">
      <p className="text-[24px] font-black text-white leading-none">
        {Math.round(consumed.calories)}
      </p>
      <p className="text-[11px] text-white/35 font-medium">
        / {Number(targetDay.calories ?? 0)} kcal
      </p>
    </div>
    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className="h-full rounded-full bg-[#1f8a65] transition-all"
        style={{
          width: `${Math.min((consumed.calories / (Number(targetDay.calories) || 1)) * 100, 100)}%`
        }}
      />
    </div>
    <div className="flex gap-4">
      <span className="text-[10px] text-white/40">
        P <span className="text-white/65 font-semibold">{Math.round(consumed.protein_g)}g</span>
        <span className="text-white/25"> / {Number(targetDay.protein_g ?? 0)}g</span>
      </span>
      <span className="text-[10px] text-white/40">
        G <span className="text-white/65 font-semibold">{Math.round(consumed.carbs_g)}g</span>
        <span className="text-white/25"> / {Number(targetDay.carbs_g ?? 0)}g</span>
      </span>
      <span className="text-[10px] text-white/40">
        L <span className="text-white/65 font-semibold">{Math.round(consumed.fat_g)}g</span>
        <span className="text-white/25"> / {Number(targetDay.fat_g ?? 0)}g</span>
      </span>
    </div>
  </div>
)}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/client/page.tsx app/client/nutrition/page.tsx components/client/HomeTopBarActions.tsx
git commit -m "feat(client): Smart Agenda link on home + macro progress on nutrition page"
```

---

## Task 11: Populate smart_agenda_events for existing event types

When check-ins complete, sessions complete, and assessments complete, we need to insert into `smart_agenda_events`. This task wires those three event types.

**Files:**
- Find and modify the route that marks check-ins as completed
- Find and modify the route that marks sessions as completed

- [ ] **Step 1: Find checkin and session completion routes**

```bash
grep -rn "completed_at\|status.*completed\|checkin.*complete" /Users/user/Desktop/VIRTUS/app/api/client/ --include="*.ts" -l
grep -rn "session.*complete\|completed_at" /Users/user/Desktop/VIRTUS/app/api/session-logs/ --include="*.ts" -l
```

- [ ] **Step 2: Add agenda event insertion in check-in completion**

In whichever route marks a `daily_checkin_responses` row as completed, add after the successful insert/update:

```typescript
// After successful checkin save — insert agenda event
await service().from('smart_agenda_events').insert({
  client_id: clientId,
  event_type: 'checkin',
  event_date: new Date().toISOString().split('T')[0],
  event_time: new Date().toTimeString().slice(0, 5),
  source_id: checkinResponseId, // the ID of the saved checkin response
  title: moment === 'matin' ? 'Check-in du matin' : 'Check-in du soir',
  summary: null,
  data: null,
}).catch(() => {}) // fire and forget
```

- [ ] **Step 3: Add agenda event insertion in session completion**

In `app/api/session-logs/[logId]/route.ts` (or wherever `completed_at` is set on session logs), add after the successful PATCH:

```typescript
// After session marked completed
await service().from('smart_agenda_events').insert({
  client_id: clientId,
  event_type: 'session',
  event_date: new Date().toISOString().split('T')[0],
  event_time: new Date().toTimeString().slice(0, 5),
  source_id: logId,
  title: sessionName ?? 'Séance réalisée',
  summary: null,
  data: null,
}).catch(() => {})
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add -p  # stage only the modified route files
git commit -m "feat(api): populate smart_agenda_events on checkin + session completion"
```

---

## Task 12: Update CHANGELOG and project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Update CHANGELOG.md**

Add at the top of `CHANGELOG.md` under today's date:

```
## 2026-05-06

FEATURE: Smart Agenda Phase 1 — client day/week view, meal logging with GPT-4o Vision + Inngest, BottomNav + menu
FEATURE: Add meal page — transcript, voice input (Web Speech API), photo upload to meal-photos bucket
FEATURE: smart_agenda_events table — central event aggregation for meal/checkin/session/assessment
FEATURE: coach_agenda_annotations table created (Phase 2 usage)
FEATURE: BottomNav + button with slide-up menu (Ajouter un repas / Check-in)
FEATURE: Nutrition page — macro progress bar (consumed vs protocol target)
FEATURE: Home page — Smart Agenda shortcut link
FEATURE: meal/analyze.requested Inngest job — GPT-4o Vision macro estimation
SCHEMA: smart_agenda_events + coach_agenda_annotations tables + RLS
SCHEMA: meal_logs — add transcript, photo_urls TEXT[], ai_status columns
```

- [ ] **Step 2: Update project-state.md**

Update the `Client App` row in the modules table to include Smart Agenda Phase 1. Add a new `## 2026-05-06 — Smart Agenda Phase 1` section under "Dernières Avancées" with the key files, behaviors, and invariants documented in this plan.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG + project-state for Smart Agenda Phase 1"
```
