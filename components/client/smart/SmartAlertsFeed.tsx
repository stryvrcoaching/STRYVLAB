'use client'

import { useState } from 'react'
import { Bell, CaretDown, CaretUp, WarningCircle, Warning, Info } from '@phosphor-icons/react'
import type { ElementType } from 'react'
import { cn } from '@/app/lib/utils'
import type { SignalTone } from '@/components/client/smart/DashboardSignalCard'
import {
  DASHBOARD_SIGNAL_COLORS,
  DashboardSectionIcon,
} from '@/components/client/DashboardSectionIcon'

export type GenericAlert = {
  code: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  body?: string
}

const SEVERITY_CFG: Record<
  GenericAlert['severity'],
  { tone: SignalTone; eyebrow: string; Icon: ElementType }
> = {
  info: { tone: 'info', eyebrow: 'Info', Icon: Info },
  warning: { tone: 'warning', eyebrow: 'Attention', Icon: Warning },
  critical: { tone: 'attention', eyebrow: 'Critique', Icon: WarningCircle },
}

const TONE_DOT: Record<SignalTone, string> = {
  success: 'bg-[#5dba87]',
  warning: 'bg-[#f2c94c]',
  attention: 'bg-[#ff8660]',
  info: 'bg-[#7aa7ff]',
  neutral: 'bg-white/30',
}

function AlertRow({ alert }: { alert: GenericAlert }) {
  const cfg = SEVERITY_CFG[alert.severity]
  const Icon = cfg.Icon

  return (
    <div className="flex w-full items-start gap-3 rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.03] p-3.5 text-left transition-colors active:bg-white/[0.05]">
      <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
        <Icon size={16} className="text-white/70" weight="fill" />
        <span
          className={cn(
            'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full',
            TONE_DOT[cfg.tone],
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
          {cfg.eyebrow}
        </p>
        <p className="mt-0.5 text-[13px] font-medium leading-snug text-white">
          {alert.title}
        </p>
        {alert.body ? (
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-white/45">
            {alert.body}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Nutrition alerts feed: styled identically to Accueil HomeNotificationsSection.
 */
export default function SmartAlertsFeed({ alerts }: { alerts: GenericAlert[] }) {
  const [expanded, setExpanded] = useState(false)

  if (alerts.length === 0) return null

  const latest = alerts[0]
  const rest = alerts.slice(1)
  const hasMore = rest.length > 0

  return (
    <section className="overflow-hidden rounded-2xl border-[0.3px] border-white/[0.04] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
        <div className="flex items-center gap-2">
          <DashboardSectionIcon color={DASHBOARD_SIGNAL_COLORS.attention}>
            <Bell size={15} weight="fill" />
          </DashboardSectionIcon>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Notifications Nutrition
          </p>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff8660]/15 px-1.5 text-[10px] font-bold tabular-nums text-[#ff8660]">
            {alerts.length}
          </span>
        </div>
        {hasMore ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-white/45 transition-colors hover:text-white/70"
            aria-expanded={expanded}
          >
            {expanded ? 'Réduire' : `Tout voir (${alerts.length})`}
            {expanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 pt-1">
        <AlertRow alert={latest} />
        {expanded && hasMore
          ? rest.map((a) => (
              <AlertRow key={`${a.code}-${a.title}`} alert={a} />
            ))
          : null}
      </div>
    </section>
  )
}
