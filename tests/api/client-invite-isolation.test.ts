import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMocks } from '../mocks/supabase'
import { NextRequest } from '../mocks/next-server'

const mocks = createSupabaseMocks()
vi.mock('@/utils/supabase/server', () => ({ createClient: () => mocks.serverMock }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.serviceMock }))
vi.mock('@/lib/billing/getCoachPlan', () => ({ getCoachPlan: vi.fn().mockResolvedValue({ plan: 'pro' }) }))
vi.mock('@/lib/billing/assertClientAppEnabled', () => ({ isClientAppEnabledForPlanState: () => true }))
vi.mock('@/lib/email/mailer', () => ({
  sendInvitationEmail: vi.fn(),
  sendReactivationEmail: vi.fn(),
  sendAccessLinkEmail: vi.fn(),
}))

import { POST } from '@/app/api/clients/[clientId]/invite/route'
import { sendInvitationEmail } from '@/lib/email/mailer'

beforeEach(() => mocks.resetMocks())

describe('client invitation identity isolation', () => {
  it('rejects an account already linked to another client profile', async () => {
    mocks.setServiceResults([
      { data: { id: 'client-1', email: 'shared@test.com', status: 'active', date_of_birth: null } },
      { data: { id: 'client-2' } },
    ])
    mocks.serviceMock.rpc.mockResolvedValue({ data: 'shared-user', error: null })
    mocks.serviceMock.auth.admin.getUserById.mockResolvedValue({
      data: { user: { id: 'shared-user', email: 'shared@test.com' } },
      error: null,
    })

    const response = await POST(
      new NextRequest('http://localhost/api/clients/client-1/invite', { method: 'POST' }) as any,
      { params: { clientId: 'client-1' } },
    )

    expect(response.status).toBe(409)
    expect(mocks.serviceMock.rpc).toHaveBeenCalledWith('find_auth_user_id_by_email', { p_email: 'shared@test.com' })
    expect(sendInvitationEmail).not.toHaveBeenCalled()
  })
})
