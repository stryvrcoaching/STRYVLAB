import { describe, expect, it, vi } from 'vitest'
import {
  beginStripeWebhookProcessing,
  finishStripeWebhookProcessing,
} from '@/lib/security/stripe-webhook-idempotency'

function builder(result: { data?: unknown; error?: any }) {
  const query: any = {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null }),
    error: result.error ?? null,
  }
  query.insert.mockReturnValue(query)
  query.select.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.then = (resolve: (value: unknown) => void) => Promise.resolve({
    data: result.data ?? null,
    error: result.error ?? null,
  }).then(resolve)
  return query
}

function dbWithResults(results: Array<{ data?: unknown; error?: any }>) {
  const queries = results.map(builder)
  let index = 0
  return {
    from: vi.fn(() => queries[index++] ?? queries[queries.length - 1]),
  } as any
}

const event = {
  id: 'evt_123',
  type: 'checkout.session.completed',
  account: null,
  data: { object: {} },
} as any

describe('Stripe webhook idempotency', () => {
  it('processes a new event once', async () => {
    const db = dbWithResults([{ data: null, error: null }])

    await expect(beginStripeWebhookProcessing(db, event)).resolves.toBe(true)
  })

  it('skips an event that was already processed', async () => {
    const db = dbWithResults([
      { error: { code: '23505' } },
      { data: { processing_status: 'processed' } },
    ])

    await expect(beginStripeWebhookProcessing(db, event)).resolves.toBe(false)
  })

  it('allows a previously failed event to retry', async () => {
    const db = dbWithResults([
      { error: { code: '23505' } },
      { data: { processing_status: 'failed' } },
      { data: { id: 'row-1' } },
    ])

    await expect(beginStripeWebhookProcessing(db, event)).resolves.toBe(true)
  })

  it('records final processing status', async () => {
    const db = dbWithResults([{ error: null }])

    await finishStripeWebhookProcessing({ db, eventId: event.id, status: 'processed' })

    expect(db.from).toHaveBeenCalledWith('stripe_webhook_events')
  })
})
