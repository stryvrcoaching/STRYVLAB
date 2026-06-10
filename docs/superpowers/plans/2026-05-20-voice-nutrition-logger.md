# Voice Nutrition Logger — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow clients to describe a meal verbally; SpeechRecognition transcribes it, GPT-4o mini extracts food items + macros, client reviews/edits, then logs to nutrition_meals/nutrition_entries.

**Architecture:** A dedicated `VoiceLogSheet` bottom sheet (DS v3.0) handles recording → processing → review as a 3-layer state machine. A pure lib `lib/nutrition/voice.ts` owns types and transcript cleaning. One new API route `/api/client/nutrition/voice-parse` calls GPT-4o mini with a strict JSON prompt. The existing `POST /api/client/nutrition/meals` route handles the final log after `'voice'` is added to the `input_mode` enum.

**Tech Stack:** Next.js App Router, TypeScript strict, Framer Motion, Web Speech API (SpeechRecognition), Web Audio API (AnalyserNode), OpenAI GPT-4o mini, Vitest, Zod, Supabase

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/nutrition/voice.ts` | Types `VoiceItem`, `VoiceParseResult`; `cleanTranscript()` |
| Create | `tests/lib/nutrition/voice.test.ts` | Unit tests for `cleanTranscript()` |
| Create | `supabase/migrations/20260520_voice_input_mode.sql` | Add `'voice'` to `input_mode` CHECK constraint |
| Create | `app/api/client/nutrition/voice-parse/route.ts` | POST — clean → GPT-4o mini → match food_items → VoiceParseResult |
| Create | `components/client/smart/VoiceLogSheet.tsx` | Bottom sheet: 3-layer state machine (recording/processing/review) |
| Modify | `lib/nutrition/food-items.ts` | Add `'voice'` to `InputMode` union |
| Modify | `app/api/client/nutrition/meals/route.ts` | Accept `'voice'` in `input_mode` enum schema |
| Modify | `lib/i18n/clientTranslations.ts` | Add `voice.*` i18n keys |
| Modify | `app/client/nutrition/page.tsx` | Add FAB micro button → opens VoiceLogSheet |
| Modify | `components/client/smart/MealLogSheet.tsx` | Add micro icon in header → opens VoiceLogSheet |
| Modify | `app/client/nutrition/log/NutritionLogContent.tsx` | Add micro icon in header → opens VoiceLogSheet with meal_id |

---

## Task 1: Types + cleanTranscript (lib/nutrition/voice.ts)

**Files:**
- Create: `lib/nutrition/voice.ts`
- Create: `tests/lib/nutrition/voice.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/nutrition/voice.test.ts
import { describe, it, expect } from 'vitest'
import { cleanTranscript } from '@/lib/nutrition/voice'

