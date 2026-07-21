import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { runClientEngagementReminders } from '@/lib/inngest/functions/client-engagement-reminders'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function service() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && (
    request.headers.get('authorization') === `Bearer ${secret}`
    || request.headers.get('x-cron-secret') === secret
  )
}

async function run(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runClientEngagementReminders(service())
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    console.error('[cron/client-engagement-reminders] failed')
    return NextResponse.json({ error: 'Unable to send client reminders' }, { status: 500 })
  }
}

export const GET = run
export const POST = run
