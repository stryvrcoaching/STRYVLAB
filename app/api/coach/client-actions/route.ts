import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  buildClientActionItems,
  getClientsWithoutActiveFormula,
  hasActiveFormula,
} from '@/lib/coach/client-action-items'
import {
  isCoachInboxNotificationEnabled,
  type CoachInboxPreferences,
} from '@/lib/notifications/coach-inbox-preferences'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(_req: NextRequest) {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const db = serviceClient()
  const [clientsRes, subscriptionsRes, notificationsRes, submissionsRes, agendaRes, tasksRes, statesRes, preferencesRes] = await Promise.all([
    db.from('coach_clients').select('id, first_name, last_name, created_at').eq('coach_id', user.id),
    db.from('client_subscriptions').select('client_id, status').eq('coach_id', user.id),
    db.from('coach_notifications').select('client_id, status, category, subcategory').eq('coach_id', user.id).eq('status', 'pending'),
    db.from('assessment_submissions').select('id, client_id, status, created_at').eq('coach_id', user.id).eq('status', 'sent'),
    db.from('agenda_events').select('id, client_id, title, event_date, event_time, is_completed, linked_task_id, linked_column_title, notify_minutes_before').eq('coach_id', user.id),
    db.from('kanban_tasks').select('id, title, due_date, priority, is_completed, linked_event_id').eq('coach_id', user.id),
    db.from('coach_client_priority_states').select('priority_key, state, agenda_event_id, kanban_task_id, metadata').eq('coach_id', user.id),
    db.from('coach_profiles').select('notif_inbox_assessments, notif_inbox_training, notif_inbox_messages, notif_inbox_checkins, notif_inbox_nutrition, notif_inbox_health_progress, notif_inbox_administrative').eq('coach_id', user.id).maybeSingle(),
  ])

  const clients = clientsRes.data ?? []
  const subscriptions = subscriptionsRes.data ?? []
  const preferences = (preferencesRes.data ?? {}) as Partial<CoachInboxPreferences>
  const notifications = (notificationsRes.data ?? []).filter((notification: any) =>
    isCoachInboxNotificationEnabled(notification, preferences),
  )
  const pendingAssessments = submissionsRes.data ?? []
  const agendaEvents = agendaRes.data ?? []
  const kanbanTasks = tasksRes.data ?? []
  const persistedStates = statesRes.data ?? []

  const subscriptionsByClientId = subscriptions.reduce<Record<string, Array<{ status: string }>>>((acc, row: any) => {
    if (!row.client_id) return acc
    acc[row.client_id] ??= []
    acc[row.client_id].push({ status: row.status })
    return acc
  }, {})

  const unreadNotificationsByClientId = notifications.reduce<Record<string, number>>((acc, row: any) => {
    if (!row.client_id) return acc
    acc[row.client_id] = (acc[row.client_id] ?? 0) + 1
    return acc
  }, {})

  const clientsWithSubscriptions = clients.map((client: any) => ({
    ...client,
    subscriptions: subscriptionsByClientId[client.id] ?? [],
  }))

  const withoutFormula = getClientsWithoutActiveFormula(clientsWithSubscriptions).map((client) => ({
    clientId: client.id,
    clientName: `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || 'Client',
    createdAt: client.created_at ?? null,
  }))

  const toFollow = buildClientActionItems({
    clients,
    subscriptionsByClientId,
    unreadNotificationsByClientId,
    pendingAssessments,
    agendaEvents,
    kanbanTasks,
    persistedStates,
  })

  const active = clients.filter((client: any) => hasActiveFormula(subscriptionsByClientId[client.id] ?? [])).length

  return NextResponse.json({
    stats: {
      total: clients.length,
      active,
      withoutFormula: withoutFormula.length,
      toFollow: toFollow.length,
    },
    withoutFormula,
    toFollow,
  })
}
