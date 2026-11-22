import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'

const mocks = createSupabaseMocks()
vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { DELETE as suspendAccess } from '@/app/api/clients/[clientId]/access/route'
import { DELETE as removeClient } from '@/app/api/clients/[clientId]/route'

const params = { params: { clientId: 'client-1' } }
beforeEach(() => mocks.resetMocks())

describe('coach client account isolation', () => {
  it('suspends only the coach relationship and removes its data access', async () => {
    mocks.setServiceResults([
      { data: { id: 'client-1', user_id: 'shared-auth-user' } },
      { data: null },
    ])

    const response = await suspendAccess(new NextRequest('http://localhost/api/clients/client-1/access', { method: 'DELETE' }) as any, params)

    expect(response.status).toBe(200)
    const update = mocks.serviceMock.from.mock.results[1].value
    expect(update.update).toHaveBeenCalledWith({ status: 'suspended', user_id: null })
    expect(update.eq).toHaveBeenCalledWith('coach_id', 'coach-123')
    expect(mocks.serviceMock.auth.admin.getUserById).not.toHaveBeenCalled()
  })

  it('deletes the owned profile without deleting the shared Auth identity', async () => {
    mocks.setServiceResults([
      { data: { id: 'client-1' } },
      { data: [] },
      { data: null }, { data: null }, { data: null }, { data: null },
      { data: null },
    ])

    const response = await removeClient(new NextRequest('http://localhost/api/clients/client-1?mode=delete', { method: 'DELETE' }) as any, params)

    expect(response.status).toBe(200)
    const last = mocks.serviceMock.from.mock.results.at(-1)?.value
    expect(last.delete).toHaveBeenCalled()
    expect(last.eq).toHaveBeenCalledWith('id', 'client-1')
    expect(mocks.serviceMock.auth.admin.getUserById).not.toHaveBeenCalled()
  })
})
