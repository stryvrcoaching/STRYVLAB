'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { OneRMTrend } from '@/lib/training/oneRepMax'

interface OneRMWidgetProps {
  clientId: string
}

export default function OneRMWidget({ clientId }: OneRMWidgetProps) {
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
        setError('Impossible de charger les données')
      } finally {
        setLoading(false)
      }
    }

    fetchTrends()
  }, [])

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (error || trends.length === 0) {
    return (
      <div className="text-center py-4 px-4 bg-[#111111] rounded-xl">
        <p className="text-[13px] text-white/50">
          {error || 'Pas assez de données pour calculer les tendances'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-barlow-condensed font-bold uppercase tracking-[0.16em] text-white/40 mb-3">
        Force estimée (1RM)
      </h3>
      {trends.map((trend, idx) => {
        const isPositive = trend.percentChange >= 0
        const deltaColor = 'text-[#b0b0b0]'
        const deltaBgColor = 'bg-white/[0.06]'

        return (
          <div
            key={idx}
            className="bg-[#111111] rounded-xl px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white/80 truncate">
                {trend.exercise}
              </p>
              <p className="text-[11px] text-white/40 mt-0.5">
                Estimé {trend.current1RM.toFixed(1)}kg
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* 1RM value */}
              <div className="text-right">
                <p className="text-[16px] font-black text-white tabular-nums">
                  ~{trend.current1RM.toFixed(1)}kg
                </p>
              </div>

              {/* Delta pill */}
              <div className={`${deltaBgColor} ${deltaColor} px-2.5 py-1 rounded-lg flex items-center gap-1.5 shrink-0`}>
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
  )
}
