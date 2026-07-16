import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'

const mocks = createSupabaseMocks()

vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { GET } from '@/app/api/cron/account-purge/route'

beforeEach(() => {
  mocks.resetMocks()
  process.env.CRON_SECRET = 'cron-secret'
  process.env.ACCOUNT_PURGE_ENABLED = 'true'
  mocks.serviceMock.rpc.mockResolvedValue({ data: [], error: null })
})

describe('account purge cron', () => {
  it('rejects requests without the cron secret', async () => {
    const response = await GET(new NextRequest('https://stryvlab.com/api/cron/account-purge') as never)

    expect(response.status).toBe(401)
    expect(mocks.serviceMock.rpc).not.toHaveBeenCalled()
  })

  it('claims due jobs through the atomic database function', async () => {
    const response = await GET(new NextRequest('https://stryvlab.com/api/cron/account-purge', {
      headers: { authorization: 'Bearer cron-secret' },
    }) as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(payload.claimed).toBe(0)
    expect(mocks.serviceMock.rpc).toHaveBeenCalledWith('claim_due_account_purge_jobs', { batch_size: 5 })
  })

  it('stays non-destructive until explicitly enabled', async () => {
    process.env.ACCOUNT_PURGE_ENABLED = 'false'

    const response = await GET(new NextRequest('https://stryvlab.com/api/cron/account-purge', {
      headers: { authorization: 'Bearer cron-secret' },
    }) as never)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.enabled).toBe(false)
    expect(mocks.serviceMock.rpc).not.toHaveBeenCalled()
  })
})
