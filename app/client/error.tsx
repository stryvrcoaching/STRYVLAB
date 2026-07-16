'use client'

import { useEffect, useState } from 'react'
import { useClientT } from '@/components/client/ClientI18nProvider'

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useClientT()
  const [retryCount, setRetryCount] = useState(0)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    console.error('[Client Error Boundary]', error)
  }, [error])

  function handleReset() {
    // Guard: only allow 1 manual retry to avoid re-triggering a loop
    if (retryCount >= 1) {
      window.location.href = '/client'
      return
    }
    setRetryCount((c) => c + 1)
    reset()
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-[#0d0d0d] px-6 text-white"
      style={{ zIndex: 9999 }}
    >
      <div className="w-full max-w-sm flex flex-col gap-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/30 mb-3">
            STRYVR
          </p>
          <h1 className="text-[22px] font-semibold tracking-tight text-white leading-tight">
            {t('error.client.title')}
          </h1>
          <p className="mt-2 text-[13px] text-white/50 leading-relaxed">
            {t('error.client.desc')}
          </p>
        </div>

        {error?.message && (
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3">
            <p className="text-[11px] font-mono text-white/60 break-words">
              {error.message}
            </p>
            {error.stack && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 text-[10px] text-white/30 underline"
              >
                {expanded ? t('common.hideDetails') : t('common.showDetails')}
              </button>
            )}
            {expanded && error.stack && (
              <pre className="mt-2 text-[10px] font-mono text-white/30 overflow-auto max-h-40 whitespace-pre-wrap break-all">
                {error.stack}
              </pre>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex-1 h-11 rounded-xl bg-[#f2f2f2] text-[#080808] text-[12px] font-bold uppercase tracking-[0.10em] transition-all hover:bg-[#e0e0e0] active:scale-[0.98]"
          >
            {retryCount >= 1 ? t('error.client.goHome') : t('common.retry')}
          </button>
          <a
            href="/client"
            className="flex-1 h-11 rounded-xl bg-white/[0.06] text-white/60 text-[12px] font-bold uppercase tracking-[0.10em] flex items-center justify-center hover:bg-white/[0.10] transition-all"
          >
            {t('common.home')}
          </a>
        </div>

        {error?.digest && (
          <p className="text-center text-[9px] text-white/20 font-mono">
            Ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
