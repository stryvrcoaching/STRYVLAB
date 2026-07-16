import { describe, expect, it, vi } from 'vitest'
import { coachOwnsClient, resolveClientResourceAccess } from '@/lib/security/client-resource-access'

function dbWithClient(client: unknown, error: unknown = null) {
  const builder: any = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: client, error }),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)

  return {
    from: vi.fn().mockReturnValue(builder),
  } as any
}

describe('client resource access', () => {
  it('allows the owning coach', async () => {
    const clientId = '123e4567-e89b-12d3-a456-426614174000'
    const db = dbWithClient({ id: clientId, coach_id: 'coach-1', user_id: 'user-1' })

    await expect(resolveClientResourceAccess({
      db,
      userId: 'coach-1',
      clientId,
    })).resolves.toEqual({ clientId, role: 'coach' })
  })

  it('allows the linked client account', async () => {
    const clientId = '123e4567-e89b-12d3-a456-426614174000'
    const db = dbWithClient({ id: clientId, coach_id: 'coach-1', user_id: 'user-1' })

    await expect(resolveClientResourceAccess({
      db,
      userId: 'user-1',
      clientId,
    })).resolves.toEqual({ clientId, role: 'client' })
  })

  it('denies another coach or client', async () => {
    const clientId = '123e4567-e89b-12d3-a456-426614174000'
    const db = dbWithClient({ id: clientId, coach_id: 'coach-1', user_id: 'user-1' })

    await expect(resolveClientResourceAccess({
      db,
      userId: 'foreign-user',
      clientId,
    })).resolves.toBeNull()
    await expect(coachOwnsClient({
      db,
      coachUserId: 'foreign-coach',
      clientId,
    })).resolves.toBe(false)
  })

  it('rejects malformed client identifiers without querying the database', async () => {
    const db = dbWithClient(null)

    await expect(resolveClientResourceAccess({
      db,
      userId: 'coach-1',
      clientId: '../foreign-client',
    })).resolves.toBeNull()
    expect(db.from).not.toHaveBeenCalled()
  })
})
