'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { resetBodyScrollLock } from './useBodyScrollLock'
import { clearNutritionInvalidation, hasNutritionInvalidation } from '@/lib/client/nutrition-live'
import { CLIENT_INBOX_UPDATED_EVENT, clearClientInboxInvalidation, hasClientInboxInvalidation } from '@/lib/client/inboxEvents'

export const LAST_CLIENT_ROUTE_KEY = 'last_client_route'

export default function ClientRouteMemory() {
  const pathname = usePathname()
  const router = useRouter()

  function scheduleViewportRecovery() {
    resetBodyScrollLock()

    if (typeof window === 'undefined') return () => {}

    const rafId = window.requestAnimationFrame(() => {
      resetBodyScrollLock()
    })
    const timeoutId = window.setTimeout(() => {
      resetBodyScrollLock()
    }, 120)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(timeoutId)
    }
  }

  useEffect(() => {
    if (!pathname?.startsWith('/client')) return
    if (pathname.startsWith('/client/offline')) return

    // Route transitions must never inherit a stale body lock from a closed sheet
    // or a completed full-screen flow, otherwise every fixed header/nav drifts.
    const cleanupRecovery = scheduleViewportRecovery()

    const query = typeof window !== 'undefined' ? window.location.search : ''
    const nextRoute = `${pathname}${query}`

    try {
      localStorage.setItem(LAST_CLIENT_ROUTE_KEY, nextRoute)
      sessionStorage.setItem(LAST_CLIENT_ROUTE_KEY, nextRoute)
    } catch {
      // Route memory is a UX enhancement only.
    }

    return cleanupRecovery
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/client' || navigator.onLine === false || !hasNutritionInvalidation()) return

    clearNutritionInvalidation()
    router.refresh()
  }, [pathname, router])

  useEffect(() => {
    if (pathname !== '/client' || navigator.onLine === false || !hasClientInboxInvalidation()) return

    clearClientInboxInvalidation()
    router.refresh()
  }, [pathname, router])

  useEffect(() => {
    if (pathname !== '/client') return

    const refreshDashboard = () => {
      if (navigator.onLine === false) return
      clearClientInboxInvalidation()
      router.refresh()
    }
    window.addEventListener(CLIENT_INBOX_UPDATED_EVENT, refreshDashboard)
    return () => window.removeEventListener(CLIENT_INBOX_UPDATED_EVENT, refreshDashboard)
  }, [pathname, router])

  useEffect(() => {
    if (pathname !== '/client' && pathname !== '/client/nutrition') return

    const refreshOnResume = () => {
      if (document.visibilityState === 'hidden' || navigator.onLine === false) return
      router.refresh()
    }

    window.addEventListener('pageshow', refreshOnResume)
    window.addEventListener('focus', refreshOnResume)
    document.addEventListener('visibilitychange', refreshOnResume)

    return () => {
      window.removeEventListener('pageshow', refreshOnResume)
      window.removeEventListener('focus', refreshOnResume)
      document.removeEventListener('visibilitychange', refreshOnResume)
    }
  }, [pathname, router])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePageShow = () => {
      scheduleViewportRecovery()
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        scheduleViewportRecovery()
      }
    }

    const handleFocus = () => {
      scheduleViewportRecovery()
    }

    window.addEventListener('pageshow', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  return null
}
