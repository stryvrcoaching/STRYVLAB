export type ClientSubscriptionLike = { status: string | null | undefined }

export type ClientWithSubscriptions = {
  id: string
  first_name?: string | null
  last_name?: string | null
  created_at?: string | null
  subscriptions?: ClientSubscriptionLike[]
}

export type PendingAssessmentLike = {
  id: string
  client_id: string | null
  created_at: string
  status: string
}

export type AgendaEventLike = {
  id: string
  client_id?: string | null
  title: string
  event_date: string
  event_time?: string | null
  is_completed?: boolean | null
  linked_task_id?: string | null
  linked_column_title?: string | null
  notify_minutes_before?: number | null
}

export type KanbanTaskLike = {
  id: string
  title: string
  due_date?: string | null
  priority: 'high' | 'medium' | 'low'
  is_completed: boolean
  linked_event_id?: string | null
}

export type PersistedPriorityStateLike = {
  priority_key: string
  state: 'open' | 'planned' | 'treated'
  agenda_event_id?: string | null
  kanban_task_id?: string | null
  metadata?: Record<string, unknown> | null
}

export type ClientActionPriority = 'urgent' | 'important' | 'plan'
export type ClientActionState = 'open' | 'planned' | 'treated'
export type ClientActionKind =
  | 'missing_formula'
  | 'assessment_review'
  | 'coach_notification'
  | 'inactive_client'
  | 'planned_follow_up'
  | 'upcoming_event_preparation'
  | 'kanban_blocker'

export type ClientActionPrimaryAction =
  | 'open_profile'
  | 'open_notifications'
  | 'open_assessments'
  | 'assign_formula'
  | 'plan_follow_up'
  | 'create_alert'
  | 'create_kanban_task'
  | 'create_alert_and_task'
  | 'open_kanban_item'

export type ClientActionSecondaryAction =
  | 'open_profile'
  | 'open_source'
  | 'create_alert'
  | 'create_kanban_task'
  | 'create_alert_and_task'
  | 'mark_treated'

export type ClientActionItem = {
  priorityKey: string
  clientId: string
  clientName: string
  priority: ClientActionPriority
  state: ClientActionState
  score: number
  kind: ClientActionKind
  reason: string
  sourceLabel: string
  primaryAction: ClientActionPrimaryAction
  secondaryActions: ClientActionSecondaryAction[]
  planned: boolean
  plannedContext?: {
    agendaEventId?: string
    kanbanTaskId?: string
    label?: string
  }
  metadata?: Record<string, unknown>
}

export type BuildClientActionItemsInput = {
  clients: Array<{ id: string; first_name: string | null; last_name: string | null; created_at: string | null }>
  subscriptionsByClientId: Record<string, ClientSubscriptionLike[]>
  unreadNotificationsByClientId: Record<string, number>
  actionableNotificationsByClientId?: Record<string, number>
  pendingAssessments: PendingAssessmentLike[]
  agendaEvents?: AgendaEventLike[]
  kanbanTasks?: KanbanTaskLike[]
  persistedStates?: PersistedPriorityStateLike[]
  nowIso?: string
}

const PRIORITY_RANK: Record<ClientActionPriority, number> = { urgent: 0, important: 1, plan: 2 }
const KIND_RANK: Record<ClientActionKind, number> = {
  missing_formula: 0,
  assessment_review: 1,
  coach_notification: 2,
  upcoming_event_preparation: 3,
  kanban_blocker: 4,
  planned_follow_up: 5,
  inactive_client: 6,
}

export function hasActiveFormula(subscriptions: ClientSubscriptionLike[]): boolean {
  return subscriptions.some((subscription) => subscription.status === 'active')
}

export function getClientsWithoutActiveFormula<T extends ClientWithSubscriptions>(clients: T[]): T[] {
  return clients.filter((client) => !hasActiveFormula(client.subscriptions ?? []))
}

export function makePriorityKey(kind: ClientActionKind, clientId: string, reference: string) {
  return `${kind}:${clientId}:${reference}`
}

