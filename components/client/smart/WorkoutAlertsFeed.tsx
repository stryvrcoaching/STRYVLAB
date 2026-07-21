'use client'

import { useState } from 'react'
import { Barbell, CaretDown, CaretUp, Trophy, WarningCircle, Info, Lightning } from '@phosphor-icons/react'
import type { ElementType } from 'react'
import Link from 'next/link'
import { cn } from '@/app/lib/utils'
import type { WorkoutAlert } from '@/lib/client/smart/workoutAlerts'
import type { SignalTone } from '@/components/client/smart/DashboardSignalCard'
import { emitClientInboxUpdated } from '@/lib/client/inboxEvents'
import { sendClientMutation } from '@/lib/client/offline-mutations'

const TONE_DOT: Record<SignalTone, string> = {
  success: 'bg-[#5dba87]',
  warning: 'bg-[#f2c94c]',
  attention: 'bg-[#ff8660]',
  info: 'bg-[#7aa7ff]',
  neutral: 'bg-white/30',
}

const ALERT_ICON: Record<string, ElementType> = {
  pr_broken: Trophy,
  mesocycle_start: Barbell,
  deload_recommended: Lightning,
}

function WorkoutAlertRow({ alert }: { alert: WorkoutAlert }) {
  const Icon = ALERT_ICON[alert.code] ?? Info

  const markRead = () => {
    if (!alert.notificationId) return
    emitClientInboxUpdated()
    void sendClientMutation({
      kind: 'notification',
      url: `/api/client/notifications/${alert.notificationId}`,
      method: 'PATCH',
    }).then((result) => {
      if (!result.queued && !result.response?.ok) emitClientInboxUpdated()
    })
  }

  const content = (
    <div className="flex w-full items-start gap-3 rounded-xl border-[0.3px] border-white/[0.06] bg-white/[0.03] p-3.5 text-left transition-colors active:bg-white/[0.05]">
      <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
        <Icon size={16} className="text-white/70" weight="fill" />
        <span
          className={cn(
            'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full',
            TONE_DOT[alert.tone],
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        {alert.eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            {alert.eyebrow}
          </p>
        ) : null}
        <p className="mt-0.5 text-[13px] font-medium leading-snug text-white">
          {alert.title}
        </p>
        {alert.body ? (
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-white/45">
            {alert.body}
          </p>
        ) : null}
      </div>
      {alert.label ? (
        <span className="shrink-0 self-center text-[11px] font-semibold text-[#5dba87]">
          {alert.label}
        </span>
      ) : null}
    </div>
  )

  if (alert.href) {
    return (
      <Link href={alert.href} onClick={markRead} className="block w-full">
        {content}
      </Link>
    )
  }

  return content
}

/**
 * Workout notifications center feed: styled identically to Accueil HomeNotificationsSection.
 */
export default function WorkoutAlertsFeed({ alerts }: { alerts: WorkoutAlert[] }) {
  const [expanded, setExpanded] = useState(false)

  if (!alerts || alerts.length === 0) return null

  const latest = alerts[0]
  const rest = alerts.slice(1)
  const hasMore = rest.length > 0

  return (
    <section className="overflow-hidden rounded-2xl border-[0.3px] border-white/[0.04] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2 px-1 pb-2 pt-1">
        <div className="flex items-center gap-2">
          <Barbell size={14} className="text-white/40" weight="fill" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Notifications Séance
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
        <WorkoutAlertRow alert={latest} />
        {expanded && hasMore
          ? rest.map((a) => (
              <WorkoutAlertRow key={a.id} alert={a} />
            ))
          : null}
      </div>
    </section>
  )
}
