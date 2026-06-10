# Cycle Sync Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Cycle Sync from informational to fully active — coach toggles it per protocol, client sees adjusted macros automatically, double-arc gauge appears in TopBar with phase modal.

**Architecture:** Runtime-only adjustment — protocol stores `cycle_sync_enabled` boolean, base macros unchanged in DB. Client nutrition page computes `target = base + getCycleSyncAdjustment(currentPhase)` at render time. Check-in route logs `cycle_phase` + `cycle_day` for historical cross-referencing.

**Tech Stack:** Next.js App Router (Server Components), Supabase direct queries, Framer Motion, SVG arcs, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260527_cycle_sync_enabled.sql` | Create | Add `cycle_sync_enabled` to `nutrition_protocols` + `cycle_phase`/`cycle_day` to `client_daily_checkins` |
| `lib/nutrition/types.ts` | Modify | Add `cycle_sync_enabled` to `NutritionProtocol` interface |
| `app/api/clients/[clientId]/nutrition-protocols/route.ts` | Modify | Add field to POST Zod schema + insert |
| `app/api/clients/[clientId]/nutrition-protocols/[protocolId]/route.ts` | Modify | Add field to PATCH Zod schema + update |
| `components/nutrition/studio/useNutritionStudio.ts` | Modify | Add `cycleSyncEnabled` state, load from existingProtocol, include in buildPayload |
| `components/nutrition/studio/CalculationEngine.tsx` | Modify | Add toggle UI + 2 new props |
| `components/nutrition/studio/NutritionStudio.tsx` | Modify | Pass new props to CalculationEngine |
| `app/client/nutrition/page.tsx` | Modify | Add `cycle_sync_enabled` to select query, apply runtime adjustment to `target` |
| `app/client/nutrition/NutritionClientPage.tsx` | Modify | Accept + forward `cycleSyncEnabled` prop |
| `components/client/smart/ProtocolRationale.tsx` | Modify | Gate cycle step on `cycleSyncEnabled`, use phase color, show adjusted totals |
| `lib/client/cycle/phaseContent.ts` | Create | Static phase guidance content (4 phases × 2 contexts) |
| `components/client/cycle/CycleArcIndicator.tsx` | Create | Double SVG arc component (phase progress + cycle progress) |
| `components/client/cycle/CyclePhaseModal.tsx` | Create | Framer Motion bottom sheet with phase guidance |
| `app/client/nutrition/NutritionClientPage.tsx` | Modify | Swap `CyclePhasePill` → `CycleArcIndicator` + wire modal |
| `app/client/programme/ProgrammeClientPage.tsx` | Modify | Swap `CyclePhasePill` → `CycleArcIndicator` + wire modal |
| `app/api/client/checkin/route.ts` | Modify | Log `cycle_phase` + `cycle_day` best-effort after upsert |

---

## Task 1: Database Migrations

**Files:**
- Create: `supabase/migrations/20260527_cycle_sync_enabled.sql`

- [ ] **Step 1: Write migration file**

```sql
-- supabase/migrations/20260527_cycle_sync_enabled.sql

-- 1. Add cycle sync toggle to nutrition protocols
ALTER TABLE nutrition_protocols
  ADD COLUMN IF NOT EXISTS cycle_sync_enabled BOOLEAN NOT NULL DEFAULT false;

-- 2. Add cycle phase history columns to daily checkins
ALTER TABLE client_daily_checkins
  ADD COLUMN IF NOT EXISTS cycle_phase TEXT CHECK (
    cycle_phase IN ('follicular', 'ovulatory', 'luteal', 'menstrual')
  ),
  ADD COLUMN IF NOT EXISTS cycle_day INT CHECK (cycle_day >= 1 AND cycle_day <= 35);
```

- [ ] **Step 2: Apply migration manually via Supabase Dashboard**

Open Supabase Dashboard → SQL Editor → paste and run the migration above.

- [ ] **Step 3: Verify columns exist**

Run in SQL Editor:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('nutrition_protocols', 'client_daily_checkins')
  AND column_name IN ('cycle_sync_enabled', 'cycle_phase', 'cycle_day')
ORDER BY table_name, column_name;
```
Expected: 3 rows returned.

- [ ] **Step 4: Commit migration file**

```bash
git add supabase/migrations/20260527_cycle_sync_enabled.sql
git commit -m "schema: add cycle_sync_enabled to nutrition_protocols + cycle_phase/cycle_day to client_daily_checkins"
```

---

## Task 2: Type + API Route Updates

**Files:**
- Modify: `lib/nutrition/types.ts`
- Modify: `app/api/clients/[clientId]/nutrition-protocols/route.ts`
- Modify: `app/api/clients/[clientId]/nutrition-protocols/[protocolId]/route.ts`

- [ ] **Step 1: Update NutritionProtocol type**

In `lib/nutrition/types.ts`, add `cycle_sync_enabled` to the interface:

```ts
export interface NutritionProtocol {
  id: string
  client_id: string
  coach_id: string
  name: string
  status: 'draft' | 'shared'
  notes: string | null
  schedule_start_date?: string | null
  cycle_sync_enabled: boolean        // ← ADD
  created_at: string
  updated_at: string
  days?: NutritionProtocolDay[]
  schedule_slots?: NutritionProtocolScheduleSlot[]
}
```

