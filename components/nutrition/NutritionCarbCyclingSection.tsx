'use client'

import type { DayDraft } from '@/lib/nutrition/types'

const TYPES = [
  { value: 'high',   label: 'Haute',   desc: "Jour d'entraînement intense",  color: 'text-green-400', bg: 'bg-green-500/10',  border: 'border-green-500/20' },
  { value: 'medium', label: 'Moyenne', desc: "Jour d'entraînement modéré",   color: 'text-blue-400',  bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  { value: 'low',    label: 'Basse',   desc: 'Jour de repos ou cardio léger', color: 'text-amber-400', bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
] as const

interface Props {
  day: DayDraft
  onDayChange: (updates: Partial<DayDraft>) => void
}

export default function NutritionCarbCyclingSection({ day, onDayChange }: Props) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-3">Type de charge glucidique</p>
      <div className="grid grid-cols-3 gap-2">
        {TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => onDayChange({ carb_cycle_type: day.carb_cycle_type === t.value ? '' : t.value as DayDraft['carb_cycle_type'] })}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border-[0.3px] text-center transition-all ${
              day.carb_cycle_type === t.value
                ? `${t.bg} ${t.border} ${t.color}`
                : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:bg-white/[0.04]'
            }`}
          >
            <span className="text-[12px] font-bold">{t.label}</span>
            <span className="text-[9px] leading-snug opacity-70">{t.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
