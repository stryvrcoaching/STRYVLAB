# Chat/Check-in Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the canonical field registry + deterministic daily-facts core that becomes the single source of truth for check-in ⇄ chat coherence.

**Architecture:** Pure, dependency-free TypeScript modules (no DB calls in the cores) so they are unit-testable. A canonical `fieldRegistry` replaces the 3 divergent field vocabularies. `computeDailyFacts` turns already-fetched raw rows into a typed, day-kind-aware facts object (no false "almost complete"). A legacy key remap unblocks the existing coach config data.

**Tech Stack:** TypeScript (strict), Vitest, path alias `@/` → repo root. Reference design: `docs/design/CHAT_CHECKIN_BOT_COHERENCE_2026-06-01.md` (decisions D6, D8, D14).

**Scope of THIS plan:** Tasks 1-4 below ONLY (registry, legacy remap, daily facts, day-kind). Tone, tips library, message builders, coach UI, and the morning-bug fix are separate plans (2-4).

---

## File Structure

- Create: `lib/client/checkin/fieldRegistry.ts` — canonical field defs + helpers (Task 1)
- Create: `tests/lib/client/checkin/fieldRegistry.test.ts` — Task 1
- Create: `lib/client/checkin/legacyFieldMap.ts` — old→canonical key map (Task 2)
- Create: `tests/lib/client/checkin/legacyFieldMap.test.ts` — Task 2
- Create: `scripts/migrate-checkin-config-fields.ts` — one-time idempotent remap of `daily_checkin_configs.moments[].fields` (Task 2)
- Create: `lib/client/ai-coach/dailyFacts.ts` — `DailyFacts` type + `computeDailyFacts` pure fn + `computeDayKind` (Tasks 3-4)
- Create: `tests/lib/client/ai-coach/dailyFacts.test.ts` — Tasks 3-4

---

## Task 1: Canonical field registry

**Files:**
- Create: `lib/client/checkin/fieldRegistry.ts`
- Test: `tests/lib/client/checkin/fieldRegistry.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/client/checkin/fieldRegistry.test.ts
import { describe, it, expect } from 'vitest'
import {
  CHECKIN_FIELDS,
  getFieldsForFlow,
  orderedByWaking,
  getFieldDef,
} from '@/lib/client/checkin/fieldRegistry'

describe('fieldRegistry', () => {
  it('exposes a def per canonical key with a DB column', () => {
    expect(getFieldDef('rhr_morning')?.dbColumn).toBe('rhr_morning')
    expect(getFieldDef('sleep_hours')?.dbColumn).toBe('sleep_hours')
    expect(getFieldDef('weight_kg')?.dbColumn).toBe('weight_kg')
  })

  it('morning flow includes BPM and weight (regression: config used to omit them)', () => {
    const keys = getFieldsForFlow('morning').map((f) => f.key)
    expect(keys).toContain('rhr_morning')
    expect(keys).toContain('weight_kg')
    expect(keys).toContain('sleep_hours')
  })

  it('orders morning waking actions BPM -> sleep_hours -> sleep_quality -> energy -> weight (D6)', () => {
    const ordered = orderedByWaking(['weight_kg', 'energy_level', 'rhr_morning', 'sleep_hours', 'sleep_quality'])
    expect(ordered.map((f) => f.key)).toEqual([
      'rhr_morning',
      'sleep_hours',
      'sleep_quality',
      'energy_level',
      'weight_kg',
    ])
  })

  it('evening flow excludes morning-only fields', () => {
    const keys = getFieldsForFlow('evening').map((f) => f.key)
    expect(keys).toContain('stress_level')
    expect(keys).toContain('daily_steps')
    expect(keys).not.toContain('rhr_morning')
    expect(keys).not.toContain('weight_kg')
  })

  it('every field has a French label', () => {
    for (const f of CHECKIN_FIELDS) {
      expect(f.label.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/client/checkin/fieldRegistry.test.ts`
