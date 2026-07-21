'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { AlertTriangle, Bug, Lightbulb, MessageSquareText, Send, X } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'

type Workspace = 'client_pwa' | 'platform_web'
type FeedbackCategory = 'bug' | 'usability' | 'suggestion'
type FeedbackPriority = 'low' | 'medium' | 'critical'

const CLIENT_HIDDEN_PREFIXES = [
  '/client/login',
  '/client/set-password',
  '/client/auth',
  '/client/access',
  '/client/onboarding',
  '/client/checkin/onboarding',
  '/client/offline',
]

const DASHBOARD_HIDDEN_PREFIXES = [
  '/dashboard/overview',
  '/dashboard/business',
  '/dashboard/product-feedback',
  '/dashboard/stryv-connect',
  '/dashboard/security',
  '/dashboard/ai-nutrition-ops',
]

const categoryOptions: Array<{
  value: FeedbackCategory
  label: string
  icon: typeof Bug
  hint: string
}> = [
  { value: 'bug', label: 'Bug', icon: Bug, hint: 'Quelque chose ne marche pas' },
  { value: 'usability', label: 'Usage', icon: AlertTriangle, hint: 'Parcours peu clair ou gênant' },
  { value: 'suggestion', label: 'Idée', icon: Lightbulb, hint: 'Amélioration ou demande' },
]

const priorityOptions: Array<{
  value: FeedbackPriority
  emoji: string
  label: string
}> = [
  { value: 'low', emoji: '🙂', label: 'Faible' },
  { value: 'medium', emoji: '😐', label: 'Moyenne' },
  { value: 'critical', emoji: '🚨', label: 'Critique' },
]

function resolveWorkspace(pathname: string | null): Workspace | null {
  if (!pathname) return null
  if (pathname.startsWith('/client')) return 'client_pwa'
  if (pathname.startsWith('/coach') || pathname.startsWith('/dashboard')) return 'platform_web'
  return null
}

function shouldHide(pathname: string | null) {
  if (!pathname) return true
  if (CLIENT_HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true
  }
  if (DASHBOARD_HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true
  }
  return false
}

