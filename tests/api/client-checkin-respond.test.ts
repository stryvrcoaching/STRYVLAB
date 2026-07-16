import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest, NextResponse } from '../mocks/next-server'

const mocks = createSupabaseMocks()

vi.mock('next/server', () => ({ NextRequest, NextResponse }))
vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))
vi.mock('@/lib/client/checkin/resolveClientTimezone', () => ({
  resolveClientTimezone: vi.fn().mockResolvedValue('Europe/Brussels'),
}))
vi.mock('@/lib/client/ai-coach/buildSystemPrompt', () => ({
  buildSystemPrompt: vi.fn().mockResolvedValue('system'),
}))
vi.mock('@/lib/client/ai-coach/buildDailyBrief', () => ({
  buildDailyBrief: vi.fn().mockResolvedValue('brief'),
}))
vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}))
vi.mock('openai', () => ({
  default: class OpenAI {
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Message de clôture' } }],
        }),
      },
    }
  },
}))

import { POST } from '@/app/api/client/checkin/respond/route'

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/client/checkin/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/client/checkin/respond', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-09T00:00:00.000Z'))
    mocks.resetMocks()
    mocks.setServerUser({ id: 'user-client-1', email: 'client@test.com' })
    process.env.OPENAI_API_KEY = 'test-key'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('persists an evening backlog check-in on the requested physiological slot date', async () => {
    mocks.setServiceResults([
      { data: { id: 'client-1', first_name: 'Kev', timezone: 'Europe/Brussels' } },
      { data: { id: 'config-1', is_active: true, days_of_week: [0, 1, 2, 3, 4, 5, 6] } },
      { data: null },
      { data: { id: 'response-1', responses: { daily_steps: 8421 } } },
      { data: null },
      { data: null },
      { data: null },
      { data: { coach_id: null } },
      { data: { id: 'summary-1', role: 'user', content: 'summary', message_type: 'checkin_summary', metadata: {}, seen_at: null, created_at: '2026-07-09T00:00:00.000Z' } },
      { data: { id: 'bot-1', role: 'assistant', content: 'ok', message_type: 'text', metadata: {}, seen_at: null, created_at: '2026-07-09T00:00:00.000Z' } },
      { data: null },
      { data: null },
      { data: null },
      { data: null },
      { data: null },
    ])

    const res = await POST(makePost({
      config_id: '11111111-1111-1111-1111-111111111111',
      moment: 'evening',
      date: '2026-07-08',
      responses: {
        energy_level: 4,
        stress_level: 2,
        daily_steps: 8421,
      },
    }))

    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({ points_awarded: 10 })

    const checkinWriteBuilder = mocks.serviceMock.from.mock.results[4]?.value
    const chatSessionWriteBuilder = mocks.serviceMock.from.mock.results[5]?.value

    expect(checkinWriteBuilder?.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'client-1',
        date: '2026-07-08',
        flow_type: 'evening',
        daily_steps: 8421,
      }),
      { onConflict: 'client_id,date,flow_type' },
    )

    expect(chatSessionWriteBuilder?.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'client-1',
        date: '2026-07-08',
        flow_type: 'evening',
      }),
      { onConflict: 'client_id,date,flow_type' },
    )
  })
})
