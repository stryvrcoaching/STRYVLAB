# Cycle Sync v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add gold-standard menstrual cycle tracking to the client PWA — history-based engine that learns personal cycle length, phase pill in TopBars, FAB period logging, profile section, enriched ProtocolRationale, and Nutrition Studio integration.

**Architecture:** New `menstrual_cycle_logs` table stores period start/end history; `lib/cycle/cycleEngine.ts` computes `CycleState` (current phase, dynamic cycle length from personal avg, confidence level); two API routes (client + coach); UI components gated on `gender === 'female' && hasActiveCycle`.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase (service role + auth), Vitest, Framer Motion, Phosphor Icons.

---

## File Map

**New files:**
- `supabase/migrations/20260526_menstrual_cycle_logs.sql`
- `lib/cycle/cycleEngine.ts`
- `tests/lib/cycle/cycleEngine.test.ts`
- `app/api/client/cycle/log/route.ts`
- `app/api/client/cycle/status/route.ts`
- `app/api/clients/[clientId]/cycle/status/route.ts`
- `components/client/cycle/CyclePhasePill.tsx`
- `components/client/cycle/LogPeriodSheet.tsx`

**Modified files:**
- `app/client/nutrition/page.tsx` — fetch CycleState server-side, pass to client component
- `app/client/nutrition/NutritionClientPage.tsx` — accept cycleState, show pill in TopBar
- `app/client/programme/ProgrammeClientPage.tsx` — fetch + show CyclePhasePill
- `app/client/programme/session/[sessionId]/SessionLogger.tsx` — show CyclePhasePill
- `components/client/QuickLogSheet.tsx` — add Cycle action (conditional)
- `app/client/profil/page.tsx` — pass cycleState to ProfilAccordion
- `components/client/profile/ProfilAccordion.tsx` — add Cycle section
- `components/client/smart/ProtocolRationale.tsx` — per-day-type accordions + cycle step
- `components/nutrition/studio/useNutritionStudio.ts` — fetch cycleState for coach
- `components/nutrition/studio/CalculationEngine.tsx` — show cycle as second source of truth

---

## Task 1: Migration

**Files:**
- Create: `supabase/migrations/20260526_menstrual_cycle_logs.sql`

- [ ] **Step 1: Write migration file**

```sql
-- menstrual_cycle_logs — Cycle Sync v2
-- client_id references coach_clients (the internal client profile table)

CREATE TABLE menstrual_cycle_logs (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  period_start_date           date NOT NULL,
  period_end_date             date NULL,
  computed_cycle_length_days  int NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cycle_start UNIQUE (client_id, period_start_date)
);

CREATE INDEX idx_cycle_logs_client_date
  ON menstrual_cycle_logs(client_id, period_start_date DESC);

ALTER TABLE menstrual_cycle_logs ENABLE ROW LEVEL SECURITY;

-- Client: full access to own rows
CREATE POLICY "cycle_logs_client_own"
  ON menstrual_cycle_logs FOR ALL
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );

-- Coach: read-only access to their clients' rows
CREATE POLICY "cycle_logs_coach_read"
  ON menstrual_cycle_logs FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply migration**

Apply manually via Supabase Dashboard → SQL Editor. Paste the SQL above and run. Verify no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260526_menstrual_cycle_logs.sql
git commit -m "schema: add menstrual_cycle_logs table with RLS"
```

---

## Task 2: Cycle Engine

**Files:**
- Create: `lib/cycle/cycleEngine.ts`
- Create: `tests/lib/cycle/cycleEngine.test.ts`

The engine is pure logic — no DB calls, fully unit-testable. `CyclePhase` is imported from the existing `lib/nutrition/engine/cycleSync.ts` to avoid duplication.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/lib/cycle/cycleEngine.test.ts
import { describe, it, expect } from 'vitest'
import {
  hasActiveCycleFromBilan,
  computeAvgCycleLength,
  computeAvgMenstrualLength,
  computeCurrentCycleDay,
  detectPhase,
  computeNextPhaseIn,
  getCycleStateFromLogs,
} from '@/lib/cycle/cycleEngine'
import type { CycleLog } from '@/lib/cycle/cycleEngine'

// ── hasActiveCycleFromBilan ──────────────────────────────────────────

describe('hasActiveCycleFromBilan', () => {
  it('returns false for Ménopause / Aménorrhée', () => {
    expect(hasActiveCycleFromBilan('Ménopause / Aménorrhée')).toBe(false)
  })
  it('returns false for Non applicable', () => {
    expect(hasActiveCycleFromBilan('Non applicable')).toBe(false)
  })
  it('returns true for null (unknown = assume active)', () => {
    expect(hasActiveCycleFromBilan(null)).toBe(true)
  })
  it('returns true for active phase value', () => {
    expect(hasActiveCycleFromBilan('Phase folliculaire (J1–J13)')).toBe(true)
  })
})

// ── computeAvgCycleLength ────────────────────────────────────────────

const makeLog = (length: number | null): CycleLog => ({
  period_start_date: '2026-01-01',
  period_end_date: null,
  computed_cycle_length_days: length,
})

describe('computeAvgCycleLength', () => {
  it('returns 28 for empty logs', () => {
    expect(computeAvgCycleLength([])).toBe(28)
  })
  it('returns 28 when all lengths are null', () => {
    expect(computeAvgCycleLength([makeLog(null)])).toBe(28)
  })
  it('averages multiple valid lengths', () => {
    expect(computeAvgCycleLength([makeLog(27), makeLog(29), makeLog(28)])).toBe(28)
  })
  it('filters out outliers outside 21–35', () => {
    // 15 filtered → only 28 remains → avg = 28
    expect(computeAvgCycleLength([makeLog(15), makeLog(28)])).toBe(28)
  })
  it('rounds correctly', () => {
    expect(computeAvgCycleLength([makeLog(27), makeLog(28)])).toBe(28)
  })
})

// ── computeAvgMenstrualLength ────────────────────────────────────────

describe('computeAvgMenstrualLength', () => {
  it('returns 5 for empty logs', () => {
    expect(computeAvgMenstrualLength([])).toBe(5)
  })
  it('returns 5 when no end dates', () => {
    expect(computeAvgMenstrualLength([makeLog(28)])).toBe(5)
  })
  it('calculates from start/end date diff', () => {
    const log: CycleLog = {
      period_start_date: '2026-05-01',
      period_end_date: '2026-05-05',
      computed_cycle_length_days: 28,
    }
    expect(computeAvgMenstrualLength([log])).toBe(4)
  })
})

// ── computeCurrentCycleDay ───────────────────────────────────────────

describe('computeCurrentCycleDay', () => {
  it('returns 1 on the day of period start', () => {
    const today = new Date('2026-06-01')
    expect(computeCurrentCycleDay('2026-06-01', 28, today)).toBe(1)
  })
  it('returns 14 on day 14', () => {
    const today = new Date('2026-06-14')
    expect(computeCurrentCycleDay('2026-06-01', 28, today)).toBe(14)
  })
  it('wraps correctly after full cycle', () => {
    // start May 1, today = May 29 = day 29 of 28-day cycle = day 1 of next cycle
    const today = new Date('2026-05-29')
    expect(computeCurrentCycleDay('2026-05-01', 28, today)).toBe(1)
  })
})

// ── detectPhase ──────────────────────────────────────────────────────

describe('detectPhase (28d cycle, 5d menstrual)', () => {
  it('day 1–5 = menstrual', () => {
    expect(detectPhase(1, 28, 5)).toBe('menstrual')
    expect(detectPhase(5, 28, 5)).toBe('menstrual')
  })
  it('day 6–13 = follicular', () => {
    expect(detectPhase(6, 28, 5)).toBe('follicular')
    expect(detectPhase(13, 28, 5)).toBe('follicular')
  })
  it('day 14–15 = ovulatory', () => {
    expect(detectPhase(14, 28, 5)).toBe('ovulatory')
    expect(detectPhase(15, 28, 5)).toBe('ovulatory')
  })
  it('day 16–28 = luteal', () => {
    expect(detectPhase(16, 28, 5)).toBe('luteal')
    expect(detectPhase(28, 28, 5)).toBe('luteal')
  })
})

