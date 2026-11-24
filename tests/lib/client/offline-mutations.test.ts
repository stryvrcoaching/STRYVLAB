import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ userId: 'user-a' as string | null }))
vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({ auth: {
    getSession: async () => ({ data: { session: auth.userId ? { user: { id: auth.userId } } : null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  } }),
}))

import { flushOfflineMutations, getPendingOfflineMutationCount, sendClientMutation } from '@/lib/client/offline-mutations'

const queueKey = (id: string) => `stryv:offline-mutations:v2:${id}`
const queued = { id: 'saved-a', kind: 'water', url: '/api/client/water', method: 'POST', body: '{"ml":250}', createdAt: '2026-11-24T12:00:00Z' }
let storage: Map<string, string>
let online: boolean
let fetcher: ReturnType<typeof vi.fn>

beforeEach(() => {
  auth.userId = 'user-a'
  online = true
  storage = new Map()
  const target = new EventTarget()
  vi.stubGlobal('window', Object.assign(target, { localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  } }))
  vi.stubGlobal('navigator', { get onLine() { return online } })
  vi.stubGlobal('CustomEvent', class extends Event { constructor(type: string) { super(type) } })
  fetcher = vi.fn(async () => new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetcher)
})
afterEach(() => vi.unstubAllGlobals())

describe('offline mutation identity', () => {
  it('keeps client A actions out of client B queue and requests', async () => {
    online = false
    await sendClientMutation({ kind: 'water', url: '/api/client/water', method: 'POST', body: { ml: 250 } })
    auth.userId = 'user-b'
    online = true
    expect(await getPendingOfflineMutationCount()).toBe(0)
    expect(await flushOfflineMutations()).toEqual({ synced: 0, pending: 0 })
    expect(fetcher).not.toHaveBeenCalled()
    expect(JSON.parse(storage.get(queueKey('user-a'))!)).toHaveLength(1)
  })

  it('replays actions under the original account with a server checked identity', async () => {
    storage.set(queueKey('user-a'), JSON.stringify([queued]))
    expect(await flushOfflineMutations()).toEqual({ synced: 1, pending: 0 })
    expect(fetcher).toHaveBeenCalledWith('/api/client/water', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Client-User-Id': 'user-a' }),
    }))
    expect(await getPendingOfflineMutationCount()).toBe(0)
  })

  it('preserves legacy actions without attributing them to the current user', async () => {
    const legacy = JSON.stringify([queued])
    storage.set('stryv:offline-mutations:v1', legacy)
    expect(await flushOfflineMutations()).toEqual({ synced: 0, pending: 0 })
    expect(fetcher).not.toHaveBeenCalled()
    expect(storage.get('stryv:offline-mutations:v1')).toBe(legacy)
  })

  it('does not replay without a session', async () => {
    auth.userId = null
    storage.set(queueKey('user-a'), JSON.stringify([queued]))
    expect(await flushOfflineMutations()).toEqual({ synced: 0, pending: 0 })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('retains a rejected action for a later retry', async () => {
    storage.set(queueKey('user-a'), JSON.stringify([queued]))
    fetcher.mockResolvedValueOnce(new Response('{}', { status: 409 }))
    expect(await flushOfflineMutations()).toEqual({ synced: 0, pending: 1 })
  })

  it('preserves actions appended during a replay', async () => {
    storage.set(queueKey('user-a'), JSON.stringify([queued]))
    fetcher.mockImplementationOnce(async () => {
      storage.set(queueKey('user-a'), JSON.stringify([queued, { ...queued, id: 'added-later' }]))
      return new Response('{}')
    })
    expect(await flushOfflineMutations()).toEqual({ synced: 1, pending: 1 })
    expect(JSON.parse(storage.get(queueKey('user-a'))!)[0].id).toBe('added-later')
  })

  it('serializes overlapping replay attempts', async () => {
    storage.set(queueKey('user-a'), JSON.stringify([queued]))
    await Promise.all([flushOfflineMutations(), flushOfflineMutations()])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('stops a replay when the account changes', async () => {
    storage.set(queueKey('user-a'), JSON.stringify([queued, { ...queued, id: 'second' }]))
    fetcher.mockImplementationOnce(async () => { auth.userId = 'user-b'; return new Response('{}') })
    await flushOfflineMutations()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(JSON.parse(storage.get(queueKey('user-a'))!)).toHaveLength(1)
  })
})
