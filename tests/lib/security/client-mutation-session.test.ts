import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const auth = vi.hoisted(() => ({ userId: 'user-a' as string | null }))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({
  auth: { getUser: async () => ({ data: { user: auth.userId ? { id: auth.userId } : null } }) },
  from: (table: string) => ({
    select() { return this }, eq() { return this },
    maybeSingle: async () => ({ data: table === 'coach_profiles'
      ? { plan: 'pro', billing_status: 'active' }
      : { status: 'active', coach_id: 'coach-a' } }),
  }),
}) }))
vi.mock('next/server', async () => {
  const { NextRequest, NextResponse } = await import('../../mocks/next-server')
  return { NextRequest, NextResponse: Object.assign(NextResponse, {
    next: () => Object.assign(new Response(), { cookies: { set() {} } }),
  }) }
})
import { updateSession } from '@/utils/supabase/middleware'

beforeEach(() => { auth.userId = 'user-a' })
describe('offline replay session guard', () => {
  it.each([
    ['user-a', 'user-a', 200],
    ['user-a', 'user-b', 409],
    ['user-a', null, 200],
    [null, 'user-a', 401],
  ])('validates the replay owner for session %s and owner %s', async (sessionId, owner, status) => {
    auth.userId = sessionId
    const response = await updateSession(new NextRequest('https://stryvlab.com/api/client/water', {
      method: 'POST', headers: owner ? { 'X-Client-User-Id': owner } : {},
    }))
    expect(response.status).toBe(status)
  })
})
