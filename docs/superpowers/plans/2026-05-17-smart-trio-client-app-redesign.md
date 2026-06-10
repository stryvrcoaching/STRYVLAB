# Smart Trio Client App Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `/client` PWA into 3 pillars (Smart Agenda accueil, Smart Workout, Smart Nutrition) with central STRYVR logo radial action menu, IA alerts, and 2 new DB tables.

**Architecture:** Next.js App Router server components for data loading + client components for interactivity. Pure-function libs in `lib/client/smart/` for testable alerts/timeline logic. Two new Supabase tables with RLS. Reuse existing performance analyzer and volume-targets libs.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Supabase Postgres + RLS, Tailwind DS v3.0 (`#0d0d0d`/`#161616`/`#ffe01e`), Framer Motion, Phosphor + Lucide icons, Vitest, Barlow + Barlow Condensed fonts.

**Spec:** `docs/superpowers/specs/2026-05-17-smart-trio-client-app-redesign.md`

---

## File Structure

### New files

**Migrations:**
- `supabase/migrations/20260517_coach_client_notifications.sql`
- `supabase/migrations/20260517_client_activity_logs.sql`

**Libs (pure fns):**
- `lib/client/smart/nutritionAlerts.ts`
- `lib/client/smart/workoutAlerts.ts`
- `lib/client/smart/waterAggregation.ts`
- `lib/client/smart/timelineBuilder.ts`

**Tests:**
- `tests/lib/client/smart/nutritionAlerts.test.ts`
- `tests/lib/client/smart/workoutAlerts.test.ts`
- `tests/lib/client/smart/waterAggregation.test.ts`
- `tests/lib/client/smart/timelineBuilder.test.ts`

**Components:**
- `components/client/smart/NotificationsBar.tsx`
- `components/client/smart/SmartNutritionWidget.tsx`
- `components/client/smart/SmartWorkoutWidget.tsx`
- `components/client/smart/SmartAgendaTimeline.tsx`
- `components/client/smart/RadialActionMenu.tsx`
- `components/client/smart/FreeActivitySheet.tsx`
- `components/client/smart/SmartAlertsFeed.tsx`
- `components/client/smart/SmartNutritionHero.tsx`
- `components/client/smart/CoachProtocolCard.tsx`
- `components/client/smart/RemainingBreakdown.tsx`
- `components/client/smart/WeeklyTrendStrip.tsx`
- `components/client/smart/SmartWorkoutHero.tsx`
- `components/client/smart/SmartWorkoutAlerts.tsx`
- `components/client/smart/SessionPreview.tsx`
- `components/client/smart/VolumeCoverageWidget.tsx`
- `components/client/smart/RecentSessionsStrip.tsx`

**API routes:**
- `app/api/client/notifications/route.ts`
- `app/api/client/notifications/[id]/route.ts`
- `app/api/client/activity-logs/route.ts`
- `app/api/client/activity-logs/[id]/route.ts`
- `app/api/client/nutrition-alerts/route.ts`
- `app/api/client/workout-alerts/route.ts`
- `app/api/client/volume-coverage/route.ts`
- `app/api/client/nutrition/today/route.ts`
- `app/api/client/nutrition/weekly-trend/route.ts`
- `app/api/client/timeline/today/route.ts`
- `app/api/client/recent-sessions/route.ts`

### Modified files

- `components/client/BottomNav.tsx` — 5 slots + central logo button + radial menu
- `components/client/ClientTopBar.tsx` — dynamic labels per section
- `app/client/page.tsx` — Smart Agenda accueil refonte
- `app/client/nutrition/page.tsx` — Smart Nutrition vue intelligente
- `app/client/programme/ProgrammeClientPage.tsx` — Smart Workout refonte
- `lib/i18n/clientTranslations.ts` — nouvelles clés `smart.*` FR/EN/ES
- `utils/supabase/middleware.ts` — redirects `/client/agenda` + `/client/progress` → `/client`

### Deleted files/folders

- `app/client/agenda/` (entire route)
- `app/client/progress/` (entire route)
- `components/client/AgendaDayView.tsx`
- `components/client/AgendaWeekView.tsx`
- `components/client/AgendaEventCard.tsx`
- `components/client/ProgressCharts.tsx`
- `components/client/BottomNavPlusMenu.tsx`
- `app/client/progress/PRsPodium.tsx`
- `app/client/progress/ProgressHeatmap.tsx`
- `app/client/progress/ProgressVolumeChart.tsx`
- `app/client/progress/ProgressClientPage.tsx`

---

## Task 1: DB Migration — coach_client_notifications

**Files:**
- Create: `supabase/migrations/20260517_coach_client_notifications.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- supabase/migrations/20260517_coach_client_notifications.sql
CREATE TABLE IF NOT EXISTS coach_client_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('coach_note', 'bilan_pending', 'program_assigned', 'system_reminder')),
  title text NOT NULL,
  body text,
  payload jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_client_active
  ON coach_client_notifications (client_id, dismissed_at, created_at DESC);

ALTER TABLE coach_client_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notif_client_select ON coach_client_notifications;
CREATE POLICY notif_client_select ON coach_client_notifications
  FOR SELECT USING (
    client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS notif_client_update ON coach_client_notifications;
CREATE POLICY notif_client_update ON coach_client_notifications
  FOR UPDATE USING (
    client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS notif_coach_insert ON coach_client_notifications;
CREATE POLICY notif_coach_insert ON coach_client_notifications
  FOR INSERT WITH CHECK (
    client_id IN (SELECT id FROM coach_clients WHERE coach_id = auth.uid())
  );
```

- [ ] **Step 2: Document manual apply requirement**

Migration must be applied manually via Supabase Dashboard SQL Editor (Supabase CLI not configured locally). Note in CHANGELOG.md + `.claude/rules/project-state.md` under "Points de vigilance".

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260517_coach_client_notifications.sql
git commit -m "schema: add coach_client_notifications table with RLS"
```

---

## Task 2: DB Migration — client_activity_logs

**Files:**
- Create: `supabase/migrations/20260517_client_activity_logs.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- supabase/migrations/20260517_client_activity_logs.sql
CREATE TABLE IF NOT EXISTS client_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES coach_clients(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('running','cycling','swimming','walking','team_sport','other')),
  custom_label text,
  started_at timestamptz NOT NULL,
  duration_min int NOT NULL CHECK (duration_min BETWEEN 1 AND 360),
  intensity int NOT NULL CHECK (intensity BETWEEN 1 AND 10),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_client_date
  ON client_activity_logs (client_id, started_at DESC);

