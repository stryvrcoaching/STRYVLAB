# Nutrition Studio UX Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Nutrition Studio coach UX by moving action buttons to TopBar, adding info modals to explain injection actions, enhancing calorie/macro displays with percentages and color coding, and optimizing Carb Cycling card layout.

**Architecture:** 
- TopBar integration: Move "Aperçu", "Brouillon", "Partager" buttons to existing TopBar 
- Info modal system: Create reusable `InfoModal` component + 6 modal content definitions for injection actions
- Display enhancements: TDEE legend, calorie adjustment with delta/color, macro percentages, Carb Cycling hierarchy
- No schema changes, no API changes — purely UI/UX improvements

**Tech Stack:** Next.js, React, Framer Motion (for modals), Tailwind, Lucide Icons

---

## File Structure

**New files:**
- `components/nutrition/studio/InfoModal.tsx` — Reusable modal for injection action help
- `components/nutrition/studio/MacroPercentageDisplay.tsx` — Macro grams + % display
- `components/nutrition/studio/TdeeWaterfallLegend.tsx` — 4-pill legend for TDEE segments
- `components/nutrition/studio/CalorieAdjustmentDisplay.tsx` — Enhanced slider with % + kcal delta + color

**Modified files:**
- `components/nutrition/studio/NutritionStudio.tsx` — Pass action buttons + modal state to TopBar
- `components/nutrition/studio/ProtocolCanvas.tsx` — Remove footer buttons, remove injection button titles (add info icons instead)
- `components/nutrition/studio/CalculationEngine.tsx` — Integrate TdeeWaterfallLegend, CalorieAdjustmentDisplay, MacroPercentageDisplay
- `components/nutrition/studio/ParameterAdjustmentPanel.tsx` — (no changes, but verify layout after topbar removal)
- `components/clients/useClientTopBar.tsx` — Add optional `actions` prop to pass action buttons

**Test files:**
- `tests/components/nutrition/studio/InfoModal.test.tsx` — Modal rendering, close, click outside
- (No schema/logic tests needed — all UI)

---

## Task Breakdown

### Task 1: Create InfoModal Component

**Files:**
- Create: `components/nutrition/studio/InfoModal.tsx`
- Test: `tests/components/nutrition/studio/InfoModal.test.tsx`

**Info Modal Structure:**
The InfoModal will be a reusable component that displays contextual help for injection actions. Each action (Base, Jour haut, Jour bas, Hydratation, Tous) gets its own modal configuration.

- [ ] **Step 1: Write failing test for InfoModal basic rendering**

```typescript
// tests/components/nutrition/studio/InfoModal.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InfoModal from '@/components/nutrition/studio/InfoModal'

describe('InfoModal', () => {
  it('renders modal with title and description when open', () => {
    render(
      <InfoModal
        isOpen={true}
        title="Injecter les macros calculées"
        description="Cette action va remplacer les calories..."
        example="Si vous injectez dans 'Jour entraînement'..."
        whenToUse="Utilisez ce bouton après avoir ajusté..."
        onClose={jest.fn()}
      />
    )
    expect(screen.getByText('Injecter les macros calculées')).toBeInTheDocument()
    expect(screen.getByText(/Cette action va remplacer/)).toBeInTheDocument()
  })

  it('closes modal when backdrop is clicked', async () => {
    const onClose = jest.fn()
    const { container } = render(
      <InfoModal
        isOpen={true}
        title="Test"
        description="Desc"
        example="Ex"
        whenToUse="When"
        onClose={onClose}
      />
    )
    const backdrop = container.querySelector('[data-testid="modal-backdrop"]')
    await userEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <InfoModal
        isOpen={false}
        title="Test"
        description="Desc"
        example="Ex"
        whenToUse="When"
        onClose={jest.fn()}
      />
    )
    expect(container.firstChild).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/user/Desktop/VIRTUS
npm test tests/components/nutrition/studio/InfoModal.test.tsx -- --no-coverage
```

Expected output: FAIL — "InfoModal is not defined"

- [ ] **Step 3: Implement InfoModal component**

