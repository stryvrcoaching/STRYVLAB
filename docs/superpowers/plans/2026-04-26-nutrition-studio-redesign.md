# Nutrition Studio Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refonte totale de l'outil de création/édition de protocoles nutritionnels en un layout 3 colonnes fixes (Intelligence Client | Moteur de Calcul | Protocol Canvas), inspiré MacroFactor, avec calcul temps réel, Coherence Score, et Preview client.

**Architecture:** Remplacement complet de `NutritionProtocolTool.tsx` (1584 lignes monolithique) par une architecture modulaire — 5 nouveaux composants dédiés + 1 hook de state centralisé. Toute la logique back-end (macros.ts, carbCycling.ts, hydration.ts, APIs) est conservée sans modification. Seule la couche UI/UX est refaite.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind CSS, DS v2.0 (#121212, #1f8a65), Framer Motion, Lucide React, debounce maison (300ms)

---

## File Map

### Nouveaux fichiers à créer

| Fichier | Responsabilité |
|---------|---------------|
| `components/nutrition/studio/NutritionStudio.tsx` | Orchestrateur 3 colonnes — remplace NutritionProtocolTool |
| `components/nutrition/studio/useNutritionStudio.ts` | Hook centralisé : state + calculs + debounce |
| `components/nutrition/studio/ClientIntelligencePanel.tsx` | Colonne 1 — données client (read + sections éditables) |
| `components/nutrition/studio/CalculationEngine.tsx` | Colonne 2 — TDEE waterfall + macros + CC + hydratation + smart alerts |
| `components/nutrition/studio/ProtocolCanvas.tsx` | Colonne 3 — jours + coherence score + injection + save |
| `components/nutrition/studio/CoherenceScore.tsx` | Composant score 0-100 avec détail |
| `components/nutrition/studio/MacroBar.tsx` | Barre macro segmentée réutilisable (P/L/G colorés) |
| `components/nutrition/studio/TdeeWaterfall.tsx` | Graphique horizontal BMR→NEAT→EAT→TEF→TDEE |
| `components/nutrition/studio/ClientPreviewModal.tsx` | Modal preview vue client |

### Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `app/coach/clients/[clientId]/protocoles/nutrition/new/page.tsx` | Remplacer `NutritionProtocolTool` par `NutritionStudio` |
| `app/coach/clients/[clientId]/protocoles/nutrition/[protocolId]/edit/page.tsx` | Idem |
| `CHANGELOG.md` | Entrée feature |
| `.claude/rules/project-state.md` | Mise à jour état projet |

### Fichiers NON modifiés (back-end conservé intact)

- `lib/formulas/macros.ts` — aucun changement
- `lib/formulas/carbCycling.ts` — aucun changement
- `lib/formulas/hydration.ts` — aucun changement
- `lib/nutrition/types.ts` — aucun changement
- `app/api/clients/[clientId]/nutrition-protocols/*` — aucun changement
- `app/api/clients/[clientId]/nutrition-data/route.ts` — aucun changement
- `components/nutrition/NutritionProtocolDashboard.tsx` — aucun changement

---

## Task 1: Hook centralisé `useNutritionStudio`

Ce hook gère tout le state partagé entre les 3 colonnes, les calculs debounced, et les actions (injection, save, share).

**Files:**
- Create: `components/nutrition/studio/useNutritionStudio.ts`

- [ ] **Step 1: Créer le fichier hook**

```typescript
// components/nutrition/studio/useNutritionStudio.ts
'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  calculateMacros,
  type MacroGoal, type MacroGender, type MacroResult,
} from '@/lib/formulas/macros'
import {
  calculateCarbCycling,
  type CarbCyclingResult, type CarbCycleProtocol, type CarbCycleGoal,
  type CarbCycleIntensity, type CarbCyclePhase, type CarbCycleInsulin,
} from '@/lib/formulas/carbCycling'
import { calculateHydration, type HydrationClimate } from '@/lib/formulas/hydration'
import {
  type DayDraft, type NutritionProtocol, type NutritionClientData,
  emptyDayDraft, dayDraftFromDb,
} from '@/lib/nutrition/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive'

export interface TrainingConfig {
  weeklyFrequency: number
  sessionDurationMin: number
  cardioFrequency: number
  cardioDurationMin: number
  dailySteps: number
  trainingCaloriesWeekly: number | null
}

export interface LifestyleConfig {
  stressLevel: number | null
  sleepDurationH: number | null
  sleepQuality: number | null
  caffeineDailyMg: number | null
  alcoholWeekly: number | null
  workHoursPerWeek: number | null
}

export interface CarbCyclingConfig {
  enabled: boolean
  protocol: CarbCycleProtocol
  goal: CarbCycleGoal
  phase: CarbCyclePhase
  intensity: CarbCycleIntensity
  insulin: CarbCycleInsulin
}

export interface NutritionStudioState {
  // Protocol metadata
  protocolName: string
  // Client data (injected + overrideable sections)
  clientData: NutritionClientData | null
  // Editable training config (col 1 section D)
  trainingConfig: TrainingConfig
  // Editable lifestyle config (col 1 section D)
  lifestyleConfig: LifestyleConfig
  // Macro engine config (col 2)
  goal: MacroGoal
  calorieAdjustPct: number      // -30 to +30
  proteinOverrideGPerKg: number | null
  // Carb cycling (col 2)
  carbCycling: CarbCyclingConfig
  // Hydration (col 2)
  hydrationClimate: HydrationClimate
  // Protocol days (col 3)
  days: DayDraft[]
  activeDayIndex: number
  // Results (computed)
  macroResult: MacroResult | null
  ccResult: CarbCyclingResult | null
  hydrationLiters: number | null
  // UI state
  saving: boolean
  sharing: boolean
  showPreview: boolean
}

const ACTIVITY_STEPS: Record<ActivityLevel, number> = {
  sedentary: 2000, light: 4000, moderate: 7000, active: 11000, veryActive: 15000,
}

const HYDRATION_ACTIVITY_MAP: Record<ActivityLevel, 'sedentary' | 'light' | 'moderate' | 'intense' | 'athlete'> = {
  sedentary: 'sedentary', light: 'light', moderate: 'moderate', active: 'intense', veryActive: 'athlete',
}

const CLIENT_GOAL_MAP: Record<string, MacroGoal> = {
  fat_loss: 'deficit', weight_loss: 'deficit', sèche: 'deficit', cut: 'deficit',
  muscle_gain: 'surplus', hypertrophy: 'surplus', prise_de_masse: 'surplus', bulk: 'surplus',
  maintenance: 'maintenance', recomposition: 'maintenance',
}

const MACRO_TO_CC_GOAL: Record<MacroGoal, CarbCycleGoal> = {
  deficit: 'moderate', maintenance: 'recomp', surplus: 'bulk',
}

function getActivityLevel(clientData: NutritionClientData): ActivityLevel {
  const freq = clientData.weekly_frequency ?? 0
  if (freq === 0) return 'sedentary'
  if (freq <= 2) return 'light'
  if (freq <= 3) return 'moderate'
  if (freq <= 5) return 'active'
  return 'veryActive'
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNutritionStudio(clientId: string, existingProtocol?: NutritionProtocol) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── State ──────────────────────────────────────────────────────────────────
  const [clientData, setClientData]             = useState<NutritionClientData | null>(null)
  const [clientLoading, setClientLoading]       = useState(true)
  const [protocolName, setProtocolName]         = useState(existingProtocol?.name ?? 'Nouveau protocole')
  const [goal, setGoal]                         = useState<MacroGoal>('surplus')
  const [calorieAdjustPct, setCalorieAdjustPct] = useState(0)
  const [proteinOverride, setProteinOverride]   = useState<number | null>(null)
  const [trainingConfig, setTrainingConfig]     = useState<TrainingConfig>({
    weeklyFrequency: 3, sessionDurationMin: 60, cardioFrequency: 0,
    cardioDurationMin: 0, dailySteps: 0, trainingCaloriesWeekly: null,
  })
  const [lifestyleConfig, setLifestyleConfig]   = useState<LifestyleConfig>({
    stressLevel: null, sleepDurationH: null, sleepQuality: null,
    caffeineDailyMg: null, alcoholWeekly: null, workHoursPerWeek: null,
  })
  const [carbCycling, setCarbCycling]           = useState<CarbCyclingConfig>({
    enabled: false, protocol: '3/1', goal: 'bulk',
    phase: 'hypertrophie', intensity: 'moderee', insulin: 'normale',
  })
  const [hydrationClimate, setHydrationClimate] = useState<HydrationClimate>('temperate')
  const [days, setDays]                         = useState<DayDraft[]>([
    emptyDayDraft('Jour entraînement'),
    emptyDayDraft('Jour repos'),
  ])
  const [activeDayIndex, setActiveDayIndex]     = useState(0)
  const [macroResult, setMacroResult]           = useState<MacroResult | null>(null)
  const [ccResult, setCcResult]                 = useState<CarbCyclingResult | null>(null)
  const [hydrationLiters, setHydrationLiters]   = useState<number | null>(null)
  const [saving, setSaving]                     = useState(false)
  const [sharing, setSharing]                   = useState(false)
  const [showPreview, setShowPreview]           = useState(false)

  // ── Fetch client data ──────────────────────────────────────────────────────
  useEffect(() => {
    setClientLoading(true)
    fetch(`/api/clients/${clientId}/nutrition-data`)
      .then(r => r.json())
      .then(d => {
        const cd: NutritionClientData = d.client
        setClientData(cd)
        // Pre-populate goal from client profile
        if (cd.training_goal) {
          const mapped = CLIENT_GOAL_MAP[cd.training_goal.toLowerCase()] ?? 'maintenance'
          setGoal(mapped)
          setCarbCycling(prev => ({ ...prev, goal: MACRO_TO_CC_GOAL[mapped] }))
        }
        // Pre-populate training config
        setTrainingConfig({
          weeklyFrequency: cd.weekly_frequency ?? 3,
          sessionDurationMin: cd.session_duration_min ?? 60,
          cardioFrequency: cd.cardio_frequency ?? 0,
          cardioDurationMin: cd.cardio_duration_min ?? 0,
          dailySteps: cd.daily_steps ?? 0,
          trainingCaloriesWeekly: cd.training_calories_weekly,
        })
        // Pre-populate lifestyle config
        setLifestyleConfig({
          stressLevel: cd.stress_level,
          sleepDurationH: cd.sleep_duration_h,
          sleepQuality: cd.sleep_quality,
          caffeineDailyMg: cd.caffeine_daily_mg,
          alcoholWeekly: cd.alcohol_weekly,
          workHoursPerWeek: cd.work_hours_per_week,
        })
      })
      .catch(() => {})
      .finally(() => setClientLoading(false))
  }, [clientId])

  // ── Load existing protocol days ────────────────────────────────────────────
  useEffect(() => {
    if (existingProtocol?.days?.length) {
      setDays(existingProtocol.days.map(dayDraftFromDb))
      setProtocolName(existingProtocol.name)
    }
  }, [existingProtocol])

  // ── Debounced recalculation ────────────────────────────────────────────────
  const recalculate = useCallback(() => {
    if (!clientData) return
    const cd = clientData
    const gender: MacroGender = cd.gender === 'female' ? 'female' : 'male'
    if (!cd.weight_kg || !cd.height_cm || !cd.age) return

    // Macro calculation
    const input = {
      weight: cd.weight_kg,
      height: cd.height_cm,
      age: cd.age,
      gender,
      goal,
      bodyFat: cd.body_fat_pct ?? undefined,
      muscleMassKg: cd.muscle_mass_kg ?? undefined,
      bmrKcalMeasured: cd.bmr_kcal_measured ?? undefined,
      visceralFatLevel: cd.visceral_fat_level ?? undefined,
      steps: trainingConfig.dailySteps || undefined,
      occupationMultiplier: cd.occupation_multiplier ?? undefined,
      workHoursPerWeek: lifestyleConfig.workHoursPerWeek ?? undefined,
      workouts: trainingConfig.weeklyFrequency,
      sessionDurationMin: trainingConfig.sessionDurationMin,
      trainingCaloriesWeekly: trainingConfig.trainingCaloriesWeekly ?? undefined,
      cardioFrequency: trainingConfig.cardioFrequency || undefined,
      cardioDurationMin: trainingConfig.cardioDurationMin || undefined,
      stressLevel: lifestyleConfig.stressLevel ?? undefined,
      sleepDurationH: lifestyleConfig.sleepDurationH ?? undefined,
      sleepQuality: lifestyleConfig.sleepQuality ?? undefined,
      caffeineDaily: lifestyleConfig.caffeineDailyMg ?? undefined,
      alcoholWeekly: lifestyleConfig.alcoholWeekly ?? undefined,
    }

    const result = calculateMacros(input)
    // Apply calorie adjustment percentage
    if (calorieAdjustPct !== 0) {
      const factor = 1 + calorieAdjustPct / 100
      result.calories = Math.round(result.calories * factor)
      const pKcal = proteinOverride != null
        ? Math.round(proteinOverride * result.leanMass) * 4
        : result.macros.p * 4
      const fKcal = result.macros.f * 9
      result.macros.c = Math.max(0, Math.round((result.calories - pKcal - fKcal) / 4))
    }
    if (proteinOverride != null) {
      result.macros.p = Math.round(proteinOverride * result.leanMass)
      const remaining = result.calories - result.macros.p * 4 - result.macros.f * 9
      result.macros.c = Math.max(0, Math.round(remaining / 4))
    }
    setMacroResult(result)

    // Carb cycling calculation
    if (carbCycling.enabled) {
      const ccInput = {
        gender: gender as 'male' | 'female',
        age: cd.age,
        weight: cd.weight_kg,
        height: cd.height_cm,
        bodyFat: cd.body_fat_pct ?? undefined,
        occupation: 'sedentaire' as const,
        sessionsPerWeek: trainingConfig.weeklyFrequency,
        sessionDuration: trainingConfig.sessionDurationMin,
        intensity: carbCycling.intensity,
        goal: carbCycling.goal,
        phase: carbCycling.phase,
        protocol: carbCycling.protocol,
        insulin: carbCycling.insulin,
      }
      setCcResult(calculateCarbCycling(ccInput))
    } else {
      setCcResult(null)
    }

    // Hydration calculation
    const actLevel = getActivityLevel(cd)
    const hydInput = {
      weight: cd.weight_kg,
      gender: gender as 'male' | 'female',
      activity: HYDRATION_ACTIVITY_MAP[actLevel],
      climate: hydrationClimate,
    }
    const hydResult = calculateHydration(hydInput)
    setHydrationLiters(hydResult.liters)
  }, [clientData, goal, calorieAdjustPct, proteinOverride, trainingConfig, lifestyleConfig, carbCycling, hydrationClimate])

  // Debounce trigger
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(recalculate, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [recalculate])

  // ── Coherence Score ────────────────────────────────────────────────────────
  const coherenceScore = useMemo((): { score: number; checks: { label: string; ok: boolean; warning?: string }[] } => {
    if (!macroResult) return { score: 0, checks: [] }
    const checks: { label: string; ok: boolean; warning?: string }[] = []
    const { macros, leanMass, calories } = macroResult

    // Protein check: >= 1.8g/kg LBM
    const protPerKg = leanMass > 0 ? macros.p / leanMass : 0
    checks.push({
      label: 'Protéines', ok: protPerKg >= 1.8,
      warning: protPerKg < 1.8 ? `${protPerKg.toFixed(1)}g/kg LBM (min 1.8)` : undefined,
    })

    // Fat check: >= 0.6g/kg BW
    const fatPerKg = clientData ? macros.f / clientData.weight_kg! : 0
    checks.push({
      label: 'Lipides', ok: fatPerKg >= 0.6,
      warning: fatPerKg < 0.6 ? 'Risque hormonal' : undefined,
    })

    // Calorie floor: > 1200 (female) or > 1500 (male)
    const floor = clientData?.gender === 'female' ? 1200 : 1500
    checks.push({
      label: 'Calories min.', ok: calories >= floor,
      warning: calories < floor ? `${calories} kcal sous le minimum` : undefined,
    })

    // Carb warning (informational, not blocking)
    const carbsPerKg = clientData ? macros.c / clientData.weight_kg! : 0
    const carbWarning = carbsPerKg > 8
    checks.push({
      label: 'Glucides', ok: !carbWarning,
      warning: carbWarning ? `${macros.c}g = ${carbsPerKg.toFixed(0)}g/kg — répartir 4-5 repas` : undefined,
    })

    // Hydration check
    checks.push({ label: 'Hydratation', ok: hydrationLiters !== null })

    const passCount = checks.filter(c => c.ok).length
    const score = Math.round((passCount / checks.length) * 100)
    return { score, checks }
  }, [macroResult, hydrationLiters, clientData])

  // ── Day actions ────────────────────────────────────────────────────────────
  const updateDay = useCallback((index: number, patch: Partial<DayDraft>) => {
    setDays(prev => prev.map((d, i) => i === index ? { ...d, ...patch } : d))
  }, [])

  const addDay = useCallback((name?: string) => {
    setDays(prev => [...prev, emptyDayDraft(name ?? `Jour ${prev.length + 1}`)])
    setActiveDayIndex(days.length)
  }, [days.length])

  const removeDay = useCallback((index: number) => {
    setDays(prev => prev.filter((_, i) => i !== index))
    setActiveDayIndex(prev => Math.max(0, prev >= index ? prev - 1 : prev))
  }, [])

  // ── Injection actions ──────────────────────────────────────────────────────
  const injectMacrosToDay = useCallback((dayIndex: number) => {
    if (!macroResult) return
    updateDay(dayIndex, {
      calories: String(macroResult.calories),
      protein_g: String(macroResult.macros.p),
      carbs_g: String(macroResult.macros.c),
      fat_g: String(macroResult.macros.f),
    })
  }, [macroResult, updateDay])

  const injectCCHighToDay = useCallback((dayIndex: number) => {
    if (!ccResult) return
    updateDay(dayIndex, {
      calories: String(ccResult.high.kcal),
      protein_g: String(ccResult.high.p),
      carbs_g: String(ccResult.high.c),
      fat_g: String(ccResult.high.f),
      carb_cycle_type: 'high',
    })
  }, [ccResult, updateDay])

  const injectCCLowToDay = useCallback((dayIndex: number) => {
    if (!ccResult) return
    updateDay(dayIndex, {
      calories: String(ccResult.low.kcal),
      protein_g: String(ccResult.low.p),
      carbs_g: String(ccResult.low.c),
      fat_g: String(ccResult.low.f),
      carb_cycle_type: 'low',
    })
  }, [ccResult, updateDay])

  const injectHydrationToDay = useCallback((dayIndex: number) => {
    if (!hydrationLiters) return
    updateDay(dayIndex, { hydration_ml: String(Math.round(hydrationLiters * 1000)) })
  }, [hydrationLiters, updateDay])

  const injectAllToDay = useCallback((dayIndex: number) => {
    injectMacrosToDay(dayIndex)
    injectHydrationToDay(dayIndex)
  }, [injectMacrosToDay, injectHydrationToDay])

  // ── Save / Share ───────────────────────────────────────────────────────────
  const buildPayload = useCallback(() => ({
    name: protocolName,
    days: days.map((d, i) => ({
      name: d.name,
      position: i,
      calories: d.calories ? Number(d.calories) : null,
      protein_g: d.protein_g ? Number(d.protein_g) : null,
      carbs_g: d.carbs_g ? Number(d.carbs_g) : null,
      fat_g: d.fat_g ? Number(d.fat_g) : null,
      hydration_ml: d.hydration_ml ? Number(d.hydration_ml) : null,
      carb_cycle_type: d.carb_cycle_type || null,
      cycle_sync_phase: d.cycle_sync_phase || null,
      recommendations: d.recommendations || null,
    })),
  }), [protocolName, days])

  const save = useCallback(async (): Promise<string | null> => {
    setSaving(true)
    try {
      const payload = buildPayload()
      if (existingProtocol) {
        await fetch(`/api/clients/${clientId}/nutrition-protocols/${existingProtocol.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        return existingProtocol.id
      } else {
        const r = await fetch(`/api/clients/${clientId}/nutrition-protocols`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const d = await r.json()
        return d.protocol?.id ?? null
      }
    } finally {
      setSaving(false)
    }
  }, [buildPayload, clientId, existingProtocol])

  const share = useCallback(async () => {
    setSharing(true)
    try {
      const id = await save()
      if (!id) return
      await fetch(`/api/clients/${clientId}/nutrition-protocols/${id}/share`, { method: 'POST' })
    } finally {
      setSharing(false)
    }
  }, [save, clientId])

  return {
    // state
    clientData, clientLoading, protocolName, setProtocolName,
    goal, setGoal,
    calorieAdjustPct, setCalorieAdjustPct,
    proteinOverride, setProteinOverride,
    trainingConfig, setTrainingConfig,
    lifestyleConfig, setLifestyleConfig,
    carbCycling, setCarbCycling,
    hydrationClimate, setHydrationClimate,
    days, activeDayIndex, setActiveDayIndex,
    // results
    macroResult, ccResult, hydrationLiters, coherenceScore,
    // day actions
    updateDay, addDay, removeDay,
    // injection
    injectMacrosToDay, injectCCHighToDay, injectCCLowToDay,
    injectHydrationToDay, injectAllToDay,
    // ui
    saving, sharing, showPreview, setShowPreview,
    save, share,
  }
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 erreurs liées au nouveau fichier.

