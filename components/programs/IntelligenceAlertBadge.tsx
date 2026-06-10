'use client'

import { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, X, ArrowRight } from 'lucide-react'
import type { IntelligenceAlert } from '@/lib/programs/intelligence'

interface Props {
  alerts: IntelligenceAlert[]
  onOpenAlternatives?: () => void
}

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    border: 'border-red-500/40',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    iconColor: 'text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    iconColor: 'text-amber-400',
  },
  info: {
    icon: Info,
    border: 'border-white/[0.06]',
    bg: 'bg-white/[0.02]',
    text: 'text-white/50',
    iconColor: 'text-white/30',
  },
}

export default function IntelligenceAlertBadge({ alerts, onOpenAlternatives }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)

  const visible = alerts.filter(a => !dismissed.has(a.code + (a.exerciseIndex ?? '')))
  const shown = visible.slice(0, 2)
  const hidden = visible.length - 2

  if (visible.length === 0) return null

  return (
    <div className="flex flex-col gap-1 mt-1.5">
      {shown.map((alert, i) => {
        const cfg = SEVERITY_CONFIG[alert.severity]
        const Icon = cfg.icon
        const key = alert.code + (alert.exerciseIndex ?? '') + i
        const isExpanded = expanded === key

        return (
          <div
            key={key}
            className={`rounded-xl border ${cfg.border} ${cfg.bg} px-3 py-2`}
          >
            <div className="flex items-start gap-2">
              <Icon size={12} className={`${cfg.iconColor} mt-0.5 shrink-0`} />
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : key)}
                  className={`text-[11px] font-semibold ${cfg.text} text-left w-full`}
                >
                  {alert.title}
                </button>
                {isExpanded && (
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    <p className="text-[10px] text-white/50 leading-relaxed">{alert.explanation}</p>
                    <p className={`text-[10px] font-medium ${cfg.text}`}>→ {alert.suggestion}</p>
                    {onOpenAlternatives && (
                      <button
                        type="button"
                        onClick={onOpenAlternatives}
                        className="flex items-center gap-1 text-[10px] font-semibold text-[#1f8a65] hover:opacity-80 transition-opacity mt-0.5"
                      >
                        <ArrowRight size={10} />
                        Voir les alternatives
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDismissed(prev => new Set(Array.from(prev).concat(alert.code + (alert.exerciseIndex ?? ''))))}
                className="text-white/30 hover:text-white/60 transition-colors shrink-0"
              >
                <X size={10} />
              </button>
            </div>
          </div>
        )
      })}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded('all')}
          className="text-[10px] text-white/40 hover:text-white/60 transition-colors text-left pl-1"
        >
          +{hidden} alerte{hidden > 1 ? 's' : ''} supplémentaire{hidden > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