export default function AppFeedbackWidget() {
  const { t } = useClientT()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const workspace = resolveWorkspace(pathname)
  const [isRestModalOpen, setIsRestModalOpen] = useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const hidden = shouldHide(pathname) || !workspace || isRestModalOpen || isOnboardingOpen
  const isClientPwa = workspace === 'client_pwa'

  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<FeedbackCategory>('bug')
  const [priority, setPriority] = useState<FeedbackPriority>('medium')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isCompactViewport, setIsCompactViewport] = useState(false)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  const pagePath = useMemo(() => {
    const query = searchParams?.toString()
    return query ? `${pathname}?${query}` : pathname ?? '/'
  }, [pathname, searchParams])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ open: boolean }>
      setIsRestModalOpen(customEvent.detail?.open ?? false)
    }
    window.addEventListener('stryvr-rest-modal-toggle', handleToggle)
    return () => window.removeEventListener('stryvr-rest-modal-toggle', handleToggle)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsOnboardingOpen(document.documentElement.dataset.stryvrOverlayOpen === 'true')
    const handleToggle = (event: Event) => {
      const customEvent = event as CustomEvent<{ open: boolean }>
      setIsOnboardingOpen(customEvent.detail?.open ?? false)
    }
    window.addEventListener('stryvr-onboarding-tour-toggle', handleToggle)
    return () => window.removeEventListener('stryvr-onboarding-tour-toggle', handleToggle)
  }, [])

  useEffect(() => {
    setOpen(false)
    setError(null)
    setSuccess(null)
  }, [pagePath])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateViewportFlags = () => {
      setIsCompactViewport(window.innerWidth < 768)
    }

    updateViewportFlags()
    window.addEventListener('resize', updateViewportFlags)
    return () => window.removeEventListener('resize', updateViewportFlags)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    const viewport = window.visualViewport
    const updateKeyboardState = () => {
      const heightGap = window.innerHeight - viewport.height
      setIsKeyboardOpen(heightGap > 160)
    }

    updateKeyboardState()
    viewport.addEventListener('resize', updateKeyboardState)
    return () => viewport.removeEventListener('resize', updateKeyboardState)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (hidden) return null

  const hideTrigger = isClientPwa && isKeyboardOpen && !open

  async function submitFeedback() {
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const payload = {
        workspace,
        page_path: pagePath,
        page_title: document.title || null,
        category,
        priority_user: priority,
        message,
        meta: {
          route_label: pathname,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          user_agent: navigator.userAgent,
        },
      }

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Envoi impossible')
      }

      setSuccess('Retour envoyé')
      setMessage('')
      setPriority('medium')
      setCategory('bug')
      window.setTimeout(() => {
        setOpen(false)
        setSuccess(null)
      }, 900)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Envoi impossible')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          aria-label="Donner un retour"
          onClick={() => setOpen(true)}
          className={
            isClientPwa
              ? 'fixed right-0 top-[54%] z-[50] flex h-12 items-center gap-2 rounded-l-2xl border border-r-0 border-white/10 bg-[#161616]/96 pl-3 pr-3 text-white shadow-[0_12px_28px_rgba(0,0,0,0.34)] backdrop-blur-md transition hover:bg-[#1c1c1c]'
              : 'fixed bottom-6 right-6 z-[50] inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-[#161616]/96 px-4 text-[12px] font-medium text-white shadow-[0_12px_28px_rgba(0,0,0,0.32)] backdrop-blur-md transition hover:border-white/20 hover:bg-[#1d1d1d]'
          }
          style={isClientPwa ? { transform: 'translateY(-50%)' } : undefined}
        >
          <MessageSquareText size={isClientPwa ? 16 : 15} />
          <span className={isClientPwa ? 'text-[11px] font-semibold tracking-[0.02em]' : 'text-[12px] font-medium'}>
            {isClientPwa ? t('feedback.trigger') : 'Donner un retour'}
          </span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
            onClick={() => setOpen(false)}
          />

          <div
            className={
              isCompactViewport
                ? 'absolute inset-x-0 bottom-0 z-[81] mx-auto flex max-h-[var(--client-sheet-max-height)] w-full flex-col overflow-hidden rounded-t-[28px] bg-[#0d0d0d] text-white shadow-2xl'
                : 'absolute bottom-6 right-6 z-[81] flex w-full max-w-[460px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#101010] text-white shadow-2xl'
            }
            style={{
              paddingBottom: isCompactViewport
                ? 'max(env(safe-area-inset-bottom), 16px)'
                : undefined,
            }}
          >
            {isCompactViewport && <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/[0.10]" />}

            <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
              <div>
                <p className="text-[15px] font-barlow-condensed font-bold uppercase tracking-[0.12em] text-white">
                  Donner un retour
                </p>
                <p className="mt-1 text-[12px] leading-5 text-white/45">
                  Aide-nous à améliorer cette page sans quitter ton parcours.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/40 active:bg-white/[0.08]"
                aria-label="Fermer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              <div className="mb-5">
                <p className="mb-2 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/32">
                  Type
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {categoryOptions.map((option) => {
                    const Icon = option.icon
                    const active = category === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setCategory(option.value)}
                        className={`rounded-2xl px-3 py-3 text-left transition ${
                          active
                            ? 'bg-white text-black'
                            : 'bg-white/[0.045] text-white/72 active:bg-white/[0.08]'
                        }`}
                      >
                        <div className={`mb-3 inline-flex h-8 w-8 items-center justify-center rounded-xl ${active ? 'bg-black/8' : 'bg-white/[0.06]'}`}>
                          <Icon size={15} />
                        </div>
                        <p className="text-[12px] font-semibold">{option.label}</p>
                        <p className={`mt-1 text-[10px] leading-4 ${active ? 'text-black/55' : 'text-white/35'}`}>
                          {option.hint}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mb-5">
                <p className="mb-2 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/32">
                  Priorité
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {priorityOptions.map((option) => {
                    const active = priority === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPriority(option.value)}
                        className={`rounded-2xl px-3 py-3 text-center transition ${
                          active
                            ? 'bg-white text-black'
                            : 'bg-white/[0.045] text-white/72 active:bg-white/[0.08]'
                        }`}
                      >
                        <div className="text-[20px]">{option.emoji}</div>
                        <p className={`mt-2 text-[12px] font-semibold ${active ? 'text-black' : 'text-white/78'}`}>
                          {option.label}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/32">
                    Commentaire
                  </p>
                  <p className="text-[11px] text-white/28">{message.length}/4000</p>
                </div>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Dis-nous ce qui bloque, ce qui manque ou ce qui pourrait être mieux."
                  className="min-h-[148px] w-full rounded-3xl border-0 bg-white/[0.045] px-4 py-4 text-[15px] leading-6 text-white outline-none transition placeholder:text-white/24 focus:bg-white/[0.07]"
                />
              </div>

              <div className="rounded-2xl bg-white/[0.035] px-4 py-3">
                <p className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/28">
                  Page détectée
                </p>
                <p className="mt-1 truncate text-[12px] text-white/62">{pagePath}</p>
              </div>

              {error && (
                <div className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-[12px] text-red-200">
                  {error}
                </div>
              )}

              {success && (
                <div className="mt-4 rounded-2xl bg-emerald-500/10 px-4 py-3 text-[12px] text-emerald-200">
                  {success}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-3 px-5 pb-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-2xl bg-white/[0.05] px-4 py-3 text-[13px] font-medium text-white/62 active:bg-white/[0.08]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submitFeedback}
                disabled={submitting || message.trim().length < 8}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-[13px] font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={14} />
                <span>{submitting ? 'Envoi...' : 'Envoyer'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
