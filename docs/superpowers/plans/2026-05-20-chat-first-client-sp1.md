# Chat-First Client App — Sub-projet #1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le Smart Agenda home par une page Chat conversationnelle, refactoriser BottomNav en 4 onglets, créer la page Métriques, et poser l'infra DB pour les messages.

**Architecture:** Chat page full-screen avec today-strip compacte, conversation scrollable, input text+mic. Tables `chat_messages` + `chat_sessions` avec archivage 3 jours par Inngest cron. Métriques = nouvelle page réutilisant les composants BodyData existants.

**Tech Stack:** Next.js App Router, Supabase (RLS), Inngest cron, GPT-4o mini (réutilisation ai-coach), DS v3.0 (`#0d0d0d`, `#ffe01e`, Barlow), Framer Motion, VoiceLogSheet (réutilisation)

---

## File Map

**Créer :**
- `supabase/migrations/20260520_chat_messages.sql`
- `app/api/client/chat/messages/route.ts`
- `app/api/client/chat/archives/route.ts`
- `app/api/client/chat/today-strip/route.ts`
- `components/client/ChatBubble.tsx`
- `components/client/ChatConversation.tsx`
- `components/client/ChatTodayStrip.tsx`
- `components/client/ChatInputBar.tsx`
- `components/client/ChatPage.tsx`
- `app/client/metrics/page.tsx`
- `components/client/MetricsPage.tsx`
- `lib/inngest/functions/chat-archive.ts`

**Modifier :**
- `lib/i18n/clientTranslations.ts` — ajouter `nav.chat`, `nav.metrics`
- `components/client/BottomNav.tsx` — 4 tabs, supprimer FAB
- `components/client/ConditionalClientShell.tsx` — supprimer CoachAIButton
- `app/client/page.tsx` — remplacer Smart Agenda par ChatPage
- `app/api/inngest/route.ts` — enregistrer chatArchiveFunction

**Supprimer :**
- `components/client/CoachAIButton.tsx`
- `components/client/CoachAIChatSheet.tsx`
- `app/client/profil/page.tsx`
- `components/client/profile/ProfilAccordion.tsx`

---

## Task 1 : DB Migration — `chat_messages` + `chat_sessions`

**Files:**
- Create: `supabase/migrations/20260520_chat_messages.sql`

- [ ] **Step 1 : Créer le fichier de migration**

```sql
-- supabase/migrations/20260520_chat_messages.sql

-- Messages du chat conversationnel client
CREATE TABLE IF NOT EXISTS chat_messages (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('user', 'assistant')),
  content       text NOT NULL,
  message_type  text NOT NULL DEFAULT 'text'
                CHECK (message_type IN ('text', 'quick_reply', 'slider', 'voice')),
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  archived_at   timestamptz
);

CREATE INDEX IF NOT EXISTS chat_messages_client_created_idx
  ON chat_messages (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_client_archived_idx
  ON chat_messages (client_id, archived_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Client : accès à ses propres messages
CREATE POLICY "chat_messages_client_own" ON chat_messages
  FOR ALL USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

-- Coach : lecture seule
CREATE POLICY "chat_messages_coach_read" ON chat_messages
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );

-- Sessions de chat (morning / evening / freeform)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  date          date NOT NULL,
  flow_type     text NOT NULL CHECK (flow_type IN ('morning', 'evening', 'freeform')),
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, date, flow_type)
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_sessions_client_own" ON chat_sessions
  FOR ALL USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "chat_sessions_coach_read" ON chat_sessions
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );
```

- [ ] **Step 2 : Appliquer via Supabase Dashboard**

Ouvrir **Supabase Dashboard → SQL Editor**, coller le contenu du fichier, exécuter.
Vérifier que les deux tables apparaissent dans **Table Editor**.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/20260520_chat_messages.sql
git commit -m "schema: add chat_messages and chat_sessions tables with RLS"
```

---

## Task 2 : i18n — Ajouter clés `nav.chat` et `nav.metrics`

**Files:**
- Modify: `lib/i18n/clientTranslations.ts`

- [ ] **Step 1 : Ajouter les clés dans les 3 langues**

Ouvrir `lib/i18n/clientTranslations.ts`. Trouver le bloc `nav:` dans chaque langue et ajouter :

```typescript
// Dans la section FR (et EN + ES en dessous)
"nav.chat": "Chat",
"nav.metrics": "Métriques",

// EN
"nav.chat": "Chat",
"nav.metrics": "Metrics",

// ES
"nav.chat": "Chat",
"nav.metrics": "Métricas",
```

Ajouter aussi `"nav.chat"` et `"nav.metrics"` au type `ClientDictKey` (union de strings en haut du fichier, ou inféré automatiquement si le type est `keyof typeof translations.fr`).

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "error|clientTranslations"
```

Expected: aucune erreur liée à `clientTranslations`.

- [ ] **Step 3 : Commit**

```bash
git add lib/i18n/clientTranslations.ts
git commit -m "feat(i18n): add nav.chat and nav.metrics translation keys"
```

---

