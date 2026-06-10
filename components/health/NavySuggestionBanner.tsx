'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { NavySuggestion } from '@/lib/health/healthMath'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavySuggestionBannerProps {
  suggestion: NavySuggestion | null
  onApply: () => Promise<void>
  className?: string
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function NavySuggestionBanner({
  suggestion,
  onApply,
  className,
}: NavySuggestionBannerProps) {
  const [applying, setApplying] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (suggestion === null || dismissed) return null

  async function handleApply() {
    setApplying(true)
    try {
      await onApply()
    } finally {
      setApplying(false)
      setDismissed(true)
    }
  }

  return (
    <div
      className={cn(
        'bg-[#1f4637] border-[0.3px] border-[#1f8a65]/20 rounded-xl p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-[12px] font-semibold text-white/80 mb-1">
            Estimation via méthode Navy disponible
          </p>
          <p className="text-[11px] text-white/55 leading-relaxed">
            Les mensurations permettent d&apos;estimer le %MG&nbsp;:{' '}
            <strong className="text-white/80">{suggestion.estimated_body_fat_pct}%</strong>{' '}
            ({suggestion.precision})
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={handleApply}
            disabled={applying}
            className="h-8 px-4 rounded-lg bg-[#1f8a65] text-white text-[11px] font-bold uppercase tracking-[0.1em] hover:bg-[#217356] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {applying ? '...' : 'Appliquer →'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="h-8 px-3 rounded-lg bg-white/[0.06] text-white/50 text-[11px] hover:text-white/70 transition-colors"
          >
            Ignorer
          </button>
        </div>
      </div>
    </div>
  )
}