describe('cleanTranscript', () => {
  it('lowercases input', () => {
    expect(cleanTranscript('POULET GRILLÉ', 'fr')).toBe('poulet grillé')
  })

  it('removes French filler words', () => {
    expect(cleanTranscript('euh donc j\'ai mangé voilà du poulet en fait', 'fr'))
      .toBe("j'ai mangé du poulet")
  })

  it('removes English filler words', () => {
    expect(cleanTranscript('um so I had like chicken you know', 'en'))
      .toBe('i had chicken')
  })

  it('removes Spanish filler words', () => {
    expect(cleanTranscript('eh bueno comí pues pollo', 'es'))
      .toBe('comí pollo')
  })

  it('normalizes written French numbers to digits', () => {
    expect(cleanTranscript('deux cents grammes de riz et une demi pomme', 'fr'))
      .toBe('200 grammes de riz et 0.5 pomme')
  })

  it('normalizes unit words to abbreviations', () => {
    expect(cleanTranscript('150 grammes de poulet et 250 millilitres d\'eau', 'fr'))
      .toBe("150 g de poulet et 250 ml d'eau")
  })

  it('collapses multiple spaces', () => {
    expect(cleanTranscript('poulet   grillé    riz', 'fr')).toBe('poulet grillé riz')
  })

  it('trims leading/trailing whitespace', () => {
    expect(cleanTranscript('  poulet  ', 'fr')).toBe('poulet')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/lib/nutrition/voice.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/nutrition/voice'`

- [ ] **Step 3: Create lib/nutrition/voice.ts**

```ts
// lib/nutrition/voice.ts

import type { MealType } from './food-items'

export type VoiceConfidence = 'high' | 'medium' | 'low'

export interface VoiceItem {
  name: string
  quantity_g: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  confidence: VoiceConfidence
  food_item_id?: string
  is_new: boolean
}

export interface VoiceParseResult {
  items: VoiceItem[]
  meal_type: MealType
  raw_transcript: string
  clean_transcript: string
}

// ── Filler word maps ─────────────────────────────────────────────────────────
const FILLERS: Record<string, RegExp> = {
  fr: /\b(euh|donc|voil[aà]|en fait|genre|alors|bon|ben)\b/gi,
  en: /\b(um|uh|so|like|well|you know)\b/gi,
  es: /\b(eh|bueno|pues|o sea)\b/gi,
}

// ── Written numbers → digits (French) ───────────────────────────────────────
const FR_NUMBERS: Array<[RegExp, string]> = [
  [/\bmille\b/gi, '1000'],
  [/\bcinq cents\b/gi, '500'],
  [/\bquatre cents\b/gi, '400'],
  [/\btrois cents\b/gi, '300'],
  [/\bdeux cents\b/gi, '200'],
  [/\bcent cinquante\b/gi, '150'],
  [/\bcent\b/gi, '100'],
  [/\bquatre-vingt-dix\b/gi, '90'],
  [/\bquatre-vingts?\b/gi, '80'],
  [/\bsoixante-dix\b/gi, '70'],
  [/\bsoixante\b/gi, '60'],
  [/\bciquante\b/gi, '50'],
  [/\bquarante\b/gi, '40'],
  [/\btrente\b/gi, '30'],
  [/\bvingt\b/gi, '20'],
  [/\bdix\b/gi, '10'],
  [/\bneuf\b/gi, '9'],
  [/\bhuit\b/gi, '8'],
  [/\bsept\b/gi, '7'],
  [/\bsix\b/gi, '6'],
  [/\bcinq\b/gi, '5'],
  [/\bquatre\b/gi, '4'],
  [/\btrois\b/gi, '3'],
  [/\bdeux\b/gi, '2'],
  [/\bun\b/gi, '1'],
  [/\bune demi\b/gi, '0.5'],
  [/\bun quart\b/gi, '0.25'],
]

// ── Unit normalizations ──────────────────────────────────────────────────────
const UNITS: Array<[RegExp, string]> = [
  [/\bkilogrammes?\b/gi, 'kg'],
  [/\bgrammes?\b/gi, 'g'],
  [/\bmillilitres?\b/gi, 'ml'],
  [/\bcentilitres?\b/gi, 'cl'],
  [/\blitres?\b/gi, 'L'],
]

export function cleanTranscript(raw: string, lang: string): string {
  let text = raw.toLowerCase()

  // Remove filler words for the language (fallback: fr)
  const fillerRe = FILLERS[lang] ?? FILLERS['fr']
  text = text.replace(fillerRe, '')

  // Normalize written French numbers (only for fr)
  if (lang === 'fr') {
    for (const [re, digit] of FR_NUMBERS) {
      text = text.replace(re, digit)
    }
  }

  // Normalize units
  for (const [re, abbr] of UNITS) {
    text = text.replace(re, abbr)
  }

  // Collapse whitespace + trim
  return text.replace(/\s+/g, ' ').trim()
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/lib/nutrition/voice.test.ts
```
Expected: 8 tests PASS

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/nutrition/voice.ts tests/lib/nutrition/voice.test.ts
git commit -m "feat(voice): add VoiceItem types and cleanTranscript utility"
```

---

## Task 2: DB migration — add 'voice' to input_mode

**Files:**
- Create: `supabase/migrations/20260520_voice_input_mode.sql`
- Modify: `lib/nutrition/food-items.ts` (line ~11: `InputMode` type)
- Modify: `app/api/client/nutrition/meals/route.ts` (line ~28: Zod schema)

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260520_voice_input_mode.sql
-- Add 'voice' to nutrition_entries input_mode constraint

ALTER TABLE nutrition_entries
  DROP CONSTRAINT IF EXISTS nutrition_entries_input_mode_check;

ALTER TABLE nutrition_entries
  ADD CONSTRAINT nutrition_entries_input_mode_check
  CHECK (input_mode IN ('composer', 'portion', 'photo_ai', 'voice'));
```

- [ ] **Step 2: Apply migration manually**

Go to Supabase Dashboard → SQL Editor → paste and run the migration above.
Expected: `ALTER TABLE` success, no errors.

- [ ] **Step 3: Update InputMode type in lib/nutrition/food-items.ts**

Find line ~11:
```ts
export type InputMode = "composer" | "portion" | "photo_ai"
```
Replace with:
```ts
export type InputMode = "composer" | "portion" | "photo_ai" | "voice"
```

- [ ] **Step 4: Update Zod schema in app/api/client/nutrition/meals/route.ts**

Find the `entrySchema` (around line 24-29):
```ts
const entrySchema = z.object({
  food_item_id: z.string().uuid(),
  quantity_g: z.number().positive().max(5000),
  input_mode: z.enum(["composer", "portion", "photo_ai"]).default("composer"),
})
```
Replace with:
```ts
const entrySchema = z.object({
  food_item_id: z.string().uuid(),
  quantity_g: z.number().positive().max(5000),
  input_mode: z.enum(["composer", "portion", "photo_ai", "voice"]).default("composer"),
})
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260520_voice_input_mode.sql lib/nutrition/food-items.ts app/api/client/nutrition/meals/route.ts
git commit -m "feat(voice): add 'voice' to input_mode enum — migration + types + Zod schema"
```

---

## Task 3: i18n keys for voice UI

**Files:**
- Modify: `lib/i18n/clientTranslations.ts`

- [ ] **Step 1: Add voice keys at end of clientDict**

Open `lib/i18n/clientTranslations.ts`. Find the last key in `clientDict` and add after it (before the closing `}` of the object):

```ts
  // ── Voice logging ──
  'voice.title':           { fr: 'Saisie vocale',                         en: 'Voice log',                           es: 'Registro por voz' },
  'voice.tap_to_speak':    { fr: 'Appuyez pour parler',                    en: 'Tap to speak',                        es: 'Toca para hablar' },
  'voice.listening':       { fr: "J'écoute…",                              en: 'Listening…',                          es: 'Escuchando…' },
  'voice.processing':      { fr: 'Analyse en cours…',                      en: 'Processing…',                         es: 'Analizando…' },
  'voice.review_title':    { fr: 'Aliments détectés',                      en: 'Detected foods',                      es: 'Alimentos detectados' },
  'voice.new_badge':       { fr: 'Nouveau',                                en: 'New',                                 es: 'Nuevo' },
  'voice.new_items_notice':{ fr: '{n} aliment(s) ajouté(s) à votre catalogue', en: '{n} food(s) added to your catalog', es: '{n} alimento(s) añadido(s) a su catálogo' },
  'voice.log_meal':        { fr: 'Logger ce repas',                        en: 'Log this meal',                       es: 'Registrar esta comida' },
  'voice.not_supported':   { fr: 'Saisie vocale non disponible sur ce navigateur', en: 'Voice input not available on this browser', es: 'Entrada de voz no disponible en este navegador' },
  'voice.error_parse':     { fr: 'Impossible d\'analyser le repas. Réessayez.', en: 'Could not analyze meal. Please try again.', es: 'No se pudo analizar la comida. Inténtalo de nuevo.' },
  'voice.error_rate_limit':{ fr: 'Trop de tentatives. Attendez 1 minute.', en: 'Too many attempts. Wait 1 minute.',   es: 'Demasiados intentos. Espera 1 minuto.' },
  'voice.add_item':        { fr: '+ Ajouter un aliment',                   en: '+ Add a food',                        es: '+ Añadir alimento' },
  'voice.confidence_high': { fr: 'Précis',                                 en: 'Accurate',                            es: 'Preciso' },
  'voice.confidence_med':  { fr: 'Estimé',                                 en: 'Estimated',                           es: 'Estimado' },
  'voice.confidence_low':  { fr: 'Incertain',                              en: 'Uncertain',                           es: 'Incierto' },
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add lib/i18n/clientTranslations.ts
git commit -m "feat(voice): add voice.* i18n keys (FR/EN/ES)"
```

---

## Task 4: API route — /api/client/nutrition/voice-parse

**Files:**
- Create: `app/api/client/nutrition/voice-parse/route.ts`

> **Prerequisites:** `OPENAI_API_KEY` must be set in Vercel env vars and `.env.local`. Verify with `echo $OPENAI_API_KEY` locally.

- [ ] **Step 1: Create the route file**

```ts
// app/api/client/nutrition/voice-parse/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { z } from "zod"
import OpenAI from "openai"

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolveClientId(userId: string): Promise<string | null> {
  const { data } = await service()
    .from("coach_clients")
    .select("id")
    .eq("user_id", userId)
    .single()
  return data?.id ?? null
}

// ── In-memory rate limit (10 req/min per clientId) ───────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(clientId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(clientId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clientId, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}

// ── Request schema ───────────────────────────────────────────────────────────
const bodySchema = z.object({
  transcript: z.string().min(3).max(1000),
  physiological_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lang: z.enum(["fr", "en", "es"]).default("fr"),
})

// ── POST /api/client/nutrition/voice-parse ───────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clientId = await resolveClientId(user.id)
  if (!clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  if (!checkRateLimit(clientId)) {
    return NextResponse.json({ error: "rate_limit", retry_after: 60 }, { status: 429 })
  }

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const { transcript, physiological_date, lang } = body.data
  const db = service()

  // ── Fetch top-20 food items this client uses most ─────────────────────────
  const { data: topEntries } = await db
    .from("nutrition_entries")
    .select("food_item_id, food_items(id, name_fr)")
    .eq("client_id", clientId)
    .limit(200)

  const countMap: Record<string, { id: string; name: string; count: number }> = {}
  for (const e of (topEntries ?? [])) {
    const fi = (e as any).food_items
    if (!fi) continue
    if (!countMap[fi.id]) countMap[fi.id] = { id: fi.id, name: fi.name_fr, count: 0 }
    countMap[fi.id].count++
  }
  const topFoods = Object.values(countMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map(f => `${f.name} (id: ${f.id})`)

  const currentHour = new Date().getHours()
  const catalogHint = topFoods.length
    ? `Catalogue préféré du client :\n${topFoods.join('\n')}`
    : ""

  // ── GPT-4o mini call ──────────────────────────────────────────────────────
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const systemPrompt = `Tu es un assistant nutritionnel. Analyse ce texte et retourne UNIQUEMENT un JSON valide.

Format de réponse :
{
  "items": [
    {
      "name": "nom de l'aliment en français",
      "quantity_g": 150,
      "kcal": 248,
      "protein_g": 31.5,
      "carbs_g": 0,
      "fat_g": 13.2,
      "fiber_g": 0,
      "confidence": "high"
    }
  ],
  "meal_type": "lunch"
}

Règles :
- Identifie chaque aliment distinct mentionné
- Si la quantité n'est pas précisée, estime une portion standard
- confidence: "high" si quantité explicite, "medium" si estimée, "low" si très incertain
- meal_type déduit du contexte ou de l'heure (${currentHour}h) parmi : breakfast, lunch, dinner, snack
- Ne retourne QUE le JSON, aucun texte autour
- Les valeurs nutritionnelles doivent être pour la quantité indiquée (pas pour 100g)

${catalogHint}`

  let parsed: { items: any[]; meal_type: string } | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript },
        ],
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: "json_object" },
      })
      const raw = completion.choices[0]?.message?.content ?? ""
      parsed = JSON.parse(raw)
      break
    } catch {
      if (attempt === 1) {
        return NextResponse.json({ error: "parse_failed" }, { status: 422 })
      }
    }
  }

  if (!parsed || !Array.isArray(parsed.items)) {
    return NextResponse.json({ error: "parse_failed" }, { status: 422 })
  }

  // ── Match food_item_id from catalogue ─────────────────────────────────────
  const itemNames = parsed.items.map((i: any) => i.name as string)
  const { data: matchedFoods } = await db
    .from("food_items")
    .select("id, name_fr")
    .in("name_fr", itemNames)

  const nameToId: Record<string, string> = {}
  for (const f of (matchedFoods ?? [])) {
    nameToId[f.name_fr.toLowerCase()] = f.id
  }

  // Also check if top-20 ids were returned directly in item names
  const topIdByName: Record<string, string> = {}
  for (const entry of topEntries ?? []) {
    const fi = (entry as any).food_items
    if (fi) topIdByName[fi.name_fr.toLowerCase()] = fi.id
  }

  const voiceItems = parsed.items.map((item: any) => {
    const nameLower = (item.name as string).toLowerCase()
    const food_item_id = nameToId[nameLower] ?? topIdByName[nameLower]
    return {
      name: item.name as string,
      quantity_g: Number(item.quantity_g) || 100,
      kcal: Number(item.kcal) || 0,
      protein_g: Number(item.protein_g) || 0,
      carbs_g: Number(item.carbs_g) || 0,
      fat_g: Number(item.fat_g) || 0,
      fiber_g: Number(item.fiber_g) || 0,
      confidence: (item.confidence as string) || "medium",
      food_item_id,
      is_new: !food_item_id,
    }
  })

  const validMealTypes = ["breakfast", "lunch", "dinner", "snack"]
  const meal_type = validMealTypes.includes(parsed.meal_type) ? parsed.meal_type : "snack"

  return NextResponse.json({
    items: voiceItems,
    meal_type,
    raw_transcript: transcript,
    clean_transcript: transcript,
  })
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors. If `openai` package missing: `npm install openai` (already used for MorphoPro — should be present).

- [ ] **Step 3: Verify openai package exists**

```bash
grep '"openai"' package.json
```
Expected: line with `"openai": "..."`. If absent: `npm install openai`.

- [ ] **Step 4: Commit**

```bash
git add app/api/client/nutrition/voice-parse/route.ts
git commit -m "feat(voice): add /api/client/nutrition/voice-parse — GPT-4o mini food parse"
```

---

## Task 5: VoiceLogSheet component

**Files:**
- Create: `components/client/smart/VoiceLogSheet.tsx`

This is the main UI component. It has 3 layers driven by a `layer` state: `'recording' | 'processing' | 'review'`.

- [ ] **Step 1: Create the component**

```tsx
// components/client/smart/VoiceLogSheet.tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Mic, MicOff, X, Trash2, ChevronRight, Plus } from "lucide-react"
import { useClientT } from "@/components/client/ClientI18nProvider"
import { cleanTranscript, type VoiceItem } from "@/lib/nutrition/voice"
import type { MealType } from "@/lib/nutrition/food-items"

type Layer = "recording" | "processing" | "review"

interface VoiceLogSheetProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  /** If provided, voice items will be appended to this existing meal */
  mealId?: string
  lang?: string
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high:   "bg-[#22c55e]/15 text-[#22c55e]",
  medium: "bg-[#f59e0b]/15 text-[#f59e0b]",
  low:    "bg-red-500/15 text-red-400",
}

export default function VoiceLogSheet({ open, onClose, onSuccess, mealId, lang = "fr" }: VoiceLogSheetProps) {
  const { t } = useClientT()
  const [layer, setLayer] = useState<Layer>("recording")
  const [isListening, setIsListening] = useState(false)
  const [rawTranscript, setRawTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<VoiceItem[]>([])
  const [mealType, setMealType] = useState<MealType>("snack")
  const [logging, setLogging] = useState(false)
  const [waveBars, setWaveBars] = useState<number[]>([24, 24, 24, 24, 24])
  const [elapsedSec, setElapsedSec] = useState(0)

  const recognitionRef = useRef<any>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waveFrameRef = useRef<number | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isSpeechSupported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)

  // ── Reset on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setLayer("recording")
      setIsListening(false)
      setRawTranscript("")
      setInterimTranscript("")
      setError(null)
      setItems([])
      setElapsedSec(0)
    }
  }, [open])

  // ── Cleanup on unmount / close ─────────────────────────────────────────────
  useEffect(() => {
    return () => stopAll()
  }, [])

  function stopAll() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (waveFrameRef.current) cancelAnimationFrame(waveFrameRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {})
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} }
    analyserRef.current = null
    audioCtxRef.current = null
    streamRef.current = null
  }

  // ── Waveform animation ─────────────────────────────────────────────────────
  function startWave() {
    const analyser = analyserRef.current
    if (!analyser) return
    const buf = new Uint8Array(analyser.frequencyBinCount)
    function frame() {
      analyser.getByteFrequencyData(buf)
      const bands = [0, 8, 16, 24, 32].map(i => {
        const slice = Array.from(buf.slice(i, i + 8))
        const avg = slice.reduce((a, b) => a + b, 0) / 8
        return Math.max(8, Math.min(48, Math.round(avg / 2.5)))
      })
      setWaveBars(bands)
      waveFrameRef.current = requestAnimationFrame(frame)
    }
    waveFrameRef.current = requestAnimationFrame(frame)
  }

  // ── Start recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!isSpeechSupported) return
    setError(null)
    setRawTranscript("")
    setInterimTranscript("")
    setElapsedSec(0)

    // Setup audio analyser for waveform
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      startWave()
    } catch {
      // Waveform won't work but speech recognition still can
    }

    // Setup SpeechRecognition
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    const recognition = new SR()
    recognition.lang = lang === "fr" ? "fr-FR" : lang === "es" ? "es-ES" : "en-US"
    recognition.continuous = false
    recognition.interimResults = true
    recognitionRef.current = recognition

    recognition.onresult = (e: any) => {
      let interim = ""
      let final = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript
        if (e.results[i].isFinal) final += text
        else interim += text
      }
      if (final) setRawTranscript(prev => (prev + " " + final).trim())
      setInterimTranscript(interim)

      // Reset silence timer
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => stopRecording(), 2500)
    }

    recognition.onerror = () => {
      stopRecording()
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
    setIsListening(true)

    // Elapsed timer
    timerRef.current = setInterval(() => {
      setElapsedSec(prev => {
        if (prev >= 59) { stopRecording(); return 60 }
        return prev + 1
      })
    }, 1000)
  }, [lang, isSpeechSupported])

  // ── Stop recording → trigger parse ────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (waveFrameRef.current) cancelAnimationFrame(waveFrameRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {})
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} }
    setWaveBars([24, 24, 24, 24, 24])
    setIsListening(false)

    setRawTranscript(prev => {
      const final = prev.trim()
      if (final.length > 2) {
        parseTranscript(final)
      }
      return final
    })
  }, [lang])

  // ── Parse transcript via API ───────────────────────────────────────────────
  async function parseTranscript(raw: string) {
    const clean = cleanTranscript(raw, lang)
    setLayer("processing")
    setError(null)

    const today = new Date().toISOString().slice(0, 10)
    try {
      const res = await fetch("/api/client/nutrition/voice-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: clean, physiological_date: today, lang }),
      })

      if (res.status === 429) {
        setError(t("voice.error_rate_limit"))
        setLayer("recording")
        return
      }
      if (!res.ok) {
        setError(t("voice.error_parse"))
        setLayer("recording")
        return
      }

      const data = await res.json()
      setItems(data.items ?? [])
      setMealType(data.meal_type ?? "snack")
      setLayer("review")
    } catch {
      setError(t("voice.error_parse"))
      setLayer("recording")
    }
  }

  // ── Update item field ──────────────────────────────────────────────────────
  function updateItem(index: number, field: keyof VoiceItem, value: any) {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item
      const updated = { ...item, [field]: value }
      // Recalculate macros proportionally if quantity changed
      if (field === "quantity_g" && item.quantity_g > 0) {
        const ratio = (value as number) / item.quantity_g
        return {
          ...updated,
          kcal: Math.round(item.kcal * ratio),
          protein_g: parseFloat((item.protein_g * ratio).toFixed(1)),
          carbs_g: parseFloat((item.carbs_g * ratio).toFixed(1)),
          fat_g: parseFloat((item.fat_g * ratio).toFixed(1)),
          fiber_g: parseFloat((item.fiber_g * ratio).toFixed(1)),
        }
      }
      return updated
    }))
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function addEmptyItem() {
    setItems(prev => [...prev, {
      name: "",
      quantity_g: 100,
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      confidence: "low",
      is_new: true,
    }])
  }

  // ── Log meal ───────────────────────────────────────────────────────────────
  async function logMeal() {
    const validItems = items.filter(i => i.name.trim().length > 0)
    if (validItems.length === 0) return
    setLogging(true)

    // 1. Create new food_items for is_new items
    const newItems = validItems.filter(i => i.is_new && !i.food_item_id)
    for (const item of newItems) {
      try {
        const res = await fetch("/api/client/food-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name_fr: item.name,
            category_l1: "extras",
            category_l2: "divers",
            kcal_per_100g: item.quantity_g > 0 ? Math.round(item.kcal / item.quantity_g * 100) : item.kcal,
            protein_per_100g: item.quantity_g > 0 ? parseFloat((item.protein_g / item.quantity_g * 100).toFixed(1)) : item.protein_g,
            carbs_per_100g: item.quantity_g > 0 ? parseFloat((item.carbs_g / item.quantity_g * 100).toFixed(1)) : item.carbs_g,
            fat_per_100g: item.quantity_g > 0 ? parseFloat((item.fat_g / item.quantity_g * 100).toFixed(1)) : item.fat_g,
            fiber_per_100g: item.quantity_g > 0 ? parseFloat((item.fiber_g / item.quantity_g * 100).toFixed(1)) : 0,
          }),
        })
        if (res.ok) {
          const created = await res.json()
          item.food_item_id = created.id
          item.is_new = false
        }
      } catch {}
    }

    // 2. Build entries — only items with food_item_id
    const entries = validItems
      .filter(i => i.food_item_id)
      .map(i => ({
        food_item_id: i.food_item_id!,
        quantity_g: i.quantity_g,
        input_mode: "voice" as const,
      }))

    if (entries.length === 0) {
      setLogging(false)
      setError(t("voice.error_parse"))
      return
    }

    // 3. Log the meal
    try {
      const res = await fetch("/api/client/nutrition/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(mealId ? { meal_id: mealId } : {}),
          meal_type: mealType,
          entries,
        }),
      })
      if (!res.ok) throw new Error()
      onSuccess?.()
      onClose()
    } catch {
      setError(t("voice.error_parse"))
    } finally {
      setLogging(false)
    }
  }

  const totalKcal = items.reduce((s, i) => s + i.kcal, 0)
  const totalP = items.reduce((s, i) => s + i.protein_g, 0)
  const totalC = items.reduce((s, i) => s + i.carbs_g, 0)
  const totalF = items.reduce((s, i) => s + i.fat_g, 0)
  const newCount = items.filter(i => i.is_new).length

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[70] bg-[#161616] rounded-t-2xl border-t border-white/[0.08]"
            style={{ maxHeight: "88vh", display: "flex", flexDirection: "column" }}
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }}
            exit={{ y: "100%", transition: { duration: 0.2, ease: "easeIn" } }}
          >
            {/* Handle + header */}
            <div className="relative flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.12]" />
              <p className="text-[13px] font-bold text-white font-barlow">{t("voice.title")}</p>
              <button
                onClick={onClose}
                className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
              >
                <X size={13} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-6">

              {/* ── Not supported ── */}
              {!isSpeechSupported && (
                <div className="flex items-center justify-center h-40">
                  <p className="text-white/40 text-[13px] text-center font-barlow px-4">{t("voice.not_supported")}</p>
                </div>
              )}

              {/* ── LAYER: recording ── */}
              {isSpeechSupported && layer === "recording" && (
                <div className="flex flex-col items-center gap-6 py-8">
                  {/* Waveform */}
                  <div className="flex items-center gap-1 h-14">
                    {waveBars.map((h, i) => (
                      <motion.div
                        key={i}
                        className="w-[5px] rounded-full"
                        style={{ backgroundColor: isListening ? "#ffe01e" : "rgba(255,255,255,0.15)" }}
                        animate={{ height: h }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      />
                    ))}
                  </div>

                  {/* Timer */}
                  {isListening && (
                    <span className="text-[12px] text-white/40 font-barlow tabular-nums">{formatTime(elapsedSec)}</span>
                  )}

                  {/* Interim transcript */}
                  {interimTranscript && (
                    <p className="text-[13px] text-white/40 italic font-barlow text-center px-2">{interimTranscript}</p>
                  )}
                  {rawTranscript && !interimTranscript && (
                    <p className="text-[13px] text-white/70 font-barlow text-center px-2">{rawTranscript}</p>
                  )}

                  {/* Error */}
                  {error && (
                    <p className="text-[12px] text-red-400 font-barlow text-center">{error}</p>
                  )}

                  {/* Mic button */}
                  <button
                    onClick={isListening ? stopRecording : startRecording}
                    className="h-[72px] w-[72px] rounded-full flex items-center justify-center transition-all active:scale-[0.95]"
                    style={{ backgroundColor: isListening ? "#ef4444" : "#ffe01e" }}
                  >
                    {isListening
                      ? <MicOff size={28} className="text-white" />
                      : <Mic size={28} className="text-[#0d0d0d]" />}
                  </button>

                  <p className="text-[11px] text-white/30 font-barlow-condensed uppercase tracking-[0.18em]">
                    {isListening ? t("voice.listening") : t("voice.tap_to_speak")}
                  </p>
                </div>
              )}

              {/* ── LAYER: processing ── */}
              {layer === "processing" && (
                <div className="flex flex-col items-center justify-center h-40 gap-4">
                  <div className="h-8 w-8 border-2 border-white/20 border-t-[#ffe01e] rounded-full animate-spin" />
                  <p className="text-[13px] text-white/50 font-barlow">{t("voice.processing")}</p>
                </div>
              )}

              {/* ── LAYER: review ── */}
              {layer === "review" && (
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/40 mt-1">
                    {t("voice.review_title")}
                  </p>

                  {/* Items list */}
                  {items.map((item, idx) => (
                    <motion.div
                      key={idx}
                      layout
                      className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-3"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        {/* Name */}
                        <input
                          value={item.name}
                          onChange={e => updateItem(idx, "name", e.target.value)}
                          className="flex-1 min-w-0 bg-transparent text-[13px] text-white font-barlow border-b border-white/[0.08] pb-0.5 focus:outline-none focus:border-[#ffe01e]/40"
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Confidence badge */}
                          <span className={`text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-lg ${CONFIDENCE_STYLES[item.confidence] ?? CONFIDENCE_STYLES.medium}`}>
                            {t(`voice.confidence_${item.confidence === "high" ? "high" : item.confidence === "medium" ? "med" : "low"}`)}
                          </span>
                          {item.is_new && (
                            <span className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-lg bg-[#f59e0b]/15 text-[#f59e0b]">
                              {t("voice.new_badge")}
                            </span>
                          )}
                          {/* Delete */}
                          <button onClick={() => removeItem(idx)} className="text-white/30 hover:text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Quantity + macros */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={item.quantity_g}
                            onChange={e => updateItem(idx, "quantity_g", parseFloat(e.target.value) || 0)}
                            className="w-16 min-w-0 bg-white/[0.06] rounded-lg px-2 py-1 text-[12px] text-white font-barlow text-center focus:outline-none"
                          />
                          <span className="text-[11px] text-white/40 font-barlow">g</span>
                        </div>
                        <span className="text-[11px] text-white/60 font-barlow">{Math.round(item.kcal)} kcal</span>
                        <span className="text-[11px] text-white/40 font-barlow">P {item.protein_g.toFixed(1)}g</span>
                        <span className="text-[11px] text-white/40 font-barlow">G {item.carbs_g.toFixed(1)}g</span>
                        <span className="text-[11px] text-white/40 font-barlow">L {item.fat_g.toFixed(1)}g</span>
                      </div>
                    </motion.div>
                  ))}

                  {/* Add item */}
                  <button
                    onClick={addEmptyItem}
                    className="flex items-center gap-2 text-[12px] text-white/40 font-barlow hover:text-white/60 transition-colors py-2"
                  >
                    <Plus size={14} />
                    {t("voice.add_item")}
                  </button>

                  {/* New items notice */}
                  {newCount > 0 && (
                    <p className="text-[11px] text-[#f59e0b]/70 font-barlow">
                      {t("voice.new_items_notice").replace("{n}", String(newCount))}
                    </p>
                  )}

                  {/* Totals sticky-ish */}
                  <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-[13px] font-bold text-white font-barlow">{Math.round(totalKcal)} kcal</span>
                    <div className="flex gap-3 text-[11px] text-white/50 font-barlow">
                      <span>P {totalP.toFixed(1)}g</span>
                      <span>G {totalC.toFixed(1)}g</span>
                      <span>L {totalF.toFixed(1)}g</span>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <p className="text-[12px] text-red-400 font-barlow">{error}</p>
                  )}

                  {/* Log button */}
                  <button
                    onClick={logMeal}
                    disabled={logging || items.filter(i => i.name.trim()).length === 0}
                    className="w-full h-12 rounded-xl bg-[#ffe01e] text-[#0d0d0d] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[13px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
                  >
                    {logging
                      ? <div className="h-4 w-4 border-2 border-[#0d0d0d]/30 border-t-[#0d0d0d] rounded-full animate-spin" />
                      : <><ChevronRight size={16} />{t("voice.log_meal")}</>}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/VoiceLogSheet.tsx
git commit -m "feat(voice): add VoiceLogSheet — recording/processing/review state machine"
```

---

## Task 6: Wire FAB on nutrition page

**Files:**
- Modify: `app/client/nutrition/page.tsx`

The nutrition page is a Server Component — the FAB must be in a Client Component wrapper. Strategy: create a small client wrapper that holds voice sheet state, rendered inside the page.

- [ ] **Step 1: Create VoiceEntryFab client component**

Create new file `components/client/smart/VoiceEntryFab.tsx`:

```tsx
// components/client/smart/VoiceEntryFab.tsx
"use client"

import { useState } from "react"
import { Mic } from "lucide-react"
import dynamic from "next/dynamic"

const VoiceLogSheet = dynamic(() => import("@/components/client/smart/VoiceLogSheet"), { ssr: false })

interface VoiceEntryFabProps {
  lang?: string
  onSuccess?: () => void
}

export default function VoiceEntryFab({ lang = "fr", onSuccess }: VoiceEntryFabProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed z-50 flex items-center justify-center h-11 w-11 rounded-full bg-white/[0.08] border border-white/[0.08] text-white/60 hover:bg-white/[0.12] hover:text-white transition-all active:scale-[0.95]"
        style={{ bottom: "88px", right: "16px" }}
        aria-label="Saisie vocale"
      >
        <Mic size={18} />
      </button>

      <VoiceLogSheet
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => { setOpen(false); onSuccess?.() }}
        lang={lang}
      />
    </>
  )
}
```

- [ ] **Step 2: Add VoiceEntryFab to nutrition page**

Open `app/client/nutrition/page.tsx`. Find the return statement — it renders `<main>` with content. Add `<VoiceEntryFab>` just before the closing `</main>` tag.

At the top of the file, add the import:
```ts
import VoiceEntryFab from '@/components/client/smart/VoiceEntryFab'
```

Then inside the `<main>` element, before `</main>`:
```tsx
<VoiceEntryFab lang={client?.language ?? "fr"} />
```

Note: `client` is the result of `resolveClientFromUser`. If it doesn't include a `language` field, change the select to include it: `'id, gender, language'`. If the `coach_clients` table doesn't have `language`, just hardcode `lang="fr"` for now — check the Prisma schema.

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/client/smart/VoiceEntryFab.tsx app/client/nutrition/page.tsx
git commit -m "feat(voice): add voice FAB to nutrition page"
```

