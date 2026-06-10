"use client"

import { Moon } from 'lucide-react'
import type { CyclePhase, CycleSyncAdjustment } from '@/lib/nutrition/engine/cycleSync'

const PHASE_LABELS: Record<CyclePhase, string> = {
  menstrual: 'Menstruation',
  follicular: 'Phase folliculaire',
  ovulatory: 'Phase ovulatoire',
  luteal: 'Phase lutéale',
}

const PHASE_COLORS: Record<CyclePhase, { bg: string; border: string; dot: string }> = {
  menstrual:  { bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.18)',   dot: '#ef4444' },
  follicular: { bg: 'rgba(34,197,94,0.06)',   border: 'rgba(34,197,94,0.18)',   dot: '#22c55e' },
  ovulatory:  { bg: 'rgba(251,191,36,0.06)',  border: 'rgba(251,191,36,0.18)',  dot: '#fbbf24' },
  luteal:     { bg: 'rgba(168,85,247,0.06)',  border: 'rgba(168,85,247,0.18)',  dot: '#a855f7' },
}

interface Props {
  phase: CyclePhase
  adjustment: CycleSyncAdjustment
  cycleDay?: number
}

export default function CycleSyncBanner({ phase, adjustment, cycleDay }: Props) {
  const colors = PHASE_COLORS[phase]
  const label = PHASE_LABELS[phase]

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: colors.bg, border: `0.3px solid ${colors.border}` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: colors.border }}>
            <Moon size={10} style={{ color: colors.dot }} />
          </div>
          <div>
            <p className="text-[9px] font-barlow-condensed font-bold uppercase tracking-[0.18em] text-white/30">
              Cycle Sync
            </p>
            <p className="text-[13px] font-semibold text-white/90">{label}</p>
          </div>
        </div>
        {cycleDay && (
          <span className="text-[10px] text-white/30 font-mono">J{cycleDay}</span>
        )}
      </div>

      {/* Macro adjustments */}
      {(adjustment.caloriesDelta !== 0 || adjustment.proteinDelta !== 0 || adjustment.carbsDelta !== 0) && (
        <div className="grid grid-cols-3 gap-2">
          {adjustment.caloriesDelta !== 0 && (
            <div className="rounded-xl bg-white/[0.04] px-2 py-1.5 text-center">
              <p className="text-[18px] font-bold" style={{ color: colors.dot }}>
                {adjustment.caloriesDelta > 0 ? '+' : ''}{adjustment.caloriesDelta}
              </p>
              <p className="text-[9px] text-white/30 font-barlow-condensed uppercase tracking-[0.12em]">kcal</p>
            </div>
          )}
          {adjustment.proteinDelta !== 0 && (
            <div className="rounded-xl bg-white/[0.04] px-2 py-1.5 text-center">
              <p className="text-[18px] font-bold text-[color:var(--data-copper)]">
                {adjustment.proteinDelta > 0 ? '+' : ''}{adjustment.proteinDelta}g
              </p>
              <p className="text-[9px] text-white/30 font-barlow-condensed uppercase tracking-[0.12em]">protéines</p>
            </div>
          )}
          {adjustment.carbsDelta !== 0 && (
            <div className="rounded-xl bg-white/[0.04] px-2 py-1.5 text-center">
              <p className="text-[18px] font-bold text-[color:var(--data-gold)]">
                {adjustment.carbsDelta > 0 ? '+' : ''}{adjustment.carbsDelta}g
              </p>
              <p className="text-[9px] text-white/30 font-barlow-condensed uppercase tracking-[0.12em]">glucides</p>
            </div>
          )}
        </div>
      )}

      {/* Optimal deficit badge */}
      {adjustment.optimalForDeficit && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.04] w-fit">
          <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
          <p className="text-[10px] text-white/50">Phase optimale pour le déficit</p>
        </div>
      )}

      {/* First note */}
      <p className="text-[11px] text-white/40 leading-relaxed">
        {adjustment.notes[0]}
      </p>
    </div>
  )
}
