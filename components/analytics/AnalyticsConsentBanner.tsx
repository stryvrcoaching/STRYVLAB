'use client'

import { useEffect, useState } from 'react'
import {
  readAnalyticsConsent,
  setAnalyticsConsent,
  syncAttributionFromLocation,
  trackPageView,
} from '@/lib/analytics/browser'

export function AnalyticsConsentBanner({
  source,
  pagePath,
  featureKey,
}: {
  source: string
  pagePath: string
  featureKey?: string
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(readAnalyticsConsent() === null)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-4 z-[120] px-4">
      <div className="mx-auto flex max-w-[880px] flex-col gap-4 rounded-[24px] border border-white/[0.08] bg-[#111111]/95 px-5 py-4 text-white shadow-2xl backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div className="max-w-[620px]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/38">Mesure d’audience interne</p>
          <p className="mt-2 text-[13px] leading-6 text-white/72">
            On mesure uniquement les visites, CTA et formulaires pour piloter le produit et l’acquisition. Aucun tracking publicitaire tiers.
            {' '}<a href="/cookies" className="underline underline-offset-2 hover:text-white">En savoir plus</a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAnalyticsConsent('denied')
              setVisible(false)
            }}
            className="rounded-full border border-white/[0.08] px-4 py-2 text-[12px] text-white/70 transition hover:bg-white/[0.04] hover:text-white"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => {
              setAnalyticsConsent('granted')
              setVisible(false)
              syncAttributionFromLocation()
              trackPageView({ source, pagePath, featureKey })
            }}
            className="rounded-full bg-white px-4 py-2 text-[12px] font-medium text-black transition hover:bg-white/90"
          >
            Autoriser
          </button>
        </div>
      </div>
    </div>
  )
}