Expected: FAIL — `Cannot find module '@/lib/client/checkin/fieldRegistry'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/client/checkin/fieldRegistry.ts
export type CheckinFlow = 'morning' | 'evening'

export type CheckinFieldKey =
  | 'rhr_morning'
  | 'sleep_hours'
  | 'sleep_quality'
  | 'energy_level'
  | 'weight_kg'
  | 'stress_level'
  | 'muscle_soreness'
  | 'hunger_level'
  | 'daily_steps'

export type CheckinFieldDef = {
  key: CheckinFieldKey
  dbColumn: string
  flows: CheckinFlow[]
  label: string
  /** Order of the first action on waking (D6). null when not a morning action. */
  wakingPriority: number | null
  unit?: string
  scale?: { min: number; max: number; labels?: Record<number, string> }
}

/** Single source of truth for every check-in field. */
export const CHECKIN_FIELDS: CheckinFieldDef[] = [
  { key: 'rhr_morning',     dbColumn: 'rhr_morning',     flows: ['morning'],            label: 'ta fréquence cardiaque au repos', wakingPriority: 1, unit: 'bpm' },
  { key: 'sleep_hours',     dbColumn: 'sleep_hours',     flows: ['morning'],            label: 'ta durée de sommeil',             wakingPriority: 2, unit: 'h' },
  { key: 'sleep_quality',   dbColumn: 'sleep_quality',   flows: ['morning'],            label: 'ta qualité de sommeil',           wakingPriority: 3, scale: { min: 1, max: 4 } },
  { key: 'energy_level',    dbColumn: 'energy_level',    flows: ['morning', 'evening'], label: 'ton énergie',                     wakingPriority: 4, scale: { min: 1, max: 5 } },
  { key: 'weight_kg',       dbColumn: 'weight_kg',       flows: ['morning'],            label: 'ton poids',                       wakingPriority: 5, unit: 'kg' },
  { key: 'stress_level',    dbColumn: 'stress_level',    flows: ['evening'],            label: 'ton stress',                      wakingPriority: null, scale: { min: 1, max: 5 } },
  { key: 'muscle_soreness', dbColumn: 'muscle_soreness', flows: ['evening'],            label: 'tes courbatures',                 wakingPriority: null, scale: { min: 1, max: 4 } },
  { key: 'hunger_level',    dbColumn: 'hunger_level',    flows: ['evening'],            label: 'ta faim',                         wakingPriority: null, scale: { min: 1, max: 4 } },
  { key: 'daily_steps',     dbColumn: 'daily_steps',     flows: ['evening'],            label: 'tes pas',                         wakingPriority: null, unit: 'pas' },
]

const BY_KEY = new Map<string, CheckinFieldDef>(CHECKIN_FIELDS.map((f) => [f.key, f]))

export function getFieldDef(key: string): CheckinFieldDef | undefined {
  return BY_KEY.get(key)
}

export function getFieldsForFlow(flow: CheckinFlow): CheckinFieldDef[] {
  return CHECKIN_FIELDS.filter((f) => f.flows.includes(flow))
}

/** Sort a set of field keys by waking priority (D6); unknown/non-morning keys go last. */
export function orderedByWaking(keys: string[]): CheckinFieldDef[] {
  return keys
    .map((k) => BY_KEY.get(k))
    .filter((f): f is CheckinFieldDef => Boolean(f))
    .sort((a, b) => (a.wakingPriority ?? 999) - (b.wakingPriority ?? 999))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/client/checkin/fieldRegistry.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/client/checkin/fieldRegistry.ts tests/lib/client/checkin/fieldRegistry.test.ts
git commit -m "feat(checkin): add canonical field registry (single source of truth)"
```

---

## Task 2: Legacy field-key remap + data migration

**Context:** Existing `daily_checkin_configs.moments[].fields` use old keys (`sleep_duration`, `energy`, `energy_evening`, `stress`, `mood`). Map them to canonical keys. `mood` → `stress_level` (decision D14).