## Task 3 : API `GET /api/client/chat/today-strip`

**Files:**
- Create: `app/api/client/chat/today-strip/route.ts`

- [ ] **Step 1 : Créer la route**

```typescript
// app/api/client/chat/today-strip/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  const cc = await resolveClientFromUser(user.id, user.email, db, 'id')
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const today = computePhysiologicalDate(new Date())
  const todayDow = new Date().getDay() // 0=Sun … 6=Sat

  const nextDay = new Date(today + 'T00:00:00')
  nextDay.setDate(nextDay.getDate() + 1)
  const nextDayStr = nextDay.toISOString().split('T')[0]

  const [
    { data: sessions },
    { data: composerMeals },
    { data: legacyMeals },
    { data: waterRows },
    { data: chatSessions },
    { data: protocol },
  ] = await Promise.all([
    // Séances du jour selon day_of_week
    db.from('program_sessions')
      .select('id, name, programs!inner(status, client_id)')
      .eq('programs.client_id', cc.id)
      .eq('programs.status', 'active')
      .eq('day_of_week', todayDow),

    // Calories depuis Nutrition Composer
    db.from('nutrition_meals')
      .select('total_calories')
      .eq('client_id', cc.id)
      .eq('physiological_date', today),

    // Calories legacy (meal_logs)
    db.from('meal_logs')
      .select('estimated_macros')
      .eq('client_id', cc.id)
      .gte('logged_at', `${today}T04:00:00.000Z`)
      .lt('logged_at', `${nextDayStr}T04:00:00.000Z`)
      .eq('ai_status', 'done'),

    // Eau du jour
    db.from('client_water_logs')
      .select('amount_ml')
      .eq('client_id', cc.id)
      .eq('date', today),

    // Check-in status
    db.from('chat_sessions')
      .select('flow_type, completed_at')
      .eq('client_id', cc.id)
      .eq('date', today),

    // Protocole nutritionnel actif (pour cible calories)
    db.from('nutrition_protocols')
      .select('nutrition_protocol_days(calories)')
      .eq('client_id', cc.id)
      .eq('status', 'shared')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const caloriesLogged =
    (composerMeals ?? []).reduce((s: number, m: any) => s + (Number(m.total_calories) || 0), 0) +
    (legacyMeals ?? []).reduce((s: number, m: any) => {
      const em = m.estimated_macros as Record<string, number> | null
      return s + (em?.calories_kcal ?? 0)
    }, 0)

  const waterLogged = (waterRows ?? []).reduce((s: number, r: any) => s + (Number(r.amount_ml) || 0), 0)

  const protocolDays = (protocol as any)?.nutrition_protocol_days ?? []
  const calorieTarget = protocolDays.length > 0
    ? Number(protocolDays.sort((a: any, b: any) => a.position - b.position)[0].calories ?? 2000)
    : 2000

  return NextResponse.json({
    sessions: (sessions ?? []).map((s: any) => ({ id: s.id, name: s.name })),
    calories: { logged: Math.round(caloriesLogged), target: calorieTarget },
    water: { logged: waterLogged, target: 2000 },
    checkin: {
      morning: (chatSessions ?? []).some((s: any) => s.flow_type === 'morning' && s.completed_at),
      evening: (chatSessions ?? []).some((s: any) => s.flow_type === 'evening' && s.completed_at),
    },
  })
}
```

- [ ] **Step 2 : Tester manuellement**

Démarrer le serveur : `npm run dev`
Ouvrir : `http://localhost:3000/api/client/chat/today-strip` (connecté en tant que client)
Expected: JSON avec `sessions`, `calories`, `water`, `checkin`.

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "today-strip"
```

Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add app/api/client/chat/today-strip/route.ts
git commit -m "feat(api): add GET /api/client/chat/today-strip"
```

---

## Task 4 : API `GET + POST /api/client/chat/messages`

**Files:**
- Create: `app/api/client/chat/messages/route.ts`

- [ ] **Step 1 : Créer la route GET + POST**

