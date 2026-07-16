'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import BodyMap from '../BodyMap'
import { TRAINING_ACCENT } from '@/lib/nutrition/ui-colors'
import type { MuscleGroup } from '@/lib/client/muscleDetection'
import { useClientT } from '@/components/client/ClientI18nProvider'

type Props = {
  date: string
  state: 'scheduled' | 'completed' | 'rest'
  sessionName?: string
  sessionLogHref?: string
  recapHref?: string
  exerciseCount?: number
  estimatedMinutes?: number
  performanceSummary?: string
  primaryMuscles?: MuscleGroup[]
  secondaryMuscles?: MuscleGroup[]
  musclePills?: string[]
}

function fmt(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(iso + 'T00:00:00'))
}

export default function SmartWorkoutHero(p: Props) {
  const { lang, t } = useClientT()
  const locale = lang === 'es' ? 'es-ES' : lang === 'en' ? 'en-GB' : 'fr-FR'
  return (
    <div className="bg-[#111111] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[10px] text-white/40">{t('workout.today')}</span>
        <span className="text-[11px] text-white/40">{fmt(p.date, locale)}</span>
      </div>

      {p.state === 'scheduled' && p.sessionName && (
        <>
          <div className="flex gap-3 items-start">
            <div className="flex-1 min-w-0">
              <div className="text-[22px] font-black tracking-[-0.02em] text-white leading-tight">{p.sessionName}</div>
              <div className="text-[11px] text-white/50 mt-1">{t('workout.exercisesCount', { n: p.exerciseCount ?? 0 })} · ~{p.estimatedMinutes} min</div>
              {p.musclePills && p.musclePills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.musclePills.slice(0, 3).map(pill => (
                    <span key={pill} className="bg-[#f2f2f2]/10 text-[#f2f2f2] text-[9px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-md">{pill}</span>
                  ))}
                </div>
              )}
            </div>
            {p.primaryMuscles && p.primaryMuscles.length > 0 && (
              <div className="shrink-0">
                <BodyMap
                  primaryGroups={new Set(p.primaryMuscles)}
                  secondaryGroups={new Set(p.secondaryMuscles ?? [])}
                  className="w-16 h-[96px]"
                />
              </div>
            )}
          </div>
          {p.sessionLogHref && (
            <Link
              href={p.sessionLogHref}
              className="mt-4 flex w-full items-center justify-center h-11 rounded-xl bg-[#f2f2f2] text-[#080808] text-[11px] font-black uppercase tracking-[0.1em] active:scale-[0.98] transition-transform"
            >
              {t('workout.start')} →
            </Link>
          )}
        </>
      )}

      {p.state === 'completed' && (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(93,186,135,0.15)' }}>
            <CheckCircle2 size={18} style={{ color: TRAINING_ACCENT }} />
          </div>
          <div className="flex-1">
            <div className="text-[12px] text-white font-semibold">{t('workout.completed')}</div>
            <div className="text-[10px] text-white/40">{p.performanceSummary}</div>
          </div>
          {p.recapHref && <Link href={p.recapHref} className="text-[11px] text-[#f2f2f2]">{t('workout.see')} →</Link>}
        </div>
      )}

      {p.state === 'rest' && (
        <p className="text-[12px] text-white/55">{t('workout.restDay')}</p>
      )}
    </div>
  )
}
