import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientFromUser } from '@/lib/client/resolve-client'
import { detectDeloadSignals, type WeeklyData } from '@/lib/training/deloadDetection'
import { computeOneRMTrends, bestOneRM } from '@/lib/training/oneRepMax'

/**
 * GET /api/client/deload-status
 *
 * Analyzes last 4 weeks of training data to detect deload signals.
 * Returns array of DeloadSignal objects.
 *
 * Auth: Client authenticated via Supabase auth.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const client = await resolveClientFromUser(user.id, user.email, service, 'id')
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Fetch last 4 weeks of session logs with their sets
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

    const { data: sessionLogs, error: sessionError } = await service
      .from('client_session_logs')
      .select(
        `
        id,
        completed_at,
        client_set_logs (
          actual_reps,
          actual_weight_kg,
          rir_actual
        )
      `
      )
      .eq('client_id', client.id)
      .gte('completed_at', fourWeeksAgo.toISOString())
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })

    if (sessionError) {
      console.error('Session fetch error:', sessionError)
      return NextResponse.json(
        { error: 'Failed to fetch session logs' },
        { status: 500 }
      )
    }

    // Aggregate data by week
    const now = new Date()
    const weeks: WeeklyData[] = []

    for (let w = 1; w <= 4; w++) {
      const weekStart = new Date(now.getTime() - w * 7 * 24 * 3600 * 1000)
      const weekEnd = new Date(now.getTime() - (w - 1) * 7 * 24 * 3600 * 1000)

      const sessionsInWeek = (sessionLogs ?? []).filter(log => {
        const d = new Date(log.completed_at!)
        return d >= weekStart && d < weekEnd
      })

      if (sessionsInWeek.length === 0) {
        weeks.push({
          week: w,
          avgRir: null,
          completionRate: 0,
          totalVolume: 0,
          oneRMEstimate: null,
        })
        continue
      }

      // Aggregate RIR
      const rirs: number[] = []
      let totalSets = 0
      let totalVolume = 0

      for (const session of sessionsInWeek) {
        const sets = (session.client_set_logs as any) ?? []
        totalSets += sets.length

        for (const set of sets) {
          if (set.rir_actual != null) {
            rirs.push(set.rir_actual)
          }
          // Volume = reps × weight
          const reps = set.actual_reps ?? 0
          const weight = Number(set.actual_weight_kg ?? 0)
          totalVolume += reps * weight
        }
      }

      const avgRir = rirs.length > 0 ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null

      // Compute best 1RM for the week (simplified: just take max weight × reps)
      let best1RM: number | null = null
      const allSetsInWeek: Array<{ actual_weight_kg: number; actual_reps: number; rir_actual: number | null }> = []
      for (const session of sessionsInWeek) {
        const sets = (session.client_set_logs as any) ?? []
        allSetsInWeek.push(...sets)
      }

      if (allSetsInWeek.length > 0) {
        best1RM =
          bestOneRM(
            allSetsInWeek.map(s => ({
              weight: Number(s.actual_weight_kg ?? 0),
              reps: Number(s.actual_reps ?? 0),
              rir: Number(s.rir_actual ?? 2),
            }))
          ) || null
      }

      weeks.push({
        week: w,
        avgRir,
        completionRate: 0.8, // placeholder; proper implementation needs prescribed sets
        totalVolume,
        oneRMEstimate: best1RM,
      })
    }

    // Detect deload signals
    const signals = detectDeloadSignals(weeks)

    return NextResponse.json(
      {
        signals,
        weeklyData: weeks,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('API error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
