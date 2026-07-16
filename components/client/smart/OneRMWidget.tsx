'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { OneRMTrend } from '@/lib/training/oneRepMax'
import { useClientT } from '@/components/client/ClientI18nProvider'

interface OneRMWidgetProps {
  clientId: string
  exerciseDict?: Record<string, string>
}

export default function OneRMWidget({ clientId, exerciseDict = {} }: OneRMWidgetProps) {
  const { t } = useClientT()
  const [trends, setTrends] = useState<OneRMTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/client/one-rm-trends')
        if (!res.ok) throw new Error('Failed to fetch 1RM trends')
        const data = await res.json()
        setTrends(data.trends ?? [])
      } catch (err) {
        console.error('Fetch error:', err)
        setError(t('performance.error.load'))
      } finally {
        setLoading(false)
      }
    }

    fetchTrends()
  }, [t])

  if (loading) {
    return (
      <div className="rounded-2xl bg-[#161616] p-4">
        <div className="mb-3 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-white/40">
          {t('performance.estimatedStrength')}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-14 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error || trends.length === 0) {
    return (
      <div className="rounded-2xl bg-[#161616] p-4">
        <h3 className="mb-3 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-white/40">
          {t('performance.estimatedStrength')}
        </h3>
        <div className="rounded-2xl bg-black/[0.12] px-4 py-5 text-center">
          <p className="text-[13px] text-white/50">
            {error || t('performance.notEnoughData')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-[#161616] p-4">
      <h3 className="mb-3 text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-white/40">
        {t('performance.estimatedStrength')}
      </h3>
      <div className="space-y-2">
        {trends.map((trend, idx) => {
          const isPositive = trend.percentChange >= 0
          const deltaColor = 'text-[#b0b0b0]'
          const deltaBgColor = 'bg-white/[0.06]'

          return (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 rounded-2xl bg-black/[0.12] px-4 py-3 transition-colors hover:bg-black/[0.18]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white/80">
                  {exerciseDict[trend.exercise] || trend.exercise}
                </p>
                <p className="mt-0.5 text-[11px] text-white/40">
                  {t('performance.estimated', { value: trend.current1RM.toFixed(1) })}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-[16px] font-black text-white tabular-nums">
                    ~{trend.current1RM.toFixed(1)}kg
                  </p>
                </div>

                <div className={`${deltaBgColor} ${deltaColor} flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1`}>
                  {isPositive ? (
                    <TrendingUp size={13} className="text-[#b0b0b0]" />
                  ) : (
                    <TrendingDown size={13} className="text-[#b0b0b0]" />
                  )}
                  <span className="text-[11px] font-bold">
                    {isPositive ? '+' : ''}{trend.percentChange}%
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
