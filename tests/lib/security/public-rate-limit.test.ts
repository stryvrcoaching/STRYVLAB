import { describe, expect, it, vi } from 'vitest'
import { checkPublicRateLimit } from '@/lib/security/public-rate-limit'
import { NextRequest } from '../../mocks/next-server'

describe('public API rate limiting', () => {
  it('uses hashed IP and subject buckets', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: [{ allowed: true, retry_after_seconds: 60 }], error: null })
    const db = { rpc } as any
    const req = new NextRequest('https://stryvlab.com/api/public', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    }) as any

    const decision = await checkPublicRateLimit({
      db,
      req,
      scope: 'test_scope',
      subject: 'secret-token',
      maxRequests: 5,
      windowSeconds: 60,
    })

    expect(decision.allowed).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(2)
    for (const [, args] of rpc.mock.calls) {
      expect(args.p_bucket_key).toMatch(/^[a-f0-9]{64}$/)
      expect(args.p_bucket_key).not.toContain('secret-token')
      expect(args.p_bucket_key).not.toContain('203.0.113.10')
    }
  })

  it('fails closed when the database limiter is unavailable', async () => {
    const db = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing function' } }),
    } as any
    const req = new NextRequest('https://stryvlab.com/api/public') as any

    const decision = await checkPublicRateLimit({
      db,
      req,
      scope: 'test_scope',
      maxRequests: 5,
      windowSeconds: 60,
    })

    expect(decision).toEqual({ allowed: false, retryAfterSeconds: 60 })
  })
})
