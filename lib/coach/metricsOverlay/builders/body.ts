import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  OverlayBuilderContext,
  OverlaySeriesMap,
} from '@/lib/coach/metricsOverlay/types'

type AssessmentResponseRow = {
  field_key: string
  value_number: number | null
}

const BODY_FIELDS = new Set([
  'weight_kg',
  'body_fat_pct',
  'fat_mass_kg',
  'lean_mass_kg',
  'muscle_mass_kg',
  'muscle_mass_pct',
  'skeletal_muscle_pct',
  'body_water_pct',
  'bone_mass_kg',
  'visceral_fat_level',
  'waist_cm',
  'hips_cm',
  'chest_cm',
  'arm_cm',
  'thigh_cm',
  'calf_cm',
  'neck_cm',
  'waist_hip_ratio',
])

export async function buildBodyOverlaySeries(
  db: SupabaseClient,
  ctx: OverlayBuilderContext,
): Promise<OverlaySeriesMap> {
  const { data, error } = await db
    .from('assessment_submissions')
    .select('id, submitted_at, bilan_date, created_at, assessment_responses(field_key, value_number)')
    .eq('client_id', ctx.clientId)
    .eq('coach_id', ctx.coachId)
    .eq('status', 'completed')
    .gte('submitted_at', `${ctx.startDateKey}T00:00:00.000Z`)
    .lte('submitted_at', `${ctx.endDateKey}T23:59:59.999Z`)
    .order('submitted_at', { ascending: true })

  if (error) {
    throw new Error(`Body overlay query failed: ${error.message}`)
  }

  const series: OverlaySeriesMap = {}

  for (const submission of data ?? []) {
    const rawDate = String(
      submission.bilan_date ??
      submission.submitted_at ??
      submission.created_at ??
      '',
    )
    const date = rawDate.split('T')[0]
    if (!date || date < ctx.startDateKey || date > ctx.endDateKey) continue

    for (const response of ((submission.assessment_responses ?? []) as AssessmentResponseRow[])) {
      if (!BODY_FIELDS.has(response.field_key) || response.value_number == null) continue
      if (!series[response.field_key]) series[response.field_key] = []
      series[response.field_key].push({ date, value: Number(response.value_number) })
    }
  }

  return series
}