**Files:**
- Create: `lib/client/checkin/legacyFieldMap.ts`
- Test: `tests/lib/client/checkin/legacyFieldMap.test.ts`
- Create: `scripts/migrate-checkin-config-fields.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/client/checkin/legacyFieldMap.test.ts
import { describe, it, expect } from 'vitest'
import { canonicalizeFieldKey, canonicalizeFields } from '@/lib/client/checkin/legacyFieldMap'

describe('legacyFieldMap', () => {
  it('maps each legacy key to a canonical key', () => {
    expect(canonicalizeFieldKey('sleep_duration')).toBe('sleep_hours')
    expect(canonicalizeFieldKey('energy')).toBe('energy_level')
    expect(canonicalizeFieldKey('energy_evening')).toBe('energy_level')
    expect(canonicalizeFieldKey('stress')).toBe('stress_level')
    expect(canonicalizeFieldKey('mood')).toBe('stress_level')
  })

  it('passes through already-canonical keys', () => {
    expect(canonicalizeFieldKey('sleep_quality')).toBe('sleep_quality')
    expect(canonicalizeFieldKey('rhr_morning')).toBe('rhr_morning')
  })

  it('dedupes after mapping (energy + energy_evening -> single energy_level)', () => {
    expect(canonicalizeFields(['energy', 'energy_evening', 'stress'])).toEqual(['energy_level', 'stress_level'])
  })

  it('drops unknown keys', () => {
    expect(canonicalizeFields(['sleep_duration', 'totally_unknown'])).toEqual(['sleep_hours'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/client/checkin/legacyFieldMap.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/client/checkin/legacyFieldMap.ts
import { getFieldDef, type CheckinFieldKey } from '@/lib/client/checkin/fieldRegistry'

const LEGACY_TO_CANONICAL: Record<string, CheckinFieldKey> = {
  sleep_duration: 'sleep_hours',
  energy: 'energy_level',
  energy_evening: 'energy_level',
  stress: 'stress_level',
  mood: 'stress_level', // D14
}

/** Returns the canonical key, or undefined if unknown. */
export function canonicalizeFieldKey(key: string): CheckinFieldKey | undefined {
  if (getFieldDef(key)) return key as CheckinFieldKey
  return LEGACY_TO_CANONICAL[key]
}

/** Map a list of (possibly legacy) keys to canonical, dropping unknowns and deduping (stable order). */
export function canonicalizeFields(keys: string[]): CheckinFieldKey[] {
  const out: CheckinFieldKey[] = []
  for (const k of keys) {
    const canon = canonicalizeFieldKey(k)
    if (canon && !out.includes(canon)) out.push(canon)
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/client/checkin/legacyFieldMap.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the one-time migration script**

```typescript
// scripts/migrate-checkin-config-fields.ts
/**
 * One-time idempotent remap of daily_checkin_configs.moments[].fields to canonical keys.
 * Run: npx tsx scripts/migrate-checkin-config-fields.ts
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 */
import { createClient } from '@supabase/supabase-js'
import { canonicalizeFields } from '@/lib/client/checkin/legacyFieldMap'

type Moment = { moment: 'morning' | 'evening'; fields: string[] }

