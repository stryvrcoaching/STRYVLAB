# Cycle Sync Activation — Design Spec

**Date:** 2026-05-27  
**Status:** Approved  
**Scope:** Nutrition Studio toggle + auto-applied macros + client PWA cycle UI

---

## Context

Cycle Sync exists as an informational layer only. Adjustments (lutéale +100 kcal, etc.) are visible to the coach in Nutrition Studio but never applied to the client's actual macro targets. This spec activates the full loop: coach enables cycle sync per protocol → client sees adjusted macros → history is logged.

---

## Architecture Decision

**Runtime calculation (Approach A)** — base macros stored unchanged in DB. Adjusted macros computed at API read time: `adjusted = base + getCycleSyncAdjustment(currentPhase)`. No stored macro copies, always fresh, phase changes propagate automatically.

History via `client_daily_checkins.cycle_phase + cycle_day` columns — logged at check-in time, enables coach analytics cross-referencing phase × performance × nutrition over time.

---

## 1. Data Model

### Migration A — `nutrition_protocols`

```sql
ALTER TABLE nutrition_protocols
ADD COLUMN cycle_sync_enabled BOOLEAN NOT NULL DEFAULT false;
```

Persisted when coach saves/updates protocol via existing API.

### Migration B — `client_daily_checkins`

```sql
ALTER TABLE client_daily_checkins
ADD COLUMN cycle_phase TEXT CHECK (
  cycle_phase IN ('follicular', 'ovulatory', 'luteal', 'menstrual')
),
ADD COLUMN cycle_day INT;
```

Populated best-effort at check-in time. Enables historical cross-referencing.

---

## 2. Coach Studio — Toggle

**File:** `components/nutrition/studio/CalculationEngine.tsx`  
**Pattern:** Same two-button toggle as Carb Cycling.

### Behavior

- Visible only when `isFemale && cycleState?.hasActiveCycle`
- If no cycle data → amber alert (already implemented): "La cliente doit renseigner depuis Profil → Mon Cycle"

**Disabled state:**
```
CYCLE SYNC (FEMME)
Ajustements macros automatiques par phase du cycle menstruel

  [ Désactivé ]  [ Activé — Ajustement auto ]
```
Only header + subtitle + toggle buttons visible.

**Enabled state:**
- Badge: "Actif — appliqué automatiquement" (green dot)
- Full 4-phase grid (already implemented: base + delta = result per card)
- "Cycle menstruel de la cliente" section with CyclePhasePill + current phase adjustments

### State

```ts
// in useNutritionStudio.ts
const [cycleSyncEnabled, setCycleSyncEnabled] = useState<boolean>(false)
```

Loaded from `existingProtocol.cycle_sync_enabled` on mount.  
Saved via `buildPayload()` → included in POST/PATCH to nutrition-protocols API.

### API changes

`app/api/clients/[clientId]/nutrition-protocols/route.ts` — add `cycle_sync_enabled` to Zod schema and insert/update query.

---

## 3. Client PWA — Adjusted Macros (Runtime)

**File:** `app/api/client/nutrition/route.ts` (or equivalent daily macro endpoint)

### Logic

```ts
const protocol = await getActiveProtocol(clientId)
const todayDay = resolveProtocolDay(protocol, today) // existing logic

let macros = { ...todayDay.baseMacros }

if (protocol.cycle_sync_enabled) {
  const cycleState = await getCycleState(clientId) // reuse existing function
  if (cycleState?.currentPhase) {
    const adj = getCycleSyncAdjustment(cycleState.currentPhase)
    macros.calories  += adj.caloriesDelta
    macros.protein_g += adj.proteinDelta
    macros.carbs_g   += adj.carbsDelta
    macros.fat_g     += adj.fatDelta
    macros.hydration_ml += adj.hydrationDeltaMl
  }
}

return macros
```

Fallback: if no cycle data → serve base macros unchanged (non-blocking).  
Client sees adjusted values transparently — no indication it is "adjusted" at the macro widget level.

---

## 4. Client PWA — Double Arc Gauge

**New component:** `components/client/cycle/CycleArcIndicator.tsx`  
**Replaces:** `CyclePhasePill` in TopBar of Nutrition + Programme pages.

### Visual

Two small SVG arcs (~28×28px each), side by side:

```
  ╭──╮  ╭──╮
 (  ● ) ( ○ )
  ╰──╯  ╰──╯
 Phase  Cycle
```

**Left arc** — progression within current phase:
- Color = phase color (purple for lutéale, green for folliculaire, etc.)
- Fill % = `(daysElapsedInPhase / phaseDuration) × 100`
- Example: lutéale J17–J28, today J21 → 4/12 = 33%

