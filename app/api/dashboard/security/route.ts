import { NextRequest, NextResponse } from 'next/server'
import { requireInternalDashboardAccess } from '@/lib/dashboard/internal-access'
import { getSecurityData } from '@/lib/dashboard/security-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const access = await requireInternalDashboardAccess(req, 'security')
  if ('error' in access) return access.error

  try {
    const data = await getSecurityData(access.db)
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de charger security'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