describe('detectPhase (30d cycle, 4d menstrual)', () => {
  it('ovulation at day 15 (floor(30/2))', () => {
    expect(detectPhase(15, 30, 4)).toBe('ovulatory')
  })
  it('follicular from day 5 to 14', () => {
    expect(detectPhase(10, 30, 4)).toBe('follicular')
  })
})

// ── getCycleStateFromLogs ────────────────────────────────────────────

describe('getCycleStateFromLogs — no active cycle', () => {
  it('returns hasActiveCycle: false, nulls for phase', () => {
    const state = getCycleStateFromLogs([], 'Ménopause / Aménorrhée', new Date())
    expect(state.hasActiveCycle).toBe(false)
    expect(state.currentPhase).toBeNull()
    expect(state.currentCycleDay).toBeNull()
  })
})

describe('getCycleStateFromLogs — no logs, estimated from bilan', () => {
  it('estimates follicular from bilan text', () => {
    const state = getCycleStateFromLogs([], 'Phase folliculaire (J1–J13)', new Date())
    expect(state.confidence).toBe('estimated')
    expect(state.currentPhase).toBe('follicular')
    expect(state.currentCycleDay).toBe(7)
  })
  it('estimates luteal from bilan text', () => {
    const state = getCycleStateFromLogs([], 'Phase lutéale (J15–J28)', new Date())
    expect(state.currentPhase).toBe('luteal')
    expect(state.currentCycleDay).toBe(21)
  })
  it('returns null phase for unknown bilan value', () => {
    const state = getCycleStateFromLogs([], null, new Date())
    expect(state.currentPhase).toBeNull()
    expect(state.confidence).toBe('estimated')
  })
})

describe('getCycleStateFromLogs — with logs', () => {
  it('confidence = learning for 1–3 logs', () => {
    const logs: CycleLog[] = [
      { period_start_date: '2026-05-01', period_end_date: null, computed_cycle_length_days: 28 },
    ]
    const state = getCycleStateFromLogs(logs, null, new Date('2026-05-08'))
    expect(state.confidence).toBe('learning')
    expect(state.currentCycleDay).toBe(8)
    expect(state.currentPhase).toBe('follicular')
  })
  it('confidence = calibrated for 4+ logs', () => {
    const logs: CycleLog[] = Array.from({ length: 4 }, (_, i) => ({
      period_start_date: `2026-0${i + 1}-01`,
      period_end_date: null,
      computed_cycle_length_days: 28,
    }))
    const state = getCycleStateFromLogs(logs, null, new Date('2026-04-15'))
    expect(state.confidence).toBe('calibrated')
  })
  it('uses personal avgCycleLengthDays', () => {
    const logs: CycleLog[] = [
      { period_start_date: '2026-05-01', period_end_date: null, computed_cycle_length_days: 26 },
      { period_start_date: '2026-04-05', period_end_date: null, computed_cycle_length_days: 26 },
    ]
    const state = getCycleStateFromLogs(logs, null, new Date('2026-05-08'))
    expect(state.avgCycleLengthDays).toBe(26)
  })
})
```

- [ ] **Step 2: Run tests — verify they all fail (functions not defined)**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run tests/lib/cycle/cycleEngine.test.ts 2>&1 | tail -20
```

Expected: FAIL — "Cannot find module '@/lib/cycle/cycleEngine'"

- [ ] **Step 3: Implement cycle engine**

```typescript
// lib/cycle/cycleEngine.ts
import type { CyclePhase } from '@/lib/nutrition/engine/cycleSync'

export type { CyclePhase }

export interface CycleLog {
  period_start_date: string
  period_end_date: string | null
  computed_cycle_length_days: number | null
}

export interface CycleState {
  hasActiveCycle: boolean
  currentPhase: CyclePhase | null
  currentCycleDay: number | null
  avgCycleLengthDays: number
  menstrualPhaseLengthDays: number
  nextPhaseIn: number | null
  lastPeriodDate: string | null
  logsCount: number
  confidence: 'estimated' | 'learning' | 'calibrated'
}

const NO_CYCLE_BILAN_VALUES = ['Ménopause / Aménorrhée', 'Non applicable']

export function hasActiveCycleFromBilan(bilanValue: string | null): boolean {
  if (!bilanValue) return true
  return !NO_CYCLE_BILAN_VALUES.includes(bilanValue)
}

export function computeAvgCycleLength(logs: CycleLog[]): number {
  const valid = logs
    .map(l => l.computed_cycle_length_days)
    .filter((n): n is number => n !== null && n >= 21 && n <= 35)
  if (valid.length === 0) return 28
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
}

export function computeAvgMenstrualLength(logs: CycleLog[]): number {
  const durations = logs
    .filter(l => l.period_end_date !== null)
    .map(l => {
      const start = new Date(l.period_start_date)
      const end = new Date(l.period_end_date!)
      return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    })
    .filter(d => d >= 1 && d <= 14)
  if (durations.length === 0) return 5
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
}

export function computeCurrentCycleDay(
  lastPeriodStartDate: string,
  avgCycleLength: number,
  today: Date = new Date(),
): number {
  const start = new Date(lastPeriodStartDate)
  const t = new Date(today)
  t.setHours(0, 0, 0, 0)
  start.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((t.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return (diffDays % avgCycleLength) + 1
}

export function detectPhase(
  cycleDay: number,
  avgCycleLength: number,
  menstrualLength: number,
): CyclePhase {
  if (cycleDay <= menstrualLength) return 'menstrual'
  const ovulationDay = Math.floor(avgCycleLength / 2)
  if (cycleDay < ovulationDay) return 'follicular'
  if (cycleDay <= ovulationDay + 1) return 'ovulatory'
  return 'luteal'
}

export function computeNextPhaseIn(
  cycleDay: number,
  phase: CyclePhase,
  avgCycleLength: number,
  menstrualLength: number,
): number {
  const ovulationDay = Math.floor(avgCycleLength / 2)
  switch (phase) {
    case 'menstrual':  return Math.max(1, menstrualLength - cycleDay + 1)
    case 'follicular': return Math.max(1, ovulationDay - cycleDay)
    case 'ovulatory':  return Math.max(1, ovulationDay + 2 - cycleDay)
    case 'luteal':     return Math.max(1, avgCycleLength - cycleDay + 1)
  }
}

const BILAN_ESTIMATE_DAY: Record<string, number> = {
  'Phase folliculaire (J1–J13)': 7,
  'Ovulation (J14)': 14,
  'Phase lutéale (J15–J28)': 21,
  'Règles': 1,
}

export function getCycleStateFromLogs(
  logs: CycleLog[],
  bilanValue: string | null,
  today: Date = new Date(),
): CycleState {
  const hasActiveCycle = hasActiveCycleFromBilan(bilanValue)

  if (!hasActiveCycle) {
    return {
      hasActiveCycle: false,
      currentPhase: null,
      currentCycleDay: null,
      avgCycleLengthDays: 28,
      menstrualPhaseLengthDays: 5,
      nextPhaseIn: null,
      lastPeriodDate: null,
      logsCount: 0,
      confidence: 'estimated',
    }
  }

  const avgCycleLength = computeAvgCycleLength(logs)
  const menstrualLength = computeAvgMenstrualLength(logs)
  const logsCount = logs.length
  const confidence: CycleState['confidence'] =
    logsCount >= 4 ? 'calibrated' : logsCount >= 1 ? 'learning' : 'estimated'

  if (logsCount === 0) {
    const estimatedDay = bilanValue ? (BILAN_ESTIMATE_DAY[bilanValue] ?? null) : null
    if (!estimatedDay) {
      return {
        hasActiveCycle: true,
        currentPhase: null,
        currentCycleDay: null,
        avgCycleLengthDays: 28,
        menstrualPhaseLengthDays: 5,
        nextPhaseIn: null,
        lastPeriodDate: null,
        logsCount: 0,
        confidence: 'estimated',
      }
    }
    const phase = detectPhase(estimatedDay, 28, 5)
    return {
      hasActiveCycle: true,
      currentPhase: phase,
      currentCycleDay: estimatedDay,
      avgCycleLengthDays: 28,
      menstrualPhaseLengthDays: 5,
      nextPhaseIn: computeNextPhaseIn(estimatedDay, phase, 28, 5),
      lastPeriodDate: null,
      logsCount: 0,
      confidence: 'estimated',
    }
  }

  const lastLog = logs[0]
  const currentCycleDay = computeCurrentCycleDay(lastLog.period_start_date, avgCycleLength, today)
  const currentPhase = detectPhase(currentCycleDay, avgCycleLength, menstrualLength)

  return {
    hasActiveCycle: true,
    currentPhase,
    currentCycleDay,
    avgCycleLengthDays: avgCycleLength,
    menstrualPhaseLengthDays: menstrualLength,
    nextPhaseIn: computeNextPhaseIn(currentCycleDay, currentPhase, avgCycleLength, menstrualLength),
    lastPeriodDate: lastLog.period_start_date,
    logsCount,
    confidence,
  }
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
cd /Users/user/Desktop/STRYVLAB && npx vitest run tests/lib/cycle/cycleEngine.test.ts 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "cycleEngine|cycleSync" | head -10
```

