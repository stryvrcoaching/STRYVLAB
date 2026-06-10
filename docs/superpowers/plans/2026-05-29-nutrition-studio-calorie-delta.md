# Nutrition Studio — Calorie Delta Badge + TDEE-Relative Slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a TDEE delta badge to MacroSliders and make the calorie slider TDEE-relative (0 = TDEE always), with goal buttons auto-moving the slider to smart body-fat-stratified presets.

**Architecture:** Change `calorieAdjustPct` semantics from "% on top of goal factor" to "% vs TDEE directly". Export a `computeSmartPreset` helper from macros.ts. Wire bidirectional sync between macro sliders and the calorie slider via a derived `displayCaloriePct` in CalculationEngine.

**Tech Stack:** TypeScript strict, React, Vitest (tests in `tests/lib/nutrition/`)

---

## File Map

| File | Change |
|------|--------|
| `lib/formulas/macros.ts` | Add `computeSmartPreset` export (append at end of file) |
| `tests/lib/nutrition/smartPreset.test.ts` | New test file |
| `components/nutrition/studio/useNutritionStudio.ts` | Change `recalculate()` calorie logic + add `setGoalWithPreset` + init preset on load |
| `components/nutrition/studio/CalorieAdjustmentDisplay.tsx` | Add `readOnly?: boolean` prop |
| `components/nutrition/studio/MacroSliders.tsx` | Add `tdee?: number | null` prop + TDEE delta badge, remove `calcCalories` prop |
| `components/nutrition/studio/CalculationEngine.tsx` | Compute `displayCaloriePct` + `anyMacroOverride`, pass to sub-components |
| `components/nutrition/studio/NutritionStudio.tsx` | Change `onGoalChange` to `studio.setGoalWithPreset` |

---

## Task 1: Export `computeSmartPreset` from macros.ts

**Files:**
- Modify: `lib/formulas/macros.ts` (append after line 752, end of file)
- Create: `tests/lib/nutrition/smartPreset.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/nutrition/smartPreset.test.ts
import { describe, it, expect } from 'vitest'
import { computeSmartPreset } from '@/lib/formulas/macros'

describe('computeSmartPreset', () => {
  describe('maintenance', () => {
    it('returns 0 regardless of BF', () => {
      expect(computeSmartPreset('maintenance', 15, 3)).toBe(0)
      expect(computeSmartPreset('maintenance', null, 5)).toBe(0)
      expect(computeSmartPreset('maintenance', 35, 0)).toBe(0)
    })
  })

  describe('deficit', () => {
    it('returns -30 for BF > 30%', () => {
      expect(computeSmartPreset('deficit', 31, 3)).toBe(-30)
      expect(computeSmartPreset('deficit', 35, 0)).toBe(-30)
    })
    it('returns -25 for BF 25–30%', () => {
      expect(computeSmartPreset('deficit', 26, 3)).toBe(-25)
      expect(computeSmartPreset('deficit', 30, 2)).toBe(-25)
    })
    it('returns -20 for BF 20–25%', () => {
      expect(computeSmartPreset('deficit', 22, 3)).toBe(-20)
    })
    it('returns -15 for BF 15–20%', () => {
      expect(computeSmartPreset('deficit', 17, 3)).toBe(-15)
    })
    it('returns -12 for BF <= 15%', () => {
      expect(computeSmartPreset('deficit', 12, 3)).toBe(-12)
      expect(computeSmartPreset('deficit', 15, 3)).toBe(-12)
    })
    it('attenuates +3 for freq >= 5 (high volume)', () => {
      expect(computeSmartPreset('deficit', 17, 5)).toBe(-12)  // -15 + 3
      expect(computeSmartPreset('deficit', 22, 5)).toBe(-17)  // -20 + 3
    })
    it('floors attenuation at -10% for lean high-frequency athletes', () => {
      expect(computeSmartPreset('deficit', 12, 5)).toBe(-10)  // -12 + 3 = -9, floor at -10
      expect(computeSmartPreset('deficit', 10, 6)).toBe(-10)
    })
    it('defaults to BF 20 when null, returning -15', () => {
      expect(computeSmartPreset('deficit', null, 3)).toBe(-15)
    })
  })

  describe('surplus', () => {
    it('returns +10 for BF < 10%', () => {
      expect(computeSmartPreset('surplus', 9, 3)).toBe(10)
    })
    it('returns +8 for BF 10–13%', () => {
      expect(computeSmartPreset('surplus', 11, 3)).toBe(8)
    })
    it('returns +7 for BF 13–16%', () => {
      expect(computeSmartPreset('surplus', 14, 3)).toBe(7)
    })
    it('returns +5 for BF 16–20%', () => {
      expect(computeSmartPreset('surplus', 18, 3)).toBe(5)
    })
    it('returns +4 for BF >= 20%', () => {
      expect(computeSmartPreset('surplus', 22, 3)).toBe(4)
      expect(computeSmartPreset('surplus', 30, 3)).toBe(4)
    })
    it('defaults to BF 20 when null, returning +4', () => {
      expect(computeSmartPreset('surplus', null, 3)).toBe(4)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/nutrition/smartPreset.test.ts
```

