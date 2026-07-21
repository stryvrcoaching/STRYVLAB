'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, Lock } from 'lucide-react'

/**
 * Compact lock card when a feature requires Pro / live subscription.
 */
export default function PlanUpgradeCard({
  title,
  reason,
  ctaLabel = 'Passer en Pro',
}: {
  title: string
  reason: string
  ctaLabel?: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/coach-platform/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro' }),
      })
      const data = await res.json().catch(() => null)
      if (res.status === 409 && data?.portalUrl) {
        window.location.href = data.portalUrl
        return
      }
      if (res.ok && data?.url) {
        window.location.href = data.url
        return
      }
      router.push('/coach/settings?section=plan&intent=upgrade_pro')
    } catch {
      router.push('/coach/settings?section=plan&intent=upgrade_pro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400/80">
          <Lock size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-white/85">{title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/45">{reason}</p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleUpgrade()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#1f8a65] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#217356] disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <>
                {ctaLabel}
                <ArrowRight size={12} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
