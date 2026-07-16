import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from '../mocks/next-server'

const mocks = vi.hoisted(() => ({ requireInternalDashboardAccess: vi.fn() }))

vi.mock('@/lib/dashboard/internal-access', () => ({
  requireInternalDashboardAccess: mocks.requireInternalDashboardAccess,
}))

import { GET } from '@/app/api/genesis/admin/stats/route'

describe('Genesis admin statistics', () => {
  it('requires internal dashboard access', async () => {
    mocks.requireInternalDashboardAccess.mockResolvedValue({
      error: new Response(JSON.stringify({ error: 'Accès refusé' }), { status: 403 }),
    })
    const request = new NextRequest('https://stryvlab.com/api/genesis/admin/stats') as any
    const response = await GET(request)

    expect(response.status).toBe(403)
    expect(mocks.requireInternalDashboardAccess).toHaveBeenCalledWith(request, 'genesis_stats')
  })
})
