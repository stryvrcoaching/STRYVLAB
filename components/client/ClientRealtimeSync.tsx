'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { emitClientInboxUpdated } from '@/lib/client/inboxEvents'

type Props = {
  clientId: string | null
}

const REALTIME_TABLES = [
  'nutrition_meals',
  'client_water_logs',
  'client_nutrition_preps',
  'coach_client_notifications',
] as const

export default function ClientRealtimeSync({ clientId }: Props) {
  const router = useRouter()

  useEffect(() => {
    if (!clientId) return

    const supabase = createClient()
    let refreshTimer: number | null = null

    const refreshClientData = (table: typeof REALTIME_TABLES[number]) => {
      if (table === 'coach_client_notifications') emitClientInboxUpdated()
      if (navigator.onLine === false || refreshTimer !== null) return

      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        router.refresh()
      }, 120)
    }

    const channel = supabase.channel(`client-realtime:${clientId}`)
    for (const table of REALTIME_TABLES) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `client_id=eq.${clientId}`,
        },
        () => refreshClientData(table),
      )
    }
    channel.subscribe()

    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      void supabase.removeChannel(channel)
    }
  }, [clientId, router])

  return null
}
