# Coach IA Chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un chat IA contextuel quotidien (GPT-4o mini) accessible depuis un bouton permanent dans la TopBar jaune de toutes les pages `/client`, avec rate limit 20 messages/jour et zéro persistance des messages.

**Architecture:** Bouton `CoachAIButton` injecté via `ConditionalClientShell`, ouvre `CoachAIChatSheet` (bottom sheet z-[70]). Deux routes API : `GET /api/client/ai-coach/context` (vérifie dispo + compteur) et `POST /api/client/ai-coach/chat` (construit system prompt server-side + appel OpenAI + rate limit DB). Table Supabase `ai_coach_daily_usage` pour le compteur journalier.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase (service role), OpenAI SDK (`openai` npm — déjà présent), Framer Motion, Lucide React, DS v3.0 tokens.

---

## File Map

| Fichier | Action | Rôle |
|---------|--------|------|
| `supabase/migrations/20260520_ai_coach_daily_usage.sql` | Créer | Table rate limit |
| `lib/client/ai-coach/buildSystemPrompt.ts` | Créer | Construit le system prompt depuis données DB |
| `app/api/client/ai-coach/context/route.ts` | Créer | GET — vérifie dispo, retourne compteur |
| `app/api/client/ai-coach/chat/route.ts` | Créer | POST — rate limit + OpenAI + réponse |
| `components/client/CoachAIChatSheet.tsx` | Créer | UI bottom sheet complète |
| `components/client/CoachAIButton.tsx` | Créer | Bouton TopBar avec état sheet |
| `components/client/ConditionalClientShell.tsx` | Modifier | Injection CoachAIButton dans le shell |

---

## Task 1 : Migration DB — ai_coach_daily_usage

**Files:**
- Create: `supabase/migrations/20260520_ai_coach_daily_usage.sql`

- [ ] **Step 1: Créer la migration**

```sql
-- supabase/migrations/20260520_ai_coach_daily_usage.sql

CREATE TABLE IF NOT EXISTS ai_coach_daily_usage (
  client_id uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  date      date NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (client_id, date)
);

-- RLS: client peut lire sa propre ligne (pour afficher le compteur)
ALTER TABLE ai_coach_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_read_own_usage"
  ON ai_coach_daily_usage FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

-- Pas de politique INSERT/UPDATE pour le client — service role uniquement
```

- [ ] **Step 2: Appliquer via Supabase Dashboard**

Ouvrir Supabase Dashboard → SQL Editor → coller et exécuter le contenu du fichier.  
Vérifier : table `ai_coach_daily_usage` visible dans Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260520_ai_coach_daily_usage.sql
git commit -m "schema: add ai_coach_daily_usage for chat rate limiting"
```

---

## Task 2 : lib — buildSystemPrompt

**Files:**
- Create: `lib/client/ai-coach/buildSystemPrompt.ts`

Cette fonction est appelée côté serveur dans la route `/chat` à chaque requête. Elle fetch toutes les données contextuelles et retourne le string system prompt. Jamais exposée au client browser.

- [ ] **Step 1: Créer le fichier**

```typescript
// lib/client/ai-coach/buildSystemPrompt.ts
import { SupabaseClient } from '@supabase/supabase-js'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'

