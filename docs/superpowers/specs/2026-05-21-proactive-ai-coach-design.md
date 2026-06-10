# Proactive AI Coach — Design Spec

**Date:** 2026-05-21
**Sub-project:** Chat SP3-A (Proactive Messages + System Prompt v2)
**Status:** Approved — ready for implementation plan

---

## Problem

The AI coach currently:
1. Responds only when the user initiates — no proactive engagement
2. Reads only the last 2 bilans → gives incorrect delta ("gained 1.3kg" when total is +9.4kg)
3. Has no awareness of the human coach behind the platform (treats itself as a standalone AI)
4. Gives generic LLM-style advice instead of referencing the coach's actual program/plan
5. Hardcodes water target at 2500ml instead of reading the nutrition protocol
6. Has no post-check-in daily brief (user completes check-in, gets a closing message, but no structured day plan)

---

## Solution Overview

Three independent components, delivered together:

| Component | Files | Impact |
|-----------|-------|--------|
| System Prompt v2 | `lib/client/ai-coach/buildSystemPrompt.ts` | Immediate improvement to every chat message |
| Proactive Messages | 2 new Inngest functions + ChatPage | Morning/evening check-in initiation |
| Post-Check-in Daily Brief | `/api/client/checkin/route.ts` | Structured day summary after check-in |

---

## Component 1 — System Prompt v2

### New data fetches

**Coach identity** — add to the existing `Promise.allSettled`:
```typescript
// coach_clients already fetched — grab coach_id from it
// then:
db.from('user_profiles')
  .select('first_name, last_name')
  .eq('id', coachId)   // coachId from coach_clients.coach_id
  .single()
```

**Full bilan history** — change `limit(2)` to `limit(10)`:
```typescript
db.from('assessment_submissions')
  .select('bilan_date, assessment_responses(field_key, value_number)')
  .eq('client_id', clientId)
  .eq('status', 'completed')
  .order('bilan_date', { ascending: true })  // ascending to get first → latest
  .limit(10)
```
Compute:
- `firstBilan` = bilans[0], `latestBilan` = bilans[last]
- Total delta: `latestWeight - firstWeight`, `latestBF - firstBF`
- Show all intermediate bilans as a compact table

**Active program** — new fetch:
```typescript
db.from('programs')
  .select('name, weeks, frequency, program_sessions(id, name, day_of_week)')
  .eq('client_id', clientId)
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
// frequency = sessions/week (int column)
// weeks = total duration
// today's session = program_sessions where day_of_week === new Date().getDay() (0=Sun,1=Mon...)
```

**Hydration target** — from protocol instead of hardcoded:
```typescript
// In protocolDay: read hydration_ml field
const targetWaterMl = protocolDay?.hydration_ml ?? 2500
```

**Today's planned sessions** — new fetch (not completed, but planned):
```typescript
db.from('program_sessions')
  .select('name, day_of_week')
  .eq('program_id', activeProgramId)
  // filter by today's day_of_week
```

### New system prompt structure

```
Tu es l'assistant de [Coach First Last], coach certifié personnel de [Client First].
[Coach] a créé son programme d'entraînement, établi ses objectifs nutritionnels, et suit
sa progression. Tu parles EN SON NOM, comme son prolongement direct.

RÈGLES DE COMPORTEMENT — NON NÉGOCIABLES:
- Réponds en 2-3 phrases MAXIMUM. Direct et affirmatif.
- Ne donne JAMAIS de conseils nutritionnels génériques — [Coach] a déjà calculé les macros et les calories.
- Ne propose JAMAIS d'ajuster les macros, les calories ou le programme — c'est la responsabilité du coach.
- Ne dis JAMAIS "tu pourrais essayer" ou "une option serait" — affirme ce que les données montrent.
- Si une donnée manque, dis-le en une phrase et demande-la.
- Réfère-toi au programme comme "le programme que [Coach] t'a préparé".
- Langue: français uniquement.

[PROFIL CLIENT]
Prénom: ...
Objectif: ...
Niveau: ...
Restrictions: ...

[PROGRAMME ACTIF]
Nom: [program name] | Semaine X / Y | X séances/semaine
Séance prévue aujourd'hui: [name] ou Repos

[ÉVOLUTION CORPORELLE COMPLÈTE]
Début du suivi ([date]): Xkg | MG X%
[date]: Xkg | MG X%  (bilans intermédiaires)
Actuel ([date]): Xkg | MG X%
PROGRESSION TOTALE: +Xkg poids | X% MG

[PROTOCOLE NUTRITIONNEL]
Cible jour actuel: X kcal / Px g / Lx g / Gx g / Xx ml eau

[JOURNÉE — DD/MM HH:mm]
Nutrition: Xkcal/Xcible (X%) | P Xg/Xg | ...
Repas: ...
Eau: Xml/Xml (X%)
Séance: complétée/non

[TENDANCES 3J]
...

[CHECK-INS DU JOUR]
Matin: ...
Soir: ...
```