- [ ] **Step 2: Update POST route schema**

In `app/api/clients/[clientId]/nutrition-protocols/route.ts`, add field to `createSchema`:

```ts
const createSchema = z.object({
  name: z.string().min(1).max(200),
  notes: z.string().optional().nullable(),
  schedule_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cycle_sync_enabled: z.boolean().optional().default(false),  // ← ADD
  days: z.array(daySchema).min(1),
  schedule_slots: z.array(slotSchema).optional().default([]),
})
```

Then add to the Supabase insert (around line 103):
```ts
const { data: protocol, error: protoError } = await db
  .from('nutrition_protocols')
  .insert({
    client_id: clientId,
    coach_id: user.id,
    name: body.data.name,
    notes: body.data.notes ?? null,
    schedule_start_date: body.data.schedule_start_date ?? new Date().toISOString().slice(0, 10),
    cycle_sync_enabled: body.data.cycle_sync_enabled ?? false,  // ← ADD
  })
  .select('*')
  .single()
```

- [ ] **Step 3: Update PATCH route schema**

In `app/api/clients/[clientId]/nutrition-protocols/[protocolId]/route.ts`, add to `updateSchema`:

```ts
const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  notes: z.string().optional().nullable(),
  schedule_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cycle_sync_enabled: z.boolean().optional(),  // ← ADD
  days: z.array(updateDaySchema).optional(),
  schedule_slots: z.array(slotSchema).optional(),
})
```

Then add to the updates object (around line 101):
```ts
const updates: Record<string, unknown> = {}
if (body.data.name !== undefined) updates.name = body.data.name
if (body.data.notes !== undefined) updates.notes = body.data.notes
if (body.data.schedule_start_date !== undefined) updates.schedule_start_date = body.data.schedule_start_date
if (body.data.cycle_sync_enabled !== undefined) updates.cycle_sync_enabled = body.data.cycle_sync_enabled  // ← ADD
await db.from('nutrition_protocols').update(updates).eq('id', protocolId)
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "nutrition-protocols|types\.ts" | head -10
```
Expected: no output (0 errors in changed files).

- [ ] **Step 5: Commit**

```bash
git add lib/nutrition/types.ts \
  app/api/clients/\[clientId\]/nutrition-protocols/route.ts \
  app/api/clients/\[clientId\]/nutrition-protocols/\[protocolId\]/route.ts
git commit -m "feat(cycle-sync): add cycle_sync_enabled to protocol API routes and types"
```

---

## Task 3: Coach Studio — State + Toggle UI

**Files:**
- Modify: `components/nutrition/studio/useNutritionStudio.ts`
- Modify: `components/nutrition/studio/CalculationEngine.tsx`
- Modify: `components/nutrition/studio/NutritionStudio.tsx`

- [ ] **Step 1: Add cycleSyncEnabled state to useNutritionStudio**

In `useNutritionStudio.ts`, after the `carbCycling` state (around line 191), add:

```ts
const [cycleSyncEnabled, setCycleSyncEnabled] = useState<boolean>(false)
```

- [ ] **Step 2: Load from existingProtocol**

In the `useEffect` that loads `existingProtocol` (around line 334), add:

```ts
useEffect(() => {
  if (existingProtocol?.days?.length) {
    setDays(existingProtocol.days.map(dayDraftFromDb))
    setProtocolName(existingProtocol.name)
  }
  if (existingProtocol?.schedule_start_date) {
    setScheduleStartDate(existingProtocol.schedule_start_date)
  }
  if (existingProtocol?.schedule_slots) {
    setScheduleSlots(
      existingProtocol.schedule_slots.map((slot) => ({
        week_index: slot.week_index,
        dow: slot.dow,
        protocol_day_position: slot.protocol_day_position,
      }))
    )
  }
  if (existingProtocol?.cycle_sync_enabled !== undefined) {
    setCycleSyncEnabled(existingProtocol.cycle_sync_enabled)  // ← ADD
  }
}, [existingProtocol])
```

- [ ] **Step 3: Include in buildPayload**

In `buildPayload` (around line 683):

```ts
const buildPayload = useCallback(
  () => ({
    name: protocolName,
    schedule_start_date: scheduleStartDate,
    cycle_sync_enabled: cycleSyncEnabled,  // ← ADD
    schedule_slots: scheduleSlots
      .filter(...)
      .map(...),
    days: days.map(...),
  }),
  [protocolName, scheduleStartDate, scheduleSlots, days, cycleSyncEnabled],  // ← add to deps
)
```

- [ ] **Step 4: Add to return value of useNutritionStudio**

In the return object (around line 793):

```ts
return {
  // existing...
  carbCycling,
  setCarbCycling,
  cycleSyncEnabled,        // ← ADD
  setCycleSyncEnabled,     // ← ADD
  cycleState,
  // ...
}
```

- [ ] **Step 5: Add props to CalculationEngine interface**

In `CalculationEngine.tsx`, extend the `Props` interface (after line 54):

