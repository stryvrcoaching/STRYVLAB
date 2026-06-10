'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export const LAST_CLIENT_ROUTE_KEY = 'last_client_route'

export default function ClientRouteMemory() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname?.startsWith('/client')) return
    if (pathname.startsWith('/client/offline')) return

    const query = typeof window !== 'undefined' ? window.location.search : ''
    const nextRoute = `${pathname}${query}`

    try {
      localStorage.setItem(LAST_CLIENT_ROUTE_KEY, nextRoute)
      sessionStorage.setItem(LAST_CLIENT_ROUTE_KEY, nextRoute)
    } catch {
      // Route memory is a UX enhancement only.
    }
  }, [pathname])

  return null
}
