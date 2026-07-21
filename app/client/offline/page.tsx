'use client'

import { useEffect, useState } from 'react'
import { LAST_CLIENT_ROUTE_KEY } from '@/components/client/ClientRouteMemory'
import { useClientT } from '@/components/client/ClientI18nProvider'

export default function OfflinePage() {
  const { t } = useClientT()
  const [retrying, setRetrying] = useState(false)
  const [fallbackTarget, setFallbackTarget] = useState('/client')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const from = params.get('from')
    if (from && from.startsWith('/client')) {
      setFallbackTarget(from)
      return
    }

    try {
      setFallbackTarget(
        sessionStorage.getItem(LAST_CLIENT_ROUTE_KEY)
        || localStorage.getItem(LAST_CLIENT_ROUTE_KEY)
        || '/client'
      )
    } catch {
      setFallbackTarget('/client')
    }
  }, [])

  useEffect(() => {
    function handleOnline() {
      window.location.replace(fallbackTarget)
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [fallbackTarget])

  function handleRetry() {
    setRetrying(true)
    window.location.replace(fallbackTarget)
  }

  return (
    <div className="min-h-dvh bg-[#121212] flex flex-col items-center justify-center px-6 text-center overflow-x-hidden" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mb-8">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30 mb-3">
          {t('offline.badge')}
        </p>
        <h1 className="text-[22px] font-black text-white leading-tight mb-2">
          {t('offline.title')}
        </h1>
        <p className="text-[13px] text-white/40 leading-relaxed max-w-[260px] mx-auto">
          {t('offline.desc')}
        </p>
      </div>

      <button
        onClick={handleRetry}
        className="h-12 px-8 bg-[#f2f2f2] text-[#080808] text-[12px] font-black uppercase tracking-[0.1em] rounded-xl active:scale-[0.98] transition-transform"
      >
        {retrying ? t('offline.returning') : t('offline.retry')}
      </button>
    </div>
  )
}
