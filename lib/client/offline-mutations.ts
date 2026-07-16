'use client'

import { readLocalStorage, writeLocalStorage } from '@/lib/client/browserStorage'
import { emitClientInboxUpdated } from '@/lib/client/inboxEvents'
import { NUTRITION_LIVE_EVENT } from '@/lib/client/nutrition-live'

const OFFLINE_MUTATIONS_KEY = 'stryv:offline-mutations:v1'
const OFFLINE_MUTATIONS_EVENT = 'stryv:offline-mutations-updated'
const MAX_PENDING_MUTATIONS = 50

export type OfflineMutationKind = 'meal' | 'water' | 'notification' | 'prep'

type OfflineMutation = {
  id: string
  kind: OfflineMutationKind
  url: string
  method: 'POST' | 'PATCH'
  body?: string
  createdAt: string
}

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

function readQueue(): OfflineMutation[] {
  const raw = readLocalStorage(OFFLINE_MUTATIONS_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(queue: OfflineMutation[]) {
  writeLocalStorage(OFFLINE_MUTATIONS_KEY, JSON.stringify(queue.slice(-MAX_PENDING_MUTATIONS)))
  emitUpdate()
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function queueMutation(input: Omit<OfflineMutation, 'id' | 'createdAt'>) {
  writeQueue([
    ...readQueue(),
    {
      ...input,
      id: createId(),
      createdAt: new Date().toISOString(),
    },
  ])
}

export function getPendingOfflineMutationCount() {
  return readQueue().length
}

export function subscribeToOfflineMutations(listener: () => void) {
  if (!isBrowser()) return () => {}
  window.addEventListener(OFFLINE_MUTATIONS_EVENT, listener)
  return () => window.removeEventListener(OFFLINE_MUTATIONS_EVENT, listener)
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

  if (isBrowser() && navigator.onLine === false) {
    queueMutation({ kind, url, method, body: serializedBody })
    return { queued: true }
  }

  try {
    const response = await fetch(url, {
      method,
      headers: serializedBody ? { 'Content-Type': 'application/json' } : undefined,
      body: serializedBody,
    })

    if (response.status === 503 && isBrowser() && navigator.onLine === false) {
      queueMutation({ kind, url, method, body: serializedBody })
      return { queued: true }
    }

    return { queued: false, response }
  } catch (error) {
    if (isBrowser() && navigator.onLine === false) {
      queueMutation({ kind, url, method, body: serializedBody })
      return { queued: true }
    }
    throw error
  }
}

export async function flushOfflineMutations() {
  if (!isBrowser() || navigator.onLine === false) {
    return { synced: 0, pending: getPendingOfflineMutationCount() }
  }

  const queue = readQueue()
  let synced = 0
  let remaining = queue
  const syncedKinds = new Set<OfflineMutationKind>()

  for (let index = 0; index < queue.length; index += 1) {
    const mutation = queue[index]
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.body ? { 'Content-Type': 'application/json' } : undefined,
        body: mutation.body,
      })

      if (!response.ok) break

      synced += 1
      syncedKinds.add(mutation.kind)
      remaining = queue.slice(index + 1)
    } catch {
      break
    }
  }

  if (synced > 0) writeQueue(remaining)
  if (syncedKinds.has('notification')) emitClientInboxUpdated()
  if (syncedKinds.has('prep') || syncedKinds.has('meal')) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NUTRITION_LIVE_EVENT, {
        detail: { refreshAll: true },
      }))
    }
  }
  return { synced, pending: remaining.length }
}
