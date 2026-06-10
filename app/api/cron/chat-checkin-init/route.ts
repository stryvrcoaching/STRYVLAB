import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { runChatCheckinInitForFlow } from '@/lib/inngest/chatCheckinInitCron'

export const dynamic = 'force-dynamic'

// ─── /api/cron/chat-checkin-init ──────────────────────────────────────────────
// Plain HTTP trigger for the chat morning/evening init, independent of Inngest.
// Call every ~15 min from any scheduler: Inngest, a free external cron
// (cron-job.org, GitHub Actions), or a Vercel Cron (Pro plan only — Hobby is
// daily-max). Each flow is gated to the client's local window (morning 06:00–07:00,
// evening ≈21:00). Idempotent: a same-day init already present is skipped.
// Protected by CRON_SECRET (sent as "Authorization: Bearer <secret>" or "x-cron-secret").

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // no secret configured — allow (obscure path, fallback)
  const bearer = req.headers.get('authorization') // Vercel Cron native: "Bearer <CRON_SECRET>"
  const custom = req.headers.get('x-cron-secret') // project convention
  return bearer === `Bearer ${secret}` || custom === secret
}

async function run(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = serviceClient()
  try {
    const [morning, evening] = await Promise.all([
      runChatCheckinInitForFlow(db, 'morning', 6, 30),
      runChatCheckinInitForFlow(db, 'evening', 21, 0),
    ])
    return NextResponse.json({ morning, evening })
  } catch (e) {
    console.error('[cron/chat-checkin-init]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// Vercel Cron triggers GET; POST kept for manual/external invocation.
export const GET = run
export const POST = run
