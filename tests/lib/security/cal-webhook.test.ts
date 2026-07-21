import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyCalWebhookSignature } from '@/lib/security/cal-webhook'

describe('verifyCalWebhookSignature', () => {
  const secret = 'test-webhook-secret'
  const body = '{"triggerEvent":"BOOKING_CREATED"}'
  const signature = createHmac('sha256', secret).update(body).digest('hex')

  it('accepts the Cal.com signature for the exact raw payload', () => {
    expect(verifyCalWebhookSignature(body, signature, secret)).toBe(true)
  })

  it('rejects missing, altered, and malformed signatures', () => {
    expect(verifyCalWebhookSignature(body, null, secret)).toBe(false)
    expect(verifyCalWebhookSignature(`${body} `, signature, secret)).toBe(false)
    expect(verifyCalWebhookSignature(body, 'not-a-signature', secret)).toBe(false)
  })
})
