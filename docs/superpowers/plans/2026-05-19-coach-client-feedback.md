# Coach ↔ Client Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add contextual coach annotations on any entity (session, exercise, set, check-in, morpho, bilan) with emoji reactions + optional text reply from the client, a coach hub page, and inline composer buttons on key coach views.

**Architecture:** Two new tables (`coach_feedback`, `coach_feedback_reactions`) with strict RLS. Six API routes (3 coach, 3 client). Shared types in `lib/feedback/types.ts`. Coach-side `FeedbackComposer` bottom sheet + `/feedback` hub page. Client-side `FeedbackThread` component embedded in recap, bilans, and bilan detail pages. Notifications via existing `coach_client_notifications` table (CHECK constraint extended in the new migration).

**Tech Stack:** Next.js App Router, Supabase (service role for server-side, RLS for client), TypeScript strict, DS v2.0 (coach), DS v3.0 (client), Framer Motion (bottom sheet), Lucide React

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/20260519_coach_feedback.sql` | Create |
| `lib/feedback/types.ts` | Create — shared types, zero DB imports |
| `app/api/clients/[clientId]/feedback/route.ts` | Create — GET list, POST create (coach) |
| `app/api/clients/[clientId]/feedback/[feedbackId]/reactions/route.ts` | Create — POST reaction (coach) |
| `app/api/client/feedback/[entityType]/[entityId]/route.ts` | Create — GET entity feedbacks (client) |
| `app/api/client/feedback/[feedbackId]/reactions/route.ts` | Create — POST reaction (client) |
| `components/coach/FeedbackComposer.tsx` | Create — bottom sheet for writing annotations |
| `app/coach/clients/[clientId]/feedback/page.tsx` | Create — hub: all annotations for a client |
| `components/client/smart/FeedbackThread.tsx` | Create — thread display + reaction UI (DS v3.0) |
| `app/client/programme/recap/[sessionLogId]/page.tsx` | Modify — embed FeedbackThread at bottom |
| `app/client/bilans/[submissionId]/page.tsx` | Modify — embed FeedbackThread at bottom |
| `components/clients/MorphoAnalysisSection.tsx` | Modify — add FeedbackComposer inline per analysis |
| `components/client/smart/NotificationsBar.tsx` | Modify — handle coach_feedback + client_reaction types |
| `CHANGELOG.md` | Update after each task |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260519_coach_feedback.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260519_coach_feedback.sql

-- 1. coach_feedback table
CREATE TABLE IF NOT EXISTS coach_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('session','exercise','set','checkin','morpho','bilan')),
  entity_id   uuid NOT NULL,
  entity_label text,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_feedback_client
  ON coach_feedback (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_feedback_entity
  ON coach_feedback (entity_type, entity_id);

-- 2. coach_feedback_reactions table
CREATE TABLE IF NOT EXISTS coach_feedback_reactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES coach_feedback(id) ON DELETE CASCADE,
  author_type text NOT NULL CHECK (author_type IN ('client','coach')),
  author_id   uuid NOT NULL,
  emoji       text NOT NULL CHECK (emoji IN ('👍','💪','✅','🔥','❓')),
  reply_text  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_reactions_feedback
  ON coach_feedback_reactions (feedback_id, created_at ASC);

-- 3. RLS for coach_feedback
ALTER TABLE coach_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_manage_feedback"
  ON coach_feedback FOR ALL TO authenticated
  USING (
    coach_id = auth.uid() AND
    client_id IN (SELECT id FROM coach_clients WHERE coach_id = auth.uid())
  )
  WITH CHECK (
    coach_id = auth.uid() AND
    client_id IN (SELECT id FROM coach_clients WHERE coach_id = auth.uid())
  );

CREATE POLICY "client_read_feedback"
  ON coach_feedback FOR SELECT TO authenticated
  USING (
    client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())
  );

-- 4. RLS for coach_feedback_reactions
ALTER TABLE coach_feedback_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_manage_reactions"
  ON coach_feedback_reactions FOR ALL TO authenticated
  USING (
    feedback_id IN (
      SELECT id FROM coach_feedback
      WHERE coach_id = auth.uid()
    )
  )
  WITH CHECK (
    feedback_id IN (
      SELECT id FROM coach_feedback
      WHERE coach_id = auth.uid()
    )
  );

CREATE POLICY "client_manage_reactions"
  ON coach_feedback_reactions FOR ALL TO authenticated
  USING (
    feedback_id IN (
      SELECT cf.id FROM coach_feedback cf
      JOIN coach_clients cc ON cc.id = cf.client_id
      WHERE cc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    feedback_id IN (
      SELECT cf.id FROM coach_feedback cf
      JOIN coach_clients cc ON cc.id = cf.client_id
      WHERE cc.user_id = auth.uid()
    )
  );

-- 5. Extend coach_client_notifications CHECK constraint to include new types
-- Drop old constraint, add new one
ALTER TABLE coach_client_notifications
  DROP CONSTRAINT IF EXISTS coach_client_notifications_type_check;

ALTER TABLE coach_client_notifications
  ADD CONSTRAINT coach_client_notifications_type_check
  CHECK (type IN (
    'coach_note','bilan_pending','program_assigned','system_reminder',
    'tdee_updated','tdee_coach_alert','coach_feedback','client_reaction'
  ));
```

