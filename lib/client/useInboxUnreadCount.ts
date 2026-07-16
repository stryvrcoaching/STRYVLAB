'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

import { syncAppBadge } from '@/lib/client/appBadge'
import { CLIENT_INBOX_UPDATED_EVENT } from '@/lib/client/inboxEvents'

export function useInboxUnreadCount() {
  const pathname = usePathname()
  const [count, setCount] = useState(0)
  const [chat, setChat] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/client/inbox/unread-count', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const next = Number(data?.total ?? 0)
      setCount(next)
      setChat(Number(data?.chat ?? 0))
      void syncAppBadge(next)
    } catch {
      // Silent fail — badge will refresh on next successful fetch.
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [pathname, refresh])

  useEffect(() => {
    const onFocus = () => { void refresh() }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const onInboxUpdate = () => { void refresh() }

    window.addEventListener('focus', onFocus)
    window.addEventListener(CLIENT_INBOX_UPDATED_EVENT, onInboxUpdate)
    document.addEventListener('visibilitychange', onVisible)

    const interval = window.setInterval(() => { void refresh() }, 60000)

    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(CLIENT_INBOX_UPDATED_EVENT, onInboxUpdate)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
    }
  }, [refresh])

  return { count, chat, refresh }
}