- [ ] **Step 3: Commit**

```bash
git add components/nutrition/studio/useNutritionStudio.ts
git commit -m "feat(nutrition-studio): add centralized state hook with debounced recalculation"
```

---

## Task 2: Composant `MacroBar` — barre macro segmentée réutilisable

**Files:**
- Create: `components/nutrition/studio/MacroBar.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/nutrition/studio/MacroBar.tsx
'use client'

interface MacroBarProps {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  height?: number  // px, default 6
  showLabels?: boolean
}

export default function MacroBar({
  calories, protein_g, carbs_g, fat_g, height = 6, showLabels = false,
}: MacroBarProps) {
  const total = protein_g * 4 + fat_g * 9 + carbs_g * 4
  if (total === 0) return <div className="w-full rounded-full bg-white/[0.06]" style={{ height }} />

  const pct = {
    p: Math.round((protein_g * 4 / total) * 100),
    f: Math.round((fat_g * 9 / total) * 100),
    c: 0,
  }
  pct.c = 100 - pct.p - pct.f

  return (
    <div className="w-full space-y-1">
      <div className="flex w-full overflow-hidden rounded-full" style={{ height }}>
        <div style={{ width: `${pct.p}%` }} className="bg-blue-400 transition-all duration-300" />
        <div style={{ width: `${pct.f}%` }} className="bg-amber-400 transition-all duration-300" />
        <div style={{ width: `${pct.c}%` }} className="bg-[#1f8a65] transition-all duration-300" />
      </div>
      {showLabels && (
        <div className="flex justify-between text-[9px] text-white/40">
          <span className="text-blue-400">P {pct.p}%</span>
          <span className="text-amber-400">L {pct.f}%</span>
          <span className="text-[#1f8a65]">G {pct.c}%</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add components/nutrition/studio/MacroBar.tsx
git commit -m "feat(nutrition-studio): add reusable MacroBar component"
```

