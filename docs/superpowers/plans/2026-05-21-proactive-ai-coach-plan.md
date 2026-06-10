# Proactive AI Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the AI coach from a reactive generic LLM to a proactive, data-aware extension of the human coach — with a richer system prompt, morning/evening pre-inserted check-in messages, and a structured daily brief after each check-in.

**Architecture:** Three independent components delivered in order: (1) system prompt v2 in `buildSystemPrompt.ts` adds coach identity, full bilan history, active program, and tone rules; (2) two new Inngest cron functions insert proactive morning (06:30) and evening (21:30) check-in trigger messages into `chat_messages`; (3) `buildDailyBrief.ts` generates a structured day summary inserted after every check-in closing message.

**Tech Stack:** Next.js App Router, Supabase (service role), OpenAI `gpt-4o-mini`, Inngest cron functions, TypeScript strict.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `lib/client/ai-coach/buildSystemPrompt.ts` | Add coach identity, full bilan history, active program, hydration from protocol, tone rules |
| Create | `lib/client/ai-coach/buildDailyBrief.ts` | Pure function: structured daily brief string + 1 LLM sentence |
| Modify | `app/api/client/checkin/route.ts` | Insert daily brief message after closing message |
| Create | `lib/inngest/functions/chat-morning-brief.ts` | Cron 06:30 — fan-out, dedup, insert morning init message |
| Create | `lib/inngest/functions/chat-evening-brief.ts` | Cron 21:30 — fan-out, dedup, insert evening init message |
| Modify | `app/api/inngest/route.ts` | Register 2 new functions |
| Modify | `components/client/ChatPage.tsx` | Handle `trigger_checkin` chip → activate check-in flow |

---

## Task 1: System Prompt v2 — Coach Identity + Full Bilan History

**Files:**
- Modify: `lib/client/ai-coach/buildSystemPrompt.ts`

### Context

The current function fetches `clientRow` inside `Promise.allSettled`, which prevents using `coach_id` in parallel queries. We restructure: extract `clientRow` as a sequential first fetch, then run everything else in `allSettled`.

The bilan query currently uses `limit(2)` with `ascending: false`. We change to `limit(10)` with `ascending: true` (oldest first) to compute true total progression.

- [ ] **Step 1: Replace the `clientRow` entry in `Promise.allSettled` with a pre-fetch**

In `buildSystemPrompt.ts`, replace the top of the function (lines 22–57) with:

```typescript
export async function buildSystemPrompt(clientId: string): Promise<string> {
  const db = svc()
  const today = computePhysiologicalDate(new Date())
  const dayStart = `${today}T00:00:00Z`
  const dayEnd   = `${today}T23:59:59Z`
  const nowTime  = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  const nextPhysioDay = (() => {
    const d = new Date(`${today}T00:00:00`)
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })()

  const threeDaysAgo = (() => {
    const d = new Date(`${today}T00:00:00`)
    d.setDate(d.getDate() - 3)
    return d.toISOString().split('T')[0]
  })()

  // Sequential first: need coach_id before running parallel queries
  const { data: profileData } = await db
    .from('coach_clients')
    .select('first_name, goal, tdee, fitness_level, coach_id')
    .eq('id', clientId)
    .single()

  const firstName    = profileData?.first_name   ?? 'le client'
  const goal         = profileData?.goal          ?? 'non renseigné'
  const tdee         = profileData?.tdee          ?? 0
  const fitnessLevel = profileData?.fitness_level ?? 'intermédiaire'
  const coachId      = profileData?.coach_id      ?? null

  const [
    coachProfileResult,
    nutritionProtocol,
    mealsResult,
    legacyMealsResult,
    waterResult,
    sessionResult,
    activitiesResult,
    restrictionsResult,
    bodyCompResult,
    nutritionTrendsResult,
    checkinsResult,
    activeProgramResult,
  ] = await Promise.allSettled([
    coachId
      ? db.from('user_profiles').select('first_name, last_name').eq('id', coachId).single()
      : Promise.resolve({ data: null }),
    db.from('nutrition_protocols')
      .select('name, nutrition_protocol_days(calories, protein_g, fat_g, carbs_g, hydration_ml)')
      .eq('client_id', clientId)
      .eq('status', 'shared')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('nutrition_meals')
      .select('total_calories, total_protein_g, total_fat_g, total_carbs_g, meal_type, title, logged_at')
      .eq('client_id', clientId)
      .eq('physiological_date', today)
      .order('logged_at', { ascending: true }),
    db.from('meal_logs')
      .select('estimated_macros, logged_at, meal_name')
      .eq('client_id', clientId)
      .gte('logged_at', `${today}T04:00:00.000Z`)
      .lt('logged_at', `${nextPhysioDay}T04:00:00.000Z`)
      .eq('ai_status', 'done'),
    db.from('client_water_logs')
      .select('amount_ml')
      .eq('client_id', clientId)
      .gte('logged_at', dayStart)
      .lte('logged_at', dayEnd),
    db.from('client_session_logs')
      .select('id, completed_at')
      .eq('client_id', clientId)
      .not('completed_at', 'is', null)
      .gte('completed_at', dayStart)
      .lte('completed_at', dayEnd)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('client_activity_logs')
      .select('activity_type, custom_label, duration_min')
      .eq('client_id', clientId)
      .gte('started_at', dayStart)
      .lte('started_at', dayEnd),
    db.from('metric_annotations')
      .select('label, body_part, severity')
      .eq('client_id', clientId)
      .eq('event_type', 'injury')
      .not('body_part', 'is', null),
    // CHANGED: ascending: true, limit(10) — oldest first for full progression
    db.from('assessment_submissions')
      .select('bilan_date, assessment_responses(field_key, value_number)')
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .order('bilan_date', { ascending: true })
      .limit(10),
    db.from('nutrition_meals')
      .select('physiological_date, total_calories, total_protein_g')
      .eq('client_id', clientId)
      .gte('physiological_date', threeDaysAgo)
      .lt('physiological_date', today)
      .order('physiological_date', { ascending: false }),
    db.from('client_daily_checkins')
      .select('flow_type, sleep_hours, sleep_quality, energy_level, stress_level, weight_kg, hunger_level, muscle_soreness')
      .eq('client_id', clientId)
      .eq('date', today),
    db.from('programs')
      .select('name, weeks, frequency, program_sessions(id, name, day_of_week, days_of_week)')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
```

- [ ] **Step 2: Extract coach name from the new result**

After the `Promise.allSettled` block, replace the old `const profile = ...` block with:

```typescript
  // ── Coach identity ────────────────────────────────────────────────────────
  const coachProfile = coachProfileResult.status === 'fulfilled' ? (coachProfileResult.value as any)?.data : null
  const coachFirstName = coachProfile?.first_name ?? null
  const coachLastName  = coachProfile?.last_name  ?? null
  const coachName = coachFirstName
    ? [coachFirstName, coachLastName].filter(Boolean).join(' ')
    : 'ton coach'

  // ── Profile (already resolved above) ──────────────────────────────────────
  // firstName, goal, tdee, fitnessLevel are already set
```

- [ ] **Step 3: Rewrite the body composition block with full progression**

Replace the existing `// ── Body composition` section (lines 200–225) with:

