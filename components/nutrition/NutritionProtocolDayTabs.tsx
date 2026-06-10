'use client'

import { Plus, X } from 'lucide-react'
import type { DayDraft } from '@/lib/nutrition/types'

interface Props {
  days: DayDraft[]
  activeDayIndex: number
  onSelectDay: (index: number) => void
  onAddDay: () => void
  onRemoveDay: (index: number) => void
  onRenameDay: (index: number, name: string) => void
}

export default function NutritionProtocolDayTabs({
  days, activeDayIndex, onSelectDay, onAddDay, onRemoveDay, onRenameDay,
}: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {days.map((day, i) => (
        <div
          key={day.localId}
          className={`group relative flex items-center gap-1.5 h-8 px-3 rounded-xl border-[0.3px] shrink-0 transition-all cursor-pointer ${
            i === activeDayIndex
              ? 'bg-[#1f8a65]/10 border-[#1f8a65]/30 text-[#1f8a65]'
              : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.05] hover:text-white/80'
          }`}
          onClick={() => onSelectDay(i)}
        >
          {i === activeDayIndex ? (
            <input
              value={day.name}
              onChange={e => onRenameDay(i, e.target.value)}
              onClick={e => e.stopPropagation()}
              className="bg-transparent text-[12px] font-semibold outline-none w-[120px] truncate text-[#1f8a65]"
            />
          ) : (
            <span className="text-[12px] font-semibold truncate max-w-[120px]">{day.name}</span>
          )}
          {days.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); onRemoveDay(i) }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-red-400"
            >
              <X size={11} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onAddDay}
        className="flex items-center gap-1 h-8 px-3 rounded-xl bg-white/[0.03] border-[0.3px] border-white/[0.06] text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all shrink-0 text-[12px] font-semibold"
      >
        <Plus size={12} /> Ajouter un jour
      </button>
    </div>
  )
}
