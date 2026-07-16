import { describe, expect, it } from 'vitest'
import {
  buildClientActionItems,
  getClientsWithoutActiveFormula,
  hasActiveFormula,
  makePriorityKey,
} from '@/lib/coach/client-action-items'

describe('hasActiveFormula', () => {
  it('returns true only when at least one subscription status is active', () => {
    expect(hasActiveFormula([{ status: 'trial' }, { status: 'paused' }])).toBe(false)
    expect(hasActiveFormula([{ status: 'active' }])).toBe(true)
  })
})

describe('getClientsWithoutActiveFormula', () => {
  it('returns clients with no active formula and excludes active ones', () => {
    const clients = [
      { id: 'c1', subscriptions: [{ status: 'cancelled' }] },
      { id: 'c2', subscriptions: [{ status: 'active' }] },
      { id: 'c3', subscriptions: [] },
    ]

    expect(getClientsWithoutActiveFormula(clients).map((client) => client.id)).toEqual(['c1', 'c3'])
  })
})

describe('buildClientActionItems', () => {
  it('deduplicates multiple signals into one dominant row per client', () => {
    const items = buildClientActionItems({
      clients: [{ id: 'c1', first_name: 'Lina', last_name: 'Moreau', created_at: '2026-06-01T00:00:00.000Z' }],
      subscriptionsByClientId: { c1: [] },
      unreadNotificationsByClientId: { c1: 3 },
      pendingAssessments: [{ id: 'a1', client_id: 'c1', created_at: '2026-06-20T00:00:00.000Z', status: 'sent' }],
      nowIso: '2026-07-01T00:00:00.000Z',
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      clientId: 'c1',
      kind: 'missing_formula',
      priority: 'urgent',
      state: 'open',
    })
  })

  it('orders urgent before important before plan', () => {
    const items = buildClientActionItems({
      clients: [
        { id: 'urgent-client', first_name: 'A', last_name: 'A', created_at: '2026-06-01T00:00:00.000Z' },
        { id: 'important-client', first_name: 'B', last_name: 'B', created_at: '2026-06-28T00:00:00.000Z' },
      ],
      subscriptionsByClientId: { 'urgent-client': [], 'important-client': [{ status: 'active' }] },
      unreadNotificationsByClientId: { 'important-client': 2 },
      pendingAssessments: [],
      nowIso: '2026-07-01T00:00:00.000Z',
    })

    expect(items.map((item) => item.clientId)).toEqual(['urgent-client', 'important-client'])
  })

  it('excludes unread notifications when actionable count is zero', () => {
    const items = buildClientActionItems({
      clients: [{ id: 'c1', first_name: 'Lina', last_name: 'Moreau', created_at: null }],
      subscriptionsByClientId: { c1: [{ status: 'active' }] },
      unreadNotificationsByClientId: { c1: 4 },
      actionableNotificationsByClientId: { c1: 0 },
      pendingAssessments: [],
      nowIso: '2026-07-01T00:00:00.000Z',
    })

    expect(items).toHaveLength(0)
  })

  it('creates upcoming event preparation for next 24h when no kanban work exists', () => {
    const items = buildClientActionItems({
      clients: [{ id: 'c1', first_name: 'Lina', last_name: 'Moreau', created_at: null }],
      subscriptionsByClientId: { c1: [{ status: 'active' }] },
      unreadNotificationsByClientId: {},
      pendingAssessments: [],
      agendaEvents: [{ id: 'ev1', client_id: 'c1', title: 'Appel de suivi', event_date: '2026-07-01', event_time: '14:00', is_completed: false }],
      kanbanTasks: [],
      nowIso: '2026-07-01T10:00:00.000Z',
    })

    expect(items[0]).toMatchObject({
      kind: 'upcoming_event_preparation',
      primaryAction: 'create_alert_and_task',
    })
  })

  it('keeps planned items visible with planned state', () => {
    const priorityKey = makePriorityKey('assessment_review', 'c1', 'a1')
    const items = buildClientActionItems({
      clients: [{ id: 'c1', first_name: 'Lina', last_name: 'Moreau', created_at: null }],
      subscriptionsByClientId: { c1: [{ status: 'active' }] },
      unreadNotificationsByClientId: {},
      pendingAssessments: [{ id: 'a1', client_id: 'c1', created_at: '2026-06-27T00:00:00.000Z', status: 'sent' }],
      persistedStates: [{ priority_key: priorityKey, state: 'planned', agenda_event_id: 'ev1' }],
      nowIso: '2026-07-01T00:00:00.000Z',
    })

    expect(items[0]).toMatchObject({
      priorityKey,
      state: 'planned',
      planned: true,
    })
  })

  it('suppresses treated items when the source fingerprint is unchanged', () => {
    const priorityKey = makePriorityKey('assessment_review', 'c1', 'a1')
    const items = buildClientActionItems({
      clients: [{ id: 'c1', first_name: 'Lina', last_name: 'Moreau', created_at: null }],
      subscriptionsByClientId: { c1: [{ status: 'active' }] },
      unreadNotificationsByClientId: {},
      pendingAssessments: [{ id: 'a1', client_id: 'c1', created_at: '2026-06-27T00:00:00.000Z', status: 'sent' }],
      persistedStates: [{ priority_key: priorityKey, state: 'treated' }],
      nowIso: '2026-07-01T00:00:00.000Z',
    })

    expect(items).toHaveLength(0)
  })
})
