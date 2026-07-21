'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRight, X } from 'lucide-react'
import {
  clearActivationNavigation,
  getActivationStepLabel,
  isActivationNavigationActive,
  syncActivationFromUrl,
} from '@/lib/onboarding/activation-session'

/**
 * Sticky bar while the coach is away from the dashboard completing an activation step.
 */
export default function ActivationContinueBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    syncActivationFromUrl()
    const onDashboard =
      pathname === '/dashboard' || pathname === '/dashboard/'
    const active = isActivationNavigationActive()
    setVisible(active && !onDashboard)
    setLabel(getActivationStepLabel())
  }, [pathname])

  if (!visible) return null

  return (
    <div className="fixed bottom-[148px] left-1/2 z-[60] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-2xl border border-[#1f8a65]/30 bg-[#141414]/[0.97] px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#7fe0b8]/80">
            Activation en cours
          </p>
          <p className="truncate text-[12px] font-medium text-white/80">
            {label ?? 'Continue ta configuration'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            router.push('/dashboard')
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#1f8a65] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#217356]"
        >
          Continuer
          <ArrowRight size={12} />
        </button>
        <button
          type="button"
          aria-label="Masquer"
          onClick={() => {
            clearActivationNavigation()
            setVisible(false)
          }}
          className="rounded-lg p-1.5 text-white/35 hover:bg-white/[0.06] hover:text-white/70"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
