'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

import { syncAppBadge } from '@/lib/client/appBadge'
import { CLIENT_INBOX_UPDATED_EVENT } from '@/lib/client/inboxEvents'

export type InboxBadgeState = {
  total: number
  chat: number
  home: number
  nutrition: number
  workout: number
  /** @deprecated alias of home */
  alerts: number
  refresh: () => Promise<void>
}

export function useInboxUnreadCount(): InboxBadgeState {
  const pathname = usePathname()
  const [total, setTotal] = useState(0)
  const [chat, setChat] = useState(0)
  const [home, setHome] = useState(0)
  const [nutrition, setNutrition] = useState(0)
  const [workout, setWorkout] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/client/inbox/unread-count', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const nextChat = Number(data?.chat ?? 0)
      const nextHome = Number(data?.home ?? data?.alerts ?? 0)
      const nextNutrition = Number(data?.nutrition ?? 0)
      const nextWorkout = Number(data?.workout ?? 0)
      const nextTotal = Number(
        data?.total ?? nextChat + nextHome + nextNutrition + nextWorkout,
      )
      setChat(nextChat)
      setHome(nextHome)
      setNutrition(nextNutrition)
      setWorkout(nextWorkout)
      setTotal(nextTotal)
      void syncAppBadge(nextTotal)
    } catch {
      // Silent fail
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [pathname, refresh])

  useEffect(() => {
    const onFocus = () => {
      void refresh()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const onInboxUpdate = () => {
      void refresh()
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener(CLIENT_INBOX_UPDATED_EVENT, onInboxUpdate)
    document.addEventListener('visibilitychange', onVisible)

    const interval = window.setInterval(() => {
      void refresh()
    }, 60000)

    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(CLIENT_INBOX_UPDATED_EVENT, onInboxUpdate)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
    }
  }, [refresh])

  return {
    total,
    chat,
    home,
    nutrition,
    workout,
    alerts: home,
    refresh,
  }
}
