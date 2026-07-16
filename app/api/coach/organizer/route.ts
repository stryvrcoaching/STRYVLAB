import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  createOrganisationAction,
  resolveKanbanTarget,
  toIsoAlertDateTime,
} from '@/lib/coach/organisation-write'

type OrganizerMode = 'agenda' | 'kanban' | 'both'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isValidTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
}

function buildDefaultTitle(clientName: string) {
  return `Suivi ${clientName}`
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const clientId = String(body?.clientId ?? '').trim()
  const mode = String(body?.mode ?? 'both').trim() as OrganizerMode
  const date = String(body?.date ?? '').trim()
  const time = String(body?.time ?? '').trim()
  const note = String(body?.note ?? '').trim()
  const rawTitle = String(body?.title ?? '').trim()
  const priority = String(body?.priority ?? 'medium').trim() as 'high' | 'medium' | 'low'
  const boardId = String(body?.boardId ?? '').trim() || null
  const columnId = String(body?.columnId ?? '').trim() || null
  const alertEnabled = Boolean(body?.alertEnabled)
  const alertDate = String(body?.alertDate ?? '').trim()
  const alertTime = String(body?.alertTime ?? '').trim()

  if (!clientId || !['agenda', 'kanban', 'both'].includes(mode) || !['high', 'medium', 'low'].includes(priority)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if ((mode === 'agenda' || mode === 'both') && !isValidDate(date)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (time && !isValidTime(time)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (alertEnabled && !isValidDate(alertDate)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (alertTime && !isValidTime(alertTime)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const db = serviceClient()
  const { data: client, error: clientError } = await db
    .from('coach_clients')
    .select('id, first_name, last_name')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (clientError || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ').trim() || 'Client'
  const title = rawTitle || buildDefaultTitle(clientName)
  const description = note || `Organisation coach pour ${clientName}`
  const target = mode === 'kanban' || mode === 'both'
    ? await resolveKanbanTarget({ db, coachId: user.id, boardId, columnId })
    : null
  const alertAt = alertEnabled ? toIsoAlertDateTime({ alertDate, alertTime }) : null

  if ((mode === 'kanban' || mode === 'both') && !target) {
    return NextResponse.json({ error: 'No kanban target found' }, { status: 400 })
  }

  try {
    const { agendaEventId, kanbanTaskId } = await createOrganisationAction({
      db,
      coachId: user.id,
      clientId,
      title,
      description,
      priority,
      createAgenda: mode === 'agenda' || mode === 'both',
      createKanban: mode === 'kanban' || mode === 'both',
      eventDate: date || null,
      eventTime: time || (mode !== 'kanban' ? '09:00' : null),
      alertAt,
      kanbanTarget: target,
    })

    return NextResponse.json({
      ok: true,
      agendaEventId,
      kanbanTaskId,
      clientName,
      mode,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create action' },
      { status: 500 },
    )
  }

}
