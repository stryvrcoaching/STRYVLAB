import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from '../mocks/next-server'
import { createSupabaseMocks } from '../mocks/supabase'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { POST } from '@/app/api/coach/client-actions/[priorityKey]/treat/route'

describe('POST /api/coach/client-actions/[priorityKey]/treat', () => {
  beforeEach(() => mocks.resetMocks())

  it('returns 401 when not authenticated', async () => {
    mocks.setServerUser(null)
    const res = await POST(
      new NextRequest('http://localhost/api/coach/client-actions/k1/treat', { method: 'POST', body: JSON.stringify({}) }),
      { params: Promise.resolve({ priorityKey: 'k1' }) },
    )
    expect(res.status).toBe(401)
  })

  it('marks a priority as treated', async () => {
    mocks.setServiceResults([{ data: null, error: null }])
    const res = await POST(
      new NextRequest('http://localhost/api/coach/client-actions/k1/treat', {
        method: 'POST',
        body: JSON.stringify({ clientId: 'c1', kind: 'assessment_review', actionTaken: 'mark_treated' }),
      }),
      { params: Promise.resolve({ priorityKey: 'k1' }) },
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ state: 'treated' })
  })
})
