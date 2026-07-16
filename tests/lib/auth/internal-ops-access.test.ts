import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveInternalOpsAccess } from '@/lib/auth/internal-ops-access'

const ORIGINAL_OPS_IDS = process.env.INTERNAL_OPS_USER_IDS
const ORIGINAL_OPS_EMAILS = process.env.INTERNAL_OPS_EMAILS
const ORIGINAL_SHARED_IDS = process.env.INTERNAL_PRODUCT_FEEDBACK_USER_IDS

function restoreEnv() {
  vi.unstubAllEnvs()
  if (ORIGINAL_OPS_IDS === undefined) delete process.env.INTERNAL_OPS_USER_IDS
  else process.env.INTERNAL_OPS_USER_IDS = ORIGINAL_OPS_IDS
  if (ORIGINAL_OPS_EMAILS === undefined) delete process.env.INTERNAL_OPS_EMAILS
  else process.env.INTERNAL_OPS_EMAILS = ORIGINAL_OPS_EMAILS
  if (ORIGINAL_SHARED_IDS === undefined) delete process.env.INTERNAL_PRODUCT_FEEDBACK_USER_IDS
  else process.env.INTERNAL_PRODUCT_FEEDBACK_USER_IDS = ORIGINAL_SHARED_IDS
}

afterEach(restoreEnv)

describe('resolveInternalOpsAccess', () => {
  it('refuses access when no internal allowlist exists', async () => {
    vi.stubEnv('INTERNAL_OPS_USER_IDS', '')
    vi.stubEnv('INTERNAL_OPS_EMAILS', '')
    vi.stubEnv('INTERNAL_PRODUCT_FEEDBACK_USER_IDS', '')

    await expect(resolveInternalOpsAccess({ userId: 'coach-id', email: 'coach@example.com' }))
      .resolves.toEqual({ allowed: false, mode: 'unset' })
  })

  it('allows only explicit internal ops accounts', async () => {
    vi.stubEnv('INTERNAL_OPS_USER_IDS', 'admin-id,dev-id')
    vi.stubEnv('INTERNAL_OPS_EMAILS', 'admin@example.com')
    vi.stubEnv('INTERNAL_PRODUCT_FEEDBACK_USER_IDS', '')

    await expect(resolveInternalOpsAccess({ userId: 'dev-id', email: 'other@example.com' }))
      .resolves.toEqual({ allowed: true, mode: 'ops_allowlist' })
    await expect(resolveInternalOpsAccess({ userId: 'coach-id', email: 'admin@example.com' }))
      .resolves.toEqual({ allowed: true, mode: 'ops_allowlist' })
    await expect(resolveInternalOpsAccess({ userId: 'coach-id', email: 'coach@example.com' }))
      .resolves.toEqual({ allowed: false, mode: 'ops_allowlist' })
  })

  it('reuses the existing internal dashboard allowlist as a safe fallback', async () => {
    vi.stubEnv('INTERNAL_OPS_USER_IDS', '')
    vi.stubEnv('INTERNAL_OPS_EMAILS', '')
    vi.stubEnv('INTERNAL_PRODUCT_FEEDBACK_USER_IDS', 'admin-id')

    await expect(resolveInternalOpsAccess({ userId: 'admin-id' }))
      .resolves.toEqual({ allowed: true, mode: 'legacy_uuid_allowlist' })
    await expect(resolveInternalOpsAccess({ userId: 'coach-id' }))
      .resolves.toEqual({ allowed: false, mode: 'legacy_uuid_allowlist' })
  })
})
