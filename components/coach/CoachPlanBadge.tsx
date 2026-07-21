'use client'

import Link from 'next/link'
import { useCoachEntitlements } from '@/components/coach/useCoachEntitlements'

const PLAN_LABEL: Record<string, string> = {
  solo: 'Solo',
  pro: 'Pro',
  studio: 'Studio',
}

/**
 * Compact plan + client capacity chip for the coach top bar.
 */
export default function CoachPlanBadge() {
  const { entitlements, loading } = useCoachEntitlements()
  if (loading || !entitlements) return null

  const planLabel = PLAN_LABEL[entitlements.plan] ?? entitlements.plan
  const limit = entitlements.clientLimit
  const count = entitlements.clientCount
  const nearLimit = limit != null && count >= Math.max(1, limit - 1)
  const atLimit = limit != null && count >= limit

  const clientsLabel =
    limit == null
      ? `${count} client${count === 1 ? '' : 's'}`
      : `${count}/${limit} clients`

  const titleParts = [
    `Plan actuel : ${planLabel}`,
    `Clients : ${clientsLabel}`,
    entitlements.clientAppEnabled
      ? 'App client STRYVR : active'
      : entitlements.clientAppBlockedReason ?? 'App client STRYVR : non incluse',
  ]

  return (
    <Link
      href="/coach/settings?section=plan"
      className={`hidden items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-semibold transition-colors sm:inline-flex ${
        atLimit
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-200/90 hover:bg-amber-500/15'
          : nearLimit
            ? 'border-white/[0.1] bg-white/[0.04] text-white/70 hover:bg-white/[0.07]'
            : 'border-white/[0.08] bg-white/[0.03] text-white/55 hover:bg-white/[0.06] hover:text-white/75'
      }`}
      title={titleParts.join('\n')}
    >
      <span className="uppercase tracking-[0.08em]">{planLabel}</span>
      <span className="text-white/25">·</span>
      <span className="tabular-nums font-medium text-white/70">
        {limit == null ? count : `${count}/${limit}`}
      </span>
      <span className="hidden text-white/40 lg:inline">clients</span>
    </Link>
  )
}
