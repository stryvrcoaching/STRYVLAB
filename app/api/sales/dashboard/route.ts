import { NextResponse } from 'next/server'
import { requireSalesAccess } from '@/lib/sales/access'
import { getSalesDashboardData } from '@/lib/sales/dashboard-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  const access = await requireSalesAccess()
  if ('error' in access) return access.error

  try {
    const data = await getSalesDashboardData(access.db, access.partner.id)
    return NextResponse.json({
      ...data,
      partnerId: access.partner.id,
    })
  } catch (error) {
    console.error('[sales/dashboard] failed', error)
    return NextResponse.json({ error: 'Chargement impossible' }, { status: 500 })
  }
}