```typescript
  // ── Body composition — full history ───────────────────────────────────────
  const bilans = bodyCompResult.status === 'fulfilled' ? (bodyCompResult.value.data ?? []) : []
  type AssessmentResponse = { field_key: string; value_number: number | null }
  const extractValues = (bilan: any): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const r of (bilan?.assessment_responses ?? []) as AssessmentResponse[]) {
      if (r.value_number != null) out[r.field_key] = r.value_number
    }
    return out
  }

  const firstBilanData  = bilans[0]     ? extractValues(bilans[0])                : {}
  const latestBilanData = bilans.length ? extractValues(bilans[bilans.length - 1]) : {}

  const firstWeight  = firstBilanData['weight_kg']    ?? null
  const firstBF      = firstBilanData['body_fat_pct'] ?? null
  const latestWeight = latestBilanData['weight_kg']    ?? null
  const latestBF     = latestBilanData['body_fat_pct'] ?? null
  const latestLBM    = latestBilanData['lean_mass_kg'] ?? null

  const totalWeightDelta = latestWeight != null && firstWeight != null
    ? +(latestWeight - firstWeight).toFixed(1) : null
  const totalBFDelta = latestBF != null && firstBF != null
    ? +(latestBF - firstBF).toFixed(1) : null

  let bodyCompLines: string
  if (latestWeight == null) {
    bodyCompLines = 'Aucun bilan corporel enregistré'
  } else {
    const lines: string[] = []
    if (bilans[0]?.bilan_date && bilans.length > 1) {
      lines.push(`Début du suivi (${fmtDate(bilans[0].bilan_date)}): ${firstWeight ?? '?'}kg${firstBF != null ? ` | MG ${firstBF}%` : ''}`)
    }
    // Intermediate bilans (skip first and last if more than 2)
    if (bilans.length > 2) {
      bilans.slice(1, -1).forEach((b: any) => {
        const v = extractValues(b)
        const w = v['weight_kg'] ?? '?'
        const bf = v['body_fat_pct']
        lines.push(`  ${fmtDate(b.bilan_date)}: ${w}kg${bf != null ? ` | MG ${bf}%` : ''}`)
      })
    }
    const lastBilan = bilans[bilans.length - 1]
    lines.push(`Actuel (${fmtDate(lastBilan.bilan_date)}): ${latestWeight}kg${latestBF != null ? ` | MG ${latestBF}%` : ''}${latestLBM != null ? ` | MM ${latestLBM}kg` : ''}`)
    if (totalWeightDelta !== null) {
      const sign = totalWeightDelta > 0 ? '+' : ''
      lines.push(`PROGRESSION TOTALE: ${sign}${totalWeightDelta}kg poids${totalBFDelta !== null ? ` | ${totalBFDelta > 0 ? '+' : ''}${totalBFDelta}% MG` : ''}`)
    }
    bodyCompLines = lines.join('\n')
  }
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors (or only pre-existing unrelated errors in stripe/BodyFatCalculator).

- [ ] **Step 5: Commit**

```bash
git add lib/client/ai-coach/buildSystemPrompt.ts
git commit -m "feat(ai-coach): full bilan history + coach identity in system prompt"
```

---

## Task 2: System Prompt v2 — Active Program + Tone Rules + Water from Protocol

**Files:**
- Modify: `lib/client/ai-coach/buildSystemPrompt.ts`

- [ ] **Step 1: Extract active program data**

After the body composition block, add:

```typescript
  // ── Active program ────────────────────────────────────────────────────────
  const activeProgram = activeProgramResult.status === 'fulfilled'
    ? (activeProgramResult.value as any)?.data
    : null

  const todayDow = new Date().getDay() // 0=Sun, 1=Mon, ..., 6=Sat

  let programBlock = ''
  if (activeProgram) {
    const sessions: any[] = activeProgram.program_sessions ?? []
    const todaySession = sessions.find((s: any) => {
      const dows: number[] = Array.isArray(s.days_of_week) && s.days_of_week.length > 0
        ? s.days_of_week
        : s.day_of_week != null ? [s.day_of_week] : []
      return dows.includes(todayDow)
    })
    const sessionLine = todaySession
      ? `Séance prévue aujourd'hui: ${todaySession.name}`
      : 'Séance prévue aujourd\'hui: Repos / récupération'

    programBlock = `[PROGRAMME ACTIF]
Nom: ${activeProgram.name} | ${activeProgram.frequency ?? '?'} séances/semaine | ${activeProgram.weeks ?? '?'} semaines
${sessionLine}`
  }
