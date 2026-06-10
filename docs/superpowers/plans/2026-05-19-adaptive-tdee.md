# Adaptive TDEE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically adapt each client's nutrition protocol TDEE weekly using the weight-delta method (MacroFactor approach), push-updating macros and notifying both coach and client.

**Architecture:** A pure `calcAdaptiveTdee()` function (lib/nutrition/adaptiveTdee.ts) computes TDEE from linear regression on weight samples. An Inngest weekly cron job (Monday 06:00 UTC) fans out per active shared protocol, gates on ≥2 weight samples and delta > 150 kcal, rescales macros proportionally, writes history, and sends notifications. The coach also gets a manual "Apply" button in Nutrition Studio. The client sees the adjusted TDEE on their nutrition page.

**Tech Stack:** Next.js App Router, TypeScript strict, Supabase (service role for Inngest), Inngest cron, Vitest, DS v2.0 (coach), DS v3.0 (client)

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/20260519_adaptive_tdee.sql` | Create — 3 cols on nutrition_protocols + nutrition_tdee_history table + RLS |
| `lib/nutrition/adaptiveTdee.ts` | Create — pure functions: linearRegression + calcAdaptiveTdee |
| `tests/lib/nutrition/adaptiveTdee.test.ts` | Create — 12 Vitest tests |
| `lib/inngest/functions/adaptive-tdee.ts` | Create — weekly cron job |
| `app/api/inngest/route.ts` | Modify — register adaptiveTdeeFunction |
| `app/api/clients/[clientId]/nutrition-protocols/[protocolId]/apply-adaptive-tdee/route.ts` | Create — on-demand recalc (coach) |
| `app/api/clients/[clientId]/nutrition-data/route.ts` | Modify — return tdee_adaptive fields |
| `app/api/clients/[clientId]/nutrition-tdee-history/route.ts` | Create — GET last 5 history entries |
| `components/nutrition/studio/useNutritionStudio.ts` | Modify — fetch tdeeAdaptive + history + applyAdaptiveTdee |
| `components/nutrition/studio/CalculationEngine.tsx` | Modify — adaptive TDEE block + history |
| `app/client/nutrition/page.tsx` | Modify — fetch + display tdee_adaptive |
| `components/client/smart/NotificationsBar.tsx` | Modify — handle tdee_updated type |
| `CHANGELOG.md` | Update after each task |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260519_adaptive_tdee.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260519_adaptive_tdee.sql

-- 1. Add adaptive TDEE columns to nutrition_protocols
ALTER TABLE nutrition_protocols
  ADD COLUMN IF NOT EXISTS tdee_adaptive integer,
  ADD COLUMN IF NOT EXISTS tdee_adaptive_at timestamptz,
  ADD COLUMN IF NOT EXISTS tdee_data_source text CHECK (tdee_data_source IN ('weight_delta', 'formula_proxy'));

-- 2. Create nutrition_tdee_history table
CREATE TABLE IF NOT EXISTS nutrition_tdee_history (
  id                uuid primary key default gen_random_uuid(),
  protocol_id       uuid not null references nutrition_protocols(id) on delete cascade,
  client_id         uuid not null references coach_clients(id) on delete cascade,
  calculated_at     timestamptz not null default now(),
  tdee_formula      integer not null,
  tdee_adaptive     integer not null,
  delta_kcal        integer not null,
  weight_samples    integer not null,
  calories_source   text not null check (calories_source in ('logs', 'protocol')),
  avg_intake_kcal   integer not null,
  weight_delta_kg   numeric(5,2) not null,
  protocol_updated  boolean not null default false
);

CREATE INDEX IF NOT EXISTS idx_tdee_history_protocol
  ON nutrition_tdee_history (protocol_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tdee_history_client
  ON nutrition_tdee_history (client_id, calculated_at DESC);

-- 3. RLS for nutrition_tdee_history
ALTER TABLE nutrition_tdee_history ENABLE ROW LEVEL SECURITY;

-- Coach: full access to their clients' history
CREATE POLICY "coach_manage_tdee_history"
  ON nutrition_tdee_history
  FOR ALL
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE coach_id = auth.uid()
    )
  );

-- Client: read only their own history
CREATE POLICY "client_read_tdee_history"
  ON nutrition_tdee_history
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM coach_clients WHERE user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply migration**

Apply via Supabase Dashboard → SQL Editor. Paste the content of `supabase/migrations/20260519_adaptive_tdee.sql` and run.

Expected: no errors, `nutrition_tdee_history` table created, 3 columns added to `nutrition_protocols`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260519_adaptive_tdee.sql
git commit -m "schema: adaptive TDEE history table + 3 cols on nutrition_protocols"
```

---

## Task 2: Pure Lib — calcAdaptiveTdee

