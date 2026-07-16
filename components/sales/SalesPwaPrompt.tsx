'use client'

import { useEffect, useState } from 'react'
import {
  Bell,
  X,
  Smartphone,
  Share,
  MoreVertical,
  PlusSquare,
  ArrowRight,
  Sparkles,
  Loader2
} from 'lucide-react'
import { isInstalledClientApp, getClientInstallPlatform } from '@/lib/client/appMode'
import { subscribeToPush } from '@/lib/client/push'

const DISMISS_KEY = 'stryv_connect_pwa_dismissed'
const NOTIF_DISMISS_KEY = 'stryv_connect_push_dismissed'

export default function SalesPwaPrompt() {
  const [mounted, setMounted] = useState(false)
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const [showPushPrompt, setShowPushPrompt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other')

  useEffect(() => {
    setMounted(true)
    
    // Only target mobile devices for install guide
    const currentPlatform = getClientInstallPlatform()
    setPlatform(currentPlatform)

    const isInstalled = isInstalledClientApp()
    const isMobile = currentPlatform === 'ios' || currentPlatform === 'android'

    if (!isInstalled) {
      const dismissed = localStorage.getItem(DISMISS_KEY)
      // Show install guide on mobile if not dismissed
      if (isMobile && !dismissed) {
        setShowInstallGuide(true)
      }
    } else {
      // If installed, check push notifications eligibility
      if (
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window
      ) {
        const permission = Notification.permission
        const dismissed = localStorage.getItem(NOTIF_DISMISS_KEY)
        if (permission === 'default' && !dismissed) {
          setShowPushPrompt(true)
        }
      }
    }
  }, [])

  if (!mounted) return null

  const handleDismissInstall = () => {
    localStorage.setItem(DISMISS_KEY, 'true')
    setShowInstallGuide(false)
  }

  const handleDismissPush = () => {
    localStorage.setItem(NOTIF_DISMISS_KEY, 'true')
    setShowPushPrompt(false)
  }

  const enableNotifications = async () => {
    setBusy(true)
    setError('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('L\'autorisation a été refusée.')
      }

      const pushToken = await subscribeToPush()
      if (!pushToken) {
        throw new Error('Impossible de configurer le service de notification.')
      }

      const response = await fetch('/api/sales/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pushToken }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Erreur lors de l\'enregistrement.')
      }

      setSuccess(true)
      localStorage.setItem(NOTIF_DISMISS_KEY, 'true')
      setTimeout(() => setShowPushPrompt(false), 2000)
    } catch (err) {
      console.error('[push] Subscription failed', err)
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  if (showInstallGuide) {
    const isIos = platform === 'ios'
    const isAndroid = platform === 'android'

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center sm:p-6 backdrop-blur-sm">
        <article className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#121212] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] text-[#c6b48b]">
              <Smartphone size={20} />
            </div>
            <button
              onClick={handleDismissInstall}
              type="button"
              className="rounded-lg p-1.5 hover:bg-white/[0.06] text-white/40 hover:text-white transition"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c6b48b]">Application mobile</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Ajouter à l'écran d'accueil</h2>
            <p className="mt-2 text-xs leading-relaxed text-white/55">
              Installez STRYV Connect pour suivre vos ventes à tout moment en mode plein écran, et recevoir des alertes en temps réel.
            </p>
          </div>

          <ol className="mt-6 space-y-3">
            <li className="flex gap-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] p-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/80">
                {isIos ? <Share size={15} /> : <MoreVertical size={15} />}
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">Étape 01</p>
                <p className="mt-1 text-xs leading-relaxed text-white/70">
                  {isIos 
                    ? 'Appuyez sur le bouton de partage dans la barre Safari.' 
                    : 'Appuyez sur le menu option (trois petits points) de votre navigateur.'}
                </p>
              </div>
            </li>

            <li className="flex gap-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] p-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/80">
                <PlusSquare size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">Étape 02</p>
                <p className="mt-1 text-xs leading-relaxed text-white/70">
                  {isIos 
                    ? 'Sélectionnez "Sur l\'écran d\'accueil" dans le menu déroulant.' 
                    : 'Sélectionnez "Installer l\'application" ou "Ajouter à l\'écran d\'accueil".'}
                </p>
              </div>
            </li>
          </ol>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleDismissInstall}
              type="button"
              className="h-11 flex-1 rounded-xl text-xs font-semibold text-white/50 hover:text-white transition"
            >
              Plus tard
            </button>
            <button
              onClick={handleDismissInstall}
              type="button"
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#f2f2f2] text-[11px] font-bold uppercase tracking-[0.12em] text-[#111315] hover:bg-white transition"
            >
              Compris <ArrowRight size={13} />
            </button>
          </div>
        </article>
      </div>
    )
  }

  if (showPushPrompt) {
    return (
      <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:bottom-6 z-40 mx-auto w-auto max-w-md">
        <article className="relative overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#161616] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.8)]">
          <button
            onClick={handleDismissPush}
            type="button"
            className="absolute right-3.5 top-3.5 rounded-lg p-1.5 hover:bg-white/[0.06] text-white/40 hover:text-white transition"
            aria-label="Fermer"
          >
            <X size={14} />
          </button>

          <div className="flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#c6b48b]/10 text-[#c6b48b]">
              {success ? <Sparkles size={18} /> : <Bell size={18} />}
            </div>
            
            <div className="min-w-0 pr-6 space-y-1">
              <h3 className="text-sm font-semibold text-white">
                {success ? 'Notifications activées !' : 'Activer les alertes en temps réel'}
              </h3>
              <p className="text-xs leading-relaxed text-white/55">
                {success 
                  ? 'Félicitations, vous recevrez désormais des alertes pour vos prospects.' 
                  : 'Restez informé de l\'activité de vos prospects et de la validation de vos commissions Connect.'}
              </p>
            </div>
          </div>

          {error ? (
            <p className="mt-3 text-[11px] text-red-300 leading-normal bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
              {error}
            </p>
          ) : null}

          {!success ? (
            <button
              onClick={enableNotifications}
              disabled={busy}
              type="button"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#f2f2f2] text-[11px] font-bold uppercase tracking-[0.12em] text-[#111315] hover:bg-white disabled:opacity-50 transition"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : null}
              Activer les alertes
            </button>
          ) : null}
        </article>
      </div>
    )
  }

  return null
}