```typescript
// components/nutrition/studio/InfoModal.tsx
'use client'

import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface InfoModalProps {
  isOpen: boolean
  title: string
  description: string
  example: string
  whenToUse: string
  onClose: () => void
}

export default function InfoModal({
  isOpen,
  title,
  description,
  example,
  whenToUse,
  onClose,
}: InfoModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="modal-backdrop"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-[#181818] rounded-2xl p-6 max-w-md w-full border border-white/[0.06] pointer-events-auto">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-[15px] font-bold text-white pr-4">{title}</h3>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white/60 transition-colors shrink-0"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-3">
                {/* Description */}
                <div>
                  <p className="text-[12px] text-white/60 leading-relaxed">{description}</p>
                </div>

                {/* Example */}
                <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.06]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40 mb-1.5">
                    Exemple
                  </p>
                  <p className="text-[12px] text-white/55 leading-relaxed font-mono">{example}</p>
                </div>

                {/* When to use */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40 mb-1.5">
                    Quand utiliser
                  </p>
                  <p className="text-[12px] text-white/55 leading-relaxed">{whenToUse}</p>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="w-full mt-4 h-10 rounded-lg bg-[#1f8a65] text-white text-[12px] font-bold uppercase tracking-[0.08em] hover:bg-[#217356] active:scale-[0.98] transition-all"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/components/nutrition/studio/InfoModal.test.tsx -- --no-coverage
```

