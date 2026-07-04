import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { calcAdaptiveTdee } from '@/lib/nutrition/adaptiveTdee'
import { collectWeightSamples, collectAvgIntake, collectClientSignals } from '@/lib/nutrition/weightSamples'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function upsertSameDayTdeeHistory(db: ReturnType<typeof svc>, payload: Record<string, unknown>) {
  const calculatedAt = String(payload.calculated_at)
  const dayStart = `${calculatedAt.slice(0, 10)}T00:00:00.000Z`
  const dayEnd = `${calculatedAt.slice(0, 10)}T23:59:59.999Z`

  const { data: existing } = await db
    .from('nutrition_tdee_history')
    .select('id')
    .eq('protocol_id', payload.protocol_id)
    .eq('client_id', payload.client_id)
    .eq('protocol_updated', false)
    .gte('calculated_at', dayStart)
    .lte('calculated_at', dayEnd)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if ((existing as any)?.id) {
    await db.from('nutrition_tdee_history').update(payload).eq('id', (existing as any).id)
    return
  }

  await db.from('nutrition_tdee_history').insert(payload)
}

/**
 * POST — Calculate adaptive TDEE only. Does NOT modify the protocol.
 * Returns the new TDEE + a preview of what each protocol day would become.
 * Coach must explicitly call POST /apply to confirm the rescaling.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { clientId: string; protocolId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()
  const { clientId, protocolId } = params

  const { data: protocol } = await db
    .from('nutrition_protocols')
    .select('id, coach_id, name, tdee_reference, deficit_surplus_pct, nutrition_protocol_days(id, name, calories, protein_g, fat_g, carbs_g, position)')
    .eq('id', protocolId)
    .eq('client_id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!protocol) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const days: any[] = (protocol as any).nutrition_protocol_days ?? []
  const protocolName: string = (protocol as any).name ?? ''

  const day1Cal = [...days].sort((a, b) => a.position - b.position)[0]?.calories ?? 2000
  const tdeeReference: number = (protocol as any).tdee_reference ?? day1Cal

  // Collect weight samples anchored to protocol start date when possible
  const { samples: weightSamples, windowDays, anchoredToProtocol, tooShort } =
    await collectWeightSamples(db, clientId, 14, 4, protocolName, protocolId)

  if (tooShort) {
    return NextResponse.json({
      error: 'Fenêtre trop courte depuis le début du protocole',
      detail: `Seulement ${windowDays} jour(s) de données depuis le début de "${protocolName}". Minimum ${7} jours requis pour un calcul fiable.`,
      windowDays,
      anchoredToProtocol,
    }, { status: 422 })
  }

  if (weightSamples.length < 2) {
    return NextResponse.json({
      error: 'Not enough weight data',
      detail: `${weightSamples.length} mesure(s) trouvée(s) sur ${windowDays} jours. Minimum 2 pesées requises.`,
      weightSamples: weightSamples.length,
      windowDays,
    }, { status: 422 })
  }

  // Compute cutoff date for signals (protocol anchor or window-based)
  const cutoffDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() - windowDays)
    return d.toISOString().slice(0, 10)
  })()

  const [{ avgIntakeKcal, caloriesSource, trackedDays, excludedCurrentDay }, { gender, cyclePhases, cycleConfidence }] =
    await Promise.all([
      collectAvgIntake(db, clientId, windowDays, tdeeReference),
      collectClientSignals(db, clientId, cutoffDate),
    ])

  const result = calcAdaptiveTdee({
    weightSamples,
    avgIntakeKcal,
    caloriesSource,
    windowDays,
    trackedDays,
    excludedCurrentDay,
    gender: gender as any,
    cyclePhases,
    cycleConfidence,
    anchoredToProtocol,
  })

  if (result.confidence === 'low') {
    return NextResponse.json({
      error: 'Adaptive TDEE confidence too low',
      confidence: result.confidence,
      confidenceScore: result.confidenceScore,
      confidenceReasons: result.confidenceReasons,
      weightSamples: weightSamples.length,
      windowDays,
    }, { status: 422 })
  }

  const calculatedAt = new Date().toISOString()

  // Persist the new TDEE value on the protocol — but do NOT rescale days yet.
  await db.from('nutrition_protocols').update({
    tdee_adaptive:    result.tdeeAdaptive,
    tdee_adaptive_at: calculatedAt,
    tdee_data_source: caloriesSource === 'protocol' ? 'formula_proxy' : 'weight_delta',
  }).eq('id', protocolId)

  // Record in history (protocol_updated = false — coach hasn't confirmed yet)
  const deltaKcal = result.tdeeAdaptive - tdeeReference
  await upsertSameDayTdeeHistory(db, {
    protocol_id:        protocolId,
    client_id:          clientId,
    tdee_formula:       tdeeReference,
    tdee_adaptive:      result.tdeeAdaptive,
    delta_kcal:         deltaKcal,
    weight_samples:     weightSamples.length,
    calories_source:    caloriesSource,
    avg_intake_kcal:    avgIntakeKcal,
    weight_delta_kg:    result.weightDeltaKg,
    protocol_updated:   false,
    confidence:         result.confidence,
    confidence_score:   result.confidenceScore,
    confidence_reasons: result.confidenceReasons,
    calculated_at:      calculatedAt,
  })

  // Build preview: what each day would become after rescaling
  const ratio = result.tdeeAdaptive / tdeeReference
  const preview = [...days]
    .sort((a, b) => a.position - b.position)
    .map(day => ({
      id:            day.id,
      name:          day.name,
      position:      day.position,
      current: {
        calories:  day.calories,
        protein_g: day.protein_g,
        carbs_g:   day.carbs_g,
        fat_g:     day.fat_g,
      },
      proposed: {
        calories:  day.calories  != null ? Math.round(day.calories  * ratio) : null,
        protein_g: day.protein_g != null ? Math.round(day.protein_g * ratio) : null,
        carbs_g:   day.carbs_g   != null ? Math.round(day.carbs_g   * ratio) : null,
        fat_g:     day.fat_g     != null ? Math.round(day.fat_g     * ratio) : null,
      },
    }))

  return NextResponse.json({
    tdeeAdaptive:      result.tdeeAdaptive,
    tdeeReference,
    deltaKcal,
    ratio,
    confidence:        result.confidence,
    confidenceScore:   result.confidenceScore,
    confidenceReasons: result.confidenceReasons,
    weightSamples:     weightSamples.length,
    windowDays,
    caloriesSource,
    trackedDays,
    preview,
    tdeeAdaptiveAt: calculatedAt,
    // Coach must call POST /apply to confirm
    requiresConfirmation: true,
  })
}

/**
 * PUT — Apply the pre-calculated adaptive TDEE to the protocol days.
 * Must be called explicitly by the coach after reviewing the preview.
 */
