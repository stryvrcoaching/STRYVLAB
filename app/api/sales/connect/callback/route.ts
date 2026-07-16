import { NextRequest, NextResponse } from 'next/server'
import { consumeConnectOnboardingState, getPublicAppUrl } from '@/lib/stripe/connect'
import { syncPartnerConnectAccount } from '@/lib/sales/connect'
import { createDashboardServiceClient } from '@/lib/dashboard/service'

export const dynamic = 'force-dynamic'

function commissionsRedirect(result: string) {
  const url = new URL('/sales/commissions', getPublicAppUrl())
  url.searchParams.set('stripe_connect', result)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('state')
  if (!state) return commissionsRedirect('invalid')

  try {
    const userId = await consumeConnectOnboardingState(state)
    if (!userId) return commissionsRedirect('expired')

    const db = createDashboardServiceClient()
    const { data: partner, error: partnerError } = await db
      .from('sales_partners')
      .select('id, stripe_account_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (partnerError || !partner || !partner.stripe_account_id) {
      return commissionsRedirect('error')
    }

    const account = await syncPartnerConnectAccount(partner.id, partner.stripe_account_id, db)
    return commissionsRedirect(account.status === 'ready' ? 'ready' : 'pending')
  } catch (error) {
    console.error('[sales/connect/callback] Failed to complete onboarding:', error)
    return commissionsRedirect('error')
  }
}
