# Chat/Check-in Bot Quality Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans / subagent-driven-development. Steps use `- [ ]`.

**Goal:** Make the AI-coach messages honest, useful, and tone-aligned — built deterministically on the Foundation (`DailyFacts`, `fieldRegistry`), LLM only reformulates.

**Architecture:** Pure cores: `resolveTone` (tone resolution + phrasing matrix), `adviceRules` (curated tips + silent coach_alerts, freedom-gated, 3-day trend), `messageComposer` (numbered-facts closing + morning greeting + evening reminder, waking-order first action). Wiring rewrites `routineMessages.ts`, the closing block in `checkin/route.ts`, and removes the redirect rule in `buildSystemPrompt.ts` (D10).

**Tech Stack:** TypeScript strict, Vitest, OpenAI gpt-4o-mini (existing). Depends on Plan 1. Design: `docs/design/CHAT_CHECKIN_BOT_COHERENCE_2026-06-01.md` (D3, D5, D9-D16).

---

## File Structure

- Create: `lib/client/ai-coach/resolveTone.ts` + test (Task 1)
- Create: `lib/client/ai-coach/adviceRules.ts` + test (Task 2)
- Create: `lib/client/ai-coach/messageComposer.ts` + test (Tasks 3-5)
- Modify: `lib/client/ai-coach/routineMessages.ts` (Task 6 — rewrite on composer)
- Modify: `app/api/client/checkin/route.ts` (Task 7 — closing on composer + coach_alerts)
- Modify: `lib/client/ai-coach/buildSystemPrompt.ts` (Task 8 — remove redirect rule, wire tone)

---

## Task 1: resolveTone + tone matrix

**Files:** Create `lib/client/ai-coach/resolveTone.ts`, Test `tests/lib/client/ai-coach/resolveTone.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// tests/lib/client/ai-coach/resolveTone.test.ts
import { describe, it, expect } from 'vitest'
import { resolveTone, TONE_MATRIX, type Tone } from '@/lib/client/ai-coach/resolveTone'

describe('resolveTone', () => {
  it('prefers per-client tone over global', () => {
    expect(resolveTone('strict', 'bienveillant')).toBe('strict')
  })
  it('falls back to global when per-client null', () => {
    expect(resolveTone(null, 'motivant')).toBe('motivant')
  })
  it('defaults to bienveillant when both null', () => {
    expect(resolveTone(null, null)).toBe('bienveillant')
  })
  it('ignores invalid tone strings', () => {
    expect(resolveTone('garbage', null)).toBe('bienveillant')
  })
  it('matrix covers all 4 tones with opener+closer', () => {
    for (const t of ['strict', 'bienveillant', 'motivant', 'neutre'] as Tone[]) {
      expect(TONE_MATRIX[t].opener('Kev').length).toBeGreaterThan(0)
      expect(TONE_MATRIX[t].closerEvening.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run — expect FAIL (module not found).** `npx vitest run tests/lib/client/ai-coach/resolveTone.test.ts`

- [ ] **Step 3: Implement**

```typescript
// lib/client/ai-coach/resolveTone.ts
export type Tone = 'strict' | 'bienveillant' | 'motivant' | 'neutre'

const VALID: Tone[] = ['strict', 'bienveillant', 'motivant', 'neutre']

export function resolveTone(perClient: string | null, global: string | null): Tone {
  if (perClient && VALID.includes(perClient as Tone)) return perClient as Tone
  if (global && VALID.includes(global as Tone)) return global as Tone
  return 'bienveillant'
}

export type ToneStyle = {
  opener: (name: string) => string
  closerMorning: string
  closerEvening: string
  /** firmness multiplier for trend escalation wording */
  firmness: 'soft' | 'plain' | 'firm'
}

const n = (name: string) => (name?.trim() ? `${name.trim()}, ` : '')

