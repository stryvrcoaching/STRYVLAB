# Smart Nutrition Compose — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/client/nutrition/compose` — a dedicated full-page meal simulator where users compose a meal against a live day-nutrition hero (arc + macro bars), save as prep, or log directly.

**Architecture:** Page dédiée (`app/client/nutrition/compose/page.tsx` server + `ComposeClientPage.tsx` client) with split-fixed layout: `SmartNutritionHero` pinned at top fed by `effectiveConsumed = realConsumed + draftTotals`, `NutritionLogContent` embedded below with `hideActions` + `onDraftsChange` callback + imperative handle for parent-controlled save/clear. DS v4 simulation color `#818cf8` on arc, macro bars, and "Sauver" button — only "Valider" stays in the real `#ffe01e`.

**Tech Stack:** Next.js App Router, React forwardRef/useImperativeHandle, Supabase direct queries, Vitest, Framer Motion (existing), Tailwind

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/nutrition/compose-advisor.ts` | Modify | Add `isCompletionMode`, `applyMealFraction` param to `suggestFoodQuantity`, update `suggestQuantityForItem` |
| `tests/lib/nutrition/compose-advisor.test.ts` | Modify | Add tests for mealFraction + completion mode |
| `components/client/smart/SmartNutritionHero.tsx` | Modify | Add `simulationMode` prop: hide date nav, SIMULATION badge, `#818cf8` arc/bars, dot grid |
| `app/client/nutrition/log/NutritionLogContent.tsx` | Modify | `forwardRef` conversion, `hideActions`, `onDraftsChange`, `useImperativeHandle`, inline suggestion chips |
| `app/client/nutrition/compose/page.tsx` | Create | Server component: auth, fetch consumed + target + water |
| `app/client/nutrition/compose/ComposeClientPage.tsx` | Create | Client: split layout, draftTotals state, effectiveConsumed, 3 action buttons |
| `app/client/nutrition/NutritionClientPage.tsx` | Modify | `compose_guide` / `compose_simulation` → `router.push('/client/nutrition/compose?date=...')` |
| `CHANGELOG.md` | Modify | Log feature entry |

---

## Task 1 — compose-advisor: mealFraction + completion mode

**Files:**
- Modify: `lib/nutrition/compose-advisor.ts`
- Modify: `tests/lib/nutrition/compose-advisor.test.ts`

### Context
`suggestFoodQuantity` currently fills 100% of remaining macro. On a first meal, this suggests eating all remaining protein in one sitting. We need:
1. A `mealFraction` cap (40% normal / 80% last-meal)
2. Completion mode (`allMacros < 30g && totalKcal < 200`): use `min(grams_to_fill)` across macros to avoid overflow
3. `applyMealFraction` defaults to `false` to keep existing callers unchanged; `suggestQuantityForItem` opts in with `true`

---

- [ ] **Step 1: Write failing tests for isCompletionMode + mealFraction**

Add to `tests/lib/nutrition/compose-advisor.test.ts` after existing tests:

```typescript
import { isCompletionMode } from '@/lib/nutrition/compose-advisor'

describe('isCompletionMode', () => {
  it('returns true when all macros < 30g and kcal < 200', () => {
    // P:10×4=40 + G:20×4=80 + F:5×9=45 = 165 kcal < 200
    expect(isCompletionMode({ protein_g: 10, carbs_g: 20, fat_g: 5 })).toBe(true)
  })
  it('returns false when any macro >= 30g', () => {
    expect(isCompletionMode({ protein_g: 30, carbs_g: 20, fat_g: 5 })).toBe(false)
  })
  it('returns false when total kcal >= 200', () => {
    // P:25×4=100 + G:25×4=100 = 200 — not < 200
    expect(isCompletionMode({ protein_g: 25, carbs_g: 25, fat_g: 0 })).toBe(false)
  })
})

describe('suggestFoodQuantity — applyMealFraction: true', () => {
  it('caps suggestion at 40% of remaining in normal mode', () => {
    const chicken = mkFood({ protein_per_100g: 24, fat_per_100g: 2, carbs_per_100g: 0, kcal_per_100g: 120 })
    // P:100g × 0.40 = 40g available → 40/24 × 100 = 166.7 → roundToStep = 165
    const out = suggestFoodQuantity({
      food: chicken,
      remainingTargets: { protein_g: 100, carbs_g: 200, fat_g: 60 },
      applyMealFraction: true,
    })
    expect(out).not.toBeNull()
    expect(out!.grams).toBeGreaterThanOrEqual(160)
    expect(out!.grams).toBeLessThanOrEqual(170)
  })
})

describe('suggestFoodQuantity — completion mode (applyMealFraction: true)', () => {
  it('uses min-grams algo: chicken fills protein, avoids fat overflow', () => {
    const chicken = mkFood({ protein_per_100g: 31, fat_per_100g: 3.6, carbs_per_100g: 0, kcal_per_100g: 165 })
    // P=10, G=20, F=5 → completion (allSmall + kcal=165 < 200)
    // fraction=0.80 → P_avail=8, F_avail=4
    // grams_P = (8/31)×100 = 25.8, grams_F = (4/3.6)×100 = 111 → min=25.8 → macro=protein
    const out = suggestFoodQuantity({
      food: chicken,
      remainingTargets: { protein_g: 10, carbs_g: 20, fat_g: 5 },
      applyMealFraction: true,
    })
    expect(out).not.toBeNull()
    expect(out!.macroFilled).toBe('protein')
    expect(out!.grams).toBeLessThanOrEqual(30)
  })

  it('picks carbs fill for rice (min-grams wins over protein)', () => {
    const rice = mkFood({ protein_per_100g: 2.7, carbs_per_100g: 28, fat_per_100g: 0.3, kcal_per_100g: 130, category_l1: 'carbs' })
    // P=10, G=20, F=5 → completion
    // fraction=0.80 → G_avail=16, P_avail=8
    // grams_G = (16/28)×100 = 57.1, grams_P = (8/2.7)×100 = 296 → min=57.1 → macro=carbs
    const out = suggestFoodQuantity({
      food: rice,
      remainingTargets: { protein_g: 10, carbs_g: 20, fat_g: 5 },
      applyMealFraction: true,
    })
    expect(out).not.toBeNull()
    expect(out!.macroFilled).toBe('carbs')
    expect(out!.grams).toBeGreaterThanOrEqual(55)
    expect(out!.grams).toBeLessThanOrEqual(60)
  })

  it('adds warning when raw portion < 25g', () => {
    const chicken = mkFood({ protein_per_100g: 31, fat_per_100g: 3.6, carbs_per_100g: 0, kcal_per_100g: 165 })
    // P=5, G=8, F=3 → completion (kcal=5×4+8×4+3×9=20+32+27=79 < 200)
    // grams_P = (5×0.80/31)×100 = 12.9 → tooSmall=true
    const out = suggestFoodQuantity({
      food: chicken,
      remainingTargets: { protein_g: 5, carbs_g: 8, fat_g: 3 },
      applyMealFraction: true,
    })
    expect(out).not.toBeNull()
    expect(out!.warning).toContain('couvre bien')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/lib/nutrition/compose-advisor.test.ts 2>&1 | tail -20
```

Expected: error — `isCompletionMode` not exported from `compose-advisor`.

- [ ] **Step 3: Implement isCompletionMode + update suggestFoodQuantity**

In `lib/nutrition/compose-advisor.ts`, add after `function dominantMacro(...)`:

```typescript
export function isCompletionMode(
  remaining: Pick<{ protein_g: number; carbs_g: number; fat_g: number }, 'protein_g' | 'carbs_g' | 'fat_g'>,
): boolean {
  const allSmall = remaining.protein_g < 30 && remaining.carbs_g < 30 && remaining.fat_g < 30
  const totalKcal = remaining.protein_g * 4 + remaining.carbs_g * 4 + remaining.fat_g * 9
  return allSmall && totalKcal < 200
}

function getMealFraction(
  remaining: Pick<{ protein_g: number; carbs_g: number; fat_g: number }, 'protein_g' | 'carbs_g' | 'fat_g'>,
): number {
  return isCompletionMode(remaining) ? 0.80 : 0.40
}
```

Then update the `suggestFoodQuantity` signature and body. Replace the existing function with:

