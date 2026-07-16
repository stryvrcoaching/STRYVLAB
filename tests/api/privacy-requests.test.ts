import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { GET, POST } from '@/app/api/privacy/requests/route'

beforeEach(() => {
  mocks.resetMocks()
  mocks.setServerUser({ id: 'coach-1', email: 'coach@test.com' })
})

function request(body: unknown) {
  return new NextRequest('https://stryvlab.com/api/privacy/requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
}

describe('privacy requests', () => {
  it('requires an authenticated account', async () => {
    mocks.setServerUser(null)

    const response = await POST(request({ requestType: 'erasure' }))

    expect(response.status).toBe(401)
    expect(mocks.serviceMock.from).not.toHaveBeenCalled()
  })

  it('records an authenticated erasure request', async () => {
    mocks.setServiceResult({
      id: 'request-1',
      request_type: 'erasure',
      status: 'received',
      received_at: '2026-07-15T12:00:00.000Z',
      statutory_due_at: '2026-08-15T12:00:00.000Z',
    })

    const response = await POST(request({ requestType: 'erasure' }))
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(payload.request.id).toBe('request-1')
    expect(mocks.serviceMock.from).toHaveBeenCalledWith('privacy_requests')
  })

  it('rejects unsupported request types', async () => {
    const response = await POST(request({ requestType: 'download_everything_now' }))

    expect(response.status).toBe(400)
    expect(mocks.serviceMock.from).not.toHaveBeenCalled()
  })

  it('prevents duplicate open requests', async () => {
    mocks.setServiceResult(null, { code: '23505', message: 'duplicate' })

    const response = await POST(request({ requestType: 'erasure' }))

    expect(response.status).toBe(409)
  })

  it('lists only the authenticated user requests', async () => {
    mocks.setServiceResult([
      {
        id: 'request-1',
        request_type: 'access',
        status: 'received',
        received_at: '2026-07-15T12:00:00.000Z',
        statutory_due_at: '2026-08-15T12:00:00.000Z',
      },
    ])

    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.requests).toHaveLength(1)
    expect(mocks.serviceMock.from).toHaveBeenCalledWith('privacy_requests')
  })
})
