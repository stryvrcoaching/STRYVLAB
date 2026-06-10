import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'
import { computePhysiologicalDateInTimezone } from '@/lib/client/checkin/timeWindows'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))
vi.mock('@/lib/client/checkin/resolveClientTimezone', () => ({
  resolveClientTimezone: vi.fn().mockResolvedValue('Europe/Brussels'),
}))

import { POST } from '@/app/api/client/programme/skip/route'

beforeEach(() => {
  mocks.resetMocks()
  mocks.setServerUser({ id: 'user-client-1', email: 'client@test.com' })
})

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/client/programme/skip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/client/programme/skip', () => {
  it('creates skip + off day override + coach notification for today', async () => {
    const today = computePhysiologicalDateInTimezone(new Date(), 'Europe/Brussels')

    mocks.setServiceResults([
      { data: { id: 'client-1', coach_id: 'coach-1', first_name: 'Louis', last_name: 'Test', user_id: 'user-client-1' } },
      { data: { id: 'session-1', name: 'Full Body A', program_id: 'program-1' } },
      { data: { id: 'program-1', client_id: 'client-1', coach_id: 'coach-1' } },
      { data: null },
      { data: [] },
      { data: [] },
      { data: { id: 'skip-1' } },
      { data: null },
      { data: null },
    ])

    const res = await POST(makePost({
      programSessionId: '11111111-1111-1111-1111-111111111111',
      scheduledDate: today,
      reasonKey: 'fatigue_recovery',
      note: 'Trop fatigue aujourd hui',
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.skipped).toBe(true)
    expect(body.dayOverride.kind).toBe('off')
  })

  it('rejects skip for a date other than today', async () => {
    mocks.setServiceResults([
      { data: { id: 'client-1', coach_id: 'coach-1', first_name: 'Louis', last_name: 'Test', user_id: 'user-client-1' } },
    ])

    const res = await POST(makePost({
      programSessionId: '11111111-1111-1111-1111-111111111111',
      scheduledDate: '2026-01-01',
      reasonKey: 'fatigue_recovery',
    }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(String(body.error)).toMatch(/today/i)
  })

  it('rejects skip when a session log already exists', async () => {
    const today = computePhysiologicalDateInTimezone(new Date(), 'Europe/Brussels')

    mocks.setServiceResults([
      { data: { id: 'client-1', coach_id: 'coach-1', first_name: 'Louis', last_name: 'Test', user_id: 'user-client-1' } },
      { data: { id: 'session-1', name: 'Full Body A', program_id: 'program-1' } },
      { data: { id: 'program-1', client_id: 'client-1', coach_id: 'coach-1' } },
      { data: null },
      { data: [{ id: 'log-1' }] },
      { data: [] },
    ])

    const res = await POST(makePost({
      programSessionId: '11111111-1111-1111-1111-111111111111',
      scheduledDate: today,
      reasonKey: 'fatigue_recovery',
    }))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(String(body.error)).toMatch(/started/i)
  })
})
