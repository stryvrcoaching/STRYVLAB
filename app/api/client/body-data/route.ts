
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface BilanMeasures {
  bilanIndex: number
  date: string
  values: Record<string, number | null>
}

export interface BodyDataResponse {
  weightSeries:    { date: string; value: number; bilanIndex: number }[]
  bodyFatSeries:   { date: string; value: number; bilanIndex: number }[]
  leanMassSeries:  { date: string; value: number; bilanIndex: number }[]
  composition:     {
    body_fat_pct: number | null
    lean_mass_kg: number | null
    muscle_mass_kg: number | null
    skeletal_muscle_pct: number | null
    visceral_fat_level: number | null
    body_water_pct: number | null
    muscle_mass_pct: number | null
    bone_mass_kg: number | null
  }
  measures:        Record<string, number | null>
  measureOrder:    string[]
  measureLabels:   Record<string, string>
  latestWeight:    number | null
  measuresByBilan: BilanMeasures[]
  annotations:     { date: string; label: string }[]
}

const MEASURE_FIELDS: Array<{ key: string; label: string; aliases?: string[] }> = [
  { key: 'neck_cm', label: 'Cou' },
  { key: 'shoulder_circumference_cm', label: 'Épaules', aliases: ['shoulder_width_cm'] },
  { key: 'chest_cm', label: 'Poitrine' },
  { key: 'waist_cm', label: 'Tour de taille' },
  { key: 'hips_cm', label: 'Hanches' },
  { key: 'glute_cm', label: 'Fessiers' },
  { key: 'arm_left_cm', label: 'Bras gauche', aliases: ['arm_cm'] },
  { key: 'arm_right_cm', label: 'Bras droit', aliases: ['arm_cm'] },
  { key: 'forearm_left_cm', label: 'Avant-bras gauche' },
  { key: 'forearm_right_cm', label: 'Avant-bras droit' },
  { key: 'thigh_left_cm', label: 'Cuisse gauche', aliases: ['thigh_cm'] },
  { key: 'thigh_right_cm', label: 'Cuisse droite', aliases: ['thigh_cm'] },
  { key: 'calf_left_cm', label: 'Mollet gauche', aliases: ['calf_cm'] },
  { key: 'calf_right_cm', label: 'Mollet droit', aliases: ['calf_cm'] },
]

function pickMeasureValue(values: Record<string, number>, def: { key: string; aliases?: string[] }): number | null {
  if (values[def.key] != null) return values[def.key]
  for (const a of def.aliases ?? []) {
    if (values[a] != null) return values[a]
  }
  return null
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = svc()
  const client = await resolveClientFromUser(user.id, user.email, service, 'id')
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const clientId = (client as any).id as string

  const [submissionsRes, annotationsRes] = await Promise.all([
    service
      .from('assessment_submissions')
      .select('id, bilan_date, submitted_at, assessment_responses(field_key, value_number)')
      .eq('client_id', clientId)
      .eq('status', 'completed')
      .order('bilan_date', { ascending: true })
      .limit(20),
    service
      .from('metric_annotations')
      .select('annotation_date, label')
      .eq('client_id', clientId)
      .not('label', 'is', null)
      .neq('event_type', 'injury')
      .order('annotation_date', { ascending: true }),
  ])

  const empty: BodyDataResponse = {
    weightSeries: [], bodyFatSeries: [], leanMassSeries: [],
    composition: {
      body_fat_pct: null, lean_mass_kg: null, muscle_mass_kg: null,
      skeletal_muscle_pct: null, visceral_fat_level: null, body_water_pct: null,
      muscle_mass_pct: null, bone_mass_kg: null,
    },
    measures: {},
    measureOrder: MEASURE_FIELDS.map(m => m.key),
    measureLabels: Object.fromEntries(MEASURE_FIELDS.map(m => [m.key, m.label])),
    latestWeight: null, measuresByBilan: [], annotations: [],
  }

  const submissions = submissionsRes.data
  if (!submissions || submissions.length === 0) {
    return NextResponse.json(empty)
  }

  const weightSeries:   { date: string; value: number; bilanIndex: number }[] = []
  const bodyFatSeries:  { date: string; value: number; bilanIndex: number }[] = []
  const leanMassSeries: { date: string; value: number; bilanIndex: number }[] = []
  const measuresByBilan: BilanMeasures[] = []
  const latestValues: Record<string, number> = {}

  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i] as any
    const bilanIndex = i + 1
    const date = sub.bilan_date ?? sub.submitted_at?.split('T')[0] ?? ''
    const responses = sub.assessment_responses as { field_key: string; value_number: number | null }[]
    if (!responses) continue

    const bilanValues: Record<string, number> = {}
    for (const r of responses) {
      if (r.value_number == null) continue
      bilanValues[r.field_key] = r.value_number
      latestValues[r.field_key] = r.value_number
    }

    if (bilanValues['weight_kg'] != null)
      weightSeries.push({ date, value: bilanValues['weight_kg'], bilanIndex })
    if (bilanValues['body_fat_pct'] != null)
      bodyFatSeries.push({ date, value: bilanValues['body_fat_pct'], bilanIndex })
    if (bilanValues['lean_mass_kg'] != null)
      leanMassSeries.push({ date, value: bilanValues['lean_mass_kg'], bilanIndex })

    const snapshot: Record<string, number | null> = {}
    for (const def of MEASURE_FIELDS) {
      snapshot[def.key] = pickMeasureValue(bilanValues, def)
    }
    measuresByBilan.push({ bilanIndex, date, values: snapshot })
  }

  const annotations = (annotationsRes.data ?? []).map((a: any) => ({
    date: a.annotation_date,
    label: a.label,
  }))

  const measures: Record<string, number | null> = {}
  for (const def of MEASURE_FIELDS) {
    measures[def.key] = pickMeasureValue(latestValues, def)
  }

  return NextResponse.json({
    weightSeries,
    bodyFatSeries,
    leanMassSeries,
    composition: {
      body_fat_pct:   latestValues['body_fat_pct']   ?? null,
      lean_mass_kg:   latestValues['lean_mass_kg']   ?? null,
      muscle_mass_kg: latestValues['muscle_mass_kg'] ?? null,
      skeletal_muscle_pct: latestValues['skeletal_muscle_pct'] ?? null,
      visceral_fat_level: latestValues['visceral_fat_level'] ?? null,
      body_water_pct: latestValues['body_water_pct'] ?? null,
      muscle_mass_pct: latestValues['muscle_mass_pct'] ?? null,
      bone_mass_kg: latestValues['bone_mass_kg'] ?? null,
    },
    measures,
    measureOrder: MEASURE_FIELDS.map(m => m.key),
    measureLabels: Object.fromEntries(MEASURE_FIELDS.map(m => [m.key, m.label])),
    latestWeight: weightSeries.length > 0 ? weightSeries[weightSeries.length - 1].value : null,
    measuresByBilan,
    annotations,
  } satisfies BodyDataResponse)
}
