import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { POST } from '@/app/api/programs/[programId]/duplicate/route'

beforeEach(() => mocks.resetMocks())

async function json(res: Response) { return res.json() }

describe('POST /api/programs/[programId]/duplicate', () => {
  it('returns 401 when not authenticated', async () => {
    mocks.setServerUser(null)
    const res = await POST(
      new NextRequest('http://localhost:3000/api/programs/p-1/duplicate', { method: 'POST' }),
      { params: { programId: 'p-1' } }
    )
    expect(res.status).toBe(401)
  })

  it('duplicates a full program and returns the copy', async () => {
    const sourceProgram = {
      id: 'p-1',
      client_id: 'client-1',
      coach_id: 'coach-123',
      name: 'Bulk Pro',
      description: 'Source',
      goal: 'hypertrophy',
      level: 'intermediate',
      frequency: 4,
      weeks: 6,
      muscle_tags: ['pectoraux'],
      equipment_archetype: 'gym',
      session_mode: 'day',
      status: 'active',
      is_client_visible: true,
      created_at: '2026-06-01T00:00:00.000Z',
      program_sessions: [
        {
          id: 'ps-1',
          name: 'Push',
          day_of_week: 1,
          days_of_week: [1],
          position: 0,
          notes: null,
          program_exercises: [
            {
              id: 'pe-1',
              name: 'Développé couché',
              sets: 4,
              reps: '8-10',
              rest_sec: 120,
              rir: 2,
              notes: null,
              position: 0,
              image_url: null,
              movement_pattern: 'horizontal_push',
              equipment_required: ['barbell'],
              primary_muscles: ['pectoraux'],
              secondary_muscles: ['triceps'],
              group_id: null,
              is_compound: true,
              is_unilateral: false,
              target_rir: 2,
              weight_increment_kg: 2.5,
              tempo: '3111',
              set_prescriptions: null,
              plane: null,
              mechanic: null,
              unilateral: false,
              primary_muscle: null,
              primary_activation: null,
              secondary_muscles_detail: [],
              secondary_activations: [],
              stabilizers: [],
              joint_stress_spine: null,
              joint_stress_knee: null,
              joint_stress_shoulder: null,
              global_instability: null,
              coordination_demand: null,
              constraint_profile: null,
            },
          ],
        },
      ],
    }

    const duplicatedProgram = {
      ...sourceProgram,
      id: 'p-2',
      name: 'Bulk Pro (copie)',
      is_client_visible: false,
    }

    mocks.setServiceResults([
      { data: sourceProgram },
      { data: { id: 'p-2' } },
      { data: { id: 'ps-2' } },
      { data: null },
      { data: duplicatedProgram },
    ])

    const res = await POST(
      new NextRequest('http://localhost:3000/api/programs/p-1/duplicate', { method: 'POST' }),
      { params: { programId: 'p-1' } }
    )

    expect(res.status).toBe(201)
    const body = await json(res)
    expect(body.program.id).toBe('p-2')
    expect(body.program.name).toBe('Bulk Pro (copie)')
    expect(body.program.is_client_visible).toBe(false)
  })
})
