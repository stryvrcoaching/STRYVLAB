import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { getStripePriceIdForPlan } from '@/lib/billing/stripeCoachPlatform'
import { stripe } from '@/lib/stripe/client'
import type { CoachPlan } from '@/lib/billing/plans'

export const dynamic = 'force-dynamic'

const plans: CoachPlan[] = ['solo', 'pro', 'studio']

export async function GET() {
  const supabase = createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const prices = await Promise.all(
    plans.map(async (plan) => {
      const priceId = getStripePriceIdForPlan(plan)
      if (!priceId) return [plan, null] as const

      try {
        const price = await stripe.prices.retrieve(priceId)
        if (!price.active || price.unit_amount === null) return [plan, null] as const

        return [plan, {
          amount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring?.interval ?? null,
          intervalCount: price.recurring?.interval_count ?? null,
        }] as const
      } catch (error) {
        console.error('[coach-platform-plans] Stripe price unavailable', { plan, error })
        return [plan, null] as const
      }
    }),
  )

  return NextResponse.json({ prices: Object.fromEntries(prices) })
}
