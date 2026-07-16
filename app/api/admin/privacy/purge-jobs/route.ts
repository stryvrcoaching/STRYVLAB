import { NextRequest, NextResponse } from 'next/server'
import { requireInternalDashboardAccess } from '@/lib/dashboard/internal-access'

export async function GET(request: NextRequest) {
  const access = await requireInternalDashboardAccess(request, 'privacy_purge_jobs')
  if ('error' in access) return access.error

  const { data, error } = await access.db
    .from('account_purge_jobs')
    .select('id, coach_id, status, scheduled_for, attempt_count, legal_hold_reason, last_error, started_at, completed_at, updated_at, manifest')
    .in('status', ['scheduled', 'processing', 'legal_review', 'failed'])
    .order('scheduled_for', { ascending: true })
    .limit(100)

  if (error) {
    console.error('[admin/privacy/purge-jobs] unable to list jobs:', error.message)
    return NextResponse.json({ error: 'Lecture impossible' }, { status: 500 })
  }

  return NextResponse.json(
    {
      jobs: (data ?? []).map((job) => ({
        id: job.id,
        coachId: job.coach_id,
        status: job.status,
        scheduledFor: job.scheduled_for,
        attempts: job.attempt_count,
        legalHoldReason: job.legal_hold_reason,
        lastError: job.last_error,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        updatedAt: job.updated_at,
        externalProviderReview:
          typeof job.manifest === 'object' && job.manifest && 'externalProviderReview' in job.manifest
            ? job.manifest.externalProviderReview
            : [],
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
