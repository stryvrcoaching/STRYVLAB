import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveClientTimezone } from '@/lib/client/checkin/resolveClientTimezone'
import { computePhysiologicalDateInTimezone, utcRangeForPhysiologicalDate } from '@/lib/client/checkin/timeWindows'
import { resolveClientLanguage } from '@/lib/client/resolve-language'
import { ct } from '@/lib/i18n/clientTranslations'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  programSessionId: z.string().uuid(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reasonKey: z.enum([
    'sick_unwell',
    'fatigue_recovery',
    'pain_discomfort',
    'personal_work_conflict',
    'travel_logistics',
  ]),
  note: z.string().trim().max(500).optional().nullable(),
})

const revertBodySchema = z.object({
  programSessionId: z.string().uuid(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const REASON_LABEL_KEYS: Record<z.infer<typeof bodySchema>['reasonKey'], Parameters<typeof ct>[1]> = {
  sick_unwell: 'programme.skip.reason.sick_unwell',
  fatigue_recovery: 'programme.skip.reason.fatigue_recovery',
  pain_discomfort: 'programme.skip.reason.pain_discomfort',
  personal_work_conflict: 'programme.skip.reason.personal_work_conflict',
  travel_logistics: 'programme.skip.reason.travel_logistics',
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { programSessionId, scheduledDate, reasonKey } = parsed.data
  const note = parsed.data.note?.trim() || null
  const db = service()

  const { data: client } = await db
    .from('coach_clients')
    .select('id, coach_id, first_name, last_name, user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!client?.id || !client.coach_id) {
    return NextResponse.json({ error: 'Client profile not found' }, { status: 404 })
  }
  const lang = await resolveClientLanguage(db, client.id)

  const timezone = await resolveClientTimezone(db, client.id)
  const todayPhysio = computePhysiologicalDateInTimezone(new Date(), timezone)
  if (scheduledDate !== todayPhysio) {
    return NextResponse.json({ error: ct(lang, 'programme.skip.error.notToday') }, { status: 400 })
  }
  const { start, end } = utcRangeForPhysiologicalDate(scheduledDate, timezone)

  const { data: session } = await db
    .from('program_sessions')
    .select('id, name, program_id')
    .eq('id', programSessionId)
    .maybeSingle()

  if (!session?.program_id) {
    return NextResponse.json({ error: ct(lang, 'programme.skip.error.notFound') }, { status: 404 })
  }

  const { data: program } = await db
    .from('programs')
    .select('id, client_id, coach_id')
    .eq('id', session.program_id)
    .eq('client_id', client.id)
    .eq('coach_id', client.coach_id)
    .maybeSingle()

  if (!program) {
    return NextResponse.json({ error: ct(lang, 'programme.skip.error.notFound') }, { status: 404 })
  }

  const { data: existingSkip } = await db
    .from('client_workout_skips')
    .select('id')
    .eq('client_id', client.id)
    .eq('program_session_id', programSessionId)
    .eq('scheduled_date', scheduledDate)
    .maybeSingle()

  if (existingSkip?.id) {
    return NextResponse.json({ error: ct(lang, 'programme.skip.error.alreadySkipped') }, { status: 409 })
  }

  const [daySessionLogsResult, draftSessionLogResult] = await Promise.all([
    db
      .from('client_session_logs')
      .select('id')
      .eq('client_id', client.id)
      .eq('program_session_id', programSessionId)
      .gte('logged_at', start.toISOString())
      .lte('logged_at', end.toISOString())
      .limit(5),
    db
      .from('client_session_logs')
      .select('id')
      .eq('client_id', client.id)
      .eq('program_session_id', programSessionId)
      .is('completed_at', null)
      .limit(1),
  ])

  if (((daySessionLogsResult.data ?? []) as any[]).length > 0 || ((draftSessionLogResult.data ?? []) as any[]).length > 0) {
    return NextResponse.json({ error: ct(lang, 'programme.skip.error.alreadyStarted') }, { status: 409 })
  }

  const { data: insertedSkip, error: skipError } = await db
    .from('client_workout_skips')
    .insert({
      client_id: client.id,
      program_id: session.program_id,
      program_session_id: programSessionId,
      scheduled_date: scheduledDate,
      status: 'skipped',
      skip_reason_key: reasonKey,
      skip_note: note,
    })
    .select('id')
    .single()

  if (skipError || !insertedSkip) {
    return NextResponse.json({ error: skipError?.message ?? ct(lang, 'programme.skip.error.failed') }, { status: 500 })
  }

  const { error: overrideError } = await db
    .from('client_day_overrides')
    .upsert({
      client_id: client.id,
      date: scheduledDate,
      kind: 'off',
      source: 'session_skip',
      linked_program_session_id: programSessionId,
      linked_skip_id: insertedSkip.id,
    }, { onConflict: 'client_id,date,source' })

  if (overrideError) {
    return NextResponse.json({ error: overrideError.message }, { status: 500 })
  }

  const reasonLabel = ct(lang, REASON_LABEL_KEYS[reasonKey])
  const title = ct(lang, 'programme.skip.notify.title', { name: client.first_name })
  const body = [
    ct(lang, 'programme.skip.notify.session', { session: (session as any).name, date: scheduledDate }),
    ct(lang, 'programme.skip.notify.reason', { reason: reasonLabel }),
    note ? ct(lang, 'programme.skip.notify.note', { note }) : null,
  ].filter(Boolean).join(' · ')

  const { error: notifError } = await db
    .from('coach_notifications')
    .insert({
      coach_id: client.coach_id,
      client_id: client.id,
      category: 'engagement',
      subcategory: 'session_skip',
      priority: 3,
      email_sent: false,
      title,
      body,
      payload: {
        program_session_id: programSessionId,
        program_session_name: (session as any).name,
        scheduled_date: scheduledDate,
        reason_key: reasonKey,
        reason_label: reasonLabel,
        note,
      },
    })

  if (notifError) {
    return NextResponse.json({ error: notifError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    skipped: true,
    scheduledDate,
    programSessionId,
    dayOverride: { date: scheduledDate, kind: 'off', source: 'session_skip' },
  })
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = revertBodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { programSessionId, scheduledDate } = parsed.data
  const db = service()

  const { data: client } = await db
    .from('coach_clients')
    .select('id, coach_id, user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!client?.id || !client.coach_id) {
    return NextResponse.json({ error: 'Client profile not found' }, { status: 404 })
  }
  const lang = await resolveClientLanguage(db, client.id)

  const timezone = await resolveClientTimezone(db, client.id)
  const todayPhysio = computePhysiologicalDateInTimezone(new Date(), timezone)
  if (scheduledDate !== todayPhysio) {
    return NextResponse.json({ error: ct(lang, 'programme.skip.undo.error.notToday') }, { status: 400 })
  }

  const { data: existingSkip } = await db
    .from('client_workout_skips')
    .select('id')
    .eq('client_id', client.id)
    .eq('program_session_id', programSessionId)
    .eq('scheduled_date', scheduledDate)
    .maybeSingle()

  if (!existingSkip?.id) {
    return NextResponse.json({ error: ct(lang, 'programme.skip.undo.error.notFound') }, { status: 404 })
  }

  const { error: overrideDeleteError } = await db
    .from('client_day_overrides')
    .delete()
    .eq('client_id', client.id)
    .eq('date', scheduledDate)
    .eq('source', 'session_skip')
    .eq('linked_program_session_id', programSessionId)
    .eq('linked_skip_id', existingSkip.id)

  if (overrideDeleteError) {
    return NextResponse.json({ error: overrideDeleteError.message }, { status: 500 })
  }

  const { error: skipDeleteError } = await db
    .from('client_workout_skips')
    .delete()
    .eq('id', existingSkip.id)
    .eq('client_id', client.id)

  if (skipDeleteError) {
    return NextResponse.json({ error: skipDeleteError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    skipped: false,
    scheduledDate,
    programSessionId,
    dayOverride: null,
  })
}
