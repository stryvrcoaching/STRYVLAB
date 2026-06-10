# Nutrition Studio — Calorie Delta Badge + TDEE-Relative Slider

**Date:** 2026-05-29  
**Scope:** `CalculationEngine`, `MacroSliders`, `CalorieAdjustmentDisplay`, `useNutritionStudio`, `lib/formulas/macros.ts`

---

## Problem

Two bugs in Nutrition Studio (coach client protocol edit page):

1. **No TDEE delta in MacroSliders.** When coach manually overrides macro sliders, the calorie total updates but there is no visual indicator of how far above/below TDEE the result sits. Coach cannot see at a glance whether macros produce a deficit, maintenance, or surplus.

2. **Goal buttons don't move the calorie slider.** Clicking "Déficit" or "Surplus" sets the label only. The calorie slider stays at 0. Zero means "same as TDEE" semantically, but internally `calorieAdjustPct = 0` with goal = "deficit" still applies the -12% goal factor inside `calculateMacros`, creating a disconnect between what the slider shows and what the coach perceives.

---

## Requirements

### Feature A — TDEE delta badge in MacroSliders

- Badge displayed next to the calorie total: `+100 kcal` or `-100 kcal`
- Always visible when `tdee` is provided (not gated on manual override mode)
- Delta = `effectiveCalories - tdee`
- Color matches `CalorieAdjustmentDisplay`:
  - `delta/tdee < -15%` → red (`#f87171`)
  - `delta/tdee < 0%` → orange (`#fb923c`)
  - `delta/tdee === 0` → neutral (`rgba(255,255,255,0.4)`)
  - `delta/tdee <= +15%` → green (`#1f8a65`)
  - `delta/tdee > +15%` → dark green (`#0f7d4a`)

### Feature B — Goal button → calorie slider auto-sync

- Slider zero = TDEE. Always. This never changes.
- Clicking Maintenance → slider snaps to 0%
- Clicking Déficit → slider auto-moves to smart preset (BF-stratified, -12% to -30%)
- Clicking Surplus → slider auto-moves to smart preset (BF-stratified, +4% to +10%)
- Coach can then manually adjust slider afterward (no restriction)

### Feature C — Macro sliders → calorie slider position sync

- When macro overrides produce a different calorie total, calorie slider visually moves to reflect the effective % vs TDEE
- Slider becomes display-only (readOnly) when any macro override is active
- On Reset auto (clearing all overrides), slider returns to interactive mode at current `calorieAdjustPct`

---

## Architecture Change: `calorieAdjustPct` semantics

**Current:** `calorieAdjustPct` = % applied ON TOP of goal factor. `calculateMacros` internally applies the goal calorie adjustment; then `calorieAdjustPct` adds an additional fine-tuning layer.

**New:** `calorieAdjustPct` = % vs TDEE directly. Zero always = TDEE. Goal still passed to `calculateMacros` for macro ratio logic (protein/fat multipliers) but does NOT drive the calorie target. The calorie target is always: `round(tdee * (1 + calorieAdjustPct / 100))`.

This means the goal factor is effectively removed from calorie computation; instead, clicking a goal button sets `calorieAdjustPct` to the appropriate smart preset.

---

## Smart Preset Logic

Extracted to `computeSmartPreset(goal, bodyFat, weeklyFrequency)` in `lib/formulas/macros.ts`.

Mirrors the existing BF-stratified deficit logic and converts surplus fixed-kcal to %.

### Deficit presets (% vs TDEE)

| Body fat | Base | Weekly freq ≥ 5 |
|----------|------|-----------------|
| > 30% | -30% | -27% (max floor -10%) |
| > 25% | -25% | -22% |
| > 20% | -20% | -17% |
| > 15% | -15% | -12% |
| ≤ 15% | -12% | -10% |

### Surplus presets (% vs TDEE)

| Body fat | Surplus % |
|----------|-----------|
| < 10% | +10% |
| < 13% | +8% |
| < 16% | +7% |
| < 20% | +5% |
| ≥ 20% | +4% |

### Maintenance
Always 0%.

Fallback when body fat unknown: deficit = -12%, surplus = +7%.

---

## Component Changes

### `lib/formulas/macros.ts`

Add exported helper:
```typescript
export function computeSmartPreset(
  goal: MacroGoal,
  bodyFat: number | null,
  weeklyFrequency: number
): number
```

### `useNutritionStudio.ts`

1. **`recalculate()` calorie logic change:**
```typescript
// Before:
const caloriesAfterGoal = result.calories;
setGoalCalories(caloriesAfterGoal);
if (calorieAdjustPct !== 0) {
  result.calories = Math.round(result.calories * (1 + calorieAdjustPct / 100));
}

// After:
const tdee = result.tdee;
setGoalCalories(tdee); // TDEE is now the reference
const targetCal = Math.round(tdee * (1 + calorieAdjustPct / 100));
result.calories = targetCal;
// Redistribute carbs if not manually overridden
if (!macroOverrides.carbs_g) {
  const remaining = targetCal - result.macros.p * 4 - result.macros.f * 9;
  result.macros.c = Math.max(0, Math.round(remaining / 4));
}
```

2. **On client data load (line ~254):** After `setGoal(mapped)`, also call `setCalorieAdjustPct(computeSmartPreset(mapped, cd.body_fat_pct, cd.weekly_frequency ?? 0))`.

3. **Export `setGoalWithPreset`** from the hook (or expose both `setGoal` + `setCalorieAdjustPct` as today). `CalculationEngine.onGoalChange` will call both.

