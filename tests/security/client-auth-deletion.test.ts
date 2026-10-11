import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { canDeleteOrphanClientAuthUser } from '@/lib/security/client-auth-deletion'

function makeDb(results: Array<{ data: unknown; error: unknown }>) {
  const calls: Array<{ table: string; column?: string; value?: string }> = []
  const from = vi.fn((table: string) => ({
    select: (_column: string) => ({
      eq: (column: string, value: string) => ({
        limit: async (_limit: number) => {
          calls.push({ table, column, value })
          return results[calls.length - 1] ?? { data: null, error: new Error('Missing mock') }
        },
      }),
    }),
  }))
  return { db: { from } as any, calls }
}

describe('P0-001: linked Auth deletion safety', () => {
  it('never deletes an account without an explicit linked Auth user id', async () => {
    const { db, calls } = makeDb([])
    expect(await canDeleteOrphanClientAuthUser({ db, authUserId: null, requestingCoachId: 'coach-1' })).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('never deletes the coach account', async () => {
    const { db, calls } = makeDb([])
    expect(await canDeleteOrphanClientAuthUser({ db, authUserId: 'coach-1', requestingCoachId: 'coach-1' })).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('retains an account linked to another client', async () => {
    const { db, calls } = makeDb([{ data: [{ user_id: 'user-1' }], error: null }])
    expect(await canDeleteOrphanClientAuthUser({ db, authUserId: 'user-1', requestingCoachId: 'coach-1' })).toBe(false)
    expect(calls).toHaveLength(1)
  })

  it('retains an account used as a coach id', async () => {
    const { db } = makeDb([
      { data: [], error: null },
      { data: [{ coach_id: 'user-1' }], error: null },
    ])
    expect(await canDeleteOrphanClientAuthUser({ db, authUserId: 'user-1', requestingCoachId: 'coach-1' })).toBe(false)
  })

  it('retains an account linked to a coach profile', async () => {
    const { db } = makeDb([
      { data: [], error: null },
      { data: [], error: null },
      { data: [{ coach_id: 'user-1' }], error: null },
    ])
    expect(await canDeleteOrphanClientAuthUser({ db, authUserId: 'user-1', requestingCoachId: 'coach-1' })).toBe(false)
  })

  it('fails closed on lookup errors or ambiguous results', async () => {
    const { db } = makeDb([{ data: null, error: { message: 'DB unavailable' } }])
    expect(await canDeleteOrphanClientAuthUser({ db, authUserId: 'user-1', requestingCoachId: 'coach-1' })).toBe(false)
  })

  it('allows deletion only after all checked references are absent', async () => {
    const { db, calls } = makeDb([
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ])
    expect(await canDeleteOrphanClientAuthUser({ db, authUserId: 'user-1', requestingCoachId: 'coach-1' })).toBe(true)
    expect(calls.map(c => c.table)).toEqual(['coach_clients', 'coach_clients', 'coach_profiles'])
  })

  it('removes the email-based fallback from the destructive client route', () => {
    const source = readFileSync(join(process.cwd(), 'app/api/clients/[clientId]/route.ts'), 'utf8')
    expect(source).not.toContain('auth.admin.listUsers(')
    expect(source).toContain('canDeleteOrphanClientAuthUser(')
  })
})
