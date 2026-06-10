// GET /api/clients/[clientId]/morpho/evolution-timeline
// Time-series data for morpho metrics across all v2 analyses — UI data contract

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { isMorphoV2 } from '@/lib/morpho/types'
import type { MorphoAnalysisResultV2, Confidence } from '@/lib/morpho/types'

type Params = { params: { clientId: string } }

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function syndromeOrdinal(analysis: MorphoAnalysisResultV2, name: string): number {
  const s = analysis.biomech.postural_syndromes.find(p => p.name === name)
  if (!s?.present) return 0
  if (s.severity === 'marked') return 3
  if (s.severity === 'moderate') return 2
  if (s.severity === 'mild') return 1
  return 0
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

  const { data: analyses } = await db
    .from('morpho_analyses')
    .select('id, analysis_result, analysis_date, prompt_version')
    .eq('client_id', params.clientId)
    .eq('status', 'completed')
    .eq('prompt_version', 'v2')
    .order('analysis_date', { ascending: true })

  if (!analyses || analyses.length === 0) {
    return NextResponse.json({ series: {}, events: [], last_evolution_report: null })
  }

  const rows = (analyses as Array<{ id: string; analysis_result: unknown; analysis_date: string }>)
    .filter(r => isMorphoV2(r.analysis_result))

  type SeriesPoint<T> = { analyzed_at: string; value: T }
  type ConfidencePoint<T> = SeriesPoint<T> & { confidence: Confidence }

  const series: {
    score: SeriesPoint<number>[]
    shoulder_imbalance_cm: ConfidencePoint<number | null>[]
    hip_imbalance_cm: ConfidencePoint<number | null>[]
    arm_diff_cm: ConfidencePoint<number | null>[]
    leg_length_diff_cm: ConfidencePoint<number | null>[]
    upper_crossed_severity: SeriesPoint<0 | 1 | 2 | 3>[]
    lower_crossed_severity: SeriesPoint<0 | 1 | 2 | 3>[]
    trunk_to_femur_ratio: ConfidencePoint<number | null>[]
    arm_to_torso_ratio: ConfidencePoint<number | null>[]
  } = {
    score: [],
    shoulder_imbalance_cm: [],
    hip_imbalance_cm: [],
    arm_diff_cm: [],
    leg_length_diff_cm: [],
    upper_crossed_severity: [],
    lower_crossed_severity: [],
    trunk_to_femur_ratio: [],
    arm_to_torso_ratio: [],
  }

  type TimelineEvent = {
    analyzed_at: string
    type: 'analysis' | 'flag_resolved' | 'flag_appeared' | 'pattern_changed'
    label: string
  }

  const events: TimelineEvent[] = []
  let prevAnalysis: MorphoAnalysisResultV2 | null = null

  for (const row of rows) {
    const a = row.analysis_result as MorphoAnalysisResultV2
    const at = a.meta.analyzed_at ?? row.analysis_date
    const conf = a.meta.overall_confidence

    series.score.push({ analyzed_at: at, value: a.score })
    series.shoulder_imbalance_cm.push({ analyzed_at: at, value: a.asymmetries.shoulder_imbalance_cm, confidence: conf })
    series.hip_imbalance_cm.push({ analyzed_at: at, value: a.asymmetries.hip_imbalance_cm, confidence: conf })
    series.arm_diff_cm.push({ analyzed_at: at, value: a.asymmetries.arm_diff_cm, confidence: conf })
    series.leg_length_diff_cm.push({ analyzed_at: at, value: a.asymmetries.leg_length_diff_cm, confidence: conf })
    series.upper_crossed_severity.push({ analyzed_at: at, value: syndromeOrdinal(a, 'upper_crossed') as 0|1|2|3 })
    series.lower_crossed_severity.push({ analyzed_at: at, value: syndromeOrdinal(a, 'lower_crossed') as 0|1|2|3 })
    series.trunk_to_femur_ratio.push({ analyzed_at: at, value: a.biomech.segments.trunk_to_femur_ratio, confidence: conf })
    series.arm_to_torso_ratio.push({ analyzed_at: at, value: a.biomech.segments.arm_to_torso_ratio, confidence: conf })

    events.push({ analyzed_at: at, type: 'analysis', label: `Analyse #${row.id.slice(0, 8)}` })

    if (prevAnalysis) {
      // Flag changes
      const prevLabels = new Set(prevAnalysis.flags.map(f => `${f.zone}:${f.label}`))
      const currLabels = new Set(a.flags.map(f => `${f.zone}:${f.label}`))
      Array.from(prevLabels).forEach(l => {
        if (!currLabels.has(l)) {
          events.push({ analyzed_at: at, type: 'flag_resolved', label: `Résolu: ${l.split(':')[1]}` })
        }
      })
      Array.from(currLabels).forEach(l => {
        if (!prevLabels.has(l)) {
          events.push({ analyzed_at: at, type: 'flag_appeared', label: `Nouveau: ${l.split(':')[1]}` })
        }
      })
      // Pattern verdict changes
      for (const currV of a.biomech.pattern_verdicts) {
        const prevV = prevAnalysis.biomech.pattern_verdicts.find(pv => pv.pattern === currV.pattern)
        if (prevV && prevV.verdict !== currV.verdict) {
          events.push({
            analyzed_at: at,
            type: 'pattern_changed',
            label: `${currV.pattern}: ${prevV.verdict} → ${currV.verdict}`,
          })
        }
      }
    }

    prevAnalysis = a
  }

  // Fetch latest cached evolution report
  const { data: latestEvolution } = await db
    .from('morpho_evolutions')
    .select('report')
    .eq('client_id', params.clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    client_id: params.clientId,
    series,
    events,
    last_evolution_report: latestEvolution?.report ?? null,
  })
}
