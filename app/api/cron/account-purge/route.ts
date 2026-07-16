import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { purgeCoachAccount, type AccountPurgeJob } from '@/lib/privacy/account-purge'

export const runtime = 'nodejs'
export const maxDuration = 300

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && (
    request.headers.get('authorization') === `Bearer ${secret}` ||
    request.headers.get('x-cron-secret') === secret
  )
}

async function recordAttention(
  db: ReturnType<typeof serviceClient>,
  job: AccountPurgeJob,
  status: 'legal_review' | 'failed',
  reason: string,
) {
  const incident = await db.from('security_incidents').insert({
    source: 'cron',
    severity: status === 'failed' ? 'high' : 'medium',
    status: 'open',
    title: status === 'failed' ? 'Échec de purge de compte' : 'Purge soumise à revue légale',
    description: reason.slice(0, 1000),
    dedupe_key: `account_purge:${job.id}:${status}`,
    route: '/api/cron/account-purge',
    meta: { purge_job_id: job.id, coach_id: job.coach_id },
  })

  if (incident.error && incident.error.code !== '23505') {
    console.error('[cron/account-purge] unable to record attention incident:', incident.error.message)
  }
}

async function resolveAttentionIncidents(db: ReturnType<typeof serviceClient>, jobId: string) {
  const { error } = await db.from('security_incidents').update({
    status: 'resolved',
    resolved_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  }).in('dedupe_key', [
    `account_purge:${jobId}:legal_review`,
    `account_purge:${jobId}:failed`,
  ]).in('status', ['open', 'investigating'])

  if (error) {
    console.error('[cron/account-purge] unable to resolve attention incident:', error.message)
  }
}

async function run(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (process.env.ACCOUNT_PURGE_ENABLED !== 'true') {
    return NextResponse.json(
      { enabled: false, claimed: 0, completed: 0, legalReview: 0, failed: 0, results: [] },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const db = serviceClient()
  const { data, error } = await db.rpc('claim_due_account_purge_jobs', { batch_size: 5 })
  if (error) {
    console.error('[cron/account-purge] unable to claim jobs:', error.message)
    return NextResponse.json({ error: 'Unable to claim purge jobs' }, { status: 500 })
  }

  const results: Array<Record<string, unknown>> = []
  for (const job of (data ?? []) as AccountPurgeJob[]) {
    try {
      const outcome = await purgeCoachAccount(db, job)
      results.push({ jobId: job.id, ...outcome })
      if (outcome.status === 'legal_review') {
        await recordAttention(db, job, 'legal_review', outcome.reason)
      } else if (outcome.status === 'completed' || outcome.status === 'canceled') {
        await resolveAttentionIncidents(db, job.id)
      }
    } catch (purgeError) {
      const message = purgeError instanceof Error ? purgeError.message : 'Unknown purge error'
      const retryDelayHours = Math.min(24, 2 ** Math.max(1, job.attempt_count))
      const nextAttemptAt = new Date(Date.now() + retryDelayHours * 60 * 60 * 1000).toISOString()

      console.error('[cron/account-purge] purge failed:', { jobId: job.id, message })
      await db.from('account_purge_jobs').update({
        status: 'failed',
        last_error: message.slice(0, 1000),
        next_attempt_at: nextAttemptAt,
        updated_at: new Date().toISOString(),
      }).eq('id', job.id)
      await recordAttention(db, job, 'failed', message)
      results.push({ jobId: job.id, status: 'failed' })
    }
  }

  return NextResponse.json(
    {
      enabled: true,
      claimed: (data ?? []).length,
      completed: results.filter((result) => result.status === 'completed').length,
      legalReview: results.filter((result) => result.status === 'legal_review').length,
      failed: results.filter((result) => result.status === 'failed').length,
      results,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function GET(request: NextRequest) {
  return run(request)
}

export async function POST(request: NextRequest) {
  return run(request)
}
