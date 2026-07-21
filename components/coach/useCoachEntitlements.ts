'use client'

import { useEffect, useState } from 'react'
import {
  buildCoachEntitlements,
  type CoachEntitlements,
} from '@/lib/billing/coach-entitlements'

export type CoachEntitlementsBundle = CoachEntitlements & {
  clientCount: number
}

let cached: CoachEntitlementsBundle | null = null
let inflight: Promise<CoachEntitlementsBundle> | null = null

async function fetchEntitlements(): Promise<CoachEntitlementsBundle> {
  if (cached) return cached
  if (inflight) return inflight

  inflight = fetch('/api/coach/profile')
    .then(async (res) => {
      if (!res.ok) throw new Error('profile')
      const json = await res.json()
      const p = json.profile ?? {}
      const base: CoachEntitlements =
        json.entitlements ??
        buildCoachEntitlements({
          plan: p.plan,
          billing_status: p.billing_status,
          client_limit: p.client_limit,
        })
      const bundle: CoachEntitlementsBundle = {
        ...base,
        clientCount: typeof p.client_count === 'number' ? p.client_count : 0,
      }
      cached = bundle
      return bundle
    })
    .catch(() => ({
      ...buildCoachEntitlements({ plan: 'solo', billing_status: 'inactive' }),
      clientCount: 0,
    }))
    .finally(() => {
      inflight = null
    })

  return inflight
}

/** Invalidate after plan upgrade / portal return */
export function invalidateCoachEntitlementsCache() {
  cached = null
}

export function useCoachEntitlements() {
  const [entitlements, setEntitlements] = useState<CoachEntitlementsBundle | null>(
    cached,
  )
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchEntitlements().then((ent) => {
      if (!cancelled) {
        setEntitlements(ent)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { entitlements, loading }
}
