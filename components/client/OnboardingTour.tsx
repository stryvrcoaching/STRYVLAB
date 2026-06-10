'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowRight } from 'lucide-react'
import { useTour } from './TourContext'
import { useClientT } from './ClientI18nProvider'
import type { ClientDictKey } from '@/lib/i18n/clientTranslations'

type StripItem = 'checkin' | 'program' | 'calories' | 'water'

type TourStep = {
  navIndex?: number
  isFAB?: boolean
  stripItem?: StripItem
  isFemaleOnly?: boolean
  titleKey: ClientDictKey
  bodyKey: ClientDictKey
}

const TOUR_STEPS: TourStep[] = [
  // 0 — Chat tab
  {
    navIndex: 0,
    titleKey: 'tour.step0.title',
    bodyKey:  'tour.step0.body',
  },
  // 1–4 — TopBar strip pills (explained on chat page)
  {
    stripItem: 'checkin',
    titleKey: 'tour.strip.checkin.title',
    bodyKey:  'tour.strip.checkin.body',
  },
  {
    stripItem: 'program',
    titleKey: 'tour.strip.program.title',
    bodyKey:  'tour.strip.program.body',
  },
  {
    stripItem: 'calories',
    titleKey: 'tour.strip.calories.title',
    bodyKey:  'tour.strip.calories.body',
  },
  {
    stripItem: 'water',
    titleKey: 'tour.strip.water.title',
    bodyKey:  'tour.strip.water.body',
  },
  // 5 — Programme tab
  {
    navIndex: 1,
    titleKey: 'tour.step1.title',
    bodyKey:  'tour.step1.body',
  },
  // 6 — Nutrition tab
  {
    navIndex: 2,
    titleKey: 'tour.step2.title',
    bodyKey:  'tour.step2.body',
  },
  // 7 — FAB
  {
    isFAB: true,
    titleKey: 'tour.step3.title',
    bodyKey:  'tour.step3.body',
  },
  // 8 — Metrics tab
  {
    navIndex: 3,
    titleKey: 'tour.step4.title',
    bodyKey:  'tour.step4.body',
  },
  // 9 — Cycle (female only) — anchored to FAB since cycle logging lives in QuickLogSheet
  {
    isFemaleOnly: true,
    isFAB: true,
    titleKey: 'tour.female.title',
    bodyKey:  'tour.female.body',
  },
]