```ts
interface Props {
  // existing props...
  isFemale?: boolean
  currentCycleDay?: number | null
  baseMacrosForCycleSync?: NutritionMacros | null
  cycleState?: CycleState | null
  cycleSyncEnabled?: boolean           // ← ADD
  onCycleSyncEnabledChange?: (v: boolean) => void  // ← ADD
}
```

And in the function destructuring (around line 190):

```ts
  cycleSyncEnabled = false,
  onCycleSyncEnabledChange,
```

- [ ] **Step 6: Add toggle UI in CalculationEngine**

Find the Cycle Sync section (around line 595):

```tsx
{isFemale && (
  <div>
    <SectionDivider label="Cycle Sync (femme)" />

    {/* Toggle — same pattern as Carb Cycling */}
    <div className="flex gap-1.5 mb-3 flex-wrap">
      <button
        onClick={() => onCycleSyncEnabledChange?.(false)}
        className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
          !cycleSyncEnabled
            ? 'bg-white/[0.08] text-white/80'
            : 'text-white/30 hover:text-white/50'
        }`}
      >
        Désactivé
      </button>
      <button
        onClick={() => onCycleSyncEnabledChange?.(true)}
        className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors border ${
          cycleSyncEnabled
            ? 'bg-[#a855f7]/10 text-[#a855f7] border-[#a855f7]/30'
            : 'border-transparent text-white/30 hover:text-white/50'
        }`}
      >
        Activé — Ajustement auto
      </button>
    </div>

    {cycleSyncEnabled && (
      <div className="flex items-center gap-1.5 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" />
        <p className="text-[9px] text-[#a855f7]/80 uppercase tracking-[0.14em] font-semibold">
          Actif — appliqué automatiquement à la cliente
        </p>
      </div>
    )}

    {/* Existing content: CycleSyncPhaseGrid + cycle state section — wrap in cycleSyncEnabled check */}
    {cycleSyncEnabled && (
      <>
        <CycleSyncPhaseGrid
          baseMacros={baseMacrosForCycleSync}
          currentCycleDay={currentCycleDay}
        />
        <div className="mt-3 space-y-2">
          {/* existing cycle menstruel de la cliente section — unchanged */}
        </div>
      </>
    )}
  </div>
)}
```

- [ ] **Step 7: Pass new props from NutritionStudio**

In `NutritionStudio.tsx`, find where `CalculationEngine` is rendered and add:

```tsx
<CalculationEngine
  {/* existing props */}
  cycleSyncEnabled={cycleSyncEnabled}
  onCycleSyncEnabledChange={setCycleSyncEnabled}
/>
```

And destructure from `useNutritionStudio`:
```ts
const {
  // existing...
  cycleSyncEnabled,
  setCycleSyncEnabled,
} = useNutritionStudio(...)
```

- [ ] **Step 8: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "CalculationEngine|NutritionStudio|useNutritionStudio" | head -10
```
Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add components/nutrition/studio/useNutritionStudio.ts \
  components/nutrition/studio/CalculationEngine.tsx \
  components/nutrition/studio/NutritionStudio.tsx
git commit -m "feat(cycle-sync): add coach toggle UI — activate/deactivate cycle sync per protocol"
```

---

## Task 4: Runtime Macro Adjustment — Client Nutrition Page

**Files:**
- Modify: `app/client/nutrition/page.tsx`
- Modify: `app/client/nutrition/NutritionClientPage.tsx`

- [ ] **Step 1: Add cycle_sync_enabled to protocol select query**

In `page.tsx`, find the `protoResult` fetch (line 56-63). Update the select string:

```ts
svc()
  .from('nutrition_protocols')
  .select('cycle_sync_enabled, tdee_adaptive, tdee_data_source, schedule_start_date, nutrition_protocol_days(position, name, calories, protein_g, carbs_g, fat_g, hydration_ml, carb_cycle_type, cycle_sync_phase, recommendations), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
  .eq('client_id', clientId)
  .eq('status', 'shared')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle(),
```

- [ ] **Step 2: Extract cycleSyncEnabled from protoData**

After line 188 (after `tdeeDataSource` extraction), add:

```ts
const cycleSyncEnabled: boolean = (protoData as any)?.cycle_sync_enabled ?? false
```

- [ ] **Step 3: Change target from const to let**

Find line 200:
```ts
const target: NutritionMacros = {
```
Change to:
```ts
let target: NutritionMacros = {
  kcal:      Number(td?.calories     ?? 0),
  protein_g: Number(td?.protein_g    ?? 0),
  carbs_g:   Number(td?.carbs_g      ?? 0),
  fat_g:     Number(td?.fat_g        ?? 0),
  water_ml:  Number(td?.hydration_ml ?? 2500),
}
```

- [ ] **Step 4: Apply runtime cycle adjustment**

Immediately after the `target` declaration (after line 205), add:

```ts
// Runtime cycle sync adjustment — applied only when coach enabled it on this protocol
if (cycleSyncEnabled && cycleState?.currentPhase) {
  const adj = getCycleSyncAdjustment(cycleState.currentPhase)
  target = {
    kcal:      Math.max(0, target.kcal      + adj.caloriesDelta),
    protein_g: Math.max(0, target.protein_g + adj.proteinDelta),
    carbs_g:   Math.max(0, target.carbs_g   + adj.carbsDelta),
    fat_g:     Math.max(0, target.fat_g     + adj.fatDelta),
    water_ml:  Math.max(0, target.water_ml  + adj.hydrationDeltaMl),
  }
}
```

(Import `getCycleSyncAdjustment` from `@/lib/nutrition/engine/cycleSync` — already imported in page.tsx.)

- [ ] **Step 5: Pass cycleSyncEnabled as prop to NutritionClientPage**

In the `return` block (around line 351), add:

```tsx
<NutritionClientPage
  {/* existing props */}
  cycleSyncEnabled={cycleSyncEnabled}
/>
```

- [ ] **Step 6: Accept cycleSyncEnabled in NutritionClientPage**

In `NutritionClientPage.tsx`, find the Props interface and add:

```ts
cycleSyncEnabled?: boolean
```

And in the function destructuring:
```ts
cycleSyncEnabled = false,
```

- [ ] **Step 7: Forward cycleSyncEnabled to ProtocolRationale**

In `NutritionClientPage.tsx`, find where `ProtocolRationale` is rendered and add the prop:

```tsx
<ProtocolRationale
  {/* existing props */}
  cycleSyncEnabled={cycleSyncEnabled}
/>
```

- [ ] **Step 8: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "nutrition/page|NutritionClientPage" | head -10
```
Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add app/client/nutrition/page.tsx app/client/nutrition/NutritionClientPage.tsx
git commit -m "feat(cycle-sync): apply phase macro adjustment at runtime when cycle sync enabled"
```

---

## Task 5: ProtocolRationale — Gate on cycleSyncEnabled + Improved Step

**Files:**
- Modify: `components/client/smart/ProtocolRationale.tsx`

- [ ] **Step 1: Add cycleSyncEnabled to Props interface**

In `ProtocolRationale.tsx`, find the outer `Props` interface (line 19):

```ts
interface Props {
  protocolDays?: ProtocolDay[]
  tdee: number | null
  tdeeSource: string | null
  bodyWeightKg?: number | null
  activeDayName?: string | null
  cycleState?: CycleState | null
  cycleSyncEnabled?: boolean  // ← ADD
  target?: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }
  dayName?: string | null
}
```

- [ ] **Step 2: Add cycleSyncEnabled to DayAccordion props**

Find the `DayAccordion` function signature (line 42):

```ts
function DayAccordion({
  day,
  tdee,
  tdeeSource,
  bodyWeightKg,
  cycleState,
  cycleSyncEnabled,  // ← ADD
  defaultOpen,
}: {
  day: ProtocolDay
  tdee: number | null
  tdeeSource: string | null
  bodyWeightKg?: number | null
  cycleState?: CycleState | null
  cycleSyncEnabled?: boolean  // ← ADD
  defaultOpen: boolean
})
```

- [ ] **Step 3: Gate showCycle on cycleSyncEnabled**

In `DayAccordion`, find line 75:

```ts
const showCycle = !!(cycleState?.hasActiveCycle && cycleState.currentPhase)
```

Change to:

```ts
const showCycle = !!(cycleSyncEnabled && cycleState?.hasActiveCycle && cycleState.currentPhase)
```

- [ ] **Step 4: Improve cycle step — phase color + adjusted totals**

Find the cycle step push (lines 122-136). Replace with:

```ts
if (showCycle && cycleAdj) {
  const PHASE_COLORS: Record<string, string> = {
    follicular: '#22c55e',
    ovulatory:  '#fbbf24',
    luteal:     '#a855f7',
    menstrual:  '#ef4444',
  }
  const PHASE_NAMES: Record<string, string> = {
    menstrual:  'Menstruation',
    follicular: 'Folliculaire',
    ovulatory:  'Ovulation',
    luteal:     'Lutéale',
  }
  const phase = cycleState!.currentPhase!
  const phaseName = PHASE_NAMES[phase] ?? phase
  const phaseColor = PHASE_COLORS[phase] ?? '#a855f7'

  const hasDeltas = cycleAdj.caloriesDelta !== 0 || cycleAdj.proteinDelta !== 0 || cycleAdj.carbsDelta !== 0
  const deltaStr = hasDeltas
    ? [
        cycleAdj.caloriesDelta !== 0 ? `${cycleAdj.caloriesDelta > 0 ? '+' : ''}${cycleAdj.caloriesDelta} kcal` : null,
        cycleAdj.proteinDelta !== 0  ? `${cycleAdj.proteinDelta > 0 ? '+' : ''}${cycleAdj.proteinDelta}g P`    : null,
        cycleAdj.carbsDelta !== 0    ? `${cycleAdj.carbsDelta > 0 ? '+' : ''}${cycleAdj.carbsDelta}g G`        : null,
      ].filter(Boolean).join(' · ')
    : 'Aucun ajustement cette phase'

  const adjustedKcal = day.kcal + cycleAdj.caloriesDelta
  const nextPhaseLabel = cycleState!.nextPhaseIn != null
    ? ` — phase suivante dans ${cycleState!.nextPhaseIn}j`
    : ''

  steps.push({
    title: `Cycle — Phase ${phaseName}`,
    value: hasDeltas ? `${deltaStr} → ${Math.round(adjustedKcal)} kcal` : deltaStr,
    valueColor: phaseColor,
    body: `${cycleAdj.notes[0] ?? ''}${nextPhaseLabel}`,
  })
}
```