function fmt(n: number) {
  return Math.round(n).toString()
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc']
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`
}

export async function buildSystemPrompt(
  clientId: string,
  svc: SupabaseClient
): Promise<string> {
  const today = computePhysiologicalDate(new Date())
  const dayStart = `${today}T00:00:00Z`
  const dayEnd   = `${today}T23:59:59Z`

  const [
    clientRow,
    protocolRow,
    mealsResult,
    waterResult,
    sessionResult,
    checkinResult,
    restrictionsResult,
  ] = await Promise.allSettled([
    // Profil client
    svc
      .from('coach_clients')
      .select('first_name, last_name, goal, fitness_level')
      .eq('id', clientId)
      .single(),
    // Protocole nutritionnel actif (contient les macros cibles)
    svc
      .from('nutrition_protocols')
      .select('id, nutrition_protocol_days(*)')
      .eq('client_id', clientId)
      .eq('status', 'shared')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Repas du jour
    svc
      .from('nutrition_meals')
      .select('meal_type, title, logged_at, total_calories, total_protein_g, total_fat_g, total_carbs_g')
      .eq('client_id', clientId)
      .eq('physiological_date', today)
      .neq('meal_type', 'drinks')
      .order('logged_at', { ascending: true }),
    // Eau du jour
    svc
      .from('client_water_logs')
      .select('amount_ml')
      .eq('client_id', clientId)
      .gte('logged_at', dayStart)
      .lte('logged_at', dayEnd),
    // Séance du jour
    svc
      .from('client_session_logs')
      .select('id, completed_at')
      .eq('client_id', clientId)
      .not('completed_at', 'is', null)
      .gte('completed_at', dayStart)
      .lte('completed_at', dayEnd)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Check-in matin
    svc
      .from('client_checkins')
      .select('responses')
      .eq('client_id', clientId)
      .eq('moment', 'morning')
      .eq('date', today)
      .maybeSingle(),
    // Restrictions physiques
    svc
      .from('metric_annotations')
      .select('body_part, severity, label')
      .eq('client_id', clientId)
      .eq('event_type', 'injury')
      .not('body_part', 'is', null),
  ])

  const client   = clientRow.status === 'fulfilled' ? clientRow.value.data    : null
  const protocol = protocolRow.status === 'fulfilled' ? protocolRow.value.data : null
  const meals   = mealsResult.status === 'fulfilled'   ? (mealsResult.value.data ?? [])   : []
  const water   = waterResult.status === 'fulfilled'   ? (waterResult.value.data ?? [])   : []
  const session = sessionResult.status === 'fulfilled' ? sessionResult.value.data         : null
  const checkin = checkinResult.status === 'fulfilled' ? checkinResult.value.data         : null
  const restrictions = restrictionsResult.status === 'fulfilled' ? (restrictionsResult.value.data ?? []) : []

  const firstName = client?.first_name ?? 'le client'
  const goal = client?.goal ?? 'non défini'

  // Macros cibles depuis le protocole nutritionnel partagé (premier jour = jour de référence)
  const protocolDays = (protocol as any)?.nutrition_protocol_days ?? []
  const refDay = [...protocolDays].sort((a: any, b: any) => a.position - b.position)[0] ?? null
  const targetKcal = refDay?.calories  ? fmt(Number(refDay.calories))   : '?'
  const targetP    = refDay?.protein_g ? fmt(Number(refDay.protein_g))  : '?'
  const targetL    = refDay?.fat_g     ? fmt(Number(refDay.fat_g))      : '?'
  const targetG    = refDay?.carbs_g   ? fmt(Number(refDay.carbs_g))    : '?'

  // Totaux nutrition
  const consumedKcal = meals.reduce((s, m: any) => s + Number(m.total_calories ?? 0), 0)
  const consumedP    = meals.reduce((s, m: any) => s + Number(m.total_protein_g ?? 0), 0)
  const consumedL    = meals.reduce((s, m: any) => s + Number(m.total_fat_g     ?? 0), 0)
  const consumedG    = meals.reduce((s, m: any) => s + Number(m.total_carbs_g   ?? 0), 0)
  const totalWaterMl = water.reduce((s: number, w: any) => s + Number(w.amount_ml ?? 0), 0)
  const targetWaterMl = 2500 // default — idéalement depuis profil

  const mealTypeLabel = (t: string) => {
    const map: Record<string, string> = {
      breakfast: 'Petit-déjeuner',
      lunch: 'Déjeuner',
      dinner: 'Dîner',
      snack: 'Collation',
    }
    return map[t] ?? 'Repas'
  }

  const mealsLines = meals.length > 0
    ? meals.map((m: any) => {
        const time = new Date(m.logged_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        const label = m.title ?? mealTypeLabel(m.meal_type)
        return `  ${time} — ${label} (${fmt(Number(m.total_calories ?? 0))} kcal)`
      }).join('\n')
    : '  Aucun repas enregistré'

  const restrictionsLines = restrictions.length > 0
    ? restrictions.map((r: any) => `  ${r.body_part} — ${r.severity}${r.label ? ` (${r.label})` : ''}`).join('\n')
    : '  Aucune'

  const programLine = protocol
    ? `Protocole nutritionnel actif`
    : 'Aucun protocole nutritionnel partagé'

  const sessionLine = session
    ? `Séance complétée à ${new Date(session.completed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : 'Aucune séance aujourd\'hui'

  let checkinLine = 'Non renseignés'
  if (checkin?.responses) {
    const r = checkin.responses as Record<string, unknown>
    const parts: string[] = []
    if (r.energy   != null) parts.push(`énergie ${r.energy}/5`)
    if (r.stress   != null) parts.push(`stress ${r.stress}/5`)
    if (r.sleep_h  != null) parts.push(`sommeil ${r.sleep_h}h`)
    if (parts.length > 0) checkinLine = parts.join(', ')
  }

  const now = new Date()
  const currentTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return `Tu es le Coach IA de ${firstName}. Tu connais sa journée en détail.
Réponds en 3 à 5 lignes maximum. Sois direct, factuel, bienveillant.
Reste strictement dans le périmètre : nutrition, récupération, entraînement du jour.
Si la question est hors périmètre, réponds exactement : "Je suis ton coach du quotidien — pose-moi une question sur ta journée, ta nutrition ou ta récupération."
Langue : français.

[PROFIL]
Prénom : ${firstName}
Objectif : ${goal} | TDEE : ${tdee} kcal | Cible : ${targetKcal} kcal
Macros cibles : P ${targetP}g / L ${targetL}g / G ${targetG}g
Programme : ${programLine}
Restrictions physiques :
${restrictionsLines}

[JOURNÉE DU ${formatDate(today)} — ${currentTime}]

Nutrition : ${fmt(consumedKcal)} kcal / ${targetKcal} cible
  Protéines : ${fmt(consumedP)}g / ${targetP}g
  Lipides   : ${fmt(consumedL)}g / ${targetL}g
  Glucides  : ${fmt(consumedG)}g / ${targetG}g
Repas :
${mealsLines}

Eau : ${Math.round(totalWaterMl / 100) / 10}L / ${Math.round(targetWaterMl / 100) / 10}L cible

Séance : ${sessionLine}

Check-ins : ${checkinLine}`
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

Attendu : 0 erreurs liées au nouveau fichier.

- [ ] **Step 3: Commit**

```bash
git add lib/client/ai-coach/buildSystemPrompt.ts
git commit -m "feat(ai-coach): add buildSystemPrompt — context builder for daily coach chat"
```

---

## Task 3 : API — GET /api/client/ai-coach/context

**Files:**
- Create: `app/api/client/ai-coach/context/route.ts`

Route légère — vérifie auth, retourne le compteur de messages restants. Ne retourne PAS le system prompt (construit uniquement dans `/chat`).

- [ ] **Step 1: Créer la route**

```typescript
// app/api/client/ai-coach/context/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

const MAX_MESSAGES = 20

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await resolveClientFromUser(
    user.id,
    user.email,
    svc(),
    'id, first_name',
  )
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const today = computePhysiologicalDate(new Date())

  const { data: usage } = await svc()
    .from('ai_coach_daily_usage')
    .select('message_count')
    .eq('client_id', client.id)
    .eq('date', today)
    .maybeSingle()

  const used = usage?.message_count ?? 0
  const remaining = Math.max(0, MAX_MESSAGES - used)

  return NextResponse.json({
    remainingMessages: remaining,
    clientName: client.first_name ?? 'toi',
    contextReady: true,
  })
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/client/ai-coach/context/route.ts
git commit -m "feat(ai-coach): add GET /api/client/ai-coach/context"
```

---

## Task 4 : API — POST /api/client/ai-coach/chat

**Files:**
- Create: `app/api/client/ai-coach/chat/route.ts`

Route principale : rate limit DB → build system prompt → OpenAI → réponse.

- [ ] **Step 1: Créer la route**

```typescript
// app/api/client/ai-coach/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import OpenAI from 'openai'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { buildSystemPrompt } from '@/lib/client/ai-coach/buildSystemPrompt'

const MAX_MESSAGES = 20
const MAX_HISTORY  = 20 // nb de messages (user+assistant) max dans le body

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(2000),
})

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(MAX_HISTORY),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const client = await resolveClientFromUser(
    user.id,
    user.email,
    svc(),
    'id, first_name',
  )
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const today = computePhysiologicalDate(new Date())
  const db = svc()

  // ── Rate limit check ────────────────────────────────────────────────────────
  const { data: usage } = await db
    .from('ai_coach_daily_usage')
    .select('message_count')
    .eq('client_id', client.id)
    .eq('date', today)
    .maybeSingle()

  const used = usage?.message_count ?? 0
  if (used >= MAX_MESSAGES) {
    return NextResponse.json(
      { error: 'limit_reached', remaining: 0 },
      { status: 429 },
    )
  }

  // ── Build system prompt (server-side only, never sent to client) ────────────
  const systemPrompt = await buildSystemPrompt(client.id, db)

  // ── OpenAI call ─────────────────────────────────────────────────────────────
  let reply: string
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        ...body.data.messages,
      ],
    })
    reply = completion.choices[0]?.message?.content?.trim() ?? 'Désolé, je n\'ai pas pu répondre.'
  } catch (err) {
    console.error('[ai-coach/chat] OpenAI error:', err)
    return NextResponse.json({ error: 'openai_error' }, { status: 500 })
  }

  // ── Increment counter (upsert) ──────────────────────────────────────────────
  await db
    .from('ai_coach_daily_usage')
    .upsert(
      { client_id: client.id, date: today, message_count: used + 1 },
      { onConflict: 'client_id,date' },
    )

  return NextResponse.json({
    reply,
    remaining: MAX_MESSAGES - (used + 1),
  })
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/client/ai-coach/chat/route.ts
git commit -m "feat(ai-coach): add POST /api/client/ai-coach/chat — rate limit + OpenAI"
```

---

## Task 5 : Composant — CoachAIChatSheet

**Files:**
- Create: `components/client/CoachAIChatSheet.tsx`

Bottom sheet DS v3.0. Gère : chargement contexte, historique local, envoi messages, typing indicator, suggestions rapides, compteur, état limite atteinte.

- [ ] **Step 1: Créer le composant**

```typescript
// components/client/CoachAIChatSheet.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  open: boolean
  onClose: () => void
}

const SUGGESTIONS = [
  'Il me reste des calories ce soir',
  'Comment récupérer après ma séance ?',
  'Mon eau est insuffisante, que faire ?',
]

const GREETING = 'Bonjour ! Je connais ta journée. Comment puis-je t\'aider ?'

export default function CoachAIChatSheet({ open, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [contextReady, setContextReady] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // Fetch context on open
  useEffect(() => {
    if (!open) return
    setMessages([])
    setInput('')
    setShowSuggestions(true)
    setContextReady(false)

    fetch('/api/client/ai-coach/context')
      .then(r => r.json())
      .then(data => {
        setRemaining(data.remainingMessages ?? 20)
        setContextReady(true)
      })
      .catch(() => {
        setRemaining(20)
        setContextReady(true)
      })
  }, [open])

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  // Focus input when ready
  useEffect(() => {
    if (contextReady && open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [contextReady, open])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading || remaining === 0) return

    setShowSuggestions(false)
    const newMessages: Message[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/client/ai-coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (res.status === 429) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Tu as atteint tes 20 messages du jour. Reviens demain !' },
        ])
        setRemaining(0)
        return
      }

      const data = await res.json()
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
        setRemaining(data.remaining ?? 0)
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Une erreur est survenue. Réessaie dans un instant.' },
        ])
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Une erreur est survenue. Réessaie dans un instant.' },
      ])
    } finally {
      setLoading(false)
    }
  }, [messages, loading, remaining])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isLimitReached = remaining === 0
  const canSend = !loading && !isLimitReached && contextReady && input.trim().length > 0

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[70] flex flex-col rounded-t-2xl bg-[#161616] border-t border-white/[0.08]"
            style={{ maxHeight: '88vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-14 shrink-0 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffe01e] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ffe01e]" />
                </span>
                <span className="text-[13px] font-barlow-condensed font-bold uppercase tracking-[0.14em] text-white">
                  Coach IA
                </span>
                {contextReady && (
                  <span className="text-[10px] text-white/40 font-barlow">
                    · Contexte du jour chargé
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/60 hover:bg-white/[0.10] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
            >
              {/* Greeting */}
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl bg-white/[0.06] px-4 py-3 text-[14px] text-white/90 font-barlow leading-relaxed">
                  {GREETING}
                </div>
              </div>

              {/* Suggestions */}
              {showSuggestions && messages.length === 0 && contextReady && (
                <div className="flex flex-col gap-2 mt-1">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="self-start text-left text-[12px] font-barlow px-3 py-2 rounded-xl border border-[#ffe01e]/30 bg-[#ffe01e]/10 text-[#ffe01e] hover:bg-[#ffe01e]/20 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Conversation */}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-[14px] font-barlow leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#ffe01e] text-[#0d0d0d]'
                        : 'bg-white/[0.06] text-white/90'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-white/[0.06] px-4 py-3">
                    <span className="flex gap-1 items-center h-4">
                      {[0, 1, 2].map(i => (
                        <motion.span
                          key={i}
                          className="block h-1.5 w-1.5 rounded-full bg-white/40"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="shrink-0 px-4 pb-6 pt-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!contextReady || isLimitReached || loading}
                  placeholder={
                    isLimitReached
                      ? 'Limite atteinte pour aujourd\'hui'
                      : 'Tape ton message...'
                  }
                  className="flex-1 min-w-0 h-10 rounded-xl bg-[#1a1a1a] border border-white/[0.08] px-3 text-[14px] font-barlow text-white placeholder:text-white/30 focus:outline-none focus:border-white/[0.16] disabled:opacity-40 transition-colors"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!canSend}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffe01e] text-[#0d0d0d] disabled:opacity-30 transition-opacity"
                >
                  <Send size={14} />
                </button>
              </div>
              {remaining !== null && (
                <p className="text-right text-[10px] text-white/30 font-barlow mt-1.5">
                  {remaining}/20 messages
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/client/CoachAIChatSheet.tsx
git commit -m "feat(ai-coach): add CoachAIChatSheet — DS v3.0 bottom sheet with suggestions and rate limit UI"
```

---

## Task 6 : Composant — CoachAIButton + injection dans ConditionalClientShell

**Files:**
- Create: `components/client/CoachAIButton.tsx`
- Modify: `components/client/ConditionalClientShell.tsx`

Le bouton ouvre/ferme le sheet. Il est rendu dans `ConditionalClientShell` pour être présent sur toutes les pages du shell (pas les auth paths).

- [ ] **Step 1: Créer CoachAIButton**

```typescript
// components/client/CoachAIButton.tsx
'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import CoachAIChatSheet from './CoachAIChatSheet'

export default function CoachAIButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le Coach IA"
        className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/[0.10] text-[#0d0d0d] hover:bg-black/[0.18] active:scale-95 transition-all"
      >
        <MessageCircle size={16} />
      </button>

      <CoachAIChatSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
```

- [ ] **Step 2: Injecter dans ConditionalClientShell**

Modifier `components/client/ConditionalClientShell.tsx` :

```typescript
'use client'

import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'
import OnboardingTour from './OnboardingTour'
import { TourProvider } from './TourContext'
import CoachAIButton from './CoachAIButton'

// Routes that are NOT part of the authenticated client shell
const AUTH_PATHS = [
  '/client/login',
  '/client/set-password',
  '/client/auth',
  '/client/access',
  '/client/onboarding',
  '/client/checkin/onboarding',
  '/client/acces-suspendu',
  '/client/programme/session/',
  '/client/nutrition/log',
]

interface Props {
  children: React.ReactNode
}

export default function ConditionalClientShell({ children }: Props) {
  const pathname = usePathname()
  const isAuthPath = AUTH_PATHS.some(p => pathname.startsWith(p))

  if (isAuthPath) {
    return <>{children}</>
  }

  return (
    <TourProvider>
      {/* Fixed top-right Coach IA button — visible on all shell pages */}
      <div className="fixed top-3 right-4 z-50">
        <CoachAIButton />
      </div>

      {/* pb = BottomNav h-16 (64) + safe-area min 24px + 16px breathing room = ~104px */}
      <div className="pb-24" style={{ paddingBottom: 'max(104px, calc(64px + env(safe-area-inset-bottom) + 16px))' }}>
        {children}
      </div>
      <BottomNav />
      <OnboardingTour />
    </TourProvider>
  )
}
```

> **Note positionnement :** Le bouton est fixe `top-3 right-4 z-50`. La TopBar jaune (`h-14`) des pages utilise `z-40` — le bouton est au-dessus. Les pages qui ont déjà un élément en `right` de la TopBar devront adapter leur layout si conflit visuel (à vérifier page par page en phase test).

- [ ] **Step 3: Vérifier TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/client/CoachAIButton.tsx components/client/ConditionalClientShell.tsx
git commit -m "feat(ai-coach): add CoachAIButton and inject into ConditionalClientShell"
```

---

## Task 7 : CHANGELOG + project-state + vérification finale

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Mettre à jour CHANGELOG.md**

Ajouter en tête de `CHANGELOG.md` :

```
## 2026-05-20

FEATURE: Add Coach IA Chat — GPT-4o mini daily contextual chat in client PWA
SCHEMA: Add ai_coach_daily_usage table for 20 msg/day rate limit
```

- [ ] **Step 2: Mettre à jour project-state.md**

Dans `.claude/rules/project-state.md`, section "Dernières Avancées", ajouter :

```markdown
### 2026-05-20 — Coach IA Chat

- `supabase/migrations/20260520_ai_coach_daily_usage.sql` — table rate limit (client_id, date, message_count PK)
- `lib/client/ai-coach/buildSystemPrompt.ts` — construit system prompt depuis profil + journée (repas, eau, séance, check-ins, restrictions) — server-side uniquement
- `app/api/client/ai-coach/context/route.ts` — GET, vérifie auth + retourne remaining messages
- `app/api/client/ai-coach/chat/route.ts` — POST, rate limit DB → buildSystemPrompt → GPT-4o mini (max_tokens 300) → réponse + decrement
- `components/client/CoachAIChatSheet.tsx` — bottom sheet DS v3.0 z-[70], suggestions rapides, typing indicator, compteur 20 msg
- `components/client/CoachAIButton.tsx` — bouton MessageCircle fixed top-3 right-4 z-50
- `components/client/ConditionalClientShell.tsx` — injection CoachAIButton sur toutes les pages shell
- Points de vigilance : migration à appliquer manuellement via Supabase Dashboard ; `OPENAI_API_KEY` déjà présente ; system prompt jamais retourné au client browser ; reset compteur = date physiologique 04:00
```

Dans "Points de Vigilance" du tableau, ajouter :

```
| `20260520_ai_coach_daily_usage` migration non appliquée | Rate limit non fonctionnel (upsert échoue) | Appliquer via Supabase Dashboard |
```

- [ ] **Step 3: Vérification TypeScript finale**

```bash
npx tsc --noEmit
```

Attendu : 0 erreurs nouvelles.

- [ ] **Step 4: Commit final**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for Coach IA Chat"
```

---

## Checklist de test manuel

Après implémentation complète :

1. Ouvrir `/client` (home) → bouton `MessageCircle` visible en haut à droite
2. Tap bouton → sheet s'ouvre, message de bienvenue affiché, suggestions visibles
3. Cliquer suggestion "Il me reste des calories ce soir" → message envoyé, réponse IA reçue en ~2s, suggestions disparaissent
4. Vérifier que la réponse est contextualisée (mentionne les calories du jour)
5. Envoyer 20 messages → à msg 21, erreur 429 → bubble "Limite atteinte"
6. Naviguer vers `/client/nutrition` → bouton toujours présent
7. Naviguer vers `/client/programme/session/xxx` → bouton absent (AUTH_PATH)
8. Vérifier console : aucun system prompt dans les réponses réseau browser (DevTools → Network)
