'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { subscribeToPush } from '@/lib/client/push'
import { useClientT } from '@/components/client/ClientI18nProvider'
import { useTour } from '@/components/client/TourContext'
import { isInstalledClientApp } from '@/lib/client/appMode'

const PROMPT_VERSION = '2026-07-10-1'
const PROMPT_KEY = 'stryv_push_prompt_version'

export default function PushPermissionPrompt() {
  const { t } = useClientT()
  const { status: tourStatus } = useTour()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (tourStatus !== 'complete') return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function initialisePush() {
      if (typeof window === 'undefined') return
      if (!isInstalledClientApp()) return

      if (
        !('Notification' in window)
        || !('serviceWorker' in navigator)
        || !('PushManager' in window)
      ) {
        return
      }

      if (Notification.permission === 'granted') {
        try {
          const pushToken = await subscribeToPush()

          if (!pushToken) {
            if (!cancelled) setVisible(false)
            return
          }

          const response = await fetch('/api/client/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ push_token: pushToken }),
          })

          if (!response.ok) {
            if (!cancelled) {
              setVisible(true)
            }
            return
          }

          localStorage.setItem(PROMPT_KEY, PROMPT_VERSION)

          if (!cancelled) {
            setVisible(false)
          }
        } catch (error) {
          console.error('[push] Automatic subscription failed', error)

          if (!cancelled) {
            setVisible(true)
          }
        }

        return
      }

      if (localStorage.getItem(PROMPT_KEY) === PROMPT_VERSION) {
        return
      }

      setVisible(true)
    }

    timer = setTimeout(() => void initialisePush(), 500)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [tourStatus])

  if (!visible) return null

  async function enableNotifications() {
    setBusy(true)
    try {
      if (!isInstalledClientApp()) return
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return
      const pushToken = await subscribeToPush()
      if (!pushToken) return
      const response = await fetch('/api/client/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ push_token: pushToken }),
      })
      if (!response.ok) return
      localStorage.setItem(PROMPT_KEY, PROMPT_VERSION)
      setVisible(false)
    } finally {
      setBusy(false)
      setVisible(false)
    }
  }

  return (
    <div className="fixed inset-x-4 bottom-[calc(var(--client-bottom-nav-reserved)+16px)] z-[80] mx-auto max-w-md overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#09090a] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.72)]">
      <button
        type="button"
        aria-label={t('ui.close')}
        onClick={() => {
          localStorage.setItem(PROMPT_KEY, PROMPT_VERSION)
          setVisible(false)
        }}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/45"
      >
        <X size={14} />
      </button>
      <div className="flex gap-3 pr-8">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.03] text-[#5dba87]">
          <Bell size={17} />
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
            Notifications
          </p>
          <p className="mt-1 text-[14px] font-medium text-white">{t('push.title')}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-white/45">
            {t('push.body')}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={enableNotifications}
        disabled={busy}
        className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-[#1f8a65] text-[12px] font-semibold text-white transition-[transform,opacity] duration-150 active:scale-[0.96] disabled:opacity-50"
      >
        {busy ? t('push.activating') : t('push.enable')}
      </button>
    </div>
  )
}
