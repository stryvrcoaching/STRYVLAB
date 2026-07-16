'use client'

import { resetAnalyticsConsent } from '@/lib/analytics/browser'

export function ResetAnalyticsConsentButton() {
  return (
    <button
      type="button"
      onClick={() => {
        resetAnalyticsConsent()
        window.location.href = '/'
      }}
      className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 font-barlow-condensed text-xs uppercase tracking-[0.14em] text-white/75 transition hover:border-white/35 hover:text-white"
    >
      Réinitialiser mes choix
    </button>
  )
}
