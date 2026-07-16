import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from '../mocks/next-server'
import { createSupabaseMocks } from '../mocks/supabase'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { GET } from '@/app/api/coach/client-actions/route'

describe('GET /api/coach/client-actions', () => {
  beforeEach(() => mocks.resetMocks())

  it('returns 401 when not authenticated', async () => {
    mocks.setServerUser(null)
    const res = await GET(new NextRequest('http://localhost/api/coach/client-actions'))
    expect(res.status).toBe(401)
  })

  it('returns aggregated stats and client action lists', async () => {
    mocks.setServiceResults([
      {
        data: [{ id: 'c1', first_name: 'Lina', last_name: 'Moreau', created_at: '2026-06-01T00:00:00.000Z' }],
        error: null,
      },
      {
        data: [{ client_id: 'c1', status: 'cancelled' }],
        error: null,
      },
      {
        data: [{ client_id: 'c1', status: 'pending' }, { client_id: 'c1', status: 'pending' }],
        error: null,
      },
      {
        data: [{ id: 'sub-1', client_id: 'c1', status: 'sent', created_at: '2026-06-20T00:00:00.000Z' }],
        error: null,
      },
      {
        data: [],
        error: null,
      },
      {
        data: [],
        error: null,
      },
      {
        data: [],
        error: null,
      },
    ])

    const res = await GET(new NextRequest('http://localhost/api/coach/client-actions'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stats).toMatchObject({ total: 1, active: 0, withoutFormula: 1, toFollow: 1 })
    expect(body.withoutFormula[0]).toMatchObject({ clientId: 'c1', clientName: 'Lina Moreau' })
    expect(body.toFollow[0]).toMatchObject({ kind: 'missing_formula', priority: 'urgent' })
  })

  it('returns planned context when a persisted planned state exists', async () => {
    mocks.setServiceResults([
      {
        data: [{ id: 'c1', first_name: 'Lina', last_name: 'Moreau', created_at: '2026-06-01T00:00:00.000Z' }],
        error: null,
      },
      {
        data: [{ client_id: 'c1', status: 'active' }],
        error: null,
      },
      {
        data: [],
        error: null,
      },
      {
        data: [{ id: 'a1', client_id: 'c1', status: 'sent', created_at: '2026-06-20T00:00:00.000Z' }],
        error: null,
      },
      {
        data: [],
        error: null,
      },
      {
        data: [],
        error: null,
      },
      {
        data: [{ priority_key: 'assessment_review:c1:a1', state: 'planned', agenda_event_id: 'ev1', kanban_task_id: null, metadata: {} }],
        error: null,
      },
    ])

    const res = await GET(new NextRequest('http://localhost/api/coach/client-actions'))
    const body = await res.json()
    expect(body.toFollow[0]).toMatchObject({ state: 'planned', planned: true })
  })
})
