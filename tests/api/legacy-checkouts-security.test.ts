import { describe, expect, it } from 'vitest'
import { POST as genesisCheckout } from '@/app/api/genesis/stripe/checkout/route'
import { POST as iptCheckout } from '@/app/api/stripe/route'
import { POST as gplusCheckout } from '@/app/api/stripe/gplus/route'
import { POST as omniCheckout } from '@/app/api/stripe/omni/route'
import { POST as initializeLegacyCheckout } from '@/app/api/checkout/init/route'
import { POST as grantLegacyFreeAccess } from '@/app/api/checkout/secure-free/route'
import { POST as createLegacyPaymentIntent } from '@/app/api/create-payment-intent/route'
import { POST as readLegacyStripeSession } from '@/app/api/stripe/session/route'
import { GET as handleLegacyStripeSuccess } from '@/app/api/stripe/success/route'
import { NextRequest } from '../mocks/next-server'

describe('legacy checkout routes', () => {
  it.each([
    ['genesis', genesisCheckout],
    ['ipt', iptCheckout],
    ['gplus', gplusCheckout],
    ['omni', omniCheckout],
    ['checkout initialization', initializeLegacyCheckout],
    ['free access grant', grantLegacyFreeAccess],
    ['direct payment intent', createLegacyPaymentIntent],
    ['Stripe session reader', readLegacyStripeSession],
  ])('keeps %s checkout disabled', async (_name, handler) => {
    const response = await handler()

    expect(response.status).toBe(410)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('redirects the historical Stripe success callback', async () => {
    const response = await handleLegacyStripeSuccess(
      new NextRequest('https://stryvlab.com/api/stripe/success?session_id=legacy') as any,
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://stryvlab.com/cgv')
  })
})
