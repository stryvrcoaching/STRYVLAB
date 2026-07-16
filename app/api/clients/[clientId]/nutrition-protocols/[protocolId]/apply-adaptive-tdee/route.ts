import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { collectDailyTdeeIntakes, collectWeightSamples, resolveProtocolStartDate } from '@/lib/nutrition/weightSamples'
import {
  markClientTdeeAttempt,
  markClientTdeeError,
  markClientTdeeSkip,
  recordClientTdeeObservation,
  fetchClientTdeeState,
} from '@/lib/nutrition/tdee-state'
import { estimateClientTdeeV2 } from '@/lib/nutrition/tdee-model-v2'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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
  const db = svc()
  const { clientId, protocolId } = params
  const attemptAt = new Date().toISOString()

  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: protocol } = await db
      .from('nutrition_protocols')
      .select('id, coach_id, name, tdee_reference, deficit_surplus_pct, nutrition_protocol_days(id, name, calories, protein_g, fat_g, carbs_g, position)')
      .eq('id', protocolId)
      .eq('client_id', clientId)
      .eq('coach_id', user.id)
      .single()

    if (!protocol) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const days: any[] = (protocol as any).nutrition_protocol_days ?? []
    const day1Cal = [...days].sort((a, b) => a.position - b.position)[0]?.calories ?? 2000
    const tdeeReference: number = (protocol as any).tdee_reference ?? day1Cal
    await markClientTdeeAttempt(db, clientId, attemptAt)

    const { samples: weightSamples, windowDays, anchoredToProtocol } =
      await collectWeightSamples(db, clientId, 14, 4)

    if (weightSamples.length < 2) {
      await markClientTdeeSkip(db, {
        clientId,
        at: attemptAt,
        reason: 'insufficient_weight_samples',
        windowDays,
        weightSamples: weightSamples.length,
        anchoredToProtocol,
      })
      return NextResponse.json({
        error: 'Not enough weight data',
        detail: `${weightSamples.length} mesure(s) trouvée(s) sur ${windowDays} jours. Minimum 2 pesées requises.`,
        weightSamples: weightSamples.length,
        windowDays,
      }, { status: 422 })
    }

    const [{ entries: dailyIntakes, trackedDays, completeDays }, contextStartDate] = await Promise.all([
      collectDailyTdeeIntakes(db, clientId, windowDays),
      resolveProtocolStartDate(db, clientId, String((protocol as any).name ?? ''), protocolId),
    ])
    const contextChanged = contextStartDate != null &&
      Math.floor((Date.now() - new Date(`${contextStartDate}T00:00:00.000Z`).getTime()) / 86_400_000) < 7
    const result = estimateClientTdeeV2({
      weightSamples,
      dailyIntakes,
      fallbackIntakeKcal: tdeeReference,
      windowDays,
      contextChanged,
    })
    const caloriesSource = result.completeDays > 0 ? 'logs' : 'protocol'
    const confidence = result.confidenceScore >= 80 ? 'high' : result.confidenceScore >= 55 ? 'medium' : 'low'

    const calculatedAt = new Date().toISOString()
    const deltaKcal = result.estimate - tdeeReference
    const recorded = await recordClientTdeeObservation(db, {
      protocolId,
      clientId,
      calculatedAt,
      tdeeFormula: tdeeReference,
      tdeeAdaptive: result.estimate,
      deltaKcal,
      weightSamples: result.weightSamplesUsed,
      caloriesSource,
      avgIntakeKcal: result.avgIntakeKcal,
      weightDeltaKg: result.weightDeltaKg,
      protocolUpdated: false,
      confidence,
      confidenceScore: result.confidenceScore,
      confidenceReasons: result.reasons,
      windowDays,
      trackedDays,
      excludedCurrentDay: true,
      anchoredToProtocol,
      smoothedWeightUsed: false,
      appliedLutealCorrection: false,
      estimationStatus: result.status,
      dataQualityScore: result.confidenceScore,
      dataQualityReasons: result.reasons,
      tdeeLower: result.lower,
      tdeeUpper: result.upper,
      completeDays: result.completeDays,
      contextChanged,
    })

    if (result.status === 'actionable' && recorded.state.current_tdee != null) {
      await db.from('nutrition_protocols').update({
        tdee_adaptive: recorded.state.current_tdee,
        tdee_adaptive_at: recorded.state.current_tdee_at,
        tdee_data_source: recorded.state.source,
      }).eq('id', protocolId)
    }

    const effectiveTdee = recorded.state.current_tdee ?? result.estimate
    const ratio = effectiveTdee / tdeeReference
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
      tdeeAdaptive:      recorded.state.current_tdee,
      tdeeReference,
      deltaKcal,
      ratio,
      confidence,
      confidenceScore:   result.confidenceScore,
      confidenceReasons: result.reasons,
      weightSamples:     result.weightSamplesUsed,
      windowDays,
      caloriesSource,
      trackedDays,
      completeDays,
      preview,
      tdeeAdaptiveAt: recorded.state.current_tdee_at,
      tdeeObserved: result.estimate,
      tdeeActionableStreak: recorded.state.actionable_streak,
      tdeeStabilityStatus: recorded.state.stability_status,
      tdeeEstimationStatus: result.status,
      tdeeDataQualityScore: result.confidenceScore,
      tdeeDataQualityReasons: result.reasons,
      tdeeLower: result.lower,
      tdeeUpper: result.upper,
      requiresConfirmation:
        result.status === 'actionable' &&
        ['initialized', 'promoted'].includes(recorded.transition.updateOutcome),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Adaptive TDEE failed'
    await markClientTdeeError(db, clientId, message, attemptAt)
    return NextResponse.json({ error: message }, { status: 500 })
  }
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

  const clientTdeeState = await fetchClientTdeeState(db as any, clientId)
  const hasPromotedLatestEstimate =
    clientTdeeState?.estimation_status === 'actionable' &&
    clientTdeeState.current_tdee != null &&
    clientTdeeState.stability_status !== 'watch'
  if (!hasPromotedLatestEstimate) {
    return NextResponse.json({
      error: 'La dernière estimation TDEE est encore en observation et ne peut pas être appliquée.',
    }, { status: 422 })
  }

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
    tdee_snapshot_source: 'client_state',
    tdee_snapshot_used_at: new Date().toISOString(),
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