Expected: FAIL — `computeSmartPreset is not a function` or similar import error.

- [ ] **Step 3: Implement `computeSmartPreset` in macros.ts**

Append this function **after** the closing `}` of `calculateMacros` (after line 752):

```typescript
/**
 * Returns the default calorieAdjustPct (% vs TDEE) for a given goal.
 * Mirrors BF-stratified deficit logic from calculateMacros.
 * Used to auto-move the calorie slider when coach clicks a goal button.
 */
export function computeSmartPreset(
  goal: MacroGoal,
  bodyFat: number | null,
  weeklyFrequency: number,
): number {
  if (goal === 'maintenance') return 0
  const bf = bodyFat ?? 20
  if (goal === 'deficit') {
    let pct =
      bf > 30 ? -30 :
      bf > 25 ? -25 :
      bf > 20 ? -20 :
      bf > 15 ? -15 : -12
    if (weeklyFrequency >= 5) pct = Math.max(-10, pct + 3)
    return pct
  }
  // surplus — expressed as % (approximates fixed-kcal presets at typical TDEE)
  return bf < 10 ? 10 : bf < 13 ? 8 : bf < 16 ? 7 : bf < 20 ? 5 : 4
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/lib/nutrition/smartPreset.test.ts
```

Expected: All 13 tests PASS.

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/formulas/macros.ts tests/lib/nutrition/smartPreset.test.ts
git commit -m "feat(nutrition-studio): export computeSmartPreset BF-stratified helper"
```

---

## Task 2: Update `useNutritionStudio.ts` — TDEE-relative calorie semantics

**Files:**
- Modify: `components/nutrition/studio/useNutritionStudio.ts`

Three changes: (a) calorie computation in `recalculate()`, (b) `setGoalWithPreset`, (c) initial preset on client data load.

- [ ] **Step 1: Add import for `computeSmartPreset`**

At the top of `useNutritionStudio.ts`, find the macros import (around line 7):

```typescript
import {
  calculateMacros,
  type MacroGoal,
  type MacroGender,
  type MacroResult,
} from "@/lib/formulas/macros";
```

Replace with:

```typescript
import {
  calculateMacros,
  computeSmartPreset,
  type MacroGoal,
  type MacroGender,
  type MacroResult,
} from "@/lib/formulas/macros";
```

- [ ] **Step 2: Change calorie computation in `recalculate()`**

Find this block (around lines 366–377):

```typescript
      // Store calories after goal factor, before manual adjustment — used by slider display
      const caloriesAfterGoal = result.calories;
      setGoalCalories(caloriesAfterGoal);
      if (calorieAdjustPct !== 0) {
        const factor = 1 + calorieAdjustPct / 100;
        result.calories = Math.round(result.calories * factor);
        // Carbs absorb the calorie delta when only the % slider moves (no macro overrides)
        if (!macroOverrides.protein_g && !macroOverrides.fat_g && !macroOverrides.carbs_g) {
          const remaining = result.calories - result.macros.p * 4 - result.macros.f * 9;
          result.macros.c = Math.max(0, Math.round(remaining / 4));
        }
      }
