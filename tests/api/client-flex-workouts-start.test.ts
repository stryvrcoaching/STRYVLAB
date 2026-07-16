import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'

const mocks = createSupabaseMocks()
const { fetchFlexWorkoutSession } = vi.hoisted(() => ({
  fetchFlexWorkoutSession: vi.fn(),
}))

vi.mock('@/lib/training/flexTraining/server', () => ({
  requireAuthedUser: vi.fn().mockResolvedValue({
    user: { id: 'user-client-1', email: 'client@test.com' },
    error: null,
  }),
  resolveClientForUser: vi.fn().mockResolvedValue({
    id: 'client-1',
    coach_id: 'coach-1',
  }),
  createServiceDb: () => mocks.serviceMock,
}))

vi.mock('@/lib/training/flexTraining/queries', () => ({
  fetchFlexWorkoutSession,
}))

import { POST } from '@/app/api/client/flex-workouts/start/route'

beforeEach(() => {
  mocks.resetMocks()
  fetchFlexWorkoutSession.mockReset()
})

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/client/flex-workouts/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/client/flex-workouts/start', () => {
  it('does not reuse an unrelated free active session for a coach workout flow', async () => {
    mocks.setServiceResults([
      {
        data: {
          program_id: 'program-1',
        },
      },
      {
        data: {
          id: 'active-free',
          type: 'free',
          relation_to_planned_workout: null,
          source_program_id: null,
          source_workout_id: null,
          replaced_workout_id: null,
        },
      },
      {
        data: {
          id: 'new-session',
          client_id: 'client-1',
          coach_id: 'coach-1',
          type: 'modified_planned',
          relation_to_planned_workout: 'unknown',
          source_program_id: 'program-1',
          source_workout_id: '11111111-1111-1111-1111-111111111111',
          replaced_workout_id: null,
          started_at: '2026-06-29T10:00:00.000Z',
          ended_at: null,
          duration_seconds: null,
          perceived_difficulty: null,
          global_rir: null,
          notes: null,
          status: 'active',
          created_at: '2026-06-29T10:00:00.000Z',
          updated_at: '2026-06-29T10:00:00.000Z',
        },
      },
    ])

    const res = await POST(makePost({
      relation_to_planned_workout: 'unknown',
      source_workout_id: '11111111-1111-1111-1111-111111111111',
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.session.id).toBe('new-session')
    expect(body.reused).toBeUndefined()
    expect(fetchFlexWorkoutSession).not.toHaveBeenCalled()
  })

  it('reuses an active session only when the context matches exactly', async () => {
    mocks.setServiceResults([
      {
        data: {
          program_id: 'program-1',
        },
      },
      {
        data: {
          id: 'active-planned',
          type: 'modified_planned',
          relation_to_planned_workout: 'unknown',
          source_program_id: 'program-1',
          source_workout_id: '11111111-1111-1111-1111-111111111111',
          replaced_workout_id: null,
        },
      },
    ])

    fetchFlexWorkoutSession.mockResolvedValue({
      session: {
        id: 'active-planned',
        client_id: 'client-1',
        coach_id: 'coach-1',
        type: 'modified_planned',
        relation_to_planned_workout: 'unknown',
        source_program_id: 'program-1',
        source_workout_id: '11111111-1111-1111-1111-111111111111',
        replaced_workout_id: null,
        started_at: '2026-06-29T09:00:00.000Z',
        ended_at: null,
        duration_seconds: null,
        perceived_difficulty: null,
        global_rir: null,
        notes: null,
        status: 'active',
        created_at: '2026-06-29T09:00:00.000Z',
        updated_at: '2026-06-29T09:00:00.000Z',
      },
      exercises: [],
    })

    const res = await POST(makePost({
      relation_to_planned_workout: 'unknown',
      source_workout_id: '11111111-1111-1111-1111-111111111111',
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.session.id).toBe('active-planned')
    expect(body.reused).toBe(true)
    expect(fetchFlexWorkoutSession).toHaveBeenCalledWith(mocks.serviceMock, 'active-planned')
  })
})