**Right arc** — progression within full cycle:
- Color = `rgba(255,255,255,0.4)` (neutral white)
- Fill % = `(currentCycleDay / avgCycleLength) × 100`
- Example: J21/28 = 75%

Below arcs: phase label + cycle day (e.g., "Lutéale · J21")

**Interaction:** entire component is clickable → opens `CyclePhaseModal`.

### Props

```ts
interface CycleArcIndicatorProps {
  phase: CyclePhase
  cycleDay: number
  avgCycleLength: number
  confidence: 'estimated' | 'learning' | 'calibrated'
  context: 'nutrition' | 'training'
}
```

---

## 5. Client PWA — Phase Modal

**New component:** `components/client/cycle/CyclePhaseModal.tsx`  
**Trigger:** tap on `CycleArcIndicator`

### Behavior

Framer Motion bottom sheet (z-[80]). Same sheet structure as other client modals.

### Content — static per phase × context

4 phases × 2 contexts = 8 content blocks, defined in `lib/client/cycle/phaseContent.ts`:

```ts
export const PHASE_CONTENT: Record<CyclePhase, Record<'nutrition' | 'training', PhaseContent>> = {
  luteal: {
    nutrition: {
      title: 'Phase lutéale',
      subtitle: 'J17–J28 · Besoins augmentés',
      body: [
        'Métabolisme légèrement accéléré (+5%). Tes besoins caloriques sont naturellement plus élevés.',
        'La rétention d\'eau peut masquer la progression sur la balance — normal.',
        'Privilégie les glucides complexes pour soutenir l\'énergie et limiter les fringales.',
      ],
      impact: 'Calories ↑ · Protéines ↑ · Glucides ↑ · Hydratation ↑',
    },
    training: { ... },
  },
  follicular: { ... },
  ovulatory: { ... },
  menstrual: { ... },
}
```

Modal header shows phase name + arc indicator (small version).  
3–4 bullet points max. No macros numbers (those are in Protocol section).

---

## 6. Client PWA — Protocol Section Enrichment

**File:** `components/client/smart/ProtocolRationale.tsx`  
**Existing:** per-day accordions with TDEE → calorie target → protein → carbs/fat steps.

### Addition (when `cycle_sync_enabled`)

New step added to each day accordion:

```
④ Cycle — Phase lutéale
   Ajustement automatique actif
   +100 kcal · +10g protéines · +20g glucides · +250ml
   ↓ Cible ajustée : 1 618 kcal
   Phase suivante dans 8j (ovulatoire)
```

- Step color = phase color
- If current phase has 0 delta (folliculaire/ovulatoire) → step shown with "Aucun ajustement cette phase — macros inchangées"
- `nextPhaseIn` from `cycleState`

### Required props additions

```ts
cycleSyncEnabled?: boolean
cycleState?: CycleState | null
```

---

## 7. Check-in Phase Logging

**File:** `app/api/client/checkin/route.ts`

After inserting check-in record, best-effort update:

```ts
// Non-blocking, does not affect checkin response
if (cycleState?.currentPhase && newCheckinId) {
  db.from('client_daily_checkins')
    .update({
      cycle_phase: cycleState.currentPhase,
      cycle_day:   cycleState.currentCycleDay,
    })
    .eq('id', newCheckinId)
    .then(() => {})
    .catch(() => {})
}
```

`cycleState` already computed server-side in check-in flow.

---

## 8. Out of Scope (Phase 2)

- Coach metrics page: phase × performance × stress cross-reference chart
- LLM-generated personalized phase guidance in modal
- Push notification on phase change
- "Cycle sync history" timeline view for coach

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/20260527_cycle_sync_enabled.sql` | New — 2 migrations |
| `components/nutrition/studio/CalculationEngine.tsx` | Add toggle UI |
| `components/nutrition/studio/useNutritionStudio.ts` | Add `cycleSyncEnabled` state |
| `app/api/clients/[clientId]/nutrition-protocols/route.ts` | Add field to schema + query |
| `app/api/client/nutrition/route.ts` | Runtime macro adjustment |
| `components/client/cycle/CycleArcIndicator.tsx` | New component |
| `components/client/cycle/CyclePhaseModal.tsx` | New component |
| `lib/client/cycle/phaseContent.ts` | New — static phase content |
| `app/client/nutrition/NutritionClientPage.tsx` | Swap pill → arc indicator |
| `app/client/programme/ProgrammeClientPage.tsx` | Swap pill → arc indicator |
| `components/client/smart/ProtocolRationale.tsx` | Add cycle step to accordion |
| `app/api/client/checkin/route.ts` | Log cycle_phase + cycle_day |
