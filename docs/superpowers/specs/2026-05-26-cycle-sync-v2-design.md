# Cycle Sync v2 — Design Spec

**Date:** 2026-05-26  
**Status:** Approved  
**Approach:** B — Dedicated table + smart engine

---

## Context

The cycle sync engine exists (`lib/nutrition/engine/cycleSync.ts`) and already powers the `CycleSyncBanner` in the client nutrition tab and the `CycleSyncPhaseGrid` in Nutrition Studio. However:

- Cycle data comes only from `assessment_responses.menstrual_cycle` (a phase-category text choice, not a date)
- The engine hardcodes 28-day cycle length
- No mechanism for clients to log period start/end
- No real-time cycle state; coach studio reads stale bilan data
- No "no cycle" awareness in the engine (ménopause, aménorrhée)
- Cycle phase not visible in Workout/Programme section
- `ProtocolRationale` does not explain per-day-type logic or cycle adjustments

---

## Goals

1. Gold-standard cycle tracking: history-based, learns personal cycle length over time
2. Client can log period start AND end from FAB (+) button
3. Cycle phase visible in TopBar on both Nutrition and Programme pages
4. Nutrition Studio (coach) treats cycle phase as second source of truth alongside TDEE
5. ProtocolRationale shows per-day-type explanations + cycle adjustments for females
6. Profile settings show cycle state + allow edit

---

## Data Layer

### Table: `menstrual_cycle_logs`

```sql
id                        uuid PRIMARY KEY DEFAULT gen_random_uuid()
client_id                 uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE
period_start_date         date NOT NULL
period_end_date           date NULL  -- logged when bleeding stops
computed_cycle_length_days int NULL  -- diff from previous log's period_start_date
created_at                timestamptz NOT NULL DEFAULT now()

CONSTRAINT uq_cycle_start UNIQUE (client_id, period_start_date)
INDEX idx_cycle_logs_client_date ON menstrual_cycle_logs(client_id, period_start_date DESC)
```

**RLS policies:**
- Client: SELECT, INSERT, UPDATE own rows (`client_id = auth_client_id()`)
- Coach: SELECT rows of their clients

`computed_cycle_length_days` is computed server-side on INSERT: `current.period_start_date - previous.period_start_date`. NULL on first log.

### No new column on `clients` or `assessment_responses`

`has_active_cycle` is derived from the existing `assessment_responses.menstrual_cycle` field:
- `'Ménopause / Aménorrhée'` or `'Non applicable'` → `hasActiveCycle = false`
- Any other value or NULL (no bilan answer) → `hasActiveCycle = true` (assume active if unknown)

---

## Cycle Engine

### `lib/cycle/cycleEngine.ts`

```ts
export interface CycleState {
  hasActiveCycle: boolean
  currentPhase: CyclePhase | null       // null if no active cycle or no data
  currentCycleDay: number | null
  avgCycleLengthDays: number            // personal avg, fallback 28
  menstrualPhaseLengthDays: number      // personal avg end-start, fallback 5
  nextPhaseIn: number | null            // days until next phase transition
  lastPeriodDate: string | null         // ISO date
  logsCount: number
  confidence: 'estimated' | 'learning' | 'calibrated'
  // estimated  = from bilan text choice only (no logs)
  // learning   = 1–3 logged cycles
  // calibrated = 4+ logged cycles
}
```

**`getCycleState(clientId: string, cycleStatusFromBilan: string | null): Promise<CycleState>`**

1. Derive `hasActiveCycle` from `cycleStatusFromBilan`
2. If `!hasActiveCycle` → return early with `{ hasActiveCycle: false, currentPhase: null, ... }`
3. Fetch last 7 `menstrual_cycle_logs` ordered by `period_start_date DESC`
4. Compute `avgCycleLengthDays`:
   - Collect `computed_cycle_length_days` values from logs (where non-null)
   - If ≥ 2 values → average, clamped to [21, 35]
   - If 1 value → use it (still clamp)
   - If 0 values → 28
5. Compute `menstrualPhaseLengthDays`:
   - Avg of `(period_end_date - period_start_date)` from logs where `period_end_date` non-null
   - Fallback: 5
6. If no logs → fall back to `assessment_responses.menstrual_cycle` text to estimate cycle day:
   - `'Phase folliculaire (J1–J13)'` → day 7 (midpoint)
   - `'Ovulation (J14)'` → day 14
   - `'Phase lutéale (J15–J28)'` → day 21
   - `'Règles'` → day 1
   - Other / null → return `{ currentPhase: null, currentCycleDay: null, confidence: 'estimated' }`