async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await db.from('daily_checkin_configs').select('client_id, moments')
  if (error) throw new Error(error.message)

  let updated = 0
  for (const row of (data ?? []) as Array<{ client_id: string; moments: Moment[] | null }>) {
    const moments = row.moments ?? []
    const next = moments.map((m) => ({ ...m, fields: canonicalizeFields(m.fields ?? []) }))
    const changed = JSON.stringify(next) !== JSON.stringify(moments)
    if (!changed) continue
    const { error: upErr } = await db
      .from('daily_checkin_configs')
      .update({ moments: next })
      .eq('client_id', row.client_id)
    if (upErr) throw new Error(`update ${row.client_id}: ${upErr.message}`)
    updated++
  }
  console.log(`Remapped ${updated} config row(s).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors. (Do NOT run the script yet — it mutates prod data; it runs during the Coach-config plan once the UI writes canonical keys.)

- [ ] **Step 7: Commit**

```bash
git add lib/client/checkin/legacyFieldMap.ts tests/lib/client/checkin/legacyFieldMap.test.ts scripts/migrate-checkin-config-fields.ts
git commit -m "feat(checkin): legacy->canonical field remap + one-time migration script"
```

---

## Task 3: DailyFacts type + computeDailyFacts (deterministic, honest)

**Context:** Turns already-fetched raw values into a typed facts object. No DB calls (testable). Nutrition status bands prevent false "almost complete".

**Files:**
- Create: `lib/client/ai-coach/dailyFacts.ts`
- Test: `tests/lib/client/ai-coach/dailyFacts.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/client/ai-coach/dailyFacts.test.ts
import { describe, it, expect } from 'vitest'
import { computeDailyFacts, type DailyFactsInput } from '@/lib/client/ai-coach/dailyFacts'

const base: DailyFactsInput = {
  dayKind: 'training',
  sessionStatus: 'none',
  plannedSessionName: 'Push A',
  kcalLogged: 2000,
  kcalTarget: 2000,
  proteinLogged: 150,
  proteinTarget: 150,
  hydrationMl: 2500,
  hydrationTargetMl: 2500,
  steps: 9000,
  checkin: {},
}

describe('computeDailyFacts', () => {
  it('marks nutrition over when delta exceeds +200 kcal', () => {
    const f = computeDailyFacts({ ...base, kcalLogged: 2350 })
    expect(f.nutrition.deltaKcal).toBe(350)
    expect(f.nutrition.status).toBe('over')
  })

  it('marks nutrition under when delta below -300 kcal', () => {
    const f = computeDailyFacts({ ...base, kcalLogged: 1600 })
    expect(f.nutrition.status).toBe('under')
  })

  it('marks on_track within band', () => {
    expect(computeDailyFacts({ ...base, kcalLogged: 2100 }).nutrition.status).toBe('on_track')
  })

  it('does NOT report nutrition as complete on a cancelled training day that overshot', () => {
    const f = computeDailyFacts({ ...base, dayKind: 'cancelled', sessionStatus: 'cancelled', kcalLogged: 2300, kcalTarget: 2000 })
    expect(f.session.status).toBe('cancelled')
    expect(f.nutrition.status).toBe('over')
  })

  it('flags protein short below 80% of target', () => {
    const f = computeDailyFacts({ ...base, proteinLogged: 100, proteinTarget: 150 })
    expect(f.nutrition.proteinShort).toBe(true)
  })

  it('computes hydration pct', () => {
    expect(computeDailyFacts({ ...base, hydrationMl: 1250, hydrationTargetMl: 2500 }).hydration.pct).toBe(50)
  })

  it('passes checkin signals through', () => {
    const f = computeDailyFacts({ ...base, checkin: { sleepHours: 5.7, rhr: 55, energy: 3 } })
    expect(f.checkin.sleepHours).toBe(5.7)
    expect(f.checkin.rhr).toBe(55)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/client/ai-coach/dailyFacts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/client/ai-coach/dailyFacts.ts
export type DayKind = 'training' | 'rest' | 'cancelled'
export type SessionStatus = 'completed' | 'skipped' | 'cancelled' | 'rest' | 'none'
export type NutritionStatus = 'under' | 'on_track' | 'over'

const OVER_KCAL = 200   // delta above target -> over
const UNDER_KCAL = -300 // delta below target -> under
const PROTEIN_SHORT_RATIO = 0.8

export type CheckinSignals = {
  sleepHours?: number; sleepQuality?: number; energy?: number
  stress?: number; soreness?: number; rhr?: number; weight?: number
}

export type DailyFactsInput = {
  dayKind: DayKind
  sessionStatus: SessionStatus
  plannedSessionName: string | null
  kcalLogged: number
  kcalTarget: number
  proteinLogged: number
  proteinTarget: number
  hydrationMl: number
  hydrationTargetMl: number
  steps: number | null
  checkin: CheckinSignals
}

export type DailyFacts = {
  dayKind: DayKind
  session: { planned: string | null; status: SessionStatus }
  nutrition: {
    kcalLogged: number; kcalTarget: number; deltaKcal: number; pctKcal: number
    proteinLogged: number; proteinTarget: number; proteinShort: boolean
    status: NutritionStatus
  }
  hydration: { ml: number; targetMl: number; pct: number }
  steps: number | null
  checkin: CheckinSignals
}

function pct(value: number, total: number): number {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

function nutritionStatus(deltaKcal: number): NutritionStatus {
  if (deltaKcal > OVER_KCAL) return 'over'
  if (deltaKcal < UNDER_KCAL) return 'under'
  return 'on_track'
}

export function computeDailyFacts(input: DailyFactsInput): DailyFacts {
  const deltaKcal = Math.round(input.kcalLogged - input.kcalTarget)
  const proteinShort = input.proteinTarget > 0
    ? input.proteinLogged < input.proteinTarget * PROTEIN_SHORT_RATIO
    : false

  return {
    dayKind: input.dayKind,
    session: { planned: input.plannedSessionName, status: input.sessionStatus },
    nutrition: {
      kcalLogged: Math.round(input.kcalLogged),
      kcalTarget: Math.round(input.kcalTarget),
      deltaKcal,
      pctKcal: pct(input.kcalLogged, input.kcalTarget),
      proteinLogged: Math.round(input.proteinLogged),
      proteinTarget: Math.round(input.proteinTarget),
      proteinShort,
      status: nutritionStatus(deltaKcal),
    },
    hydration: { ml: input.hydrationMl, targetMl: input.hydrationTargetMl, pct: pct(input.hydrationMl, input.hydrationTargetMl) },
    steps: input.steps,
    checkin: input.checkin,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/client/ai-coach/dailyFacts.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` (expect 0 errors), then:

```bash
git add lib/client/ai-coach/dailyFacts.ts tests/lib/client/ai-coach/dailyFacts.test.ts
git commit -m "feat(ai-coach): deterministic DailyFacts core (honest nutrition status, day-kind aware)"
```

---

## Task 4: computeDayKind + computeSessionStatus

**Context:** Derive `dayKind`/`sessionStatus` from raw inputs (planned session, completion, skip row, day override). This is what makes "séance annulée → cible repos" honest.

**Files:**
- Modify: `lib/client/ai-coach/dailyFacts.ts` (add `computeDayKind`)
- Test: `tests/lib/client/ai-coach/dailyFacts.test.ts` (add cases)

- [ ] **Step 1: Add the failing test**

Append to `tests/lib/client/ai-coach/dailyFacts.test.ts`:

```typescript
import { computeDayKind } from '@/lib/client/ai-coach/dailyFacts'

describe('computeDayKind', () => {
  it('training when a session is planned and not skipped/overridden', () => {
    expect(computeDayKind({ plannedSessionName: 'Push A', completed: false, skipped: false, overrideOff: false }))
      .toEqual({ dayKind: 'training', sessionStatus: 'none' })
  })

  it('completed when the session was logged', () => {
    expect(computeDayKind({ plannedSessionName: 'Push A', completed: true, skipped: false, overrideOff: false }))
      .toEqual({ dayKind: 'training', sessionStatus: 'completed' })
  })

  it('cancelled when a planned training day is overridden off', () => {
    expect(computeDayKind({ plannedSessionName: 'Push A', completed: false, skipped: false, overrideOff: true }))
      .toEqual({ dayKind: 'cancelled', sessionStatus: 'cancelled' })
  })

  it('skipped when an explicit skip row exists', () => {
    expect(computeDayKind({ plannedSessionName: 'Push A', completed: false, skipped: true, overrideOff: false }))
      .toEqual({ dayKind: 'cancelled', sessionStatus: 'skipped' })
  })

  it('rest when nothing was planned', () => {
    expect(computeDayKind({ plannedSessionName: null, completed: false, skipped: false, overrideOff: false }))
      .toEqual({ dayKind: 'rest', sessionStatus: 'rest' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/client/ai-coach/dailyFacts.test.ts`
Expected: FAIL — `computeDayKind` is not exported.

- [ ] **Step 3: Implement computeDayKind**

Append to `lib/client/ai-coach/dailyFacts.ts`:

```typescript
export type DayKindInput = {
  plannedSessionName: string | null
  completed: boolean
  skipped: boolean
  overrideOff: boolean
}

export function computeDayKind(input: DayKindInput): { dayKind: DayKind; sessionStatus: SessionStatus } {
  if (!input.plannedSessionName) return { dayKind: 'rest', sessionStatus: 'rest' }
  if (input.completed) return { dayKind: 'training', sessionStatus: 'completed' }
  if (input.skipped) return { dayKind: 'cancelled', sessionStatus: 'skipped' }
  if (input.overrideOff) return { dayKind: 'cancelled', sessionStatus: 'cancelled' }
  return { dayKind: 'training', sessionStatus: 'none' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/client/ai-coach/dailyFacts.test.ts`
Expected: PASS (all, incl. 5 new).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` (expect 0 errors), then:

```bash
git add lib/client/ai-coach/dailyFacts.ts tests/lib/client/ai-coach/dailyFacts.test.ts
git commit -m "feat(ai-coach): computeDayKind (training/rest/cancelled/skipped) for honest facts"
```

---

## Task 5: Docs sync

- [ ] **Step 1: Update CHANGELOG.md**

Add under today's date section (create `## 2026-06-01` if missing), at the top:

```
FEATURE: Add canonical check-in field registry (single source of truth)
FEATURE: Add legacy->canonical field remap + migration script
FEATURE: Add deterministic DailyFacts core (day-kind aware, honest nutrition status)
```

- [ ] **Step 2: Update project-state.md**

Under "Modules", add row: `| Chat/Check-in Coherence | 🚧 Foundation (registry + facts) | 2026-06-01 |`. Add a dated section summarizing the 3 new modules and pointing to `docs/design/CHAT_CHECKIN_BOT_COHERENCE_2026-06-01.md`.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: foundation for chat/check-in coherence (registry + facts)"
```

---

## Self-Review notes

- Spec coverage (foundation slice): D6 waking order ✔ (Task 1), D8 canonical registry ✔ (Task 1), D14 mood→stress ✔ (Task 2), honest day-kind/nutrition ✔ (Tasks 3-4). Tone/tips/builders/coach-UI/bug-fix intentionally out of this plan (Plans 2-4).
- Type consistency: `CheckinFieldKey`, `DayKind`, `SessionStatus`, `NutritionStatus` reused across tasks; `computeDailyFacts` consumes the same `SessionStatus`/`DayKind` that `computeDayKind` produces.
- Thresholds (OVER_KCAL=+200 / UNDER_KCAL=-300) are the facts-band defaults; advice bands (+100/+300/+400, 3-day trend) live in Plan 2's tips library, not here.

## Next plans (to write after this one)

- **Plan 2 — Bot quality:** `resolveTone` + tone matrix, `adviceRules` tips library (scope tip|coach_alert, freedom gating), message builders (closing numbered-facts, morning greeting, evening reminder), wire into `checkin/route.ts` + `routineMessages.ts`, remove buildSystemPrompt redirect rule (D10), reuse `coach_notifications`.
- **Plan 3 — Coach config:** relocate check-in config into profil IA section, expose all canonical fields (incl. BPM/weight), add `coaching_freedom` column (none/safe/extended, default safe), run migration script.
- **Plan 4 — Morning bug:** make cron the proactive source of morning_init + unread badge + push; refetch on visibilitychange/focus in ChatPage + today-strip; route cron/GET/today-strip through `dailyCoachState`.
