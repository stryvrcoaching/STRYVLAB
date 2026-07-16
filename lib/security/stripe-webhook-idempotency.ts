import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

export async function beginStripeWebhookProcessing(db: SupabaseClient, event: Stripe.Event) {
  const inserted = await db
    .from('stripe_webhook_events')
    .insert({
      stripe_event_id: event.id,
      stripe_account_id: event.account ?? null,
      event_type: event.type,
      payload: event,
      processing_status: 'received',
    })

  if (!inserted.error) return true
  if (inserted.error.code !== '23505') throw inserted.error

  const existing = await db
    .from('stripe_webhook_events')
    .select('processing_status')
    .eq('stripe_event_id', event.id)
    .maybeSingle()

  if (existing.error) throw existing.error
  if (existing.data?.processing_status !== 'failed') return false

  const retry = await db
    .from('stripe_webhook_events')
    .update({
      processing_status: 'received',
      processing_error: null,
      processed_at: null,
    })
    .eq('stripe_event_id', event.id)
    .eq('processing_status', 'failed')
    .select('id')
    .maybeSingle()

  if (retry.error) throw retry.error
  return Boolean(retry.data)
}

export async function finishStripeWebhookProcessing(params: {
  db: SupabaseClient
  eventId: string
  status: 'processed' | 'failed'
  processingError?: string
}) {
  const result = await params.db
    .from('stripe_webhook_events')
    .update({
      processing_status: params.status,
      processing_error: params.processingError ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq('stripe_event_id', params.eventId)

  if (result.error) {
    console.error('[stripe-webhook] unable to update event status:', result.error.message)
  }
}
