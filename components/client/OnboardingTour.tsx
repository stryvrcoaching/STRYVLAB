'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Home, MoreVertical, Smartphone } from 'lucide-react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useClientT } from './ClientI18nProvider'
import { useTour } from './TourContext'
import type { ClientDictKey } from '@/lib/i18n/clientTranslations'
import {
  readLocalStorage,
  readSessionStorage,
  removeLocalStorage,
  writeLocalStorage,
  writeSessionStorage,
} from '@/lib/client/browserStorage'
import {
  getClientInstallPlatform,
  isInstalledClientApp,
  resolveClientEntryExperience,
  type ClientInstallPlatform,
} from '@/lib/client/appMode'

type TourTarget = 'dashboard' | 'progression' | 'daily-strip' | 'coach-chat' | 'workout' | 'nutrition' | 'quick-add' | 'metrics'

type TourStep = {
  id: string
  target?: TourTarget
  optional?: boolean
  titleKey: ClientDictKey
  bodyKey: ClientDictKey
}

const DONE_KEY = 'onboarding_tour_done'
const STEP_KEY = 'onboarding_tour_step'
const INSTALL_GUIDE_SESSION_KEY = 'stryvr_install_guide_seen'

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    titleKey: 'tour.welcome.title',
    bodyKey: 'tour.welcome.body',
  },
  {
    id: 'dashboard',
    target: 'dashboard',
    titleKey: 'tour.dashboard.title',
    bodyKey: 'tour.dashboard.body',
  },
  {
    id: 'progression',
    target: 'progression',
    optional: true,
    titleKey: 'tour.progression.title',
    bodyKey: 'tour.progression.body',
  },
  {
    id: 'daily-strip',
    target: 'daily-strip',
    optional: true,
    titleKey: 'tour.dailyStrip.title',
    bodyKey: 'tour.dailyStrip.body',
  },
  {
    id: 'coach-chat',
    target: 'coach-chat',
    optional: true,
    titleKey: 'tour.coach.title',
    bodyKey: 'tour.coach.body',
  },
  {
    id: 'workout',
    target: 'workout',
    titleKey: 'tour.workout.title',
    bodyKey: 'tour.workout.body',
  },
  {
    id: 'nutrition',
    target: 'nutrition',
    titleKey: 'tour.nutrition.title',
    bodyKey: 'tour.nutrition.body',
  },
  {
    id: 'quick-add',
    target: 'quick-add',
    titleKey: 'tour.quickAdd.title',
    bodyKey: 'tour.quickAdd.body',
  },
  {
    id: 'metrics',
    target: 'metrics',
    titleKey: 'tour.metrics.title',
    bodyKey: 'tour.metrics.body',
  },
]

function getTarget(target: TourTarget): HTMLElement | null {
  const selector = target === 'quick-add'
    ? '[data-tour-fab]'
    : `[data-tour-id="${target}"]`
  return document.querySelector<HTMLElement>(selector)
}

function restoreStepIndex(steps: TourStep[]): number {
  const stored = readLocalStorage(STEP_KEY)
  if (!stored) return 0

  const storedIdIndex = steps.findIndex((candidate) => candidate.id === stored)
  if (storedIdIndex >= 0) return storedIdIndex

  const legacyIndex = Number.parseInt(stored, 10)
  if (!Number.isFinite(legacyIndex)) return 0
  return Math.min(Math.max(legacyIndex, 0), Math.max(steps.length - 1, 0))
}

function IosShareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M6 10H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
    </svg>
  )
}

