import type {
  OverlayMetadataEntry,
  OverlayMetricDefinition,
} from '@/lib/coach/metricsOverlay/types'

export const OVERLAY_METRICS: OverlayMetricDefinition[] = [
  { key: 'weight_kg', label: 'Poids', family: 'body', mode: 'observed', unit: 'kg', color: '#9ca3af', correlationEligible: true },
  { key: 'body_fat_pct', label: 'Masse grasse %', family: 'body', mode: 'observed', unit: '%', color: '#f97316', correlationEligible: true },
  { key: 'fat_mass_kg', label: 'Masse grasse', family: 'body', mode: 'observed', unit: 'kg', color: '#fb923c', correlationEligible: true },
  { key: 'lean_mass_kg', label: 'Masse maigre', family: 'body', mode: 'observed', unit: 'kg', color: '#2dd4bf', correlationEligible: true },
  { key: 'muscle_mass_kg', label: 'Masse musculaire', family: 'body', mode: 'observed', unit: 'kg', color: '#1f8a65', correlationEligible: true },
  { key: 'muscle_mass_pct', label: 'Masse musculaire %', family: 'body', mode: 'observed', unit: '%', color: '#34d399', correlationEligible: true },
  { key: 'skeletal_muscle_pct', label: 'Musc. squelettique %', family: 'body', mode: 'observed', unit: '%', color: '#86efac', correlationEligible: true },
  { key: 'body_water_pct', label: 'Hydrique %', family: 'body', mode: 'observed', unit: '%', color: '#38bdf8', correlationEligible: true },
  { key: 'bone_mass_kg', label: 'Masse osseuse', family: 'body', mode: 'observed', unit: 'kg', color: '#a78bfa', correlationEligible: true },
  { key: 'visceral_fat_level', label: 'Graisse viscérale', family: 'body', mode: 'observed', unit: '', color: '#ef4444', correlationEligible: true },
  { key: 'waist_cm', label: 'Tour de taille', family: 'body', mode: 'observed', unit: 'cm', color: '#fbbf24', correlationEligible: true },
  { key: 'hips_cm', label: 'Hanches', family: 'body', mode: 'observed', unit: 'cm', color: '#f472b6', correlationEligible: true },
  { key: 'chest_cm', label: 'Poitrine', family: 'body', mode: 'observed', unit: 'cm', color: '#fb7185', correlationEligible: true },
  { key: 'arm_cm', label: 'Bras', family: 'body', mode: 'observed', unit: 'cm', color: '#22c55e', correlationEligible: true },
  { key: 'thigh_cm', label: 'Cuisse', family: 'body', mode: 'observed', unit: 'cm', color: '#14b8a6', correlationEligible: true },
  { key: 'calf_cm', label: 'Mollet', family: 'body', mode: 'observed', unit: 'cm', color: '#06b6d4', correlationEligible: true },
  { key: 'neck_cm', label: 'Cou', family: 'body', mode: 'observed', unit: 'cm', color: '#8b5cf6', correlationEligible: true },
  { key: 'waist_hip_ratio', label: 'Ratio taille/hanches', family: 'body', mode: 'observed', unit: '', color: '#f59e0b', correlationEligible: true },

  { key: 'sleep_duration_h', label: 'Sommeil', family: 'recovery', mode: 'observed', unit: 'h', color: '#60a5fa', correlationEligible: true },
  { key: 'energy_level', label: 'Énergie', family: 'recovery', mode: 'observed', unit: '/5', color: '#facc15', correlationEligible: true },
  { key: 'stress_level', label: 'Stress', family: 'recovery', mode: 'observed', unit: '/5', color: '#f87171', correlationEligible: true },
  { key: 'muscle_soreness', label: 'Courbatures', family: 'recovery', mode: 'observed', unit: '/4', color: '#c084fc', correlationEligible: true },

  { key: 'protein_consumed_g', label: 'Protéines consommées', family: 'nutrition', mode: 'consumed', unit: 'g', color: '#22c55e', correlationEligible: true },
  { key: 'carbs_consumed_g', label: 'Glucides consommés', family: 'nutrition', mode: 'consumed', unit: 'g', color: '#f59e0b', correlationEligible: true },
  { key: 'fat_consumed_g', label: 'Lipides consommés', family: 'nutrition', mode: 'consumed', unit: 'g', color: '#ef4444', correlationEligible: true },
  { key: 'calories_consumed_kcal', label: 'Calories consommées', family: 'nutrition', mode: 'consumed', unit: 'kcal', color: '#f97316', correlationEligible: true },
  { key: 'hydration_consumed_ml', label: 'Hydratation consommée', family: 'nutrition', mode: 'consumed', unit: 'ml', color: '#38bdf8', correlationEligible: true },
  { key: 'protein_planned_g', label: 'Protéines prévues', family: 'nutrition', mode: 'planned', unit: 'g', color: '#22c55e', dashed: true, correlationEligible: true },
  { key: 'carbs_planned_g', label: 'Glucides prévus', family: 'nutrition', mode: 'planned', unit: 'g', color: '#f59e0b', dashed: true, correlationEligible: true },
  { key: 'fat_planned_g', label: 'Lipides prévus', family: 'nutrition', mode: 'planned', unit: 'g', color: '#ef4444', dashed: true, correlationEligible: true },
  { key: 'calories_planned_kcal', label: 'Calories prévues', family: 'nutrition', mode: 'planned', unit: 'kcal', color: '#f97316', dashed: true, correlationEligible: true },
  { key: 'hydration_planned_ml', label: 'Hydratation prévue', family: 'nutrition', mode: 'planned', unit: 'ml', color: '#38bdf8', dashed: true, correlationEligible: true },

  { key: 'performance_avg_rir', label: 'RIR moyen', family: 'performance', mode: 'observed', unit: 'RIR', color: '#a78bfa', correlationEligible: true },
  { key: 'performance_avg_rpe', label: 'RPE moyen', family: 'performance', mode: 'observed', unit: 'RPE', color: '#e879f9', correlationEligible: true },
  { key: 'performance_volume', label: 'Volume', family: 'performance', mode: 'observed', unit: 'kg', color: '#14b8a6', correlationEligible: true },
  { key: 'performance_avg_load', label: 'Charge moyenne', family: 'performance', mode: 'observed', unit: 'kg', color: '#06b6d4', correlationEligible: true },
  { key: 'performance_completion_rate', label: 'Complétion des sets', family: 'performance', mode: 'observed', unit: '%', color: '#10b981', correlationEligible: true },
]

export const OVERLAY_METRIC_MAP = Object.fromEntries(
  OVERLAY_METRICS.map((metric) => [metric.key, metric]),
) as Record<string, OverlayMetricDefinition>

export function buildOverlayMetadata(): Record<string, OverlayMetadataEntry> {
  return Object.fromEntries(
    OVERLAY_METRICS.map((metric) => [
      metric.key,
      {
        label: metric.label,
        family: metric.family,
        mode: metric.mode,
        unit: metric.unit,
        color: metric.color,
        dashed: Boolean(metric.dashed),
        correlationEligible: metric.correlationEligible,
      },
    ]),
  )
}
