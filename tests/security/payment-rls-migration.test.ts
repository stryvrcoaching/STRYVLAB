import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('payment RLS lockdown migration', () => {
  it('removes anonymous payment access and isolates webhook events', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260715184000_payment_rls_and_webhook_lockdown.sql'),
      'utf8',
    )
    const tables = [
      'coach_formulas',
      'client_subscriptions',
      'subscription_payments',
      'coach_invoices',
      'stripe_webhook_events',
    ]

    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`)
      expect(sql).toContain(`REVOKE ALL ON TABLE public.${table} FROM anon;`)
    }

    expect(sql).toContain('REVOKE ALL ON TABLE public.stripe_webhook_events FROM authenticated;')
    expect(sql).toContain('TO authenticated')
    expect(sql).not.toContain('TO public')
  })
})
