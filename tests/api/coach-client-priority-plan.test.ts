import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from '../mocks/next-server'
import { createSupabaseMocks } from '../mocks/supabase'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { POST } from '@/app/api/coach/client-actions/[priorityKey]/plan/route'

describe('POST /api/coach/client-actions/[priorityKey]/plan', () => {
  beforeEach(() => mocks.resetMocks())

  it('returns 401 when not authenticated', async () => {
    mocks.setServerUser(null)
    const res = await POST(
      new NextRequest('http://localhost/api/coach/client-actions/k1/plan', { method: 'POST', body: JSON.stringify({}) }),
      { params: Promise.resolve({ priorityKey: 'k1' }) },
    )
    expect(res.status).toBe(401)
  })

  it('creates agenda and kanban planning state', async () => {
    mocks.setServiceResults([
      { data: [{ id: 'board-1', created_at: '2026-07-01T00:00:00.000Z' }], error: null },
      { data: [{ id: 'col-1', title: 'À faire', order: 0 }], error: null },
      { data: { id: 'ev-1' }, error: null },
      { data: [], error: null },
      { data: { id: 'task-1' }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ])

    const res = await POST(
      new NextRequest('http://localhost/api/coach/client-actions/k1/plan', {
        method: 'POST',
        body: JSON.stringify({ mode: 'both', clientId: 'c1', clientName: 'Lina Moreau', kind: 'assessment_review', reason: 'Bilan à revoir' }),
      }),
      { params: Promise.resolve({ priorityKey: 'k1' }) },
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ state: 'planned', agendaEventId: 'ev-1', kanbanTaskId: 'task-1' })
  })
})