```typescript
export function suggestFoodQuantity({
  food,
  remainingTargets,
  priorityMacro,
  applyMealFraction = false,
}: {
  food: FoodItem
  remainingTargets: Pick<NutritionMacros, 'protein_g' | 'carbs_g' | 'fat_g'>
  priorityMacro?: AdvisorMacroKey
  applyMealFraction?: boolean
}): SuggestedFoodQuantity | null {
  const resolvedPriority = priorityMacro ?? dominantMacro(food)
  if (!resolvedPriority) return null

  const densityByMacro = {
    protein: food.protein_per_100g,
    carbs: food.carbs_per_100g,
    fat: food.fat_per_100g,
  } as const

  const fraction = applyMealFraction ? getMealFraction(remainingTargets) : 1.0
  const completion = applyMealFraction && isCompletionMode(remainingTargets)

  const remainingByMacro = {
    protein: remainingTargets.protein_g * fraction,
    carbs: remainingTargets.carbs_g * fraction,
    fat: remainingTargets.fat_g * fraction,
  } as const

  // Completion mode: min-grams across non-zero macros to avoid any overflow
  if (completion) {
    const options: Array<{ rawG: number; macro: AdvisorMacroKey }> = []
    if (densityByMacro.protein > 0 && remainingByMacro.protein > 0)
      options.push({ rawG: (remainingByMacro.protein / densityByMacro.protein) * 100, macro: 'protein' })
    if (densityByMacro.carbs > 0 && remainingByMacro.carbs > 0)
      options.push({ rawG: (remainingByMacro.carbs / densityByMacro.carbs) * 100, macro: 'carbs' })
    if (densityByMacro.fat > 0 && remainingByMacro.fat > 0)
      options.push({ rawG: (remainingByMacro.fat / densityByMacro.fat) * 100, macro: 'fat' })
    if (options.length === 0) return null
    const best = options.reduce((a, b) => (a.rawG <= b.rawG ? a : b))
    const tooSmall = best.rawG < 25
    const grams = roundToStep(clampGrams(best.rawG))
    const estimated = toEstimated(food, grams)
    return {
      grams,
      macroFilled: best.macro,
      estimatedMacros: estimated,
      warning: tooSmall ? "Ton repas couvre bien les besoins — ajout optionnel." : undefined,
    }
  }

  // Normal mode: fill dominant macro with fraction cap
  let macroToFill: AdvisorMacroKey | null = resolvedPriority
  if (remainingByMacro[macroToFill] <= 0 || densityByMacro[macroToFill] <= 0) {
    const fallback = (['protein', 'carbs', 'fat'] as const)
      .filter(m => remainingByMacro[m] > 0 && densityByMacro[m] > 0)
      .sort((a, b) => remainingByMacro[b] * densityByMacro[b] - remainingByMacro[a] * densityByMacro[a])[0]
    macroToFill = fallback ?? null
  }

  if (!macroToFill) return null

  const rawGrams = (remainingByMacro[macroToFill] / densityByMacro[macroToFill]) * 100
  const grams = roundToStep(clampGrams(rawGrams))
  const estimated = toEstimated(food, grams)

  let warning: string | undefined
  if (remainingTargets.fat_g <= 0 && estimated.fat >= 8) {
    warning = "Cet aliment ajoute des lipides alors qu'ils sont deja couverts."
  } else if (remainingTargets.carbs_g <= 0 && estimated.carbs >= 12) {
    warning = 'Cet aliment ajoute des glucides alors que cet objectif est deja couvert.'
  }

  return { grams, macroFilled: macroToFill, estimatedMacros: estimated, warning }
}
```

Then update `suggestQuantityForItem` to opt-in to fraction:

```typescript
export function suggestQuantityForItem(
  item: FoodItem,
  remaining: Pick<NutritionMacros, 'protein_g' | 'carbs_g' | 'fat_g'>,
): ComposeAdvisorSuggestion | null {
  const next = suggestFoodQuantity({ food: item, remainingTargets: remaining, applyMealFraction: true })
  if (!next) return null

  const label = next.macroFilled === 'protein'
    ? 'proteines'
    : next.macroFilled === 'carbs'
      ? 'glucides'
      : 'lipides'

  return {
    grams: next.grams,
    macro: next.macroFilled === 'calories' ? 'protein' : next.macroFilled,
    reason: `Cet aliment repond surtout au manque de ${label} du jour.`,
    warning: next.warning,
    preview: {
      kcal: next.estimatedMacros.calories,
      protein_g: next.estimatedMacros.protein,
      carbs_g: next.estimatedMacros.carbs,
      fat_g: next.estimatedMacros.fat,
      water_ml: 0,
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/lib/nutrition/compose-advisor.test.ts 2>&1 | tail -20
```

Expected: all tests pass including existing ones (backward compat preserved by `applyMealFraction = false` default).

