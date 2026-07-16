import { NextRequest, NextResponse } from 'next/server'
import { requireInternalDashboardAccess } from '@/lib/dashboard/internal-access'
import { getSystemHealthData } from '@/lib/dashboard/system-health-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const access = await requireInternalDashboardAccess(req, 'system_health')
  if ('error' in access) return access.error

  try {
    const data = await getSystemHealthData(access.db)
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de charger system health'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