function scoreToPriority(score: number): ClientActionPriority {
  if (score >= 80) return 'urgent'
  if (score >= 45) return 'important'
  return 'plan'
}

function isActionableNotificationCount(input: BuildClientActionItemsInput, clientId: string) {
  if (input.actionableNotificationsByClientId) return input.actionableNotificationsByClientId[clientId] ?? 0
  return input.unreadNotificationsByClientId[clientId] ?? 0
}

function toClientName(client: { first_name: string | null; last_name: string | null }) {
  return `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || 'Client'
}

function scoreAssessment(now: Date, createdAt: string) {
  const ageDays = Math.floor((now.getTime() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000))
  return 55 + Math.min(ageDays * 5, 35)
}

function scoreUpcomingEvent(now: Date, event: AgendaEventLike) {
  if (!event.event_time) return 48
  const eventDateTime = new Date(`${event.event_date}T${event.event_time}`)
  const diffMinutes = Math.round((eventDateTime.getTime() - now.getTime()) / 60000)
  if (diffMinutes <= 180) return 85
  if (diffMinutes <= 720) return 72
  return 60
}

function scoreKanbanBlocker(task: KanbanTaskLike) {
  const priorityBoost = task.priority === 'high' ? 30 : task.priority === 'medium' ? 20 : 10
  return 40 + priorityBoost
}

function mergeSecondaryActions(existing: ClientActionSecondaryAction[], incoming: ClientActionSecondaryAction[]) {
  return Array.from(new Set([...existing, ...incoming]))
}

export function buildClientActionItems(input: BuildClientActionItemsInput): ClientActionItem[] {
  const now = new Date(input.nowIso ?? new Date().toISOString())
  const statesByKey = new Map((input.persistedStates ?? []).map((state) => [state.priority_key, state]))
  const tasksByLinkedEventId = new Map(
    (input.kanbanTasks ?? [])
      .filter((task) => task.linked_event_id && !task.is_completed)
      .map((task) => [task.linked_event_id as string, task]),
  )

  const byClient = new Map<string, ClientActionItem[]>()

  const push = (candidate: Omit<ClientActionItem, 'state' | 'planned' | 'plannedContext'>) => {
    const state = statesByKey.get(candidate.priorityKey)
    if (state?.state === 'treated') return

    const plannedContext =
      state?.state === 'planned'
        ? {
            agendaEventId: state.agenda_event_id ?? undefined,
            kanbanTaskId: state.kanban_task_id ?? undefined,
            label:
              state.kanban_task_id && state.agenda_event_id
                ? 'Agenda + kanban'
                : state.kanban_task_id
                ? 'Lié au kanban'
                : state.agenda_event_id
                ? 'Rappel actif'
                : 'Déjà planifié',
          }
        : undefined

    const full: ClientActionItem = {
      ...candidate,
      state: state?.state ?? 'open',
      planned: state?.state === 'planned',
      plannedContext,
    }

    const list = byClient.get(candidate.clientId) ?? []
    const existingIdx = list.findIndex(
      (item) =>
        item.kind === full.kind &&
        item.primaryAction === full.primaryAction &&
        item.priorityKey === full.priorityKey,
    )

    if (existingIdx >= 0) {
      list[existingIdx] = {
        ...list[existingIdx],
        score: Math.max(list[existingIdx].score, full.score),
        priority: PRIORITY_RANK[full.priority] < PRIORITY_RANK[list[existingIdx].priority] ? full.priority : list[existingIdx].priority,
        secondaryActions: mergeSecondaryActions(list[existingIdx].secondaryActions, full.secondaryActions),
      }
    } else {
      list.push(full)
    }

    byClient.set(candidate.clientId, list)
  }

  for (const client of input.clients) {
    const subscriptions = input.subscriptionsByClientId[client.id] ?? []
    const clientName = toClientName(client)

    if (!hasActiveFormula(subscriptions)) {
      push({
        priorityKey: makePriorityKey('missing_formula', client.id, 'active-formula'),
        clientId: client.id,
        clientName,
        score: 96,
        priority: 'urgent',
        kind: 'missing_formula',
        reason: 'Client sans formule active',
        sourceLabel: 'Formules',
        primaryAction: 'assign_formula',
        secondaryActions: ['open_profile', 'mark_treated'],
        metadata: { createdAt: client.created_at },
      })
      continue
    }

    const actionableNotifications = isActionableNotificationCount(input, client.id)
    if (actionableNotifications > 0) {
      const score = 50 + Math.min(actionableNotifications * 10, 25)
      push({
        priorityKey: makePriorityKey('coach_notification', client.id, 'actionable-notifications'),
        clientId: client.id,
        clientName,
        score,
        priority: scoreToPriority(score),
        kind: 'coach_notification',
        reason: `${actionableNotifications} notification${actionableNotifications > 1 ? 's' : ''} coach à traiter`,
        sourceLabel: 'Notifications',
        primaryAction: 'open_notifications',
        secondaryActions: ['open_profile', 'open_source', 'mark_treated'],
      })
    }

    for (const pending of input.pendingAssessments.filter((assessment) => assessment.client_id === client.id)) {
      const score = scoreAssessment(now, pending.created_at)
      push({
        priorityKey: makePriorityKey('assessment_review', client.id, pending.id),
        clientId: client.id,
        clientName,
        score,
        priority: scoreToPriority(score),
        kind: 'assessment_review',
        reason: score >= 80 ? 'Bilan en attente de revue depuis plusieurs jours' : 'Bilan à revoir',
        sourceLabel: 'Bilans',
        primaryAction: 'open_assessments',
        secondaryActions: ['open_profile', 'create_alert', 'mark_treated'],
        metadata: { assessmentId: pending.id },
      })
    }
  }

  for (const event of input.agendaEvents ?? []) {
    if (!event.client_id || event.is_completed) continue
    const client = input.clients.find((item) => item.id === event.client_id)
    if (!client) continue

    const clientName = toClientName(client)
    const linkedTask = tasksByLinkedEventId.get(event.id)
    const eventDateTime = new Date(`${event.event_date}T${event.event_time ?? '09:00'}`)
    const diffHours = (eventDateTime.getTime() - now.getTime()) / (60 * 60 * 1000)

    if (diffHours >= 0 && diffHours <= 24 && !linkedTask) {
      const score = scoreUpcomingEvent(now, event)
      push({
        priorityKey: makePriorityKey('upcoming_event_preparation', event.client_id, event.id),
        clientId: event.client_id,
        clientName,
        score,
        priority: scoreToPriority(score),
        kind: 'upcoming_event_preparation',
        reason: `Préparer ${event.title.toLowerCase()} dans les prochaines 24h`,
        sourceLabel: 'Agenda',
        primaryAction: 'create_alert_and_task',
        secondaryActions: ['open_source', 'create_alert', 'create_kanban_task', 'mark_treated'],
        metadata: { agendaEventId: event.id },
      })
    }

    if (linkedTask && !linkedTask.is_completed) {
      const score = scoreKanbanBlocker(linkedTask)
      push({
        priorityKey: makePriorityKey('kanban_blocker', event.client_id, linkedTask.id),
        clientId: event.client_id,
        clientName,
        score,
        priority: scoreToPriority(score),
        kind: 'kanban_blocker',
        reason: `Action planifiée à suivre : ${linkedTask.title}`,
        sourceLabel: 'Kanban',
        primaryAction: 'open_kanban_item',
        secondaryActions: ['open_profile', 'open_source', 'mark_treated'],
        metadata: { kanbanTaskId: linkedTask.id, agendaEventId: event.id },
      })
    }
  }

  return [...byClient.values()]
    .flatMap((items) =>
      items.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        return KIND_RANK[a.kind] - KIND_RANK[b.kind]
      }),
    )
    .sort((a, b) => {
      if (a.state !== b.state) return a.state === 'open' ? -1 : b.state === 'open' ? 1 : a.state === 'planned' ? -1 : 1
      if (b.score !== a.score) return b.score - a.score
      if (a.clientName !== b.clientName) return a.clientName.localeCompare(b.clientName)
      return a.kind.localeCompare(b.kind)
    })
}