```

- [ ] **Step 2: Fix water target to use protocol value**

Find the line:
```typescript
  const targetWaterMl = 2500
```

Replace with:
```typescript
  const targetWaterMl: number = (protocolDay as any)?.hydration_ml ?? 2500
```

(`protocolDay` is already defined in the existing nutrition protocol section.)

- [ ] **Step 3: Rewrite the system prompt string**

Replace the entire `return` statement (currently lines 272–312) with:

```typescript
  const identityBlock = `Tu es l'assistant de ${coachName}, coach certifié personnel de ${firstName}.
${coachName} a créé le programme d'entraînement de ${firstName}, établi ses objectifs nutritionnels et suit sa progression.
Tu parles EN SON NOM, comme son prolongement direct.

RÈGLES DE COMPORTEMENT — NON NÉGOCIABLES:
- Réponds en 2-3 phrases MAXIMUM. Sois direct et affirmatif.
- Ne donne JAMAIS de conseils nutritionnels génériques — ${coachName} a déjà calculé les macros et les calories.
- Ne propose JAMAIS d'ajuster les macros, les calories ou le programme — c'est la responsabilité de ${coachName}.
- Ne dis JAMAIS "tu pourrais essayer" ou "une option serait" — affirme ce que les données montrent.
- Réfère-toi au programme comme "le programme que ${coachName} t'a préparé".
- Si une donnée manque, dis-le en une phrase et demande-la directement.
- Ne donne jamais de conseils médicaux. Langue : français uniquement.`

  return `${identityBlock}

[PROFIL CLIENT]
Prénom: ${firstName}
Objectif: ${goal} | TDEE: ${tdee} kcal
Niveau: ${fitnessLevel}
Restrictions physiques: ${restrictionsLine}

${programBlock ? programBlock + '\n\n' : ''}[ÉVOLUTION CORPORELLE COMPLÈTE]
${bodyCompLines}

[PROTOCOLE NUTRITIONNEL]
Cible: ${targetKcal} kcal | P ${targetProtein}g | L ${targetFat}g | G ${targetCarbs}g | Eau ${(targetWaterMl / 1000).toFixed(1)}L

[TENDANCES NUTRITION — 3 derniers jours]
${trendBlock}

[CHECK-INS DU JOUR]
Matin: ${morningLine}
Soir: ${eveningLine}

[JOURNÉE DU ${fmtDate(today)} — ${nowTime}]
Nutrition: ${Math.round(totalKcal)} kcal / ${targetKcal} cible (${pct(totalKcal, targetKcal)})
  Protéines: ${Math.round(totalProtein)}g / ${targetProtein}g
  Lipides: ${Math.round(totalFat)}g / ${targetFat}g
  Glucides: ${Math.round(totalCarbs)}g / ${targetCarbs}g
Repas:
${mealsLines}

Eau: ${totalWaterMl}ml / ${targetWaterMl}ml (${pct(totalWaterMl, targetWaterMl)})

Séance: ${sessionLine}

Activités libres:
${activitiesLine}`
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/client/ai-coach/buildSystemPrompt.ts
git commit -m "feat(ai-coach): active program, coach tone rules, hydration from protocol"
```

---

## Task 3: `buildDailyBrief.ts` — Pure function

**Files:**
- Create: `lib/client/ai-coach/buildDailyBrief.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/client/ai-coach/buildDailyBrief.ts
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export interface DailyBriefInput {
  flowType: 'morning' | 'evening'
  sessionName: string | null
  targetKcal: number
  targetProtein: number
  targetWaterMl: number
  energyLevel?: number | null
  sleepHours?: number | null
  sleepQuality?: number | null
  muscleSoreness?: number | null
}

