'use client'

import type { CyclePhase } from '@/lib/cycle/cycleEngine'

const PHASE_COLORS: Record<CyclePhase, string> = {
  follicular: '#22c55e',
  ovulatory:  '#fbbf24',
  luteal:     '#a855f7',
  menstrual:  '#ef4444',
}

const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual:  'Menstruation',
  follicular: 'Folliculaire',
  ovulatory:  'Ovulation',
  luteal:     'Lutéale',
}

interface Props {
  phase: CyclePhase
  cycleDay: number
  confidence: 'estimated' | 'learning' | 'calibrated'
  size?: 'sm' | 'md'
}

export default function CyclePhasePill({ phase, cycleDay, confidence, size = 'md' }: Props) {
  const color = PHASE_COLORS[phase]
  const label = PHASE_LABELS[phase]
  const isSm = size === 'sm'

  return (
    <div className={`flex items-center gap-1.5 ${isSm ? 'px-2 py-0.5' : 'px-2.5 py-1'} rounded-full bg-white/[0.04] border border-white/[0.06]`}>
      <span
        className={`shrink-0 rounded-full ${isSm ? 'w-1.5 h-1.5' : 'w-2 h-2'}`}
        style={{ background: color }}
      />
      <span className={`font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[#e0e0e0] ${isSm ? 'text-[9px]' : 'text-[10px]'}`}>
        {label} · J{cycleDay}
      </span>
      {confidence === 'estimated' && (
        <span className={`text-[#5a5a5a] ${isSm ? 'text-[8px]' : 'text-[9px]'}`}>◐</span>
      )}
    </div>
  )
}