- [ ] **Step 2: Apply migration**

Apply via Supabase Dashboard → SQL Editor. Run the full content of `supabase/migrations/20260519_coach_feedback.sql`.

Expected: no errors, two new tables created, notifications constraint updated.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260519_coach_feedback.sql
git commit -m "schema: coach_feedback + reactions tables, extend notifications CHECK"
```

---

## Task 2: Shared Types

**Files:**
- Create: `lib/feedback/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// lib/feedback/types.ts

export type FeedbackEntityType = 'session' | 'exercise' | 'set' | 'checkin' | 'morpho' | 'bilan'
export type FeedbackEmoji = '👍' | '💪' | '✅' | '🔥' | '❓'
export type FeedbackAuthorType = 'client' | 'coach'

export const FEEDBACK_EMOJIS: FeedbackEmoji[] = ['👍', '💪', '✅', '🔥', '❓']

export interface FeedbackReaction {
  id: string
  feedback_id: string
  author_type: FeedbackAuthorType
  author_id: string
  emoji: FeedbackEmoji
  reply_text: string | null
  created_at: string
}

export interface CoachFeedback {
  id: string
  coach_id: string
  client_id: string
  entity_type: FeedbackEntityType
  entity_id: string
  entity_label: string | null
  body: string
  created_at: string
  reactions: FeedbackReaction[]
}

