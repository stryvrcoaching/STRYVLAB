'use client'

import { useEffect, useState } from 'react'
import { Check, HeartPulse, Loader2, RefreshCw } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'
import { isNativeHealthPlatform, syncTodayHealthData } from '@/lib/client/health-sync'

type HealthStatus = {
  connection: { platform: 'ios' | 'android'; last_synced_at: string | null } | null
  latest: { local_date: string; synced_at: string } | null
}

type State = 'idle' | 'loading' | 'synced' | 'error'

export default function HealthSyncPanel() {
  const { t } = useClientT()
  const [status, setStatus] = useState<HealthStatus | null>(null)
  const [state, setState] = useState<State>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/client/health-sync')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        setStatus(data)
        setState('idle')
      })
      .catch(() => setState('idle'))
  }, [])

  async function sync() {
    setState('loading')
    setMessage('')
    try {
      const payload = await syncTodayHealthData()
      const response = await fetch('/api/client/health-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('health.error.save')

      setStatus({
        connection: { platform: payload.platform, last_synced_at: new Date().toISOString() },
        latest: { local_date: payload.local_date, synced_at: new Date().toISOString() },
      })
      setState('synced')
      setMessage(t('health.synced'))
    } catch (error) {
      setState('error')
      const code = error instanceof Error ? error.message : ''
      const knownErrors = ['health.error.nativeOnly', 'health.error.unavailable', 'health.error.permission', 'health.error.save'] as const
      setMessage(t(knownErrors.includes(code as typeof knownErrors[number]) ? code as typeof knownErrors[number] : 'health.error.generic'))
    }
  }

  const nativeApp = isNativeHealthPlatform()
  return (
    <div className="space-y-3">
      <div className="flex gap-3 rounded-xl bg-white/[0.04] p-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-400/10 text-rose-300">
          <HeartPulse size={16} />
        </div>
        <div>
          <p className="text-[12px] font-semibold text-white/85">{t('health.title')}</p>
          <p className="mt-1 text-[11px] leading-5 text-white/45">
            {t('health.description')}
          </p>
        </div>
      </div>

      {nativeApp ? (
        <button
          type="button"
          onClick={sync}
          disabled={state === 'loading'}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f2f2f2] py-2.5 text-sm font-bold text-[#080808] transition-opacity disabled:opacity-50"
        >
          {state === 'loading' ? <Loader2 size={15} className="animate-spin" /> : state === 'synced' ? <Check size={15} /> : <RefreshCw size={15} />}
          {status?.connection ? t('health.sync.now') : t('health.connect')}
        </button>
      ) : (
        <div className="rounded-xl border border-white/[0.06] px-3 py-2.5">
          <p className="text-[11px] font-semibold text-white/65">{t('health.pwa.title')}</p>
          <p className="mt-1 text-[11px] leading-5 text-white/45">{t('health.pwa.description')}</p>
        </div>
      )}

      {message ? <p className={state === 'error' ? 'text-[11px] text-rose-300' : 'text-[11px] text-emerald-300'}>{message}</p> : null}
      {status?.latest && !message ? <p className="text-[10px] text-white/35">{t('health.lastSync', { date: status.latest.local_date })}</p> : null}
    </div>
  )
}
