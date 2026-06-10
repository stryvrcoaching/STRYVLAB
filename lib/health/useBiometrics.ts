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

/** Most recent date among the given field keys in latestMeasured */
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

  // waist_hip_ratio — always derived
  sources['waist_hip_ratio'] = {
    type: 'derived',
    date: latestDateAmong(['waist_cm', 'hips_cm'], latestMeasured),
    formula: DERIVED_FORMULAS['waist_hip_ratio'],
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

      // Fetch all completed submissions for this client with their responses, ordered ASC
      // so later submissions overwrite earlier ones when building latestMeasured
      const { data: submissions, error: fetchError } = await supabase
        .from('assessment_submissions')
        .select('id, bilan_date, submitted_at, assessment_responses(field_key, value_number)')
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .order('bilan_date', { ascending: true })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      // Build latestMeasured: for each field_key, the most recent value wins
      const latestMeasured: Record<string, { value: number; date: string }> = {}

      for (const sub of submissions ?? []) {
        const rawDate: string = (sub.bilan_date ?? sub.submitted_at ?? '') as string
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

      // Use the most recent date across all measured fields for age calculation
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
        body_fat_pct:        latestMeasured['body_fat_pct']?.value,
        fat_mass_kg:         latestMeasured['fat_mass_kg']?.value,
        muscle_mass_kg:      latestMeasured['muscle_mass_kg']?.value,
        muscle_mass_pct:     latestMeasured['muscle_mass_pct']?.value,
        skeletal_muscle_pct: latestMeasured['skeletal_muscle_pct']?.value,
        visceral_fat_level:  latestMeasured['visceral_fat_level']?.value,
        body_water_pct:      latestMeasured['body_water_pct']?.value,
        bone_mass_kg:        latestMeasured['bone_mass_kg']?.value,
        waist_cm:            latestMeasured['waist_cm']?.value,
        neck_cm:             latestMeasured['neck_cm']?.value,
        hips_cm:             latestMeasured['hips_cm']?.value ?? latestMeasured['hip_cm']?.value,
        metabolic_age:       latestMeasured['metabolic_age']?.value,
      }

      const derivedResult = deriveMetrics(inputs)
      const evals = evaluateAll(
        { ...derivedResult, metabolic_age_source: derivedResult.metabolic_age_source },
        age_at_measurement ?? 0,
        sex,
      )
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

  // Navy suggestion requires a specific submission context — not applicable in
  // multi-submission aggregation mode (coach has direct measurements, Navy not needed)
  const applyNavySuggestion = useCallback(async () => {}, [])

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
