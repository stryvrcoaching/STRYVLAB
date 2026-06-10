'use client'

import { useEffect } from 'react'

const DRAFT_KEY_PREFIX = 'draft_session_log_id_'
const UPDATE_PENDING_KEY = 'sw_update_pending'

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false

  const standaloneViaMedia = window.matchMedia?.('(display-mode: standalone)').matches
  const standaloneViaNavigator = 'standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)

  return Boolean(standaloneViaMedia || standaloneViaNavigator)
}

function hasActiveDraft(): boolean {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(DRAFT_KEY_PREFIX)) return true
  }
  return false
}

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (!isStandalonePwa()) return

    // If a deferred update is pending (session was active during previous SW takeover),
    // reload now that we're back on a non-session page
    if (localStorage.getItem(UPDATE_PENDING_KEY) === '1' && !hasActiveDraft()) {
      localStorage.removeItem(UPDATE_PENDING_KEY)
      window.location.reload()
      return
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/client' })
      .catch(() => {
        // SW registration failed silently — app still works without it
      })

    const handleControllerChange = () => {
      if (hasActiveDraft()) {
        // Defer reload until the session is complete
        localStorage.setItem(UPDATE_PENDING_KEY, '1')
      } else {
        window.location.reload()
      }
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  return null
}