ALTER TABLE client_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_client_all ON client_activity_logs;
CREATE POLICY activity_client_all ON client_activity_logs
  FOR ALL USING (
    client_id IN (SELECT id FROM coach_clients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS activity_coach_select ON client_activity_logs;
CREATE POLICY activity_coach_select ON client_activity_logs
  FOR SELECT USING (
    client_id IN (SELECT id FROM coach_clients WHERE coach_id = auth.uid())
  );
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260517_client_activity_logs.sql
git commit -m "schema: add client_activity_logs table with RLS"
```

---

## Task 3: Lib — waterAggregation (pure fn + tests)

**Files:**
- Create: `lib/client/smart/waterAggregation.ts`
- Test: `tests/lib/client/smart/waterAggregation.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/lib/client/smart/waterAggregation.test.ts
import { describe, it, expect } from 'vitest'
import { groupWaterByTimeOfDay, type WaterLog } from '@/lib/client/smart/waterAggregation'

describe('groupWaterByTimeOfDay', () => {
  const mk = (iso: string, ml: number): WaterLog => ({ logged_at: iso, amount_ml: ml })

  it('returns zero totals for empty input', () => {
    const r = groupWaterByTimeOfDay([])
    expect(r.morning).toBe(0)
    expect(r.midday).toBe(0)
    expect(r.afternoon).toBe(0)
    expect(r.evening).toBe(0)
  })

  it('groups by time slot (morning 5-12, midday 12-15, afternoon 15-19, evening 19-24)', () => {
    const logs = [
      mk('2026-05-17T07:00:00Z', 250),
      mk('2026-05-17T09:30:00Z', 500),
      mk('2026-05-17T13:00:00Z', 250),
      mk('2026-05-17T16:00:00Z', 300),
      mk('2026-05-17T20:00:00Z', 250),
    ]
    const r = groupWaterByTimeOfDay(logs, 'UTC')
    expect(r.morning).toBe(750)
    expect(r.midday).toBe(250)
    expect(r.afternoon).toBe(300)
    expect(r.evening).toBe(250)
  })

  it('ignores logs before 5h or after 24h boundary', () => {
    const logs = [mk('2026-05-17T03:00:00Z', 100), mk('2026-05-17T07:00:00Z', 250)]
    const r = groupWaterByTimeOfDay(logs, 'UTC')
    expect(r.morning).toBe(250)
  })
})
```

- [ ] **Step 2: Run test to verify FAIL**

Run: `npx vitest run tests/lib/client/smart/waterAggregation.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement waterAggregation.ts**

```ts
// lib/client/smart/waterAggregation.ts
export type WaterLog = {
  logged_at: string
  amount_ml: number
}

export type WaterByTimeOfDay = {
  morning: number
  midday: number
  afternoon: number
  evening: number
}

function getHourInTz(iso: string, tz = 'Europe/Paris'): number {
  const d = new Date(iso)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  })
  const parts = fmt.formatToParts(d)
  const h = parts.find(p => p.type === 'hour')?.value ?? '0'
  return parseInt(h, 10)
}

export function groupWaterByTimeOfDay(
  logs: WaterLog[],
  tz: string = 'Europe/Paris'
): WaterByTimeOfDay {
  const out: WaterByTimeOfDay = { morning: 0, midday: 0, afternoon: 0, evening: 0 }
  for (const log of logs) {
    const hour = getHourInTz(log.logged_at, tz)
    if (hour >= 5 && hour < 12) out.morning += log.amount_ml
    else if (hour >= 12 && hour < 15) out.midday += log.amount_ml
    else if (hour >= 15 && hour < 19) out.afternoon += log.amount_ml
    else if (hour >= 19 && hour < 24) out.evening += log.amount_ml
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify PASS**

Run: `npx vitest run tests/lib/client/smart/waterAggregation.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'waterAggregation|smart' || echo 'clean'`
Expected: `clean`

- [ ] **Step 6: Commit**

```bash
git add lib/client/smart/waterAggregation.ts tests/lib/client/smart/waterAggregation.test.ts
git commit -m "feat(smart): add waterAggregation lib + tests"
```

---

## Task 4: Lib — nutritionAlerts (pure fn + tests)

**Files:**
- Create: `lib/client/smart/nutritionAlerts.ts`
- Test: `tests/lib/client/smart/nutritionAlerts.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/lib/client/smart/nutritionAlerts.test.ts
import { describe, it, expect } from 'vitest'
import { computeNutritionAlerts, type NutritionInput } from '@/lib/client/smart/nutritionAlerts'

describe('computeNutritionAlerts', () => {
  const baseInput: NutritionInput = {
    consumed: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, water_ml: 0 },
    target: { kcal: 2400, protein_g: 160, carbs_g: 280, fat_g: 70, water_ml: 2500 },
    currentHour: 14,
    hasLunchLog: true,
  }

  it('returns empty array if everything on track', () => {
    const input: NutritionInput = {
      ...baseInput,
      consumed: { kcal: 1400, protein_g: 110, carbs_g: 180, fat_g: 40, water_ml: 1500 },
    }
    const r = computeNutritionAlerts(input)
    expect(r.length).toBe(0)
  })

  it('triggers protein_low warning when behind schedule after 14h', () => {
    const input: NutritionInput = {
      ...baseInput,
      consumed: { ...baseInput.consumed, protein_g: 50 }, // expected ~74g (160 * 14/22 * 0.8 ≈ 81g threshold)
    }
    const r = computeNutritionAlerts(input)
    expect(r.find(a => a.code === 'protein_low')).toBeDefined()
    expect(r.find(a => a.code === 'protein_low')?.severity).toBe('warning')
  })

  it('triggers carbs_limit critical when carbs exceeds target', () => {
    const input: NutritionInput = {
      ...baseInput,
      consumed: { ...baseInput.consumed, carbs_g: 300 },
    }
    const r = computeNutritionAlerts(input)
    expect(r.find(a => a.code === 'carbs_limit')?.severity).toBe('critical')
  })

  it('triggers hydration_low warning if water < 50% after 14h', () => {
    const input: NutritionInput = {
      ...baseInput,
      consumed: { ...baseInput.consumed, water_ml: 1000 },
    }
    const r = computeNutritionAlerts(input)
    expect(r.find(a => a.code === 'hydration_low')?.severity).toBe('warning')
  })

  it('triggers lunch_missing info between 13h-14h if no lunch log', () => {
    const input: NutritionInput = { ...baseInput, currentHour: 13, hasLunchLog: false }
    const r = computeNutritionAlerts(input)
    expect(r.find(a => a.code === 'lunch_missing')?.severity).toBe('info')
  })

  it('does NOT trigger protein_low before 14h', () => {
    const input: NutritionInput = { ...baseInput, currentHour: 10, consumed: { ...baseInput.consumed, protein_g: 10 } }
    const r = computeNutritionAlerts(input)
    expect(r.find(a => a.code === 'protein_low')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify FAIL**

Run: `npx vitest run tests/lib/client/smart/nutritionAlerts.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement nutritionAlerts.ts**

```ts
// lib/client/smart/nutritionAlerts.ts
export type NutritionAlertCode =
  | 'protein_low'
  | 'carbs_limit'
  | 'hydration_low'
  | 'lunch_missing'

export type NutritionAlertSeverity = 'info' | 'warning' | 'critical'

export type NutritionAlert = {
  code: NutritionAlertCode
  severity: NutritionAlertSeverity
  title: string
  body?: string
  delta?: number
}

export type NutritionConsumed = {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  water_ml: number
}

export type NutritionInput = {
  consumed: NutritionConsumed
  target: NutritionConsumed
  currentHour: number   // 0-23
  hasLunchLog: boolean
}

export function computeNutritionAlerts(input: NutritionInput): NutritionAlert[] {
  const alerts: NutritionAlert[] = []
  const { consumed, target, currentHour, hasLunchLog } = input

  // Rule 1: protein_low (warning) — after 14h, behind schedule
  if (currentHour >= 14) {
    const expected = target.protein_g * (currentHour / 22)
    const threshold = expected * 0.8
    if (consumed.protein_g < threshold) {
      const delta = Math.round(target.protein_g - consumed.protein_g)
      alerts.push({
        code: 'protein_low',
        severity: 'warning',
        title: 'PROTÉINES EN RETARD',
        body: `il te reste ${delta}g pour atteindre ${target.protein_g}g`,
        delta,
      })
    }
  }

  // Rule 2: carbs_limit (critical) — over target
  if (consumed.carbs_g > target.carbs_g) {
    const delta = Math.round(consumed.carbs_g - target.carbs_g)
    alerts.push({
      code: 'carbs_limit',
      severity: 'critical',
      title: 'LIMITE GLUCIDES ATTEINTE',
      body: `-${delta}g sur ta cible`,
      delta,
    })
  }

  // Rule 3: hydration_low (warning) — after 14h, <50% of target
  if (currentHour >= 14) {
    const ratio = target.water_ml > 0 ? consumed.water_ml / target.water_ml : 1
    if (ratio < 0.5) {
      const deltaMl = target.water_ml - consumed.water_ml
      const deltaL = (deltaMl / 1000).toFixed(1)
      alerts.push({
        code: 'hydration_low',
        severity: 'warning',
        title: 'HYDRATATION FAIBLE',
        body: `il manque ${deltaL}L`,
        delta: deltaMl,
      })
    }
  }

  // Rule 4: lunch_missing (info) — between 13-14h, no lunch log
  if (currentHour >= 13 && currentHour < 15 && !hasLunchLog) {
    alerts.push({
      code: 'lunch_missing',
      severity: 'info',
      title: 'PAS DE DÉJEUNER LOGUÉ',
    })
  }

  return alerts
}
```

- [ ] **Step 4: Run tests to verify PASS**

Run: `npx vitest run tests/lib/client/smart/nutritionAlerts.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/client/smart/nutritionAlerts.ts tests/lib/client/smart/nutritionAlerts.test.ts
git commit -m "feat(smart): add nutritionAlerts lib + tests (4 rules)"
```

---

## Task 5: Lib — workoutAlerts (pure fn + tests)

**Files:**
- Create: `lib/client/smart/workoutAlerts.ts`
- Test: `tests/lib/client/smart/workoutAlerts.test.ts`

- [ ] **Step 1: Inspect existing analyzer types**

Run: `cat lib/performance/analyzer.ts | head -60`
Expected: see `analyzeExercisePerformance` return type (ExercisePerformance items with `completion_rate`, `avg_rir`, `rir_trend`, `overloads_last_4_weeks`, `stagnation`, `overreaching`).

- [ ] **Step 2: Write failing tests**

```ts
// tests/lib/client/smart/workoutAlerts.test.ts
import { describe, it, expect } from 'vitest'
import { computeWorkoutAlerts, type WorkoutAnalysisRow } from '@/lib/client/smart/workoutAlerts'

describe('computeWorkoutAlerts', () => {
  const mk = (overrides: Partial<WorkoutAnalysisRow> = {}): WorkoutAnalysisRow => ({
    exercise_name: 'Bench Press',
    completion_rate: 0.9,
    avg_rir: 2,
    rir_trend: 'stable',
    overloads_last_4_weeks: 1,
    stagnation: false,
    overreaching: false,
    ...overrides,
  })

  it('returns empty if no rows', () => {
    expect(computeWorkoutAlerts([])).toEqual([])
  })

  it('triggers overreaching critical when avg_rir <= 1 and completion < 0.8', () => {
    const rows = [mk({ avg_rir: 1, completion_rate: 0.7, overreaching: true })]
    const r = computeWorkoutAlerts(rows)
    expect(r.find(a => a.code === 'overreaching')?.severity).toBe('critical')
    expect(r.find(a => a.code === 'overreaching')?.title).toContain('SURMENAGE')
  })

  it('triggers stagnation warning when stagnation flag set', () => {
    const rows = [mk({ stagnation: true })]
    const r = computeWorkoutAlerts(rows)
    expect(r.find(a => a.code === 'stagnation')?.severity).toBe('warning')
  })

  it('triggers progression info when completion>0.95 + rir_trend=improving', () => {
    const rows = [mk({ completion_rate: 0.97, rir_trend: 'improving' })]
    const r = computeWorkoutAlerts(rows)
    expect(r.find(a => a.code === 'progression')?.severity).toBe('info')
  })

  it('returns one alert per exercise + prioritizes critical', () => {
    const rows = [
      mk({ exercise_name: 'Squat', overreaching: true, avg_rir: 0, completion_rate: 0.6 }),
      mk({ exercise_name: 'Squat', stagnation: true }),
    ]
    const r = computeWorkoutAlerts(rows)
    const squatAlerts = r.filter(a => a.exercise_name === 'Squat')
    expect(squatAlerts.length).toBe(1)
    expect(squatAlerts[0].code).toBe('overreaching')
  })
})
```

- [ ] **Step 3: Run test to verify FAIL**

Run: `npx vitest run tests/lib/client/smart/workoutAlerts.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement workoutAlerts.ts**

```ts
// lib/client/smart/workoutAlerts.ts
export type WorkoutAlertCode = 'overreaching' | 'stagnation' | 'progression'
export type WorkoutAlertSeverity = 'info' | 'warning' | 'critical'

export type WorkoutAlert = {
  code: WorkoutAlertCode
  severity: WorkoutAlertSeverity
  exercise_name: string
  title: string
  body: string
}

export type WorkoutAnalysisRow = {
  exercise_name: string
  completion_rate: number
  avg_rir: number | null
  rir_trend: 'improving' | 'declining' | 'stable' | 'insufficient_data'
  overloads_last_4_weeks: number
  stagnation: boolean
  overreaching: boolean
}

const PRIORITY: Record<WorkoutAlertCode, number> = {
  overreaching: 3,
  stagnation: 2,
  progression: 1,
}

export function computeWorkoutAlerts(rows: WorkoutAnalysisRow[]): WorkoutAlert[] {
  const byExercise = new Map<string, WorkoutAlert>()

  for (const row of rows) {
    const candidates: WorkoutAlert[] = []

    if (row.overreaching && (row.avg_rir ?? 99) <= 1 && row.completion_rate < 0.8) {
      candidates.push({
        code: 'overreaching',
        severity: 'critical',
        exercise_name: row.exercise_name,
        title: 'SURMENAGE',
        body: `${row.exercise_name} · réduis charge ou ajoute jour repos`,
      })
    }

    if (row.stagnation) {
      candidates.push({
        code: 'stagnation',
        severity: 'warning',
        exercise_name: row.exercise_name,
        title: 'STAGNATION',
        body: `${row.exercise_name} · essaie une alternative`,
      })
    }

    if (row.completion_rate > 0.95 && row.rir_trend === 'improving') {
      candidates.push({
        code: 'progression',
        severity: 'info',
        exercise_name: row.exercise_name,
        title: 'BONNE PROGRESSION',
        body: `${row.exercise_name} · prêt pour overload`,
      })
    }

    if (candidates.length === 0) continue
    candidates.sort((a, b) => PRIORITY[b.code] - PRIORITY[a.code])
    const top = candidates[0]
    const existing = byExercise.get(row.exercise_name)
    if (!existing || PRIORITY[top.code] > PRIORITY[existing.code]) {
      byExercise.set(row.exercise_name, top)
    }
  }

  return Array.from(byExercise.values()).sort(
    (a, b) => PRIORITY[b.code] - PRIORITY[a.code],
  )
}
```

- [ ] **Step 5: Run tests to verify PASS**

Run: `npx vitest run tests/lib/client/smart/workoutAlerts.test.ts`
Expected: 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add lib/client/smart/workoutAlerts.ts tests/lib/client/smart/workoutAlerts.test.ts
git commit -m "feat(smart): add workoutAlerts lib + tests (3 rules)"
```

---

## Task 6: Lib — timelineBuilder (pure fn + tests)

**Files:**
- Create: `lib/client/smart/timelineBuilder.ts`
- Test: `tests/lib/client/smart/timelineBuilder.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/lib/client/smart/timelineBuilder.test.ts
import { describe, it, expect } from 'vitest'
import { buildTimeline, type TimelineSource, type TimelineEntry } from '@/lib/client/smart/timelineBuilder'

describe('buildTimeline', () => {
  const ISO = (h: number, m = 0) => `2026-05-17T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`

  it('returns empty array when no data', () => {
    const r = buildTimeline({ meals: [], waterLogs: [], session: null, activities: [], checkins: [] })
    expect(r).toEqual([])
  })

  it('orders entries chronologically by start time', () => {
    const src: TimelineSource = {
      meals: [
        { id: 'm1', logged_at: ISO(13), title: 'Déjeuner', meal_type: 'lunch', kcal: 620, protein_g: 42, carbs_g: 58, fat_g: 18 },
        { id: 'm2', logged_at: ISO(7,30), title: 'Petit-déjeuner', meal_type: 'breakfast', kcal: 450, protein_g: 28, carbs_g: 50, fat_g: 12 },
      ],
      waterLogs: [],
      session: null,
      activities: [],
      checkins: [],
    }
    const r = buildTimeline(src)
    expect(r[0].id).toBe('m2')
    expect(r[1].id).toBe('m1')
  })

  it('aggregates water logs into time-of-day buckets', () => {
    const src: TimelineSource = {
      meals: [],
      waterLogs: [
        { logged_at: ISO(7), amount_ml: 250 },
        { logged_at: ISO(9), amount_ml: 500 },
      ],
      session: null,
      activities: [],
      checkins: [],
    }
    const r = buildTimeline(src, 'UTC')
    const water = r.filter(e => e.kind === 'water')
    expect(water.length).toBe(1) // morning bucket aggregated
    expect(water[0].title).toContain('matin')
    expect(water[0].subtitle).toContain('750')
  })

  it('includes session if present', () => {
    const src: TimelineSource = {
      meals: [],
      waterLogs: [],
      session: {
        id: 's1',
        completed_at: ISO(11),
        title: 'Push Force',
        duration_min: 58,
        exercises_count: 8,
      },
      activities: [],
      checkins: [],
    }
    const r = buildTimeline(src)
    expect(r.find(e => e.kind === 'workout')?.title).toBe('Push Force')
  })

  it('includes activity logs with custom_label when provided', () => {
    const src: TimelineSource = {
      meals: [],
      waterLogs: [],
      session: null,
      activities: [{
        id: 'a1', started_at: ISO(18), activity_type: 'other', custom_label: 'Tennis',
        duration_min: 60, intensity: 6,
      }],
      checkins: [],
    }
    const r = buildTimeline(src)
    expect(r[0].title).toBe('Tennis')
    expect(r[0].kind).toBe('activity')
  })
})
```

- [ ] **Step 2: Run test to verify FAIL**

Run: `npx vitest run tests/lib/client/smart/timelineBuilder.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement timelineBuilder.ts**

```ts
// lib/client/smart/timelineBuilder.ts
import { groupWaterByTimeOfDay, type WaterLog } from './waterAggregation'

export type TimelineKind = 'meal' | 'water' | 'workout' | 'activity' | 'checkin'

export type TimelineEntry = {
  id: string
  kind: TimelineKind
  start_iso: string
  title: string
  subtitle: string
  href?: string
  meta?: Record<string, unknown>
}

export type MealRow = {
  id: string
  logged_at: string
  title: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export type SessionSummary = {
  id: string
  completed_at: string
  title: string
  duration_min: number
  exercises_count: number
}

export type ActivityRow = {
  id: string
  started_at: string
  activity_type: 'running' | 'cycling' | 'swimming' | 'walking' | 'team_sport' | 'other'
  custom_label?: string | null
  duration_min: number
  intensity: number
}

export type CheckinRow = {
  id: string
  logged_at: string
  sleep_h?: number | null
  energy?: number | null
  stress?: number | null
}

export type TimelineSource = {
  meals: MealRow[]
  waterLogs: WaterLog[]
  session: SessionSummary | null
  activities: ActivityRow[]
  checkins: CheckinRow[]
}

const ACTIVITY_LABEL: Record<ActivityRow['activity_type'], string> = {
  running: 'Course',
  cycling: 'Vélo',
  swimming: 'Natation',
  walking: 'Marche',
  team_sport: 'Sport collectif',
  other: 'Activité',
}

const SLOT_REPRESENTATIVE_ISO: Record<'morning' | 'midday' | 'afternoon' | 'evening', string> = {
  morning: 'T08:00:00Z',
  midday: 'T13:00:00Z',
  afternoon: 'T16:00:00Z',
  evening: 'T20:00:00Z',
}

const SLOT_LABEL: Record<'morning' | 'midday' | 'afternoon' | 'evening', string> = {
  morning: 'Hydratation matin',
  midday: 'Hydratation midi',
  afternoon: 'Hydratation après-midi',
  evening: 'Hydratation soir',
}

export function buildTimeline(src: TimelineSource, tz: string = 'Europe/Paris'): TimelineEntry[] {
  const entries: TimelineEntry[] = []

  // Meals
  for (const m of src.meals) {
    entries.push({
      id: m.id,
      kind: 'meal',
      start_iso: m.logged_at,
      title: m.title,
      subtitle: `${m.kcal} kcal · ${m.protein_g}P ${m.carbs_g}G ${m.fat_g}L`,
      href: `/client/nutrition/journal#${m.id}`,
    })
  }

  // Water aggregated
  if (src.waterLogs.length > 0) {
    const grouped = groupWaterByTimeOfDay(src.waterLogs, tz)
    const dateRef = src.waterLogs[0].logged_at.slice(0, 10)
    for (const slot of ['morning','midday','afternoon','evening'] as const) {
      const ml = grouped[slot]
      if (ml > 0) {
        entries.push({
          id: `water-${slot}`,
          kind: 'water',
          start_iso: `${dateRef}${SLOT_REPRESENTATIVE_ISO[slot]}`,
          title: SLOT_LABEL[slot],
          subtitle: `${ml} ml`,
        })
      }
    }
  }

  // Session
  if (src.session) {
    entries.push({
      id: src.session.id,
      kind: 'workout',
      start_iso: src.session.completed_at,
      title: src.session.title,
      subtitle: `${src.session.exercises_count} exercices · ${src.session.duration_min} min`,
      href: `/client/programme/recap/${src.session.id}`,
    })
  }

  // Activities
  for (const a of src.activities) {
    entries.push({
      id: a.id,
      kind: 'activity',
      start_iso: a.started_at,
      title: a.custom_label?.trim() || ACTIVITY_LABEL[a.activity_type],
      subtitle: `${a.duration_min} min · intensité ${a.intensity}/10`,
    })
  }

  // Checkins
  for (const c of src.checkins) {
    const parts: string[] = []
    if (c.sleep_h != null) parts.push(`${c.sleep_h}h sommeil`)
    if (c.energy != null) parts.push(`énergie ${c.energy}/10`)
    if (c.stress != null) parts.push(`stress ${c.stress}/10`)
    entries.push({
      id: c.id,
      kind: 'checkin',
      start_iso: c.logged_at,
      title: 'Check-in',
      subtitle: parts.join(' · '),
    })
  }

  return entries.sort((a, b) => a.start_iso.localeCompare(b.start_iso))
}
```

- [ ] **Step 4: Run tests to verify PASS**

Run: `npx vitest run tests/lib/client/smart/timelineBuilder.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/client/smart/timelineBuilder.ts tests/lib/client/smart/timelineBuilder.test.ts
git commit -m "feat(smart): add timelineBuilder lib + tests"
```

---

## Task 7: i18n keys — smart.* namespace

**Files:**
- Modify: `lib/i18n/clientTranslations.ts`

- [ ] **Step 1: Inspect existing structure**

Run: `grep -n "smart\." lib/i18n/clientTranslations.ts || echo 'no smart keys yet'`
Expected: `no smart keys yet`

- [ ] **Step 2: Add smart.* keys to FR/EN/ES**

Modify `lib/i18n/clientTranslations.ts` — add to each language object (FR, EN, ES) the following keys (translated appropriately):

```ts
// FR examples (mirror in EN + ES)
'smart.agenda.title': 'Aujourd\'hui',
'smart.agenda.empty': 'Aucune activité enregistrée aujourd\'hui',
'smart.nutrition.label': 'Nutrition',
'smart.nutrition.kcal': 'kcal',
'smart.nutrition.protein': 'Protéines',
'smart.nutrition.carbs': 'Glucides',
'smart.nutrition.fat': 'Lipides',
'smart.nutrition.hydration': 'Hydratation',
'smart.nutrition.alert.proteinLow': 'PROTÉINES EN RETARD',
'smart.nutrition.alert.carbsLimit': 'LIMITE GLUCIDES ATTEINTE',
'smart.nutrition.alert.hydrationLow': 'HYDRATATION FAIBLE',
'smart.nutrition.alert.lunchMissing': 'PAS DE DÉJEUNER LOGUÉ',
'smart.workout.session': 'Séance du jour',
'smart.workout.rest': 'Jour de repos',
'smart.workout.start': 'Démarrer',
'smart.workout.alert.overreaching': 'SURMENAGE',
'smart.workout.alert.stagnation': 'STAGNATION',
'smart.workout.alert.progression': 'BONNE PROGRESSION',
'smart.workout.volumeCoverage': 'Volume hebdomadaire',
'smart.workout.noProgram': 'Pas de programme assigné',
'smart.timeline.label': 'Journée',
'smart.timeline.morning': 'Hydratation matin',
'smart.timeline.midday': 'Hydratation midi',
'smart.timeline.afternoon': 'Hydratation après-midi',
'smart.timeline.evening': 'Hydratation soir',
'smart.radial.meal': 'Repas',
'smart.radial.water': 'Eau',
'smart.radial.activity': 'Activité',
'smart.radial.checkin': 'Check-in',
'smart.activity.type.running': 'Course',
'smart.activity.type.cycling': 'Vélo',
'smart.activity.type.swimming': 'Natation',
'smart.activity.type.walking': 'Marche',
'smart.activity.type.team_sport': 'Sport collectif',
'smart.activity.type.other': 'Autre',
'smart.activity.save': 'Enregistrer',
'smart.activity.duration': 'Durée (min)',
'smart.activity.intensity': 'Intensité',
'smart.activity.notes': 'Notes',
'smart.notification.coach_note': 'Note de ton coach',
'smart.notification.bilan_pending': 'Bilan à compléter',
'smart.notification.program_assigned': 'Nouveau programme',
'smart.notification.system_reminder': 'Rappel',
'smart.topbar.agenda': 'Aujourd\'hui',
'smart.topbar.workout': 'Entraînement',
'smart.topbar.nutrition': 'Nutrition',
'smart.topbar.profil': 'Profil',
```

Update the `ClientDictKey` type union to include all new keys. Mirror translations in EN and ES sections.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'clientTranslations|ClientDictKey' || echo 'clean'`
Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add lib/i18n/clientTranslations.ts
git commit -m "feat(i18n): add smart.* namespace keys (FR/EN/ES)"
```

---

## Task 8: API — /api/client/activity-logs (GET + POST)

**Files:**
- Create: `app/api/client/activity-logs/route.ts`
- Create: `app/api/client/activity-logs/[id]/route.ts`

- [ ] **Step 1: Implement route.ts (GET + POST)**

```ts
// app/api/client/activity-logs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

const bodySchema = z.object({
  activity_type: z.enum(['running','cycling','swimming','walking','team_sport','other']),
  custom_label: z.string().max(80).optional(),
  started_at: z.string().datetime(),
  duration_min: z.number().int().min(1).max(360),
  intensity: z.number().int().min(1).max(10),
  notes: z.string().max(500).optional(),
})

async function getCtx(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  return client ? { service, clientId: client.id } : null
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const date = url.searchParams.get('date')
  let q = ctx.service
    .from('client_activity_logs')
    .select('id, activity_type, custom_label, started_at, duration_min, intensity, notes')
    .eq('client_id', ctx.clientId)
    .order('started_at', { ascending: false })
    .limit(50)
  if (date) {
    const from = `${date}T00:00:00Z`
    const to = `${date}T23:59:59Z`
    q = q.gte('started_at', from).lte('started_at', to)
  }
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data ?? [] })
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req)
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 })
  }
  const { data, error } = await ctx.service
    .from('client_activity_logs')
    .insert({ ...parsed.data, client_id: ctx.clientId })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}