---

## Task 3: Composant `TdeeWaterfall` — graphique décomposition TDEE

**Files:**
- Create: `components/nutrition/studio/TdeeWaterfall.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/nutrition/studio/TdeeWaterfall.tsx
'use client'

import type { MacroResult } from '@/lib/formulas/macros'

interface TdeeWaterfallProps {
  result: MacroResult
}

const SOURCE_LABELS: Record<string, string> = {
  measured: '● Mesuré',
  'katch-mcardle': '◐ Katch',
  mifflin: '◌ Mifflin',
  steps: '● Pas',
  'activity-level': '◐ Activité',
  tracker: '● Tracker',
  'duration-met': '◐ MET',
  table: '◌ Table',
  'duration-met_cardio': '◐ MET',
  none: '',
}

export default function TdeeWaterfall({ result }: TdeeWaterfallProps) {
  const { breakdown, tdee, dataProvenance } = result
  const total = tdee

  const items = [
    { key: 'bmr',  label: 'BMR',  value: breakdown.bmr,       color: 'bg-blue-500',   source: SOURCE_LABELS[dataProvenance.bmrSource] },
    { key: 'neat', label: 'NEAT', value: breakdown.neat,      color: 'bg-purple-400', source: SOURCE_LABELS[dataProvenance.neatSource] },
    { key: 'eat',  label: 'EAT',  value: breakdown.eat + breakdown.eatCardio, color: 'bg-[#1f8a65]', source: SOURCE_LABELS[dataProvenance.eatSource] },
    { key: 'tef',  label: 'TEF',  value: breakdown.tef,       color: 'bg-amber-400',  source: '● 10% BMR' },
  ]

  return (
    <div className="space-y-2">
      {/* Equation header */}
      <div className="flex items-center gap-1 text-[11px] font-mono flex-wrap">
        {items.map((item, i) => (
          <span key={item.key} className="flex items-center gap-1">
            {i > 0 && <span className="text-white/30">+</span>}
            <span className="text-white/70">{item.value}</span>
            <span className="text-white/30 text-[9px]">{item.label}</span>
          </span>
        ))}
        <span className="text-white/30">=</span>
        <span className="text-white font-bold">{total}</span>
        <span className="text-white/30 text-[9px]">TDEE</span>
      </div>

      {/* Stacked bar */}
      <div className="flex w-full h-[6px] overflow-hidden rounded-full bg-white/[0.04]">
        {items.map(item => (
          <div
            key={item.key}
            className={`${item.color} transition-all duration-500`}
            style={{ width: `${Math.round((item.value / total) * 100)}%` }}
          />
        ))}
      </div>

      {/* Source labels */}
      <div className="flex gap-3 flex-wrap">
        {items.map(item => item.source ? (
          <span key={item.key} className="text-[9px] text-white/35">
            {item.label} {item.source}
          </span>
        ) : null)}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add components/nutrition/studio/TdeeWaterfall.tsx
git commit -m "feat(nutrition-studio): add TdeeWaterfall breakdown component"
```

---

## Task 4: Composant `CoherenceScore`

**Files:**
- Create: `components/nutrition/studio/CoherenceScore.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/nutrition/studio/CoherenceScore.tsx
'use client'

import { CheckCircle2, AlertTriangle } from 'lucide-react'

interface CoherenceScoreProps {
  score: number
  checks: { label: string; ok: boolean; warning?: string }[]
}

function getScoreConfig(score: number) {
  if (score >= 90) return { label: 'Excellent', color: 'text-[#1f8a65]', barColor: 'bg-[#1f8a65]' }
  if (score >= 75) return { label: 'Bon', color: 'text-blue-400', barColor: 'bg-blue-400' }
  if (score >= 55) return { label: 'Acceptable', color: 'text-amber-400', barColor: 'bg-amber-400' }
  return { label: 'À corriger', color: 'text-red-400', barColor: 'bg-red-400' }
}

export default function CoherenceScore({ score, checks }: CoherenceScoreProps) {
  const config = getScoreConfig(score)

  return (
    <div className="space-y-2">
      {/* Score header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
          Cohérence
        </span>
        <span className={`text-[13px] font-bold ${config.color}`}>
          {score}/100 — {config.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-[4px] w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${config.barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Checks */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
        {checks.map(check => (
          <div key={check.label} className="flex items-center gap-1">
            {check.ok
              ? <CheckCircle2 size={10} className="text-[#1f8a65] shrink-0" />
              : <AlertTriangle size={10} className="text-amber-400 shrink-0" />
            }
            <span className={`text-[9px] ${check.ok ? 'text-white/50' : 'text-amber-400'}`}>
              {check.warning ?? check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add components/nutrition/studio/CoherenceScore.tsx
git commit -m "feat(nutrition-studio): add CoherenceScore component"
```

