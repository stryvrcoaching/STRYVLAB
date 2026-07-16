import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { GET, POST } from '@/app/api/clients/[clientId]/tags/route'

const clientId = '123e4567-e89b-12d3-a456-426614174000'
const tagId = '223e4567-e89b-12d3-a456-426614174000'

beforeEach(() => {
  mocks.resetMocks()
  mocks.setServerUser({ id: 'coach-1' })
})

describe('client tag ownership', () => {
  it('hides tags for another coach client', async () => {
    mocks.setServiceResult({ id: clientId, coach_id: 'coach-2', user_id: 'client-user' })

    const response = await GET(
      new NextRequest(`https://stryvlab.com/api/clients/${clientId}/tags`) as any,
      { params: { clientId } },
    )

    expect(response.status).toBe(404)
    expect(mocks.serviceMock.from).toHaveBeenCalledTimes(1)
  })

  it('refuses assigning another coach tag', async () => {
    mocks.setServiceResults([
      { data: { id: clientId, coach_id: 'coach-1', user_id: 'client-user' } },
      { data: null },
    ])

    const response = await POST(
      new NextRequest(`https://stryvlab.com/api/clients/${clientId}/tags`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tag_id: tagId }),
      }) as any,
      { params: { clientId } },
    )

    expect(response.status).toBe(404)
    expect(mocks.serviceMock.from).not.toHaveBeenCalledWith('client_tags')
  })

  it('assigns an owned tag to an owned client', async () => {
    mocks.setServiceResults([
      { data: { id: clientId, coach_id: 'coach-1', user_id: 'client-user' } },
      { data: { id: tagId } },
      { data: null },
    ])

    const response = await POST(
      new NextRequest(`https://stryvlab.com/api/clients/${clientId}/tags`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tag_id: tagId }),
      }) as any,
      { params: { clientId } },
    )

    expect(response.status).toBe(201)
    expect(mocks.serviceMock.from).toHaveBeenCalledWith('client_tags')
  })
})
