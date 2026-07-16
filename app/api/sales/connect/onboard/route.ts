import { NextResponse } from 'next/server'
import { requireSalesAccess } from '@/lib/sales/access'
import { createPartnerConnectOnboardingUrl } from '@/lib/sales/connect'

export const dynamic = 'force-dynamic'

export async function POST() {
  const access = await requireSalesAccess()
  if ('error' in access) return access.error

  try {
    const url = await createPartnerConnectOnboardingUrl(access.partner.id, access.user.id, access.db)
    return NextResponse.json({ url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connexion Stripe indisponible.'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
