'use client'

import { NUTRITION_UI_COLORS } from '@/lib/nutrition/ui-colors'

interface MacroPercentageDisplayProps {
  proteinG: number
  fatG: number
  carbsG: number
  totalCalories: number
  proteinOverride: number | null
  onProteinOverrideChange: (v: number | null) => void
}

export default function MacroPercentageDisplay({
  proteinG,
  fatG,
  carbsG,
  totalCalories,
  proteinOverride,
  onProteinOverrideChange,
}: MacroPercentageDisplayProps) {
  if (!totalCalories) return null

  const proteinPct = Math.round((proteinG * 4 / totalCalories) * 100)
  const fatPct     = Math.round((fatG   * 9 / totalCalories) * 100)
  const carbsPct   = Math.round((carbsG * 4 / totalCalories) * 100)

  const rows = [
    { label: 'Protéines', g: proteinG, pct: proteinPct, accent: NUTRITION_UI_COLORS.protein },
    { label: 'Lipides',   g: fatG,     pct: fatPct,     accent: NUTRITION_UI_COLORS.fat     },
    { label: 'Glucides',  g: carbsG,   pct: carbsPct,   accent: NUTRITION_UI_COLORS.carbs   },
  ]

  return (
    <div className="space-y-2.5">
      {rows.map(row => (
        <div key={row.label}>
          {/* Header row: dot + label + grams + pct + override */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: row.accent }} />
            <span className="text-[12px] font-semibold text-white w-16 shrink-0">{row.label}</span>
            <span className="text-[13px] font-bold text-white w-12 text-right shrink-0">{row.g}g</span>
            <span className="text-[11px] text-white/40 w-16 text-right shrink-0">{row.pct}% kcal</span>
            {row.label === 'Protéines' && (
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[9px] text-white/25 whitespace-nowrap">g/kg LBM</span>
                <input
                  type="number" step="0.1" min={1.5} max={4}
                  value={proteinOverride ?? ''}
                  placeholder="auto"
                  onChange={e => onProteinOverrideChange(e.target.value ? Number(e.target.value) : null)}
                  className="w-14 rounded-md bg-white/[0.04] border-[0.3px] border-white/[0.06] px-2 py-0.5 text-[10px] text-white/70 text-right outline-none placeholder:text-white/20 focus:border-[#1f8a65]/40"
                />
                {proteinOverride && (
                  <button onClick={() => onProteinOverrideChange(null)} className="text-[9px] text-white/30 hover:text-white/60">
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Progress bar */}
          <div className="ml-3.5 mr-4 h-[3px] rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(row.pct, 100)}%`, backgroundColor: row.accent, opacity: 0.7 }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
