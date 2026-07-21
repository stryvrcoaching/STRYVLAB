import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'

const mocks = createSupabaseMocks()

vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

const runMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ created: 2, advanced: 2, skipped: 0, errors: [] }),
)

vi.mock('@/lib/payments/generate-subscription-dues', () => ({
  runGenerateSubscriptionDues: runMock,
}))

import { GET } from '@/app/api/cron/generate-payment-dues/route'

beforeEach(() => {
  mocks.resetMocks()
  runMock.mockClear()
  runMock.mockResolvedValue({ created: 2, advanced: 2, skipped: 0, errors: [] })
  process.env.CRON_SECRET = 'cron-secret'
})

describe('GET /api/cron/generate-payment-dues', () => {
  it('rejects without secret', async () => {
    const res = await GET(
      new NextRequest('http://localhost:3000/api/cron/generate-payment-dues'),
    )
    expect(res.status).toBe(401)
    expect(runMock).not.toHaveBeenCalled()
  })

  it('runs generation with bearer secret', async () => {
    const res = await GET(
      new NextRequest('http://localhost:3000/api/cron/generate-payment-dues', {
        headers: { authorization: 'Bearer cron-secret' },
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ created: 2, advanced: 2 })
    expect(runMock).toHaveBeenCalled()
  })
})