---

## Task 5: Composant `ClientIntelligencePanel` — colonne 1

**Files:**
- Create: `components/nutrition/studio/ClientIntelligencePanel.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/nutrition/studio/ClientIntelligencePanel.tsx
'use client'

import { useState } from 'react'
import { Pencil, Check, AlertTriangle, Activity, Moon, Coffee, Wine } from 'lucide-react'
import type { NutritionClientData } from '@/lib/nutrition/types'
import type { TrainingConfig, LifestyleConfig } from './useNutritionStudio'

interface Props {
  clientData: NutritionClientData | null
  loading: boolean
  trainingConfig: TrainingConfig
  lifestyleConfig: LifestyleConfig
  onTrainingChange: (patch: Partial<TrainingConfig>) => void
  onLifestyleChange: (patch: Partial<LifestyleConfig>) => void
  macroResult: { leanMass: number; estimatedBF: number; breakdown: { bmr: number } } | null
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35 mb-2">
      {children}
    </p>
  )
}

function DataRow({ label, value, unit, source, warning }: {
  label: string; value: string | number | null; unit?: string; source?: string; warning?: boolean
}) {
  if (value == null) return null
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-white/50">{label}</span>
      <div className="flex items-center gap-1.5">
        {warning && <AlertTriangle size={10} className="text-amber-400" />}
        <span className={`text-[12px] font-medium ${warning ? 'text-amber-400' : 'text-white/85'}`}>
          {value}{unit ? ` ${unit}` : ''}
        </span>
        {source && <span className="text-[9px] text-white/25">{source}</span>}
      </div>
    </div>
  )
}

function NumberInput({ label, value, unit, onChange, min = 0, max = 999 }: {
  label: string; value: number | null; unit?: string
  onChange: (v: number) => void; min?: number; max?: number
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[11px] text-white/50">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value ?? ''}
          min={min}
          max={max}
          onChange={e => onChange(Number(e.target.value))}
          className="w-16 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-2 py-0.5 text-[12px] text-white text-right outline-none focus:border-[#1f8a65]/40"
        />
        {unit && <span className="text-[10px] text-white/35 w-6">{unit}</span>}
      </div>
    </div>
  )
}

export default function ClientIntelligencePanel({
  clientData, loading, trainingConfig, lifestyleConfig,
  onTrainingChange, onLifestyleChange, macroResult,
}: Props) {
  const [trainingOpen, setTrainingOpen] = useState(true)
  const [lifestyleOpen, setLifestyleOpen] = useState(true)

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-8 rounded-lg bg-white/[0.04] animate-pulse" />
        ))}
      </div>
    )
  }

  if (!clientData) return null

  const cd = clientData
  const bfPct = cd.body_fat_pct ?? macroResult?.estimatedBF
  const lbm = cd.lean_mass_kg ?? macroResult?.leanMass
  const bmr = cd.bmr_kcal_measured ?? macroResult?.breakdown.bmr
  const bmrSource = cd.bmr_kcal_measured ? '● balance' : '◐ estimé'
  const sleepWarning = (lifestyleConfig.sleepDurationH ?? 8) < 7

  return (
    <div className="h-full overflow-y-auto scrollbar-hide space-y-5 p-4 pb-8">

      {/* Client header */}
      <div>
        <p className="text-[13px] font-semibold text-white leading-tight">{cd.name}</p>
        <p className="text-[10px] text-white/40 mt-0.5">
          {cd.gender === 'female' ? 'Femme' : 'Homme'} · {cd.age} ans
        </p>
      </div>

      {/* Composition */}
      <div>
        <SectionLabel>Composition</SectionLabel>
        <DataRow label="Poids" value={cd.weight_kg} unit="kg" />
        <DataRow label="Taille" value={cd.height_cm} unit="cm" />
        {bfPct != null && (
          <div className="py-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-white/50">Masse grasse</span>
              <span className="text-[12px] font-medium text-white/85">{bfPct.toFixed(1)}%</span>
            </div>
            <div className="flex w-full h-[3px] rounded-full overflow-hidden bg-white/[0.06]">
              <div className="bg-amber-400/60 transition-all duration-500" style={{ width: `${Math.min(bfPct, 40) / 40 * 100}%` }} />
              <div className="bg-[#1f8a65]/60 flex-1" />
            </div>
          </div>
        )}
        <DataRow label="LBM" value={lbm != null ? lbm.toFixed(1) : null} unit="kg" />
        {cd.muscle_mass_kg && <DataRow label="Masse musc." value={cd.muscle_mass_kg} unit="kg" />}
      </div>

      {/* Métabolisme */}
      <div>
        <SectionLabel>Métabolisme</SectionLabel>
        {bmr && <DataRow label="BMR" value={Math.round(bmr)} unit="kcal" source={bmrSource} />}
        {cd.visceral_fat_level && (
          <DataRow
            label="Graisse viscérale"
            value={cd.visceral_fat_level}
            warning={cd.visceral_fat_level >= 10}
          />
        )}
      </div>

      {/* Entraînement — éditable */}
      <div>
        <button
          onClick={() => setTrainingOpen(p => !p)}
          className="flex items-center justify-between w-full mb-2 group"
        >
          <SectionLabel>Entraînement</SectionLabel>
          <Pencil size={10} className="text-white/30 group-hover:text-[#1f8a65] transition-colors mb-2" />
        </button>
        {trainingOpen && (
          <div className="space-y-0.5">
            <NumberInput
              label="Séances/sem" unit="j"
              value={trainingConfig.weeklyFrequency}
              onChange={v => onTrainingChange({ weeklyFrequency: v })}
              min={0} max={14}
            />
            <NumberInput
              label="Durée session" unit="min"
              value={trainingConfig.sessionDurationMin}
              onChange={v => onTrainingChange({ sessionDurationMin: v })}
              min={15} max={240}
            />
            <NumberInput
              label="Cardio/sem" unit="j"
              value={trainingConfig.cardioFrequency}
              onChange={v => onTrainingChange({ cardioFrequency: v })}
              min={0} max={14}
            />
            <NumberInput
              label="Durée cardio" unit="min"
              value={trainingConfig.cardioDurationMin}
              onChange={v => onTrainingChange({ cardioDurationMin: v })}
              min={0} max={180}
            />
            <NumberInput
              label="Pas/jour"
              value={trainingConfig.dailySteps}
              onChange={v => onTrainingChange({ dailySteps: v })}
              min={0} max={30000}
            />
          </div>
        )}
      </div>

      {/* Lifestyle — éditable */}
      <div>
        <button
          onClick={() => setLifestyleOpen(p => !p)}
          className="flex items-center justify-between w-full mb-2 group"
        >
          <SectionLabel>Lifestyle</SectionLabel>
          <Pencil size={10} className="text-white/30 group-hover:text-[#1f8a65] transition-colors mb-2" />
        </button>
        {lifestyleOpen && (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-1">
                <Moon size={10} className={sleepWarning ? 'text-amber-400' : 'text-white/30'} />
                <span className="text-[11px] text-white/50">Sommeil</span>
              </div>
              <div className="flex items-center gap-1">
                {sleepWarning && <AlertTriangle size={9} className="text-amber-400" />}
                <input
                  type="number"
                  step="0.1"
                  value={lifestyleConfig.sleepDurationH ?? ''}
                  min={0} max={12}
                  onChange={e => onLifestyleChange({ sleepDurationH: Number(e.target.value) })}
                  className={`w-14 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-2 py-0.5 text-[12px] text-right outline-none focus:border-[#1f8a65]/40 ${sleepWarning ? 'text-amber-400' : 'text-white'}`}
                />
                <span className="text-[10px] text-white/35 w-4">h</span>
              </div>
            </div>
            <NumberInput
              label="Stress (1-10)"
              value={lifestyleConfig.stressLevel}
              onChange={v => onLifestyleChange({ stressLevel: v })}
              min={1} max={10}
            />
            <NumberInput
              label="Caféine" unit="mg"
              value={lifestyleConfig.caffeineDailyMg}
              onChange={v => onLifestyleChange({ caffeineDailyMg: v })}
              min={0} max={1000}
            />
            <NumberInput
              label="Alcool/sem" unit="v"
              value={lifestyleConfig.alcoholWeekly}
              onChange={v => onLifestyleChange({ alcoholWeekly: v })}
              min={0} max={50}
            />
          </div>
        )}
      </div>

    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add components/nutrition/studio/ClientIntelligencePanel.tsx
git commit -m "feat(nutrition-studio): add ClientIntelligencePanel column"
```

---

## Task 6: Composant `CalculationEngine` — colonne 2

**Files:**
- Create: `components/nutrition/studio/CalculationEngine.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/nutrition/studio/CalculationEngine.tsx
'use client'

