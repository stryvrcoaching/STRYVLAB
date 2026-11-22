import { describe, expect, it, vi } from 'vitest'
import { resolveClientFromUser } from '@/lib/client/resolve-client'

function builder(result: { data: unknown; error?: unknown }) {
  const query: any = {}
  for (const method of ['select', 'eq', 'neq', 'ilike', 'is', 'update']) {
    query[method] = vi.fn().mockReturnValue(query)
  }
  query.maybeSingle = vi.fn().mockResolvedValue({ data: result.data, error: result.error ?? null })
  return query
}

function serviceWith(...queries: ReturnType<typeof builder>[]) {
  let index = 0
  return { from: vi.fn().mockImplementation(() => queries[index++]) } as any
}

describe('resolveClientFromUser', () => {
  it('keeps a linked client on its own profile', async () => {
    const db = serviceWith(builder({ data: { id: 'client-1', user_id: 'user-1', status: 'active' } }))

    await expect(resolveClientFromUser('user-1', 'client@test.com', db)).resolves.toMatchObject({ id: 'client-1' })
    expect(db.from).toHaveBeenCalledTimes(1)
    expect(db.from.mock.results[0].value.neq).toHaveBeenCalledWith('status', 'suspended')
  })

  it('links exactly one active and unclaimed profile', async () => {
    const db = serviceWith(
      builder({ data: null }),
      builder({ data: { id: 'client-1', user_id: null, status: 'active' } }),
      builder({ data: { id: 'client-1', user_id: 'user-1', status: 'active' } }),
    )

    await expect(resolveClientFromUser('user-1', 'client@test.com', db)).resolves.toMatchObject({ id: 'client-1' })
    const lookup = db.from.mock.results[1].value
    expect(lookup.is).toHaveBeenCalledWith('user_id', null)
    expect(lookup.eq).toHaveBeenCalledWith('status', 'active')
    const update = db.from.mock.results[2].value
    expect(update.is).toHaveBeenCalledWith('user_id', null)
    expect(update.eq).toHaveBeenCalledWith('status', 'active')
  })

  it('does not relink a suspended, claimed, or ambiguous profile', async () => {
    for (const error of ['multiple rows', 'no active unclaimed row']) {
      const db = serviceWith(builder({ data: null }), builder({ data: null, error }))
      await expect(resolveClientFromUser('user-1', 'client@test.com', db)).resolves.toBeNull()
      expect(db.from).toHaveBeenCalledTimes(2)
    }
  })
})