```

- [ ] **Step 2: Implement [id]/route.ts (DELETE)**

```ts
// app/api/client/activity-logs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await service
    .from('client_activity_logs')
    .delete()
    .eq('id', params.id)
    .eq('client_id', client.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'activity-logs' || echo 'clean'`
Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add app/api/client/activity-logs/route.ts app/api/client/activity-logs/[id]/route.ts
git commit -m "feat(api): client activity-logs CRUD endpoints"
```

---

## Task 9: API — /api/client/notifications (GET + PATCH + DELETE)

**Files:**
- Create: `app/api/client/notifications/route.ts`
- Create: `app/api/client/notifications/[id]/route.ts`

- [ ] **Step 1: Implement route.ts**

```ts
// app/api/client/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

async function getCtx() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  return client ? { service, clientId: client.id } : null
}

export async function GET(req: NextRequest) {
  const ctx = await getCtx()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const unread = url.searchParams.get('unread') === 'true'

  let q = ctx.service
    .from('coach_client_notifications')
    .select('id, type, title, body, payload, read_at, created_at')
    .eq('client_id', ctx.clientId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(20)
  if (unread) q = q.is('read_at', null)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notifications: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  // mark all unread as read
  const ctx = await getCtx()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { error } = await ctx.service
    .from('coach_client_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('client_id', ctx.clientId)
    .is('read_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Implement [id]/route.ts**

```ts
// app/api/client/notifications/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

async function getCtx() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  return client ? { service, clientId: client.id } : null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  // dismiss
  const ctx = await getCtx()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { error } = await ctx.service
    .from('coach_client_notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('client_id', ctx.clientId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getCtx()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { error } = await ctx.service
    .from('coach_client_notifications')
    .delete()
    .eq('id', params.id)
    .eq('client_id', ctx.clientId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'notifications' || echo 'clean'`
Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add app/api/client/notifications/
git commit -m "feat(api): client notifications endpoints (list, read, dismiss, delete)"
```

---

## Task 10: API — /api/client/nutrition/today + weekly-trend + nutrition-alerts

**Files:**
- Create: `app/api/client/nutrition/today/route.ts`
- Create: `app/api/client/nutrition/weekly-trend/route.ts`
- Create: `app/api/client/nutrition-alerts/route.ts`

- [ ] **Step 1: Inspect existing today-progress for data shape**

Run: `cat app/api/client/nutrition/today-progress/route.ts | head -80`
Expected: see how meals + water aggregation already works.

- [ ] **Step 2: Implement today/route.ts (GET)**

```ts
// app/api/client/nutrition/today/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const client = await resolveClientFromUser(user.id, user.email, service, 'id, gender')
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const dateParam = url.searchParams.get('date')
  const date = dateParam ?? computePhysiologicalDate(new Date()).toISOString().slice(0, 10)

  const dayStart = `${date}T00:00:00Z`
  const dayEnd = `${date}T23:59:59Z`

  // Fetch shared protocol day target
  const { data: proto } = await service
    .from('nutrition_protocols')
    .select('id, nutrition_protocol_days(*)')
    .eq('client_id', client.id)
    .eq('status', 'shared')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const targetDay = proto?.nutrition_protocol_days?.[0]
  const target = {
    kcal: targetDay?.calories ?? 0,
    protein_g: targetDay?.protein_g ?? 0,
    carbs_g: targetDay?.carbs_g ?? 0,
    fat_g: targetDay?.fat_g ?? 0,
    water_ml: targetDay?.hydration_ml ?? 2500,
  }

  // Fetch meals + entries
  const { data: meals } = await service
    .from('nutrition_meals')
    .select('id, meal_type, title, logged_at, calories, protein_g, carbs_g, fat_g, physiological_date')
    .eq('client_id', client.id)
    .eq('physiological_date', date)
    .order('logged_at', { ascending: true })

  const consumed = (meals ?? []).reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.calories ?? 0),
      protein_g: acc.protein_g + (m.protein_g ?? 0),
      carbs_g: acc.carbs_g + (m.carbs_g ?? 0),
      fat_g: acc.fat_g + (m.fat_g ?? 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )

  // Fetch water
  const { data: water } = await service
    .from('client_water_logs')
    .select('amount_ml, logged_at')
    .eq('client_id', client.id)
    .gte('logged_at', dayStart)
    .lte('logged_at', dayEnd)

  const waterMl = (water ?? []).reduce((s, w) => s + (w.amount_ml ?? 0), 0)

  return NextResponse.json({
    date,
    target,
    consumed: { ...consumed, water_ml: waterMl },
    meals: meals ?? [],
    water_logs: water ?? [],
  })
}
```

- [ ] **Step 3: Implement weekly-trend/route.ts (GET)**

```ts
// app/api/client/nutrition/weekly-trend/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date()
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }

  // Active protocol target
  const { data: proto } = await service
    .from('nutrition_protocols')
    .select('nutrition_protocol_days(calories)')
    .eq('client_id', client.id)
    .eq('status', 'shared')
    .limit(1)
    .maybeSingle()

  const target = proto?.nutrition_protocol_days?.[0]?.calories ?? 2400

  // Aggregate meals per day
  const { data: meals } = await service
    .from('nutrition_meals')
    .select('physiological_date, calories')
    .eq('client_id', client.id)
    .in('physiological_date', days)

  const totals: Record<string, number> = {}
  for (const d of days) totals[d] = 0
  for (const m of meals ?? []) {
    totals[m.physiological_date] = (totals[m.physiological_date] ?? 0) + (m.calories ?? 0)
  }

  const trend = days.map(d => ({ date: d, consumed: totals[d], target }))
  return NextResponse.json({ trend })
}
```

- [ ] **Step 4: Implement nutrition-alerts/route.ts**

```ts
// app/api/client/nutrition-alerts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { computeNutritionAlerts } from '@/lib/client/smart/nutritionAlerts'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = computePhysiologicalDate(new Date()).toISOString().slice(0, 10)

  // Fetch active target
  const { data: proto } = await service
    .from('nutrition_protocols')
    .select('nutrition_protocol_days(*)')
    .eq('client_id', client.id)
    .eq('status', 'shared')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const td = proto?.nutrition_protocol_days?.[0]
  const target = {
    kcal: td?.calories ?? 0,
    protein_g: td?.protein_g ?? 0,
    carbs_g: td?.carbs_g ?? 0,
    fat_g: td?.fat_g ?? 0,
    water_ml: td?.hydration_ml ?? 2500,
  }

  // Fetch today's meals + water
  const { data: meals } = await service
    .from('nutrition_meals')
    .select('meal_type, calories, protein_g, carbs_g, fat_g')
    .eq('client_id', client.id)
    .eq('physiological_date', date)
  const consumed = (meals ?? []).reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.calories ?? 0),
      protein_g: acc.protein_g + (m.protein_g ?? 0),
      carbs_g: acc.carbs_g + (m.carbs_g ?? 0),
      fat_g: acc.fat_g + (m.fat_g ?? 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )

  const dayStart = `${date}T00:00:00Z`
  const dayEnd = `${date}T23:59:59Z`
  const { data: water } = await service
    .from('client_water_logs')
    .select('amount_ml')
    .eq('client_id', client.id)
    .gte('logged_at', dayStart)
    .lte('logged_at', dayEnd)
  const water_ml = (water ?? []).reduce((s, w) => s + (w.amount_ml ?? 0), 0)

  const hasLunchLog = (meals ?? []).some(m => m.meal_type === 'lunch')
  const currentHour = new Date().getHours()

  const alerts = computeNutritionAlerts({
    consumed: { ...consumed, water_ml },
    target,
    currentHour,
    hasLunchLog,
  })

  return NextResponse.json({ alerts })
}
```

- [ ] **Step 5: Verify nutrition_protocol_days has columns referenced**

Run: `grep -E 'protein_g|carbs_g|fat_g|hydration_ml' supabase/migrations/20260425_nutrition_protocols.sql`
Expected: see column definitions matching. If column name differs (e.g., `protein`, `carbs`), update the queries above.

- [ ] **Step 6: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'nutrition/today|weekly-trend|nutrition-alerts' || echo 'clean'`
Expected: `clean`

- [ ] **Step 7: Commit**

```bash
git add app/api/client/nutrition/today/ app/api/client/nutrition/weekly-trend/ app/api/client/nutrition-alerts/
git commit -m "feat(api): smart nutrition today/weekly/alerts endpoints"
```

---

## Task 11: API — /api/client/workout-alerts + volume-coverage + recent-sessions

**Files:**
- Create: `app/api/client/workout-alerts/route.ts`
- Create: `app/api/client/volume-coverage/route.ts`
- Create: `app/api/client/recent-sessions/route.ts`

- [ ] **Step 1: Implement workout-alerts/route.ts**

```ts
// app/api/client/workout-alerts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { analyzeExercisePerformance } from '@/lib/performance/analyzer'
import { computeWorkoutAlerts, type WorkoutAnalysisRow } from '@/lib/client/smart/workoutAlerts'

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch last 8 weeks of sessions + sets + overload events
  const eightWeeksAgo = new Date()
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

  const { data: sessions } = await service
    .from('client_session_logs')
    .select('id, completed_at, client_set_logs(exercise_name, reps_planned, reps_actual, rir_target, rir_actual, weight_kg, set_number, completed_at)')
    .eq('client_id', client.id)
    .not('completed_at', 'is', null)
    .gte('completed_at', eightWeeksAgo.toISOString())

  const { data: overloads } = await service
    .from('progression_events')
    .select('exercise_name, created_at')
    .eq('client_id', client.id)
    .gte('created_at', eightWeeksAgo.toISOString())

  const analysis = analyzeExercisePerformance(sessions ?? [], overloads ?? [], 8)
  const rows: WorkoutAnalysisRow[] = analysis.exercises.map(e => ({
    exercise_name: e.exercise_name,
    completion_rate: e.completion_rate,
    avg_rir: e.avg_rir,
    rir_trend: e.rir_trend,
    overloads_last_4_weeks: e.overloads_last_4_weeks,
    stagnation: e.stagnation,
    overreaching: e.overreaching,
  }))

  const alerts = computeWorkoutAlerts(rows)
  return NextResponse.json({ alerts })
}
```

- [ ] **Step 2: Inspect performance/analyzer return shape**

Run: `cat lib/performance/analyzer.ts | grep -A 20 "export function analyzeExercisePerformance"`
Expected: see return type matching what's used in Step 1. If shape differs (e.g., returns flat array not `{ exercises }`), adapt the mapping.

- [ ] **Step 3: Implement volume-coverage/route.ts**

```ts
// app/api/client/volume-coverage/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { getVolumeTargets, VOLUME_GROUP_LABELS, MUSCLE_TO_VOLUME_GROUP } from '@/lib/programs/intelligence/volume-targets'

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ISO week boundaries
  const now = new Date()
  const dow = now.getDay() === 0 ? 7 : now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dow - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const { data: sessions } = await service
    .from('client_session_logs')
    .select('id, client_set_logs(exercise_name, set_number, completed_at)')
    .eq('client_id', client.id)
    .not('completed_at', 'is', null)
    .gte('completed_at', monday.toISOString())
    .lte('completed_at', sunday.toISOString())

  // Get exercise → muscles map (catalog) for each exercise_name in sets
  const setRows = (sessions ?? []).flatMap(s => s.client_set_logs ?? [])
  const exerciseNames = Array.from(new Set(setRows.map(s => s.exercise_name)))
  const { data: catalogRows } = await service
    .from('exercises_catalog')
    .select('name, primary_muscles, secondary_muscles, primary_activation, secondary_activations')
    .in('name', exerciseNames)
  const byName = new Map(catalogRows?.map(r => [r.name, r]) ?? [])

  // Accumulate weighted volume by volume_group
  const volumeByGroup: Record<string, number> = {}
  for (const set of setRows) {
    const ex = byName.get(set.exercise_name)
    if (!ex) continue
    const primary = (ex.primary_muscles ?? []) as string[]
    const primaryAct = (ex.primary_activation ?? 1) as number
    const secondary = (ex.secondary_muscles ?? []) as string[]
    const secondaryAct = (ex.secondary_activations ?? []) as number[]
    for (const m of primary) {
      const g = MUSCLE_TO_VOLUME_GROUP[m]
      if (!g) continue
      volumeByGroup[g] = (volumeByGroup[g] ?? 0) + primaryAct
    }
    secondary.forEach((m, i) => {
      const g = MUSCLE_TO_VOLUME_GROUP[m]
      if (!g) return
      volumeByGroup[g] = (volumeByGroup[g] ?? 0) + (secondaryAct[i] ?? 0.5)
    })
  }

  // Build response with targets per group
  const groups = Object.keys(VOLUME_GROUP_LABELS).map(g => {
    const [mev, mav, mrv] = getVolumeTargets(g, 'hypertrophy', 'intermediate')
    return {
      group: g,
      label: VOLUME_GROUP_LABELS[g],
      actual: Math.round((volumeByGroup[g] ?? 0) * 10) / 10,
      mev,
      mav,
      mrv,
    }
  })

  const sessionsCount = (sessions ?? []).length

  return NextResponse.json({
    week_start: monday.toISOString().slice(0, 10),
    sessions_count: sessionsCount,
    groups,
  })
}
```

- [ ] **Step 4: Implement recent-sessions/route.ts**

```ts
// app/api/client/recent-sessions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

export async function GET(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sessions } = await service
    .from('client_session_logs')
    .select('id, completed_at, program_session_id, client_set_logs(weight_kg, reps_actual, rir_actual)')
    .eq('client_id', client.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(3)

  const items = (sessions ?? []).map(s => {
    const sets = s.client_set_logs ?? []
    const volumeKg = sets.reduce(
      (sum, st) => sum + (st.weight_kg ?? 0) * (st.reps_actual ?? 0),
      0,
    )
    const rirVals = sets.map(st => st.rir_actual).filter((v): v is number => v != null)
    const avgRir = rirVals.length > 0 ? rirVals.reduce((a, b) => a + b, 0) / rirVals.length : null
    return {
      id: s.id,
      completed_at: s.completed_at,
      program_session_id: s.program_session_id,
      volume_kg: Math.round(volumeKg),
      avg_rir: avgRir != null ? Math.round(avgRir * 10) / 10 : null,
    }
  })

  return NextResponse.json({ sessions: items })
}
```

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'workout-alerts|volume-coverage|recent-sessions' || echo 'clean'`
Expected: `clean`

- [ ] **Step 6: Commit**

```bash
git add app/api/client/workout-alerts/ app/api/client/volume-coverage/ app/api/client/recent-sessions/
git commit -m "feat(api): smart workout alerts + volume coverage + recent sessions"
```

---

## Task 12: API — /api/client/timeline/today

**Files:**
- Create: `app/api/client/timeline/today/route.ts`

- [ ] **Step 1: Implement route.ts**

```ts
// app/api/client/timeline/today/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { buildTimeline, type TimelineSource } from '@/lib/client/smart/timelineBuilder'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const dateParam = url.searchParams.get('date')
  const date = dateParam ?? computePhysiologicalDate(new Date()).toISOString().slice(0, 10)
  const dayStart = `${date}T00:00:00Z`
  const dayEnd = `${date}T23:59:59Z`

  // Meals
  const { data: meals } = await service
    .from('nutrition_meals')
    .select('id, meal_type, title, logged_at, calories, protein_g, carbs_g, fat_g')
    .eq('client_id', client.id)
    .eq('physiological_date', date)
    .order('logged_at', { ascending: true })

  // Water
  const { data: water } = await service
    .from('client_water_logs')
    .select('logged_at, amount_ml')
    .eq('client_id', client.id)
    .gte('logged_at', dayStart)
    .lte('logged_at', dayEnd)

  // Session of the day (latest completed today)
  const { data: sessionRow } = await service
    .from('client_session_logs')
    .select('id, completed_at, program_session_id, program_sessions(name)')
    .eq('client_id', client.id)
    .not('completed_at', 'is', null)
    .gte('completed_at', dayStart)
    .lte('completed_at', dayEnd)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let session = null as TimelineSource['session']
  if (sessionRow) {
    const { count } = await service
      .from('client_set_logs')
      .select('exercise_name', { count: 'exact', head: true })
      .eq('session_log_id', sessionRow.id)
    session = {
      id: sessionRow.id,
      completed_at: sessionRow.completed_at as string,
      title: (sessionRow.program_sessions as any)?.name ?? 'Séance',
      duration_min: 0,
      exercises_count: count ?? 0,
    }
  }

  // Activities
  const { data: activities } = await service
    .from('client_activity_logs')
    .select('id, started_at, activity_type, custom_label, duration_min, intensity')
    .eq('client_id', client.id)
    .gte('started_at', dayStart)
    .lte('started_at', dayEnd)

  // Checkins (lifestyle)
  const { data: checkins } = await service
    .from('client_lifestyle_logs')
    .select('id, logged_at, sleep_h, energy, stress')
    .eq('client_id', client.id)
    .gte('logged_at', dayStart)
    .lte('logged_at', dayEnd)

  const src: TimelineSource = {
    meals: (meals ?? []).map(m => ({
      id: m.id,
      logged_at: m.logged_at,
      title: m.title ?? mealTypeLabel(m.meal_type),
      meal_type: m.meal_type,
      kcal: m.calories ?? 0,
      protein_g: m.protein_g ?? 0,
      carbs_g: m.carbs_g ?? 0,
      fat_g: m.fat_g ?? 0,
    })),
    waterLogs: water ?? [],
    session,
    activities: (activities ?? []) as TimelineSource['activities'],
    checkins: (checkins ?? []) as TimelineSource['checkins'],
  }

  const entries = buildTimeline(src)
  return NextResponse.json({ date, entries })
}

function mealTypeLabel(t: string): string {
  switch (t) {
    case 'breakfast': return 'Petit-déjeuner'
    case 'lunch': return 'Déjeuner'
    case 'dinner': return 'Dîner'
    case 'snack': return 'Collation'
    default: return 'Repas'
  }
}
```

- [ ] **Step 2: Verify client_lifestyle_logs exists**

Run: `grep -r "client_lifestyle_logs" supabase/migrations/ | head -3`
Expected: see table definition. If table doesn't exist, replace the checkin fetch with `const checkins: any[] = []` (no-op) — checkins are out of scope Phase 1 if table missing.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'timeline/today' || echo 'clean'`
Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add app/api/client/timeline/today/
git commit -m "feat(api): smart timeline aggregator endpoint"
```

---

## Task 13: Component — RadialActionMenu

**Files:**
- Create: `components/client/smart/RadialActionMenu.tsx`

- [ ] **Step 1: Implement RadialActionMenu.tsx**

```tsx
// components/client/smart/RadialActionMenu.tsx
'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ForkKnife, Drop, PersonSimpleRun, Moon } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useClientT } from '../ClientI18nProvider'

type Action = {
  id: 'meal' | 'water' | 'activity' | 'checkin'
  Icon: React.ElementType
  angleDeg: number
}

const ACTIONS: Action[] = [
  { id: 'meal',     Icon: ForkKnife,        angleDeg: -135 },
  { id: 'water',    Icon: Drop,             angleDeg: -100 },
  { id: 'activity', Icon: PersonSimpleRun,  angleDeg:  -80 },
  { id: 'checkin',  Icon: Moon,             angleDeg:  -45 },
]

export type RadialActionMenuProps = {
  open: boolean
  onClose: () => void
  onOpenWater: () => void
  onOpenActivity: () => void
}

const RADIUS = 110

export default function RadialActionMenu({ open, onClose, onOpenWater, onOpenActivity }: RadialActionMenuProps) {
  const router = useRouter()
  const { t } = useClientT()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleAction = (id: Action['id']) => {
    onClose()
    switch (id) {
      case 'meal':     router.push('/client/nutrition/log'); break
      case 'water':    onOpenWater(); break
      case 'activity': onOpenActivity(); break
      case 'checkin':  router.push('/client/checkin/onboarding'); break
    }
  }

  const labelKey = (id: Action['id']) =>
    ({ meal: 'smart.radial.meal', water: 'smart.radial.water', activity: 'smart.radial.activity', checkin: 'smart.radial.checkin' } as const)[id]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 90px)' }}>
            {ACTIONS.map((a, i) => {
              const rad = (a.angleDeg * Math.PI) / 180
              const x = Math.cos(rad) * RADIUS
              const y = Math.sin(rad) * RADIUS
              return (
                <motion.button
                  key={a.id}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
                  animate={{ opacity: 1, x, y, scale: 1, transition: { delay: i * 0.04, type: 'spring', stiffness: 380, damping: 28 } }}
                  exit={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
                  onClick={(e) => { e.stopPropagation(); handleAction(a.id) }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-[#161616] border border-white/[0.08] flex items-center justify-center active:scale-95 transition-transform">
                    <a.Icon size={28} weight="regular" className="text-white" />
                  </div>
                  <span className="mt-1.5 font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[10px] text-white/80">
                    {t(labelKey(a.id) as any)}
                  </span>
                </motion.button>
              )
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'RadialActionMenu' || echo 'clean'`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/RadialActionMenu.tsx
git commit -m "feat(smart): RadialActionMenu component (4 arc actions)"
```

---

## Task 14: Component — FreeActivitySheet

**Files:**
- Create: `components/client/smart/FreeActivitySheet.tsx`

- [ ] **Step 1: Implement FreeActivitySheet.tsx**

```tsx
// components/client/smart/FreeActivitySheet.tsx
'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useClientT } from '../ClientI18nProvider'

type ActivityType = 'running' | 'cycling' | 'swimming' | 'walking' | 'team_sport' | 'other'

export type FreeActivitySheetProps = {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

const TYPES: ActivityType[] = ['running', 'cycling', 'swimming', 'walking', 'team_sport', 'other']

export default function FreeActivitySheet({ open, onClose, onSaved }: FreeActivitySheetProps) {
  const { t } = useClientT()
  const [type, setType] = useState<ActivityType>('running')
  const [customLabel, setCustomLabel] = useState('')
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [duration, setDuration] = useState(30)
  const [intensity, setIntensity] = useState(5)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setSaving(true)
    try {
      const body: any = {
        activity_type: type,
        started_at: new Date(startedAt).toISOString(),
        duration_min: duration,
        intensity,
      }
      if (type === 'other' && customLabel.trim()) body.custom_label = customLabel.trim()
      if (notes.trim()) body.notes = notes.trim()
      const r = await fetch('/api/client/activity-logs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j.error ?? 'Erreur')
      }
      onSaved?.()
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const pct = ((intensity - 1) / 9) * 100

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          />
          <motion.div
            className="fixed left-0 right-0 bottom-0 z-50 rounded-t-2xl bg-[#161616] border-t-[0.3px] border-white/[0.08] flex flex-col"
            style={{ maxHeight: '88vh' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
          >
            <div className="px-4 pt-4 pb-3 shrink-0 flex items-center justify-between">
              <h3 className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[13px] text-white">
                Logger une activité
              </h3>
              <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center">
                <X size={18} className="text-white/60" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-4">
              {/* Type */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.map(tt => (
                    <button
                      key={tt}
                      onClick={() => setType(tt)}
                      className={`h-10 rounded-xl text-[11px] font-semibold transition-colors ${
                        type === tt ? 'bg-[#ffe01e] text-[#0d0d0d]' : 'bg-white/[0.04] text-white/60'
                      }`}
                    >
                      {t(`smart.activity.type.${tt}` as any)}
                    </button>
                  ))}
                </div>
              </div>

              {type === 'other' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">Précise</label>
                  <input value={customLabel} onChange={e => setCustomLabel(e.target.value)} maxLength={80}
                    className="w-full min-w-0 h-11 px-3 rounded-xl bg-[#0d0d0d] text-white text-[14px] outline-none" placeholder="Ex: Tennis" />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">Quand</label>
                <input type="datetime-local" value={startedAt} onChange={e => setStartedAt(e.target.value)}
                  className="w-full min-w-0 h-11 px-3 rounded-xl bg-[#0d0d0d] text-white text-[14px] outline-none" />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">Durée (min)</label>
                <input type="number" min={1} max={360} value={duration} onChange={e => setDuration(parseInt(e.target.value) || 1)}
                  className="w-full min-w-0 h-11 px-3 rounded-xl bg-[#0d0d0d] text-white text-[14px] outline-none" />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">Intensité {intensity}/10</label>
                <input type="range" min={1} max={10} step={1} value={intensity} onChange={e => setIntensity(parseInt(e.target.value))}
                  className="w-full h-2 appearance-none rounded-full cursor-pointer"
                  style={{ background: `linear-gradient(to right, #ffe01e 0%, #ffe01e ${pct}%, rgba(255,255,255,0.1) ${pct}%, rgba(255,255,255,0.1) 100%)` }} />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 mb-2">Notes (optionnel)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={500}
                  className="w-full min-w-0 px-3 py-2 rounded-xl bg-[#0d0d0d] text-white text-[14px] outline-none resize-none" />
              </div>

              {error && <p className="text-[12px] text-red-400">{error}</p>}

              <button disabled={saving} onClick={submit}
                className="w-full h-12 rounded-xl bg-[#ffe01e] text-[#0d0d0d] font-bold uppercase tracking-[0.1em] text-[12px] disabled:opacity-50 active:scale-[0.98]">
                {saving ? '...' : 'Enregistrer'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'FreeActivitySheet' || echo 'clean'`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add components/client/smart/FreeActivitySheet.tsx
git commit -m "feat(smart): FreeActivitySheet bottom sheet (DS v3.0)"
```

---

## Task 15: Modify BottomNav — 5 slots + central STRYVR logo

**Files:**
- Modify: `components/client/BottomNav.tsx`

- [ ] **Step 1: Inspect current state**

Run: `cat components/client/BottomNav.tsx | head -30`
Expected: see imports + NAV array.

- [ ] **Step 2: Replace BottomNav.tsx fully**

```tsx
// components/client/BottomNav.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { House, Barbell, ForkKnife, UserCircle } from '@phosphor-icons/react'
import { useClientT } from './ClientI18nProvider'
import { useTour } from './TourContext'
import RadialActionMenu from './smart/RadialActionMenu'
import QuickWaterModal from './QuickWaterModal'
import FreeActivitySheet from './smart/FreeActivitySheet'
import type { ClientDictKey } from '@/lib/i18n/clientTranslations'

const NAV: { href: string; labelKey: ClientDictKey; Icon: React.ElementType }[] = [
  { href: '/client',           labelKey: 'nav.home',      Icon: House },
  { href: '/client/programme', labelKey: 'nav.programme', Icon: Barbell },
  { href: '/client/nutrition', labelKey: 'nav.nutrition', Icon: ForkKnife },
  { href: '/client/profil',    labelKey: 'nav.profil',    Icon: UserCircle },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { t } = useClientT()
  const { highlightedNavIndex } = useTour()
  const [radialOpen, setRadialOpen] = useState(false)
  const [waterOpen, setWaterOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)

  return (
    <>
      <RadialActionMenu
        open={radialOpen}
        onClose={() => setRadialOpen(false)}
        onOpenWater={() => setWaterOpen(true)}
        onOpenActivity={() => setActivityOpen(true)}
      />
      <QuickWaterModal open={waterOpen} onClose={() => setWaterOpen(false)} />
      <FreeActivitySheet open={activityOpen} onClose={() => setActivityOpen(false)} />

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-auto w-full max-w-[480px] px-4">
          <div className="flex items-center rounded-xl border border-white/[0.08] bg-[#0d0d0d] backdrop-blur-md shadow-[0_-12px_40px_rgba(0,0,0,0.7)] px-2 h-[62px]">
            {NAV.slice(0, 2).map(({ href, labelKey, Icon }, idx) => {
              const routeActive = href === '/client' ? pathname === '/client' : pathname.startsWith(href)
              const active = routeActive || highlightedNavIndex === idx
              return (
                <Link key={href} href={href}
                  className={`relative flex flex-col items-center justify-center gap-[4px] flex-1 h-full transition-all duration-200 active:scale-[0.92] ${
                    active ? 'text-[#ffe01e]' : 'text-white/35 hover:text-white/60'
                  }`}>
                  {active && <span className="absolute inset-x-1 inset-y-2 rounded-xl bg-[#ffe01e]/[0.10]" />}
                  <Icon size={24} weight={active ? 'fill' : 'regular'} className="relative z-10" />
                  <span className={`relative z-10 text-[10px] font-semibold leading-none tracking-wide transition-colors duration-200 ${
                    active ? 'text-[#ffe01e]' : 'text-white/30'
                  }`}>{t(labelKey)}</span>
                </Link>
              )
            })}

            <div className="flex items-center justify-center px-2">
              <button
                onClick={() => setRadialOpen(v => !v)}
                aria-label="Logger"
                className="h-10 w-10 rounded-xl bg-[#ffe01e] flex items-center justify-center text-[#0d0d0d] shadow-[0_0_16px_rgba(255,224,30,0.25)] hover:bg-[#ffd000] active:scale-[0.95] transition-all"
              >
                <Image src="/logo-stryvr.svg" alt="STRYVR" width={20} height={20} priority />
              </button>
            </div>

            {NAV.slice(2).map(({ href, labelKey, Icon }, idx) => {
              const realIdx = idx + 2
              const routeActive = pathname.startsWith(href)
              const active = routeActive || highlightedNavIndex === realIdx
              return (
                <Link key={href} href={href}
                  className={`relative flex flex-col items-center justify-center gap-[4px] flex-1 h-full transition-all duration-200 active:scale-[0.92] ${
                    active ? 'text-[#ffe01e]' : 'text-white/35 hover:text-white/60'
                  }`}>
                  {active && <span className="absolute inset-x-1 inset-y-2 rounded-xl bg-[#ffe01e]/[0.10]" />}
                  <Icon size={24} weight={active ? 'fill' : 'regular'} className="relative z-10" />
                  <span className={`relative z-10 text-[10px] font-semibold leading-none tracking-wide transition-colors duration-200 ${
                    active ? 'text-[#ffe01e]' : 'text-white/30'
                  }`}>{t(labelKey)}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </>
  )
}
```

- [ ] **Step 3: Ensure logo asset exists**

Run: `ls public/logo-stryvr.svg 2>&1`
Expected: file exists. If missing, place a monochrome STRYVR SVG logo at `public/logo-stryvr.svg` (consult brand assets). Fallback : keep `<Plus />` import + use Plus icon if logo unavailable, note in CHANGELOG.

- [ ] **Step 4: Delete BottomNavPlusMenu.tsx**

```bash
git rm components/client/BottomNavPlusMenu.tsx
```

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'BottomNav' || echo 'clean'`
Expected: `clean`

- [ ] **Step 6: Commit**

```bash
git add components/client/BottomNav.tsx
git commit -m "feat(client): BottomNav with central STRYVR logo + radial menu"
```

---

## Task 16: Component — NotificationsBar

**Files:**
- Create: `components/client/smart/NotificationsBar.tsx`

- [ ] **Step 1: Implement NotificationsBar.tsx**

```tsx
// components/client/smart/NotificationsBar.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, X, ClipboardList, Sparkles, MessageSquare, Clock } from 'lucide-react'

export type Notification = {
  id: string
  type: 'coach_note' | 'bilan_pending' | 'program_assigned' | 'system_reminder'
  title: string
  body: string | null
  payload: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}

const TYPE_ICON: Record<Notification['type'], React.ElementType> = {
  coach_note: MessageSquare,
  bilan_pending: ClipboardList,
  program_assigned: Sparkles,
  system_reminder: Clock,
}

export default function NotificationsBar({ initial }: { initial: Notification[] }) {
  const [items, setItems] = useState(initial)
  const router = useRouter()

  if (items.length === 0) return null

  const dismiss = async (id: string) => {
    setItems(prev => prev.filter(n => n.id !== id))
    await fetch(`/api/client/notifications/${id}`, { method: 'PATCH' })
  }

  const handleClick = (n: Notification) => {
    if (n.type === 'bilan_pending' && n.payload?.assessment_submission_id) {
      router.push(`/client/bilans/${n.payload.assessment_submission_id}`)
    } else if (n.type === 'program_assigned') {
      router.push('/client/programme')
    } else {
      // coach_note / system_reminder : no nav, just mark read
      fetch(`/api/client/notifications`, { method: 'PATCH' })
    }
  }

  return (
    <div className="space-y-2">
      {items.map(n => {
        const Icon = TYPE_ICON[n.type]
        return (
          <div key={n.id}
            className="flex items-start gap-3 bg-[#161616] rounded-2xl border border-white/[0.08] p-3 active:scale-[0.99] transition-transform"
            onClick={() => handleClick(n)}>
            <div className="w-9 h-9 rounded-lg bg-[#ffe01e]/10 flex items-center justify-center shrink-0">
              <Icon size={18} className="text-[#ffe01e]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-white">{n.title}</p>
              {n.body && <p className="text-[11px] text-white/50 mt-1 leading-relaxed">{n.body}</p>}
            </div>
            <button onClick={(e) => { e.stopPropagation(); dismiss(n.id) }}
              className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
              <X size={14} className="text-white/40" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/client/smart/NotificationsBar.tsx
git commit -m "feat(smart): NotificationsBar component"
```

---

## Task 17: Component — SmartNutritionWidget

**Files:**
- Create: `components/client/smart/SmartNutritionWidget.tsx`

- [ ] **Step 1: Implement SmartNutritionWidget.tsx**

```tsx
// components/client/smart/SmartNutritionWidget.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import QuickWaterModal from '../QuickWaterModal'

export type NutritionMacros = {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  water_ml: number
}

export type SmartNutritionWidgetProps = {
  consumed: NutritionMacros
  target: NutritionMacros
}

const MACROS = [
  { key: 'protein_g',  label: 'Protéines', color: '#4a90e2' },
  { key: 'carbs_g',    label: 'Glucides',  color: '#22c55e' },
  { key: 'fat_g',      label: 'Lipides',   color: '#f59e0b' },
] as const

export default function SmartNutritionWidget({ consumed, target }: SmartNutritionWidgetProps) {
  const [waterOpen, setWaterOpen] = useState(false)
  const kcalPct = target.kcal > 0 ? Math.min(1, consumed.kcal / target.kcal) : 0

  // semicircle path : 20,100 → 180,100 ; arc total length is half-circle (radius 80 ≈ length 251)
  const total = 251.2
  const offset = total * (1 - kcalPct)

  return (
    <>
      <QuickWaterModal open={waterOpen} onClose={() => setWaterOpen(false)} />
      <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-[18px]">
        <div className="flex items-baseline justify-between mb-2">
          <span className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white">Nutrition</span>
          <Link href="/client/nutrition/log" className="text-[10px] font-semibold text-[#ffe01e]">+ Repas</Link>
        </div>

        <div className="relative h-[120px]">
          <svg viewBox="0 0 200 110" className="w-full h-full">
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round"/>
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#ffe01e" strokeWidth="12" strokeLinecap="round"
              strokeDasharray={total} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.6s ease' }}/>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
            <div className="text-[24px] font-black leading-none text-white tabular-nums">{Math.round(consumed.kcal)}</div>
            <div className="text-[10px] text-white/40 mt-1 tabular-nums">/ {target.kcal} kcal</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          {MACROS.map(m => {
            const c = (consumed[m.key] as number) ?? 0
            const tg = (target[m.key] as number) ?? 0
            const pct = tg > 0 ? Math.min(100, (c / tg) * 100) : 0
            return (
              <div key={m.key}>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-white/55 uppercase tracking-[0.1em] font-bold">{m.label}</span>
                  <span className="text-white font-bold tabular-nums">{Math.round(c)}/{tg}g</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full" style={{ width: `${pct}%`, background: m.color, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
          <div className="flex-1">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-white/55 uppercase tracking-[0.1em] font-bold">Hydratation</span>
              <span className="text-white font-bold tabular-nums">{(consumed.water_ml / 1000).toFixed(1)} / {(target.water_ml / 1000).toFixed(1)} L</span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400" style={{ width: `${target.water_ml > 0 ? Math.min(100, (consumed.water_ml / target.water_ml) * 100) : 0}%`, transition: 'width 0.4s ease' }} />
            </div>
          </div>
          <button onClick={() => setWaterOpen(true)}
            className="w-8 h-8 rounded-xl bg-[#ffe01e] flex items-center justify-center text-[#0d0d0d] active:scale-95 transition-transform">
            <Plus size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/client/smart/SmartNutritionWidget.tsx
git commit -m "feat(smart): SmartNutritionWidget (demi-cercle + macros + hydra)"
```

---

## Task 18: Component — SmartWorkoutWidget

**Files:**
- Create: `components/client/smart/SmartWorkoutWidget.tsx`

- [ ] **Step 1: Implement SmartWorkoutWidget.tsx**

```tsx
// components/client/smart/SmartWorkoutWidget.tsx
'use client'

import Link from 'next/link'
import { ChevronRight, Dumbbell } from 'lucide-react'
import BodyMap from '../BodyMap'
import type { MuscleGroup } from '@/lib/client/muscleDetection'

export type SmartWorkoutWidgetProps = {
  state: 'scheduled' | 'rest' | 'no_program'
  session?: {
    id: string
    sessionLogHref: string
    name: string
    exerciseCount: number
    estimatedMinutes: number
    primaryMuscles: MuscleGroup[]
    secondaryMuscles: MuscleGroup[]
    musclePills: string[]
  }
}

export default function SmartWorkoutWidget({ state, session }: SmartWorkoutWidgetProps) {
  if (state === 'rest') {
    return (
      <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-[18px]">
        <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white mb-3">Séance du jour</div>
        <p className="text-[12px] text-white/55">Jour de repos — pas de séance prévue.</p>
        <Link href="/client" className="inline-block mt-2 text-[10px] text-[#ffe01e] uppercase tracking-[0.1em] font-bold">+ Logger activité libre →</Link>
      </div>
    )
  }
  if (state === 'no_program' || !session) {
    return (
      <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-[18px]">
        <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white mb-3">Séance du jour</div>
        <p className="text-[12px] text-white/55">Pas de programme assigné.</p>
        <p className="text-[10px] text-white/40 mt-1">Contacte ton coach pour démarrer.</p>
      </div>
    )
  }

  return (
    <Link href="/client/programme" className="block bg-[#161616] rounded-2xl border border-white/[0.08] p-[18px] active:scale-[0.99] transition-transform">
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white">Séance du jour</span>
        <ChevronRight size={14} className="text-white/40" />
      </div>

      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[18px] font-black tracking-[-0.02em] text-white">{session.name}</div>
          <div className="text-[11px] text-white/50 mt-1">{session.exerciseCount} exercices · ~{session.estimatedMinutes} min</div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {session.musclePills.map(p => (
              <span key={p} className="bg-[#ffe01e]/10 text-[#ffe01e] text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-1 rounded-md">{p}</span>
            ))}
          </div>
          <Link href={session.sessionLogHref}
            className="mt-3 inline-flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-[#ffe01e] text-[#0d0d0d] text-[11px] font-black uppercase tracking-[0.1em] active:scale-[0.98]"
            onClick={(e) => e.stopPropagation()}>
            <Dumbbell size={14} strokeWidth={2.5} /> Démarrer →
          </Link>
        </div>
        <div className="w-20 shrink-0 flex items-center justify-center">
          <BodyMap primaryGroups={new Set(session.primaryMuscles)} secondaryGroups={new Set(session.secondaryMuscles)} compact />
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Verify BodyMap accepts `compact` prop**

Run: `grep -n "compact" components/client/BodyMap.tsx`
Expected: see compact prop OR add it. If missing, add prop `compact?: boolean` that renders at smaller size with no labels (modify BodyMap.tsx accordingly).

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'SmartWorkoutWidget|BodyMap' || echo 'clean'`
Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add components/client/smart/SmartWorkoutWidget.tsx components/client/BodyMap.tsx
git commit -m "feat(smart): SmartWorkoutWidget + BodyMap compact prop"
```

---

## Task 19: Component — SmartAgendaTimeline

**Files:**
- Create: `components/client/smart/SmartAgendaTimeline.tsx`

- [ ] **Step 1: Implement SmartAgendaTimeline.tsx**

```tsx
// components/client/smart/SmartAgendaTimeline.tsx
'use client'

import Link from 'next/link'
import type { TimelineEntry } from '@/lib/client/smart/timelineBuilder'
import { Bowl, Drop, Barbell, PersonSimpleRun, Moon } from '@phosphor-icons/react'

const KIND_CONFIG: Record<TimelineEntry['kind'], { Icon: React.ElementType; bg: string; tint: string }> = {
  meal:     { Icon: Bowl,             bg: 'bg-[#22c55e]/15',  tint: 'text-[#22c55e]' },
  water:    { Icon: Drop,             bg: 'bg-[#06b6d4]/15',  tint: 'text-[#06b6d4]' },
  workout:  { Icon: Barbell,          bg: 'bg-[#ffe01e]/15',  tint: 'text-[#ffe01e]' },
  activity: { Icon: PersonSimpleRun,  bg: 'bg-white/[0.08]',  tint: 'text-white/80' },
  checkin:  { Icon: Moon,             bg: 'bg-[#8b5cf6]/15',  tint: 'text-[#8b5cf6]' },
}

function timeOf(iso: string, tz = 'Europe/Paris'): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz, hour12: false }).format(d)
}

export default function SmartAgendaTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-[18px]">
      <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white mb-3">Journée</div>

      {entries.length === 0 ? (
        <p className="text-[12px] text-white/40 py-4 text-center">Aucune activité enregistrée aujourd'hui.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {entries.map(e => {
            const cfg = KIND_CONFIG[e.kind]
            const highlight = e.kind === 'workout' ? 'bg-[#ffe01e]/[0.06] border border-[#ffe01e]/20' : 'bg-white/[0.02]'
            const Body = (
              <div className={`flex items-center gap-3 p-2.5 rounded-xl ${highlight}`}>
                <div className="w-[44px] text-[10px] text-white/40 font-bold tabular-nums">{timeOf(e.start_iso)}</div>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                  <cfg.Icon size={14} className={cfg.tint} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-white truncate">{e.title}</div>
                  <div className="text-[10px] text-white/40 truncate">{e.subtitle}</div>
                </div>
              </div>
            )
            return e.href
              ? <Link key={e.id} href={e.href} className="active:scale-[0.99] transition-transform">{Body}</Link>
              : <div key={e.id}>{Body}</div>
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/client/smart/SmartAgendaTimeline.tsx
git commit -m "feat(smart): SmartAgendaTimeline with kind icons + workout highlight"
```

---

## Task 20: Modify app/client/page.tsx — Smart Agenda accueil

**Files:**
- Modify: `app/client/page.tsx`

- [ ] **Step 1: Replace page.tsx fully**

```tsx
// app/client/page.tsx
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { detectMusclesForExercises } from '@/lib/client/muscleDetection'
import NotificationsBar, { type Notification } from '@/components/client/smart/NotificationsBar'
import SmartNutritionWidget, { type NutritionMacros } from '@/components/client/smart/SmartNutritionWidget'
import SmartWorkoutWidget from '@/components/client/smart/SmartWorkoutWidget'
import SmartAgendaTimeline from '@/components/client/smart/SmartAgendaTimeline'
import type { TimelineEntry } from '@/lib/client/smart/timelineBuilder'

export default async function ClientHomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const client = await resolveClientFromUser(user.id, user.email, service, 'id, coach_id')
  if (!client) {
    return (
      <main className="min-h-screen bg-[#0d0d0d] p-4 pt-6 pb-24 max-w-[480px] mx-auto">
        <div className="bg-[#161616] rounded-2xl p-6 text-center">
          <p className="text-white">Aucun profil client.</p>
        </div>
      </main>
    )
  }

  const h = headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host')
  const origin = `${proto}://${host}`
  const cookie = h.get('cookie') ?? ''

  const [notifRes, nutriRes, timelineRes] = await Promise.allSettled([
    fetch(`${origin}/api/client/notifications?unread=true`, { headers: { cookie }, cache: 'no-store' }),
    fetch(`${origin}/api/client/nutrition/today`, { headers: { cookie }, cache: 'no-store' }),
    fetch(`${origin}/api/client/timeline/today`, { headers: { cookie }, cache: 'no-store' }),
  ])

  const notifications: Notification[] = notifRes.status === 'fulfilled' && notifRes.value.ok
    ? (await notifRes.value.json()).notifications ?? []
    : []
  const nutri: { target: NutritionMacros; consumed: NutritionMacros } = nutriRes.status === 'fulfilled' && nutriRes.value.ok
    ? await nutriRes.value.json()
    : { target: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, water_ml: 2500 }, consumed: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, water_ml: 0 } }
  const timeline: { entries: TimelineEntry[] } = timelineRes.status === 'fulfilled' && timelineRes.value.ok
    ? await timelineRes.value.json()
    : { entries: [] }

  // Today's session of the day (scheduled)
  const dow = (() => { const d = new Date().getDay(); return d === 0 ? 7 : d })()
  const { data: progRow } = await service
    .from('coach_clients')
    .select('id, programs(id, name, program_sessions(id, name, day_of_week, program_exercises(name, primary_muscles, secondary_muscles, sets, rest_sec)))')
    .eq('id', client.id)
    .maybeSingle()
  const todaysSession = (progRow?.programs?.[0]?.program_sessions ?? []).find((s: any) => s.day_of_week === dow)

  let workoutProps: React.ComponentProps<typeof SmartWorkoutWidget>
  if (!progRow?.programs?.[0]) {
    workoutProps = { state: 'no_program' }
  } else if (!todaysSession) {
    workoutProps = { state: 'rest' }
  } else {
    const exercises = todaysSession.program_exercises ?? []
    const muscles = detectMusclesForExercises(exercises.map((e: any) => ({
      name: e.name, primary_muscles: e.primary_muscles ?? [], secondary_muscles: e.secondary_muscles ?? [],
    })))
    const pills = Array.from(muscles.primary).slice(0, 3).map(m => m.charAt(0).toUpperCase() + m.slice(1))
    const totalSec = exercises.reduce((sum: number, ex: any) => {
      const sets = ex.sets ?? 3
      const rest = ex.rest_sec ?? 90
      return sum + sets * 45 + (sets - 1) * rest
    }, 0)
    workoutProps = {
      state: 'scheduled',
      session: {
        id: todaysSession.id,
        sessionLogHref: `/client/programme/session/${todaysSession.id}`,
        name: todaysSession.name ?? 'Séance',
        exerciseCount: exercises.length,
        estimatedMinutes: Math.round(totalSec / 60),
        primaryMuscles: Array.from(muscles.primary),
        secondaryMuscles: Array.from(muscles.secondary),
        musclePills: pills,
      },
    }
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] p-4 pt-2 pb-24 max-w-[480px] mx-auto space-y-3">
      <NotificationsBar initial={notifications} />
      <SmartNutritionWidget consumed={nutri.consumed} target={nutri.target} />
      <SmartWorkoutWidget {...workoutProps} />
      <SmartAgendaTimeline entries={timeline.entries} />
    </main>
  )
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'app/client/page' || echo 'clean'`
Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add app/client/page.tsx
git commit -m "feat(client): Smart Agenda home page (4 sections)"
```

---

## Task 21: Modify ClientTopBar — dynamic section labels

**Files:**
- Modify: `components/client/ClientTopBar.tsx`

- [ ] **Step 1: Inspect current ClientTopBar**

Run: `cat components/client/ClientTopBar.tsx`
Expected: see current implementation + useSetTopBar hook usage.

- [ ] **Step 2: Update labels per route**

Modify `ClientTopBar.tsx` so default labels derive from pathname when `useSetTopBar` not invoked by a page:

```tsx
// snippet adjustment inside ClientTopBar.tsx
import { usePathname } from 'next/navigation'

const TOPBAR_DEFAULTS: { match: (p: string) => boolean; label: string; title: (lang: string) => string }[] = [
  { match: (p) => p === '/client',                   label: 'AUJOURD\'HUI', title: () => formatDateLong(new Date()) },
  { match: (p) => p.startsWith('/client/programme'), label: 'ENTRAÎNEMENT', title: () => '' },
  { match: (p) => p.startsWith('/client/nutrition'), label: 'NUTRITION',    title: () => '' },
  { match: (p) => p.startsWith('/client/profil'),    label: 'PROFIL',       title: () => '' },
]

// In ClientTopBar render: if no explicit topBarLeft set via context, derive from pathname using TOPBAR_DEFAULTS.
```

Add helper `formatDateLong` :

```ts
function formatDateLong(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
}
```

Read full ClientTopBar.tsx then apply minimal edits to integrate. Preserve existing logout/lang controls in topBarRight default.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'ClientTopBar' || echo 'clean'`
Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add components/client/ClientTopBar.tsx
git commit -m "feat(client): ClientTopBar dynamic section labels"
```

---

## Task 22: Component — SmartAlertsFeed (shared nutrition + workout)

**Files:**
- Create: `components/client/smart/SmartAlertsFeed.tsx`

- [ ] **Step 1: Implement SmartAlertsFeed.tsx**

```tsx
// components/client/smart/SmartAlertsFeed.tsx
'use client'

import { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react'

export type GenericAlert = {
  code: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  body?: string
}

const SEVERITY: Record<GenericAlert['severity'], { bg: string; text: string; Icon: React.ElementType }> = {
  info:     { bg: 'bg-cyan-500/10',   text: 'text-cyan-400',  Icon: Info },
  warning:  { bg: 'bg-amber-500/10',  text: 'text-amber-400', Icon: AlertTriangle },
  critical: { bg: 'bg-red-500/10',    text: 'text-red-400',   Icon: AlertCircle },
}

export default function SmartAlertsFeed({ alerts }: { alerts: GenericAlert[] }) {
  const [expanded, setExpanded] = useState(false)
  if (alerts.length === 0) return null
  const visible = expanded ? alerts : alerts.slice(0, 3)
  const remaining = alerts.length - 3

  return (
    <div className="space-y-2">
      {visible.map(a => {
        const cfg = SEVERITY[a.severity]
        return (
          <div key={`${a.code}-${a.title}`} className="bg-[#161616] rounded-2xl border border-white/[0.08] p-3 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
              <cfg.Icon size={16} className={cfg.text} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white">{a.title}</p>
              {a.body && <p className="text-[11px] text-white/55 mt-1 leading-relaxed">{a.body}</p>}
            </div>
          </div>
        )
      })}
      {!expanded && remaining > 0 && (
        <button onClick={() => setExpanded(true)} className="w-full text-[10px] text-white/40 flex items-center justify-center gap-1 py-2">
          Voir {remaining} de plus <ChevronDown size={12} />
        </button>
      )}
      {expanded && alerts.length > 3 && (
        <button onClick={() => setExpanded(false)} className="w-full text-[10px] text-white/40 flex items-center justify-center gap-1 py-2">
          Réduire <ChevronUp size={12} />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/client/smart/SmartAlertsFeed.tsx
git commit -m "feat(smart): SmartAlertsFeed shared component"
```

---

## Task 23: Smart Nutrition page sub-components

**Files:**
- Create: `components/client/smart/SmartNutritionHero.tsx`
- Create: `components/client/smart/CoachProtocolCard.tsx`
- Create: `components/client/smart/RemainingBreakdown.tsx`
- Create: `components/client/smart/WeeklyTrendStrip.tsx`

- [ ] **Step 1: SmartNutritionHero.tsx (large semicircle + macros big)**

```tsx
// components/client/smart/SmartNutritionHero.tsx
'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { NutritionMacros } from './SmartNutritionWidget'

type Props = {
  date: string
  consumed: NutritionMacros
  target: NutritionMacros
}

function shiftDate(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}

function formatNav(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
}

export default function SmartNutritionHero({ date, consumed, target }: Props) {
  const pct = target.kcal > 0 ? Math.min(1, consumed.kcal / target.kcal) : 0
  const total = 251.2
  const offset = total * (1 - pct)
  const prev = shiftDate(date, -1)
  const next = shiftDate(date, 1)

  return (
    <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-[18px]">
      <div className="flex items-center justify-between mb-3">
        <Link href={`/client/nutrition?date=${prev}`} className="flex items-center gap-1 text-white/60 text-[11px]">
          <ChevronLeft size={14} /> {formatNav(prev)}
        </Link>
        <span className="text-[18px] font-black tracking-[-0.02em] text-white">{formatNav(date)}</span>
        <Link href={`/client/nutrition?date=${next}`} className="flex items-center gap-1 text-white/60 text-[11px]">
          {formatNav(next)} <ChevronRight size={14} />
        </Link>
      </div>

      <div className="relative h-[180px]">
        <svg viewBox="0 0 200 110" className="w-full h-full">
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round"/>
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#ffe01e" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={total} strokeDashoffset={offset} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-4">
          <div className="text-[32px] font-black leading-none text-white tabular-nums">{Math.round(consumed.kcal)}</div>
          <div className="text-[11px] text-white/40 mt-1 tabular-nums">/ {target.kcal} kcal</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3">
        {[
          { key: 'protein_g', label: 'P', color: '#4a90e2' },
          { key: 'carbs_g', label: 'G', color: '#22c55e' },
          { key: 'fat_g', label: 'L', color: '#f59e0b' },
        ].map(m => {
          const c = (consumed as any)[m.key] ?? 0
          const tg = (target as any)[m.key] ?? 0
          const w = tg > 0 ? Math.min(100, (c / tg) * 100) : 0
          return (
            <div key={m.key} className="text-center">
              <div className="text-[20px] font-black text-white tabular-nums">{Math.round(c)}<span className="text-[12px] text-white/40">/{tg}g</span></div>
              <div className="text-[9px] text-white/55 uppercase font-bold tracking-[0.1em] mt-1">{m.label}</div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mt-1.5">
                <div className="h-full" style={{ width: `${w}%`, background: m.color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: CoachProtocolCard.tsx**

```tsx
// components/client/smart/CoachProtocolCard.tsx
type ProtocolDay = {
  name?: string | null
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  hydration_ml?: number | null
  carb_cycle_type?: string | null
  cycle_sync_phase?: string | null
  recommendations?: string | null
}

export default function CoachProtocolCard({ day }: { day: ProtocolDay | null }) {
  if (!day) {
    return (
      <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-4">
        <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white mb-2">Protocole coach</div>
        <p className="text-[12px] text-white/40">Pas de protocole nutritionnel actif.</p>
      </div>
    )
  }
  return (
    <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white">{day.name ?? 'Protocole coach'}</div>
        {day.carb_cycle_type && <span className="text-[9px] uppercase font-bold tracking-[0.1em] text-[#ffe01e]">{day.carb_cycle_type}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px] text-white/70 tabular-nums">
        <div>{day.calories ?? 0} kcal</div>
        <div>P {day.protein_g ?? 0} · G {day.carbs_g ?? 0} · L {day.fat_g ?? 0}</div>
        <div>Hydratation : {((day.hydration_ml ?? 0) / 1000).toFixed(1)}L</div>
        {day.cycle_sync_phase && <div>Phase : {day.cycle_sync_phase}</div>}
      </div>
      {day.recommendations && (
        <p className="text-[11px] text-white/55 leading-relaxed whitespace-pre-wrap">{day.recommendations}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: RemainingBreakdown.tsx**

```tsx
// components/client/smart/RemainingBreakdown.tsx
import Link from 'next/link'
import type { NutritionMacros } from './SmartNutritionWidget'

type Suggestion = { label: string; macros: string }

function suggest(remaining: NutritionMacros): Suggestion[] {
  const out: Suggestion[] = []
  if (remaining.protein_g > 30 && remaining.carbs_g < 30) {
    out.push({ label: 'Yaourt grec + amandes', macros: '~250 kcal · 25P 10G 12L' })
  }
  if (remaining.carbs_g > 50 && remaining.fat_g < 15) {
    out.push({ label: 'Bol de riz + poulet', macros: '~450 kcal · 35P 55G 8L' })
  }
  if (remaining.kcal > 500) {
    out.push({ label: 'Repas complet équilibré', macros: '~500 kcal · 30P 50G 18L' })
  }
  return out.slice(0, 3)
}

export default function RemainingBreakdown({ consumed, target }: { consumed: NutritionMacros; target: NutritionMacros }) {
  const remaining: NutritionMacros = {
    kcal:      Math.max(0, target.kcal      - consumed.kcal),
    protein_g: Math.max(0, target.protein_g - consumed.protein_g),
    carbs_g:   Math.max(0, target.carbs_g   - consumed.carbs_g),
    fat_g:     Math.max(0, target.fat_g     - consumed.fat_g),
    water_ml:  Math.max(0, target.water_ml  - consumed.water_ml),
  }
  const suggestions = suggest(remaining)

  return (
    <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-4">
      <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white mb-2">Reste à consommer</div>
      <p className="text-[12px] text-white/70 tabular-nums">
        {Math.round(remaining.kcal)} kcal · {Math.round(remaining.protein_g)}g P · {Math.round(remaining.carbs_g)}g G · {Math.round(remaining.fat_g)}g L · {(remaining.water_ml / 1000).toFixed(1)}L
      </p>
      {suggestions.length > 0 && (
        <div className="mt-3 space-y-2">
          {suggestions.map(s => (
            <Link key={s.label} href="/client/nutrition/log"
              className="block bg-white/[0.02] rounded-xl p-3 active:scale-[0.99] transition-transform">
              <div className="text-[12px] font-semibold text-white">{s.label}</div>
              <div className="text-[10px] text-white/40 mt-0.5">{s.macros}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: WeeklyTrendStrip.tsx**

```tsx
// components/client/smart/WeeklyTrendStrip.tsx
type Point = { date: string; consumed: number; target: number }

export default function WeeklyTrendStrip({ trend }: { trend: Point[] }) {
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-4">
      <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white mb-3">7 derniers jours</div>
      <div className="flex items-end gap-2 h-[60px]">
        {trend.map(p => {
          const ratio = p.target > 0 ? Math.min(1, p.consumed / p.target) : 0
          const h = Math.max(2, ratio * 56)
          const future = p.date > today
          const color = future
            ? 'rgba(255,255,255,0.08)'
            : ratio > 0.85 ? '#22c55e' : ratio > 0.6 ? '#ffe01e' : '#ef4444'
          return (
            <div key={p.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-md" style={{ height: `${h}px`, background: color }} />
              <div className="text-[9px] text-white/40">{p.date.slice(8, 10)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/client/smart/SmartNutritionHero.tsx components/client/smart/CoachProtocolCard.tsx components/client/smart/RemainingBreakdown.tsx components/client/smart/WeeklyTrendStrip.tsx
git commit -m "feat(smart): nutrition sub-components (hero, protocol, remaining, trend)"
```

---

## Task 24: Modify app/client/nutrition/page.tsx — Smart Nutrition refonte

**Files:**
- Modify: `app/client/nutrition/page.tsx`

- [ ] **Step 1: Inspect existing page**

Run: `cat app/client/nutrition/page.tsx | head -60`
Expected: see current implementation. Replace fully.

- [ ] **Step 2: Replace fully**

```tsx
// app/client/nutrition/page.tsx
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import SmartNutritionHero from '@/components/client/smart/SmartNutritionHero'
import SmartAlertsFeed, { type GenericAlert } from '@/components/client/smart/SmartAlertsFeed'
import CoachProtocolCard from '@/components/client/smart/CoachProtocolCard'
import RemainingBreakdown from '@/components/client/smart/RemainingBreakdown'
import WeeklyTrendStrip from '@/components/client/smart/WeeklyTrendStrip'
import type { NutritionMacros } from '@/components/client/smart/SmartNutritionWidget'

type SearchParams = { date?: string }

export default async function ClientNutritionPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const client = await resolveClientFromUser(user.id, user.email, service, 'id, gender')
  if (!client) return null

  const date = searchParams.date ?? computePhysiologicalDate(new Date()).toISOString().slice(0, 10)

  const h = headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host')
  const origin = `${proto}://${host}`
  const cookie = h.get('cookie') ?? ''

  const [todayR, alertsR, trendR] = await Promise.allSettled([
    fetch(`${origin}/api/client/nutrition/today?date=${date}`, { headers: { cookie }, cache: 'no-store' }),
    fetch(`${origin}/api/client/nutrition-alerts`, { headers: { cookie }, cache: 'no-store' }),
    fetch(`${origin}/api/client/nutrition/weekly-trend`, { headers: { cookie }, cache: 'no-store' }),
  ])

  const today: { target: NutritionMacros; consumed: NutritionMacros } = todayR.status === 'fulfilled' && todayR.value.ok
    ? await todayR.value.json()
    : { target: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, water_ml: 2500 }, consumed: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, water_ml: 0 } }
  const alerts: GenericAlert[] = alertsR.status === 'fulfilled' && alertsR.value.ok
    ? (await alertsR.value.json()).alerts ?? []
    : []
  const trend = trendR.status === 'fulfilled' && trendR.value.ok
    ? (await trendR.value.json()).trend ?? []
    : []

  // Active protocol day
  const { data: proto2 } = await service
    .from('nutrition_protocols')
    .select('nutrition_protocol_days(*)')
    .eq('client_id', client.id)
    .eq('status', 'shared')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const protocolDay = proto2?.nutrition_protocol_days?.[0] ?? null

  return (
    <main className="min-h-screen bg-[#0d0d0d] p-4 pt-2 pb-24 max-w-[480px] mx-auto space-y-3">
      <SmartNutritionHero date={date} consumed={today.consumed} target={today.target} />
      <SmartAlertsFeed alerts={alerts} />
      <CoachProtocolCard day={protocolDay} />
      <RemainingBreakdown consumed={today.consumed} target={today.target} />
      <WeeklyTrendStrip trend={trend} />
    </main>
  )
}
```

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'app/client/nutrition/page' || echo 'clean'`
Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add app/client/nutrition/page.tsx
git commit -m "feat(client): Smart Nutrition page (5 sections)"
```

---

## Task 25: Smart Workout page sub-components

**Files:**
- Create: `components/client/smart/SmartWorkoutHero.tsx`
- Create: `components/client/smart/SessionPreview.tsx`
- Create: `components/client/smart/VolumeCoverageWidget.tsx`
- Create: `components/client/smart/RecentSessionsStrip.tsx`

- [ ] **Step 1: SmartWorkoutHero.tsx**

```tsx
// components/client/smart/SmartWorkoutHero.tsx
'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'

type Props = {
  date: string
  state: 'scheduled' | 'completed' | 'rest'
  sessionName?: string
  sessionLogHref?: string
  recapHref?: string
  exerciseCount?: number
  estimatedMinutes?: number
  performanceSummary?: string
}

function shiftDate(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + delta); return d.toISOString().slice(0, 10)
}
function fmt(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso + 'T00:00:00'))
}

export default function SmartWorkoutHero(p: Props) {
  return (
    <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-4">
      <div className="flex items-center justify-between mb-3">
        <Link href={`/client/programme?date=${shiftDate(p.date, -1)}`} className="flex items-center gap-1 text-white/60 text-[11px]">
          <ChevronLeft size={14} /> {fmt(shiftDate(p.date, -1))}
        </Link>
        <span className="text-[18px] font-black tracking-[-0.02em] text-white">{fmt(p.date)}</span>
        <Link href={`/client/programme?date=${shiftDate(p.date, 1)}`} className="flex items-center gap-1 text-white/60 text-[11px]">
          {fmt(shiftDate(p.date, 1))} <ChevronRight size={14} />
        </Link>
      </div>

      {p.state === 'scheduled' && p.sessionName && (
        <>
          <div className="text-[20px] font-black tracking-[-0.02em] text-white">{p.sessionName}</div>
          <div className="text-[11px] text-white/50 mt-1">{p.exerciseCount} exercices · ~{p.estimatedMinutes} min</div>
          {p.sessionLogHref && (
            <Link href={p.sessionLogHref}
              className="mt-3 inline-flex w-full items-center justify-center h-11 rounded-xl bg-[#ffe01e] text-[#0d0d0d] text-[11px] font-black uppercase tracking-[0.1em]">
              Démarrer →
            </Link>
          )}
        </>
      )}

      {p.state === 'completed' && (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 size={18} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="text-[12px] text-white font-semibold">Séance terminée</div>
            <div className="text-[10px] text-white/40">{p.performanceSummary}</div>
          </div>
          {p.recapHref && <Link href={p.recapHref} className="text-[11px] text-[#ffe01e]">Voir →</Link>}
        </div>
      )}

      {p.state === 'rest' && (
        <p className="text-[12px] text-white/55">Jour de repos.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: SessionPreview.tsx (delegates BodyMap + ExerciseListDisclosure)**

```tsx
// components/client/smart/SessionPreview.tsx
'use client'

import BodyMap from '../BodyMap'
import ExerciseListDisclosure from '../ExerciseListDisclosure'
import type { MuscleGroup } from '@/lib/client/muscleDetection'

type Ex = { name: string; sets: number; reps?: string | null; rir?: number | null; equipment?: string[]; primary_muscles?: string[]; secondary_muscles?: string[] }

export default function SessionPreview({ exercises, primaryGroups, secondaryGroups }: {
  exercises: Ex[]
  primaryGroups: Set<MuscleGroup>
  secondaryGroups: Set<MuscleGroup>
}) {
  return (
    <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-4 space-y-3">
      <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white">Aperçu séance</div>
      <div className="flex justify-center">
        <BodyMap primaryGroups={primaryGroups} secondaryGroups={secondaryGroups} />
      </div>
      <ExerciseListDisclosure exercises={exercises} />
    </div>
  )
}
```

- [ ] **Step 3: VolumeCoverageWidget.tsx**

```tsx
// components/client/smart/VolumeCoverageWidget.tsx
type Group = { group: string; label: string; actual: number; mev: number; mav: number; mrv: number }

export default function VolumeCoverageWidget({ weekStart, sessionsCount, groups }: { weekStart: string; sessionsCount: number; groups: Group[] }) {
  return (
    <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-4">
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white">Volume hebdo</span>
        <span className="text-[10px] text-white/40 tabular-nums">{sessionsCount} séances</span>
      </div>
      <div className="space-y-2.5">
        {groups.map(g => {
          let color = 'rgba(255,255,255,0.08)'
          if (g.actual > g.mrv) color = '#ef4444'
          else if (g.actual > g.mav) color = '#f59e0b'
          else if (g.actual >= g.mev) color = '#22c55e'
          const span = g.mrv * 1.2
          const w = Math.min(100, (g.actual / span) * 100)
          const mevPct = (g.mev / span) * 100
          const mavPct = (g.mav / span) * 100
          return (
            <div key={g.group}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-white/55">{g.label}</span>
                <span className="text-white tabular-nums">{g.actual} <span className="text-white/40">/ MEV {g.mev}</span></span>
              </div>
              <div className="relative h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full" style={{ width: `${w}%`, background: color }} />
                <div className="absolute top-[-2px] bottom-[-2px] w-px bg-white/40" style={{ left: `${mevPct}%` }} />
                <div className="absolute top-[-2px] bottom-[-2px] w-px bg-white/40" style={{ left: `${mavPct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: RecentSessionsStrip.tsx**

```tsx
// components/client/smart/RecentSessionsStrip.tsx
'use client'

import Link from 'next/link'

type Session = { id: string; completed_at: string; program_session_id: string | null; volume_kg: number; avg_rir: number | null }

export default function RecentSessionsStrip({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) return null
  return (
    <div className="bg-[#161616] rounded-2xl border border-white/[0.08] p-4">
      <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white mb-3">Dernières séances</div>
      <div className="flex gap-2 overflow-x-auto">
        {sessions.map(s => (
          <Link key={s.id} href={`/client/programme/recap/${s.id}`}
            className="min-w-[140px] bg-white/[0.02] rounded-xl p-3 active:scale-[0.99] transition-transform">
            <div className="text-[10px] text-white/40 tabular-nums">{new Date(s.completed_at).toLocaleDateString('fr-FR')}</div>
            <div className="text-[14px] font-black text-white mt-1 tabular-nums">{s.volume_kg} kg</div>
            {s.avg_rir != null && <div className="text-[10px] text-white/55 mt-0.5">RIR moy {s.avg_rir}</div>}
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/client/smart/SmartWorkoutHero.tsx components/client/smart/SessionPreview.tsx components/client/smart/VolumeCoverageWidget.tsx components/client/smart/RecentSessionsStrip.tsx
git commit -m "feat(smart): workout sub-components (hero, preview, coverage, recent)"
```

---

## Task 26: Modify app/client/programme/ProgrammeClientPage.tsx — Smart Workout refonte

**Files:**
- Modify: `app/client/programme/ProgrammeClientPage.tsx`
- Modify: `app/client/programme/page.tsx` (if it wraps ProgrammeClientPage with data fetch)

- [ ] **Step 1: Inspect existing structure**

Run: `cat app/client/programme/page.tsx | head -40 && echo '---' && cat app/client/programme/ProgrammeClientPage.tsx | head -40`
Expected: see how page wires data to ProgrammeClientPage.

- [ ] **Step 2: Add Smart Workout sections to ProgrammeClientPage**

Modify `ProgrammeClientPage.tsx`:
- Keep existing BodyMap + exercise list logic but wrap into `<SessionPreview />`
- Add at top: `<SmartWorkoutHero />` with date nav
- Below SessionPreview: `<SmartAlertsFeed />` with workout alerts, `<VolumeCoverageWidget />`, `<RecentSessionsStrip />`
- Data: fetch additional endpoints `/api/client/workout-alerts`, `/api/client/volume-coverage`, `/api/client/recent-sessions` in parallel inside `app/client/programme/page.tsx` (Server Component) and pass as props

Concrete edits (page.tsx) :

```tsx
// app/client/programme/page.tsx — inside the data-fetch section, ADD:
const [alertsR, coverageR, recentR] = await Promise.allSettled([
  fetch(`${origin}/api/client/workout-alerts`, { headers: { cookie }, cache: 'no-store' }),
  fetch(`${origin}/api/client/volume-coverage`, { headers: { cookie }, cache: 'no-store' }),
  fetch(`${origin}/api/client/recent-sessions`, { headers: { cookie }, cache: 'no-store' }),
])
const workoutAlerts = alertsR.status === 'fulfilled' && alertsR.value.ok ? (await alertsR.value.json()).alerts ?? [] : []
const volumeCoverage = coverageR.status === 'fulfilled' && coverageR.value.ok ? await coverageR.value.json() : { week_start: '', sessions_count: 0, groups: [] }
const recentSessions = recentR.status === 'fulfilled' && recentR.value.ok ? (await recentR.value.json()).sessions ?? [] : []

// then pass to ProgrammeClientPage:
<ProgrammeClientPage
  /* existing props */
  workoutAlerts={workoutAlerts}
  volumeCoverage={volumeCoverage}
  recentSessions={recentSessions}
/>
```

In `ProgrammeClientPage.tsx`, accept new props and render:

```tsx
import SmartWorkoutHero from '@/components/client/smart/SmartWorkoutHero'
import SmartAlertsFeed from '@/components/client/smart/SmartAlertsFeed'
import VolumeCoverageWidget from '@/components/client/smart/VolumeCoverageWidget'
import RecentSessionsStrip from '@/components/client/smart/RecentSessionsStrip'
import SessionPreview from '@/components/client/smart/SessionPreview'

// in render:
<main className="min-h-screen bg-[#0d0d0d] p-4 pt-2 pb-24 max-w-[480px] mx-auto space-y-3">
  <SmartWorkoutHero
    date={dateIso}
    state={sessionState}
    sessionName={session?.name}
    sessionLogHref={session ? `/client/programme/session/${session.id}` : undefined}
    exerciseCount={exercises.length}
    estimatedMinutes={estimatedMin}
  />
  <SmartAlertsFeed alerts={workoutAlerts} />
  <SessionPreview exercises={exercises} primaryGroups={primary} secondaryGroups={secondary} />
  <VolumeCoverageWidget {...volumeCoverage} />
  <RecentSessionsStrip sessions={recentSessions} />
</main>
```

Preserve existing nav (prev/next day), session swap UI, etc. — do not remove existing functionality.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'ProgrammeClientPage|programme/page' || echo 'clean'`
Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add app/client/programme/ProgrammeClientPage.tsx app/client/programme/page.tsx
git commit -m "feat(client): Smart Workout page (5 sections)"
```

---

## Task 27: Delete /client/agenda and /client/progress routes + redirects

**Files:**
- Delete: `app/client/agenda/` (recursive)
- Delete: `app/client/progress/` (recursive)
- Delete: agenda/progress components in `components/client/`
- Modify: `utils/supabase/middleware.ts`

- [ ] **Step 1: Inspect middleware**

Run: `cat utils/supabase/middleware.ts | head -80`
Expected: see current middleware. Find a place to add redirects before auth checks.

- [ ] **Step 2: Add redirects in middleware**

Modify `utils/supabase/middleware.ts` near the top of the matcher logic (after request creation, before auth gate):

```ts
// inside updateSession or equivalent
const pathname = request.nextUrl.pathname
if (pathname === '/client/agenda' || pathname.startsWith('/client/agenda/')) {
  return NextResponse.redirect(new URL('/client', request.url), { status: 301 })
}
if (pathname === '/client/progress' || pathname.startsWith('/client/progress/')) {
  return NextResponse.redirect(new URL('/client', request.url), { status: 301 })
}
```

- [ ] **Step 3: Delete routes & components**

```bash
git rm -r app/client/agenda app/client/progress
git rm components/client/AgendaDayView.tsx components/client/AgendaWeekView.tsx components/client/AgendaEventCard.tsx
```

If any other component references these (grep first) :

Run: `grep -rln "AgendaDayView\|AgendaWeekView\|AgendaEventCard\|ProgressCharts\|PRsPodium\|ProgressHeatmap\|ProgressVolumeChart\|ProgressClientPage" --include='*.tsx' --include='*.ts' app components 2>&1`
Expected: only matches inside files being deleted, or none. Fix any stray imports if found.

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -E 'Agenda|Progress' || echo 'clean'`
Expected: `clean`

- [ ] **Step 5: Commit**

```bash
git add utils/supabase/middleware.ts
git commit -m "refactor(client): remove /agenda + /progress routes; 301 redirect to /client"
```

---

## Task 28: Documentation — CHANGELOG + project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Add CHANGELOG entries**

Append at top under today's date `## 2026-05-17`:

```
FEATURE: Smart Trio refonte app client — Smart Agenda + Smart Workout + Smart Nutrition
FEATURE: BottomNav 5 slots + central STRYVR logo + RadialActionMenu (4 actions arc)
FEATURE: FreeActivitySheet pour logger activité libre (running, cycling, etc.)
FEATURE: Smart alerts IA — 4 règles nutrition + 3 règles workout
FEATURE: Volume coverage weekly widget (MEV/MAV/MRV) sur Smart Workout
SCHEMA: coach_client_notifications table + RLS
SCHEMA: client_activity_logs table + RLS
REFACTOR: suppression routes /client/agenda + /client/progress (redirect 301 → /client)
REFACTOR: BottomNavPlusMenu remplacé par RadialActionMenu
```

- [ ] **Step 2: Update project-state.md**

Replace the "Dernière mise à jour" line at top with `**Dernière mise à jour : 2026-05-17 (Smart Trio refonte client app)**`.

Add a new section at the top of "🚀 Dernières Avancées" :

```markdown
## 🚀 Dernières Avancées (2026-05-17) — Smart Trio Client App

### Refonte 3 piliers (COMPLET)
- ✅ /client = Smart Agenda (notifs + nutrition widget + workout widget + timeline)
- ✅ /client/nutrition = Smart Nutrition (hero + alertes IA + protocole + remaining + weekly trend)
- ✅ /client/programme = Smart Workout (hero + alertes RIR/stagnation + preview + volume coverage + recent)
- ✅ BottomNav 5 slots + logo STRYVR central + RadialActionMenu (4 actions arc)
- ✅ /client/agenda + /client/progress supprimés (redirect 301 → /client)
- ✅ 2 nouvelles tables : coach_client_notifications + client_activity_logs

**⚠️ Actions manuelles requises :**
1. Appliquer 20260517_coach_client_notifications.sql via Supabase Dashboard
2. Appliquer 20260517_client_activity_logs.sql via Supabase Dashboard
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: changelog + project-state for Smart Trio refonte"
```

---

## Task 29: Full TypeScript + Vitest sweep

**Files:** all touched

- [ ] **Step 1: Full tsc check**

Run: `npx tsc --noEmit 2>&1 | tail -30`
Expected: 0 new errors compared to baseline. Pre-existing errors in `stripe/webhook`, `BodyFatCalculator`, etc. are out of scope but document any new errors.

- [ ] **Step 2: Run all new Vitest suites**

Run: `npx vitest run tests/lib/client/smart/`
Expected: all tests PASS (4 files, ~19 tests).

- [ ] **Step 3: Run full Vitest sweep**

Run: `npx vitest run`
Expected: no regressions on pre-existing tests.

- [ ] **Step 4: Final commit if needed**

```bash
git status
# If anything pending (formatting, lint fixes):
git add -A
git commit -m "chore: tsc + vitest green"
```

---

## Self-Review

### Spec coverage

- Routes & redirects → Task 27 ✓
- BottomNav 5 slots + logo central → Task 15 ✓
- TopBar dynamique → Task 21 ✓
- Smart Agenda 4 sections (NotificationsBar, SmartNutritionWidget, SmartWorkoutWidget, SmartAgendaTimeline) → Tasks 16-20 ✓
- RadialActionMenu + FreeActivitySheet → Tasks 13, 14 ✓
- Smart Nutrition page 5 sections → Tasks 23, 24 ✓
- Smart Workout page 5 sections → Tasks 25, 26 ✓
- 4 libs partagées + tests Vitest → Tasks 3, 4, 5, 6 ✓
- 2 migrations DB → Tasks 1, 2 ✓
- 11 API routes → Tasks 8, 9, 10, 11, 12 ✓
- i18n smart.* FR/EN/ES → Task 7 ✓
- DS v3.0 strict (tokens, radius, no shadows) → enforced in every component task ✓
- CHANGELOG + project-state → Task 28 ✓

### Placeholder scan

- No "TBD", "TODO", "implement later" instances.
- No "Similar to Task N" — all code is repeated where needed.
- All tests have actual assertions, not "write tests for above".

### Type consistency

- `NutritionMacros` defined in Task 17, reused in Tasks 20, 23, 24 ✓
- `TimelineEntry` defined in Task 6, used in Tasks 12, 19 ✓
- `GenericAlert` defined in Task 22, used in Tasks 24, 26 ✓
- `WorkoutAnalysisRow` defined in Task 5, used in Task 11 ✓
- `Notification` type defined in Task 16, used in Task 20 ✓

### Spec → plan gaps fixed inline

- Coach UI notifications (creation side) explicitly out of scope Phase 1 — confirmed in spec ✓
- `client_lifestyle_logs` checkin source : Task 12 Step 2 includes fallback if table missing ✓
- `nutrition_protocol_days` column names: Task 10 Step 5 verifies actual schema before running ✓
- BodyMap `compact` prop: Task 18 Step 2 adds it if missing ✓

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-17-smart-trio-client-app-redesign.md`.**
