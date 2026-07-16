import { NextResponse } from 'next/server'
import { requireSalesAccess } from '@/lib/sales/access'

export async function GET() {
  const access = await requireSalesAccess()
  if ('error' in access) return access.error

  const { data, error } = await access.db
    .from('sales_commissions')
    .select('id, amount_eur, status, description, eligible_at, approved_at, paid_at, created_at')
    .eq('sales_partner_id', access.partner.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Chargement impossible' }, { status: 500 })
  return NextResponse.json({ commissions: data ?? [] })
}
