import { NextRequest, NextResponse } from 'next/server'
import { requireInternalDashboardAccess } from '@/lib/dashboard/internal-access'
import { getOverviewData } from '@/lib/dashboard/overview-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const access = await requireInternalDashboardAccess(req, 'overview')
  if ('error' in access) return access.error

  try {
    const data = await getOverviewData(access.db)
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de charger overview'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
