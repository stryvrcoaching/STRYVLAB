import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// ─── POST /api/cron/expire-subscriptions ──────────────────────────────────────
// Called by Vercel Cron nightly.
// Expires subscriptions with end_date < today and deactivates clients
// with no remaining active subscriptions.
// Protected by CRON_SECRET header.

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceClient()
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // Find all active subscriptions with expired end_date
  const { data: expiredSubs, error: fetchError } = await db
    .from('client_subscriptions')
    .select('id, client_id')
    .eq('status', 'active')
    .not('end_date', 'is', null)
    .lt('end_date', today)

  if (fetchError) {
    console.error('[cron/expire-subscriptions] fetch error:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!expiredSubs || expiredSubs.length === 0) {
    return NextResponse.json({ processed: 0, deactivated: 0 })
  }

  const subIds = expiredSubs.map(s => s.id)
  const uniqueClientIds = new Set(expiredSubs.map(s => s.client_id))
  const clientIds = Array.from(uniqueClientIds)

  // Update expired subscriptions to 'expired' status
  const { error: subError } = await db
    .from('client_subscriptions')
    .update({ status: 'expired' })
    .in('id', subIds)

  if (subError) {
    console.error('[cron/expire-subscriptions] subscription update error:', subError)
    return NextResponse.json({ error: subError.message }, { status: 500 })
  }

  // Deactivate clients that have NO remaining active subscriptions
  const inactiveClientIds: string[] = []

  for (const clientId of clientIds) {
    const { count } = await db
      .from('client_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'active')

    if (count === 0) {
      inactiveClientIds.push(clientId)
    }
  }

  if (inactiveClientIds.length > 0) {
    // Set client status to 'inactive'
    const { error: clientError } = await db
      .from('coach_clients')
      .update({ status: 'inactive' })
      .in('id', inactiveClientIds)

    if (clientError) {
      console.error('[cron/expire-subscriptions] client update error:', clientError)
      return NextResponse.json({ error: clientError.message }, { status: 500 })
    }

    // Revoke access tokens for deactivated clients
    const { error: tokenError } = await db
      .from('client_access_tokens')
      .update({ revoked: true })
      .in('client_id', inactiveClientIds)

    if (tokenError) {
      console.error('[cron/expire-subscriptions] token revoke error:', tokenError)
      return NextResponse.json({ error: tokenError.message }, { status: 500 })
    }
  }

  console.log(`[cron/expire-subscriptions] processed ${subIds.length} subscriptions, deactivated ${inactiveClientIds.length} clients`)

  return NextResponse.json({
    processed: subIds.length,
    deactivated: inactiveClientIds.length,
  })
}