import { Zap, AlertTriangle, CheckCircle2, Info, Droplets, RefreshCw } from 'lucide-react'
import TdeeWaterfall from './TdeeWaterfall'
import type { MacroResult, MacroGoal, SmartProtocolSuggestion } from '@/lib/formulas/macros'
import type { CarbCyclingResult, CarbCycleProtocol, CarbCycleGoal, CarbCycleIntensity, CarbCyclePhase, CarbCycleInsulin } from '@/lib/formulas/carbCycling'
import type { HydrationClimate } from '@/lib/formulas/hydration'
import type { CarbCyclingConfig } from './useNutritionStudio'

interface Props {
  goal: MacroGoal
  onGoalChange: (g: MacroGoal) => void
  calorieAdjustPct: number
  onCalorieAdjustChange: (v: number) => void
  proteinOverride: number | null
  onProteinOverrideChange: (v: number | null) => void
  macroResult: MacroResult | null
  carbCycling: CarbCyclingConfig
  onCarbCyclingChange: (patch: Partial<CarbCyclingConfig>) => void
  ccResult: CarbCyclingResult | null
  hydrationClimate: HydrationClimate
  onHydrationClimateChange: (c: HydrationClimate) => void
  hydrationLiters: number | null
  leanMass: number | null
}

const GOAL_OPTIONS: { value: MacroGoal; label: string }[] = [
  { value: 'deficit',     label: 'Déficit — Perte de gras' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'surplus',     label: 'Surplus — Prise de muscle' },
]

const CC_PROTOCOLS: { value: CarbCycleProtocol; label: string }[] = [
  { value: '2/1', label: '2 hauts / 1 bas' },
  { value: '3/1', label: '3 hauts / 1 bas' },
  { value: '4/1', label: '4 hauts / 1 bas' },
  { value: '5/2', label: '5 hauts / 2 bas' },
]

const CC_GOALS: { value: CarbCycleGoal; label: string }[] = [
  { value: 'moderate', label: 'Perte modérée' },
  { value: 'recomp',   label: 'Recomposition' },
  { value: 'bulk',     label: 'Prise de masse' },
  { value: 'performance', label: 'Performance' },
]

const CLIMATE_OPTIONS: { value: HydrationClimate; label: string }[] = [
  { value: 'cold',      label: '❄️ Froid' },
  { value: 'temperate', label: '🌤 Tempéré' },
  { value: 'hot',       label: '☀️ Chaud' },
  { value: 'veryHot',   label: '🔥 Très chaud' },
]

const PRIORITY_ICON = {
  critical: <AlertTriangle size={11} className="text-red-400 shrink-0" />,
  high:     <AlertTriangle size={11} className="text-amber-400 shrink-0" />,
  medium:   <Info size={11} className="text-blue-400 shrink-0" />,
  low:      <CheckCircle2 size={11} className="text-white/30 shrink-0" />,
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35 whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  )
}

function SelectInput<T extends string>({ value, options, onChange, className = '' }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      className={`rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-2 py-1 text-[11px] text-white/80 outline-none focus:border-[#1f8a65]/40 ${className}`}
    >
      {options.map(o => (
        <option key={o.value} value={o.value} className="bg-[#181818]">{o.label}</option>
      ))}
    </select>
  )
}

