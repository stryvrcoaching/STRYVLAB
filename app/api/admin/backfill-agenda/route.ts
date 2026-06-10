import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST /api/admin/backfill-agenda
// Backfills smart_agenda_events for sessions + assessments completed before Smart Agenda launch
// Protected by CRON_SECRET
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = service()

  // 1. Backfill completed sessions
  const { data: sessions } = await db
    .from('client_session_logs')
    .select('id, client_id, session_name, completed_at')
    .not('completed_at', 'is', null)

  let sessionCount = 0
  for (const s of sessions ?? []) {
    const eventDate = s.completed_at.split('T')[0]
    const eventTime = s.completed_at.split('T')[1]?.slice(0, 5) ?? null

    // Skip if already exists
    const { data: existing } = await db
      .from('smart_agenda_events')
      .select('id')
      .eq('source_id', s.id)
      .eq('event_type', 'session')
      .maybeSingle()

    if (existing) continue

    await db.from('smart_agenda_events').insert({
      client_id: s.client_id,
      event_type: 'session',
      event_date: eventDate,
      event_time: eventTime,
      source_id: s.id,
      title: s.session_name ?? 'Séance réalisée',
      summary: null,
      data: null,
    })
    sessionCount++
  }

  // 2. Backfill completed assessments
  const { data: assessments } = await db
    .from('assessment_submissions')
    .select('id, client_id, bilan_date, submitted_at')
    .eq('status', 'completed')
    .not('submitted_at', 'is', null)

  let assessmentCount = 0
  for (const a of assessments ?? []) {
    const eventDate = a.bilan_date ?? a.submitted_at?.split('T')[0]
    if (!eventDate) continue

    const { data: existing } = await db
      .from('smart_agenda_events')
      .select('id')
      .eq('source_id', a.id)
      .eq('event_type', 'assessment')
      .maybeSingle()

    if (existing) continue

    await db.from('smart_agenda_events').insert({
      client_id: a.client_id,
      event_type: 'assessment',
      event_date: eventDate,
      event_time: null,
      source_id: a.id,
      title: 'Bilan complété',
      summary: null,
      data: null,
    })
    assessmentCount++
  }

  return NextResponse.json({
    success: true,
    sessions_backfilled: sessionCount,
    assessments_backfilled: assessmentCount,
  })
}