Expected: no errors in the new files.

- [ ] **Step 6: Commit**

```bash
git add lib/cycle/cycleEngine.ts tests/lib/cycle/cycleEngine.test.ts
git commit -m "feat(cycle): add CycleEngine — getCycleStateFromLogs, personal avg cycle length, 20 tests"
```

---

## Task 3: Client API — POST log + GET status

**Files:**
- Create: `app/api/client/cycle/log/route.ts`
- Create: `app/api/client/cycle/status/route.ts`

Both follow the same auth pattern as `app/api/client/nutrition-alerts/route.ts`:
1. `createClient()` → verify session user
2. `svc().from('coach_clients').select('id').eq('user_id', user.id).single()` → get client record
3. Use service client for all DB writes

- [ ] **Step 1: Create POST /api/client/cycle/log**

```typescript
// app/api/client/cycle/log/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getCycleStateFromLogs } from '@/lib/cycle/cycleEngine'
import type { CycleLog } from '@/lib/cycle/cycleEngine'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const bodySchema = z.object({
  type: z.enum(['start', 'end']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cc } = await svc()
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!cc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const db = svc()
  const targetDate = body.data.date ?? new Date().toISOString().slice(0, 10)

  if (body.data.type === 'start') {
    // Guard: conflict check within 3 days
    const threeDaysBefore = new Date(targetDate)
    threeDaysBefore.setDate(threeDaysBefore.getDate() - 3)
    const threeDaysAfter = new Date(targetDate)
    threeDaysAfter.setDate(threeDaysAfter.getDate() + 3)

    const { data: existing } = await db
      .from('menstrual_cycle_logs')
      .select('period_start_date')
      .eq('client_id', cc.id)
      .gte('period_start_date', threeDaysBefore.toISOString().slice(0, 10))
      .lte('period_start_date', threeDaysAfter.toISOString().slice(0, 10))
      .single()

    if (existing) {
      return NextResponse.json(
        { conflict: true, existingDate: existing.period_start_date },
        { status: 409 },
      )
    }

    // Compute cycle length from previous log
    const { data: prevLog } = await db
      .from('menstrual_cycle_logs')
      .select('period_start_date')
      .eq('client_id', cc.id)
      .lt('period_start_date', targetDate)
      .order('period_start_date', { ascending: false })
      .limit(1)
      .single()

    let computedLength: number | null = null
    if (prevLog) {
      const prev = new Date(prevLog.period_start_date)
      const curr = new Date(targetDate)
      computedLength = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
      if (computedLength < 21 || computedLength > 35) computedLength = null
    }

    await db.from('menstrual_cycle_logs').insert({
      client_id: cc.id,
      period_start_date: targetDate,
      computed_cycle_length_days: computedLength,
    })
  }

  if (body.data.type === 'end') {
    // Find the most recent log with start <= targetDate
    const { data: log } = await db
      .from('menstrual_cycle_logs')
      .select('id, period_start_date')
      .eq('client_id', cc.id)
      .lte('period_start_date', targetDate)
      .order('period_start_date', { ascending: false })
      .limit(1)
      .single()

    if (!log) return NextResponse.json({ error: 'No period start found before end date' }, { status: 400 })

    const startDate = new Date(log.period_start_date)
    const endDate = new Date(targetDate)
    const diff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 1 || diff > 14) {
      return NextResponse.json({ error: 'End date must be 1–14 days after start' }, { status: 400 })
    }

    await db
      .from('menstrual_cycle_logs')
      .update({ period_end_date: targetDate })
      .eq('id', log.id)
  }

  // Return updated cycle state
  const { data: logs } = await db
    .from('menstrual_cycle_logs')
    .select('period_start_date, period_end_date, computed_cycle_length_days')
    .eq('client_id', cc.id)
    .order('period_start_date', { ascending: false })
    .limit(7)

  // Get bilan value for hasActiveCycle
  const { data: bilanRow } = await db
    .from('assessment_responses')
    .select('value_text')
    .eq('field_key', 'menstrual_cycle')
    .in('assessment_submission_id', (
      await db
        .from('assessment_submissions')
        .select('id')
        .eq('client_id', cc.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
    ).data?.map(r => r.id) ?? [])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const cycleState = getCycleStateFromLogs(
    (logs as CycleLog[]) ?? [],
    bilanRow?.value_text ?? null,
  )

  return NextResponse.json({ cycleState }, { status: 200 })
}
```

- [ ] **Step 2: Create GET /api/client/cycle/status**

```typescript
// app/api/client/cycle/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getCycleStateFromLogs } from '@/lib/cycle/cycleEngine'
import type { CycleLog } from '@/lib/cycle/cycleEngine'

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

  const db = svc()

  const { data: cc } = await db
    .from('coach_clients')
    .select('id, gender')
    .eq('user_id', user.id)
    .single()
  if (!cc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (cc.gender !== 'female') {
    return NextResponse.json({ cycleState: null }, { status: 200 })
  }

  const { data: logs } = await db
    .from('menstrual_cycle_logs')
    .select('period_start_date, period_end_date, computed_cycle_length_days')
    .eq('client_id', cc.id)
    .order('period_start_date', { ascending: false })
    .limit(7)

  // Get most recent menstrual_cycle bilan answer
  const { data: submissions } = await db
    .from('assessment_submissions')
    .select('id')
    .eq('client_id', cc.id)
    .order('submitted_at', { ascending: false })
    .limit(3)

  const submissionIds = submissions?.map(s => s.id) ?? []
  let bilanValue: string | null = null

  if (submissionIds.length > 0) {
    const { data: bilanRow } = await db
      .from('assessment_responses')
      .select('value_text')
      .eq('field_key', 'menstrual_cycle')
      .in('assessment_submission_id', submissionIds)
      .not('value_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    bilanValue = bilanRow?.value_text ?? null
  }

  const cycleState = getCycleStateFromLogs(
    (logs as CycleLog[]) ?? [],
    bilanValue,
  )

  return NextResponse.json({ cycleState }, { status: 200 })
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "cycle/log\|cycle/status" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/client/cycle/log/route.ts app/api/client/cycle/status/route.ts
git commit -m "feat(cycle): add client API routes — POST /cycle/log + GET /cycle/status"
```

