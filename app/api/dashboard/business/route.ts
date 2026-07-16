import { NextRequest, NextResponse } from 'next/server'
import { requireInternalDashboardAccess } from '@/lib/dashboard/internal-access'
import { getBusinessDashboardData, getBusinessDashboardFallback } from '@/lib/dashboard/business-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const access = await requireInternalDashboardAccess(req, 'business')
  if ('error' in access) return access.error

  try {
    const data = await getBusinessDashboardData(access.db)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[dashboard/business] degraded fallback', error)
    return NextResponse.json(getBusinessDashboardFallback(error))
  }
}
