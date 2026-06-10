# BioNorms — Measured vs Derived Values Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Norms view must always display the most recent directly-entered value per metric (regardless of which submission or entry method), falling back to a derived/calculated value only when no direct measurement exists — and each gauge must show a discrete badge indicating whether its value is "Mesuré le JJ/MM" or "Calculé le JJ/MM · formule".

**Architecture:** `useBiometrics` is refactored to fetch all `assessment_responses` for the client (not just one submission), build a `latestMeasured` map (most recent direct value per field_key), pass that into `deriveMetrics`, and expose a `metricSources` map. `BioNormsGauge` receives an optional `source` prop and renders the badge. `BioNormsPanel` passes `clientId` down and wires everything.

**Tech Stack:** TypeScript (strict), React, Supabase client, `healthMath.ts`, `bioNorms.ts`, `useBiometrics.ts`, `BioNormsGauge.tsx`, `BioNormsPanel.tsx`, `MetricsSection.tsx`

---

## File Map

| File | Change |
|------|--------|
| `lib/health/healthMath.ts` | Add `DERIVED_FORMULAS` constant map (field_key → human-readable formula string) |
| `lib/health/useBiometrics.ts` | Refactor: accept `clientId` instead of `submissionId`, fetch all client responses, build `latestMeasured`, expose `metricSources` |
| `components/health/BioNormsGauge.tsx` | Add `MetricSource` type + `SourceBadge` sub-component, add `source` prop to `BioNormsGaugeProps` |
| `components/health/BioNormsPanel.tsx` | Accept `clientId` prop, drop `submissionId`, wire `metricSources` to each gauge |
| `components/clients/MetricsSection.tsx` | Pass `clientId` to `BioNormsPanel` instead of `normsSubmissionId` |

---

## Task 1: Add `DERIVED_FORMULAS` to `healthMath.ts`

**Files:**
- Modify: `lib/health/healthMath.ts`

This is a pure data constant — no logic change. It maps each derivable field_key to a short human-readable formula string shown in the Calculé badge.

- [ ] **Step 1: Add the constant after the `round1` function (line ~78)**

Add after `export function round1`:

```typescript
// ---------------------------------------------------------------------------
// Formules de dérivation — affichées dans les badges "Calculé" de BioNormsPanel
// ---------------------------------------------------------------------------

export const DERIVED_FORMULAS: Partial<Record<string, string>> = {
  bmi:               'poids ÷ taille²',
  fat_mass_kg:       'poids × (BF% ÷ 100)',
  lean_mass_kg:      'poids × (1 − BF% ÷ 100)',
  body_fat_pct:      'masse grasse ÷ poids × 100',
  muscle_mass_kg:    'poids × (muscle% ÷ 100)',
  muscle_mass_pct:   'masse musculaire ÷ poids × 100',
  waist_height_ratio:'tour de taille ÷ taille',
  metabolic_age_delta: 'BMR estimé → âge métabolique (Katch-McArdle / Mifflin)',
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep healthMath
```

Expected: no output (no errors in this file).

- [ ] **Step 3: Commit**

```bash
git add lib/health/healthMath.ts
git commit -m "feat(bionorms): add DERIVED_FORMULAS constant for source badges"
```

---

## Task 2: Refactor `useBiometrics` — accept `clientId`, fetch all responses

**Files:**
- Modify: `lib/health/useBiometrics.ts`

**Key design decisions:**
- Hook now takes `clientId: string` instead of `submissionId: string`
- Fetches all `assessment_submissions` for this client (status = 'completed') joined with `assessment_responses`, ordered by `bilan_date ASC`
- Builds `latestMeasured: Record<string, { value: number; date: string }>` — for each field_key, keeps only the most recent row
- `weight_kg` and `height_cm` must still both exist in `latestMeasured` for the panel to function
- Calls `deriveMetrics` with the full `latestMeasured` as inputs
- Produces `metricSources: Record<string, MetricSource>` exposed on the return type

**`MetricSource` type:**

