import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))
vi.mock('@/lib/notifications/insert-client-notification', () => ({
  insertClientNotification: vi.fn().mockResolvedValue(undefined),
}))

import { GET, POST } from '@/app/api/programs/route'
import { NextRequest } from '../mocks/next-server'

beforeEach(() => mocks.resetMocks())

function makeGet(clientId?: string): NextRequest {
  const url = clientId
    ? `http://localhost:3000/api/programs?client_id=${clientId}`
    : 'http://localhost:3000/api/programs'
  return new NextRequest(url, { method: 'GET' })
}

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/programs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function json(res: Response) { return res.json() }

// ─── GET /api/programs ────────────────────────────────────────

describe('GET /api/programs', () => {
  it('returns 401 when not authenticated', async () => {
    mocks.setServerUser(null)
    const res = await GET(makeGet('client-1'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when client_id is missing', async () => {
    const res = await GET(makeGet())
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.error).toMatch(/client_id/i)
  })

  it('returns programs with nested sessions and exercises', async () => {
    const programs = [
      {
        id: 'p-1', name: 'PPL 5j', weeks: 8, status: 'active', created_at: '2026-05-01T00:00:00Z',
        program_sessions: [
          {
            id: 'ps-1', name: 'Push', position: 0,
            program_exercises: [
              { id: 'pe-1', name: 'Développé couché', sets: 4, reps: '8-10' },
            ],
          },
        ],
      },
    ]
    mocks.setServiceResult(programs)
    const res = await GET(makeGet('client-1'))
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.programs).toHaveLength(1)
    expect(body.programs[0].name).toBe('PPL 5j')
    expect(body.programs[0].program_sessions).toHaveLength(1)
    expect(body.programs[0].program_sessions[0].program_exercises).toHaveLength(1)
  })

  it('returns empty programs array when client has no program', async () => {
    mocks.setServiceResult([])
    const res = await GET(makeGet('client-1'))
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.programs).toHaveLength(0)
  })

  it('returns analytics data even if there are no assignments for the program (fallback)', async () => {
    const program = {
      id: 'p-1', name: 'PPL', status: 'active', created_at: '2026-05-01T00:00:00Z',
      program_sessions: [{ id: 'ps-1', name: 'Push', position: 0, program_exercises: [] }]
    }
    const logs = [{
      id: 'log-1', program_session_id: 'ps-1', session_name: 'Push',
      logged_at: '2026-06-01T10:00:00Z', completed_at: '2026-06-01T11:00:00Z',
      duration_min: 60,
      client_set_logs: [{ actual_reps: 10, actual_weight_kg: 50, completed: true }]
    }]
    mocks.setServiceResults([
      { data: [program] }, // programs query
      { data: [] },        // assignments query
      { data: logs },      // session logs query
      { data: [] }         // progression events query
    ])
    const res = await GET(makeGet('client-1'))
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.programs).toHaveLength(1)
    expect(body.programs[0].analytics.completed_sessions).toBe(1)
    expect(body.programs[0].analytics.total_logged_volume_kg).toBe(500)
  })

  it('includes legacy logs that pre-date the program\'s earliest assignment window', async () => {
    const program = {
      id: 'p-1', name: 'PPL', status: 'active', created_at: '2026-05-01T00:00:00Z',
      program_sessions: [{ id: 'ps-1', name: 'Push', position: 0, program_exercises: [] }]
    }
    const assignments = [{ program_id: 'p-1', started_at: '2026-07-01T00:00:00Z', ended_at: null }]
    const logs = [
      {
        id: 'log-legacy', program_session_id: 'ps-1', session_name: 'Push',
        logged_at: '2026-06-15T10:00:00Z', completed_at: '2026-06-15T11:00:00Z',
        duration_min: 60,
        client_set_logs: [{ actual_reps: 10, actual_weight_kg: 50, completed: true }]
      },
      {
        id: 'log-active', program_session_id: 'ps-1', session_name: 'Push',
        logged_at: '2026-07-02T10:00:00Z', completed_at: '2026-07-02T11:00:00Z',
        duration_min: 60,
        client_set_logs: [{ actual_reps: 8, actual_weight_kg: 60, completed: true }]
      }
    ]
    mocks.setServiceResults([
      { data: [program] },
      { data: assignments },
      { data: logs },
      { data: [] }
    ])
    const res = await GET(makeGet('client-1'))
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.programs).toHaveLength(1)
    expect(body.programs[0].analytics.completed_sessions).toBe(2)
  })

  it('keeps legacy analytics on the original program after a hidden copy is created', async () => {
    const original = {
      id: 'p-original', name: 'BULK PRO', status: 'active', is_client_visible: true,
      created_at: '2026-05-04T00:00:00Z',
      program_sessions: [{ id: 'ps-original', name: 'Upper', position: 0, program_exercises: [] }],
    }
    const hiddenCopy = {
      id: 'p-copy', name: 'BULK PRO (copie)', status: 'active', is_client_visible: false,
      created_at: '2026-07-13T00:00:00Z',
      program_sessions: [{ id: 'ps-copy', name: 'Upper', position: 0, program_exercises: [] }],
    }
    const logs = [{
      id: 'log-legacy', source_program_id: null, program_session_id: null, session_name: 'Upper',
      logged_at: '2026-06-15T10:00:00Z', completed_at: '2026-06-15T11:00:00Z',
      duration_min: 60,
      client_set_logs: [{ actual_reps: 10, actual_weight_kg: 50, completed: true }],
    }]
    mocks.setServiceResults([
      { data: [hiddenCopy, original] },
      { data: [] },
      { data: logs },
      { data: [] },
    ])

    const res = await GET(makeGet('client-1'))
    const body = await json(res)

    expect(res.status).toBe(200)
    expect(body.programs.find((program: any) => program.id === 'p-original').analytics.completed_sessions).toBe(1)
    expect(body.programs.find((program: any) => program.id === 'p-copy').analytics.completed_sessions).toBe(0)
  })

  it('filters out logs created after assignments started but not inside assignment windows', async () => {
    const program = {
      id: 'p-1', name: 'PPL', status: 'active', created_at: '2026-05-01T00:00:00Z',
      program_sessions: [{ id: 'ps-1', name: 'Push', position: 0, program_exercises: [] }]
    }
    const assignments = [{ program_id: 'p-1', started_at: '2026-07-01T00:00:00Z', ended_at: '2026-07-05T00:00:00Z' }]
    const logs = [
      {
        id: 'log-legacy', program_session_id: 'ps-1', session_name: 'Push',
        logged_at: '2026-06-15T10:00:00Z', completed_at: '2026-06-15T11:00:00Z',
        duration_min: 60,
        client_set_logs: [{ actual_reps: 10, actual_weight_kg: 50, completed: true }]
      },
      {
        id: 'log-outside', program_session_id: 'ps-1', session_name: 'Push',
        logged_at: '2026-07-06T10:00:00Z', completed_at: '2026-07-06T11:00:00Z',
        duration_min: 60,
        client_set_logs: [{ actual_reps: 8, actual_weight_kg: 60, completed: true }]
      }
    ]
    mocks.setServiceResults([
      { data: [program] },
      { data: assignments },
      { data: logs },
      { data: [] }
    ])
    const res = await GET(makeGet('client-1'))
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.programs).toHaveLength(1)
    expect(body.programs[0].analytics.completed_sessions).toBe(1)
    expect(body.programs[0].analytics.recent_volume_trend[0]).toBe(500)
  })

  it('filters out logs that pre-date the creation of the program itself', async () => {
    const program = {
      id: 'p-2', name: 'New Program', status: 'active', created_at: '2026-07-08T00:00:00Z',
      program_sessions: [{ id: 'ps-2', name: 'Legs', position: 0, program_exercises: [] }]
    }
    const logs = [
      {
        id: 'log-old', program_session_id: 'ps-2', session_name: 'Legs',
        logged_at: '2026-06-01T10:00:00Z', completed_at: '2026-06-01T11:00:00Z',
        duration_min: 60,
        client_set_logs: [{ actual_reps: 10, actual_weight_kg: 50, completed: true }]
      },
      {
        id: 'log-new', program_session_id: 'ps-2', session_name: 'Legs',
        logged_at: '2026-07-08T10:00:00Z', completed_at: '2026-07-08T11:00:00Z',
        duration_min: 60,
        client_set_logs: [{ actual_reps: 10, actual_weight_kg: 60, completed: true }]
      }
    ]
    mocks.setServiceResults([
      { data: [program] },
      { data: [] },
      { data: logs },
      { data: [] }
    ])
    const res = await GET(makeGet('client-1'))
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.programs).toHaveLength(1)
    expect(body.programs[0].analytics.completed_sessions).toBe(1)
    expect(body.programs[0].analytics.total_logged_volume_kg).toBe(600)
  })

  it('returns 500 on DB error', async () => {
    mocks.setServiceResult(null, { message: 'Query failed' })
    const res = await GET(makeGet('client-1'))
    expect(res.status).toBe(500)
  })
})

