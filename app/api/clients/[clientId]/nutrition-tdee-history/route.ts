import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { fetchClientTdeeState, hasCurrentTdeeSkip } from '@/lib/nutrition/tdee-state'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()

  const { data: client } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const requestedProtocolId = searchParams.get('protocolId')
  const clientTdeeState = await fetchClientTdeeState(db as any, params.clientId)

  let query = db
    .from('nutrition_tdee_history')
    .select('*')
    .eq('client_id', params.clientId)
    .order('calculated_at', { ascending: false })
    .limit(30)

  if (requestedProtocolId) {
    query = query.eq('protocol_id', requestedProtocolId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const deduped = new Map<string, any>()
  for (const entry of data ?? []) {
    const key = `${entry.protocol_id}:${String(entry.calculated_at).slice(0, 10)}`
    if (!deduped.has(key)) {
      deduped.set(key, entry)
    }
  }

  return NextResponse.json({
    history: Array.from(deduped.values()).slice(0, 5),
    clientTdee: clientTdeeState?.current_tdee ?? null,
    clientTdeeAt: clientTdeeState?.current_tdee_at ?? null,
    clientTdeeLower: clientTdeeState?.current_tdee_lower ?? null,
    clientTdeeUpper: clientTdeeState?.current_tdee_upper ?? null,
    observedTdee: clientTdeeState?.latest_observed_tdee ?? null,
    observedTdeeLower: clientTdeeState?.latest_observed_lower ?? null,
    observedTdeeUpper: clientTdeeState?.latest_observed_upper ?? null,
    actionableStreak: clientTdeeState?.actionable_streak ?? 0,
    stabilityStatus: clientTdeeState?.stability_status ?? null,
    estimationStatus: clientTdeeState?.estimation_status ?? 'collecting',
    dataQualityScore: clientTdeeState?.data_quality_score ?? null,
    dataQualityReasons: clientTdeeState?.data_quality_reasons ?? [],
    lastSkipReason: hasCurrentTdeeSkip(clientTdeeState)
      ? clientTdeeState?.last_skip_reason ?? null
      : null,
  })
}