export async function PUT(
  _req: NextRequest,
  { params }: { params: { clientId: string; protocolId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()
  const { clientId, protocolId } = params

  const { data: protocol } = await db
    .from('nutrition_protocols')
    .select('id, coach_id, tdee_adaptive, tdee_reference, deficit_surplus_pct, nutrition_protocol_days(id, calories, protein_g, fat_g, carbs_g, position)')
    .eq('id', protocolId)
    .eq('client_id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!protocol) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const tdeeAdaptive: number | null = (protocol as any).tdee_adaptive
  if (!tdeeAdaptive) return NextResponse.json({ error: 'No adaptive TDEE calculated yet. Call POST first.' }, { status: 422 })

  const days: any[] = (protocol as any).nutrition_protocol_days ?? []
  const day1Cal = [...days].sort((a, b) => a.position - b.position)[0]?.calories ?? 2000
  const tdeeReference: number = (protocol as any).tdee_reference ?? day1Cal
  const ratio = tdeeAdaptive / tdeeReference

  // Rescale all protocol days
  for (const day of days) {
    await db.from('nutrition_protocol_days').update({
      calories:  day.calories  != null ? Math.round(day.calories  * ratio) : null,
      protein_g: day.protein_g != null ? Math.round(day.protein_g * ratio) : null,
      fat_g:     day.fat_g     != null ? Math.round(day.fat_g     * ratio) : null,
      carbs_g:   day.carbs_g   != null ? Math.round(day.carbs_g   * ratio) : null,
    }).eq('id', day.id)
  }

  // Update tdee_reference to the new adaptive value so next rescaling is relative to this
  await db.from('nutrition_protocols').update({
    tdee_reference: tdeeAdaptive,
  }).eq('id', protocolId)

  // Mark last history entry as protocol_updated = true
  await db.from('nutrition_tdee_history')
    .update({ protocol_updated: true })
    .eq('protocol_id', protocolId)
    .eq('protocol_updated', false)
    .order('calculated_at', { ascending: false })
    .limit(1)

  return NextResponse.json({ applied: true, tdeeAdaptive, ratio, tdeeReference })
}
