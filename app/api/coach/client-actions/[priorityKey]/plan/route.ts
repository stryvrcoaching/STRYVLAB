import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createOrganisationAction, getDefaultKanbanTarget } from '@/lib/coach/organisation-write'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

type PlanMode = 'agenda' | 'kanban' | 'both'

export async function POST(req: NextRequest, context: { params: Promise<{ priorityKey: string }> }) {
  const { priorityKey } = await context.params
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const mode = (body?.mode ?? 'agenda') as PlanMode
  const clientId = String(body?.clientId ?? '')
  const clientName = String(body?.clientName ?? 'Client')
  const kind = String(body?.kind ?? 'planned_follow_up')
  const reason = String(body?.reason ?? 'Action à planifier')

  if (!priorityKey || !clientId || !['agenda', 'kanban', 'both'].includes(mode)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const db = serviceClient()
  const target = mode === 'kanban' || mode === 'both' ? await getDefaultKanbanTarget(db, user.id) : null
  const today = new Date().toISOString().slice(0, 10)
  if ((mode === 'kanban' || mode === 'both') && !target) {
    return NextResponse.json({ error: 'No kanban target found' }, { status: 400 })
  }

  let agendaEventId: string | null = null
  let kanbanTaskId: string | null = null

  try {
    const result = await createOrganisationAction({
      db,
      coachId: user.id,
      clientId,
      title: `${clientName} — ${reason}`,
      description: `Priorité client (${kind})`,
      priority: kind === 'missing_formula' ? 'high' : 'medium',
      createAgenda: mode === 'agenda' || mode === 'both',
      createKanban: mode === 'kanban' || mode === 'both',
      eventDate: today,
      eventTime: mode === 'kanban' ? null : '09:00',
      alertAt: mode === 'agenda' || mode === 'both' ? `${today}T08:00:00` : null,
      kanbanTarget: target,
    })
    agendaEventId = result.agendaEventId
    kanbanTaskId = result.kanbanTaskId
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to plan action' },
      { status: 500 },
    )
  }

  await db.from('coach_client_priority_states').upsert({
    coach_id: user.id,
    client_id: clientId,
    priority_key: priorityKey,
    kind,
    state: 'planned',
    action_taken: mode,
    agenda_event_id: agendaEventId,
    kanban_task_id: kanbanTaskId,
    metadata: { sourceFingerprint: priorityKey },
    planned_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  return NextResponse.json({
    ok: true,
    state: 'planned',
    agendaEventId,
    kanbanTaskId,
  })
}
