import Stripe from 'stripe'

// Singleton Stripe server client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
})

// Billing cycle → Stripe interval mapping
export const BILLING_TO_STRIPE: Record<string, { interval: Stripe.PriceCreateParams.Recurring.Interval; interval_count: number }> = {
  weekly:    { interval: 'week',  interval_count: 1 },
  monthly:   { interval: 'month', interval_count: 1 },
  quarterly: { interval: 'month', interval_count: 3 },
  yearly:    { interval: 'year',  interval_count: 1 },
}