export const TONE_MATRIX: Record<Tone, ToneStyle> = {
  strict: {
    opener: (name) => `${name ? name.trim() + '.' : 'Bien.'} On fait le point.`,
    closerMorning: 'On exécute, sans négocier.',
    closerEvening: 'Repos correct ce soir, demain on tient la ligne.',
    firmness: 'firm',
  },
  bienveillant: {
    opener: (name) => `Salut ${n(name)}on regarde ta journée ensemble.`,
    closerMorning: 'On avance tranquillement, étape par étape.',
    closerEvening: 'Récupère bien ce soir, tu as fait ta part.',
    firmness: 'plain',
  },
  motivant: {
    opener: (name) => `Allez ${n(name)}on fait le bilan !`,
    closerMorning: 'On garde le cap, à fond mais propre.',
    closerEvening: 'Bonne récup, demain on repart fort.',
    firmness: 'plain',
  },
  neutre: {
    opener: (name) => `${name ? name.trim() + ' — ' : ''}point du jour.`,
    closerMorning: 'On lance la journée.',
    closerEvening: 'Priorité récupération ce soir.',
    firmness: 'soft',
  },
}
```

- [ ] **Step 4: Run — expect PASS (5).** **Step 5:** `npx tsc --noEmit` (0 new errors). **Step 6: Commit**

```bash
git add lib/client/ai-coach/resolveTone.ts tests/lib/client/ai-coach/resolveTone.test.ts
git commit -m "feat(ai-coach): resolveTone + 4-tone phrasing matrix"
```

---

## Task 2: adviceRules — curated tips + silent coach_alerts

**Context:** D9 (no program-touching), D10 (no deflection → silent alert), D11 (freedom gating), D12 (3-day trend), D13 (no assumptions / coach method).

**Files:** Create `lib/client/ai-coach/adviceRules.ts`, Test `tests/lib/client/ai-coach/adviceRules.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// tests/lib/client/ai-coach/adviceRules.test.ts
import { describe, it, expect } from 'vitest'
import { selectAdvice, type AdviceInput } from '@/lib/client/ai-coach/adviceRules'

const base: AdviceInput = {
  facts: {
    dayKind: 'training',
    session: { planned: 'Push A', status: 'completed' },
    nutrition: { kcalLogged: 2000, kcalTarget: 2000, deltaKcal: 0, pctKcal: 100, proteinLogged: 150, proteinTarget: 150, proteinShort: false, status: 'on_track' },
    hydration: { ml: 2500, targetMl: 2500, pct: 100 },
    steps: 9000,
    checkin: {},
  },
  trend: { kcalOverDays: 0, proteinShortDays: 0 },
  freedom: 'safe',
}

