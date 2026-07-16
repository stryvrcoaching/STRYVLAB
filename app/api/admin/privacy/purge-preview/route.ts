import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireInternalDashboardAccess } from '@/lib/dashboard/internal-access'
import { previewCoachAccountPurge } from '@/lib/privacy/account-purge'

export const runtime = 'nodejs'
export const maxDuration = 60

const querySchema = z.object({
  coachId: z.string().uuid(),
})

export async function GET(request: NextRequest) {
  const access = await requireInternalDashboardAccess(request, 'privacy_purge_preview')
  if ('error' in access) return access.error

  const parsed = querySchema.safeParse({
    coachId: request.nextUrl.searchParams.get('coachId'),
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'coachId invalide' }, { status: 400 })
  }

  try {
    const preview = await previewCoachAccountPurge(access.db, parsed.data.coachId)
    return NextResponse.json(
      { preview },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[admin/privacy/purge-preview] preview failed:', error)
    return NextResponse.json({ error: 'Aperçu impossible' }, { status: 500 })
  }
}
