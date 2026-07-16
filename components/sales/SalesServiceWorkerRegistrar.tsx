'use client'

import { useEffect } from 'react'

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false

  const standaloneViaMedia = window.matchMedia?.('(display-mode: standalone)').matches
  const standaloneViaNavigator = 'standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)

  return Boolean(standaloneViaMedia || standaloneViaNavigator)
}

export default function SalesServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (!isStandalonePwa()) return

    let cancelled = false

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/sales', updateViaCache: 'none' })
        if (cancelled) return
      } catch (err) {
        console.error('[SW Sales] Registration failed', err)
      }
    }

    void register()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