```typescript
// app/api/client/chat/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { buildSystemPrompt } from '@/lib/client/ai-coach/buildSystemPrompt'
import OpenAI from 'openai'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const DAILY_LIMIT = 20

// GET — messages actifs (3 derniers jours, archived_at IS NULL)
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  const cc = await resolveClientFromUser(user.id, user.email, db, 'id')
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { data: messages } = await db
    .from('chat_messages')
    .select('id, role, content, message_type, metadata, created_at')
    .eq('client_id', cc.id)
    .is('archived_at', null)
    .order('created_at', { ascending: true })

  return NextResponse.json({ messages: messages ?? [] })
}

// POST — envoie message user → LLM → sauvegarde les deux
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = service()
  const cc = await resolveClientFromUser(user.id, user.email, db, 'id, first_name')
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const body = await req.json()
  const content: string = String(body.content ?? '').trim().slice(0, 500)
  const message_type: string = body.message_type ?? 'text'
  if (!content) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  // Rate limit — table ai_coach_daily_usage existante
  const today = new Date().toISOString().split('T')[0]
  const { data: usage } = await db
    .from('ai_coach_daily_usage')
    .select('message_count')
    .eq('client_id', cc.id)
    .eq('date', today)
    .single()

  const count = usage?.message_count ?? 0
  if (count >= DAILY_LIMIT) {
    return NextResponse.json({ error: 'Daily limit reached', remaining: 0 }, { status: 429 })
  }

  // Sauvegarde message utilisateur
  const { data: userMsg } = await db
    .from('chat_messages')
    .insert({ client_id: cc.id, role: 'user', content, message_type })
    .select('id, role, content, message_type, created_at')
    .single()

  // Historique récent (20 derniers messages) pour le contexte LLM
  const { data: history } = await db
    .from('chat_messages')
    .select('role, content')
    .eq('client_id', cc.id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const systemPrompt = await buildSystemPrompt(cc.id)

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 300,
    messages: [
      { role: 'system', content: systemPrompt },
      ...(history ?? []).reverse().map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ],
  })

  const botContent = completion.choices[0]?.message?.content ?? ''

  // Sauvegarde réponse bot
  const { data: botMsg } = await db
    .from('chat_messages')
    .insert({ client_id: cc.id, role: 'assistant', content: botContent, message_type: 'text' })
    .select('id, role, content, message_type, created_at')
    .single()

  // Upsert usage
  await db.from('ai_coach_daily_usage').upsert(
    { client_id: cc.id, date: today, message_count: count + 1 },
    { onConflict: 'client_id,date' }
  )

  return NextResponse.json({
    userMessage: userMsg,
    botMessage: botMsg,
    remaining: DAILY_LIMIT - count - 1,
  })
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "chat/messages"
```

Expected: aucune erreur.

- [ ] **Step 3 : Tester GET manuellement**

`GET http://localhost:3000/api/client/chat/messages` (connecté)
Expected: `{ messages: [] }` (table vide pour l'instant).

- [ ] **Step 4 : Commit**

```bash
git add app/api/client/chat/messages/route.ts
git commit -m "feat(api): add GET+POST /api/client/chat/messages with LLM and rate limit"
```

---

## Task 5 : API `GET /api/client/chat/archives`

**Files:**
- Create: `app/api/client/chat/archives/route.ts`

- [ ] **Step 1 : Créer la route**

```typescript
// app/api/client/chat/archives/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET /api/client/chat/archives?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date param required (YYYY-MM-DD)' }, { status: 400 })
  }

  const db = service()
  const cc = await resolveClientFromUser(user.id, user.email, db, 'id')
  if (!cc) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  // Récupère les messages archivés pour la date donnée
  const { data: messages } = await db
    .from('chat_messages')
    .select('id, role, content, message_type, metadata, created_at, archived_at')
    .eq('client_id', cc.id)
    .not('archived_at', 'is', null)
    .gte('created_at', `${date}T00:00:00.000Z`)
    .lt('created_at', `${date}T23:59:59.999Z`)
    .order('created_at', { ascending: true })

  return NextResponse.json({ messages: messages ?? [], date })
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "archives"
```

Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add app/api/client/chat/archives/route.ts
git commit -m "feat(api): add GET /api/client/chat/archives?date=YYYY-MM-DD"
```

---

## Task 6 : Composant `ChatBubble`

**Files:**
- Create: `components/client/ChatBubble.tsx`

- [ ] **Step 1 : Créer le composant**

```typescript
// components/client/ChatBubble.tsx
"use client"

import Image from "next/image"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  message_type: string
  created_at: string
}

interface ChatBubbleProps {
  message: ChatMessage
  coachAvatarUrl?: string | null
}

export default function ChatBubble({ message, coachAvatarUrl }: ChatBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar bot uniquement */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-[#161616] border border-white/[0.08]">
          {coachAvatarUrl ? (
            <Image src={coachAvatarUrl} alt="Coach" width={28} height={28} className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[10px] font-barlow-condensed font-bold text-[#ffe01e] uppercase tracking-wider">
                S
              </span>
            </div>
          )}
        </div>
      )}

      {/* Bulle */}
      <div
        className={`max-w-[75%] px-3.5 py-2.5 text-[13px] leading-[1.5] ${
          isUser
            ? "bg-[#ffe01e] text-[#0d0d0d] font-medium rounded-2xl rounded-tr-sm"
            : "bg-[#161616] text-white/80 border border-white/[0.06] rounded-2xl rounded-tl-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "ChatBubble"
```

Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add components/client/ChatBubble.tsx
git commit -m "feat(client): add ChatBubble component — bot/user bubble DS v3.0"
```

---

## Task 7 : Composant `ChatConversation`

**Files:**
- Create: `components/client/ChatConversation.tsx`

- [ ] **Step 1 : Créer le composant**

```typescript
// components/client/ChatConversation.tsx
"use client"

import { useEffect, useRef } from "react"
import ChatBubble from "./ChatBubble"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  message_type: string
  created_at: string
}

interface ChatConversationProps {
  messages: ChatMessage[]
  coachAvatarUrl?: string | null
  isLoading?: boolean
}

function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (sameDay(d, today)) return "Aujourd'hui"
  if (sameDay(d, yesterday)) return "Hier"
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
}