export async function buildDailyBrief(input: DailyBriefInput): Promise<string> {
  const { flowType, sessionName, targetKcal, targetProtein, targetWaterMl } = input
  const waterL = (targetWaterMl / 1000).toFixed(1)

  const sessionLine = sessionName
    ? `Séance : ${sessionName}`
    : 'Pas de séance prévue — récupération active'

  let coachSentence: string
  try {
    let context: string
    if (flowType === 'morning') {
      const parts = [
        input.sleepHours    != null ? `sommeil ${input.sleepHours}h`       : null,
        input.sleepQuality  != null ? `qualité ${input.sleepQuality}/4`    : null,
        input.energyLevel   != null ? `énergie ${input.energyLevel}/5`     : null,
      ].filter(Boolean)
      context = parts.length ? parts.join(', ') : 'données non disponibles'
    } else {
      const parts = [
        input.energyLevel    != null ? `énergie ${input.energyLevel}/5`     : null,
        input.muscleSoreness != null ? `courbatures ${input.muscleSoreness}/4` : null,
      ].filter(Boolean)
      context = parts.length ? parts.join(', ') : 'données non disponibles'
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 40,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: `En 10 mots max, une phrase d'encouragement de coach en français pour ce ${flowType === 'morning' ? 'matin' : 'soir'}. Contexte client: ${context}. Style: direct, sans flatterie, sans emoji.`,
      }],
    })
    coachSentence = completion.choices[0]?.message?.content?.trim() ?? ''
  } catch {
    coachSentence = flowType === 'morning' ? 'Lance-toi, la journée est à toi.' : 'Bonne récupération ce soir.'
  }

  return `📋 Ta journée :\n• ${sessionLine}\n• Nutrition : ${targetKcal} kcal | ${targetProtein}g P | ${waterL}L eau\n💬 ${coachSentence}`
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/client/ai-coach/buildDailyBrief.ts
git commit -m "feat(ai-coach): add buildDailyBrief pure function"
```

---

## Task 4: Checkin route — Daily Brief after closing message

**Files:**
- Modify: `app/api/client/checkin/route.ts`

- [ ] **Step 1: Import `buildDailyBrief`**

At the top of `app/api/client/checkin/route.ts`, after the existing imports, add:

```typescript
import { buildDailyBrief } from '@/lib/client/ai-coach/buildDailyBrief'
```

- [ ] **Step 2: Fetch today's planned session and nutrition targets for the brief**

After line `const cc = await resolveClientFromUser(...)`, add a helper fetch (non-blocking, runs independently from the main checkin logic):

```typescript
  const db = svc()
  // Fetch data needed for daily brief (best-effort, non-blocking)
  const briefDataPromise = (async () => {
    try {
      const [programRes, protocolRes] = await Promise.allSettled([
        db.from('programs')
          .select('name, frequency, program_sessions(name, day_of_week, days_of_week)')
          .eq('client_id', cc.id as string)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        db.from('nutrition_protocols')
          .select('nutrition_protocol_days(calories, protein_g, hydration_ml)')
          .eq('client_id', cc.id as string)
          .eq('status', 'shared')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      const activeProgram = programRes.status === 'fulfilled' ? (programRes.value as any)?.data : null
      const protocol      = protocolRes.status === 'fulfilled' ? (protocolRes.value as any)?.data : null
      const protocolDay   = protocol?.nutrition_protocol_days?.[0]

      const todayDow = new Date().getDay()
      const sessions: any[] = activeProgram?.program_sessions ?? []
      const todaySession = sessions.find((s: any) => {
        const dows: number[] = Array.isArray(s.days_of_week) && s.days_of_week.length > 0
          ? s.days_of_week
          : s.day_of_week != null ? [s.day_of_week] : []
        return dows.includes(todayDow)
      })

      return {
        sessionName:    todaySession?.name ?? null,
        targetKcal:     protocolDay?.calories    ?? 0,
        targetProtein:  protocolDay?.protein_g   ?? 0,
        targetWaterMl:  protocolDay?.hydration_ml ?? 2500,
      }
    } catch {
      return { sessionName: null, targetKcal: 0, targetProtein: 0, targetWaterMl: 2500 }
    }
  })()
```

- [ ] **Step 3: Build and insert the daily brief after the closing message**

After the block that inserts `savedMsg` (the closing message), add:

```typescript
  // Daily brief — structured day summary after check-in
  try {
    const briefData = await briefDataPromise
    const { flow_type: ft, data: checkinData } = parsed.data
    const briefContent = await buildDailyBrief({
      flowType:       ft,
      sessionName:    briefData.sessionName,
      targetKcal:     briefData.targetKcal,
      targetProtein:  briefData.targetProtein,
      targetWaterMl:  briefData.targetWaterMl,
      energyLevel:    checkinData.energy_level    ?? null,
      sleepHours:     checkinData.sleep_hours      ?? null,
      sleepQuality:   checkinData.sleep_quality    ?? null,
      muscleSoreness: checkinData.muscle_soreness  ?? null,
    })

    await db.from('chat_messages').insert({
      client_id:    cc.id,
      role:         'assistant',
      content:      briefContent,
      message_type: 'daily_brief',
    })
  } catch {
    // Non-blocking — brief failure must not affect checkin response
  }
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/api/client/checkin/route.ts
git commit -m "feat(ai-coach): insert structured daily brief after check-in closing message"
```

---

## Task 5: Inngest — Morning Brief Function (06:30 UTC)

**Files:**
- Create: `lib/inngest/functions/chat-morning-brief.ts`

- [ ] **Step 1: Create the function**

```typescript
// lib/inngest/functions/chat-morning-brief.ts
import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const chatMorningBriefFunction = inngest.createFunction(
  {
    id: 'chat-morning-brief',
    retries: 2,
    triggers: [{ cron: '30 6 * * *' }], // 06:30 UTC daily
  },
  async ({ step }: { step: any }) => {
    return await step.run('insert-morning-init-messages', async () => {
      const db = svc()
      const today = computePhysiologicalDate(new Date())
      const todayStart = `${today}T00:00:00Z`

      const { data: clients, error } = await db
        .from('coach_clients')
        .select('id, first_name')
        .eq('status', 'active')

      if (error) throw new Error(`chat-morning-brief: ${error.message}`)

      let inserted = 0
      let skipped  = 0

      for (const client of clients ?? []) {
        // Skip if morning check-in already completed today
        const { data: checkin } = await db
          .from('client_daily_checkins')
          .select('id')
          .eq('client_id', client.id)
          .eq('date', today)
          .eq('flow_type', 'morning')
          .maybeSingle()

        if (checkin) { skipped++; continue }

        // Skip if morning_init message already inserted today (retry-safe dedup)
        const { data: existing } = await db
          .from('chat_messages')
          .select('id')
          .eq('client_id', client.id)
          .eq('message_type', 'morning_init')
          .gte('created_at', todayStart)
          .maybeSingle()

        if (existing) { skipped++; continue }

        const { error: insertError } = await db.from('chat_messages').insert({
          client_id:    client.id,
          role:         'assistant',
          content:      `Bonjour ${client.first_name} ! 🌤 Comment s'est passée ta nuit ?`,
          message_type: 'morning_init',
          metadata: {
            component: 'chips',
            key:       'trigger_checkin',
            question:  'Prêt pour ton check-in matin ?',
            options:   [{ label: 'Commencer le check-in', value: 1 }],
          },
        })

        if (!insertError) inserted++
      }

      return { date: today, inserted, skipped }
    })
  }
)
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/inngest/functions/chat-morning-brief.ts
git commit -m "feat(inngest): chat-morning-brief cron 06:30 — proactive morning check-in"
```

---

## Task 6: Inngest — Evening Brief Function (21:30 UTC)

**Files:**
- Create: `lib/inngest/functions/chat-evening-brief.ts`

- [ ] **Step 1: Create the function**

```typescript
// lib/inngest/functions/chat-evening-brief.ts
import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const chatEveningBriefFunction = inngest.createFunction(
  {
    id: 'chat-evening-brief',
    retries: 2,
    triggers: [{ cron: '30 21 * * *' }], // 21:30 UTC daily
  },
  async ({ step }: { step: any }) => {
    return await step.run('insert-evening-init-messages', async () => {
      const db = svc()
      const today = computePhysiologicalDate(new Date())
      const todayStart = `${today}T00:00:00Z`

      const { data: clients, error } = await db
        .from('coach_clients')
        .select('id, first_name')
        .eq('status', 'active')

      if (error) throw new Error(`chat-evening-brief: ${error.message}`)

      let inserted = 0
      let skipped  = 0

      for (const client of clients ?? []) {
        // Skip if evening check-in already completed today
        const { data: checkin } = await db
          .from('client_daily_checkins')
          .select('id')
          .eq('client_id', client.id)
          .eq('date', today)
          .eq('flow_type', 'evening')
          .maybeSingle()

        if (checkin) { skipped++; continue }

        // Skip if evening_init message already inserted today (retry-safe dedup)
        const { data: existing } = await db
          .from('chat_messages')
          .select('id')
          .eq('client_id', client.id)
          .eq('message_type', 'evening_init')
          .gte('created_at', todayStart)
          .maybeSingle()

        if (existing) { skipped++; continue }

        const { error: insertError } = await db.from('chat_messages').insert({
          client_id:    client.id,
          role:         'assistant',
          content:      `Bonsoir ${client.first_name} ! 🌙 Comment se passe ta soirée ?`,
          message_type: 'evening_init',
          metadata: {
            component: 'chips',
            key:       'trigger_checkin',
            question:  'Prêt pour ton check-in soir ?',
            options:   [{ label: 'Commencer le check-in', value: 1 }],
          },
        })

        if (!insertError) inserted++
      }

      return { date: today, inserted, skipped }
    })
  }
)
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/inngest/functions/chat-evening-brief.ts
git commit -m "feat(inngest): chat-evening-brief cron 21:30 — proactive evening check-in"
```

---

## Task 7: Register new Inngest functions

**Files:**
- Modify: `app/api/inngest/route.ts`

- [ ] **Step 1: Add imports and register**

Replace the full content of `app/api/inngest/route.ts` with:

```typescript
import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { checkinStreakEvaluateFunction } from '@/lib/inngest/functions/checkin-streak-evaluate'
import { pointsLevelUpdateFunction } from '@/lib/inngest/functions/points-level-update'
import { checkinStreakExpireFunction } from '@/lib/inngest/functions/checkin-streak-expire'
import { checkinReminderSendFunction } from '@/lib/inngest/functions/checkin-reminder-send'
import { mealAnalyzeFunction } from '@/lib/inngest/functions/meal-analyze'
import { adaptiveTdeeFunction } from '@/lib/inngest/functions/adaptive-tdee'
import { chatArchiveFunction } from '@/lib/inngest/functions/chat-archive'
import { chatMorningBriefFunction } from '@/lib/inngest/functions/chat-morning-brief'
import { chatEveningBriefFunction } from '@/lib/inngest/functions/chat-evening-brief'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    checkinStreakEvaluateFunction,
    pointsLevelUpdateFunction,
    checkinStreakExpireFunction,
    checkinReminderSendFunction,
    mealAnalyzeFunction,
    adaptiveTdeeFunction,
    chatArchiveFunction,
    chatMorningBriefFunction,
    chatEveningBriefFunction,
  ],
})
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/inngest/route.ts
git commit -m "feat(inngest): register chat-morning-brief and chat-evening-brief functions"
```

---

## Task 8: ChatPage — Handle `trigger_checkin` chip

**Files:**
- Modify: `components/client/ChatPage.tsx`

### Context

The proactive messages contain a chip with `key: 'trigger_checkin'`. When the user taps it, `handleInteract` is called with `(messageId, 'trigger_checkin', 1)`. We intercept this key before delegating to the flow handle, mark the message chip as answered, and activate the normal check-in flow.

- [ ] **Step 1: Update `handleInteract` in ChatPage**

Find the current `handleInteract` callback (around line 125):

```typescript
  const handleInteract = useCallback((messageId: string, key: string, value: number) => {
    flowHandle?.handleInteract(messageId, key, value)
  }, [flowHandle])
