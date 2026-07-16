import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { GET } from '@/app/api/clients/[clientId]/performance/[exerciseName]/route'

beforeEach(() => {
  mocks.resetMocks()
})

function makeGet(clientId: string, exerciseName: string) {
  return new NextRequest(`http://localhost:3000/api/clients/${clientId}/performance/${encodeURIComponent(exerciseName)}`, {
    method: 'GET',
  })
}

describe('GET /api/clients/[clientId]/performance/[exerciseName]', () => {
  it('matches equivalent exercise labels through the canonical history key', async () => {
    mocks.setServiceResults([
      { data: { id: 'client-1' } },
      { data: [
        { id: 'log-1', completed_at: '2026-06-20T10:00:00.000Z' },
        { id: 'log-2', completed_at: '2026-06-27T10:00:00.000Z' },
      ] },
      { data: [
        {
          session_log_id: 'log-1',
          exercise_name: 'Tirage visage',
          actual_reps: 12,
          actual_weight_kg: 25,
          completed: true,
          rir_actual: 2,
        },
        {
          session_log_id: 'log-2',
          exercise_name: 'Face pull',
          actual_reps: 13,
          actual_weight_kg: 27.5,
          completed: true,
          rir_actual: 2,
        },
      ] },
    ])

    const res = await GET(makeGet('client-1', 'Face pull'), {
      params: { clientId: 'client-1', exerciseName: 'Face pull' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sessionCount).toBe(2)
    expect(body.exerciseName).toBe('Face pull')
  })
})