---

## Component 2 — Proactive Morning/Evening Messages

### Architecture

```
Inngest cron 06:30 UTC daily
  → event: chat/morning-brief.fan-out
  → step: fetch all active clients (status='active')
  → for each client: send chat/morning-brief.requested { clientId }

Inngest handler: chat/morning-brief.requested
  → check: client_daily_checkins WHERE date=today AND flow_type='morning' → if exists, SKIP
  → insert into chat_messages:
      role: 'assistant'
      message_type: 'morning_init'
      content: "Bonjour [Name] ! 🌤 Comment s'est passée ta nuit ?"
      metadata: { component: 'chips', key: 'trigger_checkin', ... options: [{ label: 'Commencer', value: 1 }] }
      session_id: NULL (not tied to a session)

Same pattern at 21:30 UTC for evening:
  → event: chat/evening-brief.requested
  → content: "Bonsoir [Name] ! Comment se passe ta soirée ?"
  → check: flow_type='evening'
```

### New Inngest function files

- `lib/inngest/functions/chat-morning-brief.ts`
- `lib/inngest/functions/chat-evening-brief.ts`
- Register both in `app/api/inngest/route.ts`

### ChatPage wiring

`ChatPage.tsx` already handles `onInteract` on chips. Add case:

```typescript
if (key === 'trigger_checkin') {
  // Same as clicking the check-in button
  const flow = determineFlow(new Date().getHours(), todayData?.sessions ?? [])
  setActiveFlow(flow)
  setFlowKey(k => k + 1)
}
```

### Deduplication

- Morning: skip if `client_daily_checkins` has `date=today, flow_type='morning'`
- Evening: skip if `flow_type='evening'`
- Also skip if `chat_messages` already has `message_type='morning_init'` for today (prevents double-insert if job retries)

---

## Component 3 — Post-Check-in Daily Brief

### Location

`app/api/client/checkin/route.ts` — after the existing LLM closing message is inserted.

### Brief structure

A second assistant message inserted immediately after the LLM closing message:

```typescript
const brief = buildDailyBrief({
  sessionToday,       // planned session name or null
  targetKcal,
  targetProtein,
  targetWaterMl,
  checkinData,        // for a personalized coaching sentence
})
```

Format (not LLM-generated, structured):
```
📋 Ta journée :
• Séance : Push Press — Pecs / Épaules / Triceps
• Nutrition : 2800 kcal | 185g P | 3L eau
• [1 coaching sentence from LLM — max 15 words, based on check-in data]
```

### `buildDailyBrief` function

New pure function in `lib/client/ai-coach/buildDailyBrief.ts`:
- Takes structured data
- Returns a formatted string
- LLM generates only the 1 coaching sentence (separate targeted call, max_tokens: 40)

---

## Data Model

No schema changes required. All data already exists:
- `assessment_submissions` + `assessment_responses` — bilans (expand limit)
- `programs` + `program_sessions` — active program
- `nutrition_protocol_days.hydration_ml` — water target (field already exists)
- `chat_messages` — proactive messages inserted by Inngest
- `client_daily_checkins` — dedup check

---

## Edge Cases

| Case | Handling |
|------|----------|
| Client has no coach | `coachName = 'ton coach'` fallback |
| No active program | `[PROGRAMME ACTIF]` block omitted |
| No bilans | `[ÉVOLUTION CORPORELLE]` shows "Aucun bilan enregistré" |
| Morning check-in already done before 6:30 | Inngest skips insert |
| User never opens app in morning | Message sits in chat, visible whenever they open |
| Inngest retry on failure | Dedup check on `chat_messages` prevents double-insert |
| No nutrition protocol | Water target = 2500ml fallback, macros = estimated from TDEE |

---

## Implementation Order

1. System Prompt v2 (independent, immediate value)
2. Post-check-in daily brief (`buildDailyBrief` + `/api/client/checkin` update)
3. Proactive morning Inngest function
4. Proactive evening Inngest function
5. ChatPage wiring for `trigger_checkin` chip

---

## Out of Scope

- Evening snooze / defer ("dans 2h") — v2
- User-configurable notification time — v2
- Push notifications (SP3-B, separate sub-project)
- Multi-language daily brief — v2
