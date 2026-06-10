'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import BodyMap from '../BodyMap'
import type { MuscleGroup } from '@/lib/client/muscleDetection'
import { useClientT } from '@/components/client/ClientI18nProvider'

export type SmartWorkoutWidgetProps = {
  state: 'scheduled' | 'rest' | 'no_program'
  session?: {
    id: string
    sessionLogHref: string
    name: string
    exerciseCount: number
    estimatedMinutes: number
    primaryMuscles: MuscleGroup[]
    secondaryMuscles: MuscleGroup[]
    musclePills: string[]
  }
}

export default function SmartWorkoutWidget({ state, session }: SmartWorkoutWidgetProps) {
  const { t } = useClientT()
  if (state === 'rest') {
    return (
      <div className="bg-[#111111] rounded-2xl p-5">
        <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/30 mb-2">{t('smart.workout.session')}</div>
        <p className="text-[14px] font-semibold text-white/50">{t('smart.workout.rest')} 💤</p>
        <p className="text-[11px] text-white/30 mt-1">{t('smart.workout.rest.enjoy')}</p>
        <Link href="/client" className="inline-block mt-3 text-[10px] text-[#f2f2f2] uppercase tracking-[0.1em] font-bold">{t('smart.workout.addActivity')}</Link>
      </div>
    )
  }

  if (state === 'no_program' || !session) {
    return (
      <div className="bg-[#111111] rounded-2xl p-5">
        <div className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/30 mb-2">{t('smart.workout.session')}</div>
        <p className="text-[14px] font-semibold text-white/50">{t('smart.workout.noProgram')}</p>
      </div>
    )
  }

  return (
    <Link
      href="/client/programme"
      className="block bg-[#111111] rounded-2xl p-5 active:scale-[0.99] transition-transform"
    >
      <div className="flex items-baseline justify-between mb-3">
        <span className="font-barlow-condensed font-bold uppercase tracking-[0.18em] text-[11px] text-white/30">{t('smart.workout.session')}</span>
        <ChevronRight size={14} className="text-white/30" />
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-semibold tracking-[-0.01em] text-white leading-tight">{session.name}</div>
          <div className="text-[11px] text-white/40 mt-1">{session.exerciseCount} ex · ~{session.estimatedMinutes}min</div>
          <div className="flex flex-wrap gap-1 mt-2">
            {session.musclePills.slice(0, 3).map(p => (
              <span key={p} className="bg-[#f2f2f2]/10 text-[#f2f2f2] text-[9px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-md">{p}</span>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between w-full h-9 rounded-xl bg-[#1a1a1a] px-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#f2f2f2]">{t('smart.workout.start')}</span>
            <ChevronRight size={13} className="text-[#f2f2f2]" />
          </div>
        </div>
        <div className="w-20 shrink-0 flex items-center justify-center">
          <BodyMap
            primaryGroups={new Set(session.primaryMuscles)}
            secondaryGroups={new Set(session.secondaryMuscles)}
            className="w-20 h-[120px]"
          />
        </div>
      </div>
    </Link>
  )
}