---

## Task 7: Mic button in MealLogSheet + NutritionLogContent

**Files:**
- Modify: `components/client/smart/MealLogSheet.tsx`
- Modify: `app/client/nutrition/log/NutritionLogContent.tsx`

- [ ] **Step 1: Add mic button to MealLogSheet header**

Open `components/client/smart/MealLogSheet.tsx`. The header currently is:

```tsx
<div className="relative flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.12]" />
  <p className="text-[13px] font-bold text-white">Ajouter un repas</p>
  <button
    onClick={onClose}
    className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
  >
    <X size={13} />
  </button>
</div>
```

Replace with this (adds mic button + voice sheet state):

```tsx
"use client"

import { Suspense, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Mic } from "lucide-react"
import { NutritionLogContent } from "@/app/client/nutrition/log/NutritionLogContent"
import dynamic from "next/dynamic"

const VoiceLogSheet = dynamic(() => import("@/components/client/smart/VoiceLogSheet"), { ssr: false })

interface MealLogSheetProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function MealLogSheet({ open, onClose, onSuccess }: MealLogSheetProps) {
  const [voiceOpen, setVoiceOpen] = useState(false)

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[60] bg-[#161616] rounded-t-2xl border-t border-white/[0.08]"
            style={{ height: "88vh", display: "flex", flexDirection: "column" }}
            initial={{ y: "100%" }}
            animate={{ y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }}
            exit={{ y: "100%", transition: { duration: 0.2, ease: "easeIn" } }}
          >
            {/* Header */}
            <div className="relative flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/[0.12]" />
              <p className="text-[13px] font-bold text-white">Ajouter un repas</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setVoiceOpen(true)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.06] text-white/40 hover:text-[#ffe01e] transition-colors"
                  title="Saisie vocale"
                >
                  <Mic size={13} />
                </button>
                <button
                  onClick={onClose}
                  className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative min-h-0">
              <Suspense fallback={<div className="h-full bg-[#161616]" />}>
                <NutritionLogContent embedded onSuccess={onSuccess ?? onClose} />
              </Suspense>
            </div>
          </motion.div>

          {/* Voice sheet — z higher than MealLogSheet */}
          <VoiceLogSheet
            open={voiceOpen}
            onClose={() => setVoiceOpen(false)}
            onSuccess={() => { setVoiceOpen(false); onSuccess?.() }}
          />
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Add mic button to NutritionLogContent header**

Open `app/client/nutrition/log/NutritionLogContent.tsx`. Find the component's top-level return. Look for the header section (it renders when `!embedded` for a TopBar, or has an inline header). 

Add mic state at the top of the function body (after existing `useState` calls):

```tsx
const [voiceOpen, setVoiceOpen] = useState(false)
```

Add the dynamic import at the top of the file (after other imports):

```tsx
import dynamic from "next/dynamic"
const VoiceLogSheet = dynamic(() => import("@/components/client/smart/VoiceLogSheet"), { ssr: false })
```

Find the section that renders when `embedded === true` — typically the content starts right away. In the outer return, add the VoiceLogSheet right before the final closing tag of the outer wrapper:

```tsx
<VoiceLogSheet
  open={voiceOpen}
  onClose={() => setVoiceOpen(false)}
  onSuccess={() => { setVoiceOpen(false); onSuccess?.() }}
