import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { runGenerateSubscriptionDues } from '@/lib/payments/generate-subscription-dues'

// ─── /api/cron/generate-payment-dues ──────────────────────────────────────────
// Daily job: for active/trial subscriptions, create pending payments from
// next_billing_date (within lead window) and advance the billing cursor.
// Runs before payment-reminders so new dues can be reminded the same day.

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function isAuthorizedCronRequest(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (
    req.headers.get('authorization') === `Bearer ${secret}` ||
    req.headers.get('x-cron-secret') === secret
  )
}

async function run(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runGenerateSubscriptionDues(serviceClient(), {
      leadDays: 7,
      maxPeriodsPerSub: 3,
    })
    console.log('[cron/generate-payment-dues]', result)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron/generate-payment-dues]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  return run(req)
}

export async function POST(req: NextRequest) {
  return run(req)
}
