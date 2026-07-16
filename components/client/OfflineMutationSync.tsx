'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CloudOff, RefreshCw } from 'lucide-react'
import {
  flushOfflineMutations,
  getPendingOfflineMutationCount,
  subscribeToOfflineMutations,
} from '@/lib/client/offline-mutations'

export default function OfflineMutationSync() {
  const router = useRouter()
  const [pending, setPending] = useState(0)
  const [offline, setOffline] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const refreshState = useCallback(() => {
    setPending(getPendingOfflineMutationCount())
    setOffline(navigator.onLine === false)
  }, [])

  const sync = useCallback(async () => {
    if (navigator.onLine === false) {
      refreshState()
      return
    }

    setSyncing(true)
    const result = await flushOfflineMutations()
    refreshState()
    if (result.synced > 0) router.refresh()
    setSyncing(false)
  }, [refreshState, router])

  useEffect(() => {
    refreshState()
    if (navigator.onLine && getPendingOfflineMutationCount() > 0) {
      void sync()
    }
    const unsubscribe = subscribeToOfflineMutations(refreshState)
    const handleOnline = () => { void sync() }
    const handleOffline = () => refreshState()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [refreshState, sync])

  if (!offline && pending === 0) return null

  return (
    <button
      type="button"
      onClick={() => { void sync() }}
      className="fixed bottom-[calc(var(--client-bottom-nav-reserved)+14px)] left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#171717] px-3 py-2 text-[11px] font-semibold text-white shadow-xl shadow-black/40"
      aria-live="polite"
    >
      {syncing ? <RefreshCw size={14} className="animate-spin" /> : <CloudOff size={14} className="text-[#ffb266]" />}
      <span>
        {offline
          ? pending > 0 ? `${pending} action${pending > 1 ? 's' : ''} en attente` : 'Hors ligne'
          : `${pending} action${pending > 1 ? 's' : ''} à synchroniser`}
      </span>
    </button>
  )
}
