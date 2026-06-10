import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { computePhysiologicalDate } from '@/lib/nutrition/physiological-date'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import type { CheckinData } from '@/lib/client/smart/recoveryAlerts'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      )
    }

    const client = await resolveClientFromUser(
      user.id,
      user.email,
      svc(),
      'id',
    )

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 },
      )
    }

    const clientId = client.id
    const today = computePhysiologicalDate(new Date())

    // Fetch today's morning check-in
    const { data: checkinData, error: checkinError } = await svc()
      .from('client_checkins')
      .select('responses')
      .eq('client_id', clientId)
      .eq('moment', 'morning')
      .eq('date', today)
      .maybeSingle()

    if (checkinError && checkinError.code !== 'PGRST116') {
      console.error('Error fetching morning checkin:', checkinError)
      return NextResponse.json(
        { error: 'Failed to fetch checkin data' },
        { status: 500 },
      )
    }

    const morningCheckin: CheckinData | null = checkinData?.responses ?? null

    // Fetch last completed session
    const { data: lastSession, error: lastSessionError } = await svc()
      .from('client_session_logs')
      .select('id')
      .eq('client_id', clientId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastSessionError && lastSessionError.code !== 'PGRST116') {
      console.error('Error fetching last session:', lastSessionError)
    }

    let lastSessionAvgRir: number | null = null
    if (lastSession?.id) {
      const { data: lastSessionSets, error: setsError } = await svc()
        .from('client_set_logs')
        .select('rir_actual')
        .eq('session_log_id', lastSession.id)
        .not('rir_actual', 'is', null)
        .eq('completed', true)

      if (setsError && setsError.code !== 'PGRST116') {
        console.error('Error fetching session sets:', setsError)
      }

      if (lastSessionSets && lastSessionSets.length > 0) {
        const rirs = (lastSessionSets as any[])
          .map((s) => s.rir_actual)
          .filter((r): r is number => r !== null && typeof r === 'number')
        if (rirs.length > 0) {
          lastSessionAvgRir =
            rirs.reduce((a, b) => a + b, 0) / rirs.length
        }
      }
    }

    return NextResponse.json({
      morningCheckin,
      lastSessionAvgRir,
    })
  } catch (err) {
    console.error('Unexpected error in recovery-status:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
