import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getCycleStateFromLogs } from '@/lib/cycle/cycleEngine'
import type { CycleLog } from '@/lib/cycle/cycleEngine'
import { buildCyclePhaseObservations } from '@/lib/cycle/cycle-phase-observations'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = serviceClient()
  const { clientId } = params

  // Verify coach owns this client
  const { data: client } = await db
    .from('coach_clients')
    .select('id, gender')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()
  if (!client) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (client.gender !== 'female') {
    return NextResponse.json({ cycleState: null }, { status: 200 })
  }

  const { data: logs } = await db
    .from('menstrual_cycle_logs')
    .select('period_start_date, period_end_date, computed_cycle_length_days')
    .eq('client_id', clientId)
    .order('period_start_date', { ascending: false })
    .limit(7)

  const { data: submissions } = await db
    .from('assessment_submissions')
    .select('id')
    .eq('client_id', clientId)
    .order('submitted_at', { ascending: false })
    .limit(3)

  const submissionIds = submissions?.map((s: { id: string }) => s.id) ?? []
  let bilanValue: string | null = null

  if (submissionIds.length > 0) {
    const { data: bilanRow } = await db
      .from('assessment_responses')
      .select('value_text')
      .eq('field_key', 'menstrual_cycle')
      .in('submission_id', submissionIds)
      .not('value_text', 'is', null)
      .limit(1)
      .maybeSingle()
    bilanValue = bilanRow?.value_text ?? null
  }

  const cycleState = getCycleStateFromLogs(
    (logs as CycleLog[]) ?? [],
    bilanValue,
  )

  const { data: checkins } = await db
    .from('client_daily_checkins')
    .select('cycle_phase, energy_level, hunger_level, stress_level')
    .eq('client_id', clientId)
    .not('cycle_phase', 'is', null)
    .order('date', { ascending: false })
    .limit(180)

  return NextResponse.json({
    cycleState,
    phaseObservations: buildCyclePhaseObservations(checkins ?? []),
  }, { status: 200 })
}