**Files:**
- Create: `lib/nutrition/adaptiveTdee.ts`
- Create: `tests/lib/nutrition/adaptiveTdee.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/lib/nutrition/adaptiveTdee.test.ts
import { describe, it, expect } from 'vitest'
import { calcAdaptiveTdee, linearRegression } from '@/lib/nutrition/adaptiveTdee'

const DAY = (offset: number, weight: number) => ({
  date: new Date(Date.UTC(2026, 4, offset + 1)).toISOString().slice(0, 10),
  weight_kg: weight,
})

describe('linearRegression', () => {
  it('returns correct slope for steady weight loss', () => {
    const samples = [DAY(0, 80), DAY(7, 79.3), DAY(14, 78.6)]
    const { slope } = linearRegression(samples)
    expect(slope).toBeCloseTo(-0.1, 1) // ~-0.1 kg/day
  })

  it('returns near-zero slope for stable weight', () => {
    const samples = [DAY(0, 75), DAY(7, 75.1), DAY(14, 74.9)]
    const { slope } = linearRegression(samples)
    expect(Math.abs(slope)).toBeLessThan(0.02)
  })

  it('handles unsorted samples correctly', () => {
    const sorted = [DAY(0, 80), DAY(7, 79.3)]
    const unsorted = [DAY(7, 79.3), DAY(0, 80)]
    const r1 = linearRegression(sorted)
    const r2 = linearRegression(unsorted)
    expect(r1.slope).toBeCloseTo(r2.slope, 4)
  })
})

describe('calcAdaptiveTdee', () => {
  it('TDEE > intake when losing weight', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 80), DAY(7, 79.5), DAY(14, 79.0)],
      avgIntakeKcal: 2000,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    expect(result.tdeeAdaptive).toBeGreaterThan(2000)
  })

  it('TDEE < intake when gaining weight', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 75), DAY(7, 75.4), DAY(14, 75.8)],
      avgIntakeKcal: 2500,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    expect(result.tdeeAdaptive).toBeLessThan(2500)
  })

  it('TDEE ≈ intake when weight stable', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 70), DAY(7, 70.05), DAY(14, 69.95)],
      avgIntakeKcal: 2200,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    expect(Math.abs(result.tdeeAdaptive - 2200)).toBeLessThan(100)
  })

  it('throws when fewer than 2 samples', () => {
    expect(() => calcAdaptiveTdee({
      weightSamples: [DAY(0, 80)],
      avgIntakeKcal: 2000,
      caloriesSource: 'logs',
      windowDays: 14,
    })).toThrow('At least 2 weight samples required')
  })

  it('rounds result to nearest 10 kcal', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 80), DAY(14, 79.0)],
      avgIntakeKcal: 2000,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    expect(result.tdeeAdaptive % 10).toBe(0)
  })

  it('confidence = low when source is protocol', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 80), DAY(7, 79.5), DAY(14, 79.0), DAY(10, 79.2)],
      avgIntakeKcal: 2000,
      caloriesSource: 'protocol',
      windowDays: 14,
    })
    expect(result.confidence).toBe('low')
  })

  it('confidence = low when fewer than 4 samples', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 80), DAY(14, 79.0)],
      avgIntakeKcal: 2000,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    expect(result.confidence).toBe('low')
  })

  it('confidence = high when ≥4 samples + logs source', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 80), DAY(4, 79.7), DAY(8, 79.4), DAY(14, 79.0)],
      avgIntakeKcal: 2000,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    expect(result.confidence).toBe('high')
  })

  it('weightDeltaKg = slope × windowDays', () => {
    const samples = [DAY(0, 80), DAY(7, 79.5), DAY(14, 79.0)]
    const result = calcAdaptiveTdee({
      weightSamples: samples,
      avgIntakeKcal: 2000,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    const { slope } = linearRegression(samples)
    expect(result.weightDeltaKg).toBeCloseTo(slope * 14, 2)
  })

  it('handles rapid weight loss (1 kg/week)', () => {
    const result = calcAdaptiveTdee({
      weightSamples: [DAY(0, 85), DAY(7, 84), DAY(14, 83)],
      avgIntakeKcal: 1800,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    // 1kg/week = ~1100 kcal/day deficit → TDEE ≈ 1800 + 1100 = 2900
    expect(result.tdeeAdaptive).toBeGreaterThan(2500)
  })

  it('formula: tdee = avgIntake + slope * 7700', () => {
    const samples = [DAY(0, 80), DAY(14, 78.6)]
    const { slope } = linearRegression(samples)
    const expected = Math.round((2000 + slope * 7700) / 10) * 10
    const result = calcAdaptiveTdee({
      weightSamples: samples,
      avgIntakeKcal: 2000,
      caloriesSource: 'logs',
      windowDays: 14,
    })
    expect(result.tdeeAdaptive).toBe(expected)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/lib/nutrition/adaptiveTdee.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/nutrition/adaptiveTdee'"

- [ ] **Step 3: Implement the lib**

```typescript
// lib/nutrition/adaptiveTdee.ts

export interface WeightSample {
  date: string       // ISO date 'YYYY-MM-DD'
  weight_kg: number
}