Expected output: PASS (3/3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/nutrition/studio/InfoModal.tsx tests/components/nutrition/studio/InfoModal.test.tsx
git commit -m "feat(nutrition): add InfoModal component for injection action help"
```

---

### Task 2: Create Info Modal Definitions (Modal Content Configuration)

**Files:**
- Create: `lib/nutrition/infoModalDefinitions.ts`

**Description:** Define the 6 info modals for injection actions (Base, Jour haut, Jour bas, Hydratation, Tous, Carb Cycling toggle).

- [ ] **Step 1: Create info modal definitions**

```typescript
// lib/nutrition/infoModalDefinitions.ts
export interface InfoModalDef {
  title: string
  description: string
  example: string
  whenToUse: string
}

export const INJECTION_INFO_MODALS: Record<string, InfoModalDef> = {
  base: {
    title: 'Injecter les macros calculées',
    description:
      'Cette action va remplacer les calories, protéines, lipides et glucides du jour sélectionné avec les valeurs calculées ci-dessus.',
    example:
      'Si vous injectez dans "Jour entraînement", les macros deviendront : 2731 kcal, 122g protéines, 64g lipides, 417g glucides.',
    whenToUse:
      'Utilisez ce bouton après avoir ajusté votre objectif et vos paramètres pour populer le jour.',
  },
  carbCycleHigh: {
    title: 'Injecter un jour haut en glucides',
    description:
      'Cette action va injecter les macros optimisées pour un jour d\'entraînement avec un apport en glucides élevé.',
    example:
      'Un jour haut aura typiquement 350-400g de glucides pour supporter la performance, avec une quantité de lipides réduite.',
    whenToUse:
      'Utilisez ce bouton pour les jours d\'entraînement intensif afin de maximiser la performance et la récupération.',
  },
  carbCycleLow: {
    title: 'Injecter un jour bas en glucides',
    description:
      'Cette action va injecter les macros optimisées pour un jour de repos avec un apport en glucides réduit.',
    example:
      'Un jour bas aura typiquement 150-200g de glucides, compensé par un apport en lipides plus élevé pour atteindre les calories.',
    whenToUse:
      'Utilisez ce bouton pour les jours de repos ou de faible intensité pour optimiser l\'utilisation des graisses.',
  },
  hydration: {
    title: 'Injecter l\'hydratation recommandée',
    description:
      'Cette action va populer le champ hydratation avec le volume recommandé basé sur votre climat et votre activité.',
    example:
      'Pour un climat tempéré et un niveau d\'activité modéré, l\'hydratation recommandée est 3.8L (EFSA 2010).',
    whenToUse:
      'Utilisez ce bouton après avoir sélectionné votre climat pour obtenir une recommandation d\'hydratation personnalisée.',
  },
  allCalculations: {
    title: 'Injecter tous les calculs',
    description:
      'Cette action va remplacer toutes les données du jour sélectionné : macros (protéines, lipides, glucides) + hydratation.',
    example:
      'Injecter tous les calculs va remplir 2731 kcal, 122g protéines, 64g lipides, 417g glucides et 3.8L hydratation en une seule action.',
    whenToUse:
      'Utilisez ce bouton pour populer rapidement un jour complet avec tous les paramètres optimisés.',
  },
  carbCyclingToggle: {
    title: 'Carb Cycling — Alimentation cyclique en glucides',
    description:
      'Le Carb Cycling alterne automatiquement entre des jours hauts en glucides (entraînement) et des jours bas (repos) pour optimiser votre composition corporelle.',
    example:
      'En mode 2/1, vous aurez 2 jours hauts en glucides (>350g), puis 1 jour bas (<200g), puis le cycle recommence.',
    whenToUse:
      'Activez le Carb Cycling si vous cherchez une approche flexible pour adapter votre apport en glucides à votre programme d\'entraînement.',
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/nutrition/infoModalDefinitions.ts
git commit -m "feat(nutrition): add info modal definitions for injection actions"
```

---

### Task 3: Create TdeeWaterfallLegend Component

**Files:**
- Create: `components/nutrition/studio/TdeeWaterfallLegend.tsx`

**Description:** A simple legend component showing the 4 TDEE segments (BMR, NEAT, EAT, TEF) with colors.

- [ ] **Step 1: Create legend component**

```typescript
// components/nutrition/studio/TdeeWaterfallLegend.tsx
'use client'

interface TdeeWaterfallLegendProps {
  className?: string
}

const SEGMENTS = [
  { label: 'BMR (métabolisme de base)', color: '#3b82f6' },
  { label: 'NEAT (activité quotidienne)', color: '#8b5cf6' },
  { label: 'EAT (thermolyse)', color: '#f59e0b' },
  { label: 'TEF (digestion)', color: '#10b981' },
]

export default function TdeeWaterfallLegend({ className = '' }: TdeeWaterfallLegendProps) {
  return (
    <div className={`flex items-center gap-4 flex-wrap ${className}`}>
      {SEGMENTS.map(segment => (
        <div key={segment.label} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ backgroundColor: segment.color }}
          />
          <span className="text-[10px] text-white/50">{segment.label}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/nutrition/studio/TdeeWaterfallLegend.tsx
git commit -m "feat(nutrition): add TDEE waterfall legend component"
```

---

### Task 4: Create CalorieAdjustmentDisplay Component

**Files:**
- Create: `components/nutrition/studio/CalorieAdjustmentDisplay.tsx`

**Description:** Enhanced calorie adjustment slider showing percentage + delta in calories + color-coded badge.

- [ ] **Step 1: Create component**

```typescript
// components/nutrition/studio/CalorieAdjustmentDisplay.tsx
'use client'

interface CalorieAdjustmentDisplayProps {
  value: number // -30 to +30
  tdee: number | null // current TDEE in kcal
  onChange: (v: number) => void
}

function getAdjustmentBadge(pct: number): { label: string; color: string } {
  if (pct < -15) return { label: 'Déficit important', color: 'text-red-400' }
  if (pct < 0) return { label: 'Déficit modéré', color: 'text-amber-400' }
  if (pct === 0) return { label: 'Maintenance', color: 'text-white/60' }
  if (pct <= 15) return { label: 'Surplus léger', color: 'text-[#1f8a65]' }
  return { label: 'Surplus important', color: 'text-[#0f7d4a]' }
}

export default function CalorieAdjustmentDisplay({
  value,
  tdee,
  onChange,
}: CalorieAdjustmentDisplayProps) {
  const badge = getAdjustmentBadge(value)
  const deltaCal = tdee ? Math.round(tdee * (value / 100)) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-white">Ajustement calorique</span>
        <span className={`text-[12px] font-bold ${badge.color}`}>{badge.label}</span>
      </div>

      {/* Slider */}
      <input
        type="range"
        min="-30"
        max="30"
        step="1"
        value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full h-2 rounded-lg bg-gradient-to-r from-red-500/20 via-white/10 to-green-500/20 outline-none accent-[#1f8a65]"
        style={{
          background: `linear-gradient(to right, 
            rgb(239, 68, 68, 0.2) 0%, 
            rgb(251, 146, 60, 0.2) 25%, 
            rgb(255, 255, 255, 0.1) 50%, 
            rgb(16, 185, 129, 0.2) 75%, 
            rgb(16, 185, 129, 0.2) 100%)`,
        }}
      />

      {/* Display: %, kcal delta */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-baseline gap-1">
          <span className={`text-[16px] font-bold ${badge.color}`}>{value > 0 ? '+' : ''}{value}%</span>
          <span className="text-[11px] text-white/40">de l'apport</span>
        </div>
        {deltaCal !== 0 && (
          <div className="flex items-baseline gap-1">
            <span className={`text-[14px] font-semibold ${badge.color}`}>
              {deltaCal > 0 ? '+' : ''}{deltaCal}
            </span>
            <span className="text-[11px] text-white/40">kcal</span>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/nutrition/studio/CalorieAdjustmentDisplay.tsx
git commit -m "feat(nutrition): add enhanced calorie adjustment slider with delta display"
```

---

### Task 5: Create MacroPercentageDisplay Component

**Files:**
- Create: `components/nutrition/studio/MacroPercentageDisplay.tsx`

**Description:** Display macros as grams + % of total calories.

- [ ] **Step 1: Create component**

```typescript
// components/nutrition/studio/MacroPercentageDisplay.tsx
'use client'

interface MacroPercentageDisplayProps {
  proteinG: number
  fatG: number
  carbsG: number
  totalCalories: number
}

export default function MacroPercentageDisplay({
  proteinG,
  fatG,
  carbsG,
  totalCalories,
}: MacroPercentageDisplayProps) {
  if (!totalCalories) return null

  const proteinCal = proteinG * 4
  const fatCal = fatG * 9
  const carbsCal = carbsG * 4

  const proteinPct = Math.round((proteinCal / totalCalories) * 100)
  const fatPct = Math.round((fatCal / totalCalories) * 100)
  const carbsPct = Math.round((carbsCal / totalCalories) * 100)

  return (
    <div className="space-y-2">
      {/* Protéines */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-white">Protéines</span>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold text-white">{proteinG}g</span>
          <span className="text-[11px] text-white/50 w-12 text-right">{proteinPct}% kcal</span>
        </div>
      </div>

      {/* Lipides */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-white">Lipides</span>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold text-white">{fatG}g</span>
          <span className="text-[11px] text-white/50 w-12 text-right">{fatPct}% kcal</span>
        </div>
      </div>

      {/* Glucides */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-white">Glucides</span>
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-bold text-white">{carbsG}g</span>
          <span className="text-[11px] text-white/50 w-12 text-right">{carbsPct}% kcal</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/nutrition/studio/MacroPercentageDisplay.tsx
git commit -m "feat(nutrition): add macro percentage display component"
```

---

### Task 6: Integrate Enhancements into CalculationEngine

**Files:**
- Modify: `components/nutrition/studio/CalculationEngine.tsx`

**Description:** Replace existing display components with enhanced versions.

- [ ] **Step 1: Read CalculationEngine current structure**

Current structure (approx lines 100-200):
- TDEE waterfall (TdeeWaterfall component)
- Goal selector
- Macro display (inline bars)
- Carb Cycling toggle
- Hydration selector
- Smart Alerts

We'll replace:
- Add `TdeeWaterfallLegend` below TdeeWaterfall
- Replace inline calorie adjuster with `CalorieAdjustmentDisplay`
- Replace inline macro display with `MacroPercentageDisplay`

- [ ] **Step 2: Update imports and integrate components**

```typescript
// At top of CalculationEngine.tsx
import TdeeWaterfallLegend from './TdeeWaterfallLegend'
import CalorieAdjustmentDisplay from './CalorieAdjustmentDisplay'
import MacroPercentageDisplay from './MacroPercentageDisplay'

// In the render function, replace the calorie adjustment section:
// OLD: <input type="range" ... /> with labels

// NEW:
<CalorieAdjustmentDisplay
  value={calorieAdjustPct}
  tdee={macroResult?.tdee ?? null}
  onChange={onCalorieAdjustChange}
/>

// And add legend after TdeeWaterfall:
<TdeeWaterfallLegend className="mt-2" />

// And replace macro display bars:
{macroResult && (
  <MacroPercentageDisplay
    proteinG={macroResult.protein_g}
    fatG={macroResult.fat_g}
    carbsG={macroResult.carbs_g}
    totalCalories={macroResult.calories}
  />
)}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add components/nutrition/studio/CalculationEngine.tsx
git commit -m "feat(nutrition): integrate enhanced TDEE, calorie adjustment, and macro displays"
```

---

### Task 7: Add Info Icon + Modal State to ProtocolCanvas

**Files:**
- Modify: `components/nutrition/studio/ProtocolCanvas.tsx`

**Description:** Add info icons to injection buttons, add modal state management, integrate InfoModal component.

- [ ] **Step 1: Add state and imports**

```typescript
// At top of ProtocolCanvas.tsx
import { Info } from 'lucide-react'
import InfoModal from './InfoModal'
import { INJECTION_INFO_MODALS } from '@/lib/nutrition/infoModalDefinitions'
import { useState } from 'react'

// Inside ProtocolCanvas component
const [openInfoModal, setOpenInfoModal] = useState<string | null>(null)

function closeInfoModal() {
  setOpenInfoModal(null)
}

function openModal(key: string) {
  setOpenInfoModal(key)
}
```

- [ ] **Step 2: Update injection button rendering**

Look for lines rendering buttons like "← Base", "← Jour haut", etc.

Replace:
```typescript
// OLD
<button title="Injecter les macros...">
  ← Base
</button>

// NEW
<button
  onClick={() => onInjectMacros(activeDayIndex)}
  className="flex items-center justify-between w-full h-11 px-4 rounded-lg bg-[#1f8a65] text-white font-bold text-[12px] hover:bg-[#217356] active:scale-[0.98]"
>
  <span>← Base</span>
  <button
    onClick={e => {
      e.stopPropagation()
      openModal('base')
    }}
    className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.1] hover:bg-white/[0.2] text-white/60 hover:text-white"
  >
    <Info size={14} />
  </button>
</button>
```

Do the same for all 5 injection actions:
- `base` → INJECTION_INFO_MODALS.base
- `carbCycleHigh` → INJECTION_INFO_MODALS.carbCycleHigh
- `carbCycleLow` → INJECTION_INFO_MODALS.carbCycleLow
- `hydration` → INJECTION_INFO_MODALS.hydration
- `allCalculations` → INJECTION_INFO_MODALS.allCalculations

- [ ] **Step 3: Add InfoModal rendering at bottom of component**

```typescript
// Before closing </div> of ProtocolCanvas
{openInfoModal && INJECTION_INFO_MODALS[openInfoModal] && (
  <InfoModal
    isOpen={true}
    title={INJECTION_INFO_MODALS[openInfoModal]!.title}
    description={INJECTION_INFO_MODALS[openInfoModal]!.description}
    example={INJECTION_INFO_MODALS[openInfoModal]!.example}
    whenToUse={INJECTION_INFO_MODALS[openInfoModal]!.whenToUse}
    onClose={closeInfoModal}
  />
)}
```

- [ ] **Step 4: Verify ProtocolCanvas renders**

```bash
npm run dev
# Navigate to nutrition studio and verify buttons render with info icons
```

- [ ] **Step 5: Commit**

```bash
git add components/nutrition/studio/ProtocolCanvas.tsx
git commit -m "feat(nutrition): add info modal icons to injection buttons"
```

---

### Task 8: Add Carb Cycling Info Modal

**Files:**
- Modify: `components/nutrition/studio/CalculationEngine.tsx`

**Description:** Add info modal to Carb Cycling toggle button.

- [ ] **Step 1: Add state and imports**

```typescript
// At top of CalculationEngine.tsx
import InfoModal from './InfoModal'
import { INJECTION_INFO_MODALS } from '@/lib/nutrition/infoModalDefinitions'
import { useState } from 'react'

// Inside component
const [showCCInfo, setShowCCInfo] = useState(false)
```

- [ ] **Step 2: Update Carb Cycling toggle rendering**

Find the section where CC toggle is rendered. Update to add info button:

```typescript
// OLD: just text button "▶ Activer le Carb Cycling"

// NEW:
<div className="flex items-center gap-2">
  <button
    onClick={() => onCarbCyclingChange({ enabled: !carbCycling.enabled })}
    className="text-[12px] font-semibold text-[#1f8a65] hover:text-[#217356] transition-colors"
  >
    {carbCycling.enabled ? '▼ Carb Cycling activé' : '▶ Activer le Carb Cycling'}
  </button>
  <button
    onClick={() => setShowCCInfo(true)}
    className="flex h-5 w-5 items-center justify-center rounded-md text-white/40 hover:text-white/60 hover:bg-white/[0.05]"
  >
    <Info size={14} />
  </button>
</div>

{showCCInfo && (
  <InfoModal
    isOpen={true}
    title={INJECTION_INFO_MODALS.carbCyclingToggle.title}
    description={INJECTION_INFO_MODALS.carbCyclingToggle.description}
    example={INJECTION_INFO_MODALS.carbCyclingToggle.example}
    whenToUse={INJECTION_INFO_MODALS.carbCyclingToggle.whenToUse}
    onClose={() => setShowCCInfo(false)}
  />
)}
```

- [ ] **Step 3: Verify CC info modal works**

```bash
npm run dev
# Navigate to nutrition studio, toggle CC, click info icon
```

- [ ] **Step 4: Commit**

```bash
git add components/nutrition/studio/CalculationEngine.tsx
git commit -m "feat(nutrition): add Carb Cycling info modal"
```

---

### Task 9: Optimize Carb Cycling Card Layout

**Files:**
- Modify: `components/nutrition/studio/CalculationEngine.tsx`

**Description:** Reorganize CC preview cards and buttons for better hierarchy.

Current structure: Toggle → Description → Options (protocol, goal) → Preview cards → Secondary buttons

New structure: Toggle → Description → Protocol/Goal → Preview HIGH card + inject button → Preview LOW card + inject button → Secondary (Hydration, Tous)

- [ ] **Step 1: Reorganize CC section rendering**

Find the Carb Cycling section in CalculationEngine. Restructure as:

```typescript
{carbCycling.enabled && (
  <div className="space-y-3 bg-white/[0.02] rounded-lg p-4 border border-white/[0.06]">
    {/* Toggle + description */}
    <div>
      <p className="text-[12px] text-white/60 mb-1">
        Alterne automatiquement entre jours hauts et bas pour optimiser votre composition corporelle.
      </p>
    </div>

    {/* Protocol + Goal selectors */}
    <div className="grid grid-cols-2 gap-2">
      <SelectInput
        value={carbCycling.protocol}
        options={CC_PROTOCOLS}
        onChange={p => onCarbCyclingChange({ protocol: p })}
      />
      <SelectInput
        value={carbCycling.goal}
        options={CC_GOALS}
        onChange={g => onCarbCyclingChange({ goal: g })}
      />
    </div>

    {/* Preview JOUR HAUT */}
    <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.06]">
      <p className="text-[11px] font-semibold text-white mb-2">Jour haut en glucides</p>
      {ccResult && (
        <>
          <p className="text-[12px] text-white/60 mb-2">
            {ccResult.high.calories} kcal | P: {ccResult.high.protein}g L: {ccResult.high.fat}g G: {ccResult.high.carbs}g
          </p>
          <button
            onClick={() => onInjectCCHigh(activeDayIndex)}
            className="w-full flex items-center justify-between h-10 px-3 rounded-lg bg-[#1f8a65] text-white text-[12px] font-bold hover:bg-[#217356]"
          >
            <span>← Injecter jour haut</span>
            <button
              onClick={e => {
                e.stopPropagation()
                openModal('carbCycleHigh')
              }}
              className="flex h-5 w-5 items-center justify-center bg-white/[0.1] rounded hover:bg-white/[0.2]"
            >
              <Info size={13} />
            </button>
          </button>
        </>
      )}
    </div>

    {/* Preview JOUR BAS */}
    <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.06]">
      <p className="text-[11px] font-semibold text-white mb-2">Jour bas en glucides</p>
      {ccResult && (
        <>
          <p className="text-[12px] text-white/60 mb-2">
            {ccResult.low.calories} kcal | P: {ccResult.low.protein}g L: {ccResult.low.fat}g G: {ccResult.low.carbs}g
          </p>
          <button
            onClick={() => onInjectCCLow(activeDayIndex)}
            className="w-full flex items-center justify-between h-10 px-3 rounded-lg bg-[#1f8a65] text-white text-[12px] font-bold hover:bg-[#217356]"
          >
            <span>← Injecter jour bas</span>
            <button
              onClick={e => {
                e.stopPropagation()
                openModal('carbCycleLow')
              }}
              className="flex h-5 w-5 items-center justify-center bg-white/[0.1] rounded hover:bg-white/[0.2]"
            >
              <Info size={13} />
            </button>
          </button>
        </>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 2: Verify layout in dev**

```bash
npm run dev
# Activate CC, verify card order: toggle → protocol/goal → high preview → low preview
```

- [ ] **Step 3: Commit**

```bash
git add components/nutrition/studio/CalculationEngine.tsx
git commit -m "feat(nutrition): reorganize Carb Cycling card layout with clearer hierarchy"
```

---

### Task 10: Move Action Buttons to TopBar

**Files:**
- Modify: `components/clients/useClientTopBar.tsx`
- Modify: `components/nutrition/studio/NutritionStudio.tsx`
- Modify: `components/nutrition/studio/ProtocolCanvas.tsx`

**Description:** Move "Aperçu", "Brouillon", "Partager" buttons from ProtocolCanvas footer to TopBar.

- [ ] **Step 1: Update useClientTopBar to accept actions**

```typescript
// components/clients/useClientTopBar.tsx
import { useEffect } from 'react'
import { useSetTopBar } from './TopBarContext'

export interface TopBarAction {
  id: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  loading?: boolean
  variant?: 'primary' | 'secondary'
}

interface UseClientTopBarProps {
  title: string
  actions?: TopBarAction[]
}

export function useClientTopBar(title: string, actions?: TopBarAction[]) {
  const setTopBar = useSetTopBar()

  useEffect(() => {
    const rightButtons = actions
      ? actions.map(action => ({
          icon: action.icon,
          label: action.label,
          onClick: action.onClick,
          loading: action.loading,
          variant: action.variant || 'secondary',
        }))
      : []

    setTopBar({
      left: { section: 'Nutrition Studio', title },
      right: rightButtons,
    })
  }, [title, actions, setTopBar])
}
```

- [ ] **Step 2: Update NutritionStudio to define actions**

```typescript
// components/nutrition/studio/NutritionStudio.tsx
import { Eye, Save, ArrowRight } from 'lucide-react'

export default function NutritionStudio({ clientId, existingProtocol }: Props) {
  // ... existing code ...

  const actions = [
    {
      id: 'preview',
      label: 'Aperçu',
      icon: <Eye size={16} />,
      onClick: () => studio.setShowPreview(true),
      variant: 'secondary' as const,
    },
    {
      id: 'save',
      label: 'Brouillon',
      icon: <Save size={16} />,
      onClick: handleSave,
      loading: studio.saving,
      variant: 'secondary' as const,
    },
    {
      id: 'share',
      label: `Partager → ${clientName}`,
      icon: <ArrowRight size={16} />,
      onClick: handleShare,
      loading: studio.sharing,
      variant: 'primary' as const,
    },
  ]

  useClientTopBar('Nutrition Studio', actions)

  // ... rest of component, remove footer buttons from ProtocolCanvas ...
}
```

- [ ] **Step 3: Remove footer buttons from ProtocolCanvas**

In ProtocolCanvas, find and remove the sticky footer section with:
```typescript
// REMOVE THIS SECTION:
<div className="sticky bottom-0 bg-gradient-to-t from-[#121212] to-transparent p-4 border-t border-white/[0.04] flex items-center justify-between gap-3">
  <button onClick={onPreview}>Aperçu client</button>
  <button onClick={onSave}>Brouillon</button>
  <button onClick={onShare}>Partager → {clientName}</button>
</div>
```

- [ ] **Step 4: Verify TopBar rendering**

```bash
npm run dev
# Navigate to nutrition studio, verify buttons appear in TopBar
```

- [ ] **Step 5: Commit**

```bash
git add components/clients/useClientTopBar.tsx components/nutrition/studio/NutritionStudio.tsx components/nutrition/studio/ProtocolCanvas.tsx
git commit -m "feat(nutrition): move action buttons to TopBar"
```

---

### Task 11: Final UX Polish + Testing

**Files:**
- No files created, final polish and visual verification

**Description:** Verify all UX enhancements work together, test interactions.

- [ ] **Step 1: Manual integration test**

```bash
npm run dev
# Navigate to a nutrition protocol edit page
# Test checklist:
# - TopBar shows Aperçu, Brouillon, Partager buttons ✓
# - Click Aperçu opens ClientPreviewModal ✓
# - TDEE Waterfall shows legend below ✓
# - Calorie slider shows % + delta kcal + color badge ✓
# - Macros display shows grams + % of calories ✓
# - Click info icon on injection buttons opens modal ✓
# - Carb Cycling toggle has info icon ✓
# - CC preview cards in right order (high → low) ✓
# - Secondary buttons (Hydration, Tous) visible ✓
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Update CHANGELOG.md**

```markdown
## 2026-04-26

FEATURE: Nutrition Studio UX refactor — TopBar action buttons, info modals for injections, enhanced displays
FEATURE: Add TDEE Waterfall legend with 4 segments
FEATURE: Enhance calorie adjustment slider with percentage + delta kcal + color coding
FEATURE: Display macro percentages alongside grams
FEATURE: Add clickable info modal system for injection actions (replaces hover tooltips)
FEATURE: Optimize Carb Cycling card layout with clearer hierarchy
```

- [ ] **Step 4: Update project-state.md**

Add new section:
```markdown
## 2026-04-26 — Nutrition Studio UX Refactor — Phase 1 Complete

**Ce qui a été fait :**

1. **TopBar Integration** — Action buttons ("Aperçu", "Brouillon", "Partager") moved to TopBar via enhanced `useClientTopBar` hook
2. **Info Modal System** — Reusable `InfoModal` component + 6 modal definitions (Base, Jour haut, Jour bas, Hydratation, Tous, Carb Cycling)
3. **TDEE Legend** — 4-segment legend below waterfall (BMR, NEAT, EAT, TEF)
4. **Calorie Adjustment** — Enhanced slider with `% | ±kcal | Colored Badge`
5. **Macro Display** — Grams + `% of calories` for P/L/G
6. **Carb Cycling Layout** — Reorganized hierarchy: toggle → preview high → inject high → preview low → inject low → secondary
7. **Info Icons** — Replaced hover `?` with clickable ⓘ icons on complex actions

**Points de vigilance :**
- Info modals use `AnimatePresence` for smooth transitions
- Color coding: red < -15%, amber -15% to 0%, green 0% to +15%, dark green > +15%
- CC layout assumes `ccResult` has `.high` and `.low` properties with calories/protein/fat/carbs
- TopBar actions passed via `useClientTopBar(..., actions)` — requires TopBarContext provider in coach layouts
```

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update changelog and project state for Nutrition Studio UX refactor"
```

---

## Self-Review Checklist

**Spec Coverage:**
- ✅ TopBar action buttons (Task 10)
- ✅ TDEE legend (Task 3, 6)
- ✅ Calorie adjustment with % + delta (Task 4, 6)
- ✅ Macro percentages (Task 5, 6)
- ✅ Clickable info modals (Tasks 1, 2, 7, 8)
- ✅ Carb Cycling optimization (Task 9)

**Placeholder Scan:**
- No "TBD", "TODO", or "implement later" patterns
- All component code complete with implementation
- All test cases include assertions and expected outputs
- All commit messages follow convention

**Type Consistency:**
- `INJECTION_INFO_MODALS` Record matches InfoModal props
- `TopBarAction` interface matches usage in useClientTopBar
- All color values consistent (e.g., `#1f8a65`, `text-red-400`)
- Function signatures stable across tasks

**Scope Check:**
- Implementation is UI/UX only — no schema, no API changes
- No breaking changes to existing components
- All new components are self-contained and reusable
- No unrelated refactoring included

---

**Plan saved to `docs/superpowers/plans/2026-04-26-nutrition-studio-ux-refactor.md`**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?