---

## Task 4: Coach API — GET /api/clients/[clientId]/cycle/status

**Files:**
- Create: `app/api/clients/[clientId]/cycle/status/route.ts`

Follows pattern from `app/api/clients/[clientId]/nutrition-data/route.ts` (coach auth + ownership check).

- [ ] **Step 1: Create route**

```typescript
// app/api/clients/[clientId]/cycle/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getCycleStateFromLogs } from '@/lib/cycle/cycleEngine'
import type { CycleLog } from '@/lib/cycle/cycleEngine'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const { clientId } = params

  // Verify coach owns this client
  const { data: client } = await db
    .from('coach_clients')
    .select('id, gender')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (client.gender !== 'female') {
    return NextResponse.json({ cycleState: null }, { status: 200 })
  }

  const { data: logs } = await db
    .from('menstrual_cycle_logs')
    .select('period_start_date, period_end_date, computed_cycle_length_days')
    .eq('client_id', clientId)
    .order('period_start_date', { ascending: false })
    .limit(7)

  const { data: submissions } = await db
    .from('assessment_submissions')
    .select('id')
    .eq('client_id', clientId)
    .order('submitted_at', { ascending: false })
    .limit(3)

  const submissionIds = submissions?.map(s => s.id) ?? []
  let bilanValue: string | null = null

  if (submissionIds.length > 0) {
    const { data: bilanRow } = await db
      .from('assessment_responses')
      .select('value_text')
      .eq('field_key', 'menstrual_cycle')
      .in('assessment_submission_id', submissionIds)
      .not('value_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    bilanValue = bilanRow?.value_text ?? null
  }

  const cycleState = getCycleStateFromLogs(
    (logs as CycleLog[]) ?? [],
    bilanValue,
  )

  return NextResponse.json({ cycleState }, { status: 200 })
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "clients/\[clientId\]/cycle" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/clients/\[clientId\]/cycle/status/route.ts
git commit -m "feat(cycle): add coach API route — GET /clients/[clientId]/cycle/status"
```

---

## Task 5: CyclePhasePill component

**Files:**
- Create: `components/client/cycle/CyclePhasePill.tsx`

DS v4.0 rules: no colored shadows, no glow, gray scale text `#e0e0e0`, colored dot only.

- [ ] **Step 1: Create component**