export interface AdaptiveTdeeInput {
  weightSamples: WeightSample[]
  avgIntakeKcal: number
  caloriesSource: 'logs' | 'protocol'
  windowDays: number
}

export interface AdaptiveTdeeResult {
  tdeeAdaptive: number
  weightDeltaKg: number
  slopeKgPerDay: number
  confidence: 'high' | 'low'
}

export function linearRegression(samples: WeightSample[]): { slope: number; intercept: number } {
  const sorted = [...samples].sort((a, b) => a.date.localeCompare(b.date))
  const origin = new Date(sorted[0].date).getTime()
  const points = sorted.map(s => ({
    x: (new Date(s.date).getTime() - origin) / 86400000,
    y: s.weight_kg,
  }))
  const n = points.length
  const sumX = points.reduce((acc, p) => acc + p.x, 0)
  const sumY = points.reduce((acc, p) => acc + p.y, 0)
  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0)
  const sumX2 = points.reduce((acc, p) => acc + p.x * p.x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

export function calcAdaptiveTdee(input: AdaptiveTdeeInput): AdaptiveTdeeResult {
  if (input.weightSamples.length < 2) {
    throw new Error('At least 2 weight samples required')
  }
  const { slope } = linearRegression(input.weightSamples)
  const rawTdee = input.avgIntakeKcal + slope * 7700
  const tdeeAdaptive = Math.round(rawTdee / 10) * 10
  const weightDeltaKg = parseFloat((slope * input.windowDays).toFixed(2))
  const confidence: 'high' | 'low' =
    input.caloriesSource === 'protocol' || input.weightSamples.length < 4
      ? 'low'
      : 'high'
  return { tdeeAdaptive, weightDeltaKg, slopeKgPerDay: slope, confidence }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/lib/nutrition/adaptiveTdee.test.ts
```

Expected: 12 tests PASS

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "adaptiveTdee" | grep -v node_modules
```

Expected: no output (0 errors)

- [ ] **Step 6: Update CHANGELOG and commit**

Add to `CHANGELOG.md` under today's date:
```
FEATURE: lib/nutrition/adaptiveTdee.ts — pure calcAdaptiveTdee + linearRegression, 12 Vitest tests PASS
```

```bash
git add lib/nutrition/adaptiveTdee.ts tests/lib/nutrition/adaptiveTdee.test.ts CHANGELOG.md
git commit -m "feat(nutrition): adaptive TDEE pure lib — weight-delta method, 12 tests"
```

---

## Task 3: Inngest Job — Weekly Cron

**Files:**
- Create: `lib/inngest/functions/adaptive-tdee.ts`
- Modify: `app/api/inngest/route.ts`

- [ ] **Step 1: Create the Inngest function**

```typescript
// lib/inngest/functions/adaptive-tdee.ts
import { inngest } from '@/lib/inngest/client'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { calcAdaptiveTdee } from '@/lib/nutrition/adaptiveTdee'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const adaptiveTdeeFunction = inngest.createFunction(
  {
    id: 'nutrition-adaptive-tdee-weekly',
    retries: 2,
    timeouts: { finish: '10m' },
  },
  { cron: '0 6 * * 1' },
  async ({ step }) => {
    // Step 1: fetch all active shared protocols
    const protocols = await step.run('fetch-active-protocols', async () => {
      const db = svc()
      const { data, error } = await db
        .from('nutrition_protocols')
        .select('id, client_id, coach_id, nutrition_protocol_days(id, calories, protein_g, fat_g, carbs_g, position)')
        .eq('status', 'shared')
      if (error) throw new Error(`fetch-active-protocols: ${error.message}`)
      return data ?? []
    })

    // Fan-out: process each protocol independently
    const results = await Promise.allSettled(
      protocols.map((protocol) =>
        step.run(`process-protocol-${protocol.id}`, async () => {
          const db = svc()
          const clientId = protocol.client_id
          const protocolId = protocol.id
          const coachId = protocol.coach_id
          const days = (protocol.nutrition_protocol_days as any[]) ?? []

          // Gate: need ≥2 weight samples in last 14 days
          const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
          const { data: weightRows } = await db
            .from('assessment_responses')
            .select('value_number, assessment_submissions!inner(submitted_at, client_id)')
            .eq('field_key', 'weight_kg')
            .eq('assessment_submissions.client_id', clientId)
            .gte('assessment_submissions.submitted_at', since)
            .order('assessment_submissions(submitted_at)', { ascending: true })

          const weightSamples = (weightRows ?? [])
            .filter((r: any) => r.value_number != null)
            .map((r: any) => ({
              date: r.assessment_submissions.submitted_at.slice(0, 10),
              weight_kg: r.value_number as number,
            }))

          if (weightSamples.length < 2) {
            return { skipped: true, reason: 'insufficient_weight_samples', protocolId }
          }

          // Fetch avg intake from nutrition_meals last 14 days
          const { data: mealRows } = await db
            .from('nutrition_meals')
            .select('calories, physiological_date')
            .eq('client_id', clientId)
            .gte('physiological_date', since.slice(0, 10))

          let avgIntakeKcal: number
          let caloriesSource: 'logs' | 'protocol'

          if (mealRows && mealRows.length > 0) {
            const totalCal = mealRows.reduce((sum: number, m: any) => sum + (m.calories ?? 0), 0)
            avgIntakeKcal = Math.round(totalCal / 14)
            caloriesSource = 'logs'
          } else {
            // Proxy: use day 1 calories from the protocol
            const day1 = days.sort((a: any, b: any) => a.position - b.position)[0]
            avgIntakeKcal = day1?.calories ?? 2000
            caloriesSource = 'protocol'
          }

          // Calculate adaptive TDEE
          const result = calcAdaptiveTdee({
            weightSamples,
            avgIntakeKcal,
            caloriesSource,
            windowDays: 14,
          })

          // Gate: delta must be > 150 kcal
          // Use first day's calories as tdee_formula proxy
          const day1Cal = days.sort((a: any, b: any) => a.position - b.position)[0]?.calories ?? 2000
          const tdeeFormula = day1Cal
          const deltaKcal = result.tdeeAdaptive - tdeeFormula

          // Save history regardless of delta (protocol_updated = false if skipped)
          const protocolUpdated = Math.abs(deltaKcal) >= 150

          await db.from('nutrition_tdee_history').insert({
            protocol_id: protocolId,
            client_id: clientId,
            tdee_formula: tdeeFormula,
            tdee_adaptive: result.tdeeAdaptive,
            delta_kcal: deltaKcal,
            weight_samples: weightSamples.length,
            calories_source: caloriesSource,
            avg_intake_kcal: avgIntakeKcal,
            weight_delta_kg: result.weightDeltaKg,
            protocol_updated: protocolUpdated,
          })

          if (!protocolUpdated) {
            return { skipped: true, reason: 'delta_below_threshold', deltaKcal, protocolId }
          }

          // Rescale protocol days proportionally
          const ratio = result.tdeeAdaptive / tdeeFormula
          for (const day of days) {
            await db.from('nutrition_protocol_days').update({
              calories: day.calories != null ? Math.round(day.calories * ratio) : null,
              protein_g: day.protein_g != null ? Math.round(day.protein_g * ratio) : null,
              fat_g: day.fat_g != null ? Math.round(day.fat_g * ratio) : null,
              carbs_g: day.carbs_g != null ? Math.round(day.carbs_g * ratio) : null,
            }).eq('id', day.id)
          }

          // Update protocol meta
          await db.from('nutrition_protocols').update({
            tdee_adaptive: result.tdeeAdaptive,
            tdee_adaptive_at: new Date().toISOString(),
            tdee_data_source: caloriesSource === 'protocol' ? 'formula_proxy' : 'weight_delta',
          }).eq('id', protocolId)

          // Fetch client first name for notification
          const { data: clientRow } = await db
            .from('coach_clients')
            .select('first_name')
            .eq('id', clientId)
            .single()
          const firstName = clientRow?.first_name ?? 'Client'

          // Notify client
          await db.from('coach_client_notifications').insert({
            client_id: clientId,
            type: 'tdee_updated',
            title: 'Objectifs nutritionnels ajustés',
            body: 'Ton programme reflète maintenant ta dépense réelle.',
            payload: { action_url: '/client/nutrition' },
          })

          // Notify coach
          const sign = deltaKcal > 0 ? '+' : ''
          await db.from('coach_client_notifications').insert({
            coach_id: coachId,
            client_id: clientId,
            type: 'tdee_coach_alert',
            title: `TDEE ${firstName} recalculé`,
            body: `TDEE : ${tdeeFormula} → ${result.tdeeAdaptive} kcal (${sign}${deltaKcal})`,
            payload: { action_url: `/coach/clients/${clientId}/protocoles/nutrition` },
          })

          return { updated: true, protocolId, tdeeAdaptive: result.tdeeAdaptive, deltaKcal }
        })
      )
    )

    return { processed: protocols.length, results: results.map(r => r.status) }
  }
)
```

- [ ] **Step 2: Register in Inngest route**

In `app/api/inngest/route.ts`, add:

```typescript
import { adaptiveTdeeFunction } from '@/lib/inngest/functions/adaptive-tdee'
```

And add `adaptiveTdeeFunction` to the `functions: [...]` array:

```typescript
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    checkinStreakEvaluateFunction,
    pointsLevelUpdateFunction,
    checkinStreakExpireFunction,
    checkinReminderSendFunction,
    mealAnalyzeFunction,
    adaptiveTdeeFunction,
  ],
})
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "adaptive-tdee|inngest/route" | grep -v node_modules
```

Expected: no output (0 errors)

- [ ] **Step 4: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
FEATURE: lib/inngest/functions/adaptive-tdee.ts — weekly cron Monday 06:00 UTC, fan-out per shared protocol, weight-delta TDEE calc, proportional macro rescale, coach + client notifications
```

```bash
git add lib/inngest/functions/adaptive-tdee.ts app/api/inngest/route.ts CHANGELOG.md
git commit -m "feat(inngest): adaptive TDEE weekly cron — weight-delta, macro rescale, notifications"
```

---

## Task 4: API Routes

**Files:**
- Create: `app/api/clients/[clientId]/nutrition-protocols/[protocolId]/apply-adaptive-tdee/route.ts`
- Create: `app/api/clients/[clientId]/nutrition-tdee-history/route.ts`
- Modify: `app/api/clients/[clientId]/nutrition-data/route.ts`

- [ ] **Step 1: Create the on-demand apply route**

```typescript
// app/api/clients/[clientId]/nutrition-protocols/[protocolId]/apply-adaptive-tdee/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { calcAdaptiveTdee } from '@/lib/nutrition/adaptiveTdee'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { clientId: string; protocolId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()
  const { clientId, protocolId } = params

  // Coach ownership check
  const { data: protocol } = await db
    .from('nutrition_protocols')
    .select('id, coach_id, nutrition_protocol_days(id, calories, protein_g, fat_g, carbs_g, position)')
    .eq('id', protocolId)
    .eq('client_id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!protocol) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const days = (protocol.nutrition_protocol_days as any[]) ?? []

  // Fetch weight samples — last 14 days
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: weightRows } = await db
    .from('assessment_responses')
    .select('value_number, assessment_submissions!inner(submitted_at, client_id)')
    .eq('field_key', 'weight_kg')
    .eq('assessment_submissions.client_id', clientId)
    .gte('assessment_submissions.submitted_at', since)

  const weightSamples = (weightRows ?? [])
    .filter((r: any) => r.value_number != null)
    .map((r: any) => ({
      date: r.assessment_submissions.submitted_at.slice(0, 10),
      weight_kg: r.value_number as number,
    }))

  if (weightSamples.length < 2) {
    return NextResponse.json({ error: 'Not enough weight samples (minimum 2 in last 14 days)' }, { status: 422 })
  }

  // Fetch avg intake
  const { data: mealRows } = await db
    .from('nutrition_meals')
    .select('calories')
    .eq('client_id', clientId)
    .gte('physiological_date', since.slice(0, 10))

  let avgIntakeKcal: number
  let caloriesSource: 'logs' | 'protocol'

  if (mealRows && mealRows.length > 0) {
    avgIntakeKcal = Math.round(mealRows.reduce((s: number, m: any) => s + (m.calories ?? 0), 0) / 14)
    caloriesSource = 'logs'
  } else {
    const day1 = days.sort((a: any, b: any) => a.position - b.position)[0]
    avgIntakeKcal = day1?.calories ?? 2000
    caloriesSource = 'protocol'
  }

  const result = calcAdaptiveTdee({ weightSamples, avgIntakeKcal, caloriesSource, windowDays: 14 })
  const day1Cal = days.sort((a: any, b: any) => a.position - b.position)[0]?.calories ?? 2000
  const tdeeFormula = day1Cal
  const deltaKcal = result.tdeeAdaptive - tdeeFormula
  const ratio = result.tdeeAdaptive / tdeeFormula

  // Rescale days
  for (const day of days) {
    await db.from('nutrition_protocol_days').update({
      calories: day.calories != null ? Math.round(day.calories * ratio) : null,
      protein_g: day.protein_g != null ? Math.round(day.protein_g * ratio) : null,
      fat_g: day.fat_g != null ? Math.round(day.fat_g * ratio) : null,
      carbs_g: day.carbs_g != null ? Math.round(day.carbs_g * ratio) : null,
    }).eq('id', day.id)
  }

  await db.from('nutrition_protocols').update({
    tdee_adaptive: result.tdeeAdaptive,
    tdee_adaptive_at: new Date().toISOString(),
    tdee_data_source: caloriesSource === 'protocol' ? 'formula_proxy' : 'weight_delta',
  }).eq('id', protocolId)

  await db.from('nutrition_tdee_history').insert({
    protocol_id: protocolId,
    client_id: clientId,
    tdee_formula: tdeeFormula,
    tdee_adaptive: result.tdeeAdaptive,
    delta_kcal: deltaKcal,
    weight_samples: weightSamples.length,
    calories_source: caloriesSource,
    avg_intake_kcal: avgIntakeKcal,
    weight_delta_kg: result.weightDeltaKg,
    protocol_updated: true,
  })

  return NextResponse.json({ tdeeAdaptive: result.tdeeAdaptive, deltaKcal, protocolUpdated: true })
}
```

- [ ] **Step 2: Create the history GET route**

```typescript
// app/api/clients/[clientId]/nutrition-tdee-history/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()

  // Ownership check
  const { data: client } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await db
    .from('nutrition_tdee_history')
    .select('*')
    .eq('client_id', params.clientId)
    .order('calculated_at', { ascending: false })
    .limit(5)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
```

- [ ] **Step 3: Modify nutrition-data route — return tdee_adaptive fields**

In `app/api/clients/[clientId]/nutrition-data/route.ts`, find the section that fetches the protocol (search for `nutrition_protocols`) and update the SELECT to include the three new columns. Find where the response JSON is built and add:

```typescript
// In the existing protocol fetch query, change the select to include:
// tdee_adaptive, tdee_adaptive_at, tdee_data_source
// Example — find the existing protocol query and add these fields to the select string:
.select('id, name, status, tdee_adaptive, tdee_adaptive_at, tdee_data_source, ...')

// Then in the returned JSON object, add:
tdeeAdaptive: protocol?.tdee_adaptive ?? null,
tdeeAdaptiveAt: protocol?.tdee_adaptive_at ?? null,
tdeeDataSource: protocol?.tdee_data_source ?? null,
```

Note: Read the full `app/api/clients/[clientId]/nutrition-data/route.ts` first to find the exact location of the protocol fetch and response construction. Add the three fields to both the SELECT and the response object. Do not break any existing fields.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "apply-adaptive|tdee-history|nutrition-data" | grep -v node_modules
```

Expected: no output

- [ ] **Step 5: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
FEATURE: POST /api/clients/[clientId]/nutrition-protocols/[protocolId]/apply-adaptive-tdee — on-demand coach recalc
FEATURE: GET /api/clients/[clientId]/nutrition-tdee-history — last 5 TDEE history entries
FIX: nutrition-data route returns tdee_adaptive, tdee_adaptive_at, tdee_data_source
```

```bash
git add "app/api/clients/[clientId]/nutrition-protocols/[protocolId]/apply-adaptive-tdee/route.ts" \
        "app/api/clients/[clientId]/nutrition-tdee-history/route.ts" \
        "app/api/clients/[clientId]/nutrition-data/route.ts" \
        CHANGELOG.md
git commit -m "feat(api): adaptive TDEE apply route, history route, nutrition-data fields"
```

---

## Task 5: Coach UI — Nutrition Studio

**Files:**
- Modify: `components/nutrition/studio/useNutritionStudio.ts`
- Modify: `components/nutrition/studio/CalculationEngine.tsx`

- [ ] **Step 1: Add adaptive TDEE state and fetcher to useNutritionStudio**

In `components/nutrition/studio/useNutritionStudio.ts`, after the existing state declarations, add:

```typescript
// After existing useState declarations (around line 135):
const [tdeeAdaptive, setTdeeAdaptive] = useState<number | null>(null)
const [tdeeAdaptiveAt, setTdeeAdaptiveAt] = useState<Date | null>(null)
const [tdeeDataSource, setTdeeDataSource] = useState<'weight_delta' | 'formula_proxy' | null>(null)
const [tdeeHistory, setTdeeHistory] = useState<TdeeHistoryEntry[]>([])
const [applyingAdaptive, setApplyingAdaptive] = useState(false)
```

Add the `TdeeHistoryEntry` type near the top of the file (before the hook function):

```typescript
export interface TdeeHistoryEntry {
  id: string
  calculated_at: string
  tdee_formula: number
  tdee_adaptive: number
  delta_kcal: number
  weight_samples: number
  calories_source: 'logs' | 'protocol'
  avg_intake_kcal: number
  weight_delta_kg: number
  protocol_updated: boolean
}
```

In the existing `useEffect` that fetches nutrition-data (around line 210), after setting the existing state from the response, add:

```typescript
// After existing setClientData / setTrainingConfig etc:
if (json.tdeeAdaptive != null) setTdeeAdaptive(json.tdeeAdaptive)
if (json.tdeeAdaptiveAt) setTdeeAdaptiveAt(new Date(json.tdeeAdaptiveAt))
if (json.tdeeDataSource) setTdeeDataSource(json.tdeeDataSource)
```

Add a fetch for history after the main data fetch (inside the same useEffect, after the nutrition-data fetch resolves):

```typescript
const currentId = savedProtocolId ?? existingProtocol?.id
if (currentId) {
  fetch(`/api/clients/${clientId}/nutrition-tdee-history`)
    .then(r => r.ok ? r.json() : [])
    .then(setTdeeHistory)
    .catch(() => {})
}
```

Add the `applyAdaptiveTdee` callback before the return:

```typescript
const applyAdaptiveTdee = useCallback(async () => {
  const currentId = savedProtocolId ?? existingProtocol?.id
  if (!currentId) return
  setApplyingAdaptive(true)
  try {
    const res = await fetch(
      `/api/clients/${clientId}/nutrition-protocols/${currentId}/apply-adaptive-tdee`,
      { method: 'POST' }
    )
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()
    setTdeeAdaptive(data.tdeeAdaptive)
    setTdeeAdaptiveAt(new Date())
    // Refresh history
    fetch(`/api/clients/${clientId}/nutrition-tdee-history`)
      .then(r => r.ok ? r.json() : [])
      .then(setTdeeHistory)
      .catch(() => {})
  } finally {
    setApplyingAdaptive(false)
  }
}, [clientId, savedProtocolId, existingProtocol])
```

Add these to the hook return object:
```typescript
tdeeAdaptive,
tdeeAdaptiveAt,
tdeeDataSource,
tdeeHistory,
applyAdaptiveTdee,
applyingAdaptive,
```

- [ ] **Step 2: Add adaptive TDEE block to CalculationEngine**

In `components/nutrition/studio/CalculationEngine.tsx`, find where the component receives props from `useNutritionStudio` and add the new values. Then, after the TDEE waterfall section, add this block:

```tsx
{/* ── Adaptive TDEE block ── */}
{tdeeAdaptive != null && macroResult && (
  <div className="bg-white/[0.03] border border-[0.3px] border-white/[0.06] rounded-xl p-4 space-y-3">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/40">
        TDEE Adaptatif
        {tdeeDataSource === 'formula_proxy' && (
          <span className="ml-2 text-amber-400">⚠ Proxy</span>
        )}
      </p>
      <button
        onClick={applyAdaptiveTdee}
        disabled={applyingAdaptive}
        className="text-[11px] font-bold text-[#1f8a65] hover:text-[#217356] disabled:opacity-50 transition-colors"
      >
        {applyingAdaptive ? 'Application…' : 'Appliquer'}
      </button>
    </div>

    <div className="flex items-baseline gap-2">
      <p className="text-[28px] font-black text-white leading-none tabular-nums">
        {tdeeAdaptive.toLocaleString('fr-FR')}
      </p>
      <p className="text-[13px] text-white/40">kcal/jour</p>
      {macroResult.tdee != null && (
        <p className={`text-[12px] font-semibold ml-auto ${
          tdeeAdaptive - macroResult.tdee > 0 ? 'text-[#1f8a65]' : 'text-amber-400'
        }`}>
          {tdeeAdaptive - macroResult.tdee > 0 ? '↑' : '↓'}{' '}
          {tdeeAdaptive - macroResult.tdee > 0 ? '+' : ''}
          {tdeeAdaptive - macroResult.tdee} vs formule
        </p>
      )}
    </div>

    {tdeeAdaptiveAt && (
      <p className="text-[10px] text-white/30">
        Mis à jour le {tdeeAdaptiveAt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
      </p>
    )}

    {/* History collapsible */}
    {tdeeHistory.length > 0 && (
      <details className="group">
        <summary className="text-[10px] text-white/40 cursor-pointer hover:text-white/60 transition-colors list-none">
          Historique ▾ ({tdeeHistory.length} entrée{tdeeHistory.length > 1 ? 's' : ''})
        </summary>
        <div className="mt-2 space-y-1.5">
          {tdeeHistory.map(h => (
            <div key={h.id} className="flex items-center justify-between text-[10px] text-white/40">
              <span>{new Date(h.calculated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
              <span className="tabular-nums">{h.tdee_formula} → {h.tdee_adaptive} kcal</span>
              <span className={h.delta_kcal > 0 ? 'text-[#1f8a65]' : 'text-amber-400'}>
                {h.delta_kcal > 0 ? '+' : ''}{h.delta_kcal}
              </span>
              <span className="text-white/20">{h.protocol_updated ? '✓' : '—'}</span>
            </div>
          ))}
        </div>
      </details>
    )}
  </div>
)}
```

The props `tdeeAdaptive`, `tdeeAdaptiveAt`, `tdeeDataSource`, `tdeeHistory`, `applyAdaptiveTdee`, `applyingAdaptive` need to be passed from `NutritionStudio.tsx` → `CalculationEngine.tsx`. Read `NutritionStudio.tsx` to find where CalculationEngine is rendered and add these props. Update `CalculationEngine`'s props interface accordingly.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "useNutritionStudio|CalculationEngine|NutritionStudio" | grep -v node_modules
```

Expected: no output

- [ ] **Step 4: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
FEATURE: Nutrition Studio — adaptive TDEE block in CalculationEngine (TDEE réel, delta vs formule, badge proxy, Appliquer button, historique 5 runs collapsible)
```

```bash
git add components/nutrition/studio/useNutritionStudio.ts components/nutrition/studio/CalculationEngine.tsx CHANGELOG.md
git commit -m "feat(studio): adaptive TDEE block — history, apply button, proxy badge"
```

---

## Task 6: Client Nutrition Page + NotificationsBar

**Files:**
- Modify: `app/client/nutrition/page.tsx`
- Modify: `components/client/smart/NotificationsBar.tsx`

- [ ] **Step 1: Add tdee_adaptive to protocol fetch in client nutrition page**

In `app/client/nutrition/page.tsx`, find the `protoResult` fetch (around line 43):

```typescript
// Change the select from:
.select('nutrition_protocol_days(...)')
// To:
.select('tdee_adaptive, tdee_data_source, nutrition_protocol_days(name, calories, protein_g, carbs_g, fat_g, hydration_ml, carb_cycle_type, cycle_sync_phase, recommendations)')
```

Then extract the adaptive TDEE values after `protoData` is resolved:

```typescript
// After: const protocolDay = (protoData?.nutrition_protocol_days as any)?.[0] ?? null
const tdeeAdaptive = (protoData as any)?.tdee_adaptive ?? null
const tdeeDataSource = (protoData as any)?.tdee_data_source ?? null
```

Add the UI block in the JSX, between `<SmartNutritionHero>` and `<SmartAlertsFeed>` (or after the hero — read the existing JSX to find the right spot):

```tsx
{/* Adaptive TDEE block */}
{tdeeAdaptive != null && (
  <div className="bg-[#161616] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center justify-between">
    <div>
      <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30 mb-0.5">
        Dépense énergétique
      </p>
      <p className="text-[20px] font-black text-white leading-none tabular-nums">
        {tdeeDataSource === 'formula_proxy'
          ? 'Estimation'
          : `${tdeeAdaptive.toLocaleString('fr-FR')} kcal/jour`}
      </p>
    </div>
    <p className="text-[10px] text-white/30 text-right max-w-[120px] leading-snug">
      {tdeeDataSource === 'formula_proxy'
        ? 'Basé sur ton programme'
        : 'Basé sur tes pesées des 14 derniers jours'}
    </p>
  </div>
)}
```

- [ ] **Step 2: Add tdee_updated to NotificationsBar**

In `components/client/smart/NotificationsBar.tsx`:

Add `'tdee_updated'` to the `Notification['type']` union:

```typescript
export type Notification = {
  id: string;
  type: "coach_note" | "bilan_pending" | "program_assigned" | "system_reminder" | "tdee_updated";
  // ... rest unchanged
};
```

Add to `TYPE_ICON`:

```typescript
import { TrendingUp } from 'lucide-react'

const TYPE_ICON: Record<Notification["type"], React.ElementType> = {
  coach_note: MessageSquare,
  bilan_pending: ClipboardList,
  program_assigned: Sparkles,
  system_reminder: Clock,
  tdee_updated: TrendingUp,
};
```

Add to `handleClick`:

```typescript
} else if (n.type === "tdee_updated") {
  router.push("/client/nutrition");
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "nutrition/page|NotificationsBar" | grep -v node_modules
```

Expected: no output

- [ ] **Step 4: Update CHANGELOG and commit**

Add to `CHANGELOG.md`:
```
FEATURE: client nutrition page — adaptive TDEE display block (kcal/jour ou "Estimation" si proxy)
FEATURE: NotificationsBar — tdee_updated notification type with TrendingUp icon, links to /client/nutrition
```

```bash
git add app/client/nutrition/page.tsx components/client/smart/NotificationsBar.tsx CHANGELOG.md
git commit -m "feat(client): adaptive TDEE on nutrition page + tdee_updated notification type"
```

---

## Task 7: Final TypeScript Check + Full Test Run

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v node_modules | grep -v "stripe\|BodyFat\|webhook\|program-templates" | head -20
```

Expected: no new errors (pre-existing stripe/Bodyfat errors are out of scope)

- [ ] **Step 2: Run all nutrition tests**

```bash
npx vitest run tests/lib/nutrition/
```

Expected: all tests PASS including the 12 new adaptiveTdee tests

- [ ] **Step 3: Final CHANGELOG entry and commit**

Add to `CHANGELOG.md`:
```
CHORE: adaptive TDEE — final TS check + full test run, 0 new errors
```

```bash
git add CHANGELOG.md
git commit -m "chore(adaptive-tdee): final TS check + test verification"
```

---

## Manual Actions Required

After Task 1 (migration):
1. Apply `supabase/migrations/20260519_adaptive_tdee.sql` via **Supabase Dashboard → SQL Editor**

After Task 3 (Inngest job):
2. Register the new event `'nutrition/adaptive-tdee.weekly'` in the **Inngest Dashboard → Event Types** if required by your plan
3. Verify the cron schedule appears in **Inngest Dashboard → Functions** after deployment

## Verification Checklist

- [ ] `nutrition_tdee_history` table exists in Supabase with correct RLS
- [ ] `nutrition_protocols` has `tdee_adaptive`, `tdee_adaptive_at`, `tdee_data_source` columns
- [ ] `calcAdaptiveTdee` returns correct TDEE for weight loss / gain / stable scenarios
- [ ] 12 Vitest tests pass
- [ ] Inngest function appears in dashboard after deploy
- [ ] POST `/apply-adaptive-tdee` returns `{ tdeeAdaptive, deltaKcal, protocolUpdated: true }`
- [ ] GET `/nutrition-tdee-history` returns ≤5 entries for coach
- [ ] Nutrition Studio shows adaptive TDEE block when `tdeeAdaptive != null`
- [ ] Client nutrition page shows "2 340 kcal/jour" or "Estimation" block
- [ ] `tdee_updated` notification navigates to `/client/nutrition`
- [ ] `npx tsc --noEmit` — 0 new errors
