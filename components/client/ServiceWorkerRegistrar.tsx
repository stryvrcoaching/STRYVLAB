'use client'

import { useEffect } from 'react'
import {
  listLocalStorageKeys,
  readLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from '@/lib/client/browserStorage'

const DRAFT_KEY_PREFIX = 'draft_session_log_id_'
const UPDATE_PENDING_KEY = 'sw_update_pending'
const PWA_RUNTIME_RESET_KEY = 'pwa_runtime_reset_version'
const PWA_RUNTIME_RESET_VERSION = '2026-06-19-1'
const CACHE_PREFIX = 'stryv-'

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false

  const standaloneViaMedia = window.matchMedia?.('(display-mode: standalone)').matches
  const standaloneViaNavigator = 'standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)

  return Boolean(standaloneViaMedia || standaloneViaNavigator)
}

function hasActiveDraft(): boolean {
  return listLocalStorageKeys().some((key) => key.startsWith(DRAFT_KEY_PREFIX))
}

async function resetPwaRuntimeOnce(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('serviceWorker' in navigator)) return false

  try {
    if (readLocalStorage(PWA_RUNTIME_RESET_KEY) === PWA_RUNTIME_RESET_VERSION) {
      return false
    }

    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      registrations.map(async (registration) => {
        try {
          await registration.unregister()
        } catch {
          // Ignore partial cleanup failures; cache purge below is the important part.
        }
      }),
    )

    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX))
          .map((key) => caches.delete(key)),
      )
    }

    removeLocalStorage(UPDATE_PENDING_KEY)
    writeLocalStorage(PWA_RUNTIME_RESET_KEY, PWA_RUNTIME_RESET_VERSION)
    return true
  } catch {
    return false
  }
}

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (!isStandalonePwa()) return

    let cancelled = false

    const bootstrap = async () => {
      const didResetRuntime = await resetPwaRuntimeOnce()
      if (cancelled) return
      if (didResetRuntime) {
        window.location.reload()
        return
      }

      // If a deferred update is pending (session was active during previous SW takeover),
      // reload now that we're back on a non-session page
      if (readLocalStorage(UPDATE_PENDING_KEY) === '1' && !hasActiveDraft()) {
        removeLocalStorage(UPDATE_PENDING_KEY)
        window.location.reload()
        return
      }

      navigator.serviceWorker
        .register('/sw.js', { scope: '/client', updateViaCache: 'none' })
        .then((registration) => registration.update().catch(() => {}))
        .catch(() => {
          // SW registration failed silently — app still works without it
        })
    }

    void bootstrap()

    // Only reload if the page was already controlled by a service worker
    const wasControlled = Boolean(navigator.serviceWorker.controller)

    const handleControllerChange = () => {
      if (cancelled) return
      if (hasActiveDraft()) {
        // Defer reload until the session is complete
        writeLocalStorage(UPDATE_PENDING_KEY, '1')
      } else if (wasControlled) {
        const now = Date.now()
        const lastReload = Number(sessionStorage.getItem('last_sw_reload') ?? '0')
        if (now - lastReload > 10000) { // 10s safety margin
          sessionStorage.setItem('last_sw_reload', String(now))
          window.location.reload()
        } else {
          console.warn('[SW] Reload loop detected and prevented.')
        }
      }
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  return null
}