```typescript
// components/client/cycle/CyclePhasePill.tsx
'use client'

import type { CyclePhase } from '@/lib/cycle/cycleEngine'

const PHASE_COLORS: Record<CyclePhase, string> = {
  menstrual:  '#c0392b',
  follicular: '#2d7a62',
  ovulatory:  '#9a8038',
  luteal:     '#8c5230',
}

const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual:  'Menstruation',
  follicular: 'Folliculaire',
  ovulatory:  'Ovulation',
  luteal:     'Lutéale',
}

interface Props {
  phase: CyclePhase
  cycleDay: number
  confidence: 'estimated' | 'learning' | 'calibrated'
  size?: 'sm' | 'md'
}

export default function CyclePhasePill({ phase, cycleDay, confidence, size = 'md' }: Props) {
  const color = PHASE_COLORS[phase]
  const label = PHASE_LABELS[phase]
  const isSm = size === 'sm'

  return (
    <div className={`flex items-center gap-1.5 ${isSm ? 'px-2 py-0.5' : 'px-2.5 py-1'} rounded-full bg-white/[0.04] border border-white/[0.06]`}>
      <span
        className={`shrink-0 rounded-full ${isSm ? 'w-1.5 h-1.5' : 'w-2 h-2'}`}
        style={{ background: color }}
      />
      <span className={`font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#e0e0e0] ${isSm ? 'text-[9px]' : 'text-[10px]'}`}>
        {label} · J{cycleDay}
      </span>
      {confidence === 'estimated' && (
        <span className={`text-[#5a5a5a] ${isSm ? 'text-[8px]' : 'text-[9px]'}`}>◐</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "CyclePhasePill" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/client/cycle/CyclePhasePill.tsx
git commit -m "feat(cycle): add CyclePhasePill component"
```

---

## Task 6: LogPeriodSheet component

**Files:**
- Create: `components/client/cycle/LogPeriodSheet.tsx`

Bottom sheet DS v4.0. Two sections: log start (today or date picker) + log end (conditional).

- [ ] **Step 1: Create component**

```typescript
// components/client/cycle/LogPeriodSheet.tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Drop } from '@phosphor-icons/react'
import type { CycleState } from '@/lib/cycle/cycleEngine'

interface Props {
  open: boolean
  cycleState: CycleState | null
  onClose: () => void
  onUpdated: (newState: CycleState) => void
}

type Mode = 'main' | 'pick-start-date' | 'confirm-conflict'

export default function LogPeriodSheet({ open, cycleState, onClose, onUpdated }: Props) {
  const [mode, setMode] = useState<Mode>('main')
  const [pickedDate, setPickedDate] = useState('')
  const [conflictDate, setConflictDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const hasOpenPeriod =
    cycleState?.lastPeriodDate !== null &&
    cycleState?.currentPhase === 'menstrual'

  async function logStart(date: string, force = false) {
    setLoading(true)
    try {
      const res = await fetch('/api/client/cycle/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'start', date }),
      })
      if (res.status === 409 && !force) {
        const data = await res.json()
        setConflictDate(data.existingDate)
        setMode('confirm-conflict')
        return
      }
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      onUpdated(data.cycleState)
      setSuccessMsg(`Cycle mis à jour · Phase : ${data.cycleState.currentPhase ?? ''}`)
      setTimeout(() => { setSuccessMsg(null); onClose() }, 2000)
    } finally {
      setLoading(false)
      setMode('main')
    }
  }

  async function logEnd() {
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await fetch('/api/client/cycle/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'end', date: today }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      onUpdated(data.cycleState)
      setSuccessMsg('Fin de règles enregistrée')
      setTimeout(() => { setSuccessMsg(null); onClose() }, 2000)
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setMode('main')
    setPickedDate('')
    setConflictDate('')
    setSuccessMsg(null)
    onClose()
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            className="fixed inset-0 z-[80] bg-black/50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            key="sheet"
            className="fixed left-0 right-0 bottom-0 z-[90] rounded-t-2xl bg-[#111111]"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-8 h-[3px] rounded-full bg-white/[0.12]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-4">
              <p className="text-[13px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[#e0e0e0]">
                Cycle
              </p>
              <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] text-[#5a5a5a] active:bg-white/[0.08]">
                <X size={15} />
              </button>
            </div>

            <div className="px-4 pb-4 space-y-3">
              {successMsg ? (
                <div className="py-6 text-center">
                  <p className="text-[14px] font-barlow font-semibold text-[#e0e0e0]">{successMsg}</p>
                </div>
              ) : mode === 'confirm-conflict' ? (
                <div className="space-y-3">
                  <p className="text-[12px] font-barlow text-[#a0a0a0] leading-relaxed px-1">
                    Un log existe déjà le {conflictDate}. Remplacer ?
                  </p>
                  <button
                    onClick={() => logStart(pickedDate || today, true)}
                    disabled={loading}
                    className="w-full h-[52px] rounded-xl bg-[#f2f2f2] text-[#080808] text-[13px] font-barlow font-bold active:opacity-80 disabled:opacity-50"
                  >
                    Confirmer quand même
                  </button>
                  <button
                    onClick={() => setMode('main')}
                    className="w-full h-[44px] rounded-xl bg-white/[0.04] text-[#a0a0a0] text-[13px] font-barlow active:bg-white/[0.08]"
                  >
                    Annuler
                  </button>
                </div>
              ) : mode === 'pick-start-date' ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-barlow text-[#5a5a5a] px-1">Premier jour de règles :</p>
                  <input
                    type="date"
                    value={pickedDate}
                    max={today}
                    onChange={e => setPickedDate(e.target.value)}
                    className="w-full h-[52px] rounded-xl bg-white/[0.06] border border-white/[0.08] text-[#e0e0e0] text-[14px] font-barlow px-4 min-w-0"
                  />
                  <button
                    onClick={() => pickedDate && logStart(pickedDate)}
                    disabled={!pickedDate || loading}
                    className="w-full h-[52px] rounded-xl bg-[#f2f2f2] text-[#080808] text-[13px] font-barlow font-bold active:opacity-80 disabled:opacity-50"
                  >
                    {loading ? 'Enregistrement…' : 'Confirmer'}
                  </button>
                  <button onClick={() => setMode('main')} className="w-full h-[44px] rounded-xl bg-white/[0.04] text-[#a0a0a0] text-[13px] font-barlow active:bg-white/[0.08]">
                    Retour
                  </button>
                </div>
              ) : (
                <>
                  {/* Section 1: Début de règles */}
                  <div className="rounded-xl bg-white/[0.04] overflow-hidden">
                    <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[#5a5a5a] px-4 pt-3 pb-1">
                      Début de règles
                    </p>
                    <div className="p-3 space-y-2">
                      <button
                        onClick={() => logStart(today)}
                        disabled={loading}
                        className="w-full h-[52px] rounded-xl bg-[#f2f2f2] text-[#080808] text-[13px] font-barlow font-bold active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Drop size={16} weight="fill" className="text-[#c0392b]" />
                        Aujourd'hui
                      </button>
                      <button
                        onClick={() => setMode('pick-start-date')}
                        disabled={loading}
                        className="w-full h-[44px] rounded-xl bg-white/[0.04] text-[#a0a0a0] text-[12px] font-barlow active:bg-white/[0.08]"
                      >
                        Choisir une autre date
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Fin de règles — conditional */}
                  {hasOpenPeriod && (
                    <div className="rounded-xl bg-white/[0.04] overflow-hidden">
                      <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[#5a5a5a] px-4 pt-3 pb-1">
                        Fin de règles
                      </p>
                      <div className="p-3">
                        <button
                          onClick={logEnd}
                          disabled={loading}
                          className="w-full h-[44px] rounded-xl bg-white/[0.04] text-[#e0e0e0] text-[13px] font-barlow active:bg-white/[0.08] disabled:opacity-50"
                        >
                          {loading ? 'Enregistrement…' : 'Mes règles sont terminées'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "LogPeriodSheet" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/client/cycle/LogPeriodSheet.tsx
git commit -m "feat(cycle): add LogPeriodSheet — log period start/end with conflict guard"
```

---

## Task 7: Nutrition TopBar — CyclePhasePill

**Files:**
- Modify: `app/client/nutrition/page.tsx`
- Modify: `app/client/nutrition/NutritionClientPage.tsx`

`page.tsx` is a Server Component — it already fetches `menstrual_cycle` from `assessment_responses`. We add a fetch of `menstrual_cycle_logs` and call `getCycleStateFromLogs` to produce `CycleState`.

- [ ] **Step 1: Update `app/client/nutrition/page.tsx`**

Find the section where `cycleSyncPhase` is computed (around line 276). Replace the manual phase detection with `getCycleStateFromLogs`:

Add at the top (after existing imports):
```typescript
import { getCycleStateFromLogs } from '@/lib/cycle/cycleEngine'
import type { CycleState } from '@/lib/cycle/cycleEngine'
import type { CycleLog } from '@/lib/cycle/cycleEngine'
```

In the data fetching section, after the menstrual_cycle bilan fetch, add:
```typescript
// Fetch cycle logs (for gender=female only)
let cycleLogs: CycleLog[] = []
if (gender === 'female') {
  const { data: logsData } = await svc()
    .from('menstrual_cycle_logs')
    .select('period_start_date, period_end_date, computed_cycle_length_days')
    .eq('client_id', cc.id)
    .order('period_start_date', { ascending: false })
    .limit(7)
  cycleLogs = (logsData as CycleLog[]) ?? []
}

const cycleState: CycleState | null =
  gender === 'female'
    ? getCycleStateFromLogs(cycleLogs, menstrualCycleBilanValue ?? null)
    : null
```

Then pass `cycleState` as a prop to `NutritionClientPage` (alongside the existing `cycleSyncPhase`, `cycleSyncAdjustment`, `cycleDay` props which can remain for the CycleSyncBanner backwards compatibility).

In the return JSX, add:
```tsx
<NutritionClientPage
  ...existingProps
  cycleState={cycleState}
/>
```

Note: `menstrualCycleBilanValue` is the string variable that holds the `value_text` from `assessment_responses` for `field_key = 'menstrual_cycle'`. Check line ~153 of the file for the exact variable name used and adapt accordingly. The variable may already exist under a different name — read the file before editing.

- [ ] **Step 2: Update `app/client/nutrition/NutritionClientPage.tsx`**

Add `cycleState` to Props interface:
```typescript
import type { CycleState } from '@/lib/cycle/cycleEngine'
import dynamic from 'next/dynamic'

const CyclePhasePill = dynamic(() => import('@/components/client/cycle/CyclePhasePill'), { ssr: false })

// In Props:
cycleState?: CycleState | null
```

In the component, update `<ClientTopBar>`:
```tsx
const cycleRight = (
  <div className="flex flex-col items-end gap-0.5">
    {dayTypeBadge}
    {cycleState?.currentPhase && cycleState.currentCycleDay && (
      <CyclePhasePill
        phase={cycleState.currentPhase}
        cycleDay={cycleState.currentCycleDay}
        confidence={cycleState.confidence}
        size="sm"
      />
    )}
  </div>
)

// Replace:
// <ClientTopBar section={ct(lang, 'nutrition.section')} title={date} right={dayTypeBadge} />
// With:
<ClientTopBar
  section={ct(lang, 'nutrition.section')}
  title={date}
  right={cycleRight}
/>
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "nutrition/page|NutritionClientPage" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/client/nutrition/page.tsx app/client/nutrition/NutritionClientPage.tsx
git commit -m "feat(cycle): show CyclePhasePill in Nutrition TopBar"
```

---

## Task 8: Programme TopBar — CyclePhasePill

**Files:**
- Modify: `app/client/programme/ProgrammeClientPage.tsx`
- Modify: `app/client/programme/session/[sessionId]/SessionLogger.tsx`

Both are Client Components — fetch cycle status client-side on mount.

- [ ] **Step 1: Update `ProgrammeClientPage.tsx`**

Add to imports:
```typescript
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { CycleState } from '@/lib/cycle/cycleEngine'

const CyclePhasePill = dynamic(() => import('@/components/client/cycle/CyclePhasePill'), { ssr: false })
```

Add state and fetch inside the component:
```typescript
const [cycleState, setCycleState] = useState<CycleState | null>(null)

useEffect(() => {
  fetch('/api/client/cycle/status')
    .then(r => r.ok ? r.json() : null)
    .then(data => data?.cycleState && setCycleState(data.cycleState))
    .catch(() => {})
}, [])
```

Find the `<ClientTopBar>` call in this file and add the pill to the `right` slot:
```tsx
right={
  cycleState?.currentPhase && cycleState.currentCycleDay ? (
    <CyclePhasePill
      phase={cycleState.currentPhase}
      cycleDay={cycleState.currentCycleDay}
      confidence={cycleState.confidence}
      size="sm"
    />
  ) : undefined
}
```

- [ ] **Step 2: Update `SessionLogger.tsx`**

Apply the same pattern: `useEffect` fetch on mount, `CyclePhasePill` in the `right` slot of the `ClientTopBar` used in the session logger. Read the file first to find the exact `ClientTopBar` call location.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "ProgrammeClientPage|SessionLogger" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/client/programme/ProgrammeClientPage.tsx app/client/programme/session/\[sessionId\]/SessionLogger.tsx
git commit -m "feat(cycle): show CyclePhasePill in Programme + SessionLogger TopBars"
```

---

## Task 9: QuickLogSheet — Cycle action

**Files:**
- Modify: `components/client/QuickLogSheet.tsx`

Add a "Cycle" action that opens `LogPeriodSheet`. Only shown if cycle status has `hasActiveCycle === true`.

- [ ] **Step 1: Update QuickLogSheet**

Read `components/client/QuickLogSheet.tsx` first. Add:

```typescript
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { Drop } from '@phosphor-icons/react'
import type { CycleState } from '@/lib/cycle/cycleEngine'

const LogPeriodSheet = dynamic(() => import('@/components/client/cycle/LogPeriodSheet'), { ssr: false })

// Inside component, after existing state:
const [cycleState, setCycleState] = useState<CycleState | null>(null)
const [showCycle, setShowCycle] = useState(false)

useEffect(() => {
  if (!open) return
  fetch('/api/client/cycle/status')
    .then(r => r.ok ? r.json() : null)
    .then(data => data?.cycleState && setCycleState(data.cycleState))
    .catch(() => {})
}, [open])
```

Add to the ACTIONS array (after the existing actions, conditionally):
```typescript
// Before mapping ACTIONS, compute dynamic actions:
const actions = [
  ...ACTIONS,
  ...(cycleState?.hasActiveCycle ? [{
    key: 'cycle' as const,
    Icon: Drop,
    label: 'Cycle',
    sub: 'Début ou fin de règles',
    onClick: () => setSub('cycle'),
  }] : []),
]
```

Update `SubSheet` type to include `'cycle'`:
```typescript
type SubSheet = "water" | "activity" | "cycle" | null
```

Add `LogPeriodSheet` in the sub-sheets section:
```tsx
<LogPeriodSheet
  open={sub === 'cycle'}
  cycleState={cycleState}
  onClose={() => { setSub(null); onClose() }}
  onUpdated={(newState) => { setCycleState(newState); setSub(null); onClose() }}
/>
```

Map `actions` instead of `ACTIONS` in the JSX.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "QuickLogSheet" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/client/QuickLogSheet.tsx
git commit -m "feat(cycle): add Cycle action to QuickLogSheet FAB"
```

---

## Task 10: Profile — Cycle section

**Files:**
- Modify: `app/client/profil/page.tsx`
- Modify: `components/client/profile/ProfilAccordion.tsx`

The profile page is a Server Component that fetches data then passes to `ProfilAccordion`. Add cycle state to the data fetch.

- [ ] **Step 1: Update `app/client/profil/page.tsx`**

Read the file. Add to imports:
```typescript
import { getCycleStateFromLogs } from '@/lib/cycle/cycleEngine'
import type { CycleState, CycleLog } from '@/lib/cycle/cycleEngine'
```

Add cycle data fetch before the return (following the same svc() pattern):
```typescript
let cycleState: CycleState | null = null
if (clientData?.gender === 'female') {
  const { data: cycleLogs } = await svc()
    .from('menstrual_cycle_logs')
    .select('period_start_date, period_end_date, computed_cycle_length_days')
    .eq('client_id', cc.id)
    .order('period_start_date', { ascending: false })
    .limit(7)

  // Get bilan value
  const { data: bilanRow } = await svc()
    .from('assessment_responses')
    .select('value_text')
    .eq('field_key', 'menstrual_cycle')
    .in('assessment_submission_id', latestSubmissionIds) // use existing submission id array
    .not('value_text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  cycleState = getCycleStateFromLogs(
    (cycleLogs as CycleLog[]) ?? [],
    bilanRow?.value_text ?? null,
  )
}
```

Pass `cycleState` to `ProfilAccordion`:
```tsx
<ProfilAccordion ... cycleState={cycleState} />
```

- [ ] **Step 2: Update `ProfilAccordion.tsx`**

Read the file first to understand the existing section pattern. Add:

```typescript
import type { CycleState } from '@/lib/cycle/cycleEngine'
import dynamic from 'next/dynamic'
import CyclePhasePill from '@/components/client/cycle/CyclePhasePill'

const LogPeriodSheet = dynamic(() => import('@/components/client/cycle/LogPeriodSheet'), { ssr: false })

// Add to Props:
cycleState?: CycleState | null

// Add state inside component:
const [localCycleState, setLocalCycleState] = useState(cycleState ?? null)
const [showLogPeriod, setShowLogPeriod] = useState(false)
```

Add a new `AccordionSection` for "Mon Cycle" — only rendered if `gender === 'female'`. Place it after the existing sections:

```tsx
{gender === 'female' && (
  <AccordionSection title="Mon Cycle" defaultOpen={false}>
    {!localCycleState?.hasActiveCycle ? (
      <div className="space-y-1">
        <p className="text-[12px] font-barlow text-[#a0a0a0]">Cycle sync désactivé</p>
        <p className="text-[11px] font-barlow text-[#5a5a5a]">Ménopause / aménorrhée renseignée dans ton bilan.</p>
      </div>
    ) : (
      <div className="space-y-4">
        {localCycleState?.currentPhase && localCycleState.currentCycleDay ? (
          <div className="space-y-1">
            <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#5a5a5a]">Phase actuelle</p>
            <CyclePhasePill
              phase={localCycleState.currentPhase}
              cycleDay={localCycleState.currentCycleDay}
              confidence={localCycleState.confidence}
              size="md"
            />
          </div>
        ) : (
          <p className="text-[12px] font-barlow text-[#5a5a5a]">Aucune donnée de cycle encore. Log ton premier cycle depuis le bouton +.</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/[0.04] p-3">
            <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#5a5a5a] mb-1">Cycle moyen</p>
            <p className="text-[15px] font-barlow font-bold text-[#e0e0e0]">{localCycleState?.avgCycleLengthDays ?? 28}j</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] p-3">
            <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-[#5a5a5a] mb-1">Précision</p>
            <p className="text-[12px] font-barlow font-semibold text-[#e0e0e0]">
              {localCycleState?.confidence === 'calibrated' ? '● Calibré' : localCycleState?.confidence === 'learning' ? '◑ Apprentissage' : '◐ Estimé'}
            </p>
            <p className="text-[10px] font-barlow text-[#5a5a5a] mt-0.5">
              {localCycleState?.logsCount ?? 0} cycle{(localCycleState?.logsCount ?? 0) !== 1 ? 's' : ''} loggé{(localCycleState?.logsCount ?? 0) !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowLogPeriod(true)}
          className="w-full h-[44px] rounded-xl bg-white/[0.04] text-[#e0e0e0] text-[13px] font-barlow active:bg-white/[0.08]"
        >
          Indiquer début de règles
        </button>
      </div>
    )}

    <LogPeriodSheet
      open={showLogPeriod}
      cycleState={localCycleState}
      onClose={() => setShowLogPeriod(false)}
      onUpdated={(newState) => { setLocalCycleState(newState); setShowLogPeriod(false) }}
    />
  </AccordionSection>
)}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "profil/page|ProfilAccordion" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/client/profil/page.tsx components/client/profile/ProfilAccordion.tsx
git commit -m "feat(cycle): add Mon Cycle section to client profile"
```

---

## Task 11: ProtocolRationale — per-day-type accordions + cycle step

**Files:**
- Modify: `components/client/smart/ProtocolRationale.tsx`
- Modify: `app/client/nutrition/NutritionClientPage.tsx` (pass `protocolDays`)
- Modify: `app/client/nutrition/page.tsx` (pass all protocol days to client component)

The current `ProtocolRationale` accepts a single `target` object (one day's macros). We replace this with a `protocolDays` array. Each day gets its own accordion.

- [ ] **Step 1: Update `ProtocolRationale.tsx`**

Replace the entire component with:

```typescript
// components/client/smart/ProtocolRationale.tsx
'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'
import { getCycleSyncAdjustment } from '@/lib/nutrition/engine/cycleSync'
import type { CycleState } from '@/lib/cycle/cycleEngine'

interface ProtocolDay {
  name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  carb_cycle_type?: string | null
}

interface Props {
  protocolDays: ProtocolDay[]
  tdee: number | null
  tdeeSource: string | null
  bodyWeightKg?: number | null
  activeDayName?: string | null
  cycleState?: CycleState | null
}

const CARB_CYCLE_LABELS: Record<string, string> = {
  high: 'Glucides élevés (jour entraînement) — glycogène musculaire maximisé.',
  low:  'Glucides réduits (jour repos) — mobilisation des graisses favorisée.',
  medium: 'Glucides modérés — équilibre énergie / récupération.',
}

const TDEE_SOURCE_LABELS: Record<string, string> = {
  formula_proxy: 'Estimé depuis ton programme',
  adaptive: 'Calibré depuis tes pesées (14 jours)',
}

function DayAccordion({
  day,
  tdee,
  tdeeSource,
  bodyWeightKg,
  cycleState,
  defaultOpen,
}: {
  day: ProtocolDay
  tdee: number | null
  tdeeSource: string | null
  bodyWeightKg?: number | null
  cycleState?: CycleState | null
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  const delta = tdee != null && tdee > 0 ? day.kcal - tdee : null
  const goalLabel =
    delta == null ? 'Objectif calorique' :
    delta > 100 ? 'Prise de masse' :
    delta < -100 ? 'Perte de masse grasse' : 'Maintenance'

  const gPerKg = bodyWeightKg && bodyWeightKg > 0
    ? (day.protein_g / bodyWeightKg).toFixed(2)
    : null

  const fatKcal  = day.fat_g * 9
  const carbKcal = day.carbs_g * 4
  const totalMacroCal = fatKcal + carbKcal + day.protein_g * 4
  const carbPct = totalMacroCal > 0 ? Math.round((carbKcal / totalMacroCal) * 100) : 0
  const fatPct  = totalMacroCal > 0 ? Math.round((fatKcal  / totalMacroCal) * 100) : 0

  const showCycle = cycleState?.hasActiveCycle && cycleState.currentPhase
  const cycleAdj = showCycle ? getCycleSyncAdjustment(cycleState!.currentPhase!) : null
  const isCurrentPhase = showCycle

  return (
    <div className="bg-[#111111] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-white/[0.03] transition-colors"
      >
        <div className="text-left flex-1 min-w-0">
          <p className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/70 truncate">
            {day.name}
          </p>
          <p className="text-[13px] font-barlow font-semibold text-[#e0e0e0] tabular-nums">
            {Math.round(day.kcal).toLocaleString('fr-FR')} kcal
          </p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0 ml-3">
          <ChevronDown size={16} className="text-white/30" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-0">
              {/* Build timeline steps */}
              {(() => {
                const steps: Array<{ title: string; value: string; valueColor: string; body: string }> = []

                if (tdee != null && tdee > 0) {
                  steps.push({
                    title: 'Dépense énergétique estimée',
                    value: `${Math.round(tdee).toLocaleString('fr-FR')} kcal`,
                    valueColor: '#4a90e2',
                    body: `${TDEE_SOURCE_LABELS[tdeeSource ?? ''] ?? 'Estimé'}. Base de calcul de tes objectifs caloriques.`,
                  })
                }

                steps.push({
                  title: goalLabel,
                  value: `${Math.round(day.kcal).toLocaleString('fr-FR')} kcal${delta != null ? (delta > 0 ? ` (+${Math.round(delta)})` : ` (${Math.round(delta)})`) : ''}`,
                  valueColor: NUTRITION_UI_COLORS.carbs,
                  body: delta != null && Math.abs(delta) > 100
                    ? delta > 0
                      ? 'Surplus calorique — favorise la construction musculaire et la récupération.'
                      : 'Déficit calorique — permet de réduire la masse grasse en préservant le muscle.'
                    : 'Maintenance — préserve ta composition corporelle actuelle.',
                })

                if (day.protein_g > 0) {
                  steps.push({
                    title: 'Protéines cibles',
                    value: `${Math.round(day.protein_g)}g${gPerKg ? ` · ${gPerKg} g/kg` : ''}`,
                    valueColor: NUTRITION_UI_COLORS.protein,
                    body: `Préservent la masse musculaire et favorisent la récupération.${gPerKg ? ` Ratio ${gPerKg} g/kg adapté à ton objectif.` : ''}`,
                  })
                }

                if (day.fat_g > 0 && day.carbs_g > 0) {
                  steps.push({
                    title: 'Répartition glucides / lipides',
                    value: `${Math.round(day.carbs_g)}g G · ${Math.round(day.fat_g)}g L`,
                    valueColor: NUTRITION_UI_COLORS.fat,
                    body: day.carb_cycle_type
                      ? (CARB_CYCLE_LABELS[day.carb_cycle_type] ?? `Glucides ${carbPct}% · Lipides ${fatPct}%.`)
                      : `Glucides ${carbPct}% — carburant. Lipides ${fatPct}% — régulation hormonale.`,
                  })
                }

                if (showCycle && cycleAdj) {
                  const phaseName = { menstrual: 'Menstruation', follicular: 'Folliculaire', ovulatory: 'Ovulation', luteal: 'Lutéale' }[cycleState!.currentPhase!]
                  const deltaStr = [
                    cycleAdj.caloriesDelta !== 0 ? `${cycleAdj.caloriesDelta > 0 ? '+' : ''}${cycleAdj.caloriesDelta} kcal` : null,
                    cycleAdj.proteinDelta !== 0 ? `${cycleAdj.proteinDelta > 0 ? '+' : ''}${cycleAdj.proteinDelta}g P` : null,
                    cycleAdj.carbsDelta !== 0 ? `${cycleAdj.carbsDelta > 0 ? '+' : ''}${cycleAdj.carbsDelta}g G` : null,
                  ].filter(Boolean).join(' · ') || 'Ajustements neutres'
                  steps.push({
                    title: `Ajustement phase ${phaseName}${isCurrentPhase ? ' ●' : ''}`,
                    value: deltaStr,
                    valueColor: '#9a8038',
                    body: cycleAdj.notes[0] ?? '',
                  })
                }

                return steps.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-7 h-7 rounded-full bg-[#2e2e2e] flex items-center justify-center">
                        <span className="text-[11px] font-black text-white/70">{i + 1}</span>
                      </div>
                      {i < steps.length - 1 && (
                        <div className="w-px flex-1 bg-white/[0.08] my-1" style={{ minHeight: 16 }} />
                      )}
                    </div>
                    <div className={`min-w-0 flex-1 ${i === steps.length - 1 ? '' : 'pb-4'}`}>
                      <p className="text-[12px] font-semibold text-white/80 mb-0.5">{step.title}</p>
                      <p className="text-[14px] font-black tabular-nums mb-1" style={{ color: step.valueColor }}>{step.value}</p>
                      <p className="text-[11px] text-white/40 leading-relaxed">{step.body}</p>
                    </div>
                  </div>
                ))
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function ProtocolRationale({ protocolDays, tdee, tdeeSource, bodyWeightKg, activeDayName, cycleState }: Props) {
  if (protocolDays.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="px-1 pb-1">
        <p className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/40">
          Comprendre ton protocole
        </p>
        <p className="text-[10px] text-white/25 mt-0.5">Tap sur une journée pour voir le détail</p>
      </div>
      {protocolDays.map(day => (
        <DayAccordion
          key={day.name}
          day={day}
          tdee={tdee}
          tdeeSource={tdeeSource}
          bodyWeightKg={bodyWeightKg}
          cycleState={cycleState}
          defaultOpen={day.name === activeDayName}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Update `NutritionClientPage.tsx` Props + usage**

Add to Props:
```typescript
protocolDays?: Array<{
  name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  carb_cycle_type?: string | null
}>
```

Update the `<ProtocolRationale>` call:
```tsx
{tab === 'protocole' && (
  <ProtocolRationale
    protocolDays={protocolDays ?? []}
    tdee={tdeeAdaptive}
    tdeeSource={tdeeDataSource}
    bodyWeightKg={bodyWeightKg}
    activeDayName={protocolDay?.name ?? null}
    cycleState={cycleState ?? null}
  />
)}
```

Remove the old `target` prop pass if it was used.

- [ ] **Step 3: Update `page.tsx` to pass `protocolDays`**

The nutrition server component already fetches `nutrition_protocol_days` from the API. Find where protocol days data is available in the fetched response and pass the full array (name, kcal, protein_g, carbs_g, fat_g, carb_cycle_type) to `NutritionClientPage` as `protocolDays`.

Read `app/client/nutrition/page.tsx` carefully before editing — look for where `protocolDay` is derived and pass the full `protocolDays` array alongside it.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "ProtocolRationale|NutritionClientPage|nutrition/page" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/client/smart/ProtocolRationale.tsx app/client/nutrition/NutritionClientPage.tsx app/client/nutrition/page.tsx
git commit -m "feat(cycle): ProtocolRationale — per-day accordions + cycle phase step"
```

---

## Task 12: Nutrition Studio — cycle as second source of truth

**Files:**
- Modify: `components/nutrition/studio/useNutritionStudio.ts`
- Modify: `components/nutrition/studio/CalculationEngine.tsx`

The hook fetches cycle status from the coach-facing API. The CalculationEngine shows it as a live input alongside TDEE.

- [ ] **Step 1: Update `useNutritionStudio.ts`**

Read the file. Find where `clientData` is fetched (there's a `useEffect` that fetches from `nutrition-data` API). Add a separate fetch for cycle state:

```typescript
import type { CycleState } from '@/lib/cycle/cycleEngine'

// Add to state:
const [cycleState, setCycleState] = useState<CycleState | null>(null)

// Add inside the useEffect that fires when clientId changes (after clientData is loaded):
const fetchCycleState = async () => {
  if (!clientId) return
  try {
    const res = await fetch(`/api/clients/${clientId}/cycle/status`)
    if (res.ok) {
      const data = await res.json()
      setCycleState(data.cycleState ?? null)
    }
  } catch {}
}
fetchCycleState()

// Expose in returned object:
// return { ...existing, cycleState }
```

- [ ] **Step 2: Update `CalculationEngine.tsx`**

Read the file. Find the existing "Cycle Sync (femme)" section (gated on `isFemale`). Replace the static phase grid display with the live `CycleState`:

Add to Props:
```typescript
import type { CycleState } from '@/lib/cycle/cycleEngine'
import CyclePhasePill from '@/components/client/cycle/CyclePhasePill'

cycleState?: CycleState | null
```

Replace the existing cycle section content with:
```tsx
{isFemale && (
  <div className="space-y-3">
    <SectionLabel>Cycle menstruel — Source de vérité 2</SectionLabel>

    {!cycleState ? (
      <p className="text-[11px] text-white/30 italic">Données de cycle non disponibles.</p>
    ) : !cycleState.hasActiveCycle ? (
      <p className="text-[11px] text-white/30">Ménopause / aménorrhée — Cycle sync désactivé.</p>
    ) : (
      <div className="rounded-xl bg-white/[0.03] border-[0.3px] border-white/[0.06] p-3 space-y-3">
        {cycleState.currentPhase && cycleState.currentCycleDay ? (
          <div className="flex items-center justify-between">
            <CyclePhasePill
              phase={cycleState.currentPhase}
              cycleDay={cycleState.currentCycleDay}
              confidence={cycleState.confidence}
              size="md"
            />
            <span className="text-[10px] text-white/30">
              {cycleState.nextPhaseIn != null ? `Phase suivante dans ${cycleState.nextPhaseIn}j` : ''}
            </span>
          </div>
        ) : (
          <p className="text-[11px] text-white/30 italic">Aucun log de cycle. Client doit logger depuis l'app.</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] text-white/30 mb-0.5">Cycle moyen</p>
            <p className="text-[13px] font-mono text-white/70">{cycleState.avgCycleLengthDays}j</p>
          </div>
          <div>
            <p className="text-[9px] text-white/30 mb-0.5">Précision</p>
            <p className="text-[11px] text-white/60">
              {cycleState.confidence === 'calibrated' ? '● Calibré' : cycleState.confidence === 'learning' ? '◑ En cours' : '◐ Estimé'}
              {' '}({cycleState.logsCount} cycle{cycleState.logsCount !== 1 ? 's' : ''})
            </p>
          </div>
        </div>

        {cycleState.currentPhase && (() => {
          const adj = getCycleSyncAdjustment(cycleState.currentPhase!)
          if (!adj.caloriesDelta && !adj.proteinDelta && !adj.carbsDelta) return null
          return (
            <div className="border-t border-white/[0.06] pt-2 space-y-1">
              <p className="text-[9px] text-white/30 uppercase tracking-[0.12em]">Ajustements phase actuelle</p>
              {adj.caloriesDelta !== 0 && <p className="text-[11px] text-white/50">{adj.caloriesDelta > 0 ? '+' : ''}{adj.caloriesDelta} kcal/j</p>}
              {adj.proteinDelta !== 0 && <p className="text-[11px] text-white/50">{adj.proteinDelta > 0 ? '+' : ''}{adj.proteinDelta}g protéines</p>}
              {adj.carbsDelta !== 0 && <p className="text-[11px] text-white/50">{adj.carbsDelta > 0 ? '+' : ''}{adj.carbsDelta}g glucides</p>}
              <p className="text-[10px] text-white/35 leading-relaxed">{adj.notes[0]}</p>
            </div>
          )
        })()}
      </div>
    )}
  </div>
)}
```

Add import at top of CalculationEngine:
```typescript
import { getCycleSyncAdjustment } from '@/lib/nutrition/engine/cycleSync'
```

Pass `cycleState` from `NutritionStudio.tsx` to `CalculationEngine`:

In `NutritionStudio.tsx`:
```tsx
<CalculationEngine
  ...existingProps
  cycleState={studio.cycleState}
/>
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "useNutritionStudio|CalculationEngine|NutritionStudio" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/nutrition/studio/useNutritionStudio.ts components/nutrition/studio/CalculationEngine.tsx components/nutrition/studio/NutritionStudio.tsx
git commit -m "feat(cycle): Nutrition Studio shows cycle as second source of truth"
```

---

## Task 13: Final TypeScript check + CHANGELOG

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "^$" | head -30
```

Fix any errors introduced by this feature (do not fix pre-existing errors unrelated to cycle sync).

- [ ] **Step 2: Run all cycle tests**

```bash
npx vitest run tests/lib/cycle/ 2>&1 | tail -10
```

Expected: all PASS.

- [ ] **Step 3: Update CHANGELOG.md**

Add under today's date:
```
FEATURE: Cycle Sync v2 — menstrual_cycle_logs table, smart cycle engine (personal avg length), CyclePhasePill (Nutrition + Programme TopBars), LogPeriodSheet FAB, profile cycle section, ProtocolRationale per-day-type accordions + cycle step, Nutrition Studio cycle as second source of truth
```

- [ ] **Step 4: Final commit**

```bash
git add CHANGELOG.md
git commit -m "chore: update CHANGELOG for Cycle Sync v2"
```
