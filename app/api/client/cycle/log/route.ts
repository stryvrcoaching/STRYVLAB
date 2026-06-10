import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getCycleStateFromLogs } from '@/lib/cycle/cycleEngine'
import type { CycleLog } from '@/lib/cycle/cycleEngine'

function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const bodySchema = z.object({
  type: z.enum(['start', 'end']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = svc()

  const { data: cc } = await db
    .from('coach_clients')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!cc) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = bodySchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error }, { status: 400 })

  const targetDate = body.data.date ?? new Date().toISOString().slice(0, 10)

  if (body.data.type === 'start') {
    // Guard: conflict check within 3 days
    const threeDaysBefore = new Date(targetDate)
    threeDaysBefore.setDate(threeDaysBefore.getDate() - 3)
    const threeDaysAfter = new Date(targetDate)
    threeDaysAfter.setDate(threeDaysAfter.getDate() + 3)

    const { data: existing } = await db
      .from('menstrual_cycle_logs')
      .select('period_start_date')
      .eq('client_id', cc.id)
      .gte('period_start_date', threeDaysBefore.toISOString().slice(0, 10))
      .lte('period_start_date', threeDaysAfter.toISOString().slice(0, 10))
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { conflict: true, existingDate: existing.period_start_date },
        { status: 409 },
      )
    }

    // Compute cycle length from previous log
    const { data: prevLog } = await db
      .from('menstrual_cycle_logs')
      .select('period_start_date')
      .eq('client_id', cc.id)
      .lt('period_start_date', targetDate)
      .order('period_start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    let computedLength: number | null = null
    if (prevLog) {
      const prev = new Date(prevLog.period_start_date)
      const curr = new Date(targetDate)
      const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
      if (diff >= 21 && diff <= 35) computedLength = diff
    }

    await db.from('menstrual_cycle_logs').insert({
      client_id: cc.id,
      period_start_date: targetDate,
      computed_cycle_length_days: computedLength,
    })
  }

  if (body.data.type === 'end') {
    const { data: log } = await db
      .from('menstrual_cycle_logs')
      .select('id, period_start_date')
      .eq('client_id', cc.id)
      .lte('period_start_date', targetDate)
      .order('period_start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!log) return NextResponse.json({ error: 'No period start found before end date' }, { status: 400 })

    const startDate = new Date(log.period_start_date)
    const endDate = new Date(targetDate)
    const diff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 1 || diff > 14) {
      return NextResponse.json({ error: 'End date must be 1–14 days after start' }, { status: 400 })
    }

    await db
      .from('menstrual_cycle_logs')
      .update({ period_end_date: targetDate })
      .eq('id', log.id)
  }

  // Return updated cycle state
  const { data: logs } = await db
    .from('menstrual_cycle_logs')
    .select('period_start_date, period_end_date, computed_cycle_length_days')
    .eq('client_id', cc.id)
    .order('period_start_date', { ascending: false })
    .limit(7)

  // Get most recent menstrual_cycle bilan answer
  const { data: submissions } = await db
    .from('assessment_submissions')
    .select('id')
    .eq('client_id', cc.id)
    .order('submitted_at', { ascending: false })
    .limit(3)

  const submissionIds = submissions?.map((s: { id: string }) => s.id) ?? []
  let bilanValue: string | null = null

  if (submissionIds.length > 0) {
    const { data: bilanRow } = await db
      .from('assessment_responses')
      .select('value_text')
      .eq('field_key', 'menstrual_cycle')
      .in('assessment_submission_id', submissionIds)
      .not('value_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    bilanValue = bilanRow?.value_text ?? null
  }

  const cycleState = getCycleStateFromLogs(
    (logs as CycleLog[]) ?? [],
    bilanValue,
  )

  return NextResponse.json({ cycleState }, { status: 200 })
}
