'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, AlertCircle, Zap, X } from 'lucide-react'
import type { DeloadSignal } from '@/lib/training/deloadDetection'
import { useClientT } from '@/components/client/ClientI18nProvider'

interface DeloadAlertBannerProps {
  clientId: string
}

export default function DeloadAlertBanner({ clientId }: DeloadAlertBannerProps) {
  const { t } = useClientT()
  const [signals, setSignals] = useState<DeloadSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const fetchDeloadStatus = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/client/deload-status')
        if (!res.ok) throw new Error('Failed to fetch deload status')
        const data = await res.json()
        setSignals(data.signals ?? [])
      } catch (err) {
        console.error('Fetch error:', err)
        setSignals([])
      } finally {
        setLoading(false)
      }
    }

    fetchDeloadStatus()
  }, [])

  if (loading) return null

  if (dismissed || signals.length === 0) {
    return null
  }

  // Show only critical signals, or the first warning
  const prioritySignal = signals.find(s => s.severity === 'critical') || signals[0]

  const isCritical = prioritySignal.severity === 'critical'
  const bgColor = 'bg-white/[0.04] border-white/[0.04]'
  const iconColor = 'text-[#b0b0b0]'
  const titleColor = 'text-[#e0e0e0]'
  const textColor = 'text-white/70'

  return (
    <div className={`border ${bgColor} rounded-xl px-4 py-3 space-y-2`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          {isCritical ? (
            <AlertTriangle size={18} className={`${iconColor} shrink-0 mt-0.5`} />
          ) : (
            <AlertCircle size={18} className={`${iconColor} shrink-0 mt-0.5`} />
          )}

          <div className="flex-1 min-w-0">
            <p className={`text-[13px] font-semibold ${titleColor}`}>
              {prioritySignal.title}
            </p>
            <p className={`text-[12px] ${textColor} mt-1`}>
              {prioritySignal.body}
            </p>
            <p className={`text-[11px] font-medium text-white/50 mt-2 flex items-start gap-2`}>
              <Zap size={12} className="mt-0.5 shrink-0" />
              {prioritySignal.recommendation}
            </p>
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-white/40 hover:text-white/60 transition-colors p-1"
          aria-label={t('ui.close.alert')}
        >
          <X size={16} />
        </button>
      </div>

      {/* Show count if multiple signals */}
      {signals.length > 1 && (
        <p className="text-[11px] text-white/40 pl-6">
          {t('smart.deload.signals', { n: String(signals.length - 1) })}
        </p>
      )}
    </div>
  )
}
