'use client'

import { X, Eye } from 'lucide-react'
import MacroBar from './MacroBar'
import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'
import type { DayDraft } from '@/lib/nutrition/types'

interface Props {
  clientName: string
  protocolName: string
  days: DayDraft[]
  onClose: () => void
}

export default function ClientPreviewModal({ clientName, protocolName, days, onClose }: Props) {
  const filledDays = days.filter(d => d.calories)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#181818] rounded-2xl border-[0.3px] border-white/[0.06] w-full max-w-sm max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-[#1f8a65]" />
            <p className="text-[12px] font-semibold text-white">Vue client — {clientName}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Simulated client view */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35 mb-1">Protocole actif</p>
            <p className="text-[15px] font-bold text-white">{protocolName}</p>
          </div>

          {filledDays.length === 0 && (
            <p className="text-[12px] text-white/40 text-center py-6">
              Aucun jour configuré — injectez des macros d&apos;abord.
            </p>
          )}

          {filledDays.map(day => {
            const cal = Number(day.calories) || 0
            const p = Number(day.protein_g) || 0
            const f = Number(day.fat_g) || 0
            const c = Number(day.carbs_g) || 0
            const h = Number(day.hydration_ml) || 0

            return (
              <div key={day.localId} className="rounded-xl bg-white/[0.03] border-[0.3px] border-white/[0.06] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] font-semibold text-white">{day.name}</p>
                  <p className="text-[13px] font-bold text-[#1f8a65]">{cal} kcal</p>
                </div>
                <MacroBar calories={cal} protein_g={p} carbs_g={c} fat_g={f} height={5} showLabels />
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="text-center">
                    <p className="text-[11px] font-semibold" style={{ color: NUTRITION_UI_COLORS.protein }}>{p}g</p>
                    <p className="text-[9px] text-white/40">Protéines</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-semibold" style={{ color: NUTRITION_UI_COLORS.fat }}>{f}g</p>
                    <p className="text-[9px] text-white/40">Lipides</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-semibold" style={{ color: NUTRITION_UI_COLORS.carbs }}>{c}g</p>
                    <p className="text-[9px] text-white/40">Glucides</p>
                  </div>
                </div>
                {h > 0 && (
                  <p className="text-[10px] text-blue-400/70 mt-2">💧 {(h/1000).toFixed(1)} L / jour</p>
                )}
                {day.recommendations && (
                  <p className="text-[10px] text-white/40 mt-2 leading-relaxed">{day.recommendations}</p>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-5 py-3 border-t border-white/[0.06]">
          <p className="text-[9px] text-white/25 text-center">
            Aperçu de ce que {clientName} verra dans son application
          </p>
        </div>
      </div>
    </div>
  )
}
