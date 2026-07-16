'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { useClientT } from '@/components/client/ClientI18nProvider'

type FlexWorkout = {
  session: {
    id: string
    started_at: string
    ended_at: string | null
    type: string
    relation_to_planned_workout: string | null
  }
  exercises: Array<{
    id: string
    display_name: string
    sets: Array<{ id: string }>
  }>
  summary: {
    total_sets: number
    hard_sets: number
    tonnage: number
    duration_seconds: number | null
    muscle_group_volume: Record<string, number>
  }
}

function formatDate(dateIso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
  }).format(new Date(dateIso))
}

function resolveLabel(item: FlexWorkout['session'], t: ReturnType<typeof useClientT>['t']) {
  if (item.relation_to_planned_workout === 'replace' || item.type === 'replacement') {
    return t('flex.label.replacement')
  }
  if (item.relation_to_planned_workout === 'bonus' || item.type === 'bonus') {
    return t('flex.label.bonus')
  }
  return t('flex.label.free')
}

export default function RecentFlexWorkoutsStrip({ sessions }: { sessions: FlexWorkout[] }) {
  const { lang, t } = useClientT()
  const locale = lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-GB' : 'fr-FR'
  if (sessions.length === 0) return null

  return (
    <div className="bg-[#111111] rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white">
          Flex Workout
        </div>
        <Badge variant="secondary" className="bg-white/[0.06] text-white/75">
          {t('flex.badge')}
        </Badge>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {sessions.map((item) => (
          <Link
            key={item.session.id}
            href={`/client/flex-workout/recap/${item.session.id}`}
            className="min-w-[160px] bg-white/[0.02] rounded-xl p-3 shrink-0 border border-white/[0.05] transition-colors hover:bg-white/[0.04]"
          >
            <div className="text-[10px] text-white/40 tabular-nums">
              {formatDate(item.session.ended_at ?? item.session.started_at, locale)}
            </div>
            <div className="mt-1 text-[14px] font-black text-white">
              {resolveLabel(item.session, t)}
            </div>
            <div className="text-[10px] text-white/55 mt-0.5">
              {item.exercises.length} ex. · {item.summary.total_sets} sets
            </div>
            <div className="text-[10px] text-white/35 mt-2">
              {item.summary.tonnage} kg
              {item.summary.hard_sets > 0 ? ` · ${item.summary.hard_sets} hard sets` : ''}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
