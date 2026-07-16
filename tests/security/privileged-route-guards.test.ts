import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return routeFiles(path)
    return entry.name === 'route.ts' ? [path] : []
  })
}

describe('privileged payment and administration routes', () => {
  it('require a session, an internal secret, or a verified webhook signature', () => {
    const routeRoot = join(process.cwd(), 'app/api')
    const priorityPath = /\/(admin|dashboard|payments?|subscriptions|stripe|billing|webhooks?)\//
    const guardMarkers = [
      'auth.getUser',
      'requireInternalDashboardAccess',
      'webhooks.constructEvent',
      'stripe-signature',
      'CRON_SECRET',
      'INTERNAL_API_SECRET',
      'isAuthorized',
    ]

    const missingGuard = routeFiles(routeRoot).filter((path) => {
      const normalizedPath = path.replaceAll('\\', '/')
      const source = readFileSync(path, 'utf8')
      if (!priorityPath.test(normalizedPath) || !source.includes('SUPABASE_SERVICE_ROLE_KEY')) return false
      return !guardMarkers.some((marker) => source.includes(marker))
    })

    expect(missingGuard).toEqual([])
  })

  it('keeps active Stripe webhooks signed and idempotent', () => {
    const coaching = readFileSync(
      join(process.cwd(), 'app/api/stripe/coaching/webhook/route.ts'),
      'utf8',
    )
    const platform = readFileSync(
      join(process.cwd(), 'app/api/stripe/coach-platform/webhook/route.ts'),
      'utf8',
    )
    const connect = readFileSync(
      join(process.cwd(), 'app/api/stripe/connect/webhook/route.ts'),
      'utf8',
    )

    expect(coaching).toContain('STRIPE_COACHING_WEBHOOK_SECRET')
    expect(platform).toContain('STRIPE_COACH_PLATFORM_WEBHOOK_SECRET')
    expect(connect).toContain('STRIPE_CONNECT_WEBHOOK_SECRET')
    expect(coaching).toContain('beginStripeWebhookProcessing')
    expect(platform).toContain('beginStripeWebhookProcessing')
    expect(connect).toContain('beginStripeWebhookProcessing')
    expect(coaching).not.toContain('?? process.env.STRIPE_WEBHOOK_SECRET')
    expect(platform).not.toContain('?? process.env.STRIPE_WEBHOOK_SECRET')
  })

  it('keeps retired historical webhooks signed and side-effect free', () => {
    const genesis = readFileSync(
      join(process.cwd(), 'app/api/genesis/stripe/webhook/route.ts'),
      'utf8',
    )
    const generic = readFileSync(join(process.cwd(), 'app/api/stripe/webhook/route.ts'), 'utf8')

    for (const webhook of [genesis, generic]) {
      expect(webhook).toContain('webhooks.constructEvent')
      expect(webhook).toContain('retired: true')
      expect(webhook).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
      expect(webhook).not.toContain('beginStripeWebhookProcessing')
    }
    expect(genesis).not.toContain('payment_transactions')
  })
})
