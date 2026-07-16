import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { GET } from '@/app/api/clients/[clientId]/profile-photo/route'

const clientId = '123e4567-e89b-12d3-a456-426614174000'

beforeEach(() => {
  mocks.resetMocks()
})

describe('protected profile photo', () => {
  it('does not expose another client photo', async () => {
    mocks.setServerUser({ id: 'foreign-user' })
    mocks.setServiceResult({ id: clientId, coach_id: 'coach-1', user_id: 'client-user-1' })

    const response = await GET(new Request(`https://stryvlab.com/api/clients/${clientId}/profile-photo`), {
      params: { clientId },
    })

    expect(response.status).toBe(404)
    expect(mocks.serviceMock.storage.from().download).not.toHaveBeenCalled()
  })

  it('allows the linked client to read their photo', async () => {
    mocks.setServerUser({ id: 'client-user-1' })
    mocks.setServiceResult({ id: clientId, coach_id: 'coach-1', user_id: 'client-user-1' })

    const response = await GET(new Request(`https://stryvlab.com/api/clients/${clientId}/profile-photo`), {
      params: { clientId },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, max-age=300')
    expect(mocks.serviceMock.storage.from().download).toHaveBeenCalledWith(`${clientId}/avatar`)
  })
})