```

Replace with:

```typescript
  const handleInteract = useCallback((messageId: string, key: string, value: number) => {
    if (key === 'trigger_checkin') {
      // Mark the chip as answered so it can't be tapped again
      updateMessage(messageId, { answered: true })
      // Activate the normal check-in flow as if the user tapped the strip button
      handleCheckinClick()
      return
    }
    flowHandle?.handleInteract(messageId, key, value)
  }, [flowHandle, handleCheckinClick, updateMessage])
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 new errors.

- [ ] **Step 3: Commit**

```bash
git add components/client/ChatPage.tsx
git commit -m "feat(chat): trigger_checkin chip activates check-in flow from proactive messages"
```

---

## Task 9: Update CHANGELOG and project-state

- [ ] **Step 1: Add CHANGELOG entry**

In `CHANGELOG.md`, under today's date add:

```
## 2026-05-21

FEATURE: System prompt v2 — coach identity, full bilan history, active program, tone rules
FEATURE: buildDailyBrief — structured day summary after check-in (session, macros, water, LLM sentence)
FEATURE: chat-morning-brief Inngest cron 06:30 — proactive morning check-in message per active client
FEATURE: chat-evening-brief Inngest cron 21:30 — proactive evening check-in message per active client
FEATURE: ChatPage handles trigger_checkin chip from proactive messages
FIX: water target reads from nutrition_protocol_days.hydration_ml (was hardcoded 2500ml)
FIX: bilan history expanded from 2 to 10 entries for accurate total delta
```

