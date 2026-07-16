import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { DELETE } from '@/app/api/programs/[programId]/weeks/route'

const programId = '00000000-0000-4000-8000-000000000001'
const firstWeekId = '00000000-0000-4000-8000-000000000002'
const secondWeekId = '00000000-0000-4000-8000-000000000003'
const thirdWeekId = '00000000-0000-4000-8000-000000000004'

function makeDeleteRequest(weekId: string) {
  return new NextRequest(`http://localhost:3000/api/programs/${programId}/weeks`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ week_id: weekId }),
  })
}

beforeEach(() => mocks.resetMocks())

describe('DELETE /api/programs/[programId]/weeks', () => {
  it('returns 401 when the coach is not authenticated', async () => {
    mocks.setServerUser(null)
    const response = await DELETE(makeDeleteRequest(secondWeekId), { params: { programId } })
    expect(response.status).toBe(401)
  })

  it('protects the last remaining week', async () => {
    mocks.setServiceResults([
      { data: { id: programId } },
      { data: [{ id: firstWeekId, program_id: programId, position: 0, label: 'Semaine 1' }] },
    ])

    const response = await DELETE(makeDeleteRequest(firstWeekId), { params: { programId } })
    expect(response.status).toBe(400)
    expect(mocks.serviceMock.rpc).not.toHaveBeenCalled()
  })

  it('deletes the selected week and returns the previous week as active', async () => {
    mocks.setServiceResults([
      { data: { id: programId } },
      {
        data: [
          { id: firstWeekId, program_id: programId, position: 0, label: 'Semaine 1' },
          { id: secondWeekId, program_id: programId, position: 1, label: 'Semaine 2' },
          { id: thirdWeekId, program_id: programId, position: 2, label: 'Semaine 3' },
        ],
      },
      {
        data: [
          { id: firstWeekId, program_id: programId, position: 0, label: 'Semaine 1' },
          { id: thirdWeekId, program_id: programId, position: 1, label: 'Semaine 2' },
        ],
      },
    ])

    const response = await DELETE(makeDeleteRequest(secondWeekId), { params: { programId } })
    expect(response.status).toBe(200)
    expect(mocks.serviceMock.rpc).toHaveBeenCalledWith('delete_program_week_and_reorder', {
      p_program_id: programId,
      p_week_id: secondWeekId,
    })
    const body = await response.json()
    expect(body.active_week_id).toBe(firstWeekId)
    expect(body.weeks).toHaveLength(2)
    expect(body.weeks[1].label).toBe('Semaine 2')
  })
})