```

Replace with:

```typescript
      // TDEE is the reference — slider 0 = TDEE always
      const tdee = result.tdee;
      setGoalCalories(tdee);
      const targetCal = Math.round(tdee * (1 + calorieAdjustPct / 100));
      result.calories = targetCal;
      // Carbs absorb delta when not manually overridden
      if (!macroOverrides.carbs_g) {
        const remaining = targetCal - result.macros.p * 4 - result.macros.f * 9;
        result.macros.c = Math.max(0, Math.round(remaining / 4));
      }
```

- [ ] **Step 3: Add `setGoalWithPreset` callback**

Find the `const [goal, setGoal]` and `const [calorieAdjustPct, setCalorieAdjustPct]` declarations (around lines 139–140). After those two state declarations, add:

```typescript
  const setGoalWithPreset = useCallback(
    (newGoal: MacroGoal) => {
      setGoal(newGoal);
      const bf =
        biometricsConfig.body_fat_pct ?? clientData?.body_fat_pct ?? null;
      setCalorieAdjustPct(
        computeSmartPreset(newGoal, bf, trainingConfig.weeklyFrequency),
      );
    },
    [
      biometricsConfig.body_fat_pct,
      clientData?.body_fat_pct,
      trainingConfig.weeklyFrequency,
    ],
  );
```

- [ ] **Step 4: Set initial preset on client data load**

Find the goal-mapping block in the client data fetch effect (around lines 254–258):

```typescript
        if (cd.training_goal) {
          const mapped =
            CLIENT_GOAL_MAP[cd.training_goal.toLowerCase()] ?? "maintenance";
          setGoal(mapped);
        }
```

Replace with:

```typescript
        if (cd.training_goal) {
          const mapped =
            CLIENT_GOAL_MAP[cd.training_goal.toLowerCase()] ?? "maintenance";
          setGoal(mapped);
          setCalorieAdjustPct(
            computeSmartPreset(
              mapped,
              cd.body_fat_pct ?? null,
              cd.weekly_frequency ?? 0,
            ),
          );
        }