```typescript
export type MetricSource = {
  type: 'measured' | 'derived'
  date: string        // YYYY-MM-DD
  formula?: string    // only when type === 'derived'
}
```

**Mapping from `DerivedMetrics` fields to source:**

The following fields are always derived (never directly stored as that key):
- `bmi` → always derived from weight + height
- `lean_mass_kg` → derived if not directly measured (no field_key `lean_mass_kg` in latestMeasured)
- `waist_height_ratio` → derived
- `metabolic_age_delta` → derived (it's a delta, not a raw field)

The following fields are measured if present in `latestMeasured`:
- `body_fat_pct`, `fat_mass_kg`, `muscle_mass_kg`, `muscle_mass_pct`, `skeletal_muscle_pct`
- `visceral_fat_level`, `body_water_pct`, `bone_mass_kg`
- `waist_cm`, `waist_hip_ratio`
- `metabolic_age` (raw field, maps to `metabolic_age_delta` evaluation)

The "date" for a derived metric = the most recent date among the source fields used in its formula.

- [ ] **Step 1: Replace the full content of `lib/health/useBiometrics.ts`**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { deriveMetrics, DERIVED_FORMULAS, type BiometricInputs, type DerivedMetrics, type NavySuggestion } from './healthMath'
import { evaluateAll, type NormEvaluation } from './bioNorms'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientProfile {
  date_of_birth?: string | null
  sex?: string | null
}

export type MetricSource = {
  type: 'measured' | 'derived'
  date: string       // YYYY-MM-DD
  formula?: string   // only when type === 'derived'
}

interface UseBiometricsReturn {
  derived: DerivedMetrics | null
  evaluations: NormEvaluation[]
  criticalAlerts: NormEvaluation[]
  navySuggestion: NavySuggestion | null
  metricSources: Record<string, MetricSource>
  loading: boolean
  error: string | null
  applyNavySuggestion: () => Promise<void>
  refetch: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BIOMETRIC_FIELD_KEYS = [
  'weight_kg', 'height_cm', 'body_fat_pct', 'fat_mass_kg',
  'muscle_mass_kg', 'muscle_mass_pct', 'skeletal_muscle_pct', 'visceral_fat_level',
  'body_water_pct', 'bone_mass_kg', 'waist_cm', 'neck_cm', 'hips_cm',
  'waist_hip_ratio', 'metabolic_age', 'lean_mass_kg',
] as const

type BiometricFieldKey = typeof BIOMETRIC_FIELD_KEYS[number]

function normalizeSex(sex: string | null | undefined): 'male' | 'female' | undefined {
  if (!sex) return undefined
  const s = sex.toLowerCase()
  if (s === 'male' || s === 'm' || s === 'homme') return 'male'
  if (s === 'female' || s === 'f' || s === 'femme') return 'female'
  return undefined
}

function calculateAge(dateOfBirth: string, referenceDate: string): number {
  const dob = new Date(dateOfBirth)
  const ref = new Date(referenceDate)
  let age = ref.getFullYear() - dob.getFullYear()
  const monthDiff = ref.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) {
    age--
  }
  return age
}

/** Latest bilan_date among the given field keys in latestMeasured */
function latestDateAmong(
  keys: string[],
  latestMeasured: Record<string, { value: number; date: string }>,
): string {
  return keys
    .map(k => latestMeasured[k]?.date)
    .filter((d): d is string => !!d)
    .sort()
    .reverse()[0] ?? new Date().toISOString().split('T')[0]
}

/** Build metricSources from latestMeasured + derived output */
function buildMetricSources(
  latestMeasured: Record<string, { value: number; date: string }>,
  derived: DerivedMetrics,
): Record<string, MetricSource> {
  const today = new Date().toISOString().split('T')[0]
  const sources: Record<string, MetricSource> = {}

  // Helper: if field_key is directly measured, return measured source
  function measuredSource(fieldKey: string): MetricSource | null {
    const m = latestMeasured[fieldKey]
    if (!m) return null
    return { type: 'measured', date: m.date }
  }

  // bmi — always derived (weight + height)
  sources['bmi'] = {
    type: 'derived',
    date: latestDateAmong(['weight_kg', 'height_cm'], latestMeasured),
    formula: DERIVED_FORMULAS['bmi'],
  }

  // body_fat_pct — measured if present, else derived from fat_mass_kg
  sources['body_fat_pct'] =
    measuredSource('body_fat_pct') ??
    (latestMeasured['fat_mass_kg']
      ? { type: 'derived', date: latestDateAmong(['fat_mass_kg', 'weight_kg'], latestMeasured), formula: DERIVED_FORMULAS['body_fat_pct'] }
      : { type: 'derived', date: today, formula: DERIVED_FORMULAS['body_fat_pct'] })

  // fat_mass_kg — measured if present, else derived from body_fat_pct
  sources['fat_mass_kg'] =
    measuredSource('fat_mass_kg') ??
    (latestMeasured['body_fat_pct']
      ? { type: 'derived', date: latestDateAmong(['body_fat_pct', 'weight_kg'], latestMeasured), formula: DERIVED_FORMULAS['fat_mass_kg'] }
      : { type: 'derived', date: today, formula: DERIVED_FORMULAS['fat_mass_kg'] })

  // lean_mass_kg — measured if present, else derived
  sources['lean_mass_kg'] =
    measuredSource('lean_mass_kg') ??
    (derived.lean_mass_kg !== null
      ? { type: 'derived', date: latestDateAmong(['weight_kg', 'body_fat_pct', 'fat_mass_kg'], latestMeasured), formula: DERIVED_FORMULAS['lean_mass_kg'] }
      : { type: 'derived', date: today, formula: DERIVED_FORMULAS['lean_mass_kg'] })

  // muscle_mass_kg — measured if present, else derived from pct
  sources['muscle_mass_kg'] =
    measuredSource('muscle_mass_kg') ??
    (latestMeasured['muscle_mass_pct']
      ? { type: 'derived', date: latestDateAmong(['muscle_mass_pct', 'weight_kg'], latestMeasured), formula: DERIVED_FORMULAS['muscle_mass_kg'] }
      : { type: 'derived', date: today, formula: DERIVED_FORMULAS['muscle_mass_kg'] })

  // muscle_mass_pct — measured if present, else derived from kg
  sources['muscle_mass_pct'] =
    measuredSource('muscle_mass_pct') ??
    (latestMeasured['muscle_mass_kg']
      ? { type: 'derived', date: latestDateAmong(['muscle_mass_kg', 'weight_kg'], latestMeasured), formula: DERIVED_FORMULAS['muscle_mass_pct'] }
      : { type: 'derived', date: today, formula: DERIVED_FORMULAS['muscle_mass_pct'] })

  // Direct-measured only fields
  for (const key of ['visceral_fat_level', 'body_water_pct', 'bone_mass_kg', 'waist_cm', 'waist_hip_ratio', 'metabolic_age'] as const) {
    const m = latestMeasured[key]
    sources[key] = m
      ? { type: 'measured', date: m.date }
      : { type: 'derived', date: today, formula: DERIVED_FORMULAS[key] }
  }

  // waist_height_ratio — always derived
  sources['waist_height_ratio'] = {
    type: 'derived',
    date: latestDateAmong(['waist_cm', 'height_cm'], latestMeasured),
    formula: DERIVED_FORMULAS['waist_height_ratio'],
  }

  // metabolic_age_delta — the evaluation key used in bioNorms
  sources['metabolic_age_delta'] =
    latestMeasured['metabolic_age']
      ? { type: 'measured', date: latestMeasured['metabolic_age'].date }
      : { type: 'derived', date: latestDateAmong(['weight_kg', 'height_cm', 'body_fat_pct'], latestMeasured), formula: DERIVED_FORMULAS['metabolic_age_delta'] }

  return sources
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBiometrics(
  clientId: string,
  clientProfile: ClientProfile,
): UseBiometricsReturn {
  const [derived, setDerived] = useState<DerivedMetrics | null>(null)
  const [evaluations, setEvaluations] = useState<NormEvaluation[]>([])
  const [metricSources, setMetricSources] = useState<Record<string, MetricSource>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAndCompute = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Fetch all completed submissions for this client with their responses
      const { data: submissions, error: fetchError } = await supabase
        .from('assessment_submissions')
        .select('id, bilan_date, submitted_at, assessment_responses(field_key, value_number)')
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .not('assessment_responses', 'is', null)
        .order('bilan_date', { ascending: true })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      // Build latestMeasured: for each field_key, keep the most recent value
      // Since submissions are ordered ASC by bilan_date, later submissions overwrite earlier ones
      const latestMeasured: Record<string, { value: number; date: string }> = {}

      for (const sub of submissions ?? []) {
        const rawDate: string = sub.bilan_date ?? sub.submitted_at ?? ''
        const date = rawDate.split('T')[0]
        if (!date) continue

        for (const resp of (sub.assessment_responses ?? []) as { field_key: string; value_number: number | null }[]) {
          if (
            typeof resp.field_key === 'string' &&
            typeof resp.value_number === 'number' &&
            resp.value_number !== null
          ) {
            latestMeasured[resp.field_key] = { value: resp.value_number, date }
          }
        }
      }

      const weight_kg = latestMeasured['weight_kg']?.value
      const height_cm = latestMeasured['height_cm']?.value

      if (weight_kg === undefined || height_cm === undefined) {
        setDerived(null)
        setEvaluations([])
        setMetricSources({})
        return
      }

      // Use the most recent bilan_date (last submission date) for age calculation
      const mostRecentDate = Object.values(latestMeasured)
        .map(m => m.date)
        .sort()
        .reverse()[0]

      let age_at_measurement: number | undefined
      if (clientProfile.date_of_birth && mostRecentDate) {
        const computed = calculateAge(clientProfile.date_of_birth, mostRecentDate)
        age_at_measurement = computed >= 0 ? computed : undefined
      }

      const normalizedSex = normalizeSex(clientProfile.sex)
      const sex: 'male' | 'female' = normalizedSex ?? 'male'

      const inputs: BiometricInputs = {
        weight_kg,
        height_cm,
        sex,
        age_at_measurement,
        body_fat_pct:       latestMeasured['body_fat_pct']?.value,
        fat_mass_kg:        latestMeasured['fat_mass_kg']?.value,
        muscle_mass_kg:     latestMeasured['muscle_mass_kg']?.value,
        muscle_mass_pct:    latestMeasured['muscle_mass_pct']?.value,
        skeletal_muscle_pct: latestMeasured['skeletal_muscle_pct']?.value,
        visceral_fat_level: latestMeasured['visceral_fat_level']?.value,
        body_water_pct:     latestMeasured['body_water_pct']?.value,
        bone_mass_kg:       latestMeasured['bone_mass_kg']?.value,
        waist_cm:           latestMeasured['waist_cm']?.value,
        neck_cm:            latestMeasured['neck_cm']?.value,
        hips_cm:            latestMeasured['hips_cm']?.value ?? latestMeasured['hip_cm']?.value,
        metabolic_age:      latestMeasured['metabolic_age']?.value,
      }

      const derivedResult = deriveMetrics(inputs)
      const evals = evaluateAll(derivedResult, sex, age_at_measurement)
      const sources = buildMetricSources(latestMeasured, derivedResult)

      setDerived(derivedResult)
      setEvaluations(evals)
      setMetricSources(sources)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [clientId, clientProfile.date_of_birth, clientProfile.sex])

  useEffect(() => {
    void fetchAndCompute()
  }, [fetchAndCompute])

  const applyNavySuggestion = useCallback(async () => {
    // Navy suggestion requires a specific submission context — not supported in the
    // multi-submission aggregation mode. This is intentional: if the coach has direct
    // measurements, Navy is not needed.
  }, [])

  return {
    derived,
    evaluations,
    criticalAlerts: evaluations.filter(e => e.is_critical),
    navySuggestion: derived?.navy_suggestion ?? null,
    metricSources,
    loading,
    error,
    applyNavySuggestion,
    refetch: fetchAndCompute,
  }
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep useBiometrics
```

Expected: no output. If errors appear in `BioNormsPanel.tsx` due to changed signature, that's expected — fix in Task 3.

- [ ] **Step 3: Commit**

```bash
git add lib/health/useBiometrics.ts
git commit -m "refactor(bionorms): useBiometrics now aggregates latest value per metric across all submissions"
```

---

## Task 3: Add `SourceBadge` to `BioNormsGauge`

**Files:**
- Modify: `components/health/BioNormsGauge.tsx`

Add a `MetricSource` import and a `SourceBadge` component. Add `source?: MetricSource` prop to `BioNormsGaugeProps`. Render badge between the value row and the segmented bar.

**Visual spec:**
- Measured: dot `#1f8a65` + text `Mesuré le 08/04` in `text-[#1f8a65]/80`
- Derived: dot `text-white/25` + text `Calculé le 08/04` in `text-white/30`, with formula in a tooltip on hover (same InfoTooltip pattern already used in the file)

- [ ] **Step 1: Add the import and SourceBadge component**

After the existing imports at the top of `components/health/BioNormsGauge.tsx`, add:

```typescript
import type { MetricSource } from '@/lib/health/useBiometrics'
```

Add this component after the `ZoneBadge` function (around line 147):

```typescript
// ---------------------------------------------------------------------------
// SourceBadge
// ---------------------------------------------------------------------------

function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${day}/${month}`
}

function SourceBadge({ source }: { source: MetricSource }) {
  const [formulaOpen, setFormulaOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!formulaOpen) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setFormulaOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [formulaOpen])

  if (source.type === 'measured') {
    return (
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block w-[5px] h-[5px] rounded-full shrink-0"
          style={{ backgroundColor: '#1f8a65' }}
        />
        <span className="text-[9px] font-medium leading-none" style={{ color: 'rgba(31,138,101,0.8)' }}>
          Mesuré le {formatShortDate(source.date)}
        </span>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative flex items-center gap-1.5">
      <span className="inline-block w-[5px] h-[5px] rounded-full bg-white/20 shrink-0" />
      <button
        type="button"
        onClick={() => source.formula ? setFormulaOpen(v => !v) : undefined}
        className={cn(
          'text-[9px] font-medium leading-none text-white/30',
          source.formula && 'underline decoration-dotted underline-offset-2 cursor-pointer hover:text-white/50',
        )}
      >
        Calculé le {formatShortDate(source.date)}
      </button>
      {formulaOpen && source.formula && (
        <div
          className="absolute left-0 top-5 z-50 rounded-xl px-3 py-2 w-[220px]"
          style={{
            background: '#0e0e0e',
            border: '0.5px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          <p className="text-[10px] text-white/50 leading-relaxed font-mono">
            {source.formula}
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update `BioNormsGaugeProps` and render `SourceBadge`**

Replace the `BioNormsGaugeProps` interface and `BioNormsGauge` function:

```typescript
export interface BioNormsGaugeProps {
  evaluation: NormEvaluation
  source?: MetricSource
  showSource?: boolean
  className?: string
}

export function BioNormsGauge({ evaluation, source, showSource = true, className }: BioNormsGaugeProps) {
  return (
    <div
      className={cn(
        'bg-white/[0.02] rounded-xl p-4 border-[0.3px] flex flex-col gap-3',
        evaluation.is_critical ? 'border-red-500/25' : 'border-white/[0.06]',
        className,
      )}
    >
      {/* Header : label + tooltip */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35 leading-none truncate">
          {evaluation.label_fr}
        </p>
        <InfoTooltip reference={evaluation.reference} zone_insight={evaluation.zone_insight} />
      </div>

      {/* Valeur + badge zone */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1 min-w-0">
          <span className="text-[20px] font-black text-white leading-none tabular-nums">
            {formatValue(evaluation.value, evaluation.unit)}
          </span>
          <span className="text-[11px] font-medium text-white/30 shrink-0">
            {evaluation.unit}
          </span>
        </div>
        <ZoneBadge zone={evaluation.zone} label={evaluation.zone_label_fr} />
      </div>

      {/* Source badge — mesuré ou calculé */}
      {source && <SourceBadge source={source} />}

      {/* Barre segmentée */}
      <SegmentedBar ranges={evaluation.ranges} activeZone={evaluation.zone} />

      {/* Source footer optionnel (référence scientifique) */}
      {showSource && (
        <p className="text-[9px] text-white/20 leading-none truncate">
          {evaluation.reference.source}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep BioNormsGauge
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/health/BioNormsGauge.tsx
git commit -m "feat(bionorms): add SourceBadge to BioNormsGauge — Mesuré/Calculé with date and formula"
```

---

## Task 4: Update `BioNormsPanel` — drop `submissionId`, accept `clientId`

**Files:**
- Modify: `components/health/BioNormsPanel.tsx`

- [ ] **Step 1: Replace the full content of `BioNormsPanel.tsx`**

```typescript
'use client'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { BioNormsGauge } from './BioNormsGauge'
import { NavySuggestionBanner } from './NavySuggestionBanner'
import { useBiometrics } from '@/lib/health/useBiometrics'
import type { NormEvaluation } from '@/lib/health/bioNorms'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BioNormsPanelProps {
  clientId: string
  clientProfile: {
    date_of_birth?: string | null
    sex?: string | null
  }
  className?: string
}

// ---------------------------------------------------------------------------
// Sections de groupement
// ---------------------------------------------------------------------------

const METRIC_SECTIONS = [
  {
    label: 'Composition Corporelle',
    keys: ['body_fat_pct', 'muscle_mass_pct', 'lean_mass_kg', 'bone_mass_kg'],
  },
  {
    label: 'Santé Métabolique',
    keys: ['bmi', 'visceral_fat_level', 'body_water_pct'],
  },
  {
    label: 'Morphométrie',
    keys: ['waist_cm', 'waist_hip_ratio', 'waist_height_ratio'],
  },
  {
    label: 'Métabolisme',
    keys: ['metabolic_age_delta'],
  },
]

// ---------------------------------------------------------------------------
// GaugeSkeleton
// ---------------------------------------------------------------------------

function GaugeSkeleton() {
  return (
    <div className="bg-white/[0.02] rounded-xl p-4 border-[0.3px] border-white/[0.06] flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-2 w-24" />
        <Skeleton className="h-4 w-4 rounded-md shrink-0" />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-2.5 w-6" />
        </div>
        <Skeleton className="h-5 w-16 rounded-md shrink-0" />
      </div>
      {/* Source badge skeleton */}
      <Skeleton className="h-2.5 w-28" />
      {/* Barre segmentée */}
      <div className="flex gap-[3px]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-[3px] flex-1 rounded-full bg-white/[0.06] animate-pulse" />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function BioNormsPanel({
  clientId,
  clientProfile,
  className,
}: BioNormsPanelProps) {
  const {
    loading,
    error,
    evaluations,
    criticalAlerts,
    navySuggestion,
    metricSources,
    applyNavySuggestion,
  } = useBiometrics(clientId, clientProfile)

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div>
          <Skeleton className="h-2.5 w-36 mb-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4].map((i) => <GaugeSkeleton key={i} />)}
          </div>
        </div>
        <div>
          <Skeleton className="h-2.5 w-28 mb-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => <GaugeSkeleton key={i} />)}
          </div>
        </div>
        <div>
          <Skeleton className="h-2.5 w-24 mb-3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2].map((i) => <GaugeSkeleton key={i} />)}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('bg-white/[0.02] rounded-xl p-6 border-[0.3px] border-white/[0.06] text-center', className)}>
        <p className="text-[13px] text-red-400">{error}</p>
      </div>
    )
  }

  if (evaluations.length === 0) {
    return (
      <div className={cn('bg-white/[0.02] rounded-xl p-6 border-[0.3px] border-white/[0.06] text-center', className)}>
        <p className="text-[13px] text-white/40">
          Données biométriques insuffisantes pour afficher les normes.
        </p>
        <p className="text-[11px] text-white/30 mt-1">
          Le poids et la taille sont requis au minimum.
        </p>
      </div>
    )
  }

  return (
    <div className={cn(className)}>
      {/* Alertes critiques */}
      {criticalAlerts.length > 0 && (
        <div className="mb-5 rounded-xl border-[0.3px] border-red-500/20 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border-b border-red-500/10">
            <span className="text-red-400 text-[10px]">⚠</span>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-red-400/80">
              {criticalAlerts.length === 1 ? 'Valeur critique détectée' : `${criticalAlerts.length} valeurs critiques détectées`}
            </p>
          </div>
          {criticalAlerts.map((alert, i) => (
            <div
              key={alert.metric_key}
              className={cn(
                'flex items-center justify-between gap-3 px-4 py-3 bg-red-500/[0.04]',
                i < criticalAlerts.length - 1 && 'border-b border-red-500/[0.08]',
              )}
            >
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-white/80 leading-snug">{alert.label_fr}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{alert.value} {alert.unit}</p>
              </div>
              <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.08em] text-red-400 bg-red-500/10 px-2 py-1 rounded-md">
                {alert.zone_label_fr}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bandeau Navy */}
      <NavySuggestionBanner
        suggestion={navySuggestion}
        onApply={applyNavySuggestion}
        className="mb-4"
      />

      {/* Sections de jauges */}
      {METRIC_SECTIONS.map((section) => {
        const sectionEvals = section.keys
          .map((key) => evaluations.find((e) => e.metric_key === key))
          .filter((e): e is NormEvaluation => e !== undefined)

        if (sectionEvals.length === 0) return null

        return (
          <div key={section.label} className="mb-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40 mb-3">
              {section.label}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sectionEvals.map((ev) => (
                <BioNormsGauge
                  key={ev.metric_key}
                  evaluation={ev}
                  source={metricSources[ev.metric_key]}
                  showSource={false}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "BioNormsPanel|useBiometrics"
```

Expected: errors in `MetricsSection.tsx` only (wrong props passed) — fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add components/health/BioNormsPanel.tsx
git commit -m "refactor(bionorms): BioNormsPanel now accepts clientId, wires metricSources to gauges"
```

---

## Task 5: Update `MetricsSection.tsx` — pass `clientId` to `BioNormsPanel`

**Files:**
- Modify: `components/clients/MetricsSection.tsx`

`BioNormsPanel` no longer accepts `submissionId` or `bilanDate`. It now takes `clientId`. The `normsSubmissionId` logic can be kept to gate the "Normes" tab (requires at least one submission with weight+height), but the panel itself receives `clientId`.

- [ ] **Step 1: Find the `BioNormsPanel` usage in MetricsSection**

Search for the existing call (around line 5135):

```tsx
{viewMode === "norms" && normsSubmissionId && (
  <BioNormsPanel
    submissionId={normsSubmissionId}
    clientProfile={{ sex: clientGender }}
    bilanDate={rows.find((r) => r.submissionId === normsSubmissionId)?.date}
  />
)}
```

Replace with:

```tsx
{viewMode === "norms" && normsSubmissionId && (
  <BioNormsPanel
    clientId={clientId}
    clientProfile={{ sex: clientGender }}
  />
)}
```

Note: `clientId` is already a prop of the parent component in MetricsSection. Verify by checking the component's props signature near the top of the file.

- [ ] **Step 2: Run full TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "stripe\|payments\|bilans\|programme\|BodyFat\|GenericString"
```

Expected: 0 errors related to the files touched in this plan. Pre-existing errors in unrelated files are acceptable.

- [ ] **Step 3: Commit**

```bash
git add components/clients/MetricsSection.tsx
git commit -m "fix(bionorms): pass clientId to BioNormsPanel instead of submissionId"
```

---

## Task 6: Update CHANGELOG and project-state

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude/rules/project-state.md`

- [ ] **Step 1: Add CHANGELOG entry**

Add at the top of today's section in `CHANGELOG.md`:

```
FEATURE: BioNorms — Normes view now displays the most recent directly-entered value per metric across all submissions (not just one bilan)
FEATURE: BioNorms — Each gauge now shows a "Mesuré le JJ/MM" (green) or "Calculé le JJ/MM · formule" (grey) source badge
REFACTOR: useBiometrics — now accepts clientId and aggregates latest value per field_key across all completed submissions
```

- [ ] **Step 2: Add project-state section**

Add a new dated section at the top of `.claude/rules/project-state.md`:

```markdown
## 2026-04-14 — BioNorms : valeur de vérité par métrique + badge source

**Ce qui a été fait :**

1. **`lib/health/healthMath.ts`** — constante `DERIVED_FORMULAS`
   - Map `field_key → formule lisible` pour toutes les métriques dérivées

2. **`lib/health/useBiometrics.ts`** — refonte agrégation
   - Accepte `clientId` au lieu de `submissionId`
   - Fetch toutes les `assessment_submissions` completed du client
   - Construit `latestMeasured: Record<field_key, { value, date }>` — la valeur la plus récente par métrique, toutes sources confondues (bilan, saisie manuelle, CSV)
   - Expose `metricSources: Record<string, MetricSource>` avec `type: 'measured' | 'derived'`, `date`, et `formula?`

3. **`components/health/BioNormsGauge.tsx`** — badge source
   - `SourceBadge` : puce verte "Mesuré le JJ/MM" ou puce grise "Calculé le JJ/MM" cliquable → tooltip formule

4. **`components/health/BioNormsPanel.tsx`** — signature mise à jour
   - Accepte `clientId` (plus de `submissionId` ni `bilanDate`)
   - Passe `metricSources[ev.metric_key]` à chaque `BioNormsGauge`

5. **`components/clients/MetricsSection.tsx`** — appel mis à jour
   - `<BioNormsPanel clientId={clientId} ...>`

**Points de vigilance :**
- `normsSubmissionId` dans MetricsSection est conservé uniquement comme gate (désactive l'onglet Normes si aucune submission avec poids+taille) — il ne sert plus au fetch
- La Navy suggestion est désactivée en mode multi-submission (son application requiert une submission cible spécifique) — cas marginal acceptable Phase 1
- `lean_mass_kg` est cherché dans `latestMeasured` comme field_key direct — si un coach entre cette valeur via saisie manuelle, elle prime sur le calcul
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md .claude/rules/project-state.md
git commit -m "docs: update CHANGELOG and project-state for BioNorms measured-vs-derived feature"
```

---

## Self-Review

**Spec coverage:**
- ✅ Latest directly-entered value per metric across all submissions → Task 2 (`latestMeasured`)
- ✅ Fallback to derived when no direct measurement → Task 2 (`deriveMetrics` only called with what's in `latestMeasured`)
- ✅ Badge "Mesuré le JJ/MM" (green) → Task 3 (`SourceBadge`, measured branch)
- ✅ Badge "Calculé le JJ/MM · formule" (grey, cliquable) → Task 3 (`SourceBadge`, derived branch)
- ✅ All metrics, not just lean_mass_kg → Task 2 (`buildMetricSources` covers all eval keys)
- ✅ No DB change → confirmed, only fetch pattern changes
- ✅ `clientId` wired end-to-end → Tasks 4 + 5

**Placeholder scan:** No TBD, no "implement later", no missing code blocks.

**Type consistency:**
- `MetricSource` defined in `useBiometrics.ts`, imported in `BioNormsGauge.tsx` ✅
- `DERIVED_FORMULAS` exported from `healthMath.ts`, imported in `useBiometrics.ts` ✅
- `clientId` prop in `BioNormsPanel` matches what `MetricsSection` passes ✅
- `metricSources[ev.metric_key]` — `ev.metric_key` matches keys used in `buildMetricSources` (`body_fat_pct`, `lean_mass_kg`, `metabolic_age_delta`, etc.) ✅
