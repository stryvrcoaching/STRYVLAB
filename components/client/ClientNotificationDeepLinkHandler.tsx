'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { emitClientInboxUpdated } from '@/lib/client/inboxEvents'

/** Acknowledges a notification regardless of the client page opened by its link. */
export default function ClientNotificationDeepLinkHandler() {
  const router = useRouter()

  useEffect(() => {
    const url = new URL(window.location.href)
    const notificationId = url.searchParams.get('notificationId')
    if (!notificationId) return

    url.searchParams.delete('notificationId')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)

    void fetch(`/api/client/notifications/${encodeURIComponent(notificationId)}`, {
      method: 'PATCH',
    })
      .then((response) => {
        if (!response.ok) return
        emitClientInboxUpdated()
        router.refresh()
      })
      .catch(() => {})
  }, [router])

  return null
}