- [ ] **Step 5: Run tsc**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/nutrition/compose-advisor.ts tests/lib/nutrition/compose-advisor.test.ts
git commit -m "feat(compose-advisor): add mealFraction cap + completion mode min-grams algo"
```

---

## Task 2 — SmartNutritionHero: simulationMode prop

**Files:**
- Modify: `components/client/smart/SmartNutritionHero.tsx`

### Context
Add `simulationMode?: boolean` to `Props`. When true: hide date nav arrows, show "SIMULATION" pill badge, use `#818cf8` for the calorie arc stroke and macro bar fills instead of real colors, add dot grid background on the card.

---

- [ ] **Step 1: Read the file first**

```bash
cat -n components/client/smart/SmartNutritionHero.tsx
```

- [ ] **Step 2: Update Props type and destructuring**

```typescript
// Props type — add simulationMode
type Props = {
  date: string
  consumed: NutritionMacros
  target: NutritionMacros
  onWaterClick?: () => void
  simulationMode?: boolean
}

// Destructure
export default function SmartNutritionHero({ date, consumed, target, onWaterClick, simulationMode = false }: Props) {
```

- [ ] **Step 3: Update arc color to use simulation color when active**

Find where `kcalStroke` is computed (currently uses `getStateColor`). Replace with:

```typescript
const SIMULATION_COLOR = '#818cf8'
const kcalColor  = getStateColor(kcalMeta.state, NUTRITION_UI_COLORS.calories)
const kcalStroke = simulationMode ? SIMULATION_COLOR : kcalColor
```

- [ ] **Step 4: Update macro bar fill color**

In the `MACROS.map(...)` section where `fillColor` is computed per macro:

```typescript
// For each macro bar, replace:
const fillColor = getStateColor(meta.state, m.color)
// With:
const fillColor = simulationMode
  ? 'rgba(129,140,248,0.65)'
  : getStateColor(meta.state, m.color)
```

- [ ] **Step 5: Add SIMULATION badge and hide date nav**

Wrap the date nav `<div>` with a conditional. Then add the badge inside the hero card, after the opening `<div className="bg-[#111111] rounded-2xl p-[18px]">`:

```tsx
{/* ── Simulation badge ── */}
{simulationMode && (
  <div className="flex items-center justify-between mb-3">
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#818cf8]/10 border border-[#818cf8]/20">
      <div className="w-1.5 h-1.5 rounded-full bg-[#818cf8] animate-pulse" />
      <span className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[#818cf8]">Simulation</span>
    </div>
  </div>
)}

{/* ── Date nav — hide in simulation ── */}
{!simulationMode && (
  <div className="flex items-center justify-between mb-1">
    {/* existing prev/next Link buttons */}
  </div>
)}
```

- [ ] **Step 6: Add dot grid background on card**

Replace the outer `<div className="bg-[#111111] rounded-2xl p-[18px]">` with:

```tsx
<div
  className="bg-[#111111] rounded-2xl p-[18px]"
  style={simulationMode ? {
    backgroundImage: 'radial-gradient(circle, rgba(129,140,248,0.07) 1px, transparent 1px)',
    backgroundSize: '18px 18px',
    backgroundColor: '#111111',
  } : undefined}
>
```

