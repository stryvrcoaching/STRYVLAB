import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from 'next/server'

const mocks = createSupabaseMocks()
const restricted = createSupabaseMocks()
vi.mock('@/utils/supabase/server', () => ({ createClient: () => ({
  ...mocks.serverMock, from: restricted.serviceMock.from,
}) }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))

import { PATCH } from '@/app/api/coach/payment-settings/route'

beforeEach(() => {
  mocks.resetMocks()
  restricted.resetMocks()
  restricted.setServiceResult(null, { message: 'permission denied for table coach_payment_settings' })
  mocks.setServiceResult({ coach_id: 'coach-123', stripe_account_id: 'acct_original', receipts_auto_send: false })
})

describe('coach payment preferences', () => {
  it('saves allowed preferences through the server after browser writes are revoked', async () => {
    const response = await PATCH(new NextRequest('https://stryvlab.com/api/coach/payment-settings', {
      method: 'PATCH', body: JSON.stringify({ receipts_auto_send: false }),
    }))
    expect(response.status).toBe(200)
    expect((await response.json()).settings.stripe_account_id).toBe('acct_original')
    const builder = mocks.serviceMock.from.mock.results[0].value
    expect(builder.upsert).toHaveBeenCalledWith({ coach_id: 'coach-123', receipts_auto_send: false }, { onConflict: 'coach_id' })
  })

  it('keeps account references and ownership out of the writable preferences', async () => {
    const response = await PATCH(new NextRequest('https://stryvlab.com/api/coach/payment-settings', {
      method: 'PATCH', body: JSON.stringify({
        coach_id: 'another-coach', stripe_account_id: 'acct_other', stripe_charges_enabled: true,
        stripe_account_status: 'ready', sensitive_actions_verified_at: '2099-01-01', receipts_auto_send: false,
      }),
    }))
    expect(response.status).toBe(200)
    expect(mocks.serviceMock.from.mock.results[0].value.upsert).toHaveBeenCalledWith(
      { coach_id: 'coach-123', receipts_auto_send: false }, { onConflict: 'coach_id' },
    )
  })

  it('requires authentication before using privileged database access', async () => {
    mocks.setServerUser(null)
    const response = await PATCH(new NextRequest('https://stryvlab.com/api/coach/payment-settings', { method: 'PATCH', body: '{}' }))
    expect(response.status).toBe(401)
    expect(mocks.serviceMock.from).not.toHaveBeenCalled()
  })
})