7. Compute `currentCycleDay = today - lastPeriodDate.period_start_date + 1` (mod `avgCycleLengthDays`)
8. Determine `currentPhase` using `avgCycleLengthDays` (not hardcoded 28):
   - menstrual: J1 → J`menstrualPhaseLengthDays`
   - follicular: J`menstrualPhaseLengthDays+1` → J`floor(avgCycleLength/2) - 1`
   - ovulatory: J`floor(avgCycleLength/2)` → J`floor(avgCycleLength/2) + 1`
   - luteal: remainder → J`avgCycleLength`
9. Set `confidence`: 0 logs → `estimated`, 1–3 → `learning`, 4+ → `calibrated`

---

## API Routes

### `POST /api/client/cycle/log`

Auth: client session only.

Body:
```ts
{
  type: 'start' | 'end'
  date?: string  // ISO date, defaults to today
}
```

**On `type: 'start'`:**
- Upsert row with `period_start_date = date`
- Compute `computed_cycle_length_days` from most recent previous log
- Guard: if a log exists within 3 days of `date` → return 409 with `{ conflict: true, existingDate }` (client shows confirm prompt)

**On `type: 'end'`:**
- Find the most recent log where `period_start_date <= date`
- Set `period_end_date = date` on that row
- Validate: end must be ≥ start and ≤ start + 14 (sanity check)

Response: `{ cycleState: CycleState }`

### `GET /api/client/cycle/status`

Auth: client session.

Returns: `CycleState` computed via `getCycleState`.

---

## UI Components

### `CyclePhasePill` (`components/client/cycle/CyclePhasePill.tsx`)

Small inline badge. DS v4.0 (gray scale — no glow, no colored shadows).

```
● Folliculaire · J8     ← calibrated
◐ Folliculaire · J8     ← estimated/learning
```

Phase colors (dot only, text stays `#e0e0e0`):
- menstrual  → `#c0392b`
- follicular → `#2d7a62`
- ovulatory  → `#9a8038`
- luteal     → `#8c5230`

Props: `phase, cycleDay, confidence, size?: 'sm' | 'md'`

### TopBar — Nutrition

File: `app/client/nutrition/NutritionClientPage.tsx`

Current: `<ClientTopBar section="Nutrition" title={date} right={dayTypeBadge} />`

New: pass `cyclePill` node in `right` slot alongside `dayTypeBadge` (stacked or inline depending on available space):
```
right={
  <div className="flex flex-col items-end gap-0.5">
    {dayTypeBadge}
    {cycleState?.currentPhase && <CyclePhasePill ... size="sm" />}
  </div>
}
```

Condition: `gender === 'female' && cycleState.hasActiveCycle && cycleState.currentPhase !== null`

`cycleState` fetched server-side in `app/client/nutrition/page.tsx` alongside existing data.

### TopBar — Programme

Files: `app/client/programme/ProgrammeClientPage.tsx` + `app/client/programme/session/[sessionId]/SessionLogger.tsx`

Same `CyclePhasePill` in the `right` slot of `ClientTopBar`. Fetched via `GET /api/client/cycle/status` on page load (client-side, lightweight).

### QuickLogSheet — "Cycle" action

File: `components/client/QuickLogSheet.tsx`

New action (conditional — only if `gender === 'female' && hasActiveCycle`):
```
Icon: Drop (red tint)
label: "Cycle"
sub: "Début ou fin de règles"
onClick: () => setSub("cycle")
```

Opens `LogPeriodSheet`.

`QuickLogSheet` fetches `GET /api/client/cycle/status` on mount to determine visibility. Result cached in component state.

### `LogPeriodSheet` (`components/client/cycle/LogPeriodSheet.tsx`)

Bottom sheet DS v4.0. Two sections:

**Section 1 — Début de règles**
- Button "Aujourd'hui" (primary, large) → POST `{ type: 'start', date: today }`
- Button "Autre date" → date picker → POST `{ type: 'start', date: selectedDate }`
- If conflict (409) → inline prompt "Un log existe déjà le {date}. Confirmer ?"

**Section 2 — Fin de règles** (shown if last log has no `period_end_date`)
- Button "Mes règles sont terminées" → POST `{ type: 'end', date: today }`

After success: show confirmation card with updated phase, dismiss after 2s or on tap.

### Profile — Cycle section

File: `app/client/profil/page.tsx` (in `ProfilAccordion`)

New `AccordionSection` "Mon Cycle" — visible only for `gender === 'female'`.

If `hasActiveCycle === false`:
```
Cycle sync désactivé
Ménopause / aménorrhée renseignée dans ton bilan.
```

If `hasActiveCycle === true`:
```
Phase actuelle: [CyclePhasePill]
Cycle moyen: {avgCycleLengthDays} jours  [{confidence badge}]
Dernier log: {lastPeriodDate formatted}  (ou "Aucun log encore")
[Bouton: Indiquer début de règles]
[Bouton: Mes règles sont terminées] (conditionnel)
```

### ProtocolRationale — extended

File: `components/client/smart/ProtocolRationale.tsx`