- [ ] **Step 7: Run tsc**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add components/client/smart/SmartNutritionHero.tsx
git commit -m "feat(SmartNutritionHero): add simulationMode prop — #818cf8 arc/bars, dot grid, SIMULATION badge"
```

---

## Task 3 — NutritionLogContent: forwardRef + hideActions + onDraftsChange + inline chips

**Files:**
- Modify: `app/client/nutrition/log/NutritionLogContent.tsx`

### Context
Three additions:
1. `forwardRef` conversion exposing `{ saveMeal, savePrep, clearDrafts }` so the compose page parent can trigger actions
2. `hideActions` prop to suppress internal bottom buttons (parent handles them)
3. `onDraftsChange` callback so parent gets live draft totals for the hero
4. Inline `~Xg` suggestion chip on each food item in the item layer (only when `composerMode !== "standard"`)

---

- [ ] **Step 1: Add imports and export handle type**

At the top of `app/client/nutrition/log/NutritionLogContent.tsx`, add `forwardRef, useImperativeHandle, useEffect` to the React import and add the handle type:

```typescript
import { Suspense, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"

export interface NutritionLogContentHandle {
  saveMeal: () => Promise<void>
  savePrep: () => Promise<void>
  clearDrafts: () => void
}
```

- [ ] **Step 2: Add new props to NutritionLogContentProps interface**

```typescript
export interface NutritionLogContentProps {
  onSuccess?: () => void
  embedded?: boolean
  mealId?: string | null
  prepId?: string | null
  initialPrepEntries?: Array<{
    food_item_id: string
    name_fr: string
    quantity_g: number
    calories_kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g?: number
  }>
  composerMode?: "standard" | "guide" | "simulation"
  entryMode?: "default" | "search" | "favorites" | "categories"
  balanceContext?: {
    consumed: NutritionMacros
    target: NutritionMacros
  }
  hideActions?: boolean
  onDraftsChange?: (totals: {
    calories: number
    protein: number
    carbs: number
    fat: number
    count: number
  }) => void
}
```

- [ ] **Step 3: Convert to forwardRef**

Replace:
```typescript
export function NutritionLogContent({
  onSuccess,
  embedded = false,
  mealId: mealIdProp,
  prepId,
  initialPrepEntries,
  composerMode = "standard",
  entryMode = "default",
  balanceContext,
}: NutritionLogContentProps) {
```

With:
```typescript
export const NutritionLogContent = forwardRef<NutritionLogContentHandle, NutritionLogContentProps>(
  function NutritionLogContent({
    onSuccess,
    embedded = false,
    mealId: mealIdProp,
    prepId,
    initialPrepEntries,
    composerMode = "standard",
    entryMode = "default",
    balanceContext,
    hideActions = false,
    onDraftsChange,
  }: NutritionLogContentProps, ref) {
```

Note: the entire component body becomes the inner function body, and add a closing `}` for the outer `forwardRef(` at the very end of the file.

- [ ] **Step 4: Add useImperativeHandle inside the component (after the state declarations)**

After the `const [savingPrep, setSavingPrep] = useState(false)` line, add:

```typescript
useImperativeHandle(ref, () => ({
  saveMeal: async () => {
    await persistMeal(drafts, "composer")
  },
  savePrep: async () => {
    await savePrep()
  },
  clearDrafts: () => {
    setDrafts([])
    setLayer("category")
    setSelectedCategory(null)
    setSelectedSubcategory(null)
    setSelectedItem(null)
  },
}), [drafts]) // eslint-disable-line react-hooks/exhaustive-deps
```

**Important:** `persistMeal` and `savePrep` are defined later in the component. TypeScript closures will capture the latest version via the `[drafts]` dependency.

- [ ] **Step 5: Add useEffect for onDraftsChange**

After the `const totals = sumDraftMacros(drafts)` line (around line 461), add:

```typescript
useEffect(() => {
  onDraftsChange?.({
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    count: drafts.length,
  })
}, [drafts]) // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 6: Apply hideActions to the bottom action buttons**

Find the `{isSmartPrepMode ? (` block near the bottom (around line 1116). Wrap it:

```tsx
{!hideActions && (
  isSmartPrepMode ? (
    <div className="grid grid-cols-2 gap-2">
      {/* ... existing buttons unchanged ... */}
    </div>
  ) : (
    <button
      onClick={saveMeal}
      {/* ... existing single button unchanged ... */}
    >
      {/* ... */}
    </button>
  )
)}
```

- [ ] **Step 7: Add inline suggestion chips in the item layer**

In the `items.map((item, i) => {` block (around line 750), add chip computation and replace the `/ 100g` span:

```tsx
{items.map((item, i) => {
  const kcal = item.kcal_per_100g || 1
  const pPct = Math.round((item.protein_per_100g * 4 / kcal) * 100)
  const gPct = Math.round((item.carbs_per_100g * 4 / kcal) * 100)
  const lPct = Math.round((item.fat_per_100g * 9 / kcal) * 100)
  const chipSuggestion = (composerMode !== "standard" && macroBalance)
    ? suggestQuantityForItem(item, macroBalance.remaining)
    : null
  return (
    <button
      key={item.id}
      onClick={() => selectItem(item)}
      className={`w-full flex items-center justify-between px-4 py-3 active:scale-[0.99] transition-all hover:bg-white/[0.04] text-left ${i < items.length - 1 ? "border-b border-white/[0.04]" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-white">{item.name_fr}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-white/40">{item.kcal_per_100g} kcal</span>
          <div className="flex h-[4px] w-[64px] rounded-full overflow-hidden gap-[1px]">
            <div style={{ width: `${pPct}%`, backgroundColor: NUTRITION_UI_COLORS.protein }} />
            <div style={{ width: `${gPct}%`, backgroundColor: NUTRITION_UI_COLORS.carbs }} />
            <div style={{ width: `${lPct}%`, backgroundColor: NUTRITION_UI_COLORS.fat }} />
          </div>
          <span className="text-[10px] text-white/25">P·G·L</span>
        </div>
      </div>
      {chipSuggestion ? (
        <span className="text-[10px] font-bold text-[#818cf8] shrink-0 ml-2 tabular-nums">~{chipSuggestion.grams}g</span>
      ) : (
        <span className="text-white/20 text-[11px] shrink-0 ml-2">/ 100g</span>
      )}
    </button>
  )
})}
```

- [ ] **Step 8: Run tsc**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 errors. If you see errors about `persistMeal` or `savePrep` not being defined before `useImperativeHandle`, note these are forward references in closures — TypeScript allows this because by the time the handle is called, the functions exist. If there are hoisting issues, move the `useImperativeHandle` call to just before the `return` statement.

- [ ] **Step 9: Commit**

```bash
git add app/client/nutrition/log/NutritionLogContent.tsx
git commit -m "feat(NutritionLogContent): forwardRef handle + hideActions + onDraftsChange + inline suggestion chips"
```

---

## Task 4 — Compose page server component

**Files:**
- Create: `app/client/nutrition/compose/page.tsx`

### Context
Server component. Fetch: active protocol (for `target` macros), today's consumed meal totals, water. Pass to `ComposeClientPage`. Reuse pattern from `app/client/nutrition/page.tsx` — same Supabase queries, same utility functions.

---

- [ ] **Step 1: Create the file**

```typescript
// app/client/nutrition/compose/page.tsx
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { utcRangeForPhysiologicalDate } from '@/lib/client/checkin/timeWindows'
import { resolveProtocolDayByDate, resolveRestProtocolDay } from '@/lib/nutrition/protocol-schedule'
import type { NutritionMacros } from '@/components/client/smart/SmartNutritionWidget'
import ComposeClientPage from './ComposeClientPage'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export default async function ClientNutritionComposePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const client = await resolveClientFromUser(user.id, user.email, svc(), 'id')
  if (!client) return null
  const clientId = client.id
  const timezone = await resolveClientTimezone(svc(), clientId)
  const date = computePhysiologicalDate(new Date(), timezone)
  const { start, end } = utcRangeForPhysiologicalDate(date, timezone)

  const [protoResult, mealsResult, waterResult] = await Promise.allSettled([
    svc()
      .from('nutrition_protocols')
      .select('schedule_start_date, nutrition_protocol_days(position, calories, protein_g, carbs_g, fat_g, hydration_ml, carb_cycle_type), nutrition_protocol_schedule_slots(week_index, dow, protocol_day_position)')
      .eq('client_id', clientId)
      .eq('status', 'shared')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    svc()
      .from('nutrition_meals')
      .select('total_calories, total_protein_g, total_carbs_g, total_fat_g')
      .eq('client_id', clientId)
      .eq('physiological_date', date),

    svc()
      .from('client_water_logs')
      .select('amount_ml')
      .eq('client_id', clientId)
      .gte('logged_at', start)
      .lt('logged_at', end),
  ])

  const proto = protoResult.status === 'fulfilled' ? protoResult.value.data : null
  const protocolDay = proto
    ? resolveProtocolDayByDate(proto as any, date) ?? resolveRestProtocolDay((proto as any).nutrition_protocol_days ?? [])
    : null

  const target: NutritionMacros = {
    kcal: Number(protocolDay?.calories ?? 2000),
    protein_g: Number(protocolDay?.protein_g ?? 150),
    carbs_g: Number(protocolDay?.carbs_g ?? 200),
    fat_g: Number(protocolDay?.fat_g ?? 60),
    water_ml: Number(protocolDay?.hydration_ml ?? 2500),
  }

  const meals = mealsResult.status === 'fulfilled' ? (mealsResult.value.data ?? []) : []
  const waterEntries = waterResult.status === 'fulfilled' ? (waterResult.value.data ?? []) : []

  const consumed: NutritionMacros = {
    kcal: meals.reduce((s, m) => s + Number(m.total_calories ?? 0), 0),
    protein_g: meals.reduce((s, m) => s + Number(m.total_protein_g ?? 0), 0),
    carbs_g: meals.reduce((s, m) => s + Number(m.total_carbs_g ?? 0), 0),
    fat_g: meals.reduce((s, m) => s + Number(m.total_fat_g ?? 0), 0),
    water_ml: waterEntries.reduce((s, w) => s + Number((w as any).amount_ml ?? 0), 0),
  }

  return <ComposeClientPage consumed={consumed} target={target} date={date} />
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Fix any type errors (e.g., `resolveClientFromUser` return type, `resolveProtocolDayByDate` signature — check how `app/client/nutrition/page.tsx` calls these and mirror exactly).

- [ ] **Step 3: Commit**

```bash
git add app/client/nutrition/compose/page.tsx
git commit -m "feat(compose/page): server component — fetch consumed + target for simulation page"
```

---

## Task 5 — ComposeClientPage: split layout + state + actions

**Files:**
- Create: `app/client/nutrition/compose/ComposeClientPage.tsx`

### Context
Client component. Manages `draftTotals` state received from `NutritionLogContent` via `onDraftsChange`. Computes `effectiveConsumed = realConsumed + draftTotals` and passes to `SmartNutritionHero` (simulation mode). Holds a `ref` to `NutritionLogContent` to call `saveMeal`, `savePrep`, `clearDrafts` imperatively. Action buttons zone appears when `count > 0`. "Sauver en prépa": save + clear + stay. "Valider": save meal + navigate to `/client/nutrition`. "Annuler": clear + stay.

Note: `balanceContext` passed to `NutritionLogContent` uses **real `consumed`** (not `effectiveConsumed`) because `NutritionLogContent` adds its own drafts internally.

---

- [ ] **Step 1: Create the file**

```typescript
// app/client/nutrition/compose/ComposeClientPage.tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import ClientTopBar from '@/components/client/ClientTopBar'
import SmartNutritionHero from '@/components/client/smart/SmartNutritionHero'
import { NutritionLogContent, type NutritionLogContentHandle } from '@/app/client/nutrition/log/NutritionLogContent'
import type { NutritionMacros } from '@/components/client/smart/SmartNutritionWidget'

interface ComposeClientPageProps {
  consumed: NutritionMacros
  target: NutritionMacros
  date: string
}

type DraftTotals = { calories: number; protein: number; carbs: number; fat: number; count: number }

const ZERO_DRAFTS: DraftTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 }

export default function ComposeClientPage({ consumed, target, date }: ComposeClientPageProps) {
  const router = useRouter()
  const logRef = useRef<NutritionLogContentHandle>(null)
  const [draftTotals, setDraftTotals] = useState<DraftTotals>(ZERO_DRAFTS)
  const [saving, setSaving] = useState<'prep' | 'meal' | null>(null)

  const effectiveConsumed: NutritionMacros = {
    kcal: consumed.kcal + draftTotals.calories,
    protein_g: consumed.protein_g + draftTotals.protein,
    carbs_g: consumed.carbs_g + draftTotals.carbs,
    fat_g: consumed.fat_g + draftTotals.fat,
    water_ml: consumed.water_ml,
  }

  const handleDraftsChange = useCallback((totals: DraftTotals) => {
    setDraftTotals(totals)
  }, [])

  async function handleSavePrep() {
    setSaving('prep')
    await logRef.current?.savePrep()
    logRef.current?.clearDrafts()
    setSaving(null)
  }

  async function handleSaveMeal() {
    setSaving('meal')
    await logRef.current?.saveMeal()
    setSaving(null)
    router.push('/client/nutrition')
  }

  function handleCancel() {
    logRef.current?.clearDrafts()
  }

  const hasDrafts = draftTotals.count > 0

  return (
    <main className="bg-[#0d0d0d] flex flex-col h-[100dvh] overflow-hidden">
      <ClientTopBar
        section="Smart Nutrition"
        title="Je compose"
        right={
          <button
            onClick={() => router.back()}
            className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/50 active:bg-white/[0.08] transition-colors"
          >
            <ArrowLeft size={15} />
          </button>
        }
      />

      {/* Hero simulation — fixed, always visible */}
      <div className="shrink-0 px-4 pt-3 pb-1">
        <SmartNutritionHero
          date={date}
          consumed={effectiveConsumed}
          target={target}
          simulationMode
        />
      </div>

      {/* Actions zone — appears when at least 1 draft food */}
      {hasDrafts && (
        <div className="shrink-0 px-4 py-3 grid grid-cols-3 gap-2">
          <button
            onClick={handleCancel}
            disabled={saving !== null}
            className="h-11 rounded-xl bg-white/[0.04] text-white/40 text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            Annuler
          </button>
          <button
            onClick={handleSavePrep}
            disabled={saving !== null}
            className="h-11 rounded-xl bg-[#818cf8]/15 border border-[#818cf8]/25 text-[#818cf8] text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            {saving === 'prep' ? '...' : 'Sauver'}
          </button>
          <button
            onClick={handleSaveMeal}
            disabled={saving !== null}
            className="h-11 rounded-xl bg-[#ffe01e] text-[#0d0d0d] text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.1em] disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            {saving === 'meal' ? '...' : 'Valider'}
          </button>
        </div>
      )}

      {/* Composer — flex-1 scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <NutritionLogContent
          ref={logRef}
          embedded
          composerMode="guide"
          hideActions
          onDraftsChange={handleDraftsChange}
          balanceContext={{ consumed, target }}
        />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Run tsc**

```bash
npx tsc --noEmit 2>&1 | head -30
```

If `ClientTopBar` doesn't accept `section` / `title` / `right` as string props (check existing usage in `NutritionClientPage.tsx` to confirm signature), adapt accordingly.

- [ ] **Step 3: Commit**

```bash
git add app/client/nutrition/compose/ComposeClientPage.tsx
git commit -m "feat(ComposeClientPage): split-fixed layout — simulation hero + draft-driven actions + #818cf8 DS v4"
```

---

## Task 6 — Wire entry point in NutritionClientPage

**Files:**
- Modify: `app/client/nutrition/NutritionClientPage.tsx`

### Context
Currently `compose_guide` and `compose_simulation` from `MealMethodSheet.onSelect` open `MealLogSheet`. Change both to navigate to `/client/nutrition/compose?date=<date>`. The `date` prop is available as a prop in `NutritionClientPage`.

---

- [ ] **Step 1: Read NutritionClientPage to find the compose handlers**

```bash
grep -n "compose_guide\|compose_simulation\|mealComposerMode\|setMealLogOpen" app/client/nutrition/NutritionClientPage.tsx | head -20
```

- [ ] **Step 2: Update the MealMethodSheet onSelect handler**

Find the block (around line 204–230 from earlier grep):

```typescript
// Before:
} else if (method === "compose_guide") {
  setMealComposerMode("guide")
  setMealLogOpen(true)
} else if (method === "compose_simulation") {
  setMealComposerMode("simulation")
  setMealLogOpen(true)
}

