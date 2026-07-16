import { NextRequest, NextResponse } from 'next/server'
import { consumeConnectOnboardingState, getPublicAppUrl, createConnectOnboardingState } from '@/lib/stripe/connect'
import { syncPartnerConnectAccount, createPartnerConnectOnboardingUrl } from '@/lib/sales/connect'
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
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (partnerError || !partner) {
      return commissionsRedirect('error')
    }

    const onboardUrl = await createPartnerConnectOnboardingUrl(partner.id, userId, db)
    return NextResponse.redirect(onboardUrl)
  } catch (error) {
    console.error('[sales/connect/refresh] Failed to refresh onboarding link:', error)
    return commissionsRedirect('error')
  }
}