export default function OnboardingTour() {
  const pathname = usePathname()
  const { t } = useClientT()
  const {
    setHighlightedNavIndex,
    setHighlightFAB,
    setStatus,
  } = useTour()
  const [steps, setSteps] = useState<TourStep[]>([])
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const [installPlatform, setInstallPlatform] = useState<ClientInstallPlatform>('other')
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const nextButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const active = steps.length > 0
  const overlayActive = active || showInstallGuide
  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1

  const measureTarget = useCallback(() => {
    if (!step?.target) {
      setTargetRect(null)
      return
    }
    setTargetRect(getTarget(step.target)?.getBoundingClientRect() ?? null)
  }, [step])

  const finish = useCallback(() => {
    writeLocalStorage(DONE_KEY, 'true')
    removeLocalStorage(STEP_KEY)
    setSteps([])
    setStepIndex(0)
    setTargetRect(null)
    setHighlightedNavIndex(null)
    setHighlightFAB(false)
    setStatus('complete')
  }, [setHighlightFAB, setHighlightedNavIndex, setStatus])

  const dismissInstallGuide = useCallback(() => {
    writeSessionStorage(INSTALL_GUIDE_SESSION_KEY, 'true')
    setShowInstallGuide(false)
    setStatus('complete')
  }, [setStatus])

  const advance = useCallback(() => {
    if (isLast) {
      finish()
      return
    }
    const nextIndex = stepIndex + 1
    writeLocalStorage(STEP_KEY, steps[nextIndex]?.id ?? String(nextIndex))
    setStepIndex(nextIndex)
  }, [finish, isLast, stepIndex, steps])

  const goBack = useCallback(() => {
    const previousIndex = Math.max(stepIndex - 1, 0)
    writeLocalStorage(STEP_KEY, steps[previousIndex]?.id ?? String(previousIndex))
    setStepIndex(previousIndex)
  }, [stepIndex, steps])

  useEffect(() => {
    if (pathname !== '/client') {
      setStatus('checking')
      return
    }

    const installed = isInstalledClientApp()
    const experience = resolveClientEntryExperience({
      installed,
      onboardingDone: readLocalStorage(DONE_KEY) === 'true',
      installGuideSeen: readSessionStorage(INSTALL_GUIDE_SESSION_KEY) === 'true',
    })

    if (experience === 'install-guide') {
      setSteps([])
      setTargetRect(null)
      setHighlightedNavIndex(null)
      setHighlightFAB(false)
      setInstallPlatform(getClientInstallPlatform())
      setShowInstallGuide(true)
      setStatus('active')
      return
    }

    setShowInstallGuide(false)
    if (experience === 'none') {
      setStatus('complete')
      return
    }

    setStatus('checking')
    const timer = window.setTimeout(() => {
      const availableSteps = TOUR_STEPS.filter((candidate) => (
        !candidate.optional || !candidate.target || Boolean(getTarget(candidate.target))
      ))
      setSteps(availableSteps)
      setStepIndex(restoreStepIndex(availableSteps))
      setStatus('active')
    }, 450)

    return () => window.clearTimeout(timer)
  }, [pathname, setHighlightFAB, setHighlightedNavIndex, setStatus])

  useEffect(() => {
    if (pathname === '/client') return
    setShowInstallGuide(false)
    setSteps([])
    setTargetRect(null)
    setHighlightedNavIndex(null)
    setHighlightFAB(false)
    setStatus('checking')
  }, [pathname, setHighlightFAB, setHighlightedNavIndex, setStatus])

  useEffect(() => {
    if (!active || !step) return

    setHighlightedNavIndex(
      step.target === 'dashboard'
        ? 0
        : step.target === 'workout'
          ? 1
          : step.target === 'nutrition'
            ? 2
            : step.target === 'metrics'
              ? 3
              : null,
    )
    setHighlightFAB(step.target === 'quick-add')
    measureTarget()
    nextButtonRef.current?.focus({ preventScroll: true })

    const handleViewportChange = () => measureTarget()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('orientationchange', handleViewportChange)
    document.addEventListener('scroll', handleViewportChange, true)

    const target = step.target ? getTarget(step.target) : null
    const observer = target && 'ResizeObserver' in window
      ? new ResizeObserver(handleViewportChange)
      : null
    if (target && observer) observer.observe(target)

    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('orientationchange', handleViewportChange)
      document.removeEventListener('scroll', handleViewportChange, true)
      observer?.disconnect()
    }
  }, [active, measureTarget, setHighlightFAB, setHighlightedNavIndex, step])

  useEffect(() => {
    if (!overlayActive) return

    document.documentElement.dataset.stryvrOverlayOpen = 'true'
    window.dispatchEvent(new CustomEvent('stryvr-onboarding-tour-toggle', { detail: { open: true } }))
    return () => {
      delete document.documentElement.dataset.stryvrOverlayOpen
      window.dispatchEvent(new CustomEvent('stryvr-onboarding-tour-toggle', { detail: { open: false } }))
    }
  }, [overlayActive])

  useEffect(() => {
    if (!active) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        advance()
      } else if (event.key === 'ArrowLeft' && stepIndex > 0) {
        event.preventDefault()
        goBack()
      } else if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
        if (!focusable?.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, advance, goBack, stepIndex])

  const spotlightStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (!targetRect) return undefined
    const padding = step?.target === 'quick-add' ? 8 : 6
    return {
      left: targetRect.left - padding,
      top: targetRect.top - padding,
      width: targetRect.width + padding * 2,
      height: targetRect.height + padding * 2,
      borderRadius: step?.target === 'quick-add' ? 20 : 18,
    }
  }, [step?.target, targetRect])

  if (showInstallGuide) {
    const isIos = installPlatform === 'ios'
    const isAndroid = installPlatform === 'android'

    return (
      <div
        className="fixed inset-0 z-[90] touch-pan-y overflow-y-auto overscroll-contain bg-black/85 px-4 backdrop-blur-[2px]"
        aria-label={t('tour.install.dialog')}
        aria-modal="true"
        role="dialog"
        style={{
          WebkitOverflowScrolling: 'touch',
          paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)',
          paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 24px), 120px)',
        }}
      >
        <div className="mx-auto flex min-h-full w-full max-w-[420px] items-start sm:items-center">
          <div className="w-full overflow-hidden rounded-[30px] bg-[#111111] shadow-[0_28px_90px_rgba(0,0,0,0.78)]">
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#202020] text-white">
                  <Smartphone size={21} strokeWidth={1.7} />
                </div>
                <Image
                  src="/logo/logo-stryvr-silver.png"
                  alt="STRYVR"
                  width={48}
                  height={48}
                  className="h-12 w-12 object-contain opacity-90"
                />
              </div>
              <p className="mt-5 font-barlow-condensed text-[10px] font-bold uppercase tracking-[0.22em] text-white/38">
                {t('tour.install.eyebrow')}
              </p>
              <h2 className="mt-2 text-[24px] font-semibold leading-[1.08] tracking-[-0.03em] text-white">
                {t('tour.install.title')}
              </h2>
              <p className="mt-3 text-[14px] leading-[1.55] text-white/58">
                {t('tour.install.body')}
              </p>

              <ol className="mt-5 space-y-2.5">
                <li className="flex gap-3 rounded-2xl bg-[#191919] p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#262626] text-white/82">
                    {isIos ? <IosShareIcon size={17} /> : <MoreVertical size={17} />}
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">01</p>
                    <p className="mt-1 text-[13px] leading-5 text-white/72">
                      {t(isIos ? 'tour.install.step1.ios' : isAndroid ? 'tour.install.step1.android' : 'tour.install.step1.other')}
                    </p>
                  </div>
                </li>
                <li className="flex gap-3 rounded-2xl bg-[#191919] p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#262626] text-white/82">
                    <Home size={16} />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">02</p>
                    <p className="mt-1 text-[13px] leading-5 text-white/72">
                      {t(isIos ? 'tour.install.step2.ios' : isAndroid ? 'tour.install.step2.android' : 'tour.install.step2.other')}
                    </p>
                  </div>
                </li>
                <li className="flex gap-3 rounded-2xl bg-[#191919] p-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#262626] text-white/82">
                    <Check size={16} />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">03</p>
                    <p className="mt-1 text-[13px] leading-5 text-white/72">{t('tour.install.step3')}</p>
                  </div>
                </li>
              </ol>

              <p className="mt-4 rounded-2xl bg-[#171717] px-4 py-3 text-[12px] leading-5 text-white/48">
                {t('tour.install.note')}
              </p>

              <div className="mt-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={dismissInstallGuide}
                  className="h-12 shrink-0 rounded-2xl px-4 text-[12px] font-medium text-white/46 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  {t('tour.install.later')}
                </button>
                <button
                  type="button"
                  onClick={dismissInstallGuide}
                  className="flex h-12 flex-1 items-center justify-between rounded-2xl bg-[#f0f0ef] pl-5 pr-2 text-[#090909] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]"
                >
                  <span className="font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.14em]">
                    {t('tour.install.understood')}
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/[0.08]">
                    <ArrowRight size={16} />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!active || !step) return null

  const isWelcome = !step.target

  return (
    <div
      className="fixed inset-0 z-[90]"
      aria-label={t('tour.dialog.label')}
      aria-modal="true"
      role="dialog"
    >
      {spotlightStyle ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute shadow-[0_0_0_9999px_rgba(0,0,0,0.82),0_18px_50px_rgba(0,0,0,0.55)] transition-[left,top,width,height] duration-300 ease-out"
          style={spotlightStyle}
        />
      ) : (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/85" />
      )}

      <div
        ref={dialogRef}
        className={isWelcome
          ? 'absolute inset-x-5 top-1/2 mx-auto w-auto max-w-[380px] -translate-y-1/2'
          : 'absolute inset-x-4 bottom-[calc(var(--client-bottom-nav-reserved)+16px)] mx-auto w-auto max-w-[420px]'}
      >
        <div className="overflow-hidden rounded-[28px] bg-[#111111] shadow-[0_28px_90px_rgba(0,0,0,0.78)]">
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src="/logo/logo-stryvr-silver.png"
                  alt="STRYVR"
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 object-contain opacity-90"
                />
                <div className="min-w-0">
                  <p className="font-barlow-condensed text-[10px] font-bold uppercase tracking-[0.2em] text-white/38">
                    STRYVR · {t('tour.progress', { current: stepIndex + 1, total: steps.length })}
                  </p>
                  <div aria-hidden="true" className="mt-2 flex w-full max-w-[180px] gap-1">
                    {steps.map((item, index) => (
                      <span
                        key={item.id}
                        className={index <= stepIndex
                          ? 'h-1.5 min-w-2 flex-1 rounded-full bg-white transition-colors duration-300'
                          : 'h-1.5 min-w-2 flex-1 rounded-full bg-[#343434] transition-colors duration-300'}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={finish}
                className="shrink-0 rounded-lg px-1 py-1 text-[11px] font-medium text-white/42 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                {t('tour.cta.skip')}
              </button>
            </div>

            <h2 className="mt-5 text-[22px] font-semibold leading-[1.08] tracking-[-0.025em] text-white">
              {t(step.titleKey)}
            </h2>
            <p className="mt-2.5 max-w-[34rem] text-[14px] leading-[1.55] text-white/58">
              {t(step.bodyKey)}
            </p>

            <div className="mt-5 flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={goBack}
                  aria-label={t('tour.cta.back')}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1d1d1d] text-white/68 transition-colors hover:bg-[#262626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <ArrowLeft size={17} />
                </button>
              )}
              <button
                ref={nextButtonRef}
                type="button"
                onClick={advance}
                className="flex h-12 flex-1 items-center justify-between rounded-2xl bg-[#f0f0ef] pl-5 pr-2 text-[#090909] transition-transform active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]"
              >
                <span className="font-barlow-condensed text-[12px] font-bold uppercase tracking-[0.14em]">
                  {isLast ? t('tour.cta.finish') : t('tour.cta.next')}
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/[0.08]">
                  <ArrowRight size={16} />
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