### `CalorieAdjustmentDisplay.tsx`

Add `readOnly?: boolean` prop.

When `readOnly=true`:
- Slider `style={{ pointerEvents: 'none', opacity: 0.5 }}`
- Small label: `"Macros manuels actifs"` in `text-white/30`
- No cursor change needed (pointerEvents handles it)

### `MacroSliders.tsx`

Add `tdee: number | null` prop.

Replace current `calorieDelta` badge with TDEE delta:
```typescript
const tdeeDelta = tdee ? effectiveCalories - tdee : null
const tdeeDeltaPct = tdee ? tdeeDelta! / tdee : null
const tdeeDeltaColor = tdeeDeltaPct === null ? 'transparent'
  : tdeeDeltaPct < -0.15 ? '#f87171'
  : tdeeDeltaPct < 0     ? '#fb923c'
  : tdeeDeltaPct === 0   ? 'rgba(255,255,255,0.4)'
  : tdeeDeltaPct <= 0.15 ? '#1f8a65'
  : '#0f7d4a'
```

Badge in header:
```tsx
{tdeeDelta !== null && (
  <span className="text-[11px] font-semibold tabular-nums" style={{ color: tdeeDeltaColor }}>
    {tdeeDelta > 0 ? '+' : ''}{tdeeDelta} kcal
  </span>
)}
```

Remove `anyManual` gate — badge is always visible.

### `CalculationEngine.tsx`

1. Compute `displayCaloriePct` and `calSliderReadOnly`:
```typescript
const anyMacroOverride = macroOverrides.protein_g !== null || macroOverrides.fat_g !== null || macroOverrides.carbs_g !== null
const displayCaloriePct = anyMacroOverride && macroResult
  ? Math.max(-30, Math.min(30, Math.round((macroResult.calories - macroResult.tdee) / macroResult.tdee * 100)))
  : calorieAdjustPct
```

2. `onGoalChange` handler:
```typescript
const handleGoalChange = (newGoal: MacroGoal) => {
  onGoalChange(newGoal)
  const bf = /* biometricsConfig?.body_fat_pct ?? clientBodyFat */
  const freq = /* trainingConfig?.weeklyFrequency ?? 3 */
  onCalorieAdjustChange(computeSmartPreset(newGoal, bf, freq))
}
```

Note: `CalculationEngine` does not have direct access to biometrics/training config — need to pass `bodyFat` and `weeklyFrequency` as props from `NutritionStudio`, or compute preset in `useNutritionStudio` and expose a `setGoalWithPreset(goal)` function.

3. Pass to `CalorieAdjustmentDisplay`:
```tsx
<CalorieAdjustmentDisplay
  value={displayCaloriePct}
  baseCalories={goalCalories}   // now = TDEE
  targetCalories={macroResult.calories}
  onChange={onCalorieAdjustChange}
  readOnly={anyMacroOverride}
/>
```

4. Pass to `MacroSliders`:
```tsx
<MacroSliders
  ...existing props...
  tdee={macroResult.tdee}
/>
```

### `NutritionStudio.tsx`

Pass `bodyFat` and `weeklyFrequency` to `CalculationEngine` so it can compute smart presets on goal change. Or: expose `setGoalWithPreset` from `useNutritionStudio` and pass it as `onGoalChange`.

**Preferred:** expose `setGoalWithPreset(goal: MacroGoal): void` from `useNutritionStudio` — cleaner, keeps preset logic inside the hook.

---

## Data Flow Summary

```
Goal button click
  → setGoalWithPreset(newGoal)
    → setGoal(newGoal)
    → setCalorieAdjustPct(computeSmartPreset(newGoal, bf, freq))
      → recalculate()
        → targetCal = tdee * (1 + calorieAdjustPct / 100)
        → macros redistribute carbs
      → CalorieAdjustmentDisplay shows new % + kcal
      → MacroSliders shows updated TDEE delta badge

Macro slider move
  → onMacroOverridesChange(newOverrides)
    → recalculate()
      → macros override applied
      → result.calories = P*4 + F*9 + C*4
    → CalculationEngine derives displayCaloriePct from macroResult
    → CalorieAdjustmentDisplay slider visually moves (readOnly=true)
    → MacroSliders TDEE delta badge updates

Calorie slider drag (when no macro overrides)
  → onCalorieAdjustChange(newPct)
    → setCalorieAdjustPct(newPct)
    → recalculate()
      → targetCal = tdee * (1 + newPct / 100)
      → carbs redistribute
    → MacroSliders TDEE delta badge updates
```

---

## Edge Cases

- **Body fat unknown on preset:** fallback deficit=-12%, surplus=+7%
- **TDEE delta badge when effectiveCalories === tdee:** show `0 kcal` in neutral color (or hide — keep visible for clarity)
- **displayCaloriePct out of slider range (-30/+30):** clamp to slider bounds, slider sits at extreme
- **Existing protocols loaded:** `calorieAdjustPct` is 0 by default; on client data load, smart preset will set it — acceptable since coach is creating/editing a protocol
- **Macro override active + goal change:** goal changes, smart preset fires, `calorieAdjustPct` updates, but macros still overridden so `displayCaloriePct` remains derived from macros. The stored `calorieAdjustPct` is the "intended" value if Reset auto is clicked.

---

## TypeScript constraints

- `computeSmartPreset` export from `macros.ts` must be compatible with strict mode
- `readOnly` prop on `CalorieAdjustmentDisplay` is optional with default `false`
- `tdee` prop on `MacroSliders` is `number | null`
- No new Zod schemas needed (all UI state, no API changes)
