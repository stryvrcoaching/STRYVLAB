# Plan — Nutrition Align Modal
**Spec:** `docs/superpowers/specs/2026-06-03-nutrition-align-modal-design.md`
**Date:** 2026-06-03
**Branch:** feat/nutrition-align-modal

---

## Steps

### Step 1 — Pure logic `lib/programs/nutritionAlign.ts`
No UI, no API calls. Testable in isolation.

**Exports:**
```ts
// Detect which protocol day = training vs rest using heuristic
detectDayRoles(days: NutritionProtocolDay[]): { trainingDayId: string|null, restDayId: string|null }

// Build schedule_slots from program sessions + role mapping
buildScheduleSlots(
  sessions: { days_of_week: number[] }[],
  trainingDayPosition: number,
  restDayPosition: number
): { week_index: number; dow: number; protocol_day_position: number }[]

// Compute macro delta for training days
computeMacroDelta(
  days: NutritionProtocolDay[],
  trainingDayId: string,
  clientData: NutritionClientData
): { trainingKcal: number; restKcal: number; delta: number } | null
```

Heuristic order: name regex → carb_cycle_type → null.

---

### Step 2 — `ClientProgramsList` — add `onRequestAlign` prop

- Add optional prop `onRequestAlign?: (program: Program) => void`
- In `toggleVisibility`: if `!program.is_client_visible` AND `onRequestAlign` provided → call `onRequestAlign(program)` instead of PATCH API
- If `onRequestAlign` not provided (backward compat) → existing behavior unchanged

---

### Step 3 — `EntrainementPage` — wire triggers + modal state

- Add state: `alignModalProgram: Program | null`, `alignSource: 'save' | 'toggle' | null`
- `onSaved(saved)`: if `saved.is_client_visible` → set `alignModalProgram = saved`, `alignSource = 'save'`; else close builder normally
- Pass `onRequestAlign` to `ClientProgramsList`: sets `alignModalProgram`, `alignSource = 'toggle'`
- Render `<NutritionAlignModal>` when `alignModalProgram !== null`
- `onClose/onConfirm` from modal: if `alignSource === 'save'` → close builder + refresh; if `alignSource === 'toggle'` → refresh list

---

### Step 4 — `NutritionAlignModal.tsx`

**Props:**
```ts
interface Props {
  clientId: string
  program: Program
  source: 'save' | 'toggle'
  onClose: () => void
  onConfirm: () => void
}
```

**Internal flow:**
1. Mount → fetch protocols + client data in parallel
2. Filter `status === 'shared'` → `activeProtocol`
3. If none → show "no active protocol" state + close button
4. Run `detectDayRoles(activeProtocol.days)` → set default selects
5. Render mapping selects + week preview (live-computed from selects)
6. Render macro recalc checkbox (disabled if `training_calories_weekly` or `weekly_frequency` null)
7. `Passer` → fire visibility PATCH if `source === 'toggle'` → `onClose()`
8. `Aligner`:
   - PATCH protocol with `schedule_slots` from `buildScheduleSlots`
   - If recalc checked → PATCH protocol days with updated calories
   - Fire visibility PATCH if `source === 'toggle'`
   - `onConfirm()`

**Week preview component** (inline in modal):
- 7 cells Mon–Sun (dow 1–7, display Mon first)
- training cell: `bg-[#1f8a65]/10`, dumbbell icon, day name + kcal
- rest cell: `bg-white/[0.04]`, moon icon, day name + kcal
- Updates on every select change (no API, pure derived state)

---

### Step 5 — TypeScript check + CHANGELOG

```bash
npx tsc --noEmit
```

Fix any errors. Update `CHANGELOG.md`.

---

## File map

| File | Action |
|------|--------|
| `lib/programs/nutritionAlign.ts` | CREATE |
| `components/programs/NutritionAlignModal.tsx` | CREATE |
| `components/programs/ClientProgramsList.tsx` | MODIFY — add `onRequestAlign` prop |
| `app/coach/clients/[clientId]/protocoles/entrainement/page.tsx` | MODIFY — state + modal render |
| `CHANGELOG.md` | UPDATE |

## APIs touched

All existing. No new routes, no migrations.

---

## Out of scope

- Ticket 2: per-session duration/intensity fields, advanced TDEE calc
- Unit tests for `nutritionAlign.ts` (add in follow-up if needed)
