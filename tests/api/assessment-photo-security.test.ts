import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createSupabaseMocks } from '../mocks/supabase'

const mocks = createSupabaseMocks()
vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { POST } from '@/app/api/assessments/photos/signed-url/route'

const coachId = '10000000-0000-4000-8000-000000000001'
const clientId = '20000000-0000-4000-8000-000000000001'
const submissionId = '30000000-0000-4000-8000-000000000001'
const prefix = `${coachId}/${clientId}/${submissionId}`

function request(body: unknown) {
  return new NextRequest('https://stryvlab.com/api/assessments/photos/signed-url', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.resetMocks()
  mocks.setServerUser({ id: coachId })
  mocks.setServiceResult({ id: submissionId, coach_id: coachId, client_id: clientId })
})

describe('assessment photo access', () => {
  it('requires authentication', async () => {
    mocks.setServerUser(null)
    expect((await POST(request({ path: `${prefix}/front.jpg` }))).status).toBe(401)
  })

  it('denies another coach and a client signing a coach photo', async () => {
    for (const userId of ['10000000-0000-4000-8000-000000000002', clientId]) {
      mocks.setServerUser({ id: userId })
      expect((await POST(request({ path: `${prefix}/front.jpg` }))).status).toBe(404)
    }
    expect(mocks.serviceMock.storage.from().createSignedUrl).not.toHaveBeenCalled()
  })

  it('denies a missing or unrelated submission', async () => {
    mocks.setServiceResult(null)
    expect((await POST(request({ path: `${prefix}/front.jpg` }))).status).toBe(404)
    expect(mocks.serviceMock.storage.from().createSignedUrl).not.toHaveBeenCalled()
  })

  it.each(['front.jpg', 'block-1/front.webp'])('allows the owning coach to view %s', async (file) => {
    const path = `${prefix}/${file}`
    const response = await POST(request({ path }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ signedUrl: 'https://example.com/signed.jpg' })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const query = mocks.serviceMock.from.mock.results[0].value
    expect(query.eq).toHaveBeenCalledWith('id', submissionId)
    expect(query.eq).toHaveBeenCalledWith('coach_id', coachId)
    expect(query.eq).toHaveBeenCalledWith('client_id', clientId)
    expect(mocks.serviceMock.storage.from().createSignedUrl).toHaveBeenCalledWith(path, 3600)
  })

  it.each([
    null, {}, { path: 12 }, { path: '' }, { path: 'https://example.com/photo.jpg' },
    { path: `${prefix}/../front.jpg` }, { path: `${prefix}/%2e%2e/front.jpg` },
    { path: `${prefix}/block\\front.jpg` }, { path: `${prefix}//front.jpg` },
    { path: `${coachId}/invalid/${submissionId}/front.jpg` },
  ])('rejects malformed or ambiguous paths %j', async (body) => {
    expect((await POST(request(body))).status).toBe(400)
    expect(mocks.serviceMock.storage.from().createSignedUrl).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON', async () => {
    const response = await POST(new NextRequest('https://stryvlab.com/api/assessments/photos/signed-url', {
      method: 'POST', body: '{',
    }))
    expect(response.status).toBe(400)
  })

  it('fails closed on a submission lookup error', async () => {
    mocks.setServiceResult(null, { message: 'private database error' })
    const response = await POST(request({ path: `${prefix}/front.jpg` }))
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain('private database error')
    expect(mocks.serviceMock.storage.from().createSignedUrl).not.toHaveBeenCalled()
  })
})
