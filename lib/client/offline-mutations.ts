'use client'

import { readLocalStorage, writeLocalStorage } from '@/lib/client/browserStorage'
import { emitClientInboxUpdated } from '@/lib/client/inboxEvents'
import { NUTRITION_LIVE_EVENT } from '@/lib/client/nutrition-live'
import { createClient } from '@/utils/supabase/client'
import { z } from 'zod'

// Legacy v1 actions have no owner and remain untouched for manual recovery.
const OFFLINE_MUTATIONS_KEY = 'stryv:offline-mutations:v2:'
const OFFLINE_MUTATIONS_EVENT = 'stryv:offline-mutations-updated'
const MAX_PENDING_MUTATIONS = 50

export type OfflineMutationKind = 'meal' | 'water' | 'notification' | 'prep'

const mutationSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['meal', 'water', 'notification', 'prep']),
  url: z.string().startsWith('/api/client/'),
  method: z.enum(['POST', 'PATCH']),
  body: z.string().optional(),
  createdAt: z.string(),
})
const queueSchema = z.array(mutationSchema).max(MAX_PENDING_MUTATIONS)
type OfflineMutation = z.infer<typeof mutationSchema>
type SyncResult = { synced: number; pending: number }
const activeSyncs = new Map<string, Promise<SyncResult>>()

export type ClientMutationResult = {
  queued: boolean
  response?: Response
}

function isBrowser() {
  return typeof window !== 'undefined'
}

function emitUpdate() {
  if (!isBrowser()) return
  window.dispatchEvent(new CustomEvent(OFFLINE_MUTATIONS_EVENT))
}

async function currentUserId(): Promise<string | null> {
  if (!isBrowser()) return null
  try {
    const { data, error } = await createClient().auth.getSession()
    return error ? null : data.session?.user.id ?? null
  } catch {
    return null
  }
}

function readQueue(userId: string): OfflineMutation[] {
  const raw = readLocalStorage(OFFLINE_MUTATIONS_KEY + userId)
  if (!raw) return []

  try {
    const parsed = queueSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function writeQueue(userId: string, queue: OfflineMutation[]) {
  const saved = writeLocalStorage(OFFLINE_MUTATIONS_KEY + userId, JSON.stringify(queue.slice(-MAX_PENDING_MUTATIONS)))
  if (!saved) throw new Error('Impossible de conserver cette saisie sur cet appareil.')
  emitUpdate()
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function queueMutation(userId: string, input: Omit<OfflineMutation, 'id' | 'createdAt'>) {
  writeQueue(userId, [
    ...readQueue(userId),
    {
      ...input,
      id: createId(),
      createdAt: new Date().toISOString(),
    },
  ])
}

export async function getPendingOfflineMutationCount() {
  const userId = await currentUserId()
  return userId ? readQueue(userId).length : 0
}

export function subscribeToOfflineMutations(listener: () => void) {
  if (!isBrowser()) return () => {}
  window.addEventListener(OFFLINE_MUTATIONS_EVENT, listener)
  window.addEventListener('storage', listener)
  const { data } = createClient().auth.onAuthStateChange(() => { listener() })
  return () => {
    window.removeEventListener(OFFLINE_MUTATIONS_EVENT, listener)
    window.removeEventListener('storage', listener)
    data.subscription.unsubscribe()
  }
}

export async function sendClientMutation({
  kind,
  url,
  method,
  body,
}: {
  kind: OfflineMutationKind
  url: string
  method: 'POST' | 'PATCH'
  body?: unknown
}): Promise<ClientMutationResult> {
  const serializedBody = body === undefined ? undefined : JSON.stringify(body)
  const userId = await currentUserId()
  if (!userId) throw new Error('Reconnectez-vous pour enregistrer cette saisie.')

  if (isBrowser() && navigator.onLine === false) {
    queueMutation(userId, { kind, url, method, body: serializedBody })
    return { queued: true }
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'X-Client-User-Id': userId,
        ...(serializedBody ? { 'Content-Type': 'application/json' } : {}),
      },
      body: serializedBody,
    })

    if (response.status === 503 && isBrowser() && navigator.onLine === false) {
      queueMutation(userId, { kind, url, method, body: serializedBody })
      return { queued: true }
    }

    return { queued: false, response }
  } catch (error) {
    if (isBrowser() && navigator.onLine === false) {
      queueMutation(userId, { kind, url, method, body: serializedBody })
      return { queued: true }
    }
    throw error
  }
}

async function syncQueue(userId: string): Promise<SyncResult> {
  const queue = readQueue(userId)
  let synced = 0
  const syncedKinds = new Set<OfflineMutationKind>()

  for (let index = 0; index < queue.length; index += 1) {
    if (!navigator.onLine || await currentUserId() !== userId) break
    const mutation = queue[index]
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: {
          'X-Client-User-Id': userId,
          ...(mutation.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: mutation.body,
      })

      if (!response.ok) break

      synced += 1
      syncedKinds.add(mutation.kind)
      // Read again so a replay cannot overwrite actions queued while it was in flight.
      writeQueue(userId, readQueue(userId).filter((item) => item.id !== mutation.id))
    } catch {
      break
    }
  }

  if (syncedKinds.has('notification')) emitClientInboxUpdated()
  if (syncedKinds.has('prep') || syncedKinds.has('meal')) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NUTRITION_LIVE_EVENT, {
        detail: { refreshAll: true },
      }))
    }
  }
  return { synced, pending: readQueue(userId).length }
}

export async function flushOfflineMutations(): Promise<SyncResult> {
  const userId = await currentUserId()
  if (!userId) return { synced: 0, pending: 0 }
  if (navigator.onLine === false) return { synced: 0, pending: readQueue(userId).length }

  const activeSync = activeSyncs.get(userId)
  if (activeSync) return activeSync

  const sync = Promise.resolve(navigator.locks
    ? navigator.locks.request(OFFLINE_MUTATIONS_KEY + userId, () => syncQueue(userId))
    : syncQueue(userId))
  const result = sync.finally(() => { activeSyncs.delete(userId) })
  activeSyncs.set(userId, result)
  return result
}
