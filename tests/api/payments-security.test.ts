import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'

const mocks = createSupabaseMocks()

vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))
vi.mock('@/lib/email/mailer', () => ({ sendPaymentReceiptEmail: vi.fn() }))

import { POST as createPayment } from '@/app/api/payments/route'
import { POST as createSubscriptionPayment } from '@/app/api/subscriptions/[subscriptionId]/payments/route'

const clientId = '123e4567-e89b-12d3-a456-426614174000'
const subscriptionId = '223e4567-e89b-12d3-a456-426614174000'

beforeEach(() => {
  mocks.resetMocks()
  mocks.setServerUser({ id: 'coach-1', email: 'coach@test.com' })
})

function paymentRequest(url: string) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      amount_eur: 120,
      status: 'paid',
      payment_method: 'bank_transfer',
    }),
  }) as any
}

describe('payment ownership', () => {
  it('refuses a payment for another coach client', async () => {
    mocks.setServiceResult({ id: clientId, coach_id: 'coach-2', user_id: 'client-user' })

    const response = await createPayment(paymentRequest('https://stryvlab.com/api/payments'))

    expect(response.status).toBe(404)
    expect(mocks.serviceMock.from).not.toHaveBeenCalledWith('subscription_payments')
  })

  it('refuses a payment for a subscription not owned by the coach', async () => {
    mocks.setServiceResults([
      { data: null },
      { data: { id: clientId, coach_id: 'coach-1', user_id: 'client-user' } },
    ])

    const response = await createSubscriptionPayment(
      paymentRequest(`https://stryvlab.com/api/subscriptions/${subscriptionId}/payments`),
      { params: { subscriptionId } },
    )

    expect(response.status).toBe(404)
    expect(mocks.serviceMock.from).not.toHaveBeenCalledWith('subscription_payments')
  })
})
