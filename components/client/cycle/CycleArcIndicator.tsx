'use client'

import type { CyclePhase } from '@/lib/cycle/cycleEngine'

const PHASE_COLORS: Record<CyclePhase, string> = {
  follicular: '#22c55e',
  ovulatory:  '#fbbf24',
  luteal:     '#a855f7',
  menstrual:  '#ef4444',
}

const PHASE_LABELS: Record<CyclePhase, string> = {
  follicular: 'Folliculaire',
  ovulatory:  'Ovulation',
  luteal:     'Lutéale',
  menstrual:  'Règles',
}

function getPhaseProgress(
  phase: CyclePhase,
  cycleDay: number,
  avgCycleLength: number,
  menstrualLength: number,
): { elapsed: number; total: number } {
  const ovulationDay = Math.floor(avgCycleLength / 2)
  switch (phase) {
    case 'menstrual':  return { elapsed: cycleDay - 1,                       total: menstrualLength }
    case 'follicular': return { elapsed: cycleDay - menstrualLength - 1,     total: Math.max(1, ovulationDay - menstrualLength - 1) }
    case 'ovulatory':  return { elapsed: cycleDay - ovulationDay,            total: 2 }
    case 'luteal':     return { elapsed: cycleDay - (ovulationDay + 2),      total: Math.max(1, avgCycleLength - ovulationDay - 2) }
  }
}

function SvgArc({ pct, color, size = 22 }: { pct: number; color: string; size?: number }) {
  const r = (size - 4) / 2
  const cx = size / 2
  const circumference = 2 * Math.PI * r
  const filled = Math.max(0, Math.min(1, pct)) * circumference

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={cx} cy={cx} r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={2.5}
      />
      {filled > 0 && (
        <circle
          cx={cx} cy={cx} r={r}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform={`rotate(-90, ${cx}, ${cx})`}
        />
      )}
    </svg>
  )
}

interface Props {
  phase: CyclePhase
  cycleDay: number
  avgCycleLength?: number
  menstrualLength?: number
  confidence?: 'estimated' | 'learning' | 'calibrated'
  onClick?: () => void
}

export default function CycleArcIndicator({
  phase,
  cycleDay,
  avgCycleLength = 28,
  menstrualLength = 5,
  confidence,
  onClick,
}: Props) {
  const phaseColor = PHASE_COLORS[phase]
  const phaseLabel = PHASE_LABELS[phase]

  const { elapsed, total } = getPhaseProgress(phase, cycleDay, avgCycleLength, menstrualLength)
  const phasePct = total > 0 ? Math.max(0, elapsed) / total : 0
  const cyclePct = cycleDay / avgCycleLength

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-1 rounded-xl active:bg-white/[0.04] transition-colors"
    >
      <div className="flex items-center gap-1">
        <SvgArc pct={phasePct} color={phaseColor} />
        <SvgArc pct={cyclePct} color="rgba(255,255,255,0.35)" />
      </div>
      <div className="text-left">
        <p
          className="font-barlow-condensed font-bold uppercase tracking-[0.12em] text-[10px] leading-tight"
          style={{ color: phaseColor }}
        >
          {phaseLabel}
        </p>
        <p className="text-[8px] text-white/30 leading-tight">
          J{cycleDay}/{avgCycleLength}
          {confidence === 'estimated' && ' ◐'}
        </p>
      </div>
    </button>
  )
}
