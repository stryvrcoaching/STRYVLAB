type Priority = 'high' | 'medium' | 'low'

type OrganisationDb = {
  from: (table: string) => any
}

export type KanbanTarget = {
  boardId: string
  columnId: string
  columnTitle: string | null
}

export type CreateOrganisationActionInput = {
  db: OrganisationDb
  coachId: string
  clientId?: string | null
  title: string
  description?: string | null
  priority: Priority
  createAgenda: boolean
  createKanban: boolean
  eventDate?: string | null
  eventTime?: string | null
  eventTimeEnd?: string | null
  alertAt?: string | null
  kanbanTarget?: KanbanTarget | null
}

function toIsoAlertDateTime(input: { alertDate?: string | null; alertTime?: string | null }) {
  const alertDate = String(input.alertDate ?? '').trim()
  if (!alertDate) return null
  const alertTime = String(input.alertTime ?? '').trim() || '09:00'
  return `${alertDate}T${alertTime}:00`
}

function computeLegacyNotifyMinutesBefore(input: {
  eventDate?: string | null
  eventTime?: string | null
  alertAt?: string | null
}) {
  if (!input.alertAt || !input.eventDate) return null
  const baseTime = input.eventTime || '09:00'
  const eventAt = new Date(`${input.eventDate}T${baseTime}:00`)
  const alertAt = new Date(input.alertAt)
  if (Number.isNaN(eventAt.getTime()) || Number.isNaN(alertAt.getTime())) return null
  const diffMinutes = Math.round((eventAt.getTime() - alertAt.getTime()) / 60000)
  if (diffMinutes < 0 || diffMinutes > 10080) return null
  return diffMinutes
}

export async function getDefaultKanbanTarget(db: OrganisationDb, coachId: string): Promise<KanbanTarget | null> {
  const { data: boards } = await db
    .from('kanban_boards')
    .select('id, created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: true })
    .limit(1)

  const boardId = boards?.[0]?.id
  if (!boardId) return null

  const { data: columns } = await db
    .from('kanban_columns')
    .select('id, title, order')
    .eq('coach_id', coachId)
    .eq('board_id', boardId)
    .order('order', { ascending: true })
    .limit(1)

  const column = columns?.[0]
  if (!column) return null

  return { boardId, columnId: column.id, columnTitle: column.title ?? null }
}

export async function resolveKanbanTarget(input: {
  db: OrganisationDb
  coachId: string
  boardId?: string | null
  columnId?: string | null
}) {
  if (!input.boardId || !input.columnId) {
    return getDefaultKanbanTarget(input.db, input.coachId)
  }

  const { data: column } = await input.db
    .from('kanban_columns')
    .select('id, title, board_id')
    .eq('coach_id', input.coachId)
    .eq('id', input.columnId)
    .eq('board_id', input.boardId)
    .single()

  if (!column) return null

  return {
    boardId: input.boardId,
    columnId: input.columnId,
    columnTitle: column.title ?? null,
  } satisfies KanbanTarget
}

export async function createOrganisationAction(input: CreateOrganisationActionInput) {
  const {
    db,
    coachId,
    clientId,
    title,
    description,
    priority,
    createAgenda,
    createKanban,
    eventDate,
    eventTime,
    eventTimeEnd,
    alertAt,
    kanbanTarget,
  } = input

  let agendaEventId: string | null = null
  let kanbanTaskId: string | null = null

  const notifyMinutesBefore = computeLegacyNotifyMinutesBefore({
    eventDate,
    eventTime,
    alertAt,
  })

  if (createAgenda) {
    const { data: event, error: eventError } = await db
      .from('agenda_events')
      .insert({
        coach_id: coachId,
        title,
        event_date: eventDate,
        event_time: eventTime || null,
        event_time_end: eventTimeEnd || null,
        description: description ?? null,
        priority,
        client_id: clientId ?? null,
        alert_at: alertAt ?? null,
        notify_minutes_before: notifyMinutesBefore,
      })
      .select()
      .single()

    if (eventError) {
      throw new Error(eventError.message)
    }

    agendaEventId = event.id
  }

  if (createKanban) {
    if (!kanbanTarget) {
      throw new Error('No kanban target found')
    }

    const { data: existing } = await db
      .from('kanban_tasks')
      .select('order')
      .eq('column_id', kanbanTarget.columnId)
      .eq('coach_id', coachId)
      .order('order', { ascending: false })
      .limit(1)

    const nextOrder = existing && existing.length > 0 ? Number(existing[0].order ?? 0) + 1 : 0

    const { data: task, error: taskError } = await db
      .from('kanban_tasks')
      .insert({
        coach_id: coachId,
        board_id: kanbanTarget.boardId,
        column_id: kanbanTarget.columnId,
        title,
        description: description ?? null,
        due_date: eventDate ?? null,
        priority,
        order: nextOrder,
        linked_event_id: agendaEventId,
      })
      .select()
      .single()

    if (taskError) {
      throw new Error(taskError.message)
    }

    kanbanTaskId = task.id
  }

  if (agendaEventId && kanbanTaskId) {
    await db
      .from('agenda_events')
      .update({
        linked_task_id: kanbanTaskId,
        linked_column_title: kanbanTarget?.columnTitle ?? null,
      })
      .eq('id', agendaEventId)
  }

  return {
    agendaEventId,
    kanbanTaskId,
    notifyMinutesBefore,
  }
}

export { toIsoAlertDateTime }