// After:
} else if (method === "compose_guide" || method === "compose_simulation") {
  router.push(`/client/nutrition/compose?date=${date}`)
}
```

Verify `router` is already imported (`useRouter` from `next/navigation` — it is, at line 4).

- [ ] **Step 3: Verify `date` is available in scope**

```bash
grep -n "^  date\|const date\|props.*date\|{ date" app/client/nutrition/NutritionClientPage.tsx | head -5
```

`date` should be a prop of `NutritionClientPage`. If it is, `router.push(`/client/nutrition/compose?date=${date}`)` is correct. If not, use `format(new Date(), 'yyyy-MM-dd')` or check how `date` is passed.

- [ ] **Step 4: Run tsc**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/client/nutrition/NutritionClientPage.tsx
git commit -m "feat(nutrition): compose intent → router.push /client/nutrition/compose"
```

---

## Task 7 — tsc clean, CHANGELOG, final smoke check

**Files:**
- Modify: `CHANGELOG.md`

---

- [ ] **Step 1: Full tsc clean**

```bash
npx tsc --noEmit 2>&1
```

Expected: 0 errors. Fix anything before proceeding.

- [ ] **Step 2: Run all nutrition tests**

```bash
npx vitest run tests/lib/nutrition/ 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 3: Update CHANGELOG.md**

Add to the `## 2026-06-01` section:

```
FEATURE: Add /client/nutrition/compose — Smart Nutrition Compose page with live simulation hero
FEATURE: DS v4 simulation color #818cf8 — arc, macro bars, Sauver button
FEATURE: compose-advisor mealFraction cap (40% normal / 80% completion mode)
FEATURE: compose-advisor completion mode min-grams algo to avoid overflow on last meal
FEATURE: NutritionLogContent forwardRef handle (saveMeal/savePrep/clearDrafts) + hideActions + onDraftsChange
FEATURE: SmartNutritionHero simulationMode — dot grid, SIMULATION badge, date nav hidden
FEATURE: Inline ~Xg suggestion chips on food items in composer mode
```

- [ ] **Step 4: Final commit**

```bash
git add CHANGELOG.md
git commit -m "chore: update CHANGELOG for Smart Nutrition Compose feature"
```