export default function OnboardingTour() {
  const { t } = useClientT()
  const [active, setActive]               = useState(false)
  const [stepIndex, setStepIndex]         = useState(0)
  const [navItemRects, setNavItemRects]   = useState<DOMRect[]>([])
  const [fabRect, setFabRect]             = useState<DOMRect | null>(null)
  const [stripRects, setStripRects]       = useState<Partial<Record<StripItem, DOMRect>>>({})
  const [isFemale, setIsFemale]           = useState(false)
  const { setHighlightedNavIndex, setHighlightFAB } = useTour()

  const measureElements = useCallback(() => {
    const nav = document.querySelector('nav')
    if (!nav) return

    // Nav tab <a> links
    const links = nav.querySelectorAll('a')
    const rects: DOMRect[] = []
    links.forEach(link => rects.push(link.getBoundingClientRect()))
    setNavItemRects(rects)

    // FAB
    const fab = nav.querySelector('[data-tour-fab]')
    if (fab) setFabRect(fab.getBoundingClientRect())

    // Strip pills
    const keys: StripItem[] = ['checkin', 'program', 'calories', 'water']
    const newStripRects: Partial<Record<StripItem, DOMRect>> = {}
    keys.forEach(key => {
      const el = document.querySelector(`[data-tour-strip="${key}"]`)
      if (el) newStripRects[key] = el.getBoundingClientRect()
    })
    setStripRects(newStripRects)
  }, [])

  // Start tour on first load
  useEffect(() => {
    const done = localStorage.getItem('onboarding_tour_done')
    if (done === null || done === 'false') {
      const timer = setTimeout(() => {
        measureElements()
        setActive(true)
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [measureElements])

  // Fetch gender for female-only steps
  useEffect(() => {
    fetch('/api/client/profile')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.gender === 'female') setIsFemale(true) })
      .catch(() => {})
  }, [])

  // Remeasure on each step change (strip items may load after tour starts)
  useEffect(() => {
    if (active) measureElements()
  }, [active, stepIndex, measureElements])

  // Sync highlight state with current step
  useEffect(() => {
    if (!active) {
      setHighlightedNavIndex(null)
      setHighlightFAB(false)
      return
    }
    const step = TOUR_STEPS[stepIndex]
    if (step.isFAB) {
      setHighlightedNavIndex(null)
      setHighlightFAB(true)
    } else {
      setHighlightFAB(false)
      setHighlightedNavIndex(step.navIndex ?? null)
    }
  }, [active, stepIndex, setHighlightedNavIndex, setHighlightFAB])

  const visibleSteps = TOUR_STEPS.filter(s => !s.isFemaleOnly || isFemale)

  function advance() {
    if (stepIndex < visibleSteps.length - 1) {
      setStepIndex(i => i + 1)
    } else {
      localStorage.setItem('onboarding_tour_done', 'true')
      setHighlightedNavIndex(null)
      setHighlightFAB(false)
      setActive(false)
    }
  }

  if (!active) return null

  const step    = visibleSteps[stepIndex]
  const isLast  = stepIndex === visibleSteps.length - 1
  const isFABStep = !!step.isFAB

  // Resolve target rect
  const targetRect: DOMRect | undefined = step.isFAB
    ? (fabRect ?? undefined)
    : step.stripItem
      ? (stripRects[step.stripItem] ?? undefined)
      : step.navIndex !== undefined
        ? navItemRects[step.navIndex]
        : undefined

  // Tooltip x-center — clamped to viewport edges
  const tooltipLeft = targetRect
    ? Math.min(Math.max(targetRect.left + targetRect.width / 2, 160), window.innerWidth - 160)
    : window.innerWidth / 2

  // For strip items (top of page): tooltip appears BELOW target
  // For nav/FAB (bottom of page): tooltip appears ABOVE target
  const isTopTarget = !!step.stripItem
  const tooltipVertical: React.CSSProperties = targetRect
    ? isTopTarget
      ? { top: targetRect.bottom + 12 }
      : { bottom: window.innerHeight - targetRect.top + 16 }
    : { bottom: 120 }

  // Arrow direction: points toward the target
  // Top targets → arrow points UP (at top of tooltip card)
  // Bottom targets → arrow points DOWN (at bottom of tooltip card)
  const arrowClass = isTopTarget
    ? 'absolute top-[-6px] w-3 h-3 bg-[#111111] rotate-45 border-l border-t border-white/[0.08]'
    : 'absolute bottom-[-6px] w-3 h-3 bg-[#111111] rotate-45 border-r border-b border-white/[0.08]'

  const arrowOffset: React.CSSProperties = {
    left: targetRect
      ? `calc(50% + ${(targetRect.left + targetRect.width / 2) - tooltipLeft}px)`
      : '50%',
    transform: 'translateX(-50%)',
  }

  return (
    <>
      {/* Spotlight overlay — nav tabs and strip items */}
      {!isFABStep && (
        <div className="fixed inset-0 z-[60] pointer-events-none">
          {targetRect && (
            <div
              className="absolute rounded-xl"
              style={{
                left:   targetRect.left - 6,
                top:    targetRect.top - 6,
                width:  targetRect.width + 12,
                height: targetRect.height + 12,
                background: 'transparent',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.82), 0 0 0 2px rgba(255,255,255,0.70)',
              }}
            />
          )}
          {/* Fallback full dimmer if no target (e.g. program strip not yet in DOM) */}
          {!targetRect && (
            <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.82)' }} />
          )}
        </div>
      )}

      {/* Dimmer for FAB steps */}
      {isFABStep && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 60, background: 'rgba(0,0,0,0.82)' }}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-[70] pointer-events-auto"
        style={{
          ...tooltipVertical,
          left: tooltipLeft,
          transform: 'translateX(-50%)',
          width: 'min(280px, calc(100vw - 32px))',
        }}
      >
        {/* Arrow */}
        <div className={arrowClass} style={arrowOffset} />

        <div className="bg-[#111111] rounded-xl p-4 border border-white/[0.06]">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-2">
            {visibleSteps.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === stepIndex
                    ? 'w-4 h-1 bg-[#f2f2f2]'
                    : i < stepIndex
                    ? 'w-1 h-1 bg-[#f2f2f2]/40'
                    : 'w-1 h-1 bg-white/15'
                }`}
              />
            ))}
          </div>

          <p className="text-[13px] font-bold text-white mb-1">{t(step.titleKey)}</p>
          <p className="text-[12px] text-white/55 leading-relaxed mb-3">{t(step.bodyKey)}</p>

          <button
            onClick={advance}
            className="w-full h-9 flex items-center justify-between bg-[#f2f2f2] hover:bg-white active:scale-[0.98] rounded-xl transition-all pl-4 pr-1.5"
          >
            <span className="text-[11px] font-barlow-condensed font-bold uppercase tracking-[0.10em] text-[#080808]">
              {isLast ? t('tour.cta.ready') : t('tour.cta.understood')}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-black/[0.12]">
              <ArrowRight size={13} className="text-[#080808]" />
            </div>
          </button>
        </div>
      </div>
    </>
  )
}
