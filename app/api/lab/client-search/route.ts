import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 1) return NextResponse.json({ clients: [] })

  const db = serviceClient()

  const { data: clients, error } = await db
    .from('coach_clients')
    .select('id, first_name, last_name, email, date_of_birth, gender, weekly_frequency, fitness_level, training_goal, sport_practice, equipment_category')
    .eq('coach_id', user.id)
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
    .order('first_name', { ascending: true })
    .limit(8)

  if (error) {
    console.error('[lab/client-search] clients query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!clients || clients.length === 0) return NextResponse.json({ clients: [] })

  const clientIds = clients.map((c) => c.id)

  const { data: submissions, error: subError } = await db
    .from('assessment_submissions')
    .select(`
      client_id,
      submitted_at,
      assessment_responses(field_key, value_number, value_text, value_json)
    `)
    .in('client_id', clientIds)
    .eq('coach_id', user.id)
    .eq('status', 'completed')
    .order('submitted_at', { ascending: false })
    .limit(80)

  if (subError) {
    console.error('[lab/client-search] submissions query error:', subError)
  }

  // ── Metric map ────────────────────────────────────────────────────────────
  // Most-recent fields : biometrics, training, cardio, lifestyle
  // Averaged fields (last 3) : wellness
  type MetricEntry = {
    // Biometrics — most recent
    weight_kg:          number | null
    body_fat_pct:       number | null
    height_cm:          number | null
    muscle_mass_kg:     number | null
    lean_mass_kg:       number | null
    bmr_kcal_measured:  number | null
    visceral_fat_level: number | null
    body_water_pct:     number | null
    waist_cm:           number | null
    // Training — most recent
    session_duration_min:     number | null
    training_calories:        number | null
    training_frequency:       number | null
    perceived_intensity:      number | null
    training_types:           string | null   // JSON string[]
    // Cardio — most recent
    daily_steps:        number | null
    cardio_frequency:   number | null
    cardio_duration_min: number | null
    cardio_types:       string | null         // JSON string[]
    // Wellness — avg last 3
    stress_level_samples:        number[]
    sleep_duration_h_samples:    number[]
    sleep_quality_samples:       number[]
    energy_level_samples:        number[]
    recovery_score_samples:      number[]
    post_session_recovery_samples: number[]
    // Lifestyle — most recent
    caffeine_daily_mg:    number | null
    alcohol_weekly:       number | null
    work_hours_per_week:  number | null
    menstrual_cycle:      string | null
    // General
    occupation:           string | null
  }

  const BIOMETRIC_FIELDS = [
    'weight_kg', 'body_fat_pct', 'height_cm', 'muscle_mass_kg', 'lean_mass_kg',
    'bmr_kcal_measured', 'visceral_fat_level', 'body_water_pct', 'waist_cm',
  ] as const

  const TRAINING_FIELDS = [
    'session_duration_min', 'training_calories', 'training_frequency', 'perceived_intensity',
  ] as const

  const CARDIO_FIELDS = [
    'daily_steps', 'cardio_frequency', 'cardio_duration_min',
  ] as const

  const LIFESTYLE_FIELDS = [
    'caffeine_daily_mg', 'alcohol_weekly', 'work_hours_per_week',
  ] as const

  const WELLNESS_SAMPLE_FIELDS = [
    'stress_level', 'sleep_duration_h', 'sleep_quality',
    'energy_level', 'recovery_score', 'post_session_recovery',
  ] as const

  const metricMap: Record<string, MetricEntry> = {}

  for (const sub of (submissions ?? [])) {
    if (!metricMap[sub.client_id]) {
      metricMap[sub.client_id] = {
        weight_kg: null, body_fat_pct: null, height_cm: null,
        muscle_mass_kg: null, lean_mass_kg: null, bmr_kcal_measured: null,
        visceral_fat_level: null, body_water_pct: null, waist_cm: null,
        session_duration_min: null, training_calories: null, training_frequency: null,
        perceived_intensity: null, training_types: null,
        daily_steps: null, cardio_frequency: null, cardio_duration_min: null, cardio_types: null,
        stress_level_samples: [], sleep_duration_h_samples: [], sleep_quality_samples: [],
        energy_level_samples: [], recovery_score_samples: [], post_session_recovery_samples: [],
        caffeine_daily_mg: null, alcohol_weekly: null, work_hours_per_week: null,
        menstrual_cycle: null, occupation: null,
      }
    }
    const entry = metricMap[sub.client_id]
    const responses = sub.assessment_responses as {
      field_key: string
      value_number: number | null
      value_text: string | null
      value_json: unknown
    }[] ?? []

    for (const r of responses) {
      const num = r.value_number

      // Biometrics — most recent
      if (BIOMETRIC_FIELDS.includes(r.field_key as typeof BIOMETRIC_FIELDS[number])) {
        const key = r.field_key as keyof MetricEntry
        if ((entry as Record<string, unknown>)[key] === null && num !== null) {
          (entry as Record<string, unknown>)[key] = num
        }
        continue
      }

      // Training — most recent
      if (TRAINING_FIELDS.includes(r.field_key as typeof TRAINING_FIELDS[number])) {
        const key = r.field_key as keyof MetricEntry
        if ((entry as Record<string, unknown>)[key] === null && num !== null) {
          (entry as Record<string, unknown>)[key] = num
        }
        continue
      }

      if (r.field_key === 'training_types' && entry.training_types === null && Array.isArray(r.value_json)) {
        entry.training_types = JSON.stringify(r.value_json); continue
      }

      // Cardio — most recent
      if (CARDIO_FIELDS.includes(r.field_key as typeof CARDIO_FIELDS[number])) {
        const key = r.field_key as keyof MetricEntry
        if ((entry as Record<string, unknown>)[key] === null && num !== null) {
          (entry as Record<string, unknown>)[key] = num
        }
        continue
      }

      if (r.field_key === 'cardio_types' && entry.cardio_types === null && Array.isArray(r.value_json)) {
        entry.cardio_types = JSON.stringify(r.value_json); continue
      }

      // Lifestyle — most recent
      if (LIFESTYLE_FIELDS.includes(r.field_key as typeof LIFESTYLE_FIELDS[number])) {
        const key = r.field_key as keyof MetricEntry
        if ((entry as Record<string, unknown>)[key] === null && num !== null) {
          (entry as Record<string, unknown>)[key] = num
        }
        continue
      }

      // Wellness — avg last 3 samples
      if (r.field_key === 'stress_level'          && num !== null && entry.stress_level_samples.length < 3)         { entry.stress_level_samples.push(num); continue }
      if (r.field_key === 'sleep_duration_h'       && num !== null && entry.sleep_duration_h_samples.length < 3)    { entry.sleep_duration_h_samples.push(num); continue }
      if (r.field_key === 'sleep_quality'          && num !== null && entry.sleep_quality_samples.length < 3)       { entry.sleep_quality_samples.push(num); continue }
      if (r.field_key === 'energy_level'           && num !== null && entry.energy_level_samples.length < 3)        { entry.energy_level_samples.push(num); continue }
      if (r.field_key === 'recovery_score'         && num !== null && entry.recovery_score_samples.length < 3)      { entry.recovery_score_samples.push(num); continue }
      if (r.field_key === 'post_session_recovery'  && num !== null && entry.post_session_recovery_samples.length < 3) { entry.post_session_recovery_samples.push(num); continue }

      // Text fields — most recent
      if (r.field_key === 'occupation'      && entry.occupation === null      && r.value_text) { entry.occupation = r.value_text; continue }
      if (r.field_key === 'menstrual_cycle' && entry.menstrual_cycle === null && r.value_text) { entry.menstrual_cycle = r.value_text; continue }
    }
  }

  function avg(samples: number[]): number | null {
    if (samples.length === 0) return null
    return Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10
  }

  const OCCUPATION_MULTIPLIER_MAP: Record<string, number> = {
    'Sédentaire (bureau)':            1.00,
    'Légèrement actif':               1.05,
    'Modérément actif':               1.10,
    'Très actif (travail physique)':  1.18,
  }

  const enriched = clients.map((c) => {
    let age: number | null = null
    if (c.date_of_birth) {
      const dob   = new Date(c.date_of_birth)
      const today = new Date()
      age         = today.getFullYear() - dob.getFullYear()
      const m     = today.getMonth() - dob.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
    }

    const m = metricMap[c.id]

    let trainingTypes: string[] | null = null
    if (m?.training_types) {
      try { trainingTypes = JSON.parse(m.training_types) } catch { /* ignore */ }
    }

    let cardioTypes: string[] | null = null
    if (m?.cardio_types) {
      try { cardioTypes = JSON.parse(m.cardio_types) } catch { /* ignore */ }
    }

    const occupationMultiplier = m?.occupation
      ? (OCCUPATION_MULTIPLIER_MAP[m.occupation] ?? null)
      : null

    return {
      id:    c.id,
      name:  [c.first_name, c.last_name].filter(Boolean).join(' '),
      email: c.email ?? null,
      // Profile
      gender:           c.gender ?? null,
      age,
      weekly_frequency: c.weekly_frequency ?? m?.training_frequency ?? null,
      fitness_level:    c.fitness_level    ?? null,
      training_goal:    c.training_goal    ?? null,
      sport_practice:   c.sport_practice   ?? null,
      equipment_category: c.equipment_category ?? null,
      // Biometrics — most recent bilan
      height_cm:          m?.height_cm          ?? null,
      weight_kg:          m?.weight_kg           ?? null,
      body_fat_pct:       m?.body_fat_pct        ?? null,
      muscle_mass_kg:     m?.muscle_mass_kg      ?? null,
      lean_mass_kg:       m?.lean_mass_kg        ?? null,
      bmr_kcal_measured:  m?.bmr_kcal_measured   ?? null,
      visceral_fat_level: m?.visceral_fat_level  ?? null,
      body_water_pct:     m?.body_water_pct      ?? null,
      waist_cm:           m?.waist_cm            ?? null,
      // Training — most recent bilan
      session_duration_min:    m?.session_duration_min    ?? null,
      training_calories_weekly: m?.training_calories      ?? null,
      perceived_intensity:     m?.perceived_intensity     ?? null,
      training_types:          trainingTypes,
      // Cardio — most recent bilan
      daily_steps:         m?.daily_steps        ?? null,
      cardio_frequency:    m?.cardio_frequency   ?? null,
      cardio_duration_min: m?.cardio_duration_min ?? null,
      cardio_types:        cardioTypes,
      // Wellness — avg last 3 bilans
      stress_level:          m ? avg(m.stress_level_samples)          : null,
      sleep_duration_h:      m ? avg(m.sleep_duration_h_samples)      : null,
      sleep_quality:         m ? avg(m.sleep_quality_samples)         : null,
      energy_level:          m ? avg(m.energy_level_samples)          : null,
      recovery_score:        m ? avg(m.recovery_score_samples)        : null,
      post_session_recovery: m ? avg(m.post_session_recovery_samples) : null,
      // Lifestyle — most recent
      caffeine_daily_mg:   m?.caffeine_daily_mg   ?? null,
      alcohol_weekly:      m?.alcohol_weekly      ?? null,
      work_hours_per_week: m?.work_hours_per_week ?? null,
      menstrual_cycle:     m?.menstrual_cycle     ?? null,
      // General
      occupation:           m?.occupation          ?? null,
      occupation_multiplier: occupationMultiplier,
    }
  })

  return NextResponse.json({ clients: enriched })
}
