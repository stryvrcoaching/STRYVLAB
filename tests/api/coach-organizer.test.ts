import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from '../mocks/next-server'
import { createSupabaseMocks } from '../mocks/supabase'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { POST } from '@/app/api/coach/organizer/route'

describe('POST /api/coach/organizer', () => {
  beforeEach(() => mocks.resetMocks())

  it('returns 401 when not authenticated', async () => {
    mocks.setServerUser(null)

    const res = await POST(
      new NextRequest('http://localhost/api/coach/organizer', {
        method: 'POST',
        body: JSON.stringify({ clientId: 'c1', mode: 'both', date: '2026-07-02' }),
      }),
    )

    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid payload', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/coach/organizer', {
        method: 'POST',
        body: JSON.stringify({ clientId: '', mode: 'both', date: 'invalid-date' }),
      }),
    )

    expect(res.status).toBe(400)
  })

  it('creates linked agenda and kanban items', async () => {
    mocks.setServiceResults([
      { data: { id: 'c1', first_name: 'Lina', last_name: 'Moreau' }, error: null },
      { data: [{ id: 'board-1', created_at: '2026-07-01T00:00:00.000Z' }], error: null },
      { data: [{ id: 'col-1', title: 'À faire', order: 0 }], error: null },
      { data: { id: 'ev-1' }, error: null },
      { data: [], error: null },
      { data: { id: 'task-1' }, error: null },
      { data: null, error: null },
    ])

    const res = await POST(
      new NextRequest('http://localhost/api/coach/organizer', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 'c1',
          mode: 'both',
          date: '2026-07-02',
          time: '10:30',
          title: '',
          note: 'Préparer le prochain point',
        }),
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      ok: true,
      mode: 'both',
      agendaEventId: 'ev-1',
      kanbanTaskId: 'task-1',
      clientName: 'Lina Moreau',
    })
  })

  it('creates a kanban-only action on an explicit board target', async () => {
    mocks.setServiceResults([
      { data: { id: 'c1', first_name: 'Lina', last_name: 'Moreau' }, error: null },
      { data: { id: 'col-2', title: 'Priorisation', board_id: 'board-2' }, error: null },
      { data: [{ order: 3 }], error: null },
      { data: { id: 'task-2' }, error: null },
    ])

    const res = await POST(
      new NextRequest('http://localhost/api/coach/organizer', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 'c1',
          mode: 'kanban',
          title: 'Relancer la formule',
          note: 'Action prioritaire',
          priority: 'high',
          boardId: 'board-2',
          columnId: 'col-2',
        }),
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      ok: true,
      mode: 'kanban',
      agendaEventId: null,
      kanbanTaskId: 'task-2',
      clientName: 'Lina Moreau',
    })
  })
})