```

- [ ] **Step 5: Export `setGoalWithPreset` from the hook**

Find the `return {` block (around line 702). Find `setGoal,` in the return object and add `setGoalWithPreset` after it:

```typescript
    goal,
    setGoal,
    setGoalWithPreset,
    calorieAdjustPct,
```

- [ ] **Step 6: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors. Fix any type errors before continuing.

- [ ] **Step 7: Commit**

```bash
git add components/nutrition/studio/useNutritionStudio.ts
git commit -m "feat(nutrition-studio): calorieAdjustPct is now % vs TDEE + setGoalWithPreset"
```

---

## Task 3: Add `readOnly` prop to `CalorieAdjustmentDisplay`

**Files:**
- Modify: `components/nutrition/studio/CalorieAdjustmentDisplay.tsx`

- [ ] **Step 1: Add `readOnly` to the props interface**

Find the interface at the top of the file:

```typescript
interface CalorieAdjustmentDisplayProps {
  value: number           // -30 to +30
  baseCalories: number | null  // calories after goal factor, before adjustment (slider base)
  targetCalories: number | null // final calories (after goal + adjustment, from macroResult)
  onChange: (v: number) => void
}
```

Replace with:

```typescript
interface CalorieAdjustmentDisplayProps {
  value: number           // -30 to +30 — % vs TDEE directly (0 = TDEE)
  baseCalories: number | null  // TDEE reference
  targetCalories: number | null // final effective calories
  onChange: (v: number) => void
  readOnly?: boolean      // true when macro overrides are active — slider shows position but is non-interactive
}
```

- [ ] **Step 2: Destructure `readOnly` in the component function**

Find:

```typescript
export default function CalorieAdjustmentDisplay({
  value,
  baseCalories,
  targetCalories,
  onChange,
}: CalorieAdjustmentDisplayProps) {
```

Replace with:

```typescript
export default function CalorieAdjustmentDisplay({
  value,
  baseCalories,
  targetCalories,
  onChange,
  readOnly = false,
}: CalorieAdjustmentDisplayProps) {
```

- [ ] **Step 3: Apply `readOnly` to the slider input**

Find the `<input type="range"` element (around line 105). Replace it with:

```tsx
        <input
          type="range"
          min="-30"
          max="30"
          step="1"
          value={value}
          onChange={e => !readOnly && onChange(parseInt(e.target.value))}
          className="kcal-slider w-full h-1.5 rounded-full outline-none appearance-none cursor-pointer"
          style={{
            '--kcal-thumb-color': color,
            background: trackBg,
            ...(readOnly ? { pointerEvents: 'none' as const, opacity: 0.55 } : {}),
          } as React.CSSProperties}
        />
```

- [ ] **Step 4: Add readOnly label below the markers**

After the closing `</div>` of the markers block (after the `{KCAL_MARKERS.map(...)}`  `</div>`), add:

```tsx
      {readOnly && (
        <p className="text-[9px] text-white/25 mt-1">
          Macros manuels — ajustez via Reset auto pour reprendre le contrôle
        </p>
      )}
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/nutrition/studio/CalorieAdjustmentDisplay.tsx
git commit -m "feat(nutrition-studio): CalorieAdjustmentDisplay readOnly prop"
```

---

## Task 4: Add TDEE delta badge to `MacroSliders`

**Files:**
- Modify: `components/nutrition/studio/MacroSliders.tsx`

Two changes: (a) add `tdee` prop, remove `calcCalories` prop, (b) replace old calorieDelta badge with TDEE delta badge.

- [ ] **Step 1: Update the props interface**

Find the `MacroSlidersProps` interface (around lines 13–27):

```typescript
interface MacroSlidersProps {
  // Calculated values from engine (always present when macroResult exists)
  calcProtein: number
  calcFat: number
  calcCarbs: number
  calcCalories: number

  // Manual overrides (null = auto)
  overrides: MacroOverrides
  onOverridesChange: (overrides: MacroOverrides) => void

  // LBM for g/kg ratio display
  leanMass?: number | null
  bodyWeight?: number | null
}
```

Replace with:

```typescript
interface MacroSlidersProps {
  calcProtein: number
  calcFat: number
  calcCarbs: number

  overrides: MacroOverrides
  onOverridesChange: (overrides: MacroOverrides) => void

  leanMass?: number | null
  bodyWeight?: number | null
  tdee?: number | null   // TDEE for delta badge — always pass from macroResult.tdee
}
```

- [ ] **Step 2: Update the function signature**

Find:

```typescript
export default function MacroSliders({
  calcProtein,
  calcFat,
  calcCarbs,
  calcCalories,
  overrides,
  onOverridesChange,
  leanMass,
  bodyWeight,
}: MacroSlidersProps) {
```

Replace with:

```typescript
export default function MacroSliders({
  calcProtein,
  calcFat,
  calcCarbs,
  overrides,
  onOverridesChange,
  leanMass,
  bodyWeight,
  tdee,
}: MacroSlidersProps) {
```

- [ ] **Step 3: Remove `calorieDelta` and compute TDEE delta instead**

Find line 123:

```typescript
  const calorieDelta = effectiveCalories - calcCalories
```

Replace with:

```typescript
  const tdeeDelta = tdee != null ? effectiveCalories - tdee : null
  const tdeeDeltaColor =
    tdeeDelta == null                    ? 'rgba(255,255,255,0.4)'
    : tdeeDelta / tdee! < -0.15         ? '#f87171'
    : tdeeDelta / tdee! < 0             ? '#fb923c'
    : tdeeDelta / tdee! === 0           ? 'rgba(255,255,255,0.4)'
    : tdeeDelta / tdee! <= 0.15         ? '#1f8a65'
    :                                     '#0f7d4a'
```

- [ ] **Step 4: Replace the calorie header section**

Find the entire header block (lines 128–149):

```tsx
      {/* Calorie total header */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[22px] font-black text-white tabular-nums leading-none">
            {effectiveCalories.toLocaleString('fr-FR')}
          </span>
          <span className="text-[11px] text-white/40">kcal</span>
        </div>
        <div className="flex items-center gap-2">
          {anyManual && calorieDelta !== 0 && (
            <span className={`text-[11px] font-semibold tabular-nums ${calorieDelta > 0 ? 'text-[#5dba87]' : 'text-amber-400'}`}>
              {calorieDelta > 0 ? '+' : ''}{calorieDelta}
            </span>
          )}
          {anyManual && (
            <button
              onClick={resetAll}
              className="text-[9px] text-white/30 hover:text-white/60 transition-colors px-1.5 py-0.5 rounded bg-white/[0.04] border-[0.3px] border-white/[0.06]"
            >
              Reset auto
            </button>
          )}
        </div>
      </div>
```

Replace with:

```tsx
      {/* Calorie total header */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[22px] font-black text-white tabular-nums leading-none">
            {effectiveCalories.toLocaleString('fr-FR')}
          </span>
          <span className="text-[11px] text-white/40">kcal</span>
          {tdeeDelta != null && (
            <span
              className="text-[11px] font-semibold tabular-nums"
              style={{ color: tdeeDeltaColor }}
            >
              {tdeeDelta > 0 ? '+' : ''}{tdeeDelta} kcal
            </span>
          )}
        </div>
        {anyManual && (
          <button
            onClick={resetAll}
            className="text-[9px] text-white/30 hover:text-white/60 transition-colors px-1.5 py-0.5 rounded bg-white/[0.04] border-[0.3px] border-white/[0.06]"
          >
            Reset auto
          </button>
        )}
      </div>
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 errors (or only errors from CalculationEngine passing the old `calcCalories` prop — fixed in Task 5).

- [ ] **Step 6: Commit**

```bash
git add components/nutrition/studio/MacroSliders.tsx
git commit -m "feat(nutrition-studio): MacroSliders TDEE delta badge"
```

---

## Task 5: Wire `CalculationEngine` — `displayCaloriePct`, `readOnly`, `tdee`

**Files:**
- Modify: `components/nutrition/studio/CalculationEngine.tsx`

Three wiring changes: (a) compute `anyMacroOverride` + `displayCaloriePct`, (b) pass `readOnly` + corrected `value` to `CalorieAdjustmentDisplay`, (c) pass `tdee` to `MacroSliders` and remove `calcCalories`.

- [ ] **Step 1: Compute derived calorie display values**

Find the start of the `CalculationEngine` function body (after the props destructuring, around line 176). After `const [openInfoModal, setOpenInfoModal] = useState<string | null>(null);`, add:

```typescript
  const anyMacroOverride =
    macroOverrides.protein_g !== null ||
    macroOverrides.fat_g !== null ||
    macroOverrides.carbs_g !== null

  const displayCaloriePct =
    anyMacroOverride && macroResult
      ? Math.max(
          -30,
          Math.min(
            30,
            Math.round(
              ((macroResult.calories - macroResult.tdee) / macroResult.tdee) * 100,
            ),
          ),
        )
      : calorieAdjustPct
```

- [ ] **Step 2: Update `CalorieAdjustmentDisplay` props**

Find the `<CalorieAdjustmentDisplay` usage (around lines 304–311):

```tsx
            <CalorieAdjustmentDisplay
              value={calorieAdjustPct}
              baseCalories={goalCalories}
              targetCalories={macroResult.calories}
              onChange={onCalorieAdjustChange}
            />
```

Replace with:

```tsx
            <CalorieAdjustmentDisplay
              value={displayCaloriePct}
              baseCalories={goalCalories}
              targetCalories={macroResult.calories}
              onChange={onCalorieAdjustChange}
              readOnly={anyMacroOverride}
            />
```

- [ ] **Step 3: Update `MacroSliders` props**

Find the `<MacroSliders` usage (around lines 319–328):

```tsx
            <MacroSliders
              calcProtein={macroResult.macros.p}
              calcFat={macroResult.macros.f}
              calcCarbs={macroResult.macros.c}
              calcCalories={macroResult.calories}
              overrides={macroOverrides}
              onOverridesChange={onMacroOverridesChange}
              leanMass={leanMass}
              bodyWeight={bodyWeight}
            />
```

Replace with:

```tsx
            <MacroSliders
              calcProtein={macroResult.macros.p}
              calcFat={macroResult.macros.f}
              calcCarbs={macroResult.macros.c}
              overrides={macroOverrides}
              onOverridesChange={onMacroOverridesChange}
              leanMass={leanMass}
              bodyWeight={bodyWeight}
              tdee={macroResult.tdee}
            />
```

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/nutrition/studio/CalculationEngine.tsx
git commit -m "feat(nutrition-studio): wire displayCaloriePct, readOnly, tdee in CalculationEngine"
```

---

## Task 6: Update `NutritionStudio.tsx` + final validation

**Files:**
- Modify: `components/nutrition/studio/NutritionStudio.tsx`

- [ ] **Step 1: Change `onGoalChange` to use `setGoalWithPreset`**

Find (around line 201):

```tsx
            onGoalChange={studio.setGoal}
```

Replace with:

```tsx
            onGoalChange={studio.setGoalWithPreset}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors. Fix anything before continuing.

- [ ] **Step 3: Run all nutrition tests**

```bash
npx vitest run tests/lib/nutrition/
```

Expected: All tests PASS (including new smartPreset tests).

- [ ] **Step 4: Update CHANGELOG**

Open `CHANGELOG.md`, find or create the `## 2026-05-29` section, add at the top:

```
FEATURE: Nutrition Studio — TDEE delta badge in MacroSliders (always visible, BF-stratified color scale)
FEATURE: Nutrition Studio — calorieAdjustPct now % vs TDEE (slider 0 = TDEE always)
FEATURE: Nutrition Studio — goal buttons auto-move calorie slider to smart BF-stratified presets
FEATURE: Nutrition Studio — macro slider changes reflect position in calorie slider (readOnly display mode)
```

- [ ] **Step 5: Final commit**

```bash
git add components/nutrition/studio/NutritionStudio.tsx CHANGELOG.md
git commit -m "feat(nutrition-studio): wire setGoalWithPreset + CHANGELOG"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ TDEE delta badge in MacroSliders — Task 4
- ✅ Badge always visible (not gated on manual override) — Task 4 step 4
- ✅ Color scale matches CalorieAdjustmentDisplay thresholds — Task 4 step 3
- ✅ Goal button → calorie slider auto-sync — Tasks 2 + 6
- ✅ Smart BF-stratified presets — Task 1
- ✅ Slider 0 = TDEE always — Task 2 step 2
- ✅ Macro sliders → calorie slider visual sync — Task 5 step 2 (`displayCaloriePct`)
- ✅ Slider readOnly when macro overrides active — Tasks 3 + 5
- ✅ Reset auto returns slider to interactive mode — existing behavior preserved (clearing overrides via MacroSliders resetAll)
- ✅ TypeScript strict — checked after each task
- ✅ CHANGELOG updated — Task 6 step 4

**Type consistency:**
- `computeSmartPreset(goal, bodyFat, weeklyFrequency)` used consistently across Task 1, 2
- `tdeeDelta`, `tdeeDeltaColor` defined and used within Task 4
- `displayCaloriePct`, `anyMacroOverride` defined and used within Task 5
- `calcCalories` removed from MacroSliders in Task 4 and from CalculationEngine in Task 5 — consistent

**No placeholders:** All steps contain complete code. No TBD/TODO.