export default function CalculationEngine({
  goal, onGoalChange,
  calorieAdjustPct, onCalorieAdjustChange,
  proteinOverride, onProteinOverrideChange,
  macroResult,
  carbCycling, onCarbCyclingChange,
  ccResult,
  hydrationClimate, onHydrationClimateChange,
  hydrationLiters,
  leanMass,
}: Props) {

  const actionableSuggestions = (macroResult?.smartProtocol ?? [])
    .filter(s => ['critical', 'high'].includes(s.priority))
    .slice(0, 3)

  return (
    <div className="h-full overflow-y-auto scrollbar-hide space-y-5 p-4 pb-8">

      {/* ── DÉPENSE ÉNERGÉTIQUE ───────────────────────────────────────── */}
      <div>
        <SectionDivider label="Dépense énergétique" />
        {macroResult ? (
          <TdeeWaterfall result={macroResult} />
        ) : (
          <div className="h-12 rounded-lg bg-white/[0.04] animate-pulse" />
        )}
      </div>

      {/* ── OBJECTIF ─────────────────────────────────────────────────── */}
      <div>
        <SectionDivider label="Objectif" />
        <div className="flex gap-1.5 flex-wrap">
          {GOAL_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => onGoalChange(o.value)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                goal === o.value
                  ? 'bg-[#1f8a65]/15 text-[#1f8a65] border-[0.3px] border-[#1f8a65]/30'
                  : 'bg-white/[0.04] text-white/50 border-[0.3px] border-white/[0.06] hover:text-white/70'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {macroResult && (
          <div className="mt-3 space-y-2">
            {/* Calorie adjustment slider */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40">Ajustement calorique</span>
              <span className="text-[11px] font-mono text-white/70">
                {calorieAdjustPct > 0 ? '+' : ''}{calorieAdjustPct}%
              </span>
            </div>
            <input
              type="range" min={-30} max={30} step={1}
              value={calorieAdjustPct}
              onChange={e => onCalorieAdjustChange(Number(e.target.value))}
              className="w-full h-1 accent-[#1f8a65] cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-white/25">
              <span>-30%</span><span>0</span><span>+30%</span>
            </div>
          </div>
        )}
      </div>

      {/* ── MACROS ───────────────────────────────────────────────────── */}
      <div>
        <SectionDivider label="Macronutriments" />
        {macroResult ? (
          <div className="space-y-3">
            {/* TARGET calories */}
            <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
              <span className="text-[11px] text-white/50">Calories cibles</span>
              <span className="text-[16px] font-bold text-white">{macroResult.calories} <span className="text-[11px] font-normal text-white/40">kcal</span></span>
            </div>

            {/* Protein */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-[11px] text-white/70">Protéines</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/35">
                    {leanMass ? (macroResult.macros.p / leanMass).toFixed(1) : '—'}g/kg LBM
                  </span>
                  <span className="text-[13px] font-semibold text-white">{macroResult.macros.p}g</span>
                </div>
              </div>
              <div className="h-[3px] w-full rounded-full bg-white/[0.04] overflow-hidden">
                <div className="h-full bg-blue-400 transition-all duration-300" style={{ width: `${macroResult.percents.p}%` }} />
              </div>
              {/* Protein override */}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[9px] text-white/30">Override g/kg LBM</span>
                <input
                  type="number" step="0.1" min={1.5} max={4}
                  value={proteinOverride ?? ''}
                  placeholder="auto"
                  onChange={e => onProteinOverrideChange(e.target.value ? Number(e.target.value) : null)}
                  className="w-16 rounded-md bg-white/[0.04] border-[0.3px] border-white/[0.06] px-2 py-0.5 text-[10px] text-white/70 text-right outline-none placeholder:text-white/20 focus:border-[#1f8a65]/40"
                />
                {proteinOverride && (
                  <button onClick={() => onProteinOverrideChange(null)} className="text-[9px] text-white/30 hover:text-white/60">
                    reset
                  </button>
                )}
              </div>
            </div>

            {/* Fat */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[11px] text-white/70">Lipides</span>
                </div>
                <span className="text-[13px] font-semibold text-white">{macroResult.macros.f}g</span>
              </div>
              <div className="h-[3px] w-full rounded-full bg-white/[0.04] overflow-hidden">
                <div className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${macroResult.percents.f}%` }} />
              </div>
            </div>

            {/* Carbs */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#1f8a65]" />
                  <span className="text-[11px] text-white/70">Glucides</span>
                </div>
                <span className="text-[13px] font-semibold text-white">{macroResult.macros.c}g</span>
              </div>
              <div className="h-[3px] w-full rounded-full bg-white/[0.04] overflow-hidden">
                <div className="h-full bg-[#1f8a65] transition-all duration-300" style={{ width: `${macroResult.percents.c}%` }} />
              </div>
              <p className="text-[9px] text-white/25 mt-0.5">↳ glucides recalculés automatiquement</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-6 rounded bg-white/[0.04] animate-pulse" />)}
          </div>
        )}
      </div>

      {/* ── CARB CYCLING ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionDivider label="Carb Cycling" />
          <button
            onClick={() => onCarbCyclingChange({ enabled: !carbCycling.enabled })}
            className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-semibold border-[0.3px] transition-all ${
              carbCycling.enabled
                ? 'bg-[#1f8a65]/15 text-[#1f8a65] border-[#1f8a65]/30'
                : 'bg-white/[0.04] text-white/30 border-white/[0.06]'
            }`}
          >
            {carbCycling.enabled ? '● ON' : '○ OFF'}
          </button>
        </div>

        {carbCycling.enabled && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] text-white/35 mb-1">Protocole</p>
                <SelectInput<CarbCycleProtocol>
                  value={carbCycling.protocol}
                  options={CC_PROTOCOLS}
                  onChange={v => onCarbCyclingChange({ protocol: v })}
                  className="w-full"
                />
              </div>
              <div>
                <p className="text-[9px] text-white/35 mb-1">Objectif</p>
                <SelectInput<CarbCycleGoal>
                  value={carbCycling.goal}
                  options={CC_GOALS}
                  onChange={v => onCarbCyclingChange({ goal: v })}
                  className="w-full"
                />
              </div>
            </div>

            {ccResult && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="rounded-xl bg-[#1f8a65]/08 border-[0.3px] border-[#1f8a65]/20 p-3">
                  <p className="text-[9px] text-[#1f8a65]/80 font-semibold mb-1">🔥 JOUR HAUT</p>
                  <p className="text-[14px] font-bold text-white">{ccResult.high.kcal} <span className="text-[10px] font-normal text-white/40">kcal</span></p>
                  <p className="text-[10px] text-white/50 mt-0.5">P{ccResult.high.p} · L{ccResult.high.f} · G{ccResult.high.c}</p>
                </div>
                <div className="rounded-xl bg-blue-500/08 border-[0.3px] border-blue-500/20 p-3">
                  <p className="text-[9px] text-blue-400/80 font-semibold mb-1">🧊 JOUR BAS</p>
                  <p className="text-[14px] font-bold text-white">{ccResult.low.kcal} <span className="text-[10px] font-normal text-white/40">kcal</span></p>
                  <p className="text-[10px] text-white/50 mt-0.5">P{ccResult.low.p} · L{ccResult.low.f} · G{ccResult.low.c}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── HYDRATATION ──────────────────────────────────────────────── */}
      <div>
        <SectionDivider label="Hydratation" />
        <div className="flex items-center gap-2 mb-2">
          <SelectInput<HydrationClimate>
            value={hydrationClimate}
            options={CLIMATE_OPTIONS}
            onChange={onHydrationClimateChange}
          />
        </div>
        {hydrationLiters && (
          <div className="flex items-center gap-3">
            <Droplets size={14} className="text-blue-400 shrink-0" />
            <span className="text-[15px] font-bold text-white">{hydrationLiters.toFixed(1)} L</span>
            <span className="text-[10px] text-white/40">{Math.round(hydrationLiters * 4)} verres · EFSA 2010 ✓</span>
          </div>
        )}
      </div>

      {/* ── SMART ALERTS ─────────────────────────────────────────────── */}
      {actionableSuggestions.length > 0 && (
        <div>
          <SectionDivider label="Smart Alerts" />
          <div className="space-y-2">
            {actionableSuggestions.map(s => (
              <div
                key={s.id}
                className={`rounded-xl p-3 border-[0.3px] ${
                  s.priority === 'critical' ? 'bg-red-500/08 border-red-500/20' : 'bg-amber-500/08 border-amber-500/20'
                }`}
              >
                <div className="flex items-start gap-2">
                  {PRIORITY_ICON[s.priority]}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-white/85 leading-snug">{s.title}</p>
                    <p className="text-[10px] text-white/45 mt-0.5 leading-relaxed">{s.rationale}</p>
                    {s.source && (
                      <p className="text-[9px] text-white/25 mt-0.5 italic">{s.source}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add components/nutrition/studio/CalculationEngine.tsx
git commit -m "feat(nutrition-studio): add CalculationEngine column with live macros + CC + hydration"
```

---

## Task 7: Composant `ClientPreviewModal`

**Files:**
- Create: `components/nutrition/studio/ClientPreviewModal.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/nutrition/studio/ClientPreviewModal.tsx
'use client'

import { X, Eye } from 'lucide-react'
import MacroBar from './MacroBar'
import type { DayDraft } from '@/lib/nutrition/types'

interface Props {
  clientName: string
  protocolName: string
  days: DayDraft[]
  onClose: () => void
}

export default function ClientPreviewModal({ clientName, protocolName, days, onClose }: Props) {
  const filledDays = days.filter(d => d.calories)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181818] rounded-2xl border-[0.3px] border-white/[0.06] w-full max-w-sm max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-[#1f8a65]" />
            <p className="text-[12px] font-semibold text-white">Vue client — {clientName}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Simulated client view */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35 mb-1">Protocole actif</p>
            <p className="text-[15px] font-bold text-white">{protocolName}</p>
          </div>

          {filledDays.length === 0 && (
            <p className="text-[12px] text-white/40 text-center py-6">
              Aucun jour configuré — injectez des macros d'abord.
            </p>
          )}

          {filledDays.map(day => {
            const cal = Number(day.calories) || 0
            const p = Number(day.protein_g) || 0
            const f = Number(day.fat_g) || 0
            const c = Number(day.carbs_g) || 0
            const h = Number(day.hydration_ml) || 0

            return (
              <div key={day.localId} className="rounded-xl bg-white/[0.03] border-[0.3px] border-white/[0.06] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] font-semibold text-white">{day.name}</p>
                  <p className="text-[13px] font-bold text-[#1f8a65]">{cal} kcal</p>
                </div>
                <MacroBar calories={cal} protein_g={p} carbs_g={c} fat_g={f} height={5} showLabels />
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="text-center">
                    <p className="text-[11px] font-semibold text-blue-400">{p}g</p>
                    <p className="text-[9px] text-white/40">Protéines</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-semibold text-amber-400">{f}g</p>
                    <p className="text-[9px] text-white/40">Lipides</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-semibold text-[#1f8a65]">{c}g</p>
                    <p className="text-[9px] text-white/40">Glucides</p>
                  </div>
                </div>
                {h > 0 && (
                  <p className="text-[10px] text-blue-400/70 mt-2">💧 {(h/1000).toFixed(1)} L / jour</p>
                )}
                {day.recommendations && (
                  <p className="text-[10px] text-white/40 mt-2 leading-relaxed">{day.recommendations}</p>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-5 py-3 border-t border-white/[0.06]">
          <p className="text-[9px] text-white/25 text-center">
            Aperçu de ce que {clientName} verra dans son application
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add components/nutrition/studio/ClientPreviewModal.tsx
git commit -m "feat(nutrition-studio): add ClientPreviewModal component"
```

---

## Task 8: Composant `ProtocolCanvas` — colonne 3

**Files:**
- Create: `components/nutrition/studio/ProtocolCanvas.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
// components/nutrition/studio/ProtocolCanvas.tsx
'use client'

import { useState } from 'react'
import { Plus, X, Eye, Send, Save, Pencil, Check } from 'lucide-react'
import MacroBar from './MacroBar'
import CoherenceScore from './CoherenceScore'
import type { DayDraft } from '@/lib/nutrition/types'
import type { CarbCyclingResult } from '@/lib/formulas/carbCycling'

interface Props {
  protocolName: string
  onProtocolNameChange: (v: string) => void
  days: DayDraft[]
  activeDayIndex: number
  onActiveDayChange: (i: number) => void
  onUpdateDay: (index: number, patch: Partial<DayDraft>) => void
  onAddDay: (name?: string) => void
  onRemoveDay: (index: number) => void
  onInjectMacros: (i: number) => void
  onInjectCCHigh: (i: number) => void
  onInjectCCLow: (i: number) => void
  onInjectHydration: (i: number) => void
  onInjectAll: (i: number) => void
  hasMacroResult: boolean
  hasCcResult: boolean
  ccResult: CarbCyclingResult | null
  hasHydration: boolean
  coherenceScore: { score: number; checks: { label: string; ok: boolean; warning?: string }[] }
  clientName: string
  saving: boolean
  sharing: boolean
  onSave: () => void
  onShare: () => void
  onPreview: () => void
}

function NumberField({ label, value, onChange, unit }: {
  label: string; value: string; onChange: (v: string) => void; unit?: string
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-white/45">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="—"
          className="w-16 rounded-md bg-white/[0.04] border-[0.3px] border-white/[0.06] px-2 py-0.5 text-[11px] text-white text-right outline-none placeholder:text-white/20 focus:border-[#1f8a65]/40"
        />
        {unit && <span className="text-[9px] text-white/30 w-5">{unit}</span>}
      </div>
    </div>
  )
}

export default function ProtocolCanvas({
  protocolName, onProtocolNameChange,
  days, activeDayIndex, onActiveDayChange,
  onUpdateDay, onAddDay, onRemoveDay,
  onInjectMacros, onInjectCCHigh, onInjectCCLow, onInjectHydration, onInjectAll,
  hasMacroResult, hasCcResult, ccResult, hasHydration,
  coherenceScore, clientName,
  saving, sharing, onSave, onShare, onPreview,
}: Props) {
  const [editingName, setEditingName] = useState(false)
  const [tempName, setTempName] = useState(protocolName)
  const activeDay = days[activeDayIndex]

  return (
    <div className="h-full flex flex-col">
      {/* Protocol name */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.04]">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={tempName}
              onChange={e => setTempName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { onProtocolNameChange(tempName); setEditingName(false) }
                if (e.key === 'Escape') { setTempName(protocolName); setEditingName(false) }
              }}
              className="flex-1 rounded-lg bg-white/[0.04] border-[0.3px] border-[#1f8a65]/40 px-3 py-1 text-[13px] font-semibold text-white outline-none"
            />
            <button onClick={() => { onProtocolNameChange(tempName); setEditingName(false) }}>
              <Check size={14} className="text-[#1f8a65]" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setTempName(protocolName); setEditingName(true) }}
            className="flex items-center gap-2 group"
          >
            <span className="text-[13px] font-semibold text-white">{protocolName}</span>
            <Pencil size={11} className="text-white/25 group-hover:text-[#1f8a65] transition-colors" />
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 p-4">

        {/* Coherence Score */}
        <CoherenceScore score={coherenceScore.score} checks={coherenceScore.checks} />

        {/* Day cards overview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">
              Jours du protocole
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {days.map((day, i) => {
              const cal = Number(day.calories) || 0
              const p = Number(day.protein_g) || 0
              const f = Number(day.fat_g) || 0
              const c = Number(day.carbs_g) || 0
              const isActive = i === activeDayIndex
              return (
                <button
                  key={day.localId}
                  onClick={() => onActiveDayChange(i)}
                  className={`relative rounded-xl p-3 border-[0.3px] text-left transition-all ${
                    isActive
                      ? 'bg-[#1f8a65]/08 border-[#1f8a65]/30'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                  }`}
                >
                  <button
                    onClick={e => { e.stopPropagation(); onRemoveDay(i) }}
                    className="absolute top-1.5 right-1.5 text-white/20 hover:text-red-400 transition-colors"
                  >
                    <X size={10} />
                  </button>
                  <p className="text-[10px] font-medium text-white/80 leading-tight pr-3">{day.name}</p>
                  {cal > 0 ? (
                    <>
                      <p className="text-[12px] font-bold text-white mt-1">{cal} <span className="text-[9px] font-normal text-white/40">kcal</span></p>
                      <p className="text-[9px] text-white/40 mt-0.5">P{p}·L{f}·G{c}</p>
                      <div className="mt-2">
                        <MacroBar calories={cal} protein_g={p} carbs_g={c} fat_g={f} height={3} />
                      </div>
                      {day.carb_cycle_type && (
                        <span className={`inline-block mt-1 text-[8px] px-1.5 py-0.5 rounded-full font-semibold ${
                          day.carb_cycle_type === 'high' ? 'bg-[#1f8a65]/20 text-[#1f8a65]' :
                          day.carb_cycle_type === 'low' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {day.carb_cycle_type.toUpperCase()} CC
                        </span>
                      )}
                    </>
                  ) : (
                    <p className="text-[9px] text-white/25 mt-1">Non configuré</p>
                  )}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => onAddDay()}
            className="w-full py-2 rounded-xl bg-white/[0.02] border-[0.3px] border-dashed border-white/[0.08] text-[10px] text-white/35 hover:text-white/60 hover:border-white/20 transition-all flex items-center justify-center gap-1"
          >
            <Plus size={11} /> Ajouter un jour
          </button>
        </div>

        {/* Active day editor */}
        {activeDay && (
          <div className="rounded-xl bg-white/[0.02] border-[0.3px] border-white/[0.06] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-white">{activeDay.name}</p>
              <button
                onClick={() => {
                  const name = prompt('Renommer le jour', activeDay.name)
                  if (name) onUpdateDay(activeDayIndex, { name })
                }}
                className="text-white/25 hover:text-white/60 transition-colors"
              >
                <Pencil size={10} />
              </button>
            </div>

            {/* Injection buttons */}
            <div>
              <p className="text-[9px] text-white/30 mb-1.5">Injection rapide</p>
              <div className="flex flex-wrap gap-1.5">
                {hasMacroResult && (
                  <button
                    onClick={() => onInjectMacros(activeDayIndex)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] text-[10px] text-white/60 hover:text-white/85 hover:bg-white/[0.07] transition-all"
                  >
                    ← Base
                  </button>
                )}
                {hasCcResult && (
                  <>
                    <button
                      onClick={() => onInjectCCHigh(activeDayIndex)}
                      className="px-2.5 py-1 rounded-lg bg-[#1f8a65]/10 border-[0.3px] border-[#1f8a65]/25 text-[10px] text-[#1f8a65] hover:bg-[#1f8a65]/15 transition-all"
                    >
                      ← Jour haut
                    </button>
                    <button
                      onClick={() => onInjectCCLow(activeDayIndex)}
                      className="px-2.5 py-1 rounded-lg bg-blue-500/10 border-[0.3px] border-blue-500/25 text-[10px] text-blue-400 hover:bg-blue-500/15 transition-all"
                    >
                      ← Jour bas
                    </button>
                  </>
                )}
                {hasHydration && (
                  <button
                    onClick={() => onInjectHydration(activeDayIndex)}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] text-[10px] text-blue-400/70 hover:text-blue-400 transition-all"
                  >
                    ← Hydrat.
                  </button>
                )}
                {(hasMacroResult || hasHydration) && (
                  <button
                    onClick={() => onInjectAll(activeDayIndex)}
                    className="px-2.5 py-1 rounded-lg bg-[#1f8a65]/15 border-[0.3px] border-[#1f8a65]/30 text-[10px] text-[#1f8a65] font-semibold hover:bg-[#1f8a65]/20 transition-all"
                  >
                    ← Tout ✦
                  </button>
                )}
              </div>
            </div>

            {/* Manual fine-tune */}
            <div>
              <p className="text-[9px] text-white/30 mb-1">Ajustement manuel</p>
              <div className="space-y-0.5">
                <NumberField label="Calories" value={activeDay.calories} unit="kcal"
                  onChange={v => onUpdateDay(activeDayIndex, { calories: v })} />
                <NumberField label="Protéines" value={activeDay.protein_g} unit="g"
                  onChange={v => onUpdateDay(activeDayIndex, { protein_g: v })} />
                <NumberField label="Lipides" value={activeDay.fat_g} unit="g"
                  onChange={v => onUpdateDay(activeDayIndex, { fat_g: v })} />
                <NumberField label="Glucides" value={activeDay.carbs_g} unit="g"
                  onChange={v => onUpdateDay(activeDayIndex, { carbs_g: v })} />
                <NumberField label="Hydratation" value={activeDay.hydration_ml} unit="ml"
                  onChange={v => onUpdateDay(activeDayIndex, { hydration_ml: v })} />
              </div>
            </div>

            {/* Live macro bar for active day */}
            {activeDay.calories && (
              <MacroBar
                calories={Number(activeDay.calories)}
                protein_g={Number(activeDay.protein_g) || 0}
                carbs_g={Number(activeDay.carbs_g) || 0}
                fat_g={Number(activeDay.fat_g) || 0}
                height={5}
                showLabels
              />
            )}

            {/* Recommendations */}
            <div>
              <p className="text-[9px] text-white/30 mb-1">Notes / recommandations</p>
              <textarea
                value={activeDay.recommendations}
                onChange={e => onUpdateDay(activeDayIndex, { recommendations: e.target.value })}
                placeholder="Conseils pour ce jour..."
                rows={2}
                className="w-full rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-3 py-2 text-[11px] text-white/70 placeholder:text-white/20 outline-none resize-none focus:border-[#1f8a65]/40"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sticky save bar */}
      <div className="border-t border-white/[0.06] px-4 py-3 space-y-2">
        <button
          onClick={onPreview}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/[0.04] border-[0.3px] border-white/[0.06] text-[11px] text-white/50 hover:text-white/75 hover:bg-white/[0.06] transition-all"
        >
          <Eye size={12} />
          Aperçu client
        </button>
        <div className="flex gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/[0.04] border-[0.3px] border-white/[0.06] text-[11px] font-medium text-white/60 hover:text-white/80 disabled:opacity-40 transition-all"
          >
            <Save size={12} />
            {saving ? 'Sauvegarde...' : 'Brouillon'}
          </button>
          <button
            onClick={onShare}
            disabled={sharing}
            className="flex-[2] flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#1f8a65] text-[11px] font-bold text-white hover:bg-[#217356] disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            <Send size={12} />
            {sharing ? 'Partage...' : `Partager ▶ ${clientName.split(' ')[0]}`}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add components/nutrition/studio/ProtocolCanvas.tsx
git commit -m "feat(nutrition-studio): add ProtocolCanvas column with day management + injection"
```

---

## Task 9: Orchestrateur `NutritionStudio` — layout 3 colonnes

**Files:**
- Create: `components/nutrition/studio/NutritionStudio.tsx`

- [ ] **Step 1: Créer l'orchestrateur**

```tsx
// components/nutrition/studio/NutritionStudio.tsx
'use client'

import { useNutritionStudio } from './useNutritionStudio'
import ClientIntelligencePanel from './ClientIntelligencePanel'
import CalculationEngine from './CalculationEngine'
import ProtocolCanvas from './ProtocolCanvas'
import ClientPreviewModal from './ClientPreviewModal'
import { useClientTopBar } from '@/components/clients/useClientTopBar'
import type { NutritionProtocol } from '@/lib/nutrition/types'
import { useRouter } from 'next/navigation'

interface Props {
  clientId: string
  existingProtocol?: NutritionProtocol
}

export default function NutritionStudio({ clientId, existingProtocol }: Props) {
  const router = useRouter()
  const studio = useNutritionStudio(clientId, existingProtocol)

  useClientTopBar(
    { label: 'Protocoles', title: 'Nutrition Studio' },
    null
  )

  const handleSave = async () => {
    await studio.save()
  }

  const handleShare = async () => {
    await studio.share()
    router.push(`/coach/clients/${clientId}/protocoles/nutrition`)
  }

  const clientName = studio.clientData?.name ?? 'Client'
  const leanMass = studio.clientData?.lean_mass_kg ?? studio.macroResult?.leanMass ?? null

  return (
    <main className="h-screen bg-[#121212] flex flex-col overflow-hidden">
      {/* 3-column layout */}
      <div className="flex-1 flex min-h-0">

        {/* Col 1 — Client Intelligence (300px fixed) */}
        <div className="w-[300px] shrink-0 border-r border-white/[0.04] overflow-hidden">
          <ClientIntelligencePanel
            clientData={studio.clientData}
            loading={studio.clientLoading}
            trainingConfig={studio.trainingConfig}
            lifestyleConfig={studio.lifestyleConfig}
            onTrainingChange={patch => studio.setTrainingConfig(prev => ({ ...prev, ...patch }))}
            onLifestyleChange={patch => studio.setLifestyleConfig(prev => ({ ...prev, ...patch }))}
            macroResult={studio.macroResult}
          />
        </div>

        {/* Col 2 — Calculation Engine (flex) */}
        <div className="flex-1 border-r border-white/[0.04] overflow-hidden">
          <CalculationEngine
            goal={studio.goal}
            onGoalChange={studio.setGoal}
            calorieAdjustPct={studio.calorieAdjustPct}
            onCalorieAdjustChange={studio.setCalorieAdjustPct}
            proteinOverride={studio.proteinOverride}
            onProteinOverrideChange={studio.setProteinOverride}
            macroResult={studio.macroResult}
            carbCycling={studio.carbCycling}
            onCarbCyclingChange={patch => studio.setCarbCycling(prev => ({ ...prev, ...patch }))}
            ccResult={studio.ccResult}
            hydrationClimate={studio.hydrationClimate}
            onHydrationClimateChange={studio.setHydrationClimate}
            hydrationLiters={studio.hydrationLiters}
            leanMass={leanMass}
          />
        </div>

        {/* Col 3 — Protocol Canvas (380px fixed) */}
        <div className="w-[380px] shrink-0 overflow-hidden">
          <ProtocolCanvas
            protocolName={studio.protocolName}
            onProtocolNameChange={studio.setProtocolName}
            days={studio.days}
            activeDayIndex={studio.activeDayIndex}
            onActiveDayChange={studio.setActiveDayIndex}
            onUpdateDay={studio.updateDay}
            onAddDay={studio.addDay}
            onRemoveDay={studio.removeDay}
            onInjectMacros={studio.injectMacrosToDay}
            onInjectCCHigh={studio.injectCCHighToDay}
            onInjectCCLow={studio.injectCCLowToDay}
            onInjectHydration={studio.injectHydrationToDay}
            onInjectAll={studio.injectAllToDay}
            hasMacroResult={studio.macroResult !== null}
            hasCcResult={studio.ccResult !== null}
            ccResult={studio.ccResult}
            hasHydration={studio.hydrationLiters !== null}
            coherenceScore={studio.coherenceScore}
            clientName={clientName}
            saving={studio.saving}
            sharing={studio.sharing}
            onSave={handleSave}
            onShare={handleShare}
            onPreview={() => studio.setShowPreview(true)}
          />
        </div>
      </div>

      {/* Client preview modal */}
      {studio.showPreview && (
        <ClientPreviewModal
          clientName={clientName}
          protocolName={studio.protocolName}
          days={studio.days}
          onClose={() => studio.setShowPreview(false)}
        />
      )}
    </main>
  )
}
```

- [ ] **Step 2: Vérifier TypeScript**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add components/nutrition/studio/NutritionStudio.tsx
git commit -m "feat(nutrition-studio): add NutritionStudio 3-column orchestrator"
```

---

## Task 10: Brancher les pages new + edit sur NutritionStudio

**Files:**
- Modify: `app/coach/clients/[clientId]/protocoles/nutrition/new/page.tsx`
- Modify: `app/coach/clients/[clientId]/protocoles/nutrition/[protocolId]/edit/page.tsx`

- [ ] **Step 1: Mettre à jour la page new**

```tsx
// app/coach/clients/[clientId]/protocoles/nutrition/new/page.tsx
'use client'

import { useParams } from 'next/navigation'
import NutritionStudio from '@/components/nutrition/studio/NutritionStudio'

export default function NewNutritionProtocolPage() {
  const params   = useParams()
  const clientId = params.clientId as string
  return <NutritionStudio clientId={clientId} />
}
```

- [ ] **Step 2: Mettre à jour la page edit**

```tsx
// app/coach/clients/[clientId]/protocoles/nutrition/[protocolId]/edit/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import NutritionStudio from '@/components/nutrition/studio/NutritionStudio'
import type { NutritionProtocol } from '@/lib/nutrition/types'

export default function EditNutritionProtocolPage() {
  const params     = useParams()
  const clientId   = params.clientId as string
  const protocolId = params.protocolId as string

  const [protocol, setProtocol] = useState<NutritionProtocol | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    fetch(`/api/clients/${clientId}/nutrition-protocols/${protocolId}`)
      .then(r => r.json())
      .then(d => {
        if (d.protocol) setProtocol(d.protocol)
        else setError('Protocole introuvable')
      })
      .catch(() => setError('Erreur réseau'))
      .finally(() => setLoading(false))
  }, [clientId, protocolId])

  if (loading) {
    return (
      <main className="min-h-screen bg-[#121212]">
        <div className="px-6 pb-24 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </main>
    )
  }

  if (error || !protocol) {
    return (
      <main className="min-h-screen bg-[#121212]">
        <div className="px-6 pt-10 text-center">
          <p className="text-[14px] text-white/50">{error || 'Protocole introuvable'}</p>
        </div>
      </main>
    )
  }

  return <NutritionStudio clientId={clientId} existingProtocol={protocol} />
}
```

- [ ] **Step 3: Vérifier TypeScript complet**

```bash
cd /Users/user/Desktop/VIRTUS && npx tsc --noEmit 2>&1
```

Expected: 0 erreurs.

- [ ] **Step 4: Commit**

```bash
git add app/coach/clients/[clientId]/protocoles/nutrition/new/page.tsx \
        app/coach/clients/[clientId]/protocoles/nutrition/[protocolId]/edit/page.tsx
git commit -m "feat(nutrition-studio): wire pages to NutritionStudio"
```

---

## Task 11: CHANGELOG + project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Mettre à jour CHANGELOG.md**

Ajouter en tête du fichier sous la date du jour :

```
## 2026-04-26

FEATURE: Nutrition Studio — refonte totale NutritionProtocolTool en layout 3 colonnes MacroFactor-inspired
FEATURE: Nutrition Studio — ClientIntelligencePanel avec sections biométrie/entraînement/lifestyle éditables
FEATURE: Nutrition Studio — CalculationEngine avec TDEE waterfall, macros live, carb cycling toggle, hydratation
FEATURE: Nutrition Studio — ProtocolCanvas avec gestion jours, injection one-click, Coherence Score
FEATURE: Nutrition Studio — CoherenceScore 0-100 avec validation protéines/lipides/calories/hydratation
FEATURE: Nutrition Studio — ClientPreviewModal simulant la vue client avant partage
FEATURE: Nutrition Studio — debounce 300ms sur tous les calculs (macros + CC + hydratation)
REFACTOR: nutrition/new et nutrition/edit pages branchées sur NutritionStudio
```

- [ ] **Step 2: Commit final**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update changelog and project-state for Nutrition Studio redesign"
```

---

## Self-Review

### Spec coverage

| Exigence design | Tâche |
|-----------------|-------|
| 3 colonnes fixes simultanées | Task 9 (NutritionStudio layout) |
| Col 1 : biométrie read-only + sections éditables (C) | Task 5 |
| Col 2 : calcul temps réel debounced | Task 1 (hook) + Task 6 |
| TDEE waterfall BMR→NEAT→EAT→TEF | Task 3 |
| Macros live P/F/G avec barres colorées | Task 6 |
| Carb cycling inline toggle | Task 6 |
| Hydratation inline | Task 6 |
| Smart Alerts avec sources scientifiques | Task 6 |
| Col 3 : jours du protocole | Task 8 |
| Injection one-click (Base, Jour haut CC, Jour bas CC, Hydrat., Tout ✦) | Task 8 |
| Coherence Score 0-100 | Task 4 + Task 1 |
| Preview client modal | Task 7 |
| Partager ▶ [Prénom] | Task 8 |
| MacroBar réutilisable | Task 2 |
| Back-end inchangé | ✓ aucune modification lib/formulas |

### Placeholder scan

Aucun TBD, TODO, ou "implement later" détecté.

### Type consistency

- `TrainingConfig` / `LifestyleConfig` : définis dans `useNutritionStudio.ts`, importés dans `ClientIntelligencePanel.tsx` ✓
- `CarbCyclingConfig` : défini dans `useNutritionStudio.ts`, importé dans `CalculationEngine.tsx` ✓
- `MacroResult` : importé de `lib/formulas/macros` partout ✓
- `DayDraft` : importé de `lib/nutrition/types` partout ✓
- `coherenceScore` shape `{ score, checks }` : produit dans hook, consommé dans `ProtocolCanvas` et `CoherenceScore` ✓
