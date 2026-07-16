'use client'

import { useEffect } from 'react'
import { syncAttributionFromLocation, trackPageView } from '@/lib/analytics/browser'

export function PublicPageTracker({
  source,
  pagePath,
  featureKey,
}: {
  source: string
  pagePath?: string
  featureKey?: string
}) {
  useEffect(() => {
    syncAttributionFromLocation()
    trackPageView({
      source,
      pagePath: pagePath ?? window.location.pathname,
      featureKey,
    })
  }, [featureKey, pagePath, source])

  return null
}