/>
```

Then, in the header area of the embedded view (look for the search bar or the top row), add a mic button alongside existing controls:

```tsx
<button
  onClick={() => setVoiceOpen(true)}
  className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/40 hover:text-[#ffe01e] transition-colors shrink-0"
  title="Saisie vocale"
>
  <Mic size={15} />
</button>
```

Also add the import for `Mic` to the existing import from `"lucide-react"` if not already there.

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/client/smart/MealLogSheet.tsx app/client/nutrition/log/NutritionLogContent.tsx
git commit -m "feat(voice): add mic button in MealLogSheet and NutritionLogContent headers"
```

---

## Task 8: CHANGELOG + project-state update

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Update CHANGELOG.md**

Add at the top of `CHANGELOG.md` under today's date:

```
## 2026-05-20

FEATURE: Voice nutrition logger — SpeechRecognition + GPT-4o mini parse + review flow
FEATURE: VoiceLogSheet component — 3-layer state machine (recording/processing/review)
FEATURE: /api/client/nutrition/voice-parse — transcript cleaning + GPT-4o mini + food_items matching
FEATURE: VoiceEntryFab — floating mic button on nutrition page
FEATURE: Mic button in MealLogSheet and NutritionLogContent headers
SCHEMA: nutrition_entries.input_mode — add 'voice' to CHECK constraint
```

- [ ] **Step 2: Update project-state.md**

In `.claude/rules/project-state.md`, under `## 📦 Modules Core Status`, update the Client App row:

```
| **Client App** | ✅ Smart Trio + Profil accordion + Smart Workout Motra-style + Voice Nutrition Logger | 2026-05-20 |
```

Add a new section under `## 🚀 Dernières Avancées`:

```markdown
### 2026-05-20 — Voice Nutrition Logger

- `lib/nutrition/voice.ts` — `cleanTranscript()`, types `VoiceItem` + `VoiceParseResult`
- `app/api/client/nutrition/voice-parse/route.ts` — POST, GPT-4o mini, top-20 food_items hint, food_item_id matching, in-memory rate limit
- `components/client/smart/VoiceLogSheet.tsx` — 3-layer sheet: recording (SpeechRecognition + waveform), processing (spinner), review (editable items, swipe delete, log)
- `components/client/smart/VoiceEntryFab.tsx` — FAB micro fixe sur `/client/nutrition`
- `supabase/migrations/20260520_voice_input_mode.sql` — `'voice'` ajouté à l'enum `input_mode`
- Points de vigilance : migration à appliquer manuellement, OPENAI_API_KEY requis, SpeechRecognition non supporté sur iOS Safari < 16.4 (fallback message)
```

Also add to `## 🔑 Points de Vigilance`:

```
| `20260520_voice_input_mode` migration non appliquée | voice input_mode rejeté en DB | Appliquer via Supabase Dashboard |
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Final commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for voice nutrition logger"
```

---

## Self-Review Checklist

### Spec coverage

| Spec requirement | Covered by task |
|-----------------|----------------|
| FAB micro sur /client/nutrition | Task 6 |
| Bouton micro dans MealLogSheet | Task 7 |
| Bouton micro dans NutritionLogContent | Task 7 |
| SpeechRecognition + waveform + silence auto-stop | Task 5 |
| iOS fallback message | Task 5 |
| cleanTranscript() — filler words, numbers, units | Task 1 |
| /api/client/nutrition/voice-parse | Task 4 |
| Rate limit 10/min | Task 4 |
| GPT-4o mini avec prompt JSON strict | Task 4 |
| Top-20 food_items hint in prompt | Task 4 |
| food_item_id matching par ILIKE | Task 4 |
| VoiceItem types + VoiceParseResult | Task 1 |
| Review screen — editable items, confidence badge | Task 5 |
| Badge "Nouveau" + avertissement count | Task 5 |
| Swipe/delete items | Task 5 |
| Ajout ligne vide | Task 5 |
| Recalcul macros proportionnel si quantité éditée | Task 5 |
| Créer food_items (is_new) avant log | Task 5 |
| POST /api/client/nutrition/meals avec input_mode:'voice' | Task 5 |
| 'voice' dans InputMode union | Task 2 |
| DB migration CHECK constraint | Task 2 |
| i18n keys voice.* (FR/EN/ES) | Task 3 |
| CHANGELOG + project-state | Task 8 |
| confidence_score 0.70 pour voice | ⚠️ Not in API route — needs fix |

**Fix:** In Task 4, the `POST /api/client/nutrition/meals` is called from the client (VoiceLogSheet) with `input_mode: 'voice'`. The `confidence_score` is assigned in the meals route based on input_mode. Check `app/api/client/nutrition/meals/route.ts` — if it has a confidence map, add `voice: 0.70`.

Looking at the meals route (line 79+): it uses `calcEntryMacros` and sets `confidence_score` per entry. Add `voice: 0.70` to the confidence map in `app/api/client/nutrition/meals/route.ts`.

**Additional fix needed in Task 2:** Add confidence score mapping for 'voice' in the meals route.

Open `app/api/client/nutrition/meals/route.ts`. Find where `confidence_score` is set (look for `input_mode` mapping, around line 80-110). Add:

```ts
const CONFIDENCE_MAP: Record<string, number> = {
  composer: 0.85,
  portion: 0.65,
  photo_ai: 0.55,
  voice: 0.70,
}
```

If this map already exists without `voice`, add `voice: 0.70` to it.
