// GET /api/clients/[clientId]/morpho/exercise-map
// Returns exercise stratification from latest v2 morpho analysis × Gold Standard DB

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { generateExerciseRecommendations } from '@/lib/morpho/biomechEngine'
import { isMorphoV2 } from '@/lib/morpho/types'
import type { MorphoAnalysisResultV2 } from '@/lib/morpho/types'
import goldStandardDb from '@/docs/morphopro_gold_standard_v2_complete.json'

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

  // Coach ownership check
  const { data: coachAccess } = await db
    .from('coach_clients')
    .select('id')
    .eq('id', params.clientId)
    .eq('coach_id', user.id)
    .single()

  if (!coachAccess) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Fetch latest completed v2 analysis
  const { data: latest } = await db
    .from('morpho_analyses')
    .select('id, analysis_result, prompt_version, analysis_date, exercise_recommendations')
    .eq('client_id', params.clientId)
    .eq('status', 'completed')
    .in('prompt_version', ['v2', 'v3'])
    .order('analysis_date', { ascending: false })
    .limit(1)
    .single()

  if (!latest) {
    return NextResponse.json(
      { error: 'Aucune analyse v2 disponible pour ce client' },
      { status: 404 }
    )
  }

  const row = latest as { id: string; analysis_result: unknown; analysis_date: string; exercise_recommendations: unknown }

  // Return cached recommendations if already computed
  if (row.exercise_recommendations) {
    return NextResponse.json({
      analysis_id: row.id,
      analysis_date: row.analysis_date,
      recommendations: row.exercise_recommendations,
      cached: true,
    })
  }

  const result = row.analysis_result
  if (!isMorphoV2(result)) {
    return NextResponse.json(
      { error: 'Analyse non compatible v2' },
      { status: 422 }
    )
  }

  const analysis = result as MorphoAnalysisResultV2
  const recommendations = generateExerciseRecommendations(analysis, goldStandardDb as unknown as Parameters<typeof generateExerciseRecommendations>[1])

  // Persist computed recommendations
  await db
    .from('morpho_analyses')
    .update({ exercise_recommendations: recommendations })
    .eq('id', row.id)

  return NextResponse.json({
    analysis_id: row.id,
    analysis_date: row.analysis_date,
    recommendations,
    cached: false,
  })
}