- [ ] **Step 2: Update project-state.md**

Add to the "Dernières Avancées" section and check off the SP3 item in Next Steps.

- [ ] **Step 3: Final commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for proactive AI coach (SP3-A)"
```

---

## Self-Review Checklist

- [x] **Spec coverage**
  - Coach identity → Task 1 (coach name from `user_profiles`) ✓
  - Full bilan history → Task 1 (limit 10, ascending, total delta) ✓
  - Active program in prompt → Task 2 ✓
  - Tone rules → Task 2 ✓
  - Water from protocol → Task 2 ✓
  - `buildDailyBrief` → Task 3 ✓
  - Daily brief after check-in → Task 4 ✓
  - Morning Inngest 06:30 → Task 5 ✓
  - Evening Inngest 21:30 → Task 6 ✓
  - Register functions → Task 7 ✓
  - ChatPage `trigger_checkin` chip → Task 8 ✓
  - Dedup (check-in done + message already sent) → Tasks 5 & 6 ✓
  - Edge cases (no coach, no program, no bilans, retry) → Tasks 1, 2, 5, 6 ✓

- [x] **No placeholders** — all steps have complete code

- [x] **Type consistency**
  - `DailyBriefInput` defined in Task 3, used in Task 4 with matching field names
  - `chatMorningBriefFunction` / `chatEveningBriefFunction` named consistently across Tasks 5, 6, 7
  - `trigger_checkin` key consistent in Tasks 5, 6, 8
  - `message_type: 'morning_init'` / `'evening_init'` consistent in Tasks 5, 6 (dedup check uses same values)
