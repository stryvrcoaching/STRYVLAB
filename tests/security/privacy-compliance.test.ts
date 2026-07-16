import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('privacy compliance foundations', () => {
  it('keeps privacy requests service-role only and deadline tracked', () => {
    const migration = source('supabase/migrations/20260715185000_privacy_requests.sql')

    expect(migration).toContain('ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('REVOKE ALL ON TABLE public.privacy_requests FROM anon')
    expect(migration).toContain('REVOKE ALL ON TABLE public.privacy_requests FROM authenticated')
    expect(migration).toContain("now() + interval '1 month'")
    expect(migration).toContain('privacy_requests_one_open_type_per_user_idx')
  })

  it('submits account erasure through the tracked privacy workflow', () => {
    const settings = source('app/coach/settings/page.tsx')

    expect(settings).toContain('fetch("/api/privacy/requests"')
    expect(settings).toContain('requestType: "erasure"')
    expect(settings).not.toContain('window.location.href = "/?deleted=1"')
  })

  it('does not persist attribution before an analytics choice', () => {
    const banner = source('components/analytics/AnalyticsConsentBanner.tsx')
    const effect = banner.slice(banner.indexOf('useEffect'), banner.indexOf('if (!visible)'))

    expect(effect).toContain('readAnalyticsConsent()')
    expect(effect).not.toContain('syncAttributionFromLocation()')
  })

  it('removes unsupported claims and historical public prices', () => {
    const privacy = source('app/confidentialite/page.tsx')
    const terms = source('app/cgv/page.tsx')
    const legal = source('app/mentions-legales/page.tsx')

    expect(privacy).not.toContain('RGPD Compliant')
    expect(terms).not.toMatch(/35€|250€|800€|99%/)
    expect(legal).not.toContain('Serveurs de déploiement : Union Européenne')
    expect(legal).not.toContain('PCI-DSS Level 1, RGPD')
  })

  it('keeps Genesis aligned with the confirmed B2B offers', () => {
    const action = source('app/_actions/genesis.ts')
    const route = source('app/api/genesis-chat/route.ts')

    for (const content of [action, route]) {
      expect(content).toContain('Solo 29 €/mois')
      expect(content).toContain('Pro 79 €/mois')
      expect(content).toContain('Studio 129 €/mois')
      expect(content).not.toMatch(/IPT™ \(35€\)|PROTOCOLE G\+ \(175€\)|OMNI Hybrid \(800€\)/)
    }
    expect(route).toContain('checkDistributedRateLimit')
  })

  it('redirects every historical B2C checkout page', () => {
    expect(source('app/checkout/layout.tsx')).toContain("redirect('/cgv')")
    expect(source('app/checkout-success/layout.tsx')).toContain("redirect('/cgv')")
  })

  it('records minor authorization evidence before client invitation', () => {
    const migration = source('supabase/migrations/20260715190000_minor_guardian_and_retention.sql')
    const inviteRoute = source('app/api/clients/[clientId]/invite/route.ts')

    expect(migration).toContain('minor_authorization_confirmed_at')
    expect(migration).toContain('minor_authorization_confirmed_by')
    expect(inviteRoute).toContain('hasValidMinorAuthorization(client)')
  })

  it('enforces a post-cancellation export window', () => {
    const migration = source('supabase/migrations/20260715190000_minor_guardian_and_retention.sql')
    const webhook = source('app/api/stripe/coach-platform/webhook/route.ts')
    const middleware = source('utils/supabase/middleware.ts')
    const exportRoute = source('app/api/privacy/export/route.ts')

    expect(migration).toContain('data_export_available_until')
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE public.coach_profiles')
    expect(webhook).toContain('createPostCancellationWindow')
    expect(middleware).toContain("accessMode !== 'active'")
    expect(exportRoute).toContain('Content-Disposition')
    expect(exportRoute).not.toContain('secure_link_token_hash:')
  })

  it('queues idempotent account purges and preserves financial records for review', () => {
    const migration = source('supabase/migrations/20260716100000_account_purge_jobs.sql')
    const purge = source('lib/privacy/account-purge.ts')
    const cron = source('app/api/cron/account-purge/route.ts')
    const admin = source('app/api/admin/privacy/purge-jobs/route.ts')
    const preview = source('app/api/admin/privacy/purge-preview/route.ts')
    const vercel = source('vercel.json')

    expect(migration).toContain('FOR UPDATE SKIP LOCKED')
    expect(migration).toContain("status IN ('scheduled', 'processing', 'legal_review', 'completed', 'failed', 'canceled')")
    expect(migration).toContain('REVOKE ALL ON TABLE public.account_purge_jobs FROM anon, authenticated')
    expect(purge).toContain('financial_records_present')
    expect(purge).toContain('db.auth.admin.deleteUser(job.coach_id)')
    expect(purge).toContain('deleteOrphanClientAuthUsers')
    expect(purge).toContain(".eq('user_id', userId)")
    expect(purge).toContain("externalProviderReview: ['Stripe', 'Resend', 'Vercel', 'Supabase backups']")
    expect(cron).toContain('claim_due_account_purge_jobs')
    expect(cron).toContain("process.env.ACCOUNT_PURGE_ENABLED !== 'true'")
    expect(admin).toContain("requireInternalDashboardAccess(request, 'privacy_purge_jobs')")
    expect(preview).toContain("requireInternalDashboardAccess(request, 'privacy_purge_preview')")
    expect(preview).toContain('previewCoachAccountPurge')
    expect(vercel).toContain('/api/cron/account-purge')
  })
})