- [ ] **Step 5: Pass cycleSyncEnabled to DayAccordion in the render**

Find where `DayAccordion` is called in the component (around line 220):

```tsx
<DayAccordion
  key={...}
  day={day}
  tdee={tdee}
  tdeeSource={tdeeSource}
  bodyWeightKg={bodyWeightKg}
  cycleState={cycleState}
  cycleSyncEnabled={cycleSyncEnabled}  // ← ADD
  defaultOpen={...}
/>
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "ProtocolRationale" | head -5
```
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add components/client/smart/ProtocolRationale.tsx
git commit -m "feat(cycle-sync): ProtocolRationale cycle step gated on cycleSyncEnabled, shows phase color + adjusted kcal total"
```

---

## Task 6: Static Phase Content Library

**Files:**
- Create: `lib/client/cycle/phaseContent.ts`
- Create: `tests/lib/cycle/phaseContent.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/lib/cycle/phaseContent.test.ts
import { describe, it, expect } from 'vitest'
import { PHASE_CONTENT, type CycleContext } from '@/lib/client/cycle/phaseContent'

const PHASES = ['follicular', 'ovulatory', 'luteal', 'menstrual'] as const
const CONTEXTS: CycleContext[] = ['nutrition', 'training']

describe('PHASE_CONTENT', () => {
  it('has content for every phase × context combination', () => {
    for (const phase of PHASES) {
      for (const ctx of CONTEXTS) {
        const c = PHASE_CONTENT[phase][ctx]
        expect(c.title, `${phase}.${ctx}.title`).toBeTruthy()
        expect(c.subtitle, `${phase}.${ctx}.subtitle`).toBeTruthy()
        expect(c.bullets.length, `${phase}.${ctx}.bullets`).toBeGreaterThanOrEqual(2)
        expect(c.impact, `${phase}.${ctx}.impact`).toBeTruthy()
      }
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/cycle/phaseContent.test.ts 2>&1 | tail -10
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create phaseContent.ts**

```ts
// lib/client/cycle/phaseContent.ts
import type { CyclePhase } from '@/lib/cycle/cycleEngine'

export type CycleContext = 'nutrition' | 'training'

export interface PhaseContent {
  title: string
  subtitle: string
  bullets: string[]
  impact: string
}

export const PHASE_CONTENT: Record<CyclePhase, Record<CycleContext, PhaseContent>> = {
  follicular: {
    nutrition: {
      title: 'Phase folliculaire',
      subtitle: 'J6–J13 · Sensibilité à l\'insuline élevée',
      bullets: [
        'Tes glucides sont mieux utilisés pour l\'énergie et la récupération musculaire.',
        'Bonne période pour maintenir tes apports sans dépasser — la perte de gras est naturellement facilitée.',
        'Appétit souvent modéré. Écoute tes signaux de faim.',
      ],
      impact: 'Calories neutres · Glucides bien tolérés · Période optimale déficit',
    },
    training: {
      title: 'Phase folliculaire',
      subtitle: 'J6–J13 · Énergie en progression',
      bullets: [
        'Force et endurance s\'améliorent progressivement. Profite de cette fenêtre pour progresser.',
        'Récupération plus rapide entre les séances.',
        'Bonne phase pour augmenter les charges ou l\'intensité.',
      ],
      impact: 'Force ↑ · Récupération ↑ · Endurance ↑',
    },
  },
  ovulatory: {
    nutrition: {
      title: 'Phase ovulatoire',
      subtitle: 'J14–J16 · Performances maximales',
      bullets: [
        'Pic d\'œstrogènes — ton métabolisme est à son meilleur.',
        'Maintiens tes apports : c\'est ta meilleure période pour performer sans sur-manger.',
        'Hydratation normale suffisante.',
      ],
      impact: 'Calories neutres · Métabolisme optimal · Phase optimale déficit',
    },
    training: {
      title: 'Phase ovulatoire',
      subtitle: 'J14–J16 · Pic de performance',
      bullets: [
        'Force, coordination et explosivité au maximum.',
        'Idéal pour les PRs et les séances les plus intenses.',
        'Profite de cette fenêtre courte — elle dure 2 à 3 jours.',
      ],
      impact: 'Force max · Coordination ↑ · Énergie max',
    },
  },
  luteal: {
    nutrition: {
      title: 'Phase lutéale',
      subtitle: 'J17–J28 · Besoins augmentés',
      bullets: [
        'Métabolisme légèrement accéléré (+5%). Tes besoins caloriques sont naturellement plus élevés.',
        'La rétention d\'eau peut masquer la progression sur la balance — c\'est normal et temporaire.',
        'Privilégie les glucides complexes pour soutenir l\'énergie et limiter les fringales.',
      ],
      impact: 'Calories ↑ · Protéines ↑ · Glucides ↑ · Hydratation ↑',
    },
    training: {
      title: 'Phase lutéale',
      subtitle: 'J17–J28 · Énergie variable',
      bullets: [
        'Énergie plus variable selon les jours — écoute ton corps.',
        'Les séances modérées à intenses sont bien tolérées en début de phase.',
        'En fin de phase, privilégie la récupération active et la mobilité.',
      ],
      impact: 'Énergie variable · Récupération ↑ · Fin de phase : intensité ↓',
    },
  },
  menstrual: {
    nutrition: {
      title: 'Menstruation',
      subtitle: 'J1–J5 · Soutien et récupération',
      bullets: [
        'Besoins en fer augmentés — intègre des sources de fer héminique (viande rouge, lentilles).',
        'Oméga-3 anti-inflammatoires recommandés pour réduire les douleurs.',
        'Ne coupe pas les calories pendant cette phase — ton corps a besoin de ressources.',
      ],
      impact: 'Fer ↑ · Oméga-3 ↑ · Hydratation ↑ · Ne pas réduire les calories',
    },
    training: {
      title: 'Menstruation',
      subtitle: 'J1–J5 · Phase de récupération',
      bullets: [
        'Phase de récupération naturelle. Le mouvement léger est bénéfique.',
        'Favorise le yoga, le stretching et la mobilité plutôt que les séances lourdes.',
        'Si tu te sens bien, une séance modérée reste possible — écoute ton corps.',
      ],
      impact: 'Intensité ↓ · Mobilité ↑ · Récupération active recommandée',
    },
  },
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/cycle/phaseContent.test.ts 2>&1 | tail -10
```
Expected: PASS (8 combinations validated).

- [ ] **Step 5: Commit**

```bash
git add lib/client/cycle/phaseContent.ts tests/lib/cycle/phaseContent.test.ts
git commit -m "feat(cycle-sync): add static phase content library (4 phases × nutrition/training)"
```

---

## Task 7: CycleArcIndicator Component

**Files:**
- Create: `components/client/cycle/CycleArcIndicator.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/client/cycle/CycleArcIndicator.tsx
'use client'

import type { CyclePhase } from '@/lib/cycle/cycleEngine'

const PHASE_COLORS: Record<CyclePhase, string> = {
  follicular: '#22c55e',
  ovulatory:  '#fbbf24',
  luteal:     '#a855f7',
  menstrual:  '#ef4444',
}

const PHASE_LABELS: Record<CyclePhase, string> = {
  follicular: 'Folliculaire',
  ovulatory:  'Ovulation',
  luteal:     'Lutéale',
  menstrual:  'Règles',
}

// Phase boundaries based on standard 28-day cycle.
// For display purposes only — actual phase computed by cycleEngine.
function getPhaseProgress(
  phase: CyclePhase,
  cycleDay: number,
  avgCycleLength: number,
  menstrualLength: number,
): { elapsed: number; total: number } {
  const ovulationDay = Math.floor(avgCycleLength / 2)
  switch (phase) {
    case 'menstrual':  return { elapsed: cycleDay - 1,                  total: menstrualLength }
    case 'follicular': return { elapsed: cycleDay - menstrualLength - 1, total: ovulationDay - menstrualLength - 1 }
    case 'ovulatory':  return { elapsed: cycleDay - ovulationDay,        total: 2 }
    case 'luteal':     return { elapsed: cycleDay - (ovulationDay + 2),  total: avgCycleLength - ovulationDay - 2 }
  }
}

interface Arc {
  pct: number       // 0–1
  color: string
  label: string
}

function SvgArc({ pct, color, size = 22 }: { pct: number; color: string; size?: number }) {
  const r = (size - 4) / 2
  const cx = size / 2
  const circumference = 2 * Math.PI * r
  const filled = Math.max(0, Math.min(1, pct)) * circumference

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track */}
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={2.5}
      />
      {/* Progress arc — starts from top */}
      {filled > 0 && (
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform={`rotate(-90, ${cx}, ${cx})`}
        />
      )}
    </svg>
  )
}

interface Props {
  phase: CyclePhase
  cycleDay: number
  avgCycleLength?: number
  menstrualLength?: number
  confidence?: 'estimated' | 'learning' | 'calibrated'
  onClick?: () => void
}

export default function CycleArcIndicator({
  phase,
  cycleDay,
  avgCycleLength = 28,
  menstrualLength = 5,
  confidence,
  onClick,
}: Props) {
  const phaseColor = PHASE_COLORS[phase]
  const phaseLabel = PHASE_LABELS[phase]

  const { elapsed, total } = getPhaseProgress(phase, cycleDay, avgCycleLength, menstrualLength)
  const phasePct  = total > 0 ? Math.max(0, elapsed) / total : 0
  const cyclePct  = cycleDay / avgCycleLength

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-1 rounded-xl active:bg-white/[0.04] transition-colors"
    >
      <div className="flex items-center gap-1">
        {/* Arc 1: phase progress */}
        <SvgArc pct={phasePct} color={phaseColor} />
        {/* Arc 2: full cycle progress */}
        <SvgArc pct={cyclePct} color="rgba(255,255,255,0.35)" />
      </div>
      <div className="text-left">
        <p
          className="font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[10px] leading-tight"
          style={{ color: phaseColor }}
        >
          {phaseLabel}
        </p>
        <p className="text-[8px] text-white/30 leading-tight">
          J{cycleDay}/{avgCycleLength}
          {confidence === 'estimated' && ' ◐'}
        </p>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "CycleArcIndicator" | head -5
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/client/cycle/CycleArcIndicator.tsx
git commit -m "feat(cycle-sync): add CycleArcIndicator — double SVG arc showing phase + cycle progress"
```

---

## Task 8: CyclePhaseModal Component

**Files:**
- Create: `components/client/cycle/CyclePhaseModal.tsx`

- [ ] **Step 1: Write the modal component**

```tsx
// components/client/cycle/CyclePhaseModal.tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import type { CyclePhase } from '@/lib/cycle/cycleEngine'
import { PHASE_CONTENT, type CycleContext } from '@/lib/client/cycle/phaseContent'

const PHASE_COLORS: Record<CyclePhase, string> = {
  follicular: '#22c55e',
  ovulatory:  '#fbbf24',
  luteal:     '#a855f7',
  menstrual:  '#ef4444',
}

interface Props {
  open: boolean
  phase: CyclePhase
  cycleDay: number
  avgCycleLength?: number
  context: CycleContext
  onClose: () => void
}

export default function CyclePhaseModal({
  open,
  phase,
  cycleDay,
  avgCycleLength = 28,
  context,
  onClose,
}: Props) {
  const content = PHASE_CONTENT[phase][context]
  const color = PHASE_COLORS[phase]

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 bg-black/60 z-[79]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[80] bg-[#161616] rounded-t-2xl px-5 pt-4 pb-8 space-y-4"
            style={{ maxHeight: '88vh' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            {/* Handle */}
            <div className="w-8 h-1 rounded-full bg-white/10 mx-auto" />

            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <p
                  className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px]"
                  style={{ color }}
                >
                  {content.subtitle}
                </p>
                <p className="text-[20px] font-bold text-white leading-tight">{content.title}</p>
                <p className="text-[11px] text-white/40">J{cycleDay} sur {avgCycleLength}</p>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0"
              >
                <X size={13} className="text-white/50" />
              </button>
            </div>

            {/* Impact summary */}
            <div
              className="rounded-xl px-3 py-2 border-[0.3px]"
              style={{
                background: `${color}10`,
                borderColor: `${color}30`,
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40 mb-0.5">
                Impact {context === 'nutrition' ? 'nutritionnel' : 'entraînement'}
              </p>
              <p className="text-[11px] font-medium" style={{ color }}>{content.impact}</p>
            </div>

            {/* Bullets */}
            <div className="space-y-3">
              {content.bullets.map((bullet, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                    style={{ background: color }}
                  />
                  <p className="text-[13px] text-white/70 leading-relaxed">{bullet}</p>
                </div>
              ))}
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
npx tsc --noEmit 2>&1 | grep "CyclePhaseModal" | head -5
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/client/cycle/CyclePhaseModal.tsx
git commit -m "feat(cycle-sync): add CyclePhaseModal — static phase guidance bottom sheet (nutrition/training contexts)"
```

---

## Task 9: Wire Arc Indicator into Client PWA TopBars

**Files:**
- Modify: `app/client/nutrition/NutritionClientPage.tsx`
- Modify: `app/client/programme/ProgrammeClientPage.tsx`

- [ ] **Step 1: Update NutritionClientPage — swap pill for arc + add modal**

In `NutritionClientPage.tsx`:

1. Replace the `CyclePhasePill` dynamic import with `CycleArcIndicator` and `CyclePhaseModal`:

```ts
import dynamic from 'next/dynamic'
const CycleArcIndicator = dynamic(() => import('@/components/client/cycle/CycleArcIndicator'), { ssr: false })
const CyclePhaseModal   = dynamic(() => import('@/components/client/cycle/CyclePhaseModal'),   { ssr: false })
```

2. Add modal state:

```ts
const [cycleModalOpen, setCycleModalOpen] = useState(false)
```

3. Replace the TopBar `CyclePhasePill` render (around line 86-91):

```tsx
{/* BEFORE: */}
{cycleState?.currentPhase && cycleState.currentCycleDay && (
  <CyclePhasePill
    phase={cycleState.currentPhase}
    cycleDay={cycleState.currentCycleDay}
    confidence={cycleState.confidence}
    size="md"
  />
)}

{/* AFTER: */}
{cycleState?.currentPhase && cycleState.currentCycleDay && (
  <>
    <CycleArcIndicator
      phase={cycleState.currentPhase}
      cycleDay={cycleState.currentCycleDay}
      avgCycleLength={cycleState.avgCycleLengthDays}
      menstrualLength={cycleState.menstrualPhaseLengthDays}
      confidence={cycleState.confidence}
      onClick={() => setCycleModalOpen(true)}
    />
    <CyclePhaseModal
      open={cycleModalOpen}
      phase={cycleState.currentPhase}
      cycleDay={cycleState.currentCycleDay}
      avgCycleLength={cycleState.avgCycleLengthDays}
      context="nutrition"
      onClose={() => setCycleModalOpen(false)}
    />
  </>
)}
```

- [ ] **Step 2: Update ProgrammeClientPage — same swap**

In `ProgrammeClientPage.tsx`:

1. Replace `CyclePhasePill` import with dynamic imports for `CycleArcIndicator` + `CyclePhaseModal`.

2. Add modal state: `const [cycleModalOpen, setCycleModalOpen] = useState(false)`

3. Replace pill render (around line 198-203):

```tsx
{cycleState?.currentPhase && cycleState.currentCycleDay && (
  <>
    <CycleArcIndicator
      phase={cycleState.currentPhase}
      cycleDay={cycleState.currentCycleDay}
      avgCycleLength={cycleState.avgCycleLengthDays}
      menstrualLength={cycleState.menstrualPhaseLengthDays}
      confidence={cycleState.confidence}
      onClick={() => setCycleModalOpen(true)}
    />
    <CyclePhaseModal
      open={cycleModalOpen}
      phase={cycleState.currentPhase}
      cycleDay={cycleState.currentCycleDay}
      avgCycleLength={cycleState.avgCycleLengthDays}
      context="training"
      onClose={() => setCycleModalOpen(false)}
    />
  </>
)}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "NutritionClientPage|ProgrammeClientPage" | head -10
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/client/nutrition/NutritionClientPage.tsx app/client/programme/ProgrammeClientPage.tsx
git commit -m "feat(cycle-sync): replace CyclePhasePill with CycleArcIndicator + modal in Nutrition and Programme TopBars"
```

---

## Task 10: Check-in Phase Logging

**Files:**
- Modify: `app/api/client/checkin/route.ts`

- [ ] **Step 1: Add import for cycle engine**

At the top of `checkin/route.ts`, add:

```ts
import { getCycleStateFromLogs } from '@/lib/cycle/cycleEngine'
import type { CycleLog } from '@/lib/cycle/cycleEngine'
```

- [ ] **Step 2: Add best-effort cycle phase logging after checkin upsert**

Find the block after `if (checkinError)` check (around line 210). After the error check, add:

```ts
// Log cycle phase for historical analytics — best-effort, non-blocking
;(async () => {
  try {
    const { data: cycleLogs } = await db
      .from('menstrual_cycle_logs')
      .select('period_start_date, period_end_date, computed_cycle_length_days')
      .eq('client_id', cc.id)
      .order('period_start_date', { ascending: false })
      .limit(7)

    const cs = getCycleStateFromLogs((cycleLogs ?? []) as CycleLog[], null)
    if (cs.currentPhase && cs.currentCycleDay) {
      await db
        .from('client_daily_checkins')
        .update({ cycle_phase: cs.currentPhase, cycle_day: cs.currentCycleDay })
        .eq('client_id', cc.id)
        .eq('date', date)
        .eq('flow_type', flow_type)
    }
  } catch {
    // non-blocking — checkin already saved
  }
})()
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep "checkin/route" | head -5
```
Expected: no output.

- [ ] **Step 4: Update CHANGELOG**

In `CHANGELOG.md`, add under today's date:

```
FEATURE: Cycle Sync Activation — protocol-level toggle, runtime macro adjustment, double-arc TopBar gauge, phase modal (nutrition/training contexts), ProtocolRationale cycle step, check-in phase logging
SCHEMA: cycle_sync_enabled on nutrition_protocols, cycle_phase + cycle_day on client_daily_checkins
```

- [ ] **Step 5: Update project-state.md**

In `.claude/rules/project-state.md`, update:
- Cycle Sync v2 entry → mark cycle sync activation complete
- Check the next steps: check off "Cycle Sync v2" items, add new next step for coach metrics cross-referencing (Phase 2)

- [ ] **Step 6: Final TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "^tests/" | grep "error" | head -20
```
Expected: no errors in source files.

- [ ] **Step 7: Commit**

```bash
git add app/api/client/checkin/route.ts CHANGELOG.md .claude/rules/project-state.md
git commit -m "feat(cycle-sync): log cycle_phase + cycle_day on check-in for historical analytics"
```

---

## Self-Review Notes

- Task 1 (migration) must be applied manually via Supabase Dashboard before Tasks 2–10 will work end-to-end
- `resolveProtocol` uses `*` wildcard — `cycle_sync_enabled` auto-returned once column exists; no query change needed there
- `getCycleSyncAdjustment` is already tested (20 Vitest PASS); phaseContent tests cover all 8 content blocks
- `CyclePhaseModal` context `'nutrition'` vs `'training'` is passed at render site — no runtime detection needed
- Phase arc progress calculation in `CycleArcIndicator.getPhaseProgress` may show negative `elapsed` for edge-case cycle days (e.g., J1 in follicular) — `Math.max(0, elapsed)` clamp in `SvgArc` handles this
- `cycleSyncEnabled` in `NutritionClientPage` defaults to `false` — safe for existing clients without the flag
