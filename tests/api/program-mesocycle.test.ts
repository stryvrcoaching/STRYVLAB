import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'
import { MESOCYCLE_ENGINE_VERSION } from '@/lib/programs/mesocycle'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { POST } from '@/app/api/programs/[programId]/mesocycle/route'

const programId = '00000000-0000-4000-8000-000000000001'
const weekId = '00000000-0000-4000-8000-000000000002'

function makeRequest(body: unknown) {
  return new NextRequest(`http://localhost:3000/api/programs/${programId}/mesocycle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function config() {
  return {
    version: MESOCYCLE_ENGINE_VERSION,
    sourceWeekIds: [weekId],
    outputWeekCount: 4,
    volume: { mode: 'linear', startPercent: 100, endPercent: 120 },
    rir: { mode: 'linear', start: 3, end: 1 },
    deload: { enabled: true, volumePercent: 60, rir: 4 },
    safety: { minSetsPerExercise: 1, maxSetsPerExercise: 8 },
    completionBehavior: 'repeat',
  }
}

beforeEach(() => mocks.resetMocks())

describe('POST /api/programs/[programId]/mesocycle', () => {
  it('returns 401 when the coach is not authenticated', async () => {
    mocks.setServerUser(null)
    const response = await POST(makeRequest({ action: 'preview', config: config() }), {
      params: { programId },
    })
    expect(response.status).toBe(401)
  })

  it('rejects invalid configurations before accessing the programme', async () => {
    const response = await POST(makeRequest({
      action: 'preview',
      config: { ...config(), outputWeekCount: 20 },
    }), { params: { programId } })
    expect(response.status).toBe(400)
  })

  it('returns a deterministic preview without mutating the programme', async () => {
    mocks.setServiceResults([
      { data: { id: programId } },
      {
        data: [{
          id: weekId,
          program_id: programId,
          position: 0,
          label: 'Semaine source',
          week_type: 'base',
          source_week_id: null,
          program_sessions: [{
            id: '00000000-0000-4000-8000-000000000003',
            position: 0,
            program_exercises: [{
              id: '00000000-0000-4000-8000-000000000004',
              position: 0,
              sets: 5,
              execution_type: 'reps_rir',
            }],
          }],
        }],
      },
    ])

    const response = await POST(makeRequest({ action: 'preview', config: config() }), {
      params: { programId },
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.preview.weeks).toHaveLength(4)
    expect(body.preview.weeks.map((week: { volumePercent: number }) => week.volumePercent))
      .toEqual([100, 110, 120, 60])
    expect(mocks.serviceMock.from).toHaveBeenCalledTimes(2)
  })
})
