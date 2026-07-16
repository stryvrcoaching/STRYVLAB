import { NextResponse } from 'next/server'
import { requireSalesAccess } from '@/lib/sales/access'
import { syncPartnerConnectAccount } from '@/lib/sales/connect'

export const dynamic = 'force-dynamic'

export async function GET() {
  const access = await requireSalesAccess()
  if ('error' in access) return access.error

  try {
    const { data: partner, error: partnerError } = await access.db
      .from('sales_partners')
      .select('stripe_account_id, stripe_account_status')
      .eq('id', access.partner.id)
      .maybeSingle()

    if (partnerError || !partner) {
      return NextResponse.json({ error: 'Partenaire introuvable' }, { status: 404 })
    }

    if (!partner.stripe_account_id) {
      return NextResponse.json({ status: 'not_connected' })
    }

    // Sync status with Stripe
    const accountState = await syncPartnerConnectAccount(access.partner.id, partner.stripe_account_id, access.db)
    return NextResponse.json({
      status: accountState.status,
      requirementsDue: accountState.requirementsDue,
      accountId: partner.stripe_account_id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de lire le statut Stripe.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
