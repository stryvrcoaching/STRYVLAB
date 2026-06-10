import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { deriveMetrics, type BiometricInputs } from '@/lib/health/healthMath'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function ageAtMeasurement(bilanDate: string, dateOfBirth: string | null): number | undefined {
  if (!dateOfBirth) return undefined
  const bilan = new Date(bilanDate)
  const dob = new Date(dateOfBirth)
  let age = bilan.getFullYear() - dob.getFullYear()
  const m = bilan.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && bilan.getDate() < dob.getDate())) age--
  return age > 0 ? age : undefined
}

const fieldMap: Record<string, keyof BiometricInputs> = {
  weight_kg:          'weight_kg',
  height_cm:          'height_cm',
  body_fat_pct:       'body_fat_pct',
  fat_mass_kg:        'fat_mass_kg',
  muscle_mass_kg:     'muscle_mass_kg',
  muscle_mass_pct:    'muscle_mass_pct',
  skeletal_muscle_pct: 'skeletal_muscle_pct',
  visceral_fat_level: 'visceral_fat_level',
  body_water_pct:     'body_water_pct',
  bone_mass_kg:       'bone_mass_kg',
  waist_cm:           'waist_cm',
  neck_cm:            'neck_cm',
  hips_cm:            'hips_cm',
  metabolic_age:      'metabolic_age',
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { submissionId: string } }
) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = serviceClient()

  // 1. Load submission and verify ownership
  const { data: submission, error: subError } = await db
    .from('assessment_submissions')
    .select('id, coach_id, client_id, bilan_date')
    .eq('id', params.submissionId)
    .eq('coach_id', user.id)
    .single()

  if (subError || !submission) {
    return NextResponse.json({ error: 'Soumission introuvable' }, { status: 404 })
  }

  // 2. Load client profile
  const { data: client, error: clientError } = await db
    .from('coach_clients')
    .select('id, date_of_birth, sex')
    .eq('id', submission.client_id)
    .single()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Profil client introuvable' }, { status: 404 })
  }

  // 3. Load all responses for this submission
  const { data: responses, error: respError } = await db
    .from('assessment_responses')
    .select('block_id, field_key, value_number')
    .eq('submission_id', params.submissionId)

  if (respError) {
    console.error('POST /recalculate — load responses:', respError)
    return NextResponse.json({ error: 'Erreur chargement des réponses' }, { status: 500 })
  }

  // 4. Extract biometric values from responses
  const numericMap: Record<string, number> = {}
  let biometricsBlockId = 'biometrics'

  for (const row of responses ?? []) {
    if (row.field_key in fieldMap && row.value_number !== null && row.value_number !== undefined) {
      numericMap[row.field_key] = row.value_number
      // Use the block_id from the weight_kg field as the canonical biometrics block_id
      if (row.field_key === 'weight_kg') {
        biometricsBlockId = row.block_id
      }
    }
  }

  // 5. Validate required fields
  if (numericMap['weight_kg'] === undefined) {
    return NextResponse.json({ error: 'Poids manquant — recalcul impossible' }, { status: 400 })
  }
  if (numericMap['height_cm'] === undefined) {
    return NextResponse.json({ error: 'Taille manquante — recalcul impossible' }, { status: 400 })
  }

  // 6. Build BiometricInputs
  const sex = client.sex === 'male' || client.sex === 'female' ? client.sex : undefined
  const age = ageAtMeasurement(submission.bilan_date, client.date_of_birth ?? null)

  const inputs: BiometricInputs = {
    weight_kg:  numericMap['weight_kg'],
    height_cm:  numericMap['height_cm'],
    sex:        sex ?? 'male', // fallback required by type — actual null handled via optional fields
    ...(age !== undefined           && { age_at_measurement:  age }),
    ...(numericMap['body_fat_pct']       !== undefined && { body_fat_pct:       numericMap['body_fat_pct'] }),
    ...(numericMap['fat_mass_kg']        !== undefined && { fat_mass_kg:        numericMap['fat_mass_kg'] }),
    ...(numericMap['muscle_mass_kg']     !== undefined && { muscle_mass_kg:     numericMap['muscle_mass_kg'] }),
    ...(numericMap['muscle_mass_pct']    !== undefined && { muscle_mass_pct:    numericMap['muscle_mass_pct'] }),
    ...(numericMap['visceral_fat_level'] !== undefined && { visceral_fat_level: numericMap['visceral_fat_level'] }),
    ...(numericMap['body_water_pct']     !== undefined && { body_water_pct:     numericMap['body_water_pct'] }),
    ...(numericMap['bone_mass_kg']       !== undefined && { bone_mass_kg:       numericMap['bone_mass_kg'] }),
    ...(numericMap['waist_cm']           !== undefined && { waist_cm:           numericMap['waist_cm'] }),
    ...(numericMap['neck_cm']            !== undefined && { neck_cm:            numericMap['neck_cm'] }),
    ...(numericMap['hips_cm']            !== undefined && { hips_cm:            numericMap['hips_cm'] }),
    ...(numericMap['metabolic_age']      !== undefined && { metabolic_age:      numericMap['metabolic_age'] }),
    ...(numericMap['skeletal_muscle_pct'] !== undefined && { skeletal_muscle_pct: numericMap['skeletal_muscle_pct'] }),
  }

  // 7. Derive metrics
  const derived = deriveMetrics(inputs)

  // 8. Upsert derived fields into assessment_responses
  const derivedFields = [
    { field_key: 'bmi',                      value: derived.bmi },
    { field_key: 'fat_mass_kg',              value: derived.fat_mass_kg },
    { field_key: 'lean_mass_kg',             value: derived.lean_mass_kg },
    { field_key: 'body_fat_pct',             value: derived.body_fat_pct },
    { field_key: 'muscle_mass_pct',          value: derived.muscle_mass_pct },
    { field_key: 'muscle_mass_kg',           value: derived.muscle_mass_kg },
    { field_key: 'waist_height_ratio',       value: derived.waist_height_ratio },
    { field_key: 'metabolic_age_estimated',  value: derived.metabolic_age_estimated },
  ]

  const toUpsert = derivedFields
    .filter(({ field_key, value }) => {
      // bmi is always written; other fields only if derived is not null
      if (field_key === 'bmi') return true
      return value !== null
    })
    .map(({ field_key, value }) => ({
      submission_id: params.submissionId,
      block_id:      biometricsBlockId,
      field_key,
      value_number:  value as number,
    }))

  if (toUpsert.length > 0) {
    // Delete any stale derived rows across ALL block_ids before upserting.
    // This prevents phantom duplicates when a prior recalculate wrote to a
    // different block_id (e.g. csv_import_block vs the real biometrics block).
    const derivedFieldKeys = toUpsert.map((r) => r.field_key)
    const { error: deleteError } = await db
      .from('assessment_responses')
      .delete()
      .eq('submission_id', params.submissionId)
      .in('field_key', derivedFieldKeys)
      .neq('block_id', biometricsBlockId)

    if (deleteError) {
      console.error('POST /recalculate — delete stale derived:', deleteError)
      return NextResponse.json({ error: 'Erreur nettoyage des métriques dérivées' }, { status: 500 })
    }

    const { error: upsertError } = await db
      .from('assessment_responses')
      .upsert(toUpsert, { onConflict: 'submission_id,block_id,field_key' })

    if (upsertError) {
      console.error('POST /recalculate — upsert derived:', upsertError)
      return NextResponse.json({ error: 'Erreur lors de la sauvegarde des métriques' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, derived })
}
