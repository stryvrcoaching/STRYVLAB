'use client'

import type { DayDraft } from '@/lib/nutrition/types'

const PHASES = [
  {
    value: 'follicular',
    label: 'Folliculaire',
    days: 'J1–J13',
    desc: 'Énergie en hausse, métabolisme bas. Favoriser glucides complexes et protéines maigres.',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
  },
  {
    value: 'ovulatory',
    label: 'Ovulatoire',
    days: 'J14–J16',
    desc: 'Pic de testostérone et œstrogènes. Priorité aux entraînements intenses et protéines.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  {
    value: 'luteal',
    label: 'Lutéale',
    days: 'J17–J28',
    desc: 'Métabolisme +100–300 kcal. Augmenter légèrement lipides et glucides. Réduire sodium.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    value: 'menstrual',
    label: 'Menstruelle',
    days: 'J1–J5',
    desc: 'Réduire inflammation. Anti-oxydants, oméga-3, magnésium, éviter alcool et caféine.',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
] as const

interface Props {
  day: DayDraft
  onDayChange: (updates: Partial<DayDraft>) => void
}

export default function NutritionCycleSyncSection({ day, onDayChange }: Props) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-3">Phase du cycle menstruel</p>
      <div className="grid grid-cols-2 gap-2">
        {PHASES.map(p => (
          <button
            key={p.value}
            onClick={() => onDayChange({ cycle_sync_phase: day.cycle_sync_phase === p.value ? '' : p.value as DayDraft['cycle_sync_phase'] })}
            className={`flex flex-col items-start gap-1 p-3 rounded-xl border-[0.3px] text-left transition-all ${
              day.cycle_sync_phase === p.value
                ? `${p.bg} ${p.border} ${p.color}`
                : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[12px] font-bold">{p.label}</span>
              <span className="text-[9px] opacity-60">{p.days}</span>
            </div>
            <span className="text-[9px] leading-snug opacity-70">{p.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