**New props:**
```ts
protocolDays: Array<{
  name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  carb_cycle_type?: string | null
}>
cycleState?: CycleState | null
activeDayName?: string | null
tdee: number | null
tdeeSource: string | null
bodyWeightKg?: number | null
```

**Rendering:** one accordion card per unique day type in `protocolDays`. Active day is expanded by default; others collapsed.

Each accordion content (timeline steps):
1. TDEE (if available)
2. Calorie target + delta label (surplus / déficit / maintenance)
3. Protein target (g + g/kg)
4. Carb/fat split + carb cycling label if `carb_cycle_type` is `'high'` or `'low'`
5. **[Female + hasActiveCycle only]** Cycle adjustment:
   - Title: "Ajustement Phase {phaseName}"
   - Shows `caloriesDelta`, `proteinDelta`, `carbsDelta` from `getCycleSyncAdjustment`
   - First note from `notes[]`
   - Badge "● Phase actuelle" if this phase matches `cycleState.currentPhase`

Section title: "Comprendre ton protocole" with sub-label "Tap sur une journée pour voir le détail".

---

## Nutrition Studio — Cycle as Second Source of Truth

File: `components/nutrition/studio/CalculationEngine.tsx` (+ `useNutritionStudio.ts`)

**Data flow:**
```
TDEE (source 1) → pre-calculated by engine
Cycle phase (source 2) → fetched via GET /api/clients/[clientId]/cycle/status (coach-facing)
Coach parameters → surplus/déficit/carb cycling iterated on top of both
```

**New coach-facing API: `GET /api/clients/[clientId]/cycle/status`**  
Auth: coach session, verifies client belongs to coach.  
Returns same `CycleState` as client-facing route.

**`useNutritionStudio` additions:**
- Fetch `CycleState` for client on load (alongside existing clientData fetch)
- Expose `cycleState` from hook

**`CalculationEngine.tsx` additions:**
- In the female-gated "Cycle Sync" section (already exists), replace the current static display with live `CycleState`:
  - Show current phase + `CyclePhasePill`
  - Show `confidence` badge + last log date
  - Show `avgCycleLengthDays` (e.g., "Cycle moyen calibré : 27 jours")
  - Show cycle adjustments for the current phase (caloriesDelta, carbsDelta, proteinDelta)
  - Note: adjustments are informational — coach applies them manually to the protocol parameters. The engine does not auto-apply.

**Real-time freshness:** coach sees the phase computed from the client's latest logs. When client logs a period start via FAB, the next time the coach opens Nutrition Studio the state is fresh.

---

## Data Flow Summary

```
Client logs period via FAB
  → POST /api/client/cycle/log
  → INSERT menstrual_cycle_logs
  → GET /api/client/cycle/status (returns updated CycleState)
  → CyclePhasePill updates on next page load

Coach opens Nutrition Studio
  → GET /api/clients/[clientId]/cycle/status
  → reads menstrual_cycle_logs (latest)
  → CycleState shown as source of truth 2
  → Coach sets protocol parameters (TDEE + cycle context)

Client views Nutrition tab
  → Server component fetches CycleState
  → CyclePhasePill in TopBar
  → CycleSyncBanner in Aujourd'hui tab
  → ProtocolRationale shows cycle step per day type

Client views Programme tab
  → Client-side fetch GET /api/client/cycle/status
  → CyclePhasePill in TopBar
```

---

## Migration

File: `supabase/migrations/20260526_menstrual_cycle_logs.sql`

```sql
CREATE TABLE menstrual_cycle_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_start_date date NOT NULL,
  period_end_date date NULL,
  computed_cycle_length_days int NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cycle_start UNIQUE (client_id, period_start_date)
);

CREATE INDEX idx_cycle_logs_client_date
  ON menstrual_cycle_logs(client_id, period_start_date DESC);

ALTER TABLE menstrual_cycle_logs ENABLE ROW LEVEL SECURITY;

-- Client: own rows
CREATE POLICY "client_own_cycle_logs"
  ON menstrual_cycle_logs FOR ALL
  USING (client_id = auth_client_id())
  WITH CHECK (client_id = auth_client_id());

-- Coach: read client rows
CREATE POLICY "coach_read_client_cycle_logs"
  ON menstrual_cycle_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients c
      JOIN coaches co ON co.id = c.coach_id
      WHERE c.id = menstrual_cycle_logs.client_id
        AND co.user_id = auth.uid()
    )
  );
```

**Apply manually via Supabase Dashboard SQL Editor.**

---

## Out of Scope (Phase 3)

- Period prediction (predicted next start date)
- Symptom logging (flow level, cramping, mood, energy)
- Coach-facing cycle insights dashboard
- i18n of cycle UI strings (FR only for now)
- Push notification "Règles prévues dans 2 jours"
