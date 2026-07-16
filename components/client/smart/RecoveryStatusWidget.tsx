'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import {
  computeRecoveryAlerts,
  type RecoveryAlert,
  type CheckinData,
} from '@/lib/client/smart/recoveryAlerts'
import { useClientT } from '@/components/client/ClientI18nProvider'

export type RecoveryStatusWidgetProps = {
  morningCheckin: CheckinData | null
  plannedSessionToday: boolean
}

export default function RecoveryStatusWidget({
  morningCheckin,
  plannedSessionToday,
}: RecoveryStatusWidgetProps) {
  const { t } = useClientT()
  const [alerts, setAlerts] = useState<RecoveryAlert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const computed = computeRecoveryAlerts(morningCheckin, plannedSessionToday)
    setAlerts(computed)

    // Load dismissed alerts from localStorage
    const key = `recovery_dismissed_${new Date().toISOString().split('T')[0]}`
    const stored = localStorage.getItem(key)
    if (stored) {
      try {
        setDismissed(new Set(JSON.parse(stored)))
      } catch {
        // ignore parse errors
      }
    }
  }, [morningCheckin, plannedSessionToday])

  const handleDismiss = (alertId: string) => {
    const newDismissed = new Set(dismissed)
    newDismissed.add(alertId)
    setDismissed(newDismissed)

    // Persist to localStorage
    const key = `recovery_dismissed_${new Date().toISOString().split('T')[0]}`
    localStorage.setItem(key, JSON.stringify(Array.from(newDismissed)))
  }

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id))

  if (!mounted || visibleAlerts.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {visibleAlerts.map((alert) => (
        <div
          key={alert.id}
          className="relative bg-[#111111] rounded-xl overflow-hidden"
          style={{
            borderLeft: `4px solid ${alert.color}`,
          }}
        >
          <div className="p-3 pr-8">
            {/* Title + Icon */}
            <div className="flex items-start gap-2 mb-1">
              {alert.severity === 'critical' && (
                <AlertCircle
                  size={16}
                  className="shrink-0 mt-0.5"
                  style={{ color: alert.color }}
                />
              )}
              {alert.severity === 'warning' && (
                <AlertCircle
                  size={16}
                  className="shrink-0 mt-0.5"
                  style={{ color: alert.color }}
                />
              )}
              {alert.severity === 'info' && (
                <CheckCircle2
                  size={16}
                  className="shrink-0 mt-0.5"
                  style={{ color: alert.color }}
                />
              )}
              <h3
                className="text-[12px] font-bold text-white"
                style={{ color: alert.severity === 'info' ? '#10b981' : 'white' }}
              >
                {alert.title}
              </h3>
            </div>

            {/* Body */}
            <p className="text-[11px] text-white/55 mb-2">
              {alert.body}
            </p>

            {/* Recommendation */}
            <div className="pt-1 mt-1">
              <p className="text-[10px] text-white/40 italic">
                {alert.recommendation}
              </p>
            </div>
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => handleDismiss(alert.id)}
            className="absolute top-2 right-2 p-1 hover:bg-white/[0.06] rounded-lg transition-colors"
            aria-label={t('deload.banner.dismiss')}
          >
            <X size={14} className="text-white/40 hover:text-white/60" />
          </button>
        </div>
      ))}
    </div>
  )
}
