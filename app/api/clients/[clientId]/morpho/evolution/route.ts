// GET /api/clients/[clientId]/morpho/evolution
// Returns the latest EvolutionReport for a client (between last 2 v2 analyses)

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computeEvolutionReport } from '@/lib/morpho/evolution'
import { isMorphoV2 } from '@/lib/morpho/types'
import type { MorphoAnalysisResultV2 } from '@/lib/morpho/types'

type Params = { params: { clientId: string } }

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = service()

  const { data: coachAccess } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!coachAccess) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Fetch last 2 v2 analyses first — cache must match the actual current pair
  const { data: analyses } = await db
    .from('morpho_analyses')
    .select('id, analysis_result, analysis_date, prompt_version')
    .eq('client_id', params.clientId)
    .eq('status', 'completed')
    .in('prompt_version', ['v2', 'v3'])
    .order('analysis_date', { ascending: false })
    .limit(2)

  if (!analyses || analyses.length < 2) {
    return NextResponse.json(
      { error: 'Minimum 2 analyses v2 requises pour générer un rapport d\'évolution' },
      { status: 404 }
    )
  }

  const [currentRow, previousRow] = analyses as Array<{ id: string; analysis_result: unknown; analysis_date: string }>

  // Check cache only if it matches the current analysis pair
  const { data: cached } = await db
    .from('morpho_evolutions')
    .select('report')
    .eq('client_id', params.clientId)
    .eq('current_analysis_id', currentRow.id)
    .eq('previous_analysis_id', previousRow.id)
    .single()

  if (cached) {
    return NextResponse.json({ report: cached.report, cached: true })
  }

  if (!isMorphoV2(currentRow.analysis_result) ||
      !isMorphoV2(previousRow.analysis_result)) {
    return NextResponse.json({ error: 'Analyses non compatibles v2' }, { status: 422 })
  }

  const report = computeEvolutionReport(
    params.clientId,
    previousRow.id,
    currentRow.id,
    previousRow.analysis_result as MorphoAnalysisResultV2,
    currentRow.analysis_result as MorphoAnalysisResultV2
  )

  // Persist
  await db.from('morpho_evolutions').upsert(
    {
      client_id: params.clientId,
      previous_analysis_id: previousRow.id,
      current_analysis_id: currentRow.id,
      report,
    },
    { onConflict: 'previous_analysis_id,current_analysis_id' }
  )

  return NextResponse.json({ report, cached: false })
}