export default function ChatConversation({ messages, coachAvatarUrl, isLoading }: ChatConversationProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Grouper par date pour les séparateurs
  const items: Array<{ type: "separator"; label: string } | { type: "message"; msg: ChatMessage }> = []
  let lastDate = ""
  for (const msg of messages) {
    const day = msg.created_at.split("T")[0]
    if (day !== lastDate) {
      items.push({ type: "separator", label: formatDateSeparator(msg.created_at) })
      lastDate = day
    }
    items.push({ type: "message", msg })
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
      {items.map((item, i) =>
        item.type === "separator" ? (
          <div key={`sep-${i}`} className="flex items-center gap-2 py-1">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white/30">
              {item.label}
            </span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>
        ) : (
          <ChatBubble key={item.msg.id} message={item.msg} coachAvatarUrl={coachAvatarUrl} />
        )
      )}

      {/* Typing indicator */}
      {isLoading && (
        <div className="flex items-end gap-2">
          <div className="w-7 h-7 rounded-full bg-[#161616] border border-white/[0.08] shrink-0" />
          <div className="bg-[#161616] border border-white/[0.06] rounded-2xl rounded-tl-sm px-3.5 py-3 flex gap-1.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "ChatConversation"
```

Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add components/client/ChatConversation.tsx
git commit -m "feat(client): add ChatConversation — scrollable messages with date separators"
```

---

## Task 8 : Composant `ChatTodayStrip`

**Files:**
- Create: `components/client/ChatTodayStrip.tsx`

- [ ] **Step 1 : Créer le composant**

```typescript
// components/client/ChatTodayStrip.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Barbell, ForkKnife, Drop, CheckCircle, Circle } from "@phosphor-icons/react"

interface TodayStrip {
  sessions: { id: string; name: string }[]
  calories: { logged: number; target: number }
  water: { logged: number; target: number }
  checkin: { morning: boolean; evening: boolean }
}

export default function ChatTodayStrip() {
  const router = useRouter()
  const [data, setData] = useState<TodayStrip | null>(null)

  useEffect(() => {
    fetch("/api/client/chat/today-strip")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data) return <div className="h-14 shrink-0 bg-[#0d0d0d]" />

  const pills: { label: string; icon: React.ReactNode; done?: boolean; onClick: () => void }[] = [
    // Check-in matin
    {
      label: data.checkin.morning ? "Check-in ✓" : "Check-in",
      icon: data.checkin.morning
        ? <CheckCircle size={13} weight="fill" className="text-[#ffe01e]" />
        : <Circle size={13} className="text-white/40" />,
      done: data.checkin.morning,
      onClick: () => {},
    },
    // Séances du jour
    ...data.sessions.map(s => ({
      label: s.name,
      icon: <Barbell size={13} className="text-white/60" />,
      onClick: () => router.push(`/client/programme`),
    })),
    // Calories
    {
      label: `${data.calories.logged} / ${data.calories.target} kcal`,
      icon: <ForkKnife size={13} className="text-white/60" />,
      onClick: () => router.push("/client/nutrition"),
    },
    // Eau
    {
      label: `${Math.round(data.water.logged / 100) / 10}L / ${data.water.target / 1000}L`,
      icon: <Drop size={13} className="text-white/60" />,
      onClick: () => router.push("/client/nutrition"),
    },
  ]

  return (
    <div className="shrink-0 border-b border-white/[0.06] bg-[#0d0d0d]">
      <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none">
        {pills.map((pill, i) => (
          <button
            key={i}
            onClick={pill.onClick}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border shrink-0 transition-opacity active:opacity-70 ${
              pill.done
                ? "bg-[#ffe01e]/10 border-[#ffe01e]/20"
                : "bg-white/[0.04] border-white/[0.06]"
            }`}
          >
            {pill.icon}
            <span className={`text-[11px] font-barlow font-medium ${pill.done ? "text-[#ffe01e]" : "text-white/60"}`}>
              {pill.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "ChatTodayStrip"
```

Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add components/client/ChatTodayStrip.tsx
git commit -m "feat(client): add ChatTodayStrip — compact pills with live session/macro/water data"
```

---

## Task 9 : Composant `ChatInputBar`

**Files:**
- Create: `components/client/ChatInputBar.tsx`

- [ ] **Step 1 : Créer le composant**

```typescript
// components/client/ChatInputBar.tsx
"use client"

import { useState, useRef } from "react"
import { ArrowRight, Microphone } from "@phosphor-icons/react"
import dynamic from "next/dynamic"

const VoiceLogSheet = dynamic(() => import("@/components/client/smart/VoiceLogSheet"), { ssr: false })

interface ChatInputBarProps {
  onSend: (content: string, type?: string) => void
  disabled?: boolean
}

export default function ChatInputBar({ onSend, disabled }: ChatInputBarProps) {
  const [value, setValue] = useState("")
  const [voiceOpen, setVoiceOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed, "text")
    setValue("")
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleVoiceSuccess(transcript: string) {
    setVoiceOpen(false)
    if (transcript.trim()) onSend(transcript.trim(), "voice")
  }

  return (
    <>
      <div className="shrink-0 border-t border-white/[0.06] bg-[#0d0d0d] px-3 py-2.5 flex items-center gap-2">
        {/* Mic */}
        <button
          onClick={() => setVoiceOpen(true)}
          className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/[0.04] text-white/40 active:bg-white/[0.08] transition-colors shrink-0"
        >
          <Microphone size={18} />
        </button>

        {/* Input */}
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Écrire un message..."
          disabled={disabled}
          className="flex-1 min-w-0 bg-[#161616] border border-white/[0.06] rounded-xl px-3.5 py-2 text-[13px] font-barlow text-white placeholder-white/25 outline-none focus:border-white/[0.12] transition-colors disabled:opacity-50"
        />

        {/* Envoyer */}
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="h-9 w-9 flex items-center justify-center rounded-xl bg-[#ffe01e] text-[#0d0d0d] disabled:opacity-30 active:scale-95 transition-all shrink-0"
        >
          <ArrowRight size={16} weight="bold" />
        </button>
      </div>

      {voiceOpen && (
        <VoiceLogSheet
          open={voiceOpen}
          onClose={() => setVoiceOpen(false)}
          onSuccess={() => setVoiceOpen(false)}
          onTranscriptOnly={handleVoiceSuccess}
        />
      )}
    </>
  )
}
```

> **Note :** `VoiceLogSheet` reçoit un nouveau prop optionnel `onTranscriptOnly?: (text: string) => void` qui renvoie le transcript sans logger un repas. Modifier `VoiceLogSheet` pour appeler ce callback si fourni au lieu de logger. Voir step 2.

- [ ] **Step 2 : Modifier `VoiceLogSheet` pour supporter `onTranscriptOnly`**

Ouvrir `components/client/smart/VoiceLogSheet.tsx`.

Trouver l'interface Props et ajouter :
```typescript
onTranscriptOnly?: (transcript: string) => void
```

Dans la fonction qui gère la validation du log (bouton "Enregistrer"), ajouter au début :
```typescript
if (onTranscriptOnly) {
  onTranscriptOnly(transcript)
  return
}
```
Où `transcript` est la transcription brute (string).

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "ChatInputBar|VoiceLogSheet"
```

Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add components/client/ChatInputBar.tsx components/client/smart/VoiceLogSheet.tsx
git commit -m "feat(client): add ChatInputBar with voice support — extends VoiceLogSheet with onTranscriptOnly"
```

---

## Task 10 : Composant `ChatPage` + Mise à jour `/client/page.tsx`

**Files:**
- Create: `components/client/ChatPage.tsx`
- Modify: `app/client/page.tsx`

- [ ] **Step 1 : Créer `ChatPage`**

```typescript
// components/client/ChatPage.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import ChatTodayStrip from "./ChatTodayStrip"
import ChatConversation from "./ChatConversation"
import ChatInputBar from "./ChatInputBar"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  message_type: string
  created_at: string
}

interface ChatPageProps {
  coachAvatarUrl?: string | null
}

export default function ChatPage({ coachAvatarUrl }: ChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [remaining, setRemaining] = useState(20)

  // Charge messages actifs au mount
  useEffect(() => {
    fetch("/api/client/chat/messages")
      .then(r => r.json())
      .then(d => setMessages(d.messages ?? []))
      .catch(() => {})
  }, [])

  const handleSend = useCallback(async (content: string, type = "text") => {
    if (isLoading || remaining <= 0) return

    // Message optimiste
    const tempId = `tmp-${Date.now()}`
    const tempMsg: ChatMessage = {
      id: tempId,
      role: "user",
      content,
      message_type: type,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])
    setIsLoading(true)

    try {
      const res = await fetch("/api/client/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, message_type: type }),
      })
      const data = await res.json()

      if (res.ok) {
        // Remplace le message temporaire par le vrai + ajoute la réponse bot
        setMessages(prev => [
          ...prev.filter(m => m.id !== tempId),
          data.userMessage,
          data.botMessage,
        ])
        setRemaining(data.remaining ?? 0)
      } else {
        // Retire le message temporaire en cas d'erreur
        setMessages(prev => prev.filter(m => m.id !== tempId))
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId))
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, remaining])

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d]">
      <ChatTodayStrip />
      <ChatConversation
        messages={messages}
        coachAvatarUrl={coachAvatarUrl}
        isLoading={isLoading}
      />
      <ChatInputBar onSend={handleSend} disabled={isLoading || remaining <= 0} />
    </div>
  )
}
```

- [ ] **Step 2 : Remplacer `/client/page.tsx`**

Lire d'abord le fichier actuel pour identifier les imports à retirer.

Remplacer tout le contenu par :
```typescript
// app/client/page.tsx
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { resolveClientFromUser } from "@/lib/client/resolve-client"
import ChatPage from "@/components/client/ChatPage"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function ClientHomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let coachAvatarUrl: string | null = null

  if (user) {
    const db = service()
    const cc = await resolveClientFromUser(user.id, user.email, db, 'id, coach_id')
    if (cc?.coach_id) {
      const { data: coach } = await db
        .from('coaches')
        .select('avatar_url')
        .eq('id', cc.coach_id)
        .single()
      coachAvatarUrl = (coach as any)?.avatar_url ?? null
    }
  }

  return <ChatPage coachAvatarUrl={coachAvatarUrl} />
}
```

> **Note :** Le nom exact de la colonne avatar du coach peut être `avatar_url`, `photo_url`, ou similaire. Vérifier dans `prisma/schema.prisma` le modèle `Coach` avant de lancer. Si la colonne n'existe pas encore, passer `coachAvatarUrl={null}` hardcodé et ajouter la colonne plus tard.

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "ChatPage|client/page"
```

Expected: aucune erreur.

- [ ] **Step 4 : Tester visuellement**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/client` → doit afficher la page chat avec today strip, zone de messages vide, input bar.

- [ ] **Step 5 : Commit**

```bash
git add components/client/ChatPage.tsx app/client/page.tsx
git commit -m "feat(client): replace Smart Agenda home with ChatPage — conversational interface"
```

---

## Task 11 : Page Métriques (`/client/metrics`)

**Files:**
- Create: `app/client/metrics/page.tsx`
- Create: `components/client/MetricsPage.tsx`

- [ ] **Step 1 : Créer `MetricsPage`**

```typescript
// components/client/MetricsPage.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Settings, SignOut } from "@phosphor-icons/react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/utils/supabase/client"
import BodyDataSection from "@/components/client/profile/BodyDataSection"

interface MetricsPageProps {
  clientName: string
  clientEmail: string
  avatarInitials: string
  streak: number
}

export default function MetricsPage({ clientName, clientEmail, avatarInitials, streak }: MetricsPageProps) {
  const router = useRouter()
  const supabase = createClient()
  const [settingsOpen, setSettingsOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/client/login")
  }

  return (
    <div className="flex flex-col min-h-full bg-[#0d0d0d]">
      {/* TopBar */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 shrink-0">
        <div>
          <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30">
            MÉTRIQUES
          </p>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.04] text-white/40 active:bg-white/[0.08]"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Hero */}
      <div className="flex items-center gap-3 px-4 pb-4">
        <div className="w-14 h-14 rounded-full bg-[#161616] border border-white/[0.08] flex items-center justify-center shrink-0">
          <span className="text-[18px] font-barlow-condensed font-bold text-[#ffe01e] uppercase">
            {avatarInitials}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-barlow font-semibold text-white truncate">{clientName}</p>
          <p className="text-[11px] text-white/40 truncate">{clientEmail}</p>
        </div>
        {streak > 0 && (
          <div className="px-2.5 py-1 bg-[#ffe01e]/10 border border-[#ffe01e]/20 rounded-full shrink-0">
            <span className="text-[11px] font-barlow-condensed font-bold text-[#ffe01e]">
              🔥 {streak}j
            </span>
          </div>
        )}
      </div>

      {/* Body data (réutilise composant existant) */}
      <div className="flex-1 px-4 pb-24">
        <BodyDataSection />
      </div>

      {/* Settings sheet */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettingsOpen(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#161616] rounded-t-2xl border-t border-white/[0.08] p-4 pb-8"
              initial={{ y: "100%" }}
              animate={{ y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }}
              exit={{ y: "100%", transition: { duration: 0.2 } }}
            >
              <div className="w-10 h-1 bg-white/[0.12] rounded-full mx-auto mb-4" />
              <p className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30 mb-3">
                Paramètres
              </p>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.04] text-white/70 active:bg-white/[0.08] transition-colors"
              >
                <SignOut size={16} />
                <span className="text-[13px] font-barlow">Se déconnecter</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
```

> **Note :** `BodyDataSection` est défini dans `components/client/profile/BodyDataSection.tsx`. Il fetch ses propres données depuis `/api/client/body-data`. Vérifier que ce composant ne dépend pas de props venant de `ProfilAccordion` — s'il nécessite des props, les passer depuis la page Server Component.

- [ ] **Step 2 : Créer la page Server Component**

```typescript
// app/client/metrics/page.tsx
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { resolveClientFromUser } from "@/lib/client/resolve-client"
import MetricsPage from "@/components/client/MetricsPage"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function MetricsRoute() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const db = service()
  const cc = await resolveClientFromUser(
    user.id,
    user.email,
    db,
    'id, first_name, last_name, email, streak_days'
  )

  if (!cc) return null

  const firstName = (cc as any).first_name ?? ""
  const lastName = (cc as any).last_name ?? ""
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?"

  return (
    <MetricsPage
      clientName={`${firstName} ${lastName}`.trim()}
      clientEmail={(cc as any).email ?? user.email ?? ""}
      avatarInitials={initials}
      streak={(cc as any).streak_days ?? 0}
    />
  )
}
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "MetricsPage|client/metrics"
```

Expected: aucune erreur.

- [ ] **Step 4 : Tester visuellement**

Ouvrir `http://localhost:3000/client/metrics` → doit afficher hero, BodyDataSection, settings icon.

- [ ] **Step 5 : Commit**

```bash
git add app/client/metrics/page.tsx components/client/MetricsPage.tsx
git commit -m "feat(client): add /client/metrics page — body data, hero, settings sheet"
```

---

## Task 12 : Refactoriser `BottomNav` — 4 tabs, supprimer FAB

**Files:**
- Modify: `components/client/BottomNav.tsx`

- [ ] **Step 1 : Lire le fichier actuel en entier**

```bash
cat -n components/client/BottomNav.tsx
```

- [ ] **Step 2 : Réécrire BottomNav**

Remplacer le contenu complet par :

```typescript
// components/client/BottomNav.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChatCircle, Barbell, ForkKnife, ChartLine } from "@phosphor-icons/react"
import { useClientT } from "./ClientI18nProvider"
import { useTour } from "./TourContext"
import type { ClientDictKey } from "@/lib/i18n/clientTranslations"

const NAV: { href: string; labelKey: ClientDictKey; Icon: React.ElementType }[] = [
  { href: "/client",          labelKey: "nav.chat",     Icon: ChatCircle },
  { href: "/client/programme", labelKey: "nav.programme", Icon: Barbell },
  { href: "/client/nutrition", labelKey: "nav.nutrition", Icon: ForkKnife },
  { href: "/client/metrics",   labelKey: "nav.metrics",  Icon: ChartLine },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { t } = useClientT()
  const { highlightedNavIndex } = useTour()

  function isActive(href: string) {
    if (href === "/client") return pathname === "/client"
    return pathname.startsWith(href)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d0d] border-t border-white/[0.06] pb-safe">
      <div className="flex items-center justify-around h-[56px] px-2">
        {NAV.map(({ href, labelKey, Icon }, i) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-opacity
                ${highlightedNavIndex === i ? "ring-1 ring-[#ffe01e]/40 rounded-xl" : ""}
                ${active ? "opacity-100" : "opacity-40 active:opacity-70"}`}
            >
              <Icon
                size={22}
                weight={active ? "fill" : "regular"}
                color={active ? "#ffe01e" : "white"}
              />
              <span
                className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.1em]"
                style={{ color: active ? "#ffe01e" : "rgba(255,255,255,0.5)" }}
              >
                {t(labelKey)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "BottomNav"
```

Expected: aucune erreur. Si des erreurs sur `nav.chat` / `nav.metrics` → vérifier Task 2 complétée.

- [ ] **Step 4 : Tester visuellement**

Vérifier que les 4 onglets s'affichent, que l'actif est en jaune `#ffe01e`, que le FAB a disparu.

- [ ] **Step 5 : Commit**

```bash
git add components/client/BottomNav.tsx
git commit -m "refactor(client): BottomNav 4 tabs — Chat/Programme/Nutrition/Métriques, remove radial FAB"
```

---

## Task 13 : Inngest — Cron d'archivage `chat-archive`

**Files:**
- Create: `lib/inngest/functions/chat-archive.ts`
- Modify: `app/api/inngest/route.ts`

- [ ] **Step 1 : Créer la fonction Inngest**

```typescript
// lib/inngest/functions/chat-archive.ts
import { inngest } from '@/lib/inngest/client'
import { createClient } from '@supabase/supabase-js'

export const chatArchiveFunction = inngest.createFunction(
  { id: 'chat-archive', retries: 2 },
  { cron: '0 3 * * *' }, // 03:00 UTC — avant le cutoff physiologique 04:00
  async ({ step }) => {
    const result = await step.run('archive-messages-older-than-3-days', async () => {
      const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const { count, error } = await db
        .from('chat_messages')
        .update({ archived_at: new Date().toISOString() })
        .is('archived_at', null)
        .lt('created_at', cutoff)
        .select('id', { count: 'exact', head: true })

      if (error) throw error
      return { archived: count ?? 0 }
    })
    return result
  }
)
```

- [ ] **Step 2 : Enregistrer dans `app/api/inngest/route.ts`**

Ajouter l'import et la fonction dans le tableau :

```typescript
import { chatArchiveFunction } from '@/lib/inngest/functions/chat-archive'

// Dans serve({ functions: [...] })
// Ajouter chatArchiveFunction à la liste existante
```

- [ ] **Step 3 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "chat-archive|inngest"
```

Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add lib/inngest/functions/chat-archive.ts app/api/inngest/route.ts
git commit -m "feat(inngest): add chat-archive cron — archives messages older than 3 days at 03:00 UTC"
```

---

## Task 14 : Nettoyage — Supprimer anciens composants, mettre à jour shell

**Files:**
- Delete: `components/client/CoachAIButton.tsx`
- Delete: `components/client/CoachAIChatSheet.tsx`
- Delete: `app/client/profil/page.tsx` (et dossier si vide)
- Delete: `components/client/profile/ProfilAccordion.tsx`
- Modify: `components/client/ConditionalClientShell.tsx`

- [ ] **Step 1 : Retirer CoachAIButton de ConditionalClientShell**

Ouvrir `components/client/ConditionalClientShell.tsx`. Supprimer :
- L'import de `CoachAIButton`
- Le rendu `<CoachAIButton ... />` dans le JSX
- Les props ou état liés (ex: `initialRemaining`, `clientName` si uniquement utilisés pour CoachAIButton)

- [ ] **Step 2 : Supprimer les fichiers obsolètes**

```bash
rm components/client/CoachAIButton.tsx
rm components/client/CoachAIChatSheet.tsx
```

Pour le profil, vérifier qu'aucune autre route ne pointe vers `/client/profil` :
```bash
grep -rn "client/profil" app/ components/ --include="*.tsx" --include="*.ts"
```

Si aucun résultat (hors le fichier lui-même) :
```bash
rm app/client/profil/page.tsx
rm components/client/profile/ProfilAccordion.tsx
# Supprimer le dossier profil si vide
rmdir app/client/profil 2>/dev/null || true
```

Si des liens vers `/client/profil` existent → les rediriger vers `/client/metrics`.

- [ ] **Step 3 : Vérifier qu'aucun import cassé**

```bash
npx tsc --noEmit 2>&1 | grep -v "^$" | head -30
```

Expected: 0 erreurs liées aux fichiers supprimés. Si erreur → trouver qui importe le fichier supprimé et corriger.

- [ ] **Step 4 : Commit**

```bash
git add -A
git commit -m "refactor(client): remove CoachAIButton, CoachAIChatSheet, profil page — replaced by ChatPage and MetricsPage"
```

---

## Task 15 : CHANGELOG + project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1 : Mettre à jour CHANGELOG.md**

Ajouter en haut du fichier (section date du jour) :

```markdown
## 2026-05-20

FEATURE: Chat-first client app — conversational home page replacing Smart Agenda
FEATURE: /client now renders ChatPage with today strip, conversation, voice input
FEATURE: /client/metrics — new body metrics page replacing /client/profil  
FEATURE: BottomNav refactored — 4 tabs (Chat/Programme/Nutrition/Métriques), radial FAB removed
SCHEMA: Add chat_messages table with 3-day rolling window and archiving
SCHEMA: Add chat_sessions table for flow tracking (morning/evening/freeform)
FEATURE: API routes — /api/client/chat/messages (GET+POST), /api/client/chat/archives, /api/client/chat/today-strip
FEATURE: Inngest cron — chat-archive archives messages older than 3 days at 03:00 UTC
REFACTOR: Remove CoachAIButton, CoachAIChatSheet — replaced by dedicated chat page
```

- [ ] **Step 2 : Mettre à jour `.claude/rules/project-state.md`**

Dans le tableau "Modules Core Status", mettre à jour la ligne Client App :
```
| **Client App** | ✅ Chat-first — ChatPage home, 4-tab nav, MetricsPage, ai_coach daily usage | 2026-05-20 |
```

Ajouter une section "Dernières Avancées" datée avec les fichiers créés, modifiés, supprimés.

Ajouter dans "Points de Vigilance" :
```
| `20260520_chat_messages` migration non appliquée | Chat non fonctionnel | Appliquer via Supabase Dashboard |
| `coaches.avatar_url` — vérifier nom exact colonne | Avatar bot peut être null | Chercher dans schema.prisma |
```

Dans "Next Steps", cocher :
- [ ] → [x] : Chat page sub-projet #1 livré

Ajouter :
- [ ] Sub-projet #2 : Scripted Flow Engine (banque questions, flows coach, interactive message types)

- [ ] **Step 3 : Commit final**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for chat-first client app SP1"
```

---

## Tests manuels end-to-end

Après toutes les tâches :

1. `npm run dev` — 0 erreurs console au démarrage
2. `npx tsc --noEmit` — 0 erreurs TypeScript
3. `/client` → ChatPage s'affiche, today strip visible, input bar active
4. Envoyer un message texte → message jaune apparaît, typing indicator, réponse bot apparaît
5. Bouton mic → VoiceLogSheet s'ouvre, transcript envoyé comme message chat
6. `/client/metrics` → hero + body data + bouton settings
7. Settings → sheet s'ouvre, bouton déconnexion fonctionne
8. BottomNav → 4 onglets, actif en jaune, pas de FAB
9. `/client/chat/archives?date=2026-05-20` → JSON valide
10. Inngest dashboard → `chat-archive` function visible après déploiement

---

## Avertissements

- **Migration** : appliquer `20260520_chat_messages.sql` manuellement via Supabase Dashboard avant tout test
- **`coaches.avatar_url`** : vérifier le nom exact de la colonne dans `prisma/schema.prisma` (`Coach` model) avant Task 10
- **`BodyDataSection` props** : si le composant attend des props depuis ProfilAccordion, les passer explicitement depuis la page Server Component
- **`VoiceLogSheet.onTranscriptOnly`** : prop optionnelle — comportement existant inchangé si non fourni