// ─── POST /api/programs ───────────────────────────────────────

describe('POST /api/programs', () => {
  it('returns 401 when not authenticated', async () => {
    mocks.setServerUser(null)
    const res = await POST(makePost({ client_id: 'c-1', name: 'PPL' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when client_id is missing', async () => {
    const res = await POST(makePost({ name: 'PPL' }))
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.error).toMatch(/client_id/i)
  })

  it('returns 400 when name is missing', async () => {
    const res = await POST(makePost({ client_id: 'c-1' }))
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.error).toMatch(/name/i)
  })

  it('returns 400 when both client_id and name are missing', async () => {
    const res = await POST(makePost({}))
    expect(res.status).toBe(400)
  })

  it('creates program with default weeks=4 and returns 201', async () => {
    const program = { id: 'p-new', name: 'PPL', coach_id: 'coach-123', client_id: 'c-1', weeks: 4, status: 'active' }
    mocks.setServiceResults([
      { data: program },   // programs insert
      { data: null },      // insertClientNotification → from('coach_clients') + from('client_notifications')
      { data: null },
    ])
    const res = await POST(makePost({ client_id: 'c-1', name: 'PPL' }))
    expect(res.status).toBe(201)
    const body = await json(res)
    expect(body.program.id).toBe('p-new')
    expect(body.program.weeks).toBe(4)
  })

  it('creates program with custom weeks', async () => {
    const program = { id: 'p-new', name: 'Force 12w', weeks: 12, status: 'active' }
    mocks.setServiceResults([
      { data: program },
      { data: null },
      { data: null },
    ])
    const res = await POST(makePost({ client_id: 'c-1', name: 'Force 12w', weeks: 12 }))
    expect(res.status).toBe(201)
    const body = await json(res)
    expect(body.program.weeks).toBe(12)
  })

  it('triggers client notification after program creation', async () => {
    const { insertClientNotification } = await import('@/lib/notifications/insert-client-notification')
    const program = { id: 'p-new', name: 'PPL', weeks: 4 }
    mocks.setServiceResults([
      { data: program },
      { data: null },
      { data: null },
    ])
    await POST(makePost({ client_id: 'c-1', name: 'PPL' }))
    expect(insertClientNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        clientId: 'c-1',
        type: 'program_assigned',
      })
    )
  })

  it('returns 500 on DB error', async () => {
    mocks.setServiceResult(null, { message: 'Insert failed' })
    const res = await POST(makePost({ client_id: 'c-1', name: 'PPL' }))
    expect(res.status).toBe(500)
  })
})
