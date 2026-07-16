import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { POST } from '@/app/api/client/programme/session-exercises/route'

beforeEach(() => {
  mocks.resetMocks()
  mocks.setServerUser({ id: 'user-client-1', email: 'client@test.com' })
})

function makePost(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/client/programme/session-exercises', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/client/programme/session-exercises', () => {
  it('creates a real program exercise for the authenticated client session', async () => {
    mocks.setServiceResults([
      { data: { id: 'client-1' } },
      { data: { id: 'session-1', program_id: 'program-1', programs: { id: 'program-1', client_id: 'client-1', status: 'active' } } },
      { data: [] },
      { data: {
        id: 'exercise-1',
        name: 'Pec Deck',
        sets: 3,
        reps: '10',
        rest_sec: 90,
        rir: 2,
        notes: null,
        position: 0,
        target_rir: 2,
        current_weight_kg: null,
        rep_min: null,
        rep_max: null,
        weight_increment_kg: 2.5,
        image_url: null,
        is_unilateral: false,
        primary_muscles: ['chest'],
        secondary_muscles: ['shoulders'],
        group_id: null,
        tempo: null,
        movement_pattern: 'horizontal_push',
        set_prescriptions: null,
        created_by_client: true,
      } },
    ])

    const res = await POST(makePost({
      sessionId: '11111111-1111-1111-1111-111111111111',
      name: 'Pec Deck',
      movement_pattern: 'horizontal_push',
      primary_muscles: ['chest'],
      secondary_muscles: ['shoulders'],
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.exercise.id).toBe('exercise-1')
    expect(body.exercise.created_by_client).toBe(true)
  })

  it('accepts catalog exercises with relative image paths', async () => {
    mocks.setServiceResults([
      { data: { id: 'client-1' } },
      { data: { id: 'session-1', program_id: 'program-1', programs: { id: 'program-1', client_id: 'client-1', status: 'active' } } },
      { data: [] },
      { data: {
        id: 'exercise-2',
        name: 'Ab coaster',
        sets: 3,
        reps: '10',
        rest_sec: 90,
        rir: 2,
        notes: null,
        position: 0,
        target_rir: 2,
        current_weight_kg: null,
        rep_min: null,
        rep_max: null,
        weight_increment_kg: 2.5,
        image_url: '/bibliotheque_exercices/abdos/ab-coaster-abdominaux.gif',
        is_unilateral: false,
        primary_muscles: ['abdos'],
        secondary_muscles: [],
        group_id: null,
        tempo: null,
        movement_pattern: 'core_flex',
        set_prescriptions: null,
        created_by_client: true,
      } },
    ])

    const res = await POST(makePost({
      sessionId: '11111111-1111-1111-1111-111111111111',
      name: 'Ab coaster',
      image_url: '/bibliotheque_exercices/abdos/ab-coaster-abdominaux.gif',
      movement_pattern: 'core_flex',
      primary_muscles: ['abdos'],
      secondary_muscles: [],
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.exercise.id).toBe('exercise-2')
    expect(body.exercise.image_url).toBe('/bibliotheque_exercices/abdos/ab-coaster-abdominaux.gif')
  })
})