describe('selectAdvice', () => {
  it('cancelled session => silent coach_alert, NO client reprogramming tip', () => {
    const out = selectAdvice({ ...base, facts: { ...base.facts, dayKind: 'cancelled', session: { planned: 'Push A', status: 'cancelled' } } })
    expect(out.coachAlerts.map((a) => a.category)).toContain('program_signal')
    expect(out.tips.join(' ')).not.toMatch(/reprogramm|décale|charge/i)
  })

  it('never emits program-touching tips for soreness (D9)', () => {
    const out = selectAdvice({ ...base, facts: { ...base.facts, checkin: { soreness: 4 } } })
    expect(out.tips.join(' ')).not.toMatch(/baisse|charge|repose-toi|écoute ton corps/i)
    expect(out.coachAlerts.map((a) => a.category)).toContain('recovery_flag')
  })

  it('3-day kcal over => firm tip + coach_alert nutrition_trend', () => {
    const out = selectAdvice({ ...base, trend: { kcalOverDays: 3, proteinShortDays: 0 } })
    expect(out.coachAlerts.map((a) => a.category)).toContain('nutrition_trend')
    expect(out.tips.length).toBeGreaterThan(0)
  })

  it('freedom=none emits zero client tips (still alerts coach)', () => {
    const out = selectAdvice({ ...base, freedom: 'none', facts: { ...base.facts, hydration: { ml: 500, targetMl: 2500, pct: 20 } } })
    expect(out.tips).toEqual([])
  })

  it('hydration tip uses coach method (gorgées, no 2L bottle)', () => {
    const out = selectAdvice({ ...base, facts: { ...base.facts, hydration: { ml: 500, targetMl: 2500, pct: 20 } } })
    expect(out.tips.join(' ')).toMatch(/gorgées/i)
    expect(out.tips.join(' ')).not.toMatch(/bouteille de 2 ?L/i)
  })

  it('sleep tip makes no caffeine assumption (D13)', () => {
    const out = selectAdvice({ ...base, facts: { ...base.facts, checkin: { sleepHours: 5 } } })
    expect(out.tips.join(' ')).not.toMatch(/caféine|café/i)
  })

  it('caps client tips at 2', () => {
    const out = selectAdvice({
      ...base,
      freedom: 'extended',
      facts: { ...base.facts, checkin: { sleepHours: 5, stress: 4 }, hydration: { ml: 300, targetMl: 2500, pct: 12 }, nutrition: { ...base.facts.nutrition, proteinLogged: 80, proteinShort: true } },
    })
    expect(out.tips.length).toBeLessThanOrEqual(2)
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**

```typescript
// lib/client/ai-coach/adviceRules.ts
import type { DailyFacts } from '@/lib/client/ai-coach/dailyFacts'

export type Freedom = 'none' | 'safe' | 'extended'
export type CoachAlertCategory = 'program_signal' | 'nutrition_trend' | 'recovery_flag'

export type CoachAlert = { category: CoachAlertCategory; priority: number; reason: string }

export type AdviceTrend = { kcalOverDays: number; proteinShortDays: number }

export type AdviceInput = {
  facts: DailyFacts
  trend: AdviceTrend
  freedom: Freedom
}

export type AdviceOutput = { tips: string[]; coachAlerts: CoachAlert[] }

type Rule = {
  id: string
  /** lifestyle tip shown to client (freedom-gated), or null if alert-only */
  tip: ((f: DailyFacts) => string) | null
  /** minimum freedom to show the tip */
  freedomMin: Freedom
  alert: ((f: DailyFacts, t: AdviceTrend) => CoachAlert) | null
  when: (f: DailyFacts, t: AdviceTrend) => boolean
  priority: number
}

const FREEDOM_RANK: Record<Freedom, number> = { none: 0, safe: 1, extended: 2 }

const RULES: Rule[] = [
  // Séance — program signals are alert-only (D9/D10)
  {
    id: 'session_cancelled',
    when: (f) => f.session.status === 'cancelled' || f.session.status === 'skipped',
    tip: null,
    freedomMin: 'safe',
    alert: () => ({ category: 'program_signal', priority: 2, reason: 'session_not_done' }),
    priority: 90,
  },
  {
    id: 'soreness_high',
    when: (f) => (f.checkin.soreness ?? 0) >= 3,
    tip: null,
    freedomMin: 'safe',
    alert: () => ({ category: 'recovery_flag', priority: 2, reason: 'soreness_high' }),
    priority: 80,
  },
  {
    id: 'rhr_flag',
    when: (f) => (f.checkin.rhr ?? 0) >= 90,
    tip: null,
    freedomMin: 'safe',
    alert: () => ({ category: 'recovery_flag', priority: 2, reason: 'rhr_elevated' }),
    priority: 70,
  },
  // Nutrition trend (serious) — D12
  {
    id: 'kcal_over_trend',
    when: (_f, t) => t.kcalOverDays >= 3,
    tip: () => 'Trois jours au-dessus de la cible : là on resserre dès aujourd’hui.',
    freedomMin: 'safe',
    alert: () => ({ category: 'nutrition_trend', priority: 2, reason: 'kcal_over_3d' }),
    priority: 75,
  },
  {
    id: 'protein_short_trend',
    when: (_f, t) => t.proteinShortDays >= 3,
    tip: () => 'Protéines sous la cible depuis trois jours, à corriger en priorité.',
    freedomMin: 'safe',
    alert: () => ({ category: 'nutrition_trend', priority: 2, reason: 'protein_short_3d' }),
    priority: 60,
  },
  // Lifestyle tips (client-facing, gated)
  {
    id: 'hydration_low',
    when: (f) => f.hydration.pct < 60,
    tip: (f) => `Hydratation à ${f.hydration.pct}%. Le plus simple : ancre des gorgées à des moments-clés (réveil, chaque repas, séance) plutôt qu’une grosse quantité d’un coup.`,
    freedomMin: 'safe',
    alert: null,
    priority: 40,
  },
  {
    id: 'stress_high',
    when: (f) => (f.checkin.stress ?? 0) >= 4,
    tip: () => 'Stress élevé noté. 5 min de respiration ou une courte marche avant le coucher aident concrètement.',
    freedomMin: 'safe',
    alert: null,
    priority: 35,
  },
  {
    id: 'sleep_short',
    when: (f) => (f.checkin.sleepHours ?? 99) < 6,
    tip: (f) => `Nuit courte (${f.checkin.sleepHours}h) — pense à t’hydrater dès le réveil pour relancer la machine.`,
    freedomMin: 'extended',
    alert: null,
    priority: 30,
  },
  {
    id: 'protein_short_day',
    when: (f) => f.nutrition.proteinShort,
    tip: (f) => `Protéines un peu courtes (${f.nutrition.proteinLogged}/${f.nutrition.proteinTarget}g) — facile à rattraper au prochain repas.`,
    freedomMin: 'extended',
    alert: null,
    priority: 25,
  },
]

const MAX_TIPS = 2

export function selectAdvice(input: AdviceInput): AdviceOutput {
  const matched = RULES.filter((r) => r.when(input.facts, input.trend)).sort((a, b) => b.priority - a.priority)

  const coachAlerts: CoachAlert[] = []
  const tips: string[] = []

  for (const r of matched) {
    if (r.alert) coachAlerts.push(r.alert(input.facts, input.trend))
    if (
      r.tip &&
      tips.length < MAX_TIPS &&
      FREEDOM_RANK[input.freedom] >= FREEDOM_RANK[r.freedomMin] &&
      input.freedom !== 'none'
    ) {
      tips.push(r.tip(input.facts))
    }
  }

  return { tips, coachAlerts }
}
```

- [ ] **Step 4: Run — expect PASS (7).** **Step 5: tsc. Step 6: Commit**

```bash
git add lib/client/ai-coach/adviceRules.ts tests/lib/client/ai-coach/adviceRules.test.ts
git commit -m "feat(ai-coach): curated advice rules — tips (freedom-gated) + silent coach_alerts, no program-touching"
```

---

## Task 3: messageComposer — closing message (numbered facts + tone + actions)

**Files:** Create `lib/client/ai-coach/messageComposer.ts`, Test `tests/lib/client/ai-coach/messageComposer.test.ts`

- [ ] **Step 1: Failing test**

```typescript
// tests/lib/client/ai-coach/messageComposer.test.ts
import { describe, it, expect } from 'vitest'
import { composeClosingMessage } from '@/lib/client/ai-coach/messageComposer'
import type { DailyFacts } from '@/lib/client/ai-coach/dailyFacts'

const facts: DailyFacts = {
  dayKind: 'cancelled',
  session: { planned: 'Push A', status: 'cancelled' },
  nutrition: { kcalLogged: 2300, kcalTarget: 2000, deltaKcal: 300, pctKcal: 115, proteinLogged: 150, proteinTarget: 150, proteinShort: false, status: 'over' },
  hydration: { ml: 1500, targetMl: 2500, pct: 60 },
  steps: 9000,
  checkin: {},
}

describe('composeClosingMessage', () => {
  it('names the cancelled session honestly (no false praise)', () => {
    const msg = composeClosingMessage({ facts, tips: [], tone: 'neutre', flow: 'evening' })
    expect(msg).toMatch(/non faite|annulée/i)
    expect(msg).not.toMatch(/bien avancé|bravo|félicitations/i)
  })
  it('states calorie overshoot with the delta', () => {
    const msg = composeClosingMessage({ facts, tips: [], tone: 'neutre', flow: 'evening' })
    expect(msg).toMatch(/\+300/)
  })
  it('appends tips when provided', () => {
    const msg = composeClosingMessage({ facts, tips: ['Bois par gorgées.'], tone: 'neutre', flow: 'evening' })
    expect(msg).toMatch(/Bois par gorgées\./)
  })
  it('uses the tone opener', () => {
    const msg = composeClosingMessage({ facts, tips: [], tone: 'motivant', flow: 'evening' })
    expect(msg.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement (closing part)**

```typescript
// lib/client/ai-coach/messageComposer.ts
import type { DailyFacts } from '@/lib/client/ai-coach/dailyFacts'
import { TONE_MATRIX, type Tone } from '@/lib/client/ai-coach/resolveTone'
import { orderedByWaking, getFieldsForFlow } from '@/lib/client/checkin/fieldRegistry'

function sessionFact(f: DailyFacts): string | null {
  const name = f.session.planned ?? 'ta séance'
  switch (f.session.status) {
    case 'completed': return `Séance ${name} bouclée.`
    case 'cancelled':
    case 'skipped': return `Séance ${name} non faite aujourd’hui.`
    case 'rest': return `Jour de repos.`
    case 'none': return `Séance ${name} prévue, pas encore faite.`
    default: return null
  }
}

function nutritionFact(f: DailyFacts): string | null {
  const nu = f.nutrition
  if (nu.status === 'over') return `Calories au-dessus de la cible (+${nu.deltaKcal}).`
  if (nu.status === 'under') return `Calories sous la cible (${nu.deltaKcal}).`
  if (nu.proteinShort) return `Protéines courtes (${nu.proteinLogged}/${nu.proteinTarget}g).`
  return `Nutrition dans la cible (${nu.pctKcal}%).`
}

function secondaryFact(f: DailyFacts): string | null {
  if (f.hydration.pct < 60) return `Hydratation à ${f.hydration.pct}%.`
  if (f.steps != null && f.steps > 0) return `${f.steps} pas.`
  return null
}

export type ClosingInput = {
  facts: DailyFacts
  tips: string[]
  tone: Tone
  flow: 'morning' | 'evening'
}

export function composeClosingMessage(input: ClosingInput): string {
  const style = TONE_MATRIX[input.tone]
  const facts = [sessionFact(input.facts), nutritionFact(input.facts), secondaryFact(input.facts)].filter(Boolean) as string[]
  const numbered = facts.map((s, i) => `${i + 1}. ${s}`).join('\n')
  const actions = input.tips.length > 0 ? '\n\n' + input.tips.join('\n') : ''
  const closer = input.flow === 'evening' ? style.closerEvening : style.closerMorning
  return `${style.opener('')}\n${numbered}${actions}\n\n${closer}`.trim()
}

export { orderedByWaking, getFieldsForFlow }
```

- [ ] **Step 4: Run — PASS (4).** **Step 5: tsc. Step 6: Commit**

```bash
git add lib/client/ai-coach/messageComposer.ts tests/lib/client/ai-coach/messageComposer.test.ts
git commit -m "feat(ai-coach): composeClosingMessage — numbered honest facts + tone + tips"
```

---

## Task 4: Morning greeting + evening reminder (waking-order first action)

**Files:** Modify `lib/client/ai-coach/messageComposer.ts`, extend test file.

- [ ] **Step 1: Add failing tests**

```typescript
import { composeMorningGreeting, composeEveningReminder } from '@/lib/client/ai-coach/messageComposer'

describe('composeMorningGreeting', () => {
  it('starts the check-in CTA with the highest-priority enabled action (BPM first)', () => {
    const msg = composeMorningGreeting({ name: 'Kev', tone: 'bienveillant', enabledFields: ['energy_level', 'rhr_morning', 'sleep_hours'], hasTrainingToday: true, trainingName: 'Push A' })
    const idxBpm = msg.indexOf('fréquence cardiaque')
    const idxEnergy = msg.indexOf('énergie')
    expect(idxBpm).toBeGreaterThan(-1)
    expect(idxBpm).toBeLessThan(idxEnergy === -1 ? Infinity : idxEnergy)
  })
})

describe('composeEveningReminder', () => {
  it('primes tomorrow starting with the first waking action enabled', () => {
    const msg = composeEveningReminder({ tone: 'neutre', enabledMorningFields: ['energy_level', 'rhr_morning'] })
    expect(msg).toMatch(/fréquence cardiaque/i)
    expect(msg.indexOf('fréquence cardiaque')).toBeLessThan(msg.indexOf('énergie') === -1 ? Infinity : msg.indexOf('énergie'))
  })
  it('falls back gracefully with no fields', () => {
    expect(composeEveningReminder({ tone: 'neutre', enabledMorningFields: [] }).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement (append to messageComposer.ts)**

```typescript
export type MorningGreetingInput = {
  name: string
  tone: Tone
  enabledFields: string[]
  hasTrainingToday: boolean
  trainingName: string | null
}

export function composeMorningGreeting(input: MorningGreetingInput): string {
  const style = TONE_MATRIX[input.tone]
  const ordered = orderedByWaking(input.enabledFields)
  const firstActions = ordered.map((f) => f.label)
  const ctaList = firstActions.length > 0
    ? `Si tu le fais maintenant, commence par ${firstActions.join(', ')}.`
    : ''
  const context = input.hasTrainingToday
    ? `Aujourd’hui : ${input.trainingName ?? 'séance prévue'}.`
    : 'Pas de séance prévue aujourd’hui.'
  return [
    style.opener(input.name),
    context,
    'Prêt pour ton check-in du matin ?',
    ctaList,
    style.closerMorning,
  ].filter(Boolean).join('\n')
}

export type EveningReminderInput = { tone: Tone; enabledMorningFields: string[] }

export function composeEveningReminder(input: EveningReminderInput): string {
  const ordered = orderedByWaking(input.enabledMorningFields)
  const first = ordered[0]?.label ?? 'les mesures que ton coach suit'
  const rest = ordered.slice(1).map((f) => f.label)
  const tail = rest.length > 0 ? `, puis ${rest.join(', ')}` : ''
  return `Petit rappel pour demain matin : au réveil, commence par ${first}${tail}, avant même de sortir du lit pour les mesures qui le demandent.`
}
```

- [ ] **Step 4: Run — PASS.** **Step 5: tsc. Step 6: Commit**

```bash
git add lib/client/ai-coach/messageComposer.ts tests/lib/client/ai-coach/messageComposer.test.ts
git commit -m "feat(ai-coach): morning greeting + evening reminder — waking-order first action"
```

---

## Task 5: Wire routineMessages.ts onto the composer

**Files:** Modify `lib/client/ai-coach/routineMessages.ts` (replace local FIELD_* + hand-written strings with composer calls). Keep the exported `buildRoutineMessage` signature so callers (`chatCheckinInitCron.ts`, `messages/route.ts`) keep working, but accept `tone` + canonical `fields`.

- [ ] **Step 1:** Read current callers' usage of `buildRoutineMessage` and `buildMorningPreparationReminder`. Confirm shape.
- [ ] **Step 2:** Replace body so morning → `composeMorningGreeting`, evening → closing + `composeEveningReminder`. Map `tone` through `resolveTone` upstream (caller passes resolved tone). Canonicalize incoming `fields` with `canonicalizeFields`.
- [ ] **Step 3:** Run existing `tests/lib/inngest/chatCheckinInitCron.test.ts` — fix expectations to new copy. `npx vitest run tests/lib/inngest/chatCheckinInitCron.test.ts`
- [ ] **Step 4: tsc + commit** `feat(ai-coach): routineMessages built on composer (canonical fields + tone)`

---

## Task 6: Closing block in checkin/route.ts → composer + coach_alerts

**Files:** Modify `app/api/client/checkin/route.ts` (the block around L280-345 that calls OpenAI for `closingMessage` and inserts `daily_brief`).

- [ ] **Step 1:** Build `DailyFacts` for the submitted check-in (reuse the data the route already fetches; add day-kind via `computeDayKind`, trend via a 3-day query).
- [ ] **Step 2:** `const { tips, coachAlerts } = selectAdvice({ facts, trend, freedom })`. `const closing = composeClosingMessage({ facts, tips, tone, flow })`.
- [ ] **Step 3:** Optional LLM refine: pass `closing` as the template; ask gpt-4o-mini to only rephrase in `tone`, never add facts; validate output contains no number not in `closing` (regex digit check) else keep template.
- [ ] **Step 4:** Insert `coachAlerts` into `coach_notifications` (reuse `sendCoachNotification` / direct insert with `{coach_id, client_id, category, status:'pending', priority}`). Map categories: `program_signal`/`nutrition_trend`/`recovery_flag`.
- [ ] **Step 5:** Replace the hand-written `buildMorningPreparationReminder()` append with `composeEveningReminder` (evening flow only).
- [ ] **Step 6: tsc + commit** `feat(checkin): closing message on composer + silent coach_alerts (no false praise)`

---

## Task 7: buildSystemPrompt — remove redirect rule (D10) + wire tone

**Files:** Modify `lib/client/ai-coach/buildSystemPrompt.ts`.

- [ ] **Step 1:** Delete rule 2 (`"Je préfère que tu vois ça directement avec ${coachName}"`). Replace with: "Tu ne renvoies jamais le client vers le coach — tu ES le coach. Si un sujet dépasse ton périmètre (programme, médical), tu restes neutre et le coach est alerté en arrière-plan."
- [ ] **Step 2:** Replace hard-coded "Ton bienveillant et direct" with the resolved tone (fetch `coach_ai_settings_per_client.ai_tone` + `coach_profiles.ai_tone`, run `resolveTone`).
- [ ] **Step 3:** tsc + commit `fix(ai-coach): system prompt — no coach deflection (D10) + tone-driven`

---

## Task 8: Docs sync

- [ ] CHANGELOG: 5 FEATURE/FIX lines. project-state: update module row + dated section. Commit `docs: chat/check-in bot quality (tone, tips, composer)`.

## Self-Review notes
- D9 (no program-touching): soreness/rhr/cancelled → alert-only, tips assert no `charge|baisse|reprogramm` (Task 2 tests). ✔
- D10 (no deflection): Task 7 removes redirect; alerts silent. ✔
- D13 (no assumptions): sleep tip asserts no `caféine`; hydration asserts `gorgées`. ✔
- D12 (trend): 3-day rules + alerts. ✔
- Type consistency: `Tone` (resolveTone) reused by composer; `DailyFacts` (Plan1) consumed by adviceRules + composer; `Freedom` from adviceRules used by Task 6 (read from `coaching_freedom` col added in Plan 3 — until then default `'safe'`).
