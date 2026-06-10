'use client'

import { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { useClientT } from '@/components/client/ClientI18nProvider'

export type GenericAlert = {
  code: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  body?: string
}

const SEVERITY: Record<GenericAlert['severity'], { bg: string; text: string; Icon: React.ElementType }> = {
  info:     { bg: 'bg-white/[0.04]',   text: 'text-[#b0b0b0]',  Icon: Info },
  warning:  { bg: 'bg-white/[0.04]',  text: 'text-[#b0b0b0]', Icon: AlertTriangle },
  critical: { bg: 'bg-white/[0.04]',    text: 'text-[#b0b0b0]',   Icon: AlertCircle },
}

export default function SmartAlertsFeed({ alerts }: { alerts: GenericAlert[] }) {
  const { t } = useClientT()
  const [expanded, setExpanded] = useState(false)
  if (alerts.length === 0) return null
  const visible = expanded ? alerts : alerts.slice(0, 3)
  const remaining = alerts.length - 3

  return (
    <div className="space-y-2">
      {visible.map(a => {
        const cfg = SEVERITY[a.severity]
        return (
          <div key={`${a.code}-${a.title}`} className="bg-[#111111] rounded-2xl p-3 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
              <cfg.Icon size={16} className={cfg.text} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-white">{a.title}</p>
              {a.body && <p className="text-[11px] text-white/55 mt-1 leading-relaxed">{a.body}</p>}
            </div>
          </div>
        )
      })}
      {!expanded && remaining > 0 && (
        <button onClick={() => setExpanded(true)} className="w-full text-[10px] text-white/40 flex items-center justify-center gap-1 py-2">
          {t('smart.alerts.seeMore', { n: String(remaining) })} <ChevronDown size={12} />
        </button>
      )}
      {expanded && alerts.length > 3 && (
        <button onClick={() => setExpanded(false)} className="w-full text-[10px] text-white/40 flex items-center justify-center gap-1 py-2">
          {t('smart.alerts.collapse')} <ChevronUp size={12} />
        </button>
      )}
    </div>
  )
}