export const ENTITY_TYPE_LABEL: Record<FeedbackEntityType, string> = {
  session: '🏋️ Séance',
  exercise: '💪 Exercice',
  set: '💪 Set',
  checkin: '📊 Check-in',
  morpho: '📷 Morpho',
  bilan: '📋 Bilan',
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "lib/feedback" | grep -v node_modules
```

Expected: no output (0 errors)

- [ ] **Step 3: Commit**

```bash
git add lib/feedback/types.ts
git commit -m "feat(feedback): shared types — CoachFeedback, FeedbackReaction, FEEDBACK_EMOJIS"
```

---

## Task 3: Coach API Routes

**Files:**
- Create: `app/api/clients/[clientId]/feedback/route.ts`
- Create: `app/api/clients/[clientId]/feedback/[feedbackId]/reactions/route.ts`

- [ ] **Step 1: Create the feedback list + create route**

```typescript
// app/api/clients/[clientId]/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { FeedbackEntityType } from '@/lib/feedback/types'
import { z } from 'zod'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const createSchema = z.object({
  entity_type: z.enum(['session','exercise','set','checkin','morpho','bilan']),
  entity_id: z.string().uuid(),
  entity_label: z.string().optional(),
  body: z.string().min(1).max(1000),
})

export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()
  const { clientId } = params

  // Ownership check
  const { data: client } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entity_type') as FeedbackEntityType | null
  const entityId = searchParams.get('entity_id')

  let query = db
    .from('coach_feedback')
    .select(`*, coach_feedback_reactions(*)`)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (entityType) query = query.eq('entity_type', entityType)
  if (entityId) query = query.eq('entity_id', entityId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    (data ?? []).map((f: any) => ({
      ...f,
      reactions: f.coach_feedback_reactions ?? [],
    }))
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()
  const { clientId } = params

  const { data: client } = await db
    .from('coach_clients')
    .select('id, first_name')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = createSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const { data: feedback, error } = await db
    .from('coach_feedback')
    .insert({
      coach_id: user.id,
      client_id: clientId,
      entity_type: body.data.entity_type,
      entity_id: body.data.entity_id,
      entity_label: body.data.entity_label ?? null,
      body: body.data.body,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify client
  await db.from('coach_client_notifications').insert({
    client_id: clientId,
    coach_id: user.id,
    type: 'coach_feedback',
    title: 'Message de votre coach',
    body: body.data.body.slice(0, 100),
    payload: {
      feedback_id: (feedback as any).id,
      entity_type: body.data.entity_type,
      entity_id: body.data.entity_id,
      entity_label: body.data.entity_label ?? null,
    },
  })

  return NextResponse.json({ ...(feedback as any), reactions: [] }, { status: 201 })
}
```

- [ ] **Step 2: Create the coach reactions route**

```typescript
// app/api/clients/[clientId]/feedback/[feedbackId]/reactions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const reactionSchema = z.object({
  emoji: z.enum(['👍','💪','✅','🔥','❓']),
  reply_text: z.string().max(500).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string; feedbackId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()

  // Ownership check: feedback must belong to this coach
  const { data: feedback } = await db
    .from('coach_feedback')
    .select('id, client_id')
    .eq('id', params.feedbackId)
    .eq('coach_id', user.id)
    .single()
  if (!feedback) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = reactionSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const { data: reaction, error } = await db
    .from('coach_feedback_reactions')
    .insert({
      feedback_id: params.feedbackId,
      author_type: 'coach',
      author_id: user.id,
      emoji: body.data.emoji,
      reply_text: body.data.reply_text ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(reaction, { status: 201 })
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "clients/\[clientId\]/feedback" | grep -v node_modules
```

Expected: no output

- [ ] **Step 4: Update CHANGELOG and commit**

Add to `CHANGELOG.md` under today's date:
```
FEATURE: GET/POST /api/clients/[clientId]/feedback — coach feedback list + create with client notification
FEATURE: POST /api/clients/[clientId]/feedback/[feedbackId]/reactions — coach reaction on client feedback
```

```bash
git add "app/api/clients/[clientId]/feedback/route.ts" \
        "app/api/clients/[clientId]/feedback/[feedbackId]/reactions/route.ts" \
        CHANGELOG.md
git commit -m "feat(api): coach feedback routes — list, create, reactions"
```

---

## Task 4: Client API Routes

**Files:**
- Create: `app/api/client/feedback/[entityType]/[entityId]/route.ts`
- Create: `app/api/client/feedback/[feedbackId]/reactions/route.ts`

- [ ] **Step 1: Create the client entity feedback route**

```typescript
// app/api/client/feedback/[entityType]/[entityId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { entityType: string; entityId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()
  const client = await resolveClientFromUser(user.id, user.email, db, 'id')
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await db
    .from('coach_feedback')
    .select(`*, coach_feedback_reactions(*)`)
    .eq('client_id', client.id)
    .eq('entity_type', params.entityType)
    .eq('entity_id', params.entityId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    (data ?? []).map((f: any) => ({
      ...f,
      reactions: f.coach_feedback_reactions ?? [],
    }))
  )
}
```

- [ ] **Step 2: Create the client reactions route**

```typescript
// app/api/client/feedback/[feedbackId]/reactions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { z } from 'zod'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const reactionSchema = z.object({
  emoji: z.enum(['👍','💪','✅','🔥','❓']),
  reply_text: z.string().max(500).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { feedbackId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()
  const client = await resolveClientFromUser(user.id, user.email, db, 'id')
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify feedback belongs to this client
  const { data: feedback } = await db
    .from('coach_feedback')
    .select('id, coach_id')
    .eq('id', params.feedbackId)
    .eq('client_id', client.id)
    .single()
  if (!feedback) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = reactionSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const { data: reaction, error } = await db
    .from('coach_feedback_reactions')
    .insert({
      feedback_id: params.feedbackId,
      author_type: 'client',
      author_id: user.id,
      emoji: body.data.emoji,
      reply_text: body.data.reply_text ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get client first name for coach notification
  const { data: clientRow } = await db
    .from('coach_clients')
    .select('first_name')
    .eq('id', client.id)
    .single()
  const firstName = (clientRow as any)?.first_name ?? 'Client'

  // Notify coach
  await db.from('coach_client_notifications').insert({
    client_id: client.id,
    coach_id: (feedback as any).coach_id,
    type: 'client_reaction',
    title: `${firstName} a répondu`,
    body: `${body.data.emoji}${body.data.reply_text ? ` — ${body.data.reply_text.slice(0, 80)}` : ''}`,
    payload: { feedback_id: params.feedbackId, emoji: body.data.emoji },
  })

  return NextResponse.json(reaction, { status: 201 })
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "api/client/feedback" | grep -v node_modules
```

Expected: no output

- [ ] **Step 4: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
FEATURE: GET /api/client/feedback/[entityType]/[entityId] — client reads coach annotations for an entity
FEATURE: POST /api/client/feedback/[feedbackId]/reactions — client reacts with emoji + optional reply, notifies coach
```

```bash
git add "app/api/client/feedback/[entityType]/[entityId]/route.ts" \
        "app/api/client/feedback/[feedbackId]/reactions/route.ts" \
        CHANGELOG.md
git commit -m "feat(api): client feedback routes — entity annotations, react + notify coach"
```

---

## Task 5: FeedbackComposer (Coach)

**Files:**
- Create: `components/coach/FeedbackComposer.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/coach/FeedbackComposer.tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Loader2 } from 'lucide-react'
import type { FeedbackEntityType } from '@/lib/feedback/types'

interface FeedbackComposerProps {
  open: boolean
  clientId: string
  entityType: FeedbackEntityType
  entityId: string
  entityLabel: string
  onClose: () => void
  onSent: () => void
}

export default function FeedbackComposer({
  open,
  clientId,
  entityType,
  entityId,
  entityLabel,
  onClose,
  onSent,
}: FeedbackComposerProps) {
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!body.trim()) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, entity_label: entityLabel, body: body.trim() }),
      })
      if (!res.ok) throw new Error('Erreur réseau')
      setBody('')
      onSent()
      onClose()
    } catch {
      setError('Envoi échoué. Réessaie.')
    } finally {
      setSending(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[65] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[70] bg-[#181818] rounded-t-2xl border-t border-white/[0.06] p-5"
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { type: 'spring', stiffness: 350, damping: 30 } }}
            exit={{ y: '100%', transition: { duration: 0.18, ease: 'easeIn' } }}
          >
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.12]" />

            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[13px] font-semibold text-white">Commentaire</p>
                <p className="text-[11px] text-white/40 mt-0.5 truncate max-w-[260px]">{entityLabel}</p>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/[0.04] text-white/40 hover:text-white/70 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Écris ton retour..."
              rows={3}
              autoFocus
              className="w-full bg-white/[0.04] border border-[0.3px] border-white/[0.06] rounded-xl px-4 py-3 text-[13px] text-white placeholder:text-white/20 outline-none focus:ring-1 focus:ring-[#1f8a65]/40 resize-none transition-colors leading-relaxed mb-3"
            />

            {error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}

            <button
              onClick={handleSend}
              disabled={!body.trim() || sending}
              className="w-full h-11 flex items-center justify-center gap-2 bg-[#1f8a65] text-white text-[12px] font-bold uppercase tracking-[0.1em] rounded-xl disabled:opacity-50 hover:bg-[#217356] active:scale-[0.98] transition-all"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {sending ? 'Envoi…' : 'Envoyer'}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "FeedbackComposer" | grep -v node_modules
```

Expected: no output

- [ ] **Step 3: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
FEATURE: components/coach/FeedbackComposer.tsx — bottom sheet composer for coach annotations, DS v2.0
```

```bash
git add components/coach/FeedbackComposer.tsx CHANGELOG.md
git commit -m "feat(coach): FeedbackComposer bottom sheet — annotation composer DS v2.0"
```

---

## Task 6: Coach Hub Page

**Files:**
- Create: `app/coach/clients/[clientId]/feedback/page.tsx`

- [ ] **Step 1: Create the hub page**

```typescript
// app/coach/clients/[clientId]/feedback/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useClient } from '@/lib/client-context'
import { useClientTopBar } from '@/components/clients/useClientTopBar'
import { MessageSquare } from 'lucide-react'
import type { CoachFeedback, FeedbackEntityType } from '@/lib/feedback/types'
import { ENTITY_TYPE_LABEL } from '@/lib/feedback/types'
import { Skeleton } from '@/components/ui/skeleton'

const FILTERS: { label: string; value: FeedbackEntityType | 'all' }[] = [
  { label: 'Tout', value: 'all' },
  { label: '🏋️ Sessions', value: 'session' },
  { label: '💪 Exercices', value: 'exercise' },
  { label: '📊 Check-ins', value: 'checkin' },
  { label: '📷 Morpho', value: 'morpho' },
  { label: '📋 Bilans', value: 'bilan' },
]

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `il y a ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${Math.floor(hours / 24)}j`
}

export default function ClientFeedbackPage() {
  const { clientId } = useParams() as { clientId: string }
  const client = useClient()
  useClientTopBar('Feedback')

  const [feedbacks, setFeedbacks] = useState<CoachFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FeedbackEntityType | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = filter === 'all'
        ? `/api/clients/${clientId}/feedback`
        : `/api/clients/${clientId}/feedback?entity_type=${filter}`
      const res = await fetch(url)
      if (res.ok) setFeedbacks(await res.json())
    } finally {
      setLoading(false)
    }
  }, [clientId, filter])

  useEffect(() => { load() }, [load])

  return (
    <div className="px-4 pb-24 space-y-4 pt-4">
      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              filter === f.value
                ? 'bg-[#1f8a65]/10 text-[#1f8a65]'
                : 'bg-white/[0.03] text-white/40 hover:text-white/60'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ) : feedbacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/[0.03] flex items-center justify-center mb-3">
            <MessageSquare size={20} className="text-white/20" />
          </div>
          <p className="text-[13px] text-white/40">Aucun commentaire</p>
          <p className="text-[11px] text-white/25 mt-1">Ajoute des retours depuis les fiches séance, check-in ou morpho</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map(fb => (
            <div key={fb.id} className="bg-white/[0.02] border-[0.3px] border-white/[0.06] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-white/30">
                  {ENTITY_TYPE_LABEL[fb.entity_type]}{fb.entity_label ? ` — ${fb.entity_label}` : ''}
                </span>
                <span className="text-[10px] text-white/20">{timeAgo(fb.created_at)}</span>
              </div>
              <p className="text-[13px] text-white/80 leading-relaxed">{fb.body}</p>
              {fb.reactions.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-white/[0.04] pt-3">
                  {fb.reactions.map(r => (
                    <div key={r.id} className="flex items-start gap-2">
                      <span className="text-[14px]">{r.emoji}</span>
                      <div>
                        <span className="text-[10px] text-white/30">{r.author_type === 'client' ? client?.firstName ?? 'Client' : 'Coach'}</span>
                        {r.reply_text && <p className="text-[12px] text-white/60 mt-0.5">{r.reply_text}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "clients/\[clientId\]/feedback/page" | grep -v node_modules
```

Expected: no output

- [ ] **Step 3: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
FEATURE: app/coach/clients/[clientId]/feedback/page.tsx — coach hub: all annotations with filter pills, reaction display, DS v2.0
```

```bash
git add "app/coach/clients/[clientId]/feedback/page.tsx" CHANGELOG.md
git commit -m "feat(coach): feedback hub page — all annotations, entity filters, reaction display"
```

---

## Task 7: FeedbackThread (Client)

**Files:**
- Create: `components/client/smart/FeedbackThread.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/client/smart/FeedbackThread.tsx
'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import type { CoachFeedback, FeedbackEmoji } from '@/lib/feedback/types'
import { FEEDBACK_EMOJIS } from '@/lib/feedback/types'

interface FeedbackThreadProps {
  entityType: string
  entityId: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `il y a ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${Math.floor(hours / 24)}j`
}

function FeedbackCard({ feedback, onReacted }: { feedback: CoachFeedback; onReacted: () => void }) {
  const [selectedEmoji, setSelectedEmoji] = useState<FeedbackEmoji | null>(
    () => {
      const clientReaction = feedback.reactions.find(r => r.author_type === 'client')
      return clientReaction?.emoji ?? null
    }
  )
  const [replyText, setReplyText] = useState('')
  const [showReply, setShowReply] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleReact(emoji: FeedbackEmoji) {
    if (sending) return
    setSelectedEmoji(emoji)
    setSending(true)
    try {
      await fetch(`/api/client/feedback/${feedback.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, reply_text: replyText.trim() || undefined }),
      })
      setReplyText('')
      setShowReply(false)
      onReacted()
    } finally {
      setSending(false)
    }
  }

  async function handleSendReply() {
    if (!replyText.trim() || sending) return
    setSending(true)
    try {
      await fetch(`/api/client/feedback/${feedback.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: selectedEmoji ?? '👍', reply_text: replyText.trim() }),
      })
      setReplyText('')
      setShowReply(false)
      onReacted()
    } finally {
      setSending(false)
    }
  }

  const coachReactions = feedback.reactions.filter(r => r.author_type === 'coach')

  return (
    <div className="bg-[#161616] border border-white/[0.08] rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#ffe01e]/10 flex items-center justify-center">
            <MessageSquare size={13} className="text-[#ffe01e]" />
          </div>
          <span className="text-[12px] font-semibold text-white">Coach</span>
        </div>
        <span className="text-[10px] text-white/30">{timeAgo(feedback.created_at)}</span>
      </div>

      {/* Body */}
      <p className="text-[13px] text-white/80 leading-relaxed">{feedback.body}</p>

      {/* Emoji reactions */}
      <div className="flex gap-2 flex-wrap">
        {FEEDBACK_EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => handleReact(emoji)}
            disabled={sending}
            className={`h-9 w-9 flex items-center justify-center rounded-xl text-[18px] transition-all active:scale-95 ${
              selectedEmoji === emoji
                ? 'bg-[#ffe01e]/[0.12] border border-[#ffe01e]/30'
                : 'bg-white/[0.06] border border-transparent hover:bg-white/[0.10]'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Reply toggle */}
      {!showReply && (
        <button
          onClick={() => setShowReply(true)}
          className="text-[11px] text-white/30 hover:text-white/50 transition-colors"
        >
          Répondre…
        </button>
      )}

      {/* Reply input */}
      {showReply && (
        <div className="flex gap-2">
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Ta réponse..."
            rows={2}
            className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-white/20 outline-none focus:ring-1 focus:ring-[#ffe01e]/30 resize-none transition-colors"
          />
          <button
            onClick={handleSendReply}
            disabled={!replyText.trim() || sending}
            className="h-9 w-9 flex items-center justify-center bg-[#ffe01e] text-[#0d0d0d] rounded-xl disabled:opacity-50 active:scale-95 transition-all shrink-0 self-end"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      )}

      {/* Coach replies */}
      {coachReactions.filter(r => r.reply_text).map(r => (
        <div key={r.id} className="bg-white/[0.03] rounded-xl p-3">
          <p className="text-[10px] text-white/30 mb-1">Coach · {timeAgo(r.created_at)}</p>
          <p className="text-[12px] text-white/60">{r.reply_text}</p>
        </div>
      ))}
    </div>
  )
}

export default function FeedbackThread({ entityType, entityId }: FeedbackThreadProps) {
  const [feedbacks, setFeedbacks] = useState<CoachFeedback[]>([])

  const load = () => {
    fetch(`/api/client/feedback/${entityType}/${entityId}`)
      .then(r => r.ok ? r.json() : [])
      .then(setFeedbacks)
      .catch(() => {})
  }

  useEffect(() => { load() }, [entityType, entityId])

  if (feedbacks.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30 px-1">
        Message coach
      </p>
      {feedbacks.map(fb => (
        <FeedbackCard key={fb.id} feedback={fb} onReacted={load} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "FeedbackThread" | grep -v node_modules
```

Expected: no output

- [ ] **Step 3: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
FEATURE: components/client/smart/FeedbackThread.tsx — coach annotation display + emoji reactions + reply textarea, DS v3.0
```

```bash
git add components/client/smart/FeedbackThread.tsx CHANGELOG.md
git commit -m "feat(client): FeedbackThread — coach annotations, emoji reaction, reply, DS v3.0"
```

---

## Task 8: Wire FeedbackThread Into Client Pages

**Files:**
- Modify: `app/client/programme/recap/[sessionLogId]/page.tsx`
- Modify: `app/client/bilans/[submissionId]/page.tsx`

- [ ] **Step 1: Add FeedbackThread to session recap page**

In `app/client/programme/recap/[sessionLogId]/page.tsx`:

1. Find where `sessionLog.id` is available (it's fetched server-side)
2. Since FeedbackThread is `'use client'` and the recap page is a Server Component, import it as a Client Component — this works natively in Next.js App Router
3. Add the import at the top:

```typescript
import FeedbackThread from '@/components/client/smart/FeedbackThread'
```

4. Find the last `</div>` before the closing `</div>` of the main section (around line 255-261) and insert before `</main>`:

```tsx
{/* Coach feedback thread */}
<div className="px-4 pb-6">
  <FeedbackThread entityType="session" entityId={sessionLog.id} />
</div>
```

Read the full file first to find the exact JSX insertion point — look for `</main>` and insert the FeedbackThread block just before it, inside the padding container.

- [ ] **Step 2: Add FeedbackThread to bilans detail page**

In `app/client/bilans/[submissionId]/page.tsx`:

1. Add import:
```typescript
import FeedbackThread from '@/components/client/smart/FeedbackThread'
```

2. Find the submission id — it's available as `params.submissionId`
3. Find the last content section before closing and add:

```tsx
{/* Coach feedback thread */}
<div className="px-4 pb-6">
  <FeedbackThread entityType="bilan" entityId={params.submissionId} />
</div>
```

Read the full file first to find the exact insertion point.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "recap/\[sessionLogId\]|bilans/\[submissionId\]" | grep -v node_modules
```

Expected: no output

- [ ] **Step 4: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
FEATURE: session recap page — FeedbackThread embedded (entity_type='session')
FEATURE: bilans detail page — FeedbackThread embedded (entity_type='bilan')
```

```bash
git add "app/client/programme/recap/[sessionLogId]/page.tsx" \
        "app/client/bilans/[submissionId]/page.tsx" \
        CHANGELOG.md
git commit -m "feat(client): embed FeedbackThread in session recap + bilan detail pages"
```

---

## Task 9: MorphoAnalysisSection — Inline FeedbackComposer

**Files:**
- Modify: `components/clients/MorphoAnalysisSection.tsx`

- [ ] **Step 1: Read the current MorphoAnalysisSection**

Read `components/clients/MorphoAnalysisSection.tsx` fully before editing. You need to understand:
- Where the list of analyses is rendered
- Where `analysis.id` is available per item
- The existing button pattern

- [ ] **Step 2: Add FeedbackComposer to each morpho analysis**

In `components/clients/MorphoAnalysisSection.tsx`:

1. Add imports at the top:
```typescript
import { useState } from 'react'  // if not already imported
import { MessageSquare } from 'lucide-react'  // add to existing lucide import
import FeedbackComposer from '@/components/coach/FeedbackComposer'
```

2. Add state for the composer:
```typescript
const [composerTarget, setComposerTarget] = useState<{ id: string; label: string } | null>(null)
```

3. On each morpho analysis card, find where the existing "Analyser" button is and add alongside it:
```tsx
<button
  onClick={() => setComposerTarget({
    id: analysis.id,
    label: `Morpho du ${new Date(analysis.analysis_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
  })}
  className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.04] text-white/40 hover:text-white/70 transition-colors"
  title="Commenter cette analyse"
>
  <MessageSquare size={13} />
</button>
```

4. At the end of the component JSX (before final closing tag), add:
```tsx
{composerTarget && (
  <FeedbackComposer
    open={!!composerTarget}
    clientId={clientId}
    entityType="morpho"
    entityId={composerTarget.id}
    entityLabel={composerTarget.label}
    onClose={() => setComposerTarget(null)}
    onSent={() => setComposerTarget(null)}
  />
)}
```

Note: `clientId` must be available as a prop. Check the component signature — if it's not a prop, read how the component gets the client ID and pass it through. If the component uses `useClient()`, extract `client.id` from there.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "MorphoAnalysisSection" | grep -v node_modules
```

Expected: no output

- [ ] **Step 4: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
FEATURE: MorphoAnalysisSection — inline FeedbackComposer button per morpho analysis
```

```bash
git add components/clients/MorphoAnalysisSection.tsx CHANGELOG.md
git commit -m "feat(coach): FeedbackComposer inline on morpho analysis cards"
```

---

## Task 10: NotificationsBar — New Types + Final Check

**Files:**
- Modify: `components/client/smart/NotificationsBar.tsx`

- [ ] **Step 1: Add coach_feedback type**

In `components/client/smart/NotificationsBar.tsx`, the `Notification.type` union and `TYPE_ICON` map already had `tdee_updated` added in a previous session. Add `coach_feedback`:

Find the type union:
```typescript
type: "coach_note" | "bilan_pending" | "program_assigned" | "system_reminder" | "tdee_updated";
```

Change to:
```typescript
type: "coach_note" | "bilan_pending" | "program_assigned" | "system_reminder" | "tdee_updated" | "coach_feedback";
```

Find `TYPE_ICON` and add:
```typescript
coach_feedback: MessageSquare,
```

(`MessageSquare` is already imported from lucide-react.)

Find `handleClick` and add navigation logic:
```typescript
} else if (n.type === "coach_feedback") {
  const payload = n.payload as any
  if (!payload?.entity_type || !payload?.entity_id) {
    router.push("/client")
    return
  }
  switch (payload.entity_type) {
    case 'session':
      router.push(`/client/programme/recap/${payload.entity_id}`)
      break
    case 'bilan':
      router.push(`/client/bilans/${payload.entity_id}`)
      break
    case 'checkin':
      router.push('/client/checkin')
      break
    case 'morpho':
      router.push('/client/profil')
      break
    default:
      router.push('/client')
  }
}
```

- [ ] **Step 2: TypeScript check — full clean run**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v "stripe\|BodyFat\|webhook\|program-templates\|CarbCycling\|payments/route\|morpho/photos\|MacroCalculator\|OneRMCalculator\|genesis\|ClientPageHeader" | head -20
```

Expected: no new errors from this feature

- [ ] **Step 3: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
FEATURE: NotificationsBar — coach_feedback type with MessageSquare icon, navigates to entity (session recap, bilan, checkin, morpho, profil)
CHORE: coach-client feedback — final TS check, 0 new errors
```

```bash
git add components/client/smart/NotificationsBar.tsx CHANGELOG.md
git commit -m "feat(client): NotificationsBar handles coach_feedback type — entity navigation"
```

- [ ] **Step 4: Push**

```bash
git push origin main
```

---

## Manual Actions Required

After Task 1:
1. Apply `supabase/migrations/20260519_coach_feedback.sql` via **Supabase Dashboard → SQL Editor**

---

## Verification Checklist

- [ ] `coach_feedback` and `coach_feedback_reactions` tables exist with correct RLS
- [ ] `coach_client_notifications.type` CHECK constraint includes `coach_feedback` and `client_reaction`
- [ ] `POST /api/clients/[clientId]/feedback` creates feedback + notification, returns 201
- [ ] `GET /api/clients/[clientId]/feedback?entity_type=session` filters correctly
- [ ] `POST /api/client/feedback/[feedbackId]/reactions` inserts reaction + notifies coach
- [ ] `GET /api/client/feedback/session/[sessionLogId]` returns feedback for that session
- [ ] FeedbackComposer opens, submits, closes on success
- [ ] Coach hub `/coach/clients/[clientId]/feedback` shows all annotations with filter pills
- [ ] FeedbackThread renders nothing when 0 feedbacks for entity
- [ ] FeedbackThread renders feedback card with emoji buttons and reply textarea
- [ ] Session recap page shows FeedbackThread at bottom
- [ ] Bilans detail page shows FeedbackThread at bottom
- [ ] MorphoAnalysisSection shows MessageSquare button per analysis
- [ ] NotificationsBar `coach_feedback` tap navigates to correct entity page
- [ ] `npx tsc --noEmit` — 0 new errors
