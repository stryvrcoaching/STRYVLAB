'use client'

import type { DayDraft, NutritionClientData } from '@/lib/nutrition/types'

interface Props {
  day: DayDraft
  clientData: NutritionClientData | null
  onDayChange: (updates: Partial<DayDraft>) => void
}

export default function NutritionHydratationSection({ day, clientData, onDayChange }: Props) {
  const autoMl = clientData?.weight_kg
    ? Math.round(clientData.weight_kg * 35)
    : null

  return (
    <div className="space-y-3">
      {autoMl && !day.hydration_ml && (
        <div className="flex items-center justify-between bg-blue-500/[0.06] border-[0.3px] border-blue-500/20 rounded-xl px-3 py-2.5">
          <div>
            <p className="text-[11px] font-semibold text-blue-400">Suggestion hydratation</p>
            <p className="text-[10px] text-white/40 mt-0.5">{autoMl} ml · basé sur {clientData?.weight_kg} kg × 35 ml/kg</p>
          </div>
          <button
            onClick={() => onDayChange({ hydration_ml: String(autoMl) })}
            className="h-7 px-3 rounded-lg bg-blue-500/20 text-blue-400 text-[11px] font-bold hover:bg-blue-500/30 transition-colors"
          >
            Appliquer
          </button>
        </div>
      )}
      <div>
        <label className="block text-[9px] font-bold uppercase tracking-[0.16em] text-white/35 mb-1">Hydratation (ml/jour)</label>
        <input
          type="number"
          value={day.hydration_ml}
          onChange={e => onDayChange({ hydration_ml: e.target.value })}
          placeholder="ex: 2500"
          className="w-full h-8 rounded-lg bg-white/[0.04] border-[0.3px] border-white/[0.06] px-3 text-[12px] font-semibold text-white placeholder:text-white/20 outline-none focus:border-white/[0.12] transition-colors"
        />
      </div>
    </div>
  )
}